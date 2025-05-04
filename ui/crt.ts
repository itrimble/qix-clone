// ui/crt.ts

let crtEnabled = false;

export function toggleCRT(canvas: HTMLCanvasElement) {
  crtEnabled = !crtEnabled;
  if (crtEnabled) {
    canvas.classList.add("crt");
  } else {
    canvas.classList.remove("crt");
  }
  return crtEnabled;
}