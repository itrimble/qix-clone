const soundPaths: Record<string, string> = {
  music: "sound/music.mp3",
  gameover: "sound/gameover.wav",
  bomb: "sound/bomb.wav",
  pickup: "sound/pickup.wav",
  bonus: "sound/bonus.wav",
};

const sounds: Record<string, HTMLAudioElement> = {};

export function loadSounds(): void {
  for (const key in soundPaths) {
    const audio = new Audio(soundPaths[key]);
    audio.preload = "auto";
    sounds[key] = audio;
  }
}

export function playSound(name: string): void {
  const sound = sounds[name];
  if (sound) {
    // Restart if playing
    sound.currentTime = 0;
    sound.play().catch((err) => console.warn(`Sound error (${name}):`, err));
  }
}

export function playMusic(): void {
  const music = sounds["music"];
  if (music) {
    music.loop = true;
    music.volume = 0.5;
    music.play().catch((err) => console.warn("Music error:", err));
  }
}