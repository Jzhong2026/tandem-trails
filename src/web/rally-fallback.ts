import type { RallyRun } from '../shared/knowledge-rally.js';

export function paintRallyFallback(canvas: HTMLCanvasElement, run: RallyRun, time: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  const horizon = height * 0.34;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, run.level.sky);
  sky.addColorStop(1, run.level.fog);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = run.level.ground;
  ctx.fillRect(0, horizon, width, height - horizon);

  ctx.fillStyle = run.level.biome === 'snow' ? '#8b9da5' : '#60766e';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= width; x += 40) ctx.lineTo(x, horizon - 25 - Math.sin(x * 0.013 + run.level.seed) * 28);
  ctx.lineTo(width, horizon);
  ctx.fill();

  const roadNear = width * 0.82;
  const roadFar = width * 0.07;
  ctx.fillStyle = run.level.road;
  ctx.beginPath();
  ctx.moveTo(width / 2 - roadFar, horizon);
  ctx.lineTo(width / 2 + roadFar, horizon);
  ctx.lineTo(width / 2 + roadNear, height);
  ctx.lineTo(width / 2 - roadNear, height);
  ctx.fill();
  ctx.strokeStyle = '#f1eee4';
  ctx.lineWidth = Math.max(2, width * 0.004);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(width / 2 + side * roadFar, horizon);
    ctx.lineTo(width / 2 + side * roadNear, height);
    ctx.stroke();
  }
  ctx.strokeStyle = '#eee9d8';
  ctx.lineWidth = Math.max(2, width * 0.003);
  for (const lane of [-0.5, 0.5]) {
    for (let i = 0; i < 12; i++) {
      const p = ((i / 12 + run.distance * 0.002) % 1);
      const y = horizon + p * p * (height - horizon);
      const half = roadFar + p * (roadNear - roadFar);
      const x = width / 2 + lane * half * 1.45;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 4 + p * 20);
      ctx.stroke();
    }
  }

  for (const obstacle of run.obstacles) {
    const ahead = obstacle.distance - run.distance;
    if (ahead < 0 || ahead > 180) continue;
    const p = 1 - ahead / 180;
    const y = horizon + p * p * (height - horizon);
    const half = roadFar + p * (roadNear - roadFar);
    const x = width / 2 + (obstacle.lane - 1) * half * 0.48;
    const size = 4 + p * width * 0.055;
    ctx.fillStyle = obstacle.kind === 'cone' ? '#ef6a32' : obstacle.kind === 'barrier' ? '#e5e8e5' : '#9b6a3e';
    ctx.fillRect(x - size / 2, y - size, size, size);
    if (obstacle.kind === 'barrier') {
      ctx.fillStyle = '#c53d32';
      for (let i = 0; i < 3; i++) ctx.fillRect(x - size / 2 + i * size / 3, y - size, size / 6, size);
    }
  }

  const carX = width / 2 + (run.laneVisual - 1) * width * 0.22;
  const carY = height * 0.83;
  const carW = run.vehicle.kind === 'truck' ? width * 0.16 : width * 0.115;
  const carH = run.vehicle.kind === 'truck' ? carW * 0.95 : carW * 0.55;
  ctx.fillStyle = '#00000055';
  ctx.beginPath();
  ctx.ellipse(carX, carY + carH * 0.45, carW * 0.62, carH * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = run.vehicle.color;
  ctx.beginPath();
  ctx.roundRect(carX - carW / 2, carY - carH / 2, carW, carH, carH * 0.16);
  ctx.fill();
  ctx.fillStyle = '#152331';
  ctx.fillRect(carX - carW * 0.34, carY - carH * 0.36, carW * 0.68, carH * 0.35);
  ctx.fillStyle = '#ff4b3e';
  ctx.fillRect(carX - carW * 0.4, carY + carH * 0.2, carW * 0.18, carH * 0.13);
  ctx.fillRect(carX + carW * 0.22, carY + carH * 0.2, carW * 0.18, carH * 0.13);
  ctx.fillStyle = '#111';
  ctx.fillRect(carX - carW * 0.55, carY + carH * 0.22, carW * 0.15, carH * 0.28);
  ctx.fillRect(carX + carW * 0.4, carY + carH * 0.22, carW * 0.15, carH * 0.28);

  if (run.boostMs > 0) {
    ctx.strokeStyle = `rgba(117,216,255,${0.25 + Math.sin(time * 20) * 0.12})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const x = (i * 97 + time * 800) % width;
      const y = horizon + ((i * 53) % (height - horizon));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (x - width / 2) * 0.08, y + 30);
      ctx.stroke();
    }
  }
}
