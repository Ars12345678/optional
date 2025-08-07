import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';

export function createWorld() {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0),
    broadphase: new CANNON.SAPBroadphase(),
    allowSleep: true,
  });
  world.defaultContactMaterial.friction = 0.2;
  world.defaultContactMaterial.restitution = 0.05;
  return world;
}

export function stepWorld(world, dt) {
  // Use a fixed time step for stability
  const fixedTimeStep = 1 / 60;
  const maxSubSteps = 3;
  world.step(fixedTimeStep, dt, maxSubSteps);
}

export function makeGroundBody({ world, size = 200, height = 0 }) {
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(groundShape);
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.set(0, height, 0);
  world.addBody(groundBody);
  return groundBody;
}

export { CANNON };