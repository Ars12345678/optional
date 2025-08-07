export const levels = [
  { id: 1, enemies: 5, spread: 14 },
  { id: 2, enemies: 8, spread: 18 },
  { id: 3, enemies: 12, spread: 22 },
  { id: 4, enemies: 16, spread: 26 },
  { id: 5, enemies: 20, spread: 30 },
];

export function generateEnemyPositions(count, spread) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 4 + Math.random() * spread;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push({ x, y: 1 + Math.random() * 2, z });
  }
  return positions;
}