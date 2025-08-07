import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { createWorld, stepWorld, makeGroundBody } from './physics.js';
import { Player, Enemy, Bullet } from './entities.js';
import { MobileControls } from './controls.js';
import { levels, generateEnemyPositions } from './levels.js';

const canvas = document.getElementById('game-canvas');
const hudLevel = document.getElementById('level');
const hudHealth = document.getElementById('health');
const hudEnemies = document.getElementById('enemies');
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const gameOver = document.getElementById('game-over');
const restartBtn = document.getElementById('restart-btn');
const finalStats = document.getElementById('final-stats');

// Setup renderer
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Scene and camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f12);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 500);

// Lights
const hemi = new THREE.HemisphereLight(0xffffff, 0x223344, 0.6);
scene.add(hemi);

const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(10, 20, 10);
dir.castShadow = true;
scene.add(dir);

// Ground
const groundGeo = new THREE.PlaneGeometry(400, 400);
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

controls.onFire = () => shoot();
controls.onJump = () => player.jump();

// Level state
let currentLevelIndex = 0;
let enemies = [];
let bullets = [];
let totalKills = 0;

function loadLevel(index) {
  enemies.forEach(e => e.markDead(world, scene));
  enemies = [];
  bullets.forEach(b => b.dispose(world, scene));
  bullets = [];

  const level = levels[index] || levels[levels.length - 1];
  hudLevel.textContent = String(level.id);

  const positions = generateEnemyPositions(level.enemies, level.spread);
  enemies = positions.map(pos => new Enemy({ world, scene, position: pos }));
  updateHud();
}

function shoot() {
  // Bullet from camera
  const origin = new THREE.Vector3();
  player.cameraHolder.getWorldPosition(origin);
  const dir = new THREE.Vector3(0, 0, -1);
  const quat = new THREE.Quaternion();
  player.cameraHolder.getWorldQuaternion(quat);
  dir.applyQuaternion(quat);

  const bullet = new Bullet({ world, scene, origin, direction: dir });
  bullets.push(bullet);
}

function updateHud() {
  hudHealth.textContent = String(Math.max(0, Math.floor(player.health)));
  const alive = enemies.filter(e => !e.isDead).length;
  hudEnemies.textContent = String(alive);
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
}
window.addEventListener('resize', onResize);

let lastTime = performance.now();
let running = false;

function gameLoop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  // Look
  const { dx, dy } = controls.consumeLookDelta();
  const lookSpeed = 0.0028;
  yaw -= dx * lookSpeed;
  pitch -= dy * lookSpeed;
  pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitch));
  player.group.rotation.y = yaw;
  player.cameraHolder.rotation.x = pitch;

  // Movement from joystick
  const mv = controls.moveVector; // x:right, y:down
  const forward = -mv.y; // up is negative y
  const right = mv.x;
  player.applyMovement({ forward, right, dt });

  // Physics step
  stepWorld(world, dt);

  // Sync graphics
  player.updateThreeFromPhysics();
  enemies.forEach(e => e.updateThreeFromPhysics());
  bullets.forEach(b => { b.update(dt); b.updateThreeFromPhysics(); });

  // Cleanup bullets
  bullets = bullets.filter(b => {
    if (b.dead) { b.dispose(world, scene); return false; }
    return true;
  });

  // Count kills and damage
  const prevAlive = parseInt(hudEnemies.textContent, 10) || 0;
  const alive = enemies.filter(e => !e.isDead).length;
  if (alive < prevAlive) {
    totalKills += (prevAlive - alive);
  }

  updateHud();
  checkLevelClear();

  renderer.render(scene, camera);
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
  requestAnimationFrame(gameLoop);
}

function endGame() {
  running = false;
  finalStats.textContent = `Уровень: ${levels[currentLevelIndex].id}, Убийств: ${totalKills}`;
  gameOver.classList.remove('hidden');
}

// Simple enemy AI: push towards player a bit
setInterval(() => {
  if (!running) return;
  const playerPos = player.body.position;
  enemies.forEach(e => {
    if (e.isDead) return;
    const dirx = playerPos.x - e.body.position.x;
    const dirz = playerPos.z - e.body.position.z;
    const len = Math.hypot(dirx, dirz) || 1;
    const push = 5 / len;
    e.body.applyForce({ x: dirx * push, y: 0, z: dirz * push }, e.body.position);
  });
}, 200);

// Basic player damage on touch
setInterval(() => {
  if (!running) return;
  const p = player.body.position;
  enemies.forEach(e => {
    if (e.isDead) return;
    const d = Math.hypot(e.body.position.x - p.x, e.body.position.z - p.z);
    if (d < 1.4) player.health -= 2;
  });
  if (player.health <= 0) endGame();
}, 300);

// Start / Restart
startBtn.addEventListener('click', () => {
  // Attempt fullscreen for mobile immersion
  const root = document.documentElement;
  if (root.requestFullscreen) root.requestFullscreen();
  startGame();
});

restartBtn.addEventListener('click', () => startGame());

// Decorative environment: random boxes
(function addEnvironment() {
  const boxGeo = new THREE.BoxGeometry(2, 2, 2);
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x243642, roughness: 0.9 });
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(boxGeo, boxMat);
    m.position.set((Math.random()-0.5)*140, 1, (Math.random()-0.5)*140);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
})();