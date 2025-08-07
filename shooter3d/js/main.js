import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { createWorld, stepWorld, makeGroundBody } from './physics.js';
import { Player, Enemy, EnemyShooter, Bullet } from './entities.js';
import { MobileControls } from './controls.js';
import { levels, generateEnemyPositions } from './levels.js';
import { weapons } from './weapons.js';

const canvas = document.getElementById('game-canvas');
const hudLevel = document.getElementById('level');
const hudHealth = document.getElementById('health');
const hudEnemies = document.getElementById('enemies');
const hudWeaponName = document.getElementById('weapon-name');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const openMenuBtn = document.getElementById('open-menu-btn');
const gameOver = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');
const finalStats = document.getElementById('final-stats');
const pauseBtn = document.getElementById('pause-btn');
const menuOverlay = document.getElementById('menu-overlay');
const menuClose = document.getElementById('menu-close');
const menuApply = document.getElementById('menu-apply');
const optBloom = document.getElementById('opt-bloom');
const optShadows = document.getElementById('opt-shadows');
const optCamera = document.getElementById('opt-camera');
const optSens = document.getElementById('opt-sens');
const optAutofire = document.getElementById('opt-autofire');
const optQuality = document.getElementById('opt-quality');
const switchWeaponBtn = document.getElementById('switch-weapon');

// Renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f12);
scene.fog = new THREE.Fog(0x0b0f12, 40, 140);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.05).texture;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);

// Postprocessing
let composer = new EffectComposer(renderer);
let renderPass = new RenderPass(scene, camera);
let bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.5, 0.8, 0.85);
composer.addPass(renderPass);
composer.addPass(bloomPass);

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.6);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 1.1);
dir.position.set(16, 24, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(1024, 1024);
dir.shadow.camera.near = 0.5;
dir.shadow.camera.far = 120;
scene.add(dir);

// Ground
const groundGeo = new THREE.PlaneGeometry(400, 400, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1b2831, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.receiveShadow = true;
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Physics world
const world = createWorld();
makeGroundBody({ world, height: 0 });

// Player
const player = new Player({ world, scene });
player.setCamera(camera);
camera.position.set(0, 0, 0);

// Controls
const controls = new MobileControls({
  moveZoneEl: document.getElementById('move-zone'),
  fireBtnEl: document.getElementById('fire-btn'),
  jumpBtnEl: document.getElementById('jump-btn'),
  domOverlayEl: document.getElementById('ui-root'),
});

let yaw = 0;
let pitch = 0;
let lookSensitivity = 1.0;

controls.onFire = () => tryShoot();
controls.onFireStart = () => { /* handled by isFiring in loop */ };
controls.onFireEnd = () => { /* noop */ };
controls.onJump = () => player.jump();

// Level state
let currentLevelIndex = 0;
let enemies = [];
let bullets = [];
let totalKills = 0;

// Camera mode
let cameraMode = 'first'; // 'first' | 'third'
const thirdPersonOffset = new THREE.Vector3(0, 1.6, 4.5);
const cameraTargetPos = new THREE.Vector3();

// Weapons
let weaponIndex = 0;
let fireCooldown = 0; // seconds
let autofire = false;

function currentWeapon() { return weapons[weaponIndex % weapons.length]; }

function cycleWeapon() {
  weaponIndex = (weaponIndex + 1) % weapons.length;
  hudWeaponName.textContent = currentWeapon().name;
}

switchWeaponBtn.addEventListener('click', cycleWeapon);
switchWeaponBtn.addEventListener('touchstart', (e) => { cycleWeapon(); e.preventDefault(); }, { passive: false });

function loadLevel(index) {
  enemies.forEach(e => e.markDead(world, scene));
  enemies = [];
  bullets.forEach(b => b.dispose(world, scene));
  bullets = [];

  const level = levels[index] || levels[levels.length - 1];
  hudLevel.textContent = String(level.id);

  const positions = generateEnemyPositions(level.enemies, level.spread);
  enemies = positions.map(pos => {
    if (pos.type === 'shooter') return new EnemyShooter({ world, scene, position: pos });
    return new Enemy({ world, scene, position: pos, type: pos.type });
  });
  updateHud();
}

function makeShotDirectionWithSpread(baseDir, spread) {
  const dir = baseDir.clone();
  dir.x += (Math.random()*2-1) * spread;
  dir.y += (Math.random()*2-1) * spread * 0.5;
  dir.z += (Math.random()*2-1) * spread;
  dir.normalize();
  return dir;
}

function tryShoot() {
  const w = currentWeapon();
  if (fireCooldown > 0) return;

  const origin = new THREE.Vector3();
  player.cameraHolder.getWorldPosition(origin);
  const baseDir = new THREE.Vector3(0, 0, -1);
  const quat = new THREE.Quaternion();
  player.cameraHolder.getWorldQuaternion(quat);
  baseDir.applyQuaternion(quat);

  for (let i = 0; i < w.pellets; i++) {
    const dir = makeShotDirectionWithSpread(baseDir, w.spread);
    const bullet = new Bullet({ world, scene, origin, direction: dir, faction: 'player', damage: w.damage });
    bullets.push(bullet);
  }

  fireCooldown = 1 / w.rate;
}

function updateHud() {
  hudHealth.textContent = String(Math.max(0, Math.floor(player.health)));
  const alive = enemies.filter(e => !e.isDead).length;
  hudEnemies.textContent = String(alive);
  hudWeaponName.textContent = currentWeapon().name;
}

function checkLevelClear() {
  const alive = enemies.filter(e => !e.isDead).length;
  if (alive === 0) {
    currentLevelIndex = Math.min(currentLevelIndex + 1, levels.length - 1);
    loadLevel(currentLevelIndex);
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloomPass.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

let lastTime = performance.now();
let running = false;

function updateCamera(dt) {
  if (cameraMode === 'first') {
    camera.position.set(0, 0, 0);
    return;
  }
  // Third-person smoothed follow
  const offset = thirdPersonOffset.clone();
  const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
  offset.applyQuaternion(yawQuat);
  cameraTargetPos.copy(player.group.position).add(new THREE.Vector3(0, 0.5, 0)).add(offset);
  const current = new THREE.Vector3();
  camera.getWorldPosition(current);
  current.lerp(cameraTargetPos, 1 - Math.pow(0.001, dt));
  camera.position.copy(current);
  camera.lookAt(player.group.position.x, player.group.position.y + 0.9, player.group.position.z);
}

function gameLoop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Look
  const { dx, dy } = controls.consumeLookDelta();
  const lookSpeed = 0.0028 * lookSensitivity;
  yaw -= dx * lookSpeed;
  pitch -= dy * lookSpeed;
  pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitch));
  player.group.rotation.y = yaw;
  player.cameraHolder.rotation.x = pitch;

  // Movement
  const mv = controls.moveVector;
  const forward = -mv.y;
  const right = mv.x;
  player.applyMovement({ forward, right, dt });

  // Auto-fire
  const w = currentWeapon();
  if ((autofire || w.auto) && controls.isFiring) tryShoot();
  if (fireCooldown > 0) fireCooldown = Math.max(0, fireCooldown - dt);

  // Enemy shooter fire occasionally
  enemies.forEach(e => {
    if (!(e instanceof EnemyShooter) || e.isDead) return;
    e._lastShot += dt;
    if (e._lastShot > 1.2 + Math.random()*0.8) {
      e._lastShot = 0;
      const origin = e.body.position.clone();
      origin.y += 0.6;
      const dir = new THREE.Vector3(
        player.body.position.x - origin.x,
        (player.body.position.y + 0.6) - origin.y,
        player.body.position.z - origin.z,
      ).normalize();
      const bullet = new Bullet({ world, scene, origin, direction: dir, faction: 'enemy', damage: 10, playerRef: player });
      bullets.push(bullet);
    }
  });

  // Physics
  stepWorld(world, dt);

  // Sync graphics
  player.updateThreeFromPhysics();
  enemies.forEach(e => e.updateThreeFromPhysics());
  bullets.forEach(b => { b.update(dt); b.updateThreeFromPhysics(); });

  // Cleanup bullets
  bullets = bullets.filter(b => { if (b.dead) { b.dispose(world, scene); return false; } return true; });

  // Count kills and damage
  const prevAlive = parseInt(hudEnemies.textContent, 10) || 0;
  const alive = enemies.filter(e => !e.isDead).length;
  if (alive < prevAlive) totalKills += (prevAlive - alive);

  updateHud();
  checkLevelClear();

  updateCamera(dt);

  if (useComposer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}

function startGame() {
  running = true;
  lastTime = performance.now();
  yaw = 0; pitch = 0;
  player.body.position.set(0, 2, 8);
  player.body.velocity.set(0, 0, 0);
  player.health = 100;
  currentLevelIndex = 0;
  totalKills = 0;
  loadLevel(currentLevelIndex);
  startOverlay.classList.add('hidden');
  gameOver.classList.add('hidden');
  menuOverlay.classList.add('hidden');
  requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  finalStats.textContent = `Уровень: ${levels[currentLevelIndex].id}, Убийств: ${totalKills}`;
  gameOver.classList.remove('hidden');
}

// AI pushes for chasers/heavies
setInterval(() => {
  if (!running) return;
  const playerPos = player.body.position;
  enemies.forEach(e => {
    if (e.isDead) return;
    const isShooter = e instanceof EnemyShooter;
    const basePush = isShooter ? 2.5 : 5;
    const dirx = playerPos.x - e.body.position.x;
    const dirz = playerPos.z - e.body.position.z;
    const len = Math.hypot(dirx, dirz) || 1;
    const push = basePush / len;
    e.body.applyForce({ x: dirx * push, y: 0, z: dirz * push }, e.body.position);
  });
}, 220);

// Damage on touch for non-shooters
setInterval(() => {
  if (!running) return;
  const p = player.body.position;
  enemies.forEach(e => {
    if (e.isDead || (e instanceof EnemyShooter)) return;
    const d = Math.hypot(e.body.position.x - p.x, e.body.position.z - p.z);
    if (d < 1.4) player.health -= (e.size > 1.3 ? 4 : 2);
  });
  if (player.health <= 0) endGame();
}, 300);

// Start / Pause / Menu
startBtn.addEventListener('click', () => {
  const root = document.documentElement;
  if (root.requestFullscreen) root.requestFullscreen();
  startGame();
});

openMenuBtn.addEventListener('click', () => { menuOverlay.classList.remove('hidden'); });
menuClose.addEventListener('click', () => { menuOverlay.classList.add('hidden'); });

pauseBtn.addEventListener('click', () => {
  if (!running) { requestAnimationFrame(gameLoop); running = true; return; }
  running = false;
  menuOverlay.classList.remove('hidden');
});

menuApply.addEventListener('click', () => {
  setQuality(optQuality.value);
  setShadows(optShadows.checked);
  setBloom(optBloom.checked);
  setCameraMode(optCamera.value);
  lookSensitivity = parseFloat(optSens.value) || 1.0;
  autofire = optAutofire.checked;
  menuOverlay.classList.add('hidden');
});

// Quality toggles
let useComposer = true;
function setBloom(enabled) { bloomPass.enabled = !!enabled; }
function setShadows(enabled) { renderer.shadowMap.enabled = !!enabled; }
function setQuality(q) {
  if (q === 'low') {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.1));
    useComposer = false;
  } else if (q === 'med') {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    useComposer = true; bloomPass.strength = 0.5;
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    useComposer = true; bloomPass.strength = 0.7;
  }
}
function setCameraMode(mode) { cameraMode = mode; }

// Decorative environment: pillars
(function addEnvironment() {
  const pillarGeo = new THREE.CylinderGeometry(0.7, 0.9, 4, 8);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x243642, roughness: 0.8, metalness: 0.1 });
  for (let i = 0; i < 32; i++) {
    const m = new THREE.Mesh(pillarGeo, pillarMat);
    const r = 30 + Math.random()*80;
    const a = Math.random()*Math.PI*2;
    m.position.set(Math.cos(a)*r, 2, Math.sin(a)*r);
    m.castShadow = true; m.receiveShadow = true;
    scene.add(m);
  }
})();

// Defaults from menu
setBloom(optBloom.checked);
setShadows(optShadows.checked);
setQuality(optQuality.value);
setCameraMode(optCamera.value);
lookSensitivity = parseFloat(optSens.value) || 1.0;
autofire = optAutofire.checked;