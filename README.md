# Qix Clone – Retro Territory Control Browser Game

A TypeScript-based, retro-style browser game inspired by the arcade classic **Qix**. Built with **Three.js** and **Vite**, featuring:
- Dynamic territory capture
- Enemies
- Power-ups
- CRT-style effects
- Keyboard & gamepad controls

---

## 🚀 Live Development

### Start the Dev Server
```bash
npm install
npm run dev
```

Open your browser to:  
📍 http://localhost:5173

---

## 🧩 Features

- 🟦 Trail-based area capture
- 💣 Enemy avoidance and logic
- ⚡ Power-ups and scoring
- 💾 Persistent state planned (WIP)
- 🎮 Gamepad support (Beta)
- 🖱️ Mouse + keyboard support
- 👾 CRT mode toggle (retro display)
- 🌓 Dark mode toggle
- 🔈 SFX placeholders

---

## 🎮 Controls

| Action            | Input                |
|-------------------|----------------------|
| Move              | Arrow keys / WASD    |
| Draw line         | Spacebar / Mouse     |
| Toggle CRT        | `C`                  |
| Toggle Settings   | `S`                  |

Gamepad & touchscreen support in progress.

---

## 📦 Tech Stack

- **Vite** – Fast build tooling
- **TypeScript** – Safety and clarity
- **Three.js** – 3D rendering
- **PostCSS / CSS Modules** – Styling
- **Custom Shader Effects** – CRT + overlays

---

## 🧼 Project Hygiene

This project excludes diagnostics, zips, scripts, and caches via `.gitignore`.  
To contribute or fork:

```bash
git clone https://github.com/itrimble/qix-clone.git
cd qix-clone
npm install
```

---

## 🗂️ Folder Structure

```
QixGame_Complete_Bundle/
├── game/            # Game logic & entities
├── ui/              # UI interactions (controls, CRT, etc.)
├── shaders/         # Custom GLSL shaders
├── sound/           # Audio files
├── styles/          # Main CSS
├── main.ts          # App entry
├── index.html       # HTML entry
```

---

## ✨ TODO Roadmap

- [x] Area fill logic
- [x] Player/enemy collisions
- [x] Power-ups
- [x] Score & lives
- [ ] Game over screen
- [ ] Touchscreen support
- [ ] Leaderboard integration
- [ ] Audio polish + music
- [ ] Save progress

---

## 🛠 Development Tips

If anything breaks, try:
```bash
./clean_and_rebuild.sh
```

If you want to debug:
```bash
./qix_repair_and_diagnostics.sh
```

---

## 📜 License

MIT © [Ian Trimble](https://github.com/itrimble)
