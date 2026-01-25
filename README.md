# Qix Clone – Retro Territory Control Browser Game

A TypeScript-based, retro-style browser game inspired by the arcade classic **Qix**. Built with **Three.js** and **Vite**, featuring:
- Dynamic territory capture with trail-based mechanics
- Multiple enemy types (Qix & Sparx with Fuse mode)
- Power-ups (Freeze Qix, Speed Boost)
- CRT-style effects and retro themes
- Keyboard, gamepad & touch controls

---

## Live Development

### Start the Dev Server
```bash
npm install
npm run dev
```

Open your browser to:
http://localhost:5173

---

## Game Mechanics

### Trail & Capture System
- Move along the boundary edge, then press **Spacebar** to start drawing a trail
- Close the trail back to the boundary to capture territory
- Capture percentage is displayed in the HUD
- Points are awarded based on area captured

### Enemies
- **Qix** (Magenta line): Bounces around the play area. If it touches your trail, you lose a life
- **Sparx** (Yellow squares): Patrol the boundary edges. Collision while on the boundary = death
- **Fuse Mode**: If your trail stays open for 3+ seconds, a Sparx turns red and chases along your trail!

### Power-Ups
- **Freeze Qix** (Cyan sphere): Freezes the Qix for 5 seconds
- **Speed Boost** (Green cube): Doubles player speed for 7 seconds

### Lives & Scoring
- Start with 3 lives
- Lose a life on collision with enemies or trail
- High score and max captured area are saved locally

---

## Features

- Trail-based area capture with polygon geometry
- Two enemy types with distinct behaviors
- Power-ups with timed effects
- Persistent high scores (localStorage)
- Gamepad/controller support
- Touch controls (5 on-screen buttons)
- Keyboard + mouse support
- CRT mode toggle (retro scanline effect)
- Dark mode toggle
- Full audio (10 sound effects + 2 background music tracks)
- Fuse mechanic for tension

---

## Controls

| Action            | Keyboard              | Gamepad        | Touch          |
|-------------------|-----------------------|----------------|----------------|
| Move              | Arrow keys / WASD     | Left stick     | On-screen pad  |
| Draw trail        | Spacebar (hold)       | A button       | Action button  |
| Toggle CRT        | `C`                   | X button       | Settings menu  |
| Toggle Settings   | `S`                   | Y button       | -              |
| Toggle C64 Mode   | `R`                   | LB button      | -              |
| Save State        | `P`                   | -              | -              |

---

## Tech Stack

- **Vite** – Fast build tooling
- **TypeScript** – Type safety
- **Three.js** – 3D/WebGL rendering
- **Howler.js** – Audio management
- **Vitest** – Testing framework
- **PostCSS** – Styling
- **Custom GLSL Shaders** – CRT + overlay effects

---

## Project Structure

```
qix-clone/
├── game/            # Game logic (enemies, trail, power-ups, geometry)
│   ├── config.ts    # Centralized game constants
│   ├── engine.ts    # Scene setup and rendering
│   ├── qix_enemy.ts # Qix enemy behavior
│   ├── sparx_enemy.ts # Sparx enemy behavior
│   ├── trail.ts     # Trail drawing system
│   ├── powerup.ts   # Power-up system
│   └── *.test.ts    # Unit tests
├── ui/              # UI components (modals, debug, game over)
├── sound/           # Audio management
├── shaders/         # Custom GLSL shaders
├── styles/          # CSS styling
├── assets/          # Game assets (audio, images)
├── main.ts          # Application entry point
└── index.html       # HTML entry
```

---

## Development

### Run Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

### If anything breaks
```bash
./clean_and_rebuild.sh
```

---

## TODO Roadmap

- [x] Area fill logic
- [x] Player/enemy collisions
- [x] Power-ups
- [x] Score & lives
- [x] Game over screen
- [x] Touch controls
- [x] Audio (SFX + music)
- [x] Save progress (localStorage)
- [ ] Leaderboard integration

---

## License

MIT (c) [Ian Trimble](https://github.com/itrimble)
