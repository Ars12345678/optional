import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js';
import { CANNON } from './physics.js';

export class Player {
  constructor({ world, scene }) {
    this.radius = 0.6;
    this.moveSpeed = 7.5;
    this.jumpImpulse = 5.5;
    this.canJump = false;
    this.health = 100;

    this.group = new THREE.Group();

    const bodyGeometry = new THREE.CapsuleGeometry(this.radius * 0.7, this.radius * 1.3, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4cc9f0, metalness: 0.1, roughness: 0.8 });
    this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.mesh.castShadow = true;
    this.group.add(this.mesh);

    this.cameraHolder = new THREE.Object3D();
    this.cameraHolder.position.set(0, this.radius * 1.4, 0);
    this.group.add(this.cameraHolder);

    // Physics body (use a sphere for stability)
    const shape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({ mass: 1.2, linearDamping: 0.1, angularDamping: 0.99 });
    this.body.addShape(shape);
    this.body.position.set(0, 2, 5);

    this.body.addEventListener('collide', (e) => {
      // simple ground detection
      if (Math.abs(e.contact.ni.y) > 0.5) {
        this.canJump = true;
      }
    });

    world.addBody(this.body);
    scene.add(this.group);
  }

  setCamera(camera) {
    this.cameraHolder.add(camera);
  }

  applyMovement({ forward, right, dt }) {
    const velocity = this.body.velocity;
    const speed = this.moveSpeed;

    // Desired horizontal velocity
    const targetVx = (right) * speed;
    const targetVz = (forward) * speed;

    // Rotate by player yaw (group.rotation.y)
    const yaw = this.group.rotation.y;
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const worldVx = targetVx * cos - targetVz * sin;
    const worldVz = targetVx * sin + targetVz * cos;

    // Preserve Y velocity
    velocity.x = worldVx;
    velocity.z = worldVz;
  }

  jump() {
    if (!this.canJump) return false;
    this.body.velocity.y = this.jumpImpulse;
    this.canJump = false;
    return true;
  }

  updateThreeFromPhysics() {
    this.group.position.copy(this.body.position);
  }
}

export class Enemy {
  constructor({ world, scene, position }) {
    const size = 1 + Math.random() * 0.6;
    this.size = size;
    this.isDead = false;

    const geometry = new THREE.BoxGeometry(size, size, size);
    const material = new THREE.MeshStandardMaterial({ color: 0xff8fab, metalness: 0.05, roughness: 0.85 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
    this.body = new CANNON.Body({ mass: 1 });
    this.body.addShape(shape);
    this.body.position.set(position.x, position.y, position.z);

    world.addBody(this.body);
    scene.add(this.mesh);

    this.body.entityRef = this; // back-reference for collision handling
  }

  markDead(world, scene) {
    this.isDead = true;
    world.removeBody(this.body);
    scene.remove(this.mesh);
  }

  updateThreeFromPhysics() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }
}

export class Bullet {
  constructor({ world, scene, origin, direction }) {
    this.lifetime = 2.0;
    this.age = 0;
    this.dead = false;

    const radius = 0.12;
    const geometry = new THREE.SphereGeometry(radius, 10, 10);
    const material = new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0x553300 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.castShadow = true;

    const shape = new CANNON.Sphere(radius);
    const speed = 30;
    this.body = new CANNON.Body({ mass: 0.05, linearDamping: 0.01 });
    this.body.addShape(shape);
    this.body.position.set(origin.x, origin.y, origin.z);
    this.body.velocity.set(direction.x * speed, direction.y * speed, direction.z * speed);

    this.body.addEventListener('collide', (e) => {
      const other = e.body.entityRef;
      if (other && other instanceof Enemy) {
        other.markDead(this._world, this._scene);
      }
      this.dead = true;
    });

    this._world = world;
    this._scene = scene;

    world.addBody(this.body);
    scene.add(this.mesh);
  }

  update(dt) {
    this.age += dt;
    if (this.age >= this.lifetime) this.dead = true;
  }

  updateThreeFromPhysics() {
    this.mesh.position.copy(this.body.position);
  }

  dispose(world, scene) {
    world.removeBody(this.body);
    scene.remove(this.mesh);
  }
}