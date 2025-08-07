export const levels = [
  { id: 1, enemies: { chaser: 5, shooter: 0, heavy: 0 }, spread: 14 },
  { id: 2, enemies: { chaser: 7, shooter: 1, heavy: 0 }, spread: 18 },
  { id: 3, enemies: { chaser: 8, shooter: 2, heavy: 1 }, spread: 22 },
  { id: 4, enemies: { chaser: 10, shooter: 3, heavy: 2 }, spread: 26 },
  { id: 5, enemies: { chaser: 12, shooter: 4, heavy: 3 }, spread: 32 },
];

export function generateEnemyPositions(config, spread) {
  const positions = [];
  const pushType = (type, count) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * spread;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push({ x, y: 1 + Math.random() * 2, z, type });
    }
  };
  pushType('chaser', config.chaser || 0);
  pushType('shooter', config.shooter || 0);
  pushType('heavy', config.heavy || 0);
  return positions;
}