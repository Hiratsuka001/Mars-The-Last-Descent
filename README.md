# Mars: The Last Descent 🚀

An educational open-world sci-fi adventure where you explore the Martian surface alongside your robotic cat companion, **NOVA**. Discover historical robotic explorers from NASA and international space agencies, salvage critical components, recalibrate guidance and propulsion systems, and return home to Earth.

![License](https://img.shields.io/badge/license-CC0--1.0-blue.svg)
![React](https://img.shields.io/badge/react-19-cyan.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.8-blue.svg)
![Vite](https://img.shields.io/badge/vite-8.3-purple.svg)

---

## 🎮 Key Features

- **Endless Martian Open World**: Infinite, deterministic chunk-based terrain generated via multi-octave 2D Perlin noise. Features 4 rich biomes (Regolith Plains, Sand Dunes, Polar Ice Caps, and Terraformed Grasslands) with dithered biome transitions and dynamic ground debris.
- **Dynamic Martian Sol Day/Night Cycle & 2D Lighting Engine**: Real-time 180s Sol progression shifting smoothly between daylight, Martian amber twilight, and starry nights. High-performance offscreen 2D lighting engine rendering player directional suit headlight cones, NOVA optic beams, and luminescent rover beacon halos.
- **Jetpack Sprint & Dynamic Footstep Trails**: Hold thrusters to sprint at 1.65x speed with jetpack audio and spark trails, accompanied by persistent biome-reactive foot treadmarks, paw prints, and atmospheric dust puffs.
- **NOVA Robotic Companion Mechanics**:
  - **Sonar Radar Ping Wave**: Release an acoustic ping wave that clears local fog of war and projects holographic compass needles pointing directly toward undiscovered rovers and wrecks with live distance readouts.
  - **Companion Petting & Morale Overdrive**: Interact with NOVA (`[P]`) for synthesized purrs, floating heart motes, and a temporary +15% exploration movement speed buff.
- **Field Science Mineralogy & Geological Collectibles**: Discover and sample 6 authentic Martian mineral specimens (Hematite "Blueberries", Volcanic Olivine Geodes, Polar Cryo-Ice Cores, Ancient Chondrite Meteorites, Perchlorate Salt Crusts, and Siliceous Fossil Slabs) with dedicated codex entries containing real NASA exploration history.
- **8 Authentic Historical Robotic Missions**:
  1. *Sojourner Microrover & Pathfinder* (1997)
  2. *Opportunity Rover (MER-B)* (2004)
  3. *InSight Geophysical Station & SEIS Dome* (2018)
  4. *Spirit Rover at Gusev Crater* (2004)
  5. *Deep Space Relay Array* (Parabolic DSN Antenna)
  6. *Phoenix Polar Ice Lander* (2008)
  7. *Apollo Lunar Roving Vehicle (LRV)* (1972)
  8. *Surveyor 3 Surface Sampler* (1967)
- **100% CC0 Procedural Pixel Art**: Bespoke runtime procedural rendering for player 4-directional walk cycles, NOVA companion animations, field specimens, ship stages, and 16x16 part icons. Zero external placeholder assets.
- **Procedural WebAudio Synthesizer Engine**: Real-time synthesized footsteps tailored to terrain (regolith crunch, sand scuff, snow squeak, grass, metal), jetpack thruster burns, sonar pings, robotic purrs, chime discoveries, dynamic ambient biome winds with smooth crossfading, and launch thruster roars. Zero external `.mp3` or `.wav` dependencies.
- **Circular Radar Minimap & Fullscreen Tactical Map**: Circular HUD minimap with real-time fog of war, equipment blips, and an expandable full-world tactical overlay (`[M]`).
- **Complete Expedition Loop**: Explore -> Scan & Salvage 8 Parts -> Collect Field Science -> Return to Crashed Ship -> Calibrate Subsystems -> Cinematic Launch -> Epilogue Victory Screen -> New Game / Replay Seed.
- **Robust Auto-Saving**: Automatic localStorage persistence with corrupted state fallback and clean reset options.
- **Legacy Story Archives**: Includes original linear narrative chapters (Earth Kola Superdeep Borehole, Lunar ALSEP Exploration, Mars Atmospheric Entry & Crash, and Convection Storm Crisis).

---

## 🕹️ Controls

| Action | Desktop Keybinding | Mobile Touch Control |
| :--- | :--- | :--- |
| **Move Explorer** | `W`, `A`, `S`, `D` or Arrow Keys | On-Screen Virtual D-Pad |
| **Jetpack Sprint / Thrusters** | Hold `[Shift]` | Hold `[BOOST]` Button |
| **NOVA Sonar Radar Ping** | `[Space]` or `[Q]` *(in open terrain)* | Tap `[SCAN]` Button |
| **Pet Companion NOVA** | `[P]` *(near NOVA)* | Tap NOVA Companion |
| **Interact / Salvage / Sample** | `[E]` or `Enter` *(or `[Space]` near object)* | Proximity Action Button |
| **Toggle Tactical Map** | `[M]` or Click Minimap | Tap Minimap Radar |
| **Open Mission Codex** | `[C]` or Header Button | Top Header Codex Button |
| **Mission Settings & Volume** | Header Cog Icon | Header Cog Icon |
| **Developer Debug HUD** | `F3` *(Only in dev mode or with `?debug=1`)* | Available via `?debug=1` |

---

## 🛠️ Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm` or `pnpm`

### Installation
```bash
git clone https://github.com/your-username/mars-the-last-descent.git
cd mars-the-last-descent
npm install
```

### Running Locally (Development Mode)
```bash
npm run dev
```
Open `http://localhost:5173` in your browser. To enable developer debug hotkeys and teleport shortcuts, navigate to `http://localhost:5173/?debug=1`.

### Production Build
```bash
npm run build
```
Build output is generated into the `dist/` directory, optimized with code-splitting via `React.lazy` and compressed CSS.

### Preview Production Build
```bash
npm run preview
```

### Type Checking & Automated QA
```bash
npx tsc --noEmit
node scripts/qa_runner_final.mjs
```

---

## 📁 Project Structure

```
├── public/                 # Static assets & favicon.svg
├── scripts/                # QA automation and test runners
├── src/
│   ├── assets/             # Historical NASA background panorama images
│   ├── components/         # React scenes, modals, and HUD overlays
│   │   ├── MiniGames/      # Interactive engineering mini-games
│   │   ├── HowToPlayModal.tsx
│   │   ├── LegacyChaptersModal.tsx
│   │   ├── MainMenu.tsx
│   │   ├── MinimapHUD.tsx
│   │   ├── PartsHUD.tsx
│   │   ├── SpacecraftRepairScene.tsx
│   │   ├── LaunchCinematic.tsx
│   │   ├── EndingScreen.tsx
│   │   └── WorldScene.tsx  # Core top-down canvas exploration scene
│   ├── data/               # Equipment, mission codex, and trivia data
│   ├── render/             # Rendering pipeline & procedural art
│   │   ├── atlas.ts        # Sprite manifest & cache manager
│   │   ├── characterSprites.ts # 100% CC0 procedural characters & icons
│   │   ├── minimap.ts      # Circular radar & fog of war
│   │   ├── proceduralTiles.ts # 16x16 terrain & decoration generator
│   │   └── wreckSprites.ts # 8 authentic NASA equipment wreck sprites
│   ├── systems/            # WebAudio synthesis & localStorage save manager
│   │   ├── audio.ts        # Real-time WebAudio procedural sound engine
│   │   └── saveManager.ts  # Robust expedition save/load/reset manager
│   ├── world/              # Procedural world generation
│   │   ├── biomes.ts       # Continental biomes definition & decor rules
│   │   ├── chunk.ts        # 32x32 chunk manager with canvas memory pruning
│   │   ├── collision.ts    # Box collision & spawn verification
│   │   ├── noise.ts        # Seeded 2D Perlin noise implementation
│   │   └── placement.ts    # Deterministic equipment scattering & reachability
│   ├── App.tsx             # Root component with code-splitting & routing
│   └── main.tsx            # Application entrypoint
├── ASSET_LICENSES.md       # Complete open-source license breakdown
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 🚀 Deployment Guide

### 1. GitHub Pages
1. In `vite.config.ts`, set the base path to match your repository name:
   ```ts
   export default defineConfig({
     base: '/mars-the-last-descent/',
     // ...
   });
   ```
2. Build and publish:
   ```bash
   npm run build
   npx gh-pages -d dist
   ```

### 2. Vercel / Netlify
No base path configuration needed (defaults to `/`).
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

---

## 📄 Licensing & Attributions
- **Software Code**: MIT License.
- **Pixel Art & Audio Engine**: CC0 1.0 Universal Public Domain Dedication.
- **Educational Media**: NASA / JPL-Caltech public-domain photography and mission archives. See [ASSET_LICENSES.md](ASSET_LICENSES.md) for complete details.

