import { Eraser, Trash2, Undo2 } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BoardEvent } from '../../hooks/useLiveRoom';
import type { Stroke } from '../../lib/types';

const COLORS = ['#18181b', '#4f46e5', '#dc2626', '#059669', '#d97706'];
const PAPER = '#ffffff';
const SIZES = [3, 6, 12];

export interface WhiteboardHandle {
  apply: (e: BoardEvent) => void;
}

interface Props {
  myId: string;
  isHost: boolean;
  onStroke: (stroke: Omit<Stroke, 'userId'>) => void;
  onUndo: () => void;
  onClear: () => void;
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Pick<Stroke, 'color' | 'width' | 'points'>, w: number, h: number) {
  if (s.points.length === 0) return;
  // Widths are relative to an 800px-wide board so lines scale with the canvas.
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = (s.width * w) / 800;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (s.points.length === 1) {
    const [x, y] = s.points[0];
    ctx.beginPath();
    ctx.arc(x * w, y * h, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(s.points[0][0] * w, s.points[0][1] * h);
  // Quadratic curves through midpoints give smooth lines from sparse pointer samples.
  for (let i = 1; i < s.points.length - 1; i++) {
    const [x1, y1] = s.points[i];
    const [x2, y2] = s.points[i + 1];
    ctx.quadraticCurveTo(x1 * w, y1 * h, ((x1 + x2) / 2) * w, ((y1 + y2) / 2) * h);
  }
  const last = s.points[s.points.length - 1];
  ctx.lineTo(last[0] * w, last[1] * h);
  ctx.stroke();
}

/** A shared canvas: everyone in the room draws on it and sees each other's strokes instantly. */
export const Whiteboard = forwardRef<WhiteboardHandle, Props>(function Whiteboard({ myId, isHost, onStroke, onUndo, onClear }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(SIZES[0]);
  const [erasing, setErasing] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width, height } = canvas;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, width, height);
    for (const s of strokes.current) drawStroke(ctx, s, width, height);
    if (current.current) drawStroke(ctx, current.current, width, height);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      apply(e) {
        if (e.type === 'reset') strokes.current = [...e.strokes];
        else if (e.type === 'remove') strokes.current = strokes.current.filter((s) => s.id !== e.id);
        else {
          strokes.current.push(e.stroke);
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          // Adding is cheap: draw just the new stroke instead of the whole board.
          if (canvas && ctx) drawStroke(ctx, e.stroke, canvas.width, canvas.height);
          return;
        }
        redraw();
      },
    }),
    [redraw],
  );

  // Keep the canvas backing store matched to its on-screen size (and pixel density).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(entry.contentRect.width * dpr);
      canvas.height = Math.round(entry.contentRect.height * dpr);
      redraw();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  function point(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return [clamp((e.clientX - rect.left) / rect.width), clamp((e.clientY - rect.top) / rect.height)];
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = {
      id: crypto.randomUUID().slice(0, 12),
      userId: myId,
      color: erasing ? PAPER : color,
      width: erasing ? 28 : size,
      points: [point(e)],
    };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const s = current.current;
    if (!s) return;
    const [x, y] = point(e);
    const [px, py] = s.points[s.points.length - 1];
    // Skip tiny movements to keep strokes small on the wire.
    if (Math.hypot(x - px, y - py) < 0.002 || s.points.length >= 600) return;
    s.points.push([x, y]);
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    drawStroke(ctx, { ...s, points: s.points.slice(-3) }, canvas.width, canvas.height);
  }

  function onPointerUp() {
    const s = current.current;
    current.current = null;
    if (!s) return;
    strokes.current.push(s);
    redraw();
    const round = (v: number) => Math.round(v * 10000) / 10000;
    onStroke({ id: s.id, color: s.color, width: s.width, points: s.points.map(([x, y]) => [round(x), round(y)]) });
  }

  function undoMine() {
    const index = strokes.current.findLastIndex((s) => s.userId === myId);
    if (index === -1) return;
    strokes.current.splice(index, 1);
    redraw();
    onUndo();
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Pen color">
          {COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={!erasing && color === c}
              aria-label={`Color ${c}`}
              onClick={() => {
                setColor(c);
                setErasing(false);
              }}
              className={`size-7 rounded-full ring-offset-2 transition dark:ring-offset-zinc-900 ${!erasing && color === c ? 'ring-2 ring-indigo-500' : ''}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="mx-1 h-6 w-px bg-zinc-200 dark:bg-zinc-700" />
        {SIZES.map((s) => (
          <button
            key={s}
            aria-label={`Pen size ${s}`}
            onClick={() => {
              setSize(s);
              setErasing(false);
            }}
            className={`flex size-8 items-center justify-center rounded-lg transition ${!erasing && size === s ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          >
            <span className="rounded-full bg-zinc-800 dark:bg-zinc-200" style={{ width: s + 2, height: s + 2 }} />
          </button>
        ))}
        <button
          onClick={() => setErasing((v) => !v)}
          aria-pressed={erasing}
          className={`flex size-8 items-center justify-center rounded-lg transition ${erasing ? 'bg-zinc-200 dark:bg-zinc-700' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
          title="Eraser"
        >
          <Eraser className="size-4" />
        </button>
        <div className="ml-auto flex gap-1">
          <button onClick={undoMine} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800" title="Undo your last stroke">
            <Undo2 className="size-4" /> Undo
          </button>
          {isHost && (
            <button onClick={onClear} className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10" title="Clear the board for everyone">
              <Trash2 className="size-4" /> Clear
            </button>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="aspect-[16/10] w-full cursor-crosshair touch-none rounded-xl border border-zinc-200 bg-white dark:border-zinc-700"
        aria-label="Shared whiteboard"
      />
    </div>
  );
});
