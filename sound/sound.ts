// sound/sound.ts
const soundCache: Map<string, HTMLAudioElement> = new Map();
let masterVolume: number = 1.0; // Default master volume
let preferredMusicVolume: number = 0.3; // Default preferred volume for music

// Define sound assets (logical names and paths)
// Updated to use downloaded Kenney CC0 audio assets
export const SOUND_ASSETS = {
  drawStart: { name: "drawStart", path: "assets/sounds/draw_start.ogg" },
  areaCapture: { name: "areaCapture", path: "assets/sounds/area_capture.ogg" },
  playerDeath: { name: "playerDeath", path: "assets/sounds/collision.ogg" },
  powerupCollect: { name: "powerupCollect", path: "assets/sounds/powerup_collect.ogg" },
  powerupActivate: { name: "powerupActivate", path: "assets/sounds/powerup_collect.ogg" },
  fuseActivate: { name: "fuseActivate", path: "assets/sounds/collision.ogg" },
  gameOver: { name: "gameOver", path: "assets/sounds/game_over.ogg" },
  buttonClick: { name: "buttonClick", path: "assets/sounds/button_click.ogg" },
  levelUp: { name: "levelUp", path: "assets/sounds/level_up.ogg" },
  collision: { name: "collision", path: "assets/sounds/collision.ogg" },
  gameover: { name: "gameover", path: "assets/sounds/game_over.ogg" },
};

// Music playlists
export const MUSIC_PLAYLISTS = {
  hype: [
    'assets/music/hype/track1.ogg',
    'assets/music/hype/track2.ogg',
    'assets/music/hype/track3.ogg',
  ],
  chill: [
    'assets/music/chill/track1.ogg',
    'assets/music/chill/track2.ogg',
    'assets/music/chill/track3.ogg',
  ],
};

export type MusicMode = 'hype' | 'chill' | 'off';
let currentMusicMode: MusicMode = 'off';
let currentTrackIndex = 0;

export function preloadSound(soundNameKey: keyof typeof SOUND_ASSETS): Promise<void> {
  const soundAsset = SOUND_ASSETS[soundNameKey];
  if (!soundAsset) {
    const errorMsg = `Sound asset key '${String(soundNameKey)}' not found in SOUND_ASSETS.`;
    console.error(errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
  const { name: soundName, path: filePath } = soundAsset;

  return new Promise((resolve, reject) => {
    if (soundCache.has(soundName)) {
      const existingAudio = soundCache.get(soundName);
      // Check readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
      if (existingAudio && existingAudio.readyState >= 2) {
        resolve(); // Already loaded sufficiently
        return;
      }
      // If in cache but not loaded, could be a pending load; let it proceed or re-init.
      // For simplicity, we'll remove and re-add if not ready.
    }

    const audio = new Audio();
    audio.src = filePath;

    const loadHandler = () => {
      soundCache.set(soundName, audio);
      resolve();
      audio.removeEventListener('canplaythrough', loadHandler);
      audio.removeEventListener('error', errorHandler);
    };

    const errorHandler = (e: Event | string) => {
      console.error(`Error loading sound: ${soundName} from ${filePath}`, e);
      soundCache.delete(soundName); // Remove from cache if load failed
      const error = e instanceof Event ? new Error(`Audio load error for ${soundName}`) : new Error(String(e));
      reject(error);
      audio.removeEventListener('canplaythrough', loadHandler);
      audio.removeEventListener('error', errorHandler);
    };

    audio.addEventListener('canplaythrough', loadHandler);
    audio.addEventListener('error', errorHandler);

    // Some browsers/situations might need load() called explicitly, especially if src is set after Audio() constructor.
    // It's generally safe to call it.
    audio.load();
  });
}

export function playSound(soundNameKey: keyof typeof SOUND_ASSETS, volumeScale: number = 1.0): void {
  const soundAsset = SOUND_ASSETS[soundNameKey];
  if (!soundAsset) {
    console.warn(`Sound asset key '${String(soundNameKey)}' not found for playing.`);
    return;
  }
  const soundName = soundAsset.name;
  const audio = soundCache.get(soundName);

  if (!audio) {
    console.warn(`Sound not found in cache: ${soundName}. Was it preloaded? Attempting to load and play.`);
    // Attempt to load and play on the fly (not recommended for critical sounds due to delay)
    preloadSound(soundNameKey).then(() => {
        const loadedAudio = soundCache.get(soundName);
        if (loadedAudio) {
            loadedAudio.volume = Math.max(0, Math.min(1, masterVolume * volumeScale));
            loadedAudio.currentTime = 0;
            loadedAudio.play().catch(error => console.warn(`Error playing sound ${soundName} (after dynamic load):`, error));
        }
    }).catch(err => console.error(`Failed to dynamically load ${soundName} for playing:`, err));
    return;
  }

  // Ensure audio is ready to play, otherwise it might throw an error or do nothing.
  // readyState >= 2 (HAVE_CURRENT_DATA) is usually enough for play to start,
  // but HAVE_ENOUGH_DATA (4) is safer for playing without interruption.
  // For SFX, we want to play immediately if possible.
  if (audio.readyState < 2 && !audio.error) {
      console.warn(`Sound ${soundName} not ready (readyState: ${audio.readyState}). Play may fail or be delayed.`);
      // Optionally, you could queue it or wait for 'canplaythrough' again, but for SFX, try to play.
  }

  audio.volume = Math.max(0, Math.min(1, masterVolume * volumeScale));
  audio.currentTime = 0; // Rewind to start to allow re-triggering
  audio.play().catch(error => {
    // Common issue: User hasn't interacted with the page yet.
    console.warn(`Error playing sound ${soundName} (readyState: ${audio.readyState}):`, error);
  });
}

export function preloadAllGameSounds(): Promise<(void | PromiseSettledResult<void>)[]> {
  const soundPromises: Promise<void>[] = [];
  (Object.keys(SOUND_ASSETS) as Array<keyof typeof SOUND_ASSETS>).forEach(key => {
      soundPromises.push(preloadSound(key));
  });
  // Use Promise.allSettled to ensure all preloads are attempted even if some fail.
  return Promise.allSettled(soundPromises);
}

// Basic Master Volume Control (Optional for now, can be expanded)
export function setMasterVolume(volume: number): void {
    masterVolume = Math.max(0, Math.min(1, volume));
    console.log(`Master volume set to: ${masterVolume}`);
    // Also update music volume if music is playing
    if (backgroundMusic) {
      backgroundMusic.volume = Math.max(0, Math.min(1, masterVolume * preferredMusicVolume));
    }
}

export function getMasterVolume(): number {
    return masterVolume;
}

// Music functions (stubs for now, to be implemented in Step 5)
let backgroundMusic: HTMLAudioElement | null = null;

export function loadAndPlayMusic(filePath: string, loop: boolean = true, volume: number = 0.3): void {
    if (backgroundMusic && !backgroundMusic.paused) { // If music is already playing, don't just restart unless src is different
      if (backgroundMusic.src.endsWith(filePath)) {
         console.log("Background music already playing the requested track.");
         setMusicVolume(volume); // Just adjust volume if needed
         return;
      }
      stopMusic();
    }
    preferredMusicVolume = Math.max(0, Math.min(1, volume)); // Store preferred volume
    backgroundMusic = new Audio(filePath);
    backgroundMusic.loop = loop;
    // Apply combined master and preferred music volume
    backgroundMusic.volume = Math.max(0, Math.min(1, masterVolume * preferredMusicVolume));
    backgroundMusic.play().then(() => {
      console.log("Background music started:", filePath);
    }).catch(error => console.error("Error playing background music:", error));
}

export function stopMusic(): void {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0; // Rewind
        console.log("Background music stopped.");
    }
}

export function setMusicVolume(volume: number): void {
    preferredMusicVolume = Math.max(0, Math.min(1, volume));
    if (backgroundMusic) {
        backgroundMusic.volume = Math.max(0, Math.min(1, masterVolume * preferredMusicVolume));
    }
    console.log(`Preferred music volume set to: ${preferredMusicVolume}`);
}

// --- Convenience music functions (used by levelManager) ---

export function stopCurrentMusic(): void {
    stopMusic();
}

export function playStandardMusic(): void {
    // Use hype playlist track 1 for standard gameplay
    if (currentMusicMode !== 'hype') {
      setMusicMode('hype');
    }
}

export function playTenseMusic(): void {
    // Use hype playlist for tense moments
    if (currentMusicMode !== 'hype') {
      setMusicMode('hype');
    }
}

// --- Playlist Music Functions ---

export function setMusicMode(mode: MusicMode): void {
    currentMusicMode = mode;
    currentTrackIndex = 0;

    if (mode === 'off') {
      stopMusic();
      return;
    }

    const playlist = MUSIC_PLAYLISTS[mode];
    if (playlist && playlist.length > 0) {
      playPlaylistTrack(playlist[currentTrackIndex]);
    }

    console.log(`Music mode set to: ${mode}`);
}

export function getMusicMode(): MusicMode {
    return currentMusicMode;
}

function playPlaylistTrack(trackPath: string): void {
    if (backgroundMusic) {
      stopMusic();
    }

    backgroundMusic = new Audio(trackPath);
    backgroundMusic.loop = false; // We'll handle track cycling ourselves
    backgroundMusic.volume = Math.max(0, Math.min(1, masterVolume * preferredMusicVolume));

    // When track ends, play next track in playlist
    backgroundMusic.addEventListener('ended', () => {
      if (currentMusicMode !== 'off') {
        nextTrack();
      }
    });

    backgroundMusic.play().then(() => {
      console.log(`Playing track: ${trackPath}`);
    }).catch(error => console.warn(`Error playing music track:`, error));
}

export function nextTrack(): void {
    if (currentMusicMode === 'off') return;

    const playlist = MUSIC_PLAYLISTS[currentMusicMode];
    if (!playlist || playlist.length === 0) return;

    currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
    playPlaylistTrack(playlist[currentTrackIndex]);
}

export function previousTrack(): void {
    if (currentMusicMode === 'off') return;

    const playlist = MUSIC_PLAYLISTS[currentMusicMode];
    if (!playlist || playlist.length === 0) return;

    currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
    playPlaylistTrack(playlist[currentTrackIndex]);
}

export function getCurrentTrackInfo(): { mode: MusicMode; track: number; total: number } {
    const playlist = currentMusicMode !== 'off' ? MUSIC_PLAYLISTS[currentMusicMode] : [];
    return {
      mode: currentMusicMode,
      track: currentTrackIndex + 1,
      total: playlist.length
    };
}
