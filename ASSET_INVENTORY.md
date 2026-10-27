# Asset Inventory & Slicing Manifest: "Mars: The Last Descent"

**Inventory Date**: October 2026  
**Auditor**: Antigravity Pair Programmer  
**Target Folder**: [`src/assets/new assets/`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/)  
**Base Unit Reference**: 16&times;16 px native tile size, rendered at 3&times; or 4&times; integer scale with `ctx.imageSmoothingEnabled = false`.

---

## 1. Directory Structure

```
src/assets/new assets/
├── 8-bit_tiles_platformer.png
├── colorful-illustrated-set-cracked-rocks-260nw-2812761893.png
├── game-ui-elements-set-retro-260nw-2631633133.png
├── Grassland-Top-Down-Tileset-Pixel-Art2-720x480.png
├── nova_walk.png
├── pixel keyboard.png
├── player_walk.png
├── pngtree-sci-fi-pixel-art-sprite-sheet-top-down-base-walls-machines-png-image_19052232.png
├── pngtree-sci-fi-pixel-art-top-down-base-walls-machines-buildings-sprite-png-image_19052242.png
├── rover.png
├── scifi depot.png
├── scifi icon 2.png
├── scifi icon.png
├── space themed.png
├── stock-vector-satellite-rocket-pixel-art-set-spaceship-spacecraft-collection-bit-sprite-game-development-2172857931.png
├── tiles.png
└── kenny nl assets/
    ├── License.txt (CC0 1.0 Universal)
    ├── Tilesheet.txt (16x16 px, 12 cols x 11 rows = 132 tiles)
    ├── Preview.png (918x515)
    ├── Sample.png (918x515)
    ├── Tilemap/
    │   ├── tilemap.png (203x186, 1px spacing)
    │   └── tilemap_packed.png (192x176, 0px spacing)
    ├── Tiles/ (132 individual 16x16 PNG files: tile_0000.png to tile_0131.png)
    └── dungeon/ (Duplicate Tiled XML, Tilemap, and Tiles copy)
```

---

## 2. Comprehensive Asset Inventory Table

Dimensions verified directly via script from file binary headers:

| File Name | Dimensions (W&times;H) | File Size | Type | Grid / Layout Analysis | Content Breakdown |
|---|---|---|---|---|---|
| [`player_walk.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/player_walk.png) | 256&times;256 px | 21.4 KB | Character Sheet | 4 cols &times; 4 rows (64&times;64 px / frame; 16 frames total) | Astronaut in spacesuit with gold visor. Row 0: Idle/bob front; Row 1: Standing 3/4 left; Row 2: Walk/run left cycle (4 frames); Row 3: Walk/run right cycle (4 frames). |
| [`nova_walk.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/nova_walk.png) | 736&times;525 px | 245.5 KB | Character Sheet | Irregular layout ("Ginger & Topey Sprites"); title text on top; sprites ~80&times;60 px | Two cat variants. Blue-eyed grey/white cat matches NOVA companion: Row 0: diagonal walk (2 frames); Row 1: side walk (3 frames); Row 2: front-facing walk (3 frames) + sleeping frames. |
| [`rover.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/rover.png) | 554&times;554 px | 50.4 KB | Single Sprite | Single upscaled sprite (native ~60&times;60 px, scaled ~9&times;) | 6-wheel Martian exploration rover (isometric/3/4 view) with Pancam mast, rocker-bogie chassis, and high-gain dish. |
| [`Grassland-Top-Down-Tileset-Pixel-Art2-720x480.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/Grassland-Top-Down-Tileset-Pixel-Art2-720x480.png) | 720&times;480 px | 499.3 KB | Terrain Tileset & Props | Composite clusters of 16&times;16 / 32&times;32 blocks | Top-down terrain: grass plateaus, dirt cliffs, dirt paths, water pools with reflections, stone pillars/stairs, flowers, and weeds. |
| [`tiles.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/tiles.png) | 700&times;400 px | 273.1 KB | Texture Sampler | 6&ndash;7 cols &times; 4 rows (25 sample tiles, ~80&times;80 px each upscaled from 16&times;16) | 16&times;16 seamless textures: snow/ice-capped rock, volcanic rock, dirt, red bricks, sandstone, desert sand, water caustics, water waves, wood grain. |
| [`8-bit_tiles_platformer.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/8-bit_tiles_platformer.png) | 256&times;256 px | 39.2 KB | Tile & Prop Sheet | 16 cols &times; 16 rows (exact 16&times;16 px tiles, 256 tiles total) | Mixed 8-bit platformer tiles: cobble rock, dirt, basalt rock, sand, metal panels, pipes, platformer tree, fences, small rock props, ladders. |
| [`kenny nl assets/Tilemap/tilemap_packed.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/kenny%20nl%20assets/Tilemap/tilemap_packed.png) | 192&times;176 px | 5.2 KB | Tile Sheet (CC0) | 12 cols &times; 11 rows (exact 16&times;16 px tiles, 0px spacing, 132 tiles) | Clean CC0 dungeon & ground tiles: stone walls, dirt/sand floors, water, chests, crates, doors, ladders, stairs, pillars, torch props. |
| [`pngtree-sci-fi-pixel-art-sprite-sheet-top-down-base-walls-machines-png-image_19052232.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/pngtree-sci-fi-pixel-art-sprite-sheet-top-down-base-walls-machines-png-image_19052232.png) | 640&times;640 px | 555.2 KB | Machinery Sprite Sheet | Irregular row grid (sprites range ~40&times;40 to 120&times;80 px) | Sci-fi terminals, computer radar screens, server racks, hydraulic generator, dome sensors (InSight SEIS lookalike), power hubs, comms relay, battery crates. |
| [`pngtree-sci-fi-pixel-art-top-down-base-walls-machines-buildings-sprite-png-image_19052242.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/pngtree-sci-fi-pixel-art-top-down-base-walls-machines-buildings-sprite-png-image_19052242.png) | 640&times;640 px | 605.7 KB | Structures Sheet | 4 cols &times; 3 rows (~140&times;180 px per structure) | Massive sci-fi structures: giant tripod parabolic dish (LRV / Deep Space Network), multi-level server towers, research lab with airlock, command bunker, reactors. |
| [`scifi depot.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/scifi%20depot.png) | 478&times;506 px | 29.0 KB | Prop Sheet | Irregular layout (props ~40&times;80 to 80&times;120 px) | Base props: glass viewports with cyan LED trim, double metal lockers, wall partitions, horizontal air vent, floor plates, crates, green fuel barrel. |
| [`scifi icon 2.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/scifi%20icon%202.png) | 810&times;420 px | 91.4 KB | Icon Sheet | 11&ndash;12 cols &times; 5 rows (54 framed 16&times;16 icons in ~60&times;60 px card cells) | 54 "Star Salvage" items: wrench, gear, solar panel, battery cells, fuel canisters, CPU chips, motherboards, keycards, thruster packs, oxygen tanks, crystals. |
| [`scifi icon.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/scifi%20icon.png) | 630&times;500 px | 35.0 KB | Icon Sheet | 6 cols &times; 3 rows (18 large showcase card frames, ~90&times;90 px) | 18 selected Star Salvage icons: rocket, helmet, scanner, planet, alien, saucer, keycard, battery, chip, laser, jetpack, robot head, satellite, ice crystal. |
| [`pixel keyboard.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/pixel%20keyboard.png) | 736&times;645 px | 441.0 KB | UI / Controls Sheet | 8 cols &times; 7 rows (~80&times;80 px keycap cells, upscaled pixel art) | Keycaps: Arrow keys (Up/Down/Left/Right), F1-F12, letters A-Z, punctuation, blank keycap. Includes `[E]` interact key, `[W]`, `[A]`, `[S]`, `[D]`. |
| [`game-ui-elements-set-retro-260nw-2631633133.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/game-ui-elements-set-retro-260nw-2631633133.png) | 494&times;280 px | 91.7 KB | UI Element Sheet | Irregular retro UI element set | Dark blue/off-white retro buttons ("START", "SELECT"), loading bar, HP segmented gauge, hearts, dialogue arrow cursor, checkmark, square frame. |
| [`space themed.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/space%20themed.png) | 800&times;800 px | 436.6 KB | Space Illustration Sheet | 4 cols &times; 4 rows (16 items, ~180&times;180 px each) | Space rockets, planets (Earth, Moon, cratered red Mars planet), cross-wing satellite, deep space probe, tripod robotic lander module, space station. |
| [`stock-vector-satellite-rocket-pixel-art-set-spaceship-spacecraft-collection-bit-sprite-game-development-2172857931.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/stock-vector-satellite-rocket-pixel-art-set-spaceship-spacecraft-collection-bit-sprite-game-development-2172857931.png) | 1500&times;999 px | 866.9 KB | Pixel Art Spacecraft Sheet | 4 cols &times; 2 rows (8 items, ~350&times;380 px each) | Telescope satellite, ground radar dish, orbital platform, rocket, Apollo-style lander capsule with landing legs, top-down shuttle, multi-legged probe, moon. |
| [`colorful-illustrated-set-cracked-rocks-260nw-2812761893.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/colorful-illustrated-set-cracked-rocks-260nw-2812761893.png) | 520&times;280 px | 167.3 KB | Vector Illustration Sheet | 4 cols &times; 2 rows (8 rock formations, ~130&times;140 px) | Cracked crater rock, shrapnel explosion, gravel boulder cluster, circular crater debris rim, large boulder, diagonal scatter, boulder trio, geode rock. |

---

## 3. Key Sheet Content Regions & Coordinates

### 1. Player Character (`player_walk.png`)
- **Dimensions**: 256&times;256 px. Native cell size: 64&times;64 px.
- **Frame Slices**:
  - `IDLE_DOWN` / Front Stance: Row 0, Col 0&ndash;3 (`x = 0..255, y = 0..63`)
  - `IDLE_LEFT` / 3/4 Stance: Row 1, Col 0&ndash;3 (`x = 0..255, y = 64..127`)
  - `WALK_LEFT`: Row 2, Col 0&ndash;3 (`x = 0..255, y = 128..191`) &mdash; 4 animation frames
  - `WALK_RIGHT`: Row 3, Col 0&ndash;3 (`x = 0..255, y = 192..255`) &mdash; 4 animation frames
- **Note**: No upward/rear-facing frames are present. Walking North will use mirrored or vertical bounce standing frames.

### 2. NOVA Companion (`nova_walk.png`)
- **Blue-Eyed Grey/White Cat (Nova Variant)**:
  - `NOVA_WALK_SIDE`: Middle row, Col 2&ndash;4 (`x = 300..720, y = 250..370`) &mdash; 3 walk frames
  - `NOVA_WALK_DOWN` (Front View): Bottom row, Col 2&ndash;4 (`x = 340..700, y = 380..520`) &mdash; 3 frames with tail up
  - `NOVA_IDLE_REST`: Middle row, left frames (`x = 20..270, y = 260..360`)

### 3. Equipment & Machines
- **Mars Rover Wreck**: [`rover.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/assets/new%20assets/rover.png) (full image, ~554&times;554 px; downsampled/sliced as 48&times;48 or 64&times;64 world sprite).
- **InSight SEIS Dome & Sensor**: `pngtree...19052232.png` Row 4, Col 0&ndash;2 (metallic dome with glass sensor lens, `x = 30..220, y = 430..530`).
- **Satellite Dish / Comms Array**: `pngtree...19052242.png` Row 1, Col 1 (massive parabolic dish on legs, `x = 150..320, y = 220..420`).
- **Surface Lander / Capsule**: `stock-vector...2172857931.png` Row 1, Col 0 (capsule with 3 landing legs, `x = 120..420, y = 500..800`).
- **Power Generator / Battery Cache**: `pngtree...19052232.png` Row 1, Col 2 (hydraulic press/power hub, `x = 220..310, y = 130..230`).
- **Comms Relay Mast**: `pngtree...19052232.png` Row 5, Col 7 (`x = 560..620, y = 530..620`).

### 4. Terrain Biomes & Props
- **Grassland Biome**: `Grassland-Top-Down-Tileset-Pixel-Art2-720x480.png` top-left & middle-left (grass flats, cliff transitions, dirt paths).
- **Water / Lakes**: `Grassland...png` bottom-right (`x = 240..700, y = 300..470`) + `tiles.png` Row 2, Col 2&ndash;3 (caustics and wave tiles).
- **Desert / Sand Biome**: `tiles.png` Row 1, Col 5 (`x = 500..600, y = 100..200`) + `8-bit_tiles_platformer.png` Cols 12&ndash;15, Rows 0&ndash;7 + Kenney CC0 sand tiles.
- **Rocky / Mars Regolith Biome**: `tiles.png` Row 1, Col 0 (Mars gravel) & Row 0, Col 1 (volcanic rock) + `8-bit_tiles...png` basalt columns.
- **Snow / Ice Biome**: `tiles.png` Row 0, Col 0 (snow-capped rock) & `scifi icon.png` ice crystals.
- **Props**:
  - Flowers & Weeds: `Grassland...png` mid-right (`x = 450..680, y = 230..280`).
  - Small Boulders: `8-bit_tiles_platformer.png` bottom row (`x = 175..220, y = 235..255`).
  - Craters & Large Rock Formations: `colorful-illustrated-set-cracked-rocks...png`.
  - Base Props & Grates: `scifi depot.png` (vents, crates, lockers).

### 5. UI Elements, Controls & Minimap
- **Interactivity Prompt `[E]`**: `pixel keyboard.png` Row 2, Col 4 (`x = 360..450, y = 180..270`).
- **Movement Hints (WASD / Arrows)**: `pixel keyboard.png` Row 0, Col 0&ndash;3 (Arrow keys) and `[W]`, `[A]`, `[S]`, `[D]` keys.
- **Minimap Frame & HUD Panels**: `game-ui-elements-set-retro...png` square border frame + retro gauge bars.
- **Ship Parts Inventory Icons**: `scifi icon 2.png` (54 distinct 16&times;16 icons: wrench, gear, battery, solar panel, microchip, thruster, oxygen tank, fuel canister).

---

## 4. Proposed Element-to-Asset Mapping

| Game Element | Chosen Asset | Coordinates / Sub-region | Justification |
|---|---|---|---|
| **Player (Astronaut)** | `player_walk.png` | 64&times;64 frames (Rows 0&ndash;3) | Authentic pixel astronaut matching theme. |
| **NOVA Companion** | `nova_walk.png` | Blue-eyed grey/white cat frames | Matches robotic cat lore; includes walking & idle postures. |
| **Grassland Biome** | `Grassland...720x480.png` | Upper-left & middle-left clusters | High-quality organic top-down grass, cliffs, paths. |
| **Desert / Sand Biome** | `tiles.png` + Kenney CC0 Tiles | Sand & dune 16&times;16 tiles | Seamless sand textures with clean tiling. |
| **Rocky / Mars Dust** | `tiles.png` (Row 1 Col 0) + Kenney CC0 | Mars gravel & basalt tiles | Dark red-brown Martian regolith palette. |
| **Snow / Ice Biome** | `tiles.png` (Row 0 Col 0) | Snow rock & ice tiles | Pale frosty tiles matching PokeWilds ice feel. |
| **Water / Lake Tiles** | `Grassland...png` + `tiles.png` | Water pool & caustic wave tiles | Natural shorelines and animated water waves. |
| **Props (Trees/Flowers/Rocks)** | `Grassland...png`, `8-bit_tiles...`, Kenney | Flowers, boulders, shrubs, fences | Clear obstacle collision vs walkable decor. |
| **Crashed Rover Wreck** | `rover.png` | Scaled 48&times;48 / 64&times;64 sprite | Detailed 6-wheel rover matching Sojourner/Opportunity. |
| **InSight Seismic Station** | `pngtree...19052232.png` | Row 4 Col 0 (Dome sensor) | Matches InSight's SEIS dome perfectly. |
| **Comms / Radar Array** | `pngtree...19052242.png` | Row 1 Col 1 (Parabolic dish) | Giant dish on legs for communications array. |
| **Lander / Capsule Wreck** | `stock-vector...2172857931.png` | Row 1 Col 0 (Lander capsule) | Apollo/Surveyor tripod descent capsule. |
| **Player Crashed Spaceship** | `pngtree...19052242.png` (Row 2 Col 0) or `stock-vector...` | Research base / spacecraft shuttle | Large distinct landmark for spawn and launch ending. |
| **Ship Salvage Part Icons** | `scifi icon 2.png` (Star Salvage) | 16&times;16 icons (wrench, chips, batteries) | 54 high-quality sci-fi icons created for salvage games. |
| **Interact Prompt `[E]`** | `pixel keyboard.png` | Row 2 Col 4 `[E]` keycap | Pixel-art keycap with clear retro readability. |
| **Minimap Border & HUD** | `game-ui-elements-set-retro...png` | Square/round frame & pixel bars | Cohesive Game Boy Color retro aesthetic. |

---

## 5. Potential Problems & Risk Flags

### 1. Inconsistent Native Resolutions & Scales
- Packs come from disparate artists with different native pixel grids:
  - `8-bit_tiles_platformer.png` and `kenny nl assets`: Native **16&times;16 px**.
  - `player_walk.png`: **64&times;64 px** frame size.
  - `rover.png`: **554&times;554 px** (an upscaled pixel art graphic).
  - `tiles.png`: **16&times;16** textures rendered in **~80&times;80 px** preview swatches.
  - `colorful-illustrated-set-cracked-rocks...`: Vector illustration (~130&times;140 px per rock), **not pixel art**.
- *Solution*: Normalize everything through a sprite atlas manifest (`src/data/atlasManifest.ts`) that downscales/slices all assets to conform to integer multipliers of the base 16&times;16 grid with `imageSmoothingEnabled = false`.

### 2. Irregular Sheets Without Uniform Grids
- `Grassland-Top-Down-Tileset-Pixel-Art2-720x480.png`, `nova_walk.png`, and `scifi depot.png` are artistic montage sheets rather than aligned power-of-2 tile sheets.
- *Solution*: Do not slice with naive math (`col * tileSize`); define exact rectangular bounding boxes `[x, y, w, h]` for each sprite in the manifest.

### 3. Missing Upward/Back (North) Walk Cycles
- `player_walk.png` and `nova_walk.png` only have down (South) and left/right (East/West) frames. There are **zero back-facing (North)** sprites.
- *Mitigation*: For upward movement, we will use the symmetrical idle torso frame with simulated bobbing until dedicated upward sprites are provided.

### 4. Missing Dedicated Crashed/Repaired Spaceship Sprite
- While there are various landers and structures across `stock-vector...` and `pngtree...`, there is no dedicated two-state (damaged wreck vs repaired ready-to-launch) spaceship sprite in the pack.
- *Mitigation*: Use a composite of the lander/base module with smoke particle emitters when damaged, switching to an active thruster glow when repaired.

### 5. Licensing & Commercial Redistribution Risks
- **Kenney Assets (`kenny nl assets/`)**: **CC0 1.0 Universal (Public Domain)** &mdash; completely safe for any use without attribution.
- **Pngtree Assets (`pngtree-...19052232.png`, `pngtree-...19052242.png`)**: Contain embedded Pngtree watermark stamps. Pngtree terms prohibit redistribution in open source codebases without commercial license.
- **Shutterstock Assets (`...-260nw-2812761893.png`, `...-260nw-2631633133.png`, `stock-vector-...2172857931.png`)**: Contain Shutterstock watermarks (`shutterstock.com - 2812761893`). Commercial license required for public distribution.
- **Dreamstime Asset (`space themed.png`)**: Contains Dreamstime watermark in center.
- *Recommendation*: Treat all watermarked stock assets as prototype placeholders. For any public deployment, either acquire licenses or substitute with CC0 alternatives (like the Kenney pack).

---

## 6. Phase 2.5 Final Ground Tile Mapping per Biome

To eliminate all visual noise (doorways, arches, cave ceilings, banners, and transparency holes), all ground layers are now generated through [`src/render/proceduralTiles.ts`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/src/render/proceduralTiles.ts) as 100% solid, crisp 16&times;16 pixel canvases, cached offscreen with weighted randomness:

| Biome | Dominant Base (85%) | Subtle Variant (10%) | Rare Accent (5%) | Shoreline / Edge | Palette Notes |
|---|---|---|---|---|---|
| **Martian Regolith (`rocky`)** | `tile_mars_regolith` (`#9c3f25`) | `tile_mars_dark_rock` (basalt grains) | `tile_mars_gravel` (weathered crumb) | N/A | Calm, uncluttered rusty red Mars ochre; default landscape around spawn. |
| **Martian Desert (`desert`)** | `tile_sand_base` (`#d99d57`) | `tile_sand_dune` (wind ripples) | `tile_sand_pebble` (amber grit) | N/A | Warm golden sand dunes with horizontal ripple banding. |
| **Terraformed Savanna (`grassland`)** | `tile_grass_base` (`#4d8e3b`) | `tile_grass_variant` (grass tuft) | `tile_grass_path` (soil trail) | N/A | Friendly 8-bit green terraformed bio-dome. |
| **Glacial Cryo Plain (`snow`)** | `tile_snow_base` (`#dff0f8`) | `tile_ice_sheet` (cryo ice crack) | `tile_snow_base` | N/A | Pale crystalline cryo polar snow and ice sheet. |
| **Paleo Water Basin (`water`)** | `tile_water_deep` (`#1d4ed8`) | `tile_water_shallow` (`#2563eb`) | N/A | `tile_shore_edge` (`#936a43`) | Deep vibrant ancient lake with shallows and wet shoreline borders. |

### Player & Nova Directional Mapping (Bug 3 & Task 4 Fix)
- **Player**: Uses [`public/assets/characters/player2.png`](file:///d:/previous2/Raven/codes/Mars-The-Last-Descent/public/assets/characters/player2.png) (500&times;500 px, `license: restricted-placeholder`):
  - **South**: `{ x: 48, y: 100, w: 68, h: 114 }` (front view)
  - **North**: `{ x: 159, y: 100, w: 69, h: 114 }` (**Genuine back-facing frame** showing helmet back and life support backpack; replaces the fake darkened fallback!)
  - **East (Right)**: `{ x: 273, y: 100, w: 63, h: 114 }` + 3-frame walk cycle at `y: 270`
  - **West (Left)**: `{ x: 381, y: 100, w: 63, h: 114 }` + 3-frame walk cycle at `y: 271`
- **NOVA Cat**:
  - **East (Right)**: Native sheet facing East (`flipX: false`)
  - **West (Left)**: Flipped horizontally (`flipX: true`)

---

## 7. Phase 2.6 Visual Polish Enhancements

### 1. Biome Transition Dither Borders
To replace stair-stepped seams between land biomes, 4&times;4 Bayer ordered dither transition tiles feather the boundaries:
- `tile_border_mars_sand`: Regolith to desert sand dither blend.
- `tile_border_mars_grass`: Regolith to savanna grassland dither blend.
- `tile_border_mars_snow`: Regolith to polar cryo-snow dither blend.
- `tile_border_sand_grass`: Desert sand to savanna grassland dither blend.

### 2. Tonal Ground Variation Patches
To eliminate the "flat and empty" look, low-frequency patch noise seeds subtle tonal blobs across continuous biomes:
- `tile_mars_dark_patch` / `tile_mars_light_patch`: Low-contrast rusty red/brown tonal variations across regolith plains.
- `tile_sand_dark_patch`, `tile_grass_dark_patch`, `tile_snow_dark_patch`: Subtle dark earth/dune variations.

### 3. Non-Blocking Ground Decoration Layer (Pre-baked on Offscreen Chunks)
Clustered detail overlay sprites pre-baked into chunk offscreen canvases (0 ms runtime CPU overhead):
- **Mars Regolith**: `decor_mars_crater` (mini craters), `decor_mars_rubble` (boulder fragments), `decor_mars_fissure` (thermal cracks).
- **Desert**: `decor_sand_ripple` (dune wind waves), `decor_sand_pebbles`, `decor_sand_scrub`.
- **Grassland**: `decor_grass_flower_red`, `decor_grass_flower_yellow`, `decor_grass_flower_white`, `decor_grass_tuft`.
- **Snow**: `decor_snow_shard`, `decor_snow_mound`.

### 4. Anchored Wrecks & Landmark Ship Grounding
- **Spaceship**: Grounded with a large blast scorch crater (`rgba(24, 7, 3, 0.7)`), tripod contact shadow, thruster ember smoke, and proximity landmark tag `CRASHED ESCAPE MODULE (SHIP)`.
- **Equipment Wrecks**: Grounded with blast scorch rings, contact shadow directly beneath chassis/wheels, deterministic ground debris (`decor_scorch_crater`, `decor_metal_scrap`, `decor_tire_track`), active cyan/gold beacon LED glints, and salvaged desaturated states.
- **Stray Elements Fixed**:
  - Canvas CSS `cursor-crosshair` (which caused the rogue `+` cursor) replaced with `cursor-default`.
  - Unanchored `ship_broken` lander at spawn grounded with blast crater, shadow, and tag.

---

## 8. Phase 6 Wreck Art & World Visual Cleanup

### 1. Unique Procedural Pixel-Art Sprites (8 Missions, CC0 1.0 Universal)
To replace duplicate rover sprites and inappropriate placeholders (e.g. platformer blocks for Phoenix and airship/UFO graphics for Deep Space Dish), all 8 exploration wrecks are authored as bespoke procedural pixel art (36&times;36 px footprint) with **Available** and **Salvaged / Stripped** variants:

| ID | Mission Name | Sprite Key (Available) | Sprite Key (Salvaged) | Visual Characteristics | License |
|---|---|---|---|---|---|
| `eq_sojourner` | Pathfinder & Sojourner (1997) | `wreck_sojourner` | `wreck_sojourner_stripped` | Open triangular solar petals on ground with gold-leaf foil, central electronics tetrahedron, deploy ramp, and tiny 6-wheeled microrover with APXS sensor. Salvaged: drive motor missing, chassis tipped. | CC0 |
| `eq_opportunity` | Opportunity Rover (2004) | `wreck_opportunity` | `wreck_opportunity_stripped` | Tan/gold hexagonal solar wings, upright Pancam mast with binocular cameras, 6 rocker-bogie cleated wheels, rear high-gain dish. Salvaged: power bus bay open, dimmed panels. | CC0 |
| `eq_insight` | InSight Geophysical Station (2018) | `wreck_insight` | `wreck_insight_stripped` | Octagonal white MLI deck, 3 landing struts, twin circular dark-blue UltraFlex solar arrays, copper SEIS seismometer dome on ground with tether ribbon. Salvaged: dome removed, gyro bay open. | CC0 |
| `eq_spirit` | Spirit Rover at Gusev Crater (2004) | `wreck_spirit` | `wreck_spirit_stripped` | MER chassis with red-orange Gusev volcanic dust coating, stuck right-front wheel tilted in sand rut, visible titanium suspension link, striped mast. Salvaged: link removed, wheel collapsed. | CC0 |
| `eq_deep_space_dish` | Deep Space Relay Array | `wreck_deep_space_dish` | `wreck_deep_space_dish_stripped` | Parabolic metallic white dish tilted toward sky, central quadripod feedhorn, triangular steel lattice truss tower on concrete piers, equipment shelter. Salvaged: transponder extracted. | CC0 |
| `eq_phoenix` | Phoenix Polar Ice Lander (2008) | `wreck_phoenix` | `wreck_phoenix_stripped` | Arctic lander on 3 shock struts with frost glints, twin circular solar wings, articulated robotic arm (RA) digging into an excavated trench exposing pure water ice. Salvaged: thermal core removed. | CC0 |
| `eq_lrv_buggy` | Apollo Lunar Roving Vehicle (1972) | `wreck_lrv_buggy` | `wreck_lrv_buggy_stripped` | Open tubular aluminum buggy frame, orange Kapton blankets, two mesh lawn-chair seats with headrests, T-handle console, forward gold umbrella dish, spun wire-mesh wheels. Salvaged: actuators extracted. | CC0 |
| `eq_surveyor` | Surveyor 3 Surface Sampler (1967) | `wreck_surveyor` | `wreck_surveyor_stripped` | Triangular tubular aluminum tripod frame, 3 crushable footpads, planar solar panel on mast, Apollo 12 retrieved TV camera, scissor-arm soil scoop in dirt. Salvaged: camera & scoop retrieved. | CC0 |

### 2. World Visual Cleanup & Defect Resolutions
- **Identified and Fixed Lime-Green Rectangles**:
  - *Root Cause*: `prop_cactus` in `src/world/biomes.ts` had a placeholder sheet mapping with `tint: '#84cc16'` in `atlas.ts`, rendering solid neon-green 16&times;20 px rectangles across desert tiles near InSight.
  - *Fix*: Replaced `prop_cactus` with `prop_sand_ventifact` (an authentic wind-carved desert rock with desert varnish) and grounded all grassland/savanna palettes to hardy olive/lichen tones (`#365314`, `#4d7c0f`, `#65a30d`).
- **Smoothed Snow Biome Borders**:
  - *Root Cause*: High-contrast binary 4&times;4 Bayer dither jumping from dark red regolith (`#9c3f25`) directly to bright cyan-white snow (`#dff0f8`) produced a harsh, checkerboard staircase.
  - *Fix*: Replaced with soft organic scalloped permafrost curves (`tile_border_mars_snow`, `tile_border_snow_mars`, `tile_border_sand_snow`) using chilled tundra base tones (`#8a3c28`, `#cde4f0`) and added `decor_snow_drift` and `decor_frost_rim`.
- **Mars Plains Variety & Landmarks**:
  - Added non-blocking geological landmarks across the rocky regolith wastes:
    - `decor_dune_ridge`: Sinuous wind-sculpted sand ripple wave.
    - `decor_crater_ring`: Raised-rim circular crater with impact ejecta rays.
    - `decor_dust_devil_track`: Curved dark swirling trail revealing basalt under surface dust.
    - `decor_riverbed_gravel`: Sinuous dried paleochannel gravel bed.
    - `prop_outcrop_cluster`: Multi-spire basalt rock outcrop formation.
  - Preserved full BFS reachability from spawn to all 8 wrecks and the ship.




