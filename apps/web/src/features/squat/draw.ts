import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { LEG_LANDMARKS, type Point, type Side } from './counter.js';

// Canvas cannot read CSS variables; these mirror --color-primary and --color-text in tokens.css.
const PRIMARY = '#ff5a1f';
const BONE = 'rgba(250, 250, 250, 0.55)';

/** Skeleton overlay, with the leg used for counting highlighted. */
export function drawPose(
  canvas: HTMLCanvasElement,
  landmarks: readonly Point[] | null,
  side: Side | null,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;
  const at = (i: number) => {
    const p = landmarks[i];
    return p ? { x: p.x * canvas.width, y: p.y * canvas.height } : null;
  };

  ctx.lineWidth = 3;
  ctx.strokeStyle = BONE;
  for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
    const a = at(start);
    const b = at(end);
    if (!a || !b || start < 11 || end < 11) continue; // skip the face
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  if (!side) return;
  const leg = LEG_LANDMARKS[side].map(at);
  if (leg.some((p) => !p)) return;
  ctx.lineWidth = 6;
  ctx.strokeStyle = PRIMARY;
  ctx.beginPath();
  leg.forEach((p, i) => (i === 0 ? ctx.moveTo(p!.x, p!.y) : ctx.lineTo(p!.x, p!.y)));
  ctx.stroke();
  ctx.fillStyle = PRIMARY;
  for (const p of leg) {
    ctx.beginPath();
    ctx.arc(p!.x, p!.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
}
