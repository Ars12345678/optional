export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mapRange(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}

export function vec2Length(x, y) {
  return Math.hypot(x, y);
}

export function normalize2(x, y) {
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}