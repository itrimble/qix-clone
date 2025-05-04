// ui/canvas.ts

export function initCanvas(): HTMLCanvasElement {
  let canvas = document.querySelector<HTMLCanvasElement>("#gameCanvas");
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = "gameCanvas";
    document.body.appendChild(canvas);
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  return canvas;
}

export function resizeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}