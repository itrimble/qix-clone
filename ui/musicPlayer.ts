// ui/musicPlayer.ts - Music player UI for controlling playlists

import { setMusicMode, getMusicMode, nextTrack, previousTrack, getCurrentTrackInfo, setMusicVolume, MusicMode } from '../sound/sound';

let musicPlayerContainer: HTMLDivElement | null = null;

export function createMusicPlayer(): HTMLDivElement {
  if (musicPlayerContainer) return musicPlayerContainer;

  musicPlayerContainer = document.createElement('div');
  musicPlayerContainer.id = 'music-player';
  musicPlayerContainer.style.cssText = `
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid #333;
  `;

  updateMusicPlayerUI();
  return musicPlayerContainer;
}

export function updateMusicPlayerUI(): void {
  if (!musicPlayerContainer) return;

  const currentMode = getMusicMode();
  const trackInfo = getCurrentTrackInfo();

  musicPlayerContainer.innerHTML = `
    <div style="margin-bottom: 10px; font-size: 12px; color: #00ffff;">
      Music Player
    </div>
    <div style="display: flex; gap: 5px; margin-bottom: 10px;">
      <button id="music-mode-hype" style="
        flex: 1;
        padding: 8px;
        border: 1px solid ${currentMode === 'hype' ? '#ff4400' : '#333'};
        background: ${currentMode === 'hype' ? 'rgba(255, 68, 0, 0.2)' : 'transparent'};
        color: ${currentMode === 'hype' ? '#ff4400' : '#888'};
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        border-radius: 3px;
      ">HYPE</button>
      <button id="music-mode-chill" style="
        flex: 1;
        padding: 8px;
        border: 1px solid ${currentMode === 'chill' ? '#00ff88' : '#333'};
        background: ${currentMode === 'chill' ? 'rgba(0, 255, 136, 0.2)' : 'transparent'};
        color: ${currentMode === 'chill' ? '#00ff88' : '#888'};
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        border-radius: 3px;
      ">CHILL</button>
      <button id="music-mode-off" style="
        flex: 1;
        padding: 8px;
        border: 1px solid ${currentMode === 'off' ? '#666' : '#333'};
        background: ${currentMode === 'off' ? 'rgba(100, 100, 100, 0.2)' : 'transparent'};
        color: ${currentMode === 'off' ? '#aaa' : '#888'};
        font-family: inherit;
        font-size: 11px;
        cursor: pointer;
        border-radius: 3px;
      ">OFF</button>
    </div>
    ${currentMode !== 'off' ? `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <button id="music-prev" style="
          padding: 5px 10px;
          border: 1px solid #333;
          background: transparent;
          color: #888;
          font-family: inherit;
          cursor: pointer;
          border-radius: 3px;
        ">&lt;</button>
        <span style="flex: 1; text-align: center; color: #666; font-size: 10px;">
          Track ${trackInfo.track}/${trackInfo.total}
        </span>
        <button id="music-next" style="
          padding: 5px 10px;
          border: 1px solid #333;
          background: transparent;
          color: #888;
          font-family: inherit;
          cursor: pointer;
          border-radius: 3px;
        ">&gt;</button>
      </div>
    ` : ''}
    <div style="display: flex; align-items: center; gap: 10px;">
      <span style="color: #666; font-size: 10px;">Vol</span>
      <input type="range" id="music-volume" min="0" max="100" value="30" style="
        flex: 1;
        height: 4px;
        cursor: pointer;
      ">
    </div>
  `;

  // Add event listeners
  const hypeBtn = document.getElementById('music-mode-hype');
  const chillBtn = document.getElementById('music-mode-chill');
  const offBtn = document.getElementById('music-mode-off');
  const prevBtn = document.getElementById('music-prev');
  const nextBtn = document.getElementById('music-next');
  const volumeSlider = document.getElementById('music-volume') as HTMLInputElement;

  if (hypeBtn) {
    hypeBtn.addEventListener('click', () => {
      setMusicMode('hype');
      updateMusicPlayerUI();
    });
  }

  if (chillBtn) {
    chillBtn.addEventListener('click', () => {
      setMusicMode('chill');
      updateMusicPlayerUI();
    });
  }

  if (offBtn) {
    offBtn.addEventListener('click', () => {
      setMusicMode('off');
      updateMusicPlayerUI();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      previousTrack();
      setTimeout(updateMusicPlayerUI, 100);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextTrack();
      setTimeout(updateMusicPlayerUI, 100);
    });
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      setMusicVolume(value / 100);
    });
  }
}

export function getMusicPlayerElement(): HTMLDivElement | null {
  return musicPlayerContainer;
}
