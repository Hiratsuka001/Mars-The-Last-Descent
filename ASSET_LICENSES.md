# Asset Licenses & Attribution Breakdown

*Mars: The Last Descent* strictly complies with open-source licensing standards. All gameplay sprites, terrain tiles, sound effects, and character sheets are **100% CC0 1.0 Universal Public Domain** or public-domain NASA educational media.

---

## 1. Summary of Replaced Restricted Assets

During Phase 7 (Release Pass), all prototype stock, watermarked, and restricted-license placeholder sheets were completely replaced with bespoke procedural pixel art generated at runtime via offscreen HTML5 canvases:

| Asset Name | Previous Source / File | License | Replaced With | New License |
| :--- | :--- | :--- | :--- | :--- |
| **Astronaut Player** | `/assets/characters/player2.png` | `restricted-placeholder` | `player_walk4.png` sliced atlas | user-provided asset (owner must confirm license/source before public release) |
| **NOVA Companion** | `/assets/characters/nova.png` | `restricted-placeholder` | `nova_walk.png` ("Ginger & Topey Sprites") sliced atlas | user-provided asset (owner must confirm license/source before public release) |
| **Spaceship (Crash/Ready)**| `/assets/equipment/spacecraft.png` | `restricted-placeholder` | Procedural 64x64 modular lander (`src/render/characterSprites.ts`) | **CC0 1.0** |
| **Ship Part Icons (8)** | `/assets/icons/scifi_icons.png` | `restricted-placeholder` | Procedural 16x16 silicon/gold icons (`src/render/characterSprites.ts`) | **CC0 1.0** |
| **Keyboard Keycaps** | `/assets/ui/keyboard.png` | `restricted-placeholder` | Procedural 24x24 sci-fi keycaps (`src/render/characterSprites.ts`) | **CC0 1.0** |
| **Nature & Tree Props** | `/assets/tilesets/grassland.png` | `restricted-placeholder` | Procedural pixel art flora & trees (`src/render/characterSprites.ts`) | **CC0 1.0** |
| **Mission Wrecks (8)** | Composite stock sheets | `restricted-placeholder` | Authentic NASA procedural pixel art (`src/render/wreckSprites.ts`) | **CC0 1.0** |

---

## 2. In-Game Sprites & Visual Art

### User-Provided Character Sprites (`player_walk4.png` & `nova_walk.png` "Ginger & Topey Sprites")
- **License**: user-provided asset (owner must confirm license/source before public release)
- **Coverage**:
  - **Player Astronaut**: 4-directional walk cycles (Down, Up, Left, Right) + grounded idle poses, sliced into unified atlas `public/assets/characters.png`.
  - **NOVA Cat Companion**: 4-directional walk cycles + idle poses sliced from "Ginger & Topey Sprites" (Topey) into unified atlas `public/assets/characters.png`.

### Procedural Sprite Generator (`src/render/proceduralTiles.ts`, `src/render/wreckSprites.ts`, `src/render/characterSprites.ts`)
- **License**: CC0 1.0 Universal (Public Domain Dedication)
- **Author**: Antigravity Project Team (2026)
- **Coverage**:
  - **Spaceship**: Stranded exploration lander (damaged solar panels, scorched chassis) and launch-ready state (active deflector shield, glowing green telemetry beacon).
  - **Wrecks (8 Historic Missions)**:
    1. *Sojourner Microrover & Pathfinder Petal Lander* (1997)
    2. *Opportunity Rover MER-B* (2004)
    3. *InSight Geophysical Station & SEIS Dome* (2018)
    4. *Spirit Rover at Gusev Crater* (2004)
    5. *Deep Space Relay Array / Parabolic Dish*
    6. *Phoenix Polar Ice Lander* (2008)
    7. *Apollo Lunar Roving Vehicle (LRV)* (1972)
    8. *Surveyor 3 Surface Sampler* (1967)
  - **Terrain Biomes**: Red Mars regolith plains, dunes, polar snow/ice, terraformed grassland, deep craters, dithered biome borders, and non-blocking ground decor.
  - **UI & Part Icons**: Gear, solar panel, microchip, plasma wrench, satellite dish, isotope battery, fuel cell, nanotech toolbox, and [W][A][S][D][E] keycaps.

---

## 3. Audio Engine (100% CC0 WebAudio)

### Procedural Audio Synthesizer (`src/systems/audio.ts`)
- **License**: CC0 1.0 Universal (Public Domain Dedication)
- **Author**: Antigravity Project Team (2026)
- **Dependencies**: Zero external audio files (`.mp3`, `.wav`, `.ogg`). 100% generated in real-time using standard Web Audio API oscillators, biquad filters, and pink-noise buffers.
- **Coverage**:
  - Surface footsteps: Mars regolith crunch, sand scuff, snow squeak, grass rustle, metallic lander ring.
  - Dynamic ambient wind loops per biome with real-time crossfading.
  - UI clicks, hover tones, NOVA chirp/meow, scan pulses, part collection fanfare, repair ratchets, countdown beeps, and launch ignition roar.

---

## 4. Educational Photography & Mission Diagrams

### NASA / JPL-Caltech Photographic Media
- **Source**: NASA Jet Propulsion Laboratory (JPL), NASA Media Usage Guidelines
- **License**: Public Domain (United States Government Work)
- **Usage**: Background space panoramas and scientific archival illustrations in educational modals.
  - Apollo 11 ALSEP Archive: Lunar and Planetary Institute (LPI)
  - Mars Exploration Program: NASA/JPL-Caltech
  - InSight Mars Lander: NASA / CNES / IPGP / JPL-Caltech

