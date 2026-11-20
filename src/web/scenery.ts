type Context = CanvasRenderingContext2D;
type Point = readonly [number, number];

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');

export function animationSeconds(elapsedMs: number) {
  return motionPreference.matches ? 0 : elapsedMs / 1000;
}

export function polygon(ctx: Context, color: string, points: readonly Point[]) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(...points[i]);
  ctx.closePath();
  ctx.fill();
}

export function halo(ctx: Context, x: number, y: number, radius: number, color: string) {
  const light = ctx.createRadialGradient(x, y, 0, x, y, radius);
  light.addColorStop(0, color);
  light.addColorStop(1, '#0000');
  ctx.fillStyle = light;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
