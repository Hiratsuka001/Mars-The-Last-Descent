# Codebase Audit: "Mars: The Last Descent"

**Audit Date**: October 2026  
**Auditor**: Antigravity Pair Programmer  
**Context**: Phase 0 Audit & Architecture Proposal for the Top-Down Open-World Salvage Overhaul (based on `OVERHAUL_BRIEF.txt`).

---

## 1. Chapter Flow & Game State Management (`App.tsx`)

The entire game application is structured as a state machine in [`src/App.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/App.tsx), driven by `progress.currentChapter` and synchronized to `localStorage` via [`src/systems/saveManager.ts`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/systems/saveManager.ts):

| Chapter ID | Name / Purpose | Component Rendered | Key State Transitions |
|---|---|---|---|
| **0** | Main Menu | [`MainMenu.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/MainMenu.tsx) | "Start Mission" &rarr; Chapter 1; "Continue" &rarr; Saved Chapter |
| **1** | Prologue (Earth Borehole) | [`PrologueScene.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/PrologueScene.tsx) | `onComplete` &rarr; Chapter 2 |
| **2** | Echoes of the Moon | [`GameCanvas.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/GameCanvas.tsx) (`environment="moon"`) | Scan 3 ALSEP instruments &rarr; 3 Quizzes &rarr; Chapter 3 |
| **3** | Mars Crash & Malfunction | [`MarsCrashScene.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/MarsCrashScene.tsx) | Diagnostic check &rarr; `onDiagnosticComplete` &rarr; Chapter 4 |
| **4** | Mars Surface Exploration | [`GameCanvas.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/GameCanvas.tsx) (`environment="mars"`) | Scan 3 Mars rovers/landers &rarr; 3 MiniGames &rarr; Chapter 5 |
| **5** | Mars Weather Challenge | [`MarsWeatherChallenge.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/MarsWeatherChallenge.tsx) | Resolve storm strategy &rarr; Chapter 6 |
| **6** | Spacecraft Systems Repair | [`SpacecraftRepairScene.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/SpacecraftRepairScene.tsx) | 3 subsystem recalibrations &rarr; Chapter 7 |
| **7** | Launch Cinematic & Ending | [`LaunchCinematic.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/LaunchCinematic.tsx) | Multi-stage ascent & victory &rarr; Chapter 0 (Menu) |

### Modal & Dialog Sub-states in `App.tsx`
- `activeDiscovery: MissionDiscovery | null`: Controlled by [`DiscoveryModal.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/DiscoveryModal.tsx). Currently opens on scanning any entity.
- `activeQuiz: MissionDiscovery | null`: Controlled by [`QuizModal.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/QuizModal.tsx) (used for Moon discoveries).
- `activeMiniGame: string | null`: Tracks active mini-game (`'sojourner'`, `'opportunity'`, `'insight'`).
- `novaDialogue`: Floating message bubble overlay rendered via [`NovaDialogue.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/NovaDialogue.tsx) with audio chirps and typing animations.
- `showArchive`, `showSettings`, `showCredits`: Global modals for Codex, audio/save controls, and credits.

---

## 2. Analysis of `GameCanvas.tsx`: Reusable vs. Must Be Replaced

[`src/components/GameCanvas.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/GameCanvas.tsx) is an 848-line 2D side-scrolling platformer canvas.

### Must Be Replaced
1. **Perspective & Movement Model**: Currently implements 1D horizontal movement (`vx`) with planetary gravity (`vy += gravity`) and jumping (`jumpPower`, `isGrounded`). Must be replaced with **top-down 4-directional movement (WASD / Arrows / Virtual D-pad) with 2D tile collision** (no jumping).
2. **1D Camera**: Camera currently clamps along horizontal track `cameraX` (`targetCamX = player.x - viewW / 2`). Must become a **2D smooth tracking camera (`cameraX`, `cameraY`)** following player through 2D chunked coordinates.
3. **Procedural Vector Drawing**: Entities (rovers, landers, craters, mountains, astronaut) are drawn with raw Canvas 2D paths (`ctx.arc`, `ctx.beginPath`, `ctx.fillRect`). Must be replaced with a **tile and sprite atlas rendering pipeline** using the new pixel art assets.
4. **Static World Coordinates**: Currently uses a fixed world width (2400px Moon / 3600px Mars) with a hardcoded ground level at `y = 460`. Must be replaced with **seeded infinite/chunk-based procedural generation**.

### Reusable Concepts & Logic
1. **Game Loop Timing**: The `requestAnimationFrame` loop pattern with decoupling between game updates and React state renders cleanly without re-rendering the parent.
2. **Proximity Trigger & Interaction Pattern**: Entity proximity check (`dist < minDist`) activating hover tags (`[E] SCAN OBJECT`) and `activeNearbyEntity` state.
3. **Touch / On-Screen Controls Layout**: The fixed bottom overlay with directional controls and an action button can be refactored into a top-down virtual D-pad + `[E]` interact button.
4. **Atmospheric Dust / Wind Particle System**: The lightweight particle emitter logic (`particles.forEach(...)`) can easily be adapted for top-down wind, dust storms, and floating spores/snowflakes across biomes.

---

## 3. Mini-Games Interface Audit

All three mini-games follow a clean, consistent interface signature:
```typescript
interface MiniGameProps {
  onSuccess: () => void;
  onClose: () => void;
}
```

### 1. `SojournerRoverPuzzle.tsx` ([`src/components/MiniGames/SojournerRoverPuzzle.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/MiniGames/SojournerRoverPuzzle.tsx))
- **Role**: Rover mobility simulation in Ares Vallis.
- **Mechanics**: 6x5 grid waypoint path-programming. The player stacks commands (`F` = Forward, `L` = Turn Left 90°, `R` = Turn Right 90°) up to 12 steps, avoiding rock obstacles ("Yogi", "Twin Peaks", "Moe Rock") and sand traps to reach target rock "Barnacle Bill".
- **Props**: `onSuccess: () => void`, `onClose: () => void`.
- **Completion Trigger**: Rover reaches `TARGET` coordinates &rarr; calls `onSuccess()`.
- **Exit Trigger**: Player closes modal &rarr; calls `onClose()`.
- **Reward in New Flow**: Rewards **Rocker-Bogie Suspension / Chassis Part**.

### 2. `OpportunityWaterPuzzle.tsx` ([`src/components/MiniGames/OpportunityWaterPuzzle.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/MiniGames/OpportunityWaterPuzzle.tsx))
- **Role**: Field geology paleowater evidence analyzer in Meridiani Planum.
- **Mechanics**: Microscopic imager & Mössbauer spectrometer analysis of 4 rock specimens. Player selects exactly 2 samples that formed in aqueous environments:
  - *Correct*: Sample #02 (Hematite "Blueberry" Concretions) and Sample #03 (Cross-Bedded Ripple Sulfate Bedrock).
  - *Incorrect*: Basaltic volcanic lava (#01) and shock impact breccia (#04).
- **Props**: `onSuccess: () => void`, `onClose: () => void`.
- **Completion Trigger**: Player clicks "Complete Mission Discovery" after passing evidence check &rarr; calls `onSuccess()`.
- **Reward in New Flow**: Rewards **High-Efficiency Solar Bus / Battery Array**.

### 3. `InSightSeismicPuzzle.tsx` ([`src/components/MiniGames/InSightSeismicPuzzle.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/MiniGames/InSightSeismicPuzzle.tsx))
- **Role**: Seismogram frequency filter & core mapping in Elysium Planitia.
- **Mechanics**: Interactive waveform canvas. Player adjusts bandpass frequency slider to the optimal sweet spot (0.50 Hz / 60–80%) and toggles the Wind & Thermal Shield (WTS) dome to filter noise and reveal compressional P-waves and shear S-waves.
- **Props**: `onSuccess: () => void`, `onClose: () => void`.
- **Completion Trigger**: Player locks in the waveform &rarr; clicks "Log Discovery" &rarr; calls `onSuccess()`.
- **Reward in New Flow**: Rewards **Inertial Guidance Gyro / Avionics Unit**.

### Integration with Equipment Interaction Flow
In the new top-down engine:
1. When player approaches an equipment piece and presses `[E]`, the game displays 1 brief Nova dialogue line.
2. The equipment definition indicates its `miniGameId`.
3. The game mounts the matching mini-game with:
   - `onSuccess={() => { markEquipmentSalvaged(id); awardPart(rewardPart); showPickupToast(rewardPart); }}`
   - `onClose={() => { setInteractingEquipment(null); }}`
4. Completed equipment changes appearance to a stripped/dormant sprite and cannot be played again.

---

## 4. `missions.ts` to "Equipment" Concept Mapping

[`src/data/missions.ts`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/data/missions.ts) currently defines `MissionDiscovery` records for 5 historic missions:

| Current ID | Mission Name | Existing Activity | Target Equipment Name | Proposed Biome | Target Ship Part Reward |
|---|---|---|---|---|---|
| `sojourner` | Sojourner Microrover | Mini-Game (Rover Routing) | Wrecked Pathfinder & Sojourner | Desert / Rocky Dust | Rocker-Bogie Mobility Link |
| `opportunity` | Opportunity Rover | Mini-Game (Water Evidence) | Derelict Opportunity Rover | Sand Dunes / Playa | Photovoltaic Power Bus |
| `insight` | InSight Lander | Mini-Game (Seismic Filter) | Silent InSight Geophysical Station | Mars Regolith Plain | Gyroscopic Inertial Stabilizer |
| `apollo_lrv` | Lunar Roving Vehicle | Knowledge Quiz | Stripped Electric Surface Buggy | Rocky Crater Plain | High-Torque Wheel Actuators |
| `surveyor_3` | Surveyor 3 Lander | Knowledge Quiz | Abandoned Automated Surveyor | Basin / Paleolake Shore | Robotic Sampling Servos |
| `apollo_lrrr` | Laser Retroreflector | Knowledge Quiz | Optical Laser Reflector Array | Mountain / Crystalline Highs | Precision Optics / Telemetry Sensor |

### New Equipment Data Schema (`src/data/equipment.ts`)
To satisfy the brief (8–12 pieces scattered deterministically via seed), we will define:
```typescript
export interface EquipmentDefinition {
  id: string;
  name: string;
  shortHint: string;              // 1-sentence Nova hint on approach
  biomePreference: BiomeType;     // desert, rocky, grassland, snow, water-edge
  spriteKey: string;              // Sprite key from asset atlas
  salvagedSpriteKey?: string;     // Stripped / inactive sprite appearance
  miniGameId: 'sojourner' | 'opportunity' | 'insight' | 'field_quiz' | string;
  rewardPart: {
    id: string;
    name: string;
    iconKey: string;              // 16x16 icon key from Star Salvage icons
    description: string;
  };
  codex: {                        // Reuses existing long educational text for optional Codex
    year: string;
    status: string;
    location: string;
    machineTitle: string;
    machineDesc: string;
    scienceTitle: string;
    scienceDesc: string;
    whyItMatters: string;
    officialSource: { title: string; url: string; agency: string };
  };
}
```

---

## 5. Potential Conflicts with the Overhaul Brief

1. **Information Overload Conflict**:
   - *Current Code*: Approaching any object prompts scan; scanning forces open `DiscoveryModal.tsx` containing 3 large multi-paragraph sections (The Machine, The Science, Why It Matters, Specs, Sources).
   - *Brief Requirement*: Explicitly instructs to eliminate mandatory text walls. Layer 1 = Name tag; Layer 2 = 1 short Nova sentence + immediate mini-game; Layer 3 = Part pickup toast. Educational text is strictly optional in the Codex (`MissionArchiveModal.tsx`).
2. **Thematic Lore Conflict**:
   - *Current Code* in [`SpacecraftRepairScene.tsx#L85`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/SpacecraftRepairScene.tsx#L85): Explicitly states *"We do not strip real museum rovers for spare parts. Instead, we use scientific principles..."*.
   - *Brief Requirement*: Explicitly rebrands the game into a **"Top-Down Open-World Salvage Game"** where the player actively salvages physical equipment wrecks for ship parts to fix their ship. The dialogue and UI copy in the repair sequence must be updated to reflect part installation.
3. **World Dimension & Boundary System**:
   - *Current Code*: Uses fixed width 3600px with a 1D floor collision line at `y = 460`.
   - *Brief Requirement*: Infinite or large chunked 2D grid world generated by noise with natural impassable boundaries (water, cliffs, dense rocks).
4. **Save File Schema Extension**:
   - *Current Code*: [`GameProgress`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/systems/saveManager.ts) only stores chapter numbers, badge strings, and unlocked mission IDs.
   - *Brief Requirement*: Must persist world seed, player `(x, y)` position, collected parts inventory, completed equipment IDs, and fog-of-war exploration bitmask without breaking existing saves.

---

## 6. Proposed Architecture

We will structure the new game engine cleanly in modular folders without touching or breaking other working scenes:

```
src/
├── world/                       # Procedural World Generation & Tile Grid
│   ├── noise.ts                 # Seeded Value/Simplex Noise (in-house, zero deps)
│   ├── biomes.ts                # Biome definitions (grass, desert, rocky, snow, water)
│   ├── chunk.ts                 # 16x16 / 32x32 chunk management & lazy loading
│   ├── generator.ts             # Terrain + decoration layer generator
│   ├── collision.ts             # Tile & prop impassable collision resolver
│   └── placement.ts             # Deterministic equipment & ship scatter + flood-fill check
│
├── render/                      # Canvas 2D Pixel Renderer
│   ├── atlas.ts                 # Sprite sheet manifests & pixel-perfect integer slicer
│   ├── camera.ts                # 2D smooth tracking camera with zoom/scaling
│   ├── tileRenderer.ts          # Visible-chunk tile & prop batch renderer
│   ├── minimap.ts               # Circular minimap + cached fog-of-war offscreen canvas
│   └── particleSystem.ts        # Top-down ambient weather (dust, wind, storm)
│
├── game/                        # Gameplay State & Controls
│   ├── player.ts                # 4-direction top-down player state & movement
│   ├── input.ts                 # Keyboard (WASD/Arrows/E) + Mobile Virtual D-Pad
│   ├── interaction.ts           # Equipment proximity detection & prompt dispatch
│   └── inventory.ts             # Collected ship parts state & spaceship repair status
│
├── data/
│   ├── equipment.ts             # 8-12 equipment wreck definitions + rewards (replaces/extends missions.ts)
│   └── atlasManifest.ts         # UV slice coordinates for all sheets in `new assets`
│
└── components/
    ├── WorldCanvas.tsx          # Replaces GameCanvas.tsx for top-down exploration
    ├── MinimapOverlay.tsx       # Circular minimap HUD element
    ├── PartToast.tsx            # Short retro part-pickup notification banner
    └── ... (Existing MiniGames, RepairScene, LaunchCinematic, Codex modals preserved)
```

### Connection Flow
1. **App.tsx** passes `seed`, `currentChapter`, and save state to `WorldCanvas`.
2. When player approaches equipment and presses `[E]`, `WorldCanvas` triggers brief Nova text, then signals `App.tsx` to set `activeMiniGame`.
3. Winning the mini-game returns to `WorldCanvas`, awards the part, updates HUD counter (`x/8 Parts`), and marks equipment completed on the minimap.
4. When required parts are gathered (e.g. 5 of 8), the player returns to their crashed spaceship on the map and presses `[E]`.
5. This seamlessly transitions into [`SpacecraftRepairScene.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/SpacecraftRepairScene.tsx) &rarr; [`LaunchCinematic.tsx`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/components/LaunchCinematic.tsx) &rarr; Victory!

---

## 7. Questions for the Owner (Task C2 - Answered in Phase 1)

1. **Chapter Progression Scope**: Top-down open world wired into Chapter 4 (Mars) only behind feature flag `USE_TOPDOWN_WORLD`.
2. **Missing Upward/Back Walking Frames**: North walk frames synthesized with bobbing and tint until replacement sheets are added.
3. **Spaceship Sprite Asset**: Lander structure selected and registered as `ship_broken` / `ship_repaired`.
4. **Asset Licensing for Public Release**: Prototype assets flagged with `"license": "restricted-placeholder"` or `"cc0"`.
5. **Mini-Game Variety for 8–12 Equipment Wrecks**: 3 puzzles varied with difficulty plus quick knowledge field quizzes.

---

## 8. Phase Implementation Status

- **Phase 1 (Complete)**: Procedural infinite chunk generation, seeded biomes (Regolith, Desert, Savanna, Snow, Water), smooth 2D tracking camera, 4-direction astronaut & Nova movement.
- **Phase 2 (Complete)**: 8 historic equipment wrecks, deterministic ring placement with BFS flood-fill reachability, `[E]` interaction triggers, 3 mini-games + quiz integration, ship part rewards & HUD tracking.
- **Phase 2.5 & 2.6 (Complete)**: Clean 100% solid procedural ground tiles, 4x4 Bayer dither transition borders, tonal variation patches, non-blocking ground detail layer, grounded wrecks with scorch craters and contact shadows, genuine North-facing astronaut back art.
- **Phase 3 (Complete)**:
  - **Task 0 Fixes**:
    - *Blue Banner/Arch Icons*: Identified as `prop_crater_small` mapped to `kenney_packed.png` (4, 5) which was a blue dungeon banner; replaced `prop_boulder_mars`, `prop_rock_dark`, and `prop_crater_small` with authentic procedural pixel art.
    - *Blurry Ship & Large Sprites*: Resolved by implementing offscreen pre-scaled canvases in `ImageAtlasManager` using nearest-neighbor (`imageSmoothingEnabled = false`), eliminating non-integer downscaling blur.
  - **Circular Minimap & Fog of War**:
    - [`src/render/minimap.ts`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/render/minimap.ts): 128-byte per chunk bitset Fog of War (`Uint8Array(128)`), serializable to base64, 18-tile reveal radius around player.
    - Round HUD minimap (150px) with circular clipping, North-Up view, 36-tile radius, directional player arrow, ship icon & edge-pointer, explored equipment pins (gold/green), and subtle proximity signal blips (`?`).
    - Fullscreen Enlarged Map Overlay (440px) toggled via `[M]` key or minimap tap; pauses gameplay; incorporates first-open Nova dialogue hint hook.
    - F3 debug panel updated with explored tile count, explored chunk count, and radar radii.

- **Phase 4 (Complete)**:
  - **Ship Interaction & Progress**:
    - Crashed spaceship is an interactable landmark (`dist < 55px` proximity) with dynamic proximity nametag: displays `<parts>/8 PARTS` when incomplete, `READY TO REPAIR! [E]` with glowing green border when 8 parts are gathered, and `READY FOR LAUNCH! [E]` when repaired.
    - One-line Nova dialogue when missing parts: *"We still need X more parts, explorer."* (no modal disruption).
    - Visible ship progression: collected ship parts render mounted on the spacecraft chassis (`drawSprite` with part icon offsets); pulsing gold/cyan radar beacons activate on minimap when 8 parts are gathered.
    - Ship repaired state renders `ship_repaired` sprite, twin blue plasma thruster plumes, and an active shield energy aura.
  - **Repair + Launch + Ending Loop**:
    - Approaching ship with 8 parts and pressing `[E]` mounts `SpacecraftRepairScene` with 8-part verification grid and 3 subsystem slider calibrations (~30-60s).
    - On calibration complete, ship engines engage with plasma plumes and Nova dialogue, seamlessly launching `LaunchCinematic`.
    - At cinematic conclusion, transitions to `EndingScreen` displaying run metrics (play time, 8/8 parts, tiles explored, world seed) and 4 action buttons: *Play Again (New Seed)*, *Replay Same Seed*, *Main Menu*, and *Credits*.
  - **Save System & Autosave (v2)**:
    - Extended `src/systems/saveManager.ts` with backward-compatible versioned schema (`version: 2`).
    - Serializes seed, player tile/facing, parts array, completed wrecks, base64 fog-of-war bitset, ship repair state, play time, and chapter progress.
    - Autosaves on part collected, wreck completed, every 30s of play, `beforeunload`, and returning to menu. Throttled writes, safe `try/catch`.
    - Main Menu: *Continue* button shows formatted time and part count summary; resumes open-world run directly; *New Game* prompts overwrite confirmation if save exists.
    - Safe walkable spawn verification on load via `collision.isTileWalkable`.
- **Phase 5 (Complete)**:
  - **Task 0 (Launch Sequence Bug Fix)**:
    - *Root Cause*: `LaunchCinematic.tsx` was styled with `relative w-full h-full min-h-screen`, placing it within normal DOM flow pushed below the full-height `<canvas>` element inside `WorldScene`'s column container. The cinematic overflowed offscreen cutting off ignition controls, while World HUD elements (`z-30` to `z-40`) and the F3 debug panel (`z-40`) remained visible on top. Furthermore, an intermediate unprompted dialogue trapped the transition.
    - *Resolution*: Rewrote `LaunchCinematic.tsx` with `fixed inset-0 z-[100] w-screen h-screen bg-[#03060d]`. In `WorldScene.tsx`, all world HUDs (top strip, parts counter, minimap, hints, d-pad, F3 panel) are hidden when `isLaunching || showEnding`. In `SpacecraftRepairScene.tsx`, completing calibrations triggers `onRepairComplete()` directly into `LaunchCinematic`. Added a prominent `Skip Cinematic` button with auto-advancing phases.
  - **Task 1 (Planetary Exploration Codex Redesign)**:
    - Dedicated to the Mars open world: displays 8 historical equipment relics (`MARS_CODEX_ENTRIES`).
    - Locked entries display a dark silhouette with unrevealed `??? Signal Uncharted` tags.
    - Unlocked entries display sprite, machine title, agency/year, single headline fact (max 20 words), and collapsible `[Learn More (Engineering Notes)]` drawer with short bullet points.
    - Counter header: `Unlocked: X / 8`.
    - Secondary tab: `Historical Apollo Archive` safely houses Earth/Moon missions from `MISSIONS_DATA`.
    - Part collection toast in open world displays `· CODEX UPDATED (+1)`.
  - **Task 2 (Modal Information Diet & Responsive Layout)**:
    - Enforced a strict default budget (<60 visible words) across all mini-games and scene modals.
    - *Before/After Word Counts*:
      - **Sojourner Rover Puzzle**: 71 words &rarr; **32 words** (light delay theory collapsed into `[ℹ Why?]` drawer).
      - **Opportunity Paleowater Puzzle**: 175 words &rarr; **44 words** (geological deductions collapsed into `[Learn More]` drawer).
      - **InSight Seismic Filter**: 117 words &rarr; **36 words** (frequency attenuation physics collapsed into `[ℹ Why?]` drawer).
      - **Field Avionics Quiz Modal**: 75 words &rarr; **42 words** (streamlined questions and 1-line options).
      - **Spacecraft Systems Calibration**: 155 words &rarr; **46 words** (technical background collapsed into `[Why?]` drawers).
    - Every modal is 100% visible on a single screen without scrolling on desktop (1366x768) and mobile (390x844).
  - **Headless Browser Automated QA Verification**:
    - Built comprehensive Playwright automated test suite ([`scripts/qa_runner.mjs`](file:///d:/previous2/Raven\codes\Mars-The-Last-Descent\scripts\qa_runner.mjs)).
    - Automatically tests: World Scene at ship, Codex Mars Relics tab (locked silhouettes + unlocked), Codex Historical Apollo tab, InSight Seismic Filter, Opportunity Paleowater Analysis, Field Avionics Quiz, Spacecraft Repair calibration (all 3 sliders), Launch Cinematic ignition & ascent, and Ending Screen with run statistics.
    - Captures verified screenshots for Desktop (1366x768) and Mobile (390x844) in `qa-screenshots/`.
- **Phase 6 (Complete)**:
  - **Task 1 (Unique Recognizable Pixel-Art Sprites for All 8 Wrecks)**:
    - Designed and implemented 8 distinct, historically authentic procedural pixel-art sprites (36x36 footprint) for each mission wreck under CC0 1.0 Universal in `src/render/wreckSprites.ts` and `src/render/proceduralTiles.ts`:
      1. `wreck_sojourner` & `wreck_sojourner_stripped`: Pathfinder 3-petal lander base with gold-leaf foil + 6-wheel microrover with APXS sensor.
      2. `wreck_opportunity` & `wreck_opportunity_stripped`: Tan/gold hexagonal solar wings, upright Pancam mast, rocker-bogie chassis.
      3. `wreck_insight` & `wreck_insight_stripped`: Octagonal white lander deck, twin circular UltraFlex solar arrays, copper SEIS seismometer dome on ground with ribbon cable.
      4. `wreck_spirit` & `wreck_spirit_stripped`: Dust-red coated rover, tilted right-front wheel jammed in sand rut, visible titanium suspension link.
      5. `wreck_deep_space_dish` & `wreck_deep_space_dish_stripped`: Parabolic dish antenna tilted toward sky with feedhorn, triangular steel lattice truss tower on concrete piers. (Replaced UFO/airship placeholder).
      6. `wreck_phoenix` & `wreck_phoenix_stripped`: Arctic lander on 3 shock struts with frost glints, twin circular solar wings, articulated scoop arm digging into exposed subsurface water ice trench. (Replaced platformer brick block).
      7. `wreck_lrv_buggy` & `wreck_lrv_buggy_stripped`: Open tubular aluminum buggy frame, orange Kapton foil, 2 bucket seats with headrests, T-handle console, forward gold umbrella dish, spun wire-mesh wheels.
      8. `wreck_surveyor` & `wreck_surveyor_stripped`: Triangular tubular tripod frame, planar solar panel on mast, Apollo 12 retrieved TV camera, scissor-arm soil scoop in dirt.
    - All 8 registered in `SPRITE_MANIFEST` under `sheet: 'procedural'` with `license: 'cc0'`.
  - **Task 2 (World Visual Cleanup)**:
    - *Lime-Green Rectangles Resolved*: Identified root cause in `src/world/biomes.ts` (`prop_cactus` had `tint: '#84cc16'`). Replaced with `prop_sand_ventifact` (wind-carved desert rock with desert varnish) and grounded all grassland palettes to hardy olive/lichen tones (`#365314`, `#4d7c0f`).
    - *Snow Biome Borders Smoothed*: Replaced harsh 4x4 binary Bayer dither with soft organic scalloped permafrost curves (`tile_border_mars_snow`, `tile_border_snow_mars`, `tile_border_sand_snow`) using chilled tundra base tones (`#8a3c28`, `#cde4f0`) plus `decor_snow_drift` and `decor_frost_rim`.
    - *Mars Plains Variety*: Added non-blocking geological landmarks across the rocky regolith wastes: `decor_dune_ridge`, `decor_crater_ring`, `decor_dust_devil_track`, `decor_riverbed_gravel`, and `prop_outcrop_cluster`. Full BFS walkability preserved.
  - **Task 3 (Automated Headless Browser QA Verification)**:
    - Built [`scripts/qa_runner_phase6.mjs`](file:///d:/previous2/Raven\codes\Mars-The-Last-Descent\scripts\qa_runner_phase6.mjs).
    - Automatically captured screenshots at 1366x768 and 390x844 for all 8 wrecks, crashed spaceship, 4 biome borders (Mars/Sand, Mars/Grass, Mars/Snow, Land/Water), and InSight clean verification.
    - Saved to `qa-screenshots/phase6/`.





