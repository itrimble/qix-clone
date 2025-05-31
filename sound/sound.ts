// sound/sound.ts
const soundCache: Map<string, HTMLAudioElement> = new Map();
let masterVolume: number = 1.0; // Default master volume
let preferredMusicVolume: number = 0.3; // Default preferred volume for music

// Define sound assets (logical names and paths)
export const SOUND_ASSETS = {
  drawStart: { name: "drawStart", path: "assets/sounds/sfx_draw_start.wav" },
  areaCapture: { name: "areaCapture", path: "assets/sounds/sfx_area_capture.wav" },
  playerDeath: { name: "playerDeath", path: "assets/sounds/sfx_player_death.wav" },
  powerupCollect: { name: "powerupCollect", path: "assets/sounds/sfx_powerup_collect.wav" },
  powerupActivate: { name: "powerupActivate", path: "assets/sounds/sfx_powerup_activate.wav" },
  fuseActivate: { name: "fuseActivate", path: "assets/sounds/sfx_fuse_activate.wav" },
  gameOver: { name: "gameOver", path: "assets/sounds/sfx_game_over.wav" },
  buttonClick: { name: "buttonClick", path: "assets/sounds/sfx_button_click.wav" },
  // Add more sounds here as needed
};

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
