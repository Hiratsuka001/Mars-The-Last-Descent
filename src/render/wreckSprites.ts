import { ProceduralTileConfig } from './proceduralTiles';

/**
 * Pixel-Art Wreck & Salvage Sprites (36x36 footprint)
 * High-fidelity, historically authentic representations of NASA Mars/Moon exploration missions:
 * 1. Pathfinder & Sojourner (1997)
 * 2. Opportunity Rover (2004)
 * 3. InSight Geophysical Station (2018)
 * 4. Spirit Rover at Gusev Crater (2004)
 * 5. Deep Space Relay Array (DSN Parabolic Antenna)
 * 6. Phoenix Polar Ice Lander (2008)
 * 7. Apollo Lunar Roving Vehicle (1972)
 * 8. Surveyor 3 Surface Sampler (1967)
 *
 * Each equipment piece has:
 * - AVAILABLE state: intact, operational hardware, glistening components, telemetry lights
 * - STRIPPED state: salvaged hardware, harvested subsystems, weathered/dusty post-salvage appearance
 */

type Pixel = { x: number; y: number; color: string };

function box(x1: number, y1: number, x2: number, y2: number, color: string): Pixel[] {
  const pxs: Pixel[] = [];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      pxs.push({ x, y, color });
    }
  }
  return pxs;
}

function lineH(x1: number, x2: number, y: number, color: string): Pixel[] {
  const pxs: Pixel[] = [];
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (let x = minX; x <= maxX; x++) {
    pxs.push({ x, y, color });
  }
  return pxs;
}

function lineV(x: number, y1: number, y2: number, color: string): Pixel[] {
  const pxs: Pixel[] = [];
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (let y = minY; y <= maxY; y++) {
    pxs.push({ x, y, color });
  }
  return pxs;
}

// ============================================================================
// 1. SOJOURNER & PATHFINDER (1997)
// Triangular petal lander base + tiny 6-wheel microrover with APXS sensor
// ============================================================================
function buildSojourner(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow
  p.push(...box(6, 32, 30, 34, 'rgba(0, 0, 0, 0.45)'));

  // --- Pathfinder Lander Triangular Base & Petals ---
  const foilColor = isStripped ? '#78350f' : '#b45309';
  const foilHighlight = isStripped ? '#92400e' : '#f59e0b';
  const solarCell = isStripped ? '#1c1917' : '#1e3a8a';
  const panelRim = isStripped ? '#441a03' : '#d97706';

  // Left open petal
  p.push(...box(6, 26, 13, 31, panelRim));
  p.push(...box(7, 27, 12, 30, solarCell));
  p.push(...lineH(7, 12, 27, foilHighlight));

  // Right open petal
  p.push(...box(23, 26, 30, 31, panelRim));
  p.push(...box(24, 27, 29, 30, solarCell));
  p.push(...lineH(24, 29, 27, foilHighlight));

  // Center tetrahedral electronics bay
  p.push(...box(13, 20, 23, 28, isStripped ? '#334155' : '#cbd5e1'));
  p.push(...box(14, 21, 22, 27, isStripped ? '#1e293b' : '#f1f5f9'));
  p.push(...box(15, 22, 21, 26, foilColor));
  p.push(...lineH(14, 22, 20, foilHighlight));

  // Pathfinder antenna mast & low gain omni
  p.push(...lineV(18, 11, 19, '#94a3b8'));
  p.push({ x: 18, y: 10, color: isStripped ? '#475569' : '#38bdf8' }); // antenna tip

  // Deploy ramp leading to ground
  p.push(...box(16, 26, 20, 31, '#475569'));
  p.push(...lineH(17, 19, 28, '#64748b'));
  p.push(...lineH(17, 19, 30, '#334155'));

  // --- Sojourner Microrover (rolling off right side of ramp) ---
  if (!isStripped) {
    // Intact tiny microrover
    // 6 Wheels (3 visible front, 3 back)
    p.push({ x: 21, y: 32, color: '#09090b' }, { x: 22, y: 32, color: '#27272a' });
    p.push({ x: 25, y: 32, color: '#09090b' }, { x: 26, y: 32, color: '#27272a' });
    p.push({ x: 28, y: 32, color: '#09090b' }, { x: 29, y: 32, color: '#27272a' });

    // Chassis & Rocker-Bogie Linkage
    p.push(...box(21, 28, 28, 30, '#cbd5e1'));
    p.push(...lineH(22, 27, 27, '#f8fafc'));
    p.push(...lineH(22, 27, 30, '#64748b'));

    // Flat solar panel top (blue GaAs cells)
    p.push(...box(21, 26, 28, 27, '#0284c7'));
    p.push(...lineH(22, 27, 26, '#38bdf8'));

    // Front stereoscopic camera / APXS sensor head
    p.push({ x: 29, y: 26, color: '#e2e8f0' });
    p.push({ x: 29, y: 27, color: '#06b6d4' }); // blue optic lens
    p.push({ x: 21, y: 24, color: '#10b981' }); // status antenna
    p.push({ x: 21, y: 25, color: '#94a3b8' });
  } else {
    // Stripped rover: drive motor extracted, wheels collapsed, open chassis
    p.push({ x: 22, y: 33, color: '#09090b' });
    p.push({ x: 27, y: 33, color: '#09090b' });
    // Tipped chassis
    p.push(...box(21, 29, 27, 31, '#475569'));
    p.push(...box(23, 28, 25, 30, '#1e293b')); // motor bay empty
    p.push({ x: 28, y: 30, color: '#334155' });
    // Detached motor gear scrap lying beside
    p.push({ x: 30, y: 32, color: '#ca8a04' }, { x: 31, y: 32, color: '#78350f' });
  }

  return p;
}

// ============================================================================
// 2. OPPORTUNITY ROVER (2004)
// Gold/tan solar wings, upright Pancam mast, 6 rocker-bogie wheels
// ============================================================================
function buildOpportunity(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow
  p.push(...box(5, 31, 31, 33, 'rgba(0, 0, 0, 0.45)'));

  // --- Rocker-Bogie Suspension & 6 Cleated Wheels ---
  const wheelColor = '#18181b';
  const rimColor = '#52525b';
  const strutColor = isStripped ? '#334155' : '#94a3b8';

  // Left 3 Wheels
  p.push(...box(5, 29, 8, 32, wheelColor));
  p.push({ x: 6, y: 30, color: rimColor }, { x: 7, y: 30, color: '#a1a1aa' });

  p.push(...box(11, 29, 14, 32, wheelColor));
  p.push({ x: 12, y: 30, color: rimColor }, { x: 13, y: 30, color: '#a1a1aa' });

  p.push(...box(17, 29, 20, 32, wheelColor));
  p.push({ x: 18, y: 30, color: rimColor }, { x: 19, y: 30, color: '#a1a1aa' });

  // Right 3 Wheels (visible in perspective)
  p.push(...box(23, 29, 26, 32, wheelColor));
  p.push({ x: 24, y: 30, color: rimColor }, { x: 25, y: 30, color: '#a1a1aa' });

  p.push(...box(28, 29, 31, 32, wheelColor));
  p.push({ x: 29, y: 30, color: rimColor }, { x: 30, y: 30, color: '#a1a1aa' });

  // Suspension struts linking wheels to body
  p.push(...lineH(8, 12, 28, strutColor));
  p.push(...lineH(14, 18, 27, strutColor));
  p.push(...lineH(20, 24, 28, strutColor));
  p.push(...lineH(26, 29, 28, strutColor));

  // --- Rover Central Body ---
  p.push(...box(9, 22, 27, 26, isStripped ? '#334155' : '#cbd5e1'));
  p.push(...lineH(10, 26, 22, isStripped ? '#475569' : '#f1f5f9'));
  p.push(...lineH(10, 26, 26, '#475569'));

  // --- Solar Array Wings (Hexagonal Deck) ---
  const solarGold = isStripped ? '#78350f' : '#d97706';
  const solarHigh = isStripped ? '#451a03' : '#f59e0b';
  const solarGrid = isStripped ? '#292524' : '#1e3a8a';

  p.push(...box(6, 17, 30, 21, solarGold));
  p.push(...lineH(7, 29, 17, solarHigh));
  // Cell grid lines
  for (let x = 8; x <= 28; x += 4) {
    p.push(...lineV(x, 18, 20, solarGrid));
  }

  // --- Pancam Mast & Optics ---
  p.push(...lineV(14, 7, 16, '#94a3b8'));
  p.push(...lineV(15, 7, 16, '#64748b'));

  if (!isStripped) {
    // Twin Panoramic Camera Head
    p.push(...box(12, 5, 17, 7, '#334155'));
    p.push({ x: 13, y: 6, color: '#38bdf8' }, { x: 16, y: 6, color: '#38bdf8' }); // lenses
    p.push({ x: 14, y: 5, color: '#f8fafc' }, { x: 15, y: 5, color: '#f8fafc' });

    // Rear High Gain Dish
    p.push(...box(23, 14, 26, 16, '#cbd5e1'));
    p.push({ x: 24, y: 13, color: '#e2e8f0' }, { x: 25, y: 13, color: '#e2e8f0' });
    p.push({ x: 27, y: 12, color: '#94a3b8' }); // antenna pin

    // Miniature Thermal Emission Spectrometer
    p.push(...box(10, 23, 12, 25, '#ca8a04'));
  } else {
    // Stripped: Power bus cavity exposed, mast tilted, lenses cracked
    p.push(...box(16, 18, 21, 20, '#1c1917')); // harvested power bus
    p.push({ x: 17, y: 19, color: '#ea580c' });  // wire stub
    p.push(...box(12, 6, 16, 8, '#1e293b'));    // damaged camera head
    p.push({ x: 13, y: 7, color: '#475569' });
    p.push({ x: 24, y: 15, color: '#475569' });  // bent antenna
  }

  return p;
}

// ============================================================================
// 3. INSIGHT GEOPHYSICAL STATION (2018)
// Hexagonal lander body, dual round UltraFlex solar arrays, copper SEIS dome
// ============================================================================
function buildInSight(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow
  p.push(...box(4, 30, 32, 33, 'rgba(0, 0, 0, 0.45)'));

  // --- 3 Landing Struts with Footpads ---
  const strut = '#64748b';
  const pad = '#334155';
  p.push(...lineV(10, 24, 29, strut));
  p.push(...box(8, 30, 11, 31, pad));

  p.push(...lineV(18, 25, 30, strut));
  p.push(...box(17, 31, 20, 32, pad));

  p.push(...lineV(26, 24, 29, strut));
  p.push(...box(25, 30, 28, 31, pad));

  // --- Central Lander Hexagonal Body ---
  p.push(...box(12, 17, 24, 24, isStripped ? '#475569' : '#cbd5e1'));
  p.push(...box(13, 18, 23, 23, isStripped ? '#334155' : '#f1f5f9'));
  p.push(...lineH(13, 23, 17, '#ffffff'));
  p.push(...lineH(13, 23, 24, '#64748b'));

  // Instrument deck details (TWINS wind sensor mast, UHF antenna)
  p.push(...lineV(22, 9, 16, '#94a3b8'));
  p.push({ x: 22, y: 8, color: isStripped ? '#475569' : '#38bdf8' });

  // --- Twin Circular Decagonal Solar Arrays (UltraFlex) ---
  const solarBlue = isStripped ? '#1c1917' : '#1e3a8a';
  const solarHigh = isStripped ? '#292524' : '#2563eb';
  const ribColor = isStripped ? '#44403c' : '#93c5fd';

  // Left Circular Array
  p.push(...box(3, 17, 10, 24, solarBlue));
  p.push(...box(4, 16, 9, 25, solarBlue));
  p.push(...lineH(4, 9, 16, solarHigh));
  p.push(...lineV(3, 18, 23, solarHigh));
  // Radial ribs
  p.push({ x: 6, y: 19, color: ribColor }, { x: 7, y: 22, color: ribColor });

  // Right Circular Array
  p.push(...box(26, 17, 33, 24, solarBlue));
  p.push(...box(27, 16, 32, 25, solarBlue));
  p.push(...lineH(27, 32, 16, solarHigh));
  p.push(...lineV(33, 18, 23, solarHigh));
  // Radial ribs
  p.push({ x: 30, y: 19, color: ribColor }, { x: 29, y: 22, color: ribColor });

  // --- SEIS Seismometer (Dome Shield) on Ground ---
  if (!isStripped) {
    // Copper/gold rounded Wind and Thermal Shield dome
    p.push(...box(6, 26, 13, 30, '#b45309'));
    p.push(...box(7, 25, 12, 29, '#d97706'));
    p.push(...box(8, 24, 11, 27, '#f59e0b'));
    p.push({ x: 9, y: 24, color: '#fef08a' }, { x: 10, y: 24, color: '#fef08a' }); // sun glint
    p.push(...lineH(6, 13, 30, '#78350f'));

    // Tether ribbon connecting SEIS back to lander
    p.push({ x: 11, y: 25, color: '#ea580c' }, { x: 12, y: 24, color: '#ea580c' }, { x: 13, y: 23, color: '#ea580c' });

    // Robotic Arm (IDA) deployed toward SEIS
    p.push({ x: 14, y: 20, color: '#64748b' }, { x: 13, y: 21, color: '#94a3b8' }, { x: 12, y: 22, color: '#cbd5e1' });
  } else {
    // Stripped: SEIS dome removed, revealing empty sensor mount plate
    p.push(...box(7, 28, 12, 30, '#1c1917'));
    p.push(...box(8, 29, 11, 29, '#292524'));
    p.push({ x: 9, y: 29, color: '#0369a1' }); // exposed sensor port
    // Severed ribbon
    p.push({ x: 12, y: 27, color: '#7c2d12' });
  }

  return p;
}

// ============================================================================
// 4. SPIRIT ROVER AT GUSEV CRATER (2004)
// Dust-red coated MER rover, tilted stuck right wheel, exposed suspension
// ============================================================================
function buildSpirit(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow & deep rut under stuck wheel
  p.push(...box(5, 31, 31, 33, 'rgba(0, 0, 0, 0.45)'));
  // Rut dug into soil by dragged wheel
  p.push(...box(26, 30, 32, 33, '#3f170e'));

  // --- 6 Wheels with Stuck Front-Right Wheel ---
  const wheelDark = '#18181b';

  // Left 3 Wheels (intact)
  p.push(...box(5, 29, 8, 32, wheelDark));
  p.push({ x: 6, y: 30, color: '#7f1d1d' }, { x: 7, y: 30, color: '#991b1b' }); // red dust coating

  p.push(...box(11, 29, 14, 32, wheelDark));
  p.push({ x: 12, y: 30, color: '#7f1d1d' }, { x: 13, y: 30, color: '#991b1b' });

  p.push(...box(17, 29, 20, 32, wheelDark));
  p.push({ x: 18, y: 30, color: '#7f1d1d' }, { x: 19, y: 30, color: '#991b1b' });

  // Right Rear & Mid Wheels
  p.push(...box(22, 28, 25, 31, wheelDark));
  p.push({ x: 23, y: 29, color: '#7f1d1d' });

  // THE FAMOUS STUCK RIGHT-FRONT WHEEL (tilted at 35 degrees into the sand)
  p.push(...box(27, 28, 30, 31, '#18181b'));
  p.push(...box(28, 29, 31, 32, '#27272a'));
  p.push({ x: 29, y: 30, color: '#dc2626' }); // red dust accumulation on jammed hub
  p.push({ x: 30, y: 31, color: '#b91c1c' });

  // Titanium Suspension Linkage (clearly visible on side)
  if (!isStripped) {
    p.push(...lineH(19, 25, 26, '#e2e8f0')); // gleaming titanium link
    p.push(...lineH(19, 24, 27, '#94a3b8'));
    p.push({ x: 25, y: 27, color: '#cbd5e1' });
  } else {
    // Stripped: titanium suspension link removed, wheel collapsed further
    p.push({ x: 19, y: 26, color: '#334155' }, { x: 25, y: 27, color: '#1e293b' }); // bolt holes
    p.push(...box(27, 30, 31, 33, '#09090b')); // collapsed wheel
  }

  // --- Dust-Coated Rover Body ---
  p.push(...box(9, 22, 27, 26, isStripped ? '#3f170e' : '#7c2d12'));
  p.push(...lineH(10, 26, 22, isStripped ? '#581c0c' : '#991b1b'));

  // --- Solar Wings with Gusev Red Dust Coating ---
  p.push(...box(6, 17, 30, 21, isStripped ? '#451a03' : '#9a3412'));
  p.push(...lineH(7, 29, 17, isStripped ? '#292524' : '#c2410c'));
  // Dust streaks across solar cells
  p.push(...lineH(9, 14, 18, '#b45309'));
  p.push(...lineH(17, 23, 19, '#78350f'));

  // --- Pancam Mast & Weathered Flag ---
  p.push(...lineV(14, 8, 16, '#64748b'));
  p.push(...box(12, 6, 16, 8, '#334155'));
  p.push({ x: 13, y: 7, color: isStripped ? '#475569' : '#0284c7' });
  p.push({ x: 15, y: 7, color: isStripped ? '#475569' : '#0284c7' });
  // Antenna mast with warning/hazard ribbon
  p.push(...lineV(24, 10, 16, '#94a3b8'));
  p.push({ x: 24, y: 11, color: '#ef4444' }); // red marker flag

  return p;
}

// ============================================================================
// 5. DEEP SPACE RELAY ARRAY (DSN Parabolic Antenna)
// Parabolic dish bowl on triangular lattice truss tower with feedhorn
// ============================================================================
function buildDeepSpaceDish(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Foundation ground shadow
  p.push(...box(8, 32, 28, 34, 'rgba(0, 0, 0, 0.45)'));

  // --- Steel Lattice Pylon Mast & Footings ---
  const truss = isStripped ? '#334155' : '#64748b';
  const trussHighlight = isStripped ? '#475569' : '#94a3b8';

  // 3 Concrete Foundation Pier Blocks
  p.push(...box(9, 31, 12, 33, '#1e293b'));
  p.push(...box(16, 32, 20, 34, '#1e293b'));
  p.push(...box(24, 31, 27, 33, '#1e293b'));

  // Lattice legs converging up to central pivot at (18, 20)
  p.push({ x: 11, y: 30, color: truss }, { x: 12, y: 28, color: truss }, { x: 13, y: 26, color: truss }, { x: 14, y: 24, color: truss }, { x: 15, y: 22, color: truss });
  p.push({ x: 25, y: 30, color: truss }, { x: 24, y: 28, color: truss }, { x: 23, y: 26, color: truss }, { x: 22, y: 24, color: truss }, { x: 21, y: 22, color: truss });
  p.push(...lineV(18, 21, 31, trussHighlight));

  // Lattice cross struts
  p.push(...lineH(13, 23, 27, truss));
  p.push(...lineH(14, 22, 24, truss));

  // Central Transceiver Equipment Shelter Box
  p.push(...box(15, 26, 21, 31, isStripped ? '#1e293b' : '#334155'));
  p.push(...box(16, 27, 20, 30, isStripped ? '#0f172a' : '#475569'));
  if (!isStripped) {
    p.push({ x: 17, y: 28, color: '#38bdf8' }, { x: 18, y: 28, color: '#22c55e' }); // telemetry LEDs
  } else {
    p.push(...box(17, 28, 19, 29, '#09090b')); // open cavity where transponder was extracted
  }

  // --- Parabolic Dish Gimbal Pivot ---
  p.push(...box(16, 18, 20, 21, '#475569'));

  // --- Large Parabolic Dish Bowl (Tilted upward at sky) ---
  const dishWhite = isStripped ? '#94a3b8' : '#f8fafc';
  const dishShadow = isStripped ? '#475569' : '#cbd5e1';
  const dishRim = isStripped ? '#334155' : '#64748b';

  // Parabolic curved reflector surface
  p.push(...box(8, 8, 28, 17, dishShadow));
  p.push(...box(7, 9, 29, 16, dishShadow));
  p.push(...box(9, 7, 27, 16, dishWhite));
  p.push(...box(10, 6, 26, 15, dishWhite));
  p.push(...box(12, 5, 24, 14, dishWhite));

  // Concentric panel segment rings
  p.push(...lineH(11, 25, 10, dishShadow));
  p.push(...lineH(13, 23, 13, dishShadow));

  // Outer Dish Rim
  p.push(...lineH(12, 24, 4, dishRim));
  p.push({ x: 9, y: 6, color: dishRim }, { x: 10, y: 5, color: dishRim });
  p.push({ x: 27, y: 6, color: dishRim }, { x: 26, y: 5, color: dishRim });
  p.push(...lineV(6, 10, 15, dishRim));
  p.push(...lineV(30, 10, 15, dishRim));

  // --- Quadripod Subreflector & Feedhorn ---
  if (!isStripped) {
    // Struts meeting at subreflector apex
    p.push({ x: 11, y: 8, color: '#475569' }, { x: 14, y: 6, color: '#475569' }, { x: 16, y: 4, color: '#475569' });
    p.push({ x: 25, y: 8, color: '#475569' }, { x: 22, y: 6, color: '#475569' }, { x: 20, y: 4, color: '#475569' });

    // Subreflector cone & Microwave Feedhorn
    p.push(...box(17, 2, 19, 4, '#cbd5e1'));
    p.push({ x: 18, y: 1, color: '#38bdf8' }); // active transmission glint
    p.push({ x: 18, y: 5, color: '#06b6d4' }); // feedhorn nozzle
  } else {
    // Stripped: Strut bent/broken, feedhorn disconnected
    p.push({ x: 12, y: 9, color: '#334155' }, { x: 14, y: 8, color: '#334155' });
    p.push({ x: 20, y: 6, color: '#334155' }, { x: 21, y: 8, color: '#1e293b' });
  }

  return p;
}

// ============================================================================
// 6. PHOENIX POLAR ICE LANDER (2008)
// Arctic lander on 3 struts, solar arrays, robotic arm digging ice trench
// ============================================================================
function buildPhoenix(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow & excavated ice trench
  p.push(...box(5, 30, 31, 33, 'rgba(0, 0, 0, 0.45)'));

  // --- Subsurface Water Ice Trench (Excavated in Arctic Permafrost) ---
  p.push(...box(17, 30, 27, 33, '#1c1917')); // trench shadow depression
  p.push(...box(18, 31, 26, 32, '#38bdf8')); // exposed glacier ice
  p.push(...box(19, 31, 25, 32, '#e0f2fe')); // bright white-blue water ice crystals
  p.push({ x: 20, y: 31, color: '#ffffff' }, { x: 24, y: 31, color: '#ffffff' });

  // --- 3 Landing Struts with Shock Absorbers ---
  const strutColor = '#64748b';
  p.push(...lineV(9, 23, 28, strutColor));
  p.push(...box(8, 29, 10, 30, '#334155')); // left footpad

  p.push(...lineV(17, 24, 29, strutColor));
  p.push(...box(16, 30, 18, 31, '#334155')); // center footpad

  p.push(...lineV(27, 23, 28, strutColor));
  p.push(...box(26, 29, 28, 30, '#334155')); // right footpad

  // Frost / Cryo Rime on lower struts
  p.push({ x: 8, y: 28, color: '#e0f2fe' }, { x: 10, y: 27, color: '#bae6fd' });
  p.push({ x: 26, y: 28, color: '#e0f2fe' }, { x: 28, y: 27, color: '#bae6fd' });

  // --- Octagonal Thermal Lander Deck ---
  p.push(...box(11, 16, 25, 23, isStripped ? '#475569' : '#cbd5e1'));
  p.push(...box(12, 17, 24, 22, isStripped ? '#334155' : '#f8fafc'));
  p.push(...lineH(12, 24, 16, '#ffffff'));
  p.push(...lineH(12, 24, 23, '#64748b'));

  // Meteorological lidar mast
  p.push(...lineV(14, 9, 15, '#94a3b8'));
  p.push({ x: 14, y: 8, color: isStripped ? '#475569' : '#10b981' }); // green lidar laser

  // --- Dual Circular Solar Arrays (with ice glints) ---
  const solarBlue = isStripped ? '#1c1917' : '#1e3a8a';
  const solarHigh = isStripped ? '#292524' : '#2563eb';

  // Left Array
  p.push(...box(3, 17, 10, 23, solarBlue));
  p.push(...box(4, 16, 9, 24, solarBlue));
  p.push(...lineH(4, 9, 16, solarHigh));
  p.push({ x: 4, y: 17, color: '#e0f2fe' }, { x: 5, y: 23, color: '#e0f2fe' }); // frost rims

  // Right Array
  p.push(...box(26, 17, 33, 23, solarBlue));
  p.push(...box(27, 16, 32, 24, solarBlue));
  p.push(...lineH(27, 32, 16, solarHigh));
  p.push({ x: 32, y: 17, color: '#e0f2fe' }, { x: 31, y: 23, color: '#e0f2fe' });

  // --- Robotic Arm (RA) with Excavation Scoop ---
  if (!isStripped) {
    // Articulated robotic arm extending down into the ice trench
    p.push({ x: 19, y: 21, color: '#94a3b8' });
    p.push({ x: 20, y: 22, color: '#cbd5e1' });
    p.push({ x: 21, y: 23, color: '#cbd5e1' });
    p.push({ x: 22, y: 24, color: '#94a3b8' });
    p.push({ x: 22, y: 25, color: '#64748b' });
    p.push({ x: 23, y: 26, color: '#cbd5e1' });
    p.push({ x: 23, y: 27, color: '#cbd5e1' });
    p.push({ x: 22, y: 28, color: '#94a3b8' });

    // Stainless steel soil scoop digging into trench
    p.push(...box(21, 29, 23, 31, '#f1f5f9'));
    p.push({ x: 22, y: 30, color: '#38bdf8' }); // sampled ice in scoop

    // Thermal distribution core glowing in center deck
    p.push(...box(17, 18, 19, 20, '#0284c7'));
    p.push({ x: 18, y: 19, color: '#38bdf8' });
  } else {
    // Stripped: thermal core extracted, robotic arm limp
    p.push(...box(17, 18, 19, 20, '#0f172a')); // empty thermal core bay
    p.push({ x: 20, y: 24, color: '#475569' }, { x: 21, y: 26, color: '#334155' }, { x: 22, y: 29, color: '#1e293b' });
  }

  return p;
}

// ============================================================================
// 7. APOLLO LUNAR ROVING VEHICLE (LRV, 1972)
// Open tubular buggy, wire mesh wheels, bucket seats, umbrella dish
// ============================================================================
function buildLRV(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow
  p.push(...box(4, 30, 32, 33, 'rgba(0, 0, 0, 0.45)'));

  // --- 4 Spun-Aluminum Wire Mesh Wheels ---
  const meshColor = '#94a3b8';
  const meshDark = '#475569';
  const hubColor = isStripped ? '#334155' : '#38bdf8';

  // Front-Left Wheel
  p.push(...box(4, 25, 9, 31, meshDark));
  p.push(...box(5, 26, 8, 30, meshColor));
  p.push({ x: 6, y: 28, color: hubColor }, { x: 7, y: 28, color: hubColor }); // high-torque actuator

  // Rear-Left Wheel
  p.push(...box(26, 25, 31, 31, meshDark));
  p.push(...box(27, 26, 30, 30, meshColor));
  p.push({ x: 28, y: 28, color: hubColor }, { x: 29, y: 28, color: hubColor });

  // Front-Right & Rear-Right Wheels (recessed behind)
  p.push(...box(8, 22, 12, 27, '#334155'));
  p.push(...box(23, 22, 27, 27, '#334155'));

  // --- Open Tubular Aluminum Buggy Chassis ---
  p.push(...box(9, 24, 27, 27, '#cbd5e1'));
  p.push(...lineH(8, 28, 24, '#f8fafc'));
  p.push(...lineH(9, 27, 27, '#64748b'));

  // Orange Kapton thermal foil under front equipment deck
  p.push(...box(9, 21, 14, 23, isStripped ? '#78350f' : '#ea580c'));
  p.push(...lineH(10, 13, 21, isStripped ? '#451a03' : '#f97316'));

  // --- Twin Lawn-Chair Bucket Seats with Headrests ---
  // Left Seat
  p.push(...box(15, 15, 19, 23, '#475569'));
  p.push(...box(16, 16, 18, 22, '#94a3b8'));
  p.push(...lineH(16, 18, 14, '#cbd5e1')); // headrest

  // Right Seat
  p.push(...box(21, 15, 25, 23, '#475569'));
  p.push(...box(22, 16, 24, 22, '#94a3b8'));
  p.push(...lineH(22, 24, 14, '#cbd5e1')); // headrest

  // Center T-Handle Steering Console
  p.push(...lineV(20, 17, 22, '#f8fafc'));
  p.push(...lineH(19, 21, 17, '#0284c7'));

  // --- Forward High-Gain Umbrella Dish Antenna ---
  if (!isStripped) {
    p.push(...lineV(10, 12, 20, '#cbd5e1')); // antenna mast
    // Gold mesh umbrella dish bowl
    p.push(...box(7, 8, 13, 11, '#ca8a04'));
    p.push(...lineH(8, 12, 7, '#eab308'));
    p.push({ x: 10, y: 6, color: '#fef08a' }); // feedhorn apex

    // 16mm Movie Camera on front right
    p.push(...box(7, 19, 9, 21, '#1e293b'));
    p.push({ x: 6, y: 20, color: '#38bdf8' }); // lens
  } else {
    // Stripped: Actuators removed from wheels, umbrella dish collapsed
    p.push({ x: 7, y: 28, color: '#09090b' }, { x: 29, y: 28, color: '#09090b' }); // hollow wheel hubs
    p.push({ x: 10, y: 16, color: '#475569' }, { x: 11, y: 18, color: '#334155' }); // collapsed mast
    p.push(...box(4, 28, 7, 32, '#18181b')); // tilted wheel
  }

  return p;
}

// ============================================================================
// 8. SURVEYOR 3 SURFACE SAMPLER (1967)
// Triangular tubular tripod, planar solar mast, robotic scoop sampler arm
// ============================================================================
function buildSurveyor(isStripped: boolean): Pixel[] {
  const p: Pixel[] = [];

  // Ground shadow & dug sampler trench
  p.push(...box(6, 31, 31, 33, 'rgba(0, 0, 0, 0.45)'));
  p.push(...box(26, 31, 31, 33, '#350e05')); // small regolith test trench

  // --- 3 Landing Tubular Legs with Crushable Footpads ---
  const leg = '#cbd5e1';
  const pad = '#475569';

  // Left Leg
  p.push({ x: 9, y: 29, color: leg }, { x: 10, y: 27, color: leg }, { x: 11, y: 25, color: leg });
  p.push(...box(7, 30, 10, 31, pad));

  // Center Leg
  p.push(...lineV(18, 26, 31, leg));
  p.push(...box(17, 32, 20, 33, pad));

  // Right Leg
  p.push({ x: 27, y: 29, color: leg }, { x: 26, y: 27, color: leg }, { x: 25, y: 25, color: leg });
  p.push(...box(26, 30, 29, 31, pad));

  // --- Triangular Tubular Aluminum Spaceframe Body ---
  p.push(...box(13, 20, 23, 26, isStripped ? '#475569' : '#cbd5e1'));
  p.push(...box(14, 21, 22, 25, isStripped ? '#334155' : '#f8fafc'));
  p.push(...lineH(14, 22, 20, '#ffffff'));
  p.push(...lineH(14, 22, 26, '#64748b'));

  // --- Tall Center Mast & Planar Solar Array ---
  p.push(...lineV(18, 6, 19, '#94a3b8'));
  p.push(...lineV(19, 6, 19, '#64748b'));

  // Rectangular Planar Solar Panel (pointing upward)
  const solarBlue = isStripped ? '#1c1917' : '#1e3a8a';
  const solarHigh = isStripped ? '#292524' : '#2563eb';
  p.push(...box(15, 5, 22, 11, solarBlue));
  p.push(...lineH(15, 22, 5, solarHigh));
  p.push(...lineV(15, 6, 11, solarHigh));

  // Omni-directional antenna cone at mast summit
  p.push({ x: 18, y: 4, color: '#f8fafc' }, { x: 19, y: 4, color: '#f8fafc' });
  p.push({ x: 18, y: 3, color: '#38bdf8' });

  // --- Television Camera & Articulated Sampler Arm ---
  if (!isStripped) {
    // Television Camera Module on Mast (the one Apollo 12 retrieved!)
    p.push(...box(14, 15, 17, 18, '#334155'));
    p.push({ x: 13, y: 16, color: '#38bdf8' }); // camera optical lens

    // Scissor-like Pantograph Surface Sampler Arm
    p.push({ x: 20, y: 23, color: '#94a3b8' }, { x: 21, y: 22, color: '#cbd5e1' });
    p.push({ x: 22, y: 23, color: '#94a3b8' }, { x: 23, y: 24, color: '#cbd5e1' });
    p.push({ x: 24, y: 25, color: '#94a3b8' }, { x: 25, y: 26, color: '#cbd5e1' });
    p.push({ x: 26, y: 27, color: '#94a3b8' }, { x: 27, y: 28, color: '#cbd5e1' });

    // Motorized Scoop digging into regolith
    p.push(...box(27, 29, 30, 31, '#64748b'));
    p.push({ x: 28, y: 30, color: '#cbd5e1' });
    p.push({ x: 29, y: 31, color: '#ca8a04' }); // regolith sample in scoop
  } else {
    // Historically accurate Apollo 12 salvage:
    // TV Camera unbolted (empty mounting bracket remains)
    p.push({ x: 14, y: 16, color: '#1e293b' }, { x: 15, y: 17, color: '#334155' });
    // Sampler arm unbolted at the elbow joint
    p.push({ x: 20, y: 23, color: '#475569' }, { x: 21, y: 24, color: '#1e293b' });
  }

  return p;
}

export const WRECK_SPRITE_DEFS: ProceduralTileConfig[] = [
  // 1. Sojourner & Pathfinder
  {
    key: 'wreck_sojourner',
    name: 'Pathfinder & Sojourner Wreck',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildSojourner(false),
  },
  {
    key: 'wreck_sojourner_stripped',
    name: 'Pathfinder & Sojourner (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildSojourner(true),
  },

  // 2. Opportunity Rover
  {
    key: 'wreck_opportunity',
    name: 'Opportunity Rover',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildOpportunity(false),
  },
  {
    key: 'wreck_opportunity_stripped',
    name: 'Opportunity Rover (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildOpportunity(true),
  },

  // 3. InSight Geophysical Station
  {
    key: 'wreck_insight',
    name: 'InSight Geophysical Station',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildInSight(false),
  },
  {
    key: 'wreck_insight_stripped',
    name: 'InSight Geophysical Station (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildInSight(true),
  },

  // 4. Spirit Rover
  {
    key: 'wreck_spirit',
    name: 'Spirit Rover at Gusev Crater',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildSpirit(false),
  },
  {
    key: 'wreck_spirit_stripped',
    name: 'Spirit Rover (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildSpirit(true),
  },

  // 5. Deep Space Relay Array
  {
    key: 'wreck_deep_space_dish',
    name: 'Deep Space Relay Array',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildDeepSpaceDish(false),
  },
  {
    key: 'wreck_deep_space_dish_stripped',
    name: 'Deep Space Relay Array (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildDeepSpaceDish(true),
  },

  // 6. Phoenix Polar Ice Lander
  {
    key: 'wreck_phoenix',
    name: 'Phoenix Polar Ice Lander',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildPhoenix(false),
  },
  {
    key: 'wreck_phoenix_stripped',
    name: 'Phoenix Polar Ice Lander (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildPhoenix(true),
  },

  // 7. Apollo Lunar Roving Vehicle
  {
    key: 'wreck_lrv_buggy',
    name: 'Apollo Lunar Roving Vehicle',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildLRV(false),
  },
  {
    key: 'wreck_lrv_buggy_stripped',
    name: 'Apollo Lunar Roving Vehicle (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildLRV(true),
  },

  // 8. Surveyor 3 Surface Sampler
  {
    key: 'wreck_surveyor',
    name: 'Surveyor 3 Surface Sampler',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildSurveyor(false),
  },
  {
    key: 'wreck_surveyor_stripped',
    name: 'Surveyor 3 Surface Sampler (Salvaged)',
    biome: 'wreck',
    width: 36,
    height: 36,
    pixels: buildSurveyor(true),
  },
];

