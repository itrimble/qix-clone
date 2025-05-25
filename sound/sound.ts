const soundPaths: Record<string, string> = {
  // Music Tracks - using same file for demo, ideally these are different
  music_standard: "sound/music.mp3", 
  music_tense: "sound/music.mp3", // Should be a different, tense track
  music_boss: "sound/music.mp3", // Placeholder for boss music

  // Sound Effects
  gameover: "sound/gameover.wav",
  bomb: "sound/bomb.wav", // Example SFX
  pickup: "sound/pickup.wav", // Example SFX
  bonus: "sound/bonus.wav", // Example SFX
  levelUp: "sound/bonus.wav", // Using bonus for levelUp for now
  collision: "sound/bomb.wav", // Using bomb for collision for now
};

const sounds: Record<string, HTMLAudioElement> = {};
let currentMusicTrackName: string | null = null;
const DEFAULT_MUSIC_VOLUME = 0.3; // Default volume for music tracks

export function loadSounds(): void {
  console.log("Loading sounds...");
  for (const key in soundPaths) {
    const audio = new Audio(soundPaths[key]);
    audio.preload = "auto";
    sounds[key] = audio;
    // Potential issue: Mobile browsers often restrict autoplay until user interaction
  }
  console.log("Sounds loaded:", sounds);
}

export function playSound(name: string, volume: number = 0.7): void {
  const sound = sounds[name];
  if (sound) {
    sound.currentTime = 0;
    sound.volume = volume;
    sound.play().catch((err) => console.warn(`Sound error (${name}):`, err));
  } else {
    console.warn(`Sound not found: ${name}`);
  }
}

// --- Music Control ---
let fadeInterval: number | undefined;

function fadeVolume(audio: HTMLAudioElement, targetVolume: number, duration: number, onComplete?: () => void): void {
  if (fadeInterval) {
    clearInterval(fadeInterval); // Clear any existing fade for this audio element (or globally if simple)
  }

  const initialVolume = audio.volume;
  const steps = 50; // Number of steps for the fade
  const stepDuration = duration / steps;
  const volumeChangePerStep = (targetVolume - initialVolume) / steps;
  let currentStep = 0;

  // Ensure audio is playing if fading in, or pause after fade out
  if (targetVolume > 0 && audio.paused) {
      audio.play().catch(e => console.warn("Error playing audio for fade-in:", e));
  }

  fadeInterval = window.setInterval(() => {
    currentStep++;
    const newVolume = initialVolume + volumeChangePerStep * currentStep;
    
    if ((volumeChangePerStep > 0 && newVolume >= targetVolume) || (volumeChangePerStep < 0 && newVolume <= targetVolume) || currentStep >= steps) {
      audio.volume = targetVolume;
      clearInterval(fadeInterval);
      fadeInterval = undefined;
      if (targetVolume === 0) {
        audio.pause();
        audio.currentTime = 0; // Reset for next play
      }
      if (onComplete) onComplete();
    } else {
      audio.volume = newVolume;
    }
  }, stepDuration);
}

export function switchToMusic(newTrackName: string, loop: boolean = true, fadeDuration: number = 1000, volume: number = DEFAULT_MUSIC_VOLUME): void {
  if (currentMusicTrackName === newTrackName && sounds[newTrackName] && !sounds[newTrackName].paused) {
    console.log(`Music track ${newTrackName} is already playing.`);
    // Ensure its volume is correct if it was fading out
    sounds[newTrackName].volume = volume; 
    return;
  }

  const newMusic = sounds[newTrackName];
  if (!newMusic) {
    console.warn(`Music track ${newTrackName} not found.`);
    return;
  }

  // Fade out current music if any is playing
  if (currentMusicTrackName && sounds[currentMusicTrackName] && !sounds[currentMusicTrackName].paused) {
    const oldMusic = sounds[currentMusicTrackName];
    console.log(`Fading out ${currentMusicTrackName}`);
    fadeVolume(oldMusic, 0, fadeDuration / 2, () => {
      console.log(`${oldMusic} faded out.`);
    });
  }

  // Prepare and play new music
  console.log(`Switching to music: ${newTrackName}`);
  currentMusicTrackName = newTrackName;
  newMusic.loop = loop;
  newMusic.volume = 0; // Start silent
  
  // Start playing and then fade in
  newMusic.play().then(() => {
    console.log(`Fading in ${newTrackName}`);
    fadeVolume(newMusic, volume, fadeDuration / 2);
  }).catch(err => console.warn(`Error playing new music ${newTrackName}:`, err));
}

export function stopCurrentMusic(fadeDuration: number = 1000): void {
  if (currentMusicTrackName && sounds[currentMusicTrackName]) {
    console.log(`Stopping music: ${currentMusicTrackName}`);
    fadeVolume(sounds[currentMusicTrackName], 0, fadeDuration, () => {
      currentMusicTrackName = null; // Clear current track name after fade out
    });
  }
}

// Convenience functions for specific tracks
export function playStandardMusic(): void {
  console.log("Attempting to play standard music.");
  switchToMusic('music_standard');
}

export function playTenseMusic(): void {
  console.log("Attempting to play tense music.");
  switchToMusic('music_tense');
}

export function playBossMusic(): void { // Placeholder
  console.log("Attempting to play boss music.");
  switchToMusic('music_boss');
}

// Keep the old playMusic for backward compatibility or simple cases if needed, but mark as deprecated
/** @deprecated Use switchToMusic or specific music functions like playStandardMusic */
export function playMusic(): void {
  console.warn("Deprecated playMusic() called. Use switchToMusic() or playStandardMusic() instead.");
  playStandardMusic(); // Default to standard music
}