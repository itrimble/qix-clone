/**
 * Debug UI utilities
 */

let debugDiv: HTMLElement | null = null;

/**
 * Creates and appends the debug info overlay to the DOM
 */
export function createDebugInfo(): HTMLElement {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.top = '50px';
  div.style.right = '10px';
  div.style.backgroundColor = 'rgba(0,0,0,0.7)';
  div.style.color = 'cyan';
  div.style.padding = '10px';
  div.style.fontFamily = 'monospace';
  div.style.border = '1px solid cyan';
  div.style.zIndex = '1000';
  div.style.pointerEvents = 'none';
  div.id = 'debugInfo';
  document.body.appendChild(div);
  debugDiv = div;
  return div;
}

/**
 * Gets the debug div element
 */
export function getDebugDiv(): HTMLElement | null {
  return debugDiv;
}

/**
 * Updates the debug info display with current game state
 */
export function updateDebugInfo(
  playerX: number,
  playerY: number,
  playerZ: number,
  fps: number,
  activeKeys: string[]
): void {
  if (!debugDiv) return;

  debugDiv.innerHTML = `
    Player: x=${playerX.toFixed(2)},
            y=${playerY.toFixed(2)},
            z=${playerZ.toFixed(2)}<br>
    FPS: ${fps.toFixed(1)}<br>
    Keys: ${activeKeys.join(', ')}
  `;
}
