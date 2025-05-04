
export function showFlashingText(text: string, color = '#00ffcc', duration = 2000) {
  const el = document.createElement('div');
  el.textContent = text;
  el.className = 'hud';
  el.style.position = 'fixed';
  el.style.top = '50%';
  el.style.left = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.fontSize = '20px';
  el.style.color = color;
  el.style.opacity = '1';
  el.style.zIndex = '999';
  el.style.pointerEvents = 'none';
  el.style.fontFamily = 'Press Start 2P, monospace';

  document.body.appendChild(el);

  let opacity = 1;
  let direction = -1;
  let ticks = 0;
  function animate() {
    ticks++;
    opacity += direction * 0.05;
    if (opacity <= 0.3 || opacity >= 1) {
      direction *= -1;
    }
    el.style.opacity = opacity.toString();
    if (ticks * 16 < duration) {
      requestAnimationFrame(animate);
    } else {
      document.body.removeChild(el);
    }
  }
  animate();
}
