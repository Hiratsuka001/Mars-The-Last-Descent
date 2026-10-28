/**
 * Circular Minimap & Compact Fog-of-War System
 * North-up radar view, 128-byte per chunk bitset fog of war, and offscreen canvas caching.
 */

import { WorldChunkManager, TILE_SIZE } from '../world/chunk';
import { PlacedEquipment, PlacedSample, PlacedLandmark } from '../world/placement';
import { BiomeType } from '../world/biomes';

export const MINIMAP_VIEW_RADIUS = 36;   // Tiles visible in circular HUD radar
export const OVERLAY_VIEW_RADIUS = 110;  // Tiles visible in full map overlay
export const REVEAL_RADIUS_TILES = 18;   // Tiles revealed around player
export const SIGNAL_RANGE_TILES = 45;    // Max distance for faint unrevealed equipment signal blip
export const ENABLE_SIGNAL_BLIP = true;  // Toggle for proximity signal blip

// Biome map pixel colors (8-bit palette)
export const MINIMAP_BIOME_COLORS: Record<BiomeType, string> = {
  rocky: '#a8432b',      // Mars Regolith ochre
  desert: '#d99d57',     // Golden dune sand
  grassland: '#4d8e3b',  // Terraformed bio-green
  snow: '#dff0f8',       // Polar cryo ice
  water: '#1d4ed8',      // Deep basin water (impassable)
};

export interface SerializedFogOfWar {
  version: number;
  revealedCount: number;
  chunks: Record<string, string>; // base64 encoded 128-byte Uint8Array
}

/**
 * High-performance 128-byte per chunk bitset Fog of War
 * 32x32 tiles = 1024 tiles = 128 bytes per chunk.
 */
export class FogOfWarSystem {
  private chunks: Map<string, Uint8Array> = new Map();
  private dirtyChunks: Set<string> = new Set();
  private exploredCount = 0;

  constructor() {}

  public getChunkKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  public isExplored(tileX: number, tileY: number): boolean {
    const cx = Math.floor(tileX / 32);
    const cy = Math.floor(tileY / 32);
    const bitset = this.chunks.get(this.getChunkKey(cx, cy));
    if (!bitset) return false;

    const lx = ((tileX % 32) + 32) % 32;
    const ly = ((tileY % 32) + 32) % 32;
    const bitIdx = ly * 32 + lx;
    const byteIdx = bitIdx >> 3;
    const mask = 1 << (bitIdx & 7);

    return (bitset[byteIdx] & mask) !== 0;
  }

  /**
   * Reveals a circle of tiles around player
   * Returns true if any new tiles were revealed
   */
  public revealArea(centerTileX: number, centerTileY: number, radius = REVEAL_RADIUS_TILES): boolean {
    let newlyRevealed = false;
    const r2 = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      const dy2 = dy * dy;
      const ty = centerTileY + dy;
      const cy = Math.floor(ty / 32);
      const ly = ((ty % 32) + 32) % 32;

      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy2 <= r2) {
          const tx = centerTileX + dx;
          const cx = Math.floor(tx / 32);
          const lx = ((tx % 32) + 32) % 32;
          const key = this.getChunkKey(cx, cy);

          let bitset = this.chunks.get(key);
          if (!bitset) {
            bitset = new Uint8Array(128);
            this.chunks.set(key, bitset);
          }

          const bitIdx = ly * 32 + lx;
          const byteIdx = bitIdx >> 3;
          const mask = 1 << (bitIdx & 7);

          if ((bitset[byteIdx] & mask) === 0) {
            bitset[byteIdx] |= mask;
            this.exploredCount++;
            this.dirtyChunks.add(key);
            newlyRevealed = true;
          }
        }
      }
    }

    return newlyRevealed;
  }

  public getExploredTilesCount(): number {
    return this.exploredCount;
  }

  public getExploredChunksCount(): number {
    return this.chunks.size;
  }

  /**
   * Compact serialization for save game storage
   */
  public serialize(): SerializedFogOfWar {
    const serializedChunks: Record<string, string> = {};
    for (const [key, bitset] of this.chunks.entries()) {
      let binary = '';
      for (let i = 0; i < bitset.length; i++) {
        binary += String.fromCharCode(bitset[i]);
      }
      serializedChunks[key] = btoa(binary);
    }

    return {
      version: 1,
      revealedCount: this.exploredCount,
      chunks: serializedChunks,
    };
  }

  /**
   * Restore explored fog of war from saved data
   */
  public deserialize(data: SerializedFogOfWar): void {
    this.chunks.clear();
    this.dirtyChunks.clear();
    if (!data) return;
    this.exploredCount = data.revealedCount || 0;

    if (data.chunks && typeof data.chunks === 'object') {
      for (const [key, base64] of Object.entries(data.chunks)) {
        try {
          const binary = atob(base64);
          const bitset = new Uint8Array(128);
          for (let i = 0; i < binary.length && i < 128; i++) {
            bitset[i] = binary.charCodeAt(i);
          }
          this.chunks.set(key, bitset);
          this.dirtyChunks.add(key);
        } catch (err) {
          console.warn(`[FogOfWar] Failed to deserialize chunk ${key}:`, err);
        }
      }
    }
  }
}

/**
 * Circular Minimap & Map Overlay Renderer
 */
export class MinimapRenderer {
  private hudCanvas: HTMLCanvasElement;
  private hudCtx: CanvasRenderingContext2D | null;
  private overlayCanvas: HTMLCanvasElement;
  private overlayCtx: CanvasRenderingContext2D | null;

  private lastHudPlayerTileX = -999999;
  private lastHudPlayerTileY = -999999;
  private lastHudUpdateTime = 0;

  private lastOverlayPlayerTileX = -999999;
  private lastOverlayPlayerTileY = -999999;
  private lastOverlayUpdateTime = 0;

  constructor() {
    this.hudCanvas = document.createElement('canvas');
    this.hudCanvas.width = 150;
    this.hudCanvas.height = 150;
    this.hudCtx = this.hudCanvas.getContext('2d', { alpha: true });
    if (this.hudCtx) this.hudCtx.imageSmoothingEnabled = false;

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = 440;
    this.overlayCanvas.height = 440;
    this.overlayCtx = this.overlayCanvas.getContext('2d', { alpha: true });
    if (this.overlayCtx) this.overlayCtx.imageSmoothingEnabled = false;
  }

  /**
   * Renders the terrain & fog onto the offscreen HUD canvas (throttled)
   */
  private updateHudOffscreen(
    world: WorldChunkManager,
    fog: FogOfWarSystem,
    playerTileX: number,
    playerTileY: number
  ): void {
    const ctx = this.hudCtx;
    if (!ctx) return;

    const size = 150;
    const center = size / 2; // 75
    const radius = 72;
    const viewRadius = MINIMAP_VIEW_RADIUS;
    const scale = radius / viewRadius; // pixels per tile (~2px)

    ctx.clearRect(0, 0, size, size);

    // Save and apply circular clip
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    // Dark void background for unexplored fog
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, size, size);

    // Draw explored tiles within view radius
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
      const ty = playerTileY + dy;
      const screenY = Math.round(center + dy * scale);

      for (let dx = -viewRadius; dx <= viewRadius; dx++) {
        const tx = playerTileX + dx;
        const screenX = Math.round(center + dx * scale);

        // Distance from center check
        if (dx * dx + dy * dy <= viewRadius * viewRadius) {
          if (fog.isExplored(tx, ty)) {
            const biome = world.getTileBiome(tx, ty);
            const prop = world.getPropAt(tx, ty);

            if (prop && prop.blocksMovement) {
              ctx.fillStyle = '#261208'; // Dark obstacle shade
            } else {
              ctx.fillStyle = MINIMAP_BIOME_COLORS[biome] || '#a8432b';
            }

            // Draw 2x2 px tile block
            const tilePixelSize = Math.max(2, Math.ceil(scale));
            ctx.fillRect(screenX, screenY, tilePixelSize, tilePixelSize);
          }
        }
      }
    }

    // Soft fog edge radial shadow
    const grad = ctx.createRadialGradient(center, center, radius * 0.75, center, center, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(7, 10, 18, 0.65)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();
  }

  /**
   * Render Round Minimap to target canvas (60 FPS safe with cached terrain)
   */
  public renderHudMinimap(
    targetCtx: CanvasRenderingContext2D,
    world: WorldChunkManager,
    fog: FogOfWarSystem,
    playerX: number,
    playerY: number,
    playerFacing: 'up' | 'down' | 'left' | 'right',
    shipX: number,
    shipY: number,
    equipmentList: PlacedEquipment[],
    completedIds: string[],
    time: number,
    samples?: PlacedSample[],
    collectedSampleIds?: string[],
    revealedSampleGlints?: boolean,
    landmarks?: PlacedLandmark[],
    discoveredLandmarkIds?: string[]
  ): void {
    const playerTileX = Math.floor(playerX / TILE_SIZE);
    const playerTileY = Math.floor(playerY / TILE_SIZE);
    const now = performance.now();

    // Check if offscreen cache needs redraw (tile crossed OR 100ms elapsed)
    if (
      playerTileX !== this.lastHudPlayerTileX ||
      playerTileY !== this.lastHudPlayerTileY ||
      now - this.lastHudUpdateTime > 100
    ) {
      this.updateHudOffscreen(world, fog, playerTileX, playerTileY);
      this.lastHudPlayerTileX = playerTileX;
      this.lastHudPlayerTileY = playerTileY;
      this.lastHudUpdateTime = now;
    }

    const size = 150;
    const center = size / 2;
    const radius = 72;
    const scale = radius / MINIMAP_VIEW_RADIUS;

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;

    // 1. Draw cached terrain & fog
    targetCtx.drawImage(this.hudCanvas, 0, 0);

    // Clip markers to inside radar circle
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.arc(center, center, radius - 1, 0, Math.PI * 2);
    targetCtx.clip();

    // 2. Equipment Markers & Signal Blips
    for (let i = 0; i < equipmentList.length; i++) {
      const eq = equipmentList[i];
      const isDone = completedIds.includes(eq.def.id);
      const isRevealed = fog.isExplored(eq.tileX, eq.tileY);

      const dx = eq.tileX - playerTileX;
      const dy = eq.tileY - playerTileY;
      const distTiles = Math.hypot(dx, dy);

      if (isRevealed && distTiles <= MINIMAP_VIEW_RADIUS) {
        // Explored Equipment Pin
        const mx = center + dx * scale;
        const my = center + dy * scale;

        if (isDone) {
          // Completed: dim hollow grey/green marker
          targetCtx.fillStyle = '#64748b';
          targetCtx.fillRect(mx - 2, my - 2, 4, 4);
          targetCtx.fillStyle = '#22c55e';
          targetCtx.fillRect(mx - 1, my - 1, 2, 2);
        } else {
          // Available: bright golden diamond with pulsing ping
          const pulse = (Math.sin(time * 0.008 + i) + 1) * 0.5;
          targetCtx.fillStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.6})`;
          targetCtx.beginPath();
          targetCtx.arc(mx, my, 3 + pulse * 2, 0, Math.PI * 2);
          targetCtx.fill();

          targetCtx.fillStyle = '#fbbf24';
          targetCtx.fillRect(mx - 2, my - 2, 4, 4);
          targetCtx.fillStyle = '#ffffff';
          targetCtx.fillRect(mx - 1, my - 1, 2, 2);
        }
      } else if (!isRevealed && !isDone && ENABLE_SIGNAL_BLIP && distTiles <= SIGNAL_RANGE_TILES) {
        // Faint Proximity Signal Blip for Unexplored Equipment
        const clampedDist = Math.min(distTiles, MINIMAP_VIEW_RADIUS - 6);
        const angle = Math.atan2(dy, dx);
        const bx = center + Math.cos(angle) * clampedDist * scale;
        const by = center + Math.sin(angle) * clampedDist * scale;

        const pulse = (Math.sin(time * 0.006 + i * 2) + 1) * 0.5;
        if (pulse > 0.3) {
          targetCtx.fillStyle = `rgba(249, 115, 22, ${pulse * 0.7})`;
          targetCtx.font = 'bold 9px monospace';
          targetCtx.textAlign = 'center';
          targetCtx.textBaseline = 'middle';
          targetCtx.fillText('?', bx, by);
        }
      }
    }

    // 2b. Science Sample Glint Dots (revealed for ~6s by Sonar Scan)
    if (revealedSampleGlints && samples) {
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (collectedSampleIds && collectedSampleIds.includes(s.id)) continue;
        const dx = s.tileX - playerTileX;
        const dy = s.tileY - playerTileY;
        const distTiles = Math.hypot(dx, dy);
        if (distTiles <= MINIMAP_VIEW_RADIUS) {
          const mx = center + dx * scale;
          const my = center + dy * scale;
          const pulse = (Math.sin(time * 0.015 + i * 2) + 1) * 0.5;
          targetCtx.fillStyle = `rgba(34, 211, 238, ${0.7 + pulse * 0.3})`;
          targetCtx.beginPath();
          targetCtx.arc(mx, my, 2.5, 0, Math.PI * 2);
          targetCtx.fill();
        }
      }
    }

    // 2c. Discovered Natural Landmarks
    if (landmarks && discoveredLandmarkIds) {
      for (const lm of landmarks) {
        if (!discoveredLandmarkIds.includes(lm.id)) continue;
        const dx = lm.tileX - playerTileX;
        const dy = lm.tileY - playerTileY;
        const distTiles = Math.hypot(dx, dy);
        if (distTiles <= MINIMAP_VIEW_RADIUS - 2) {
          const mx = center + dx * scale;
          const my = center + dy * scale;
          targetCtx.save();
          targetCtx.fillStyle = lm.def.iconColor || '#fbbf24';
          targetCtx.strokeStyle = '#ffffff';
          targetCtx.lineWidth = 1;
          targetCtx.beginPath();
          targetCtx.moveTo(mx, my - 4.5);
          targetCtx.lineTo(mx + 4, my);
          targetCtx.lineTo(mx, my + 4.5);
          targetCtx.lineTo(mx - 4, my);
          targetCtx.closePath();
          targetCtx.fill();
          targetCtx.stroke();
          targetCtx.restore();
        }
      }
    }

    // 3. Spaceship Marker
    const shipTileX = Math.floor(shipX / TILE_SIZE);
    const shipTileY = Math.floor(shipY / TILE_SIZE);
    const shipDx = shipTileX - playerTileX;
    const shipDy = shipTileY - playerTileY;
    const shipDist = Math.hypot(shipDx, shipDy);
    const isShipRevealed = fog.isExplored(shipTileX, shipTileY);
    const allPartsFound = completedIds.length >= 8;

    // Show ship if revealed OR if all parts found (so player can always return)
    if (isShipRevealed || allPartsFound) {
      if (shipDist <= MINIMAP_VIEW_RADIUS - 4) {
        // Inside view radius: Blue shuttle icon with celebration pulse when all parts found
        const sx = center + shipDx * scale;
        const sy = center + shipDy * scale;

        if (allPartsFound) {
          const pulse = (Math.sin(time * 0.009) + 1) * 0.5;
          targetCtx.fillStyle = `rgba(56, 189, 248, ${0.3 + pulse * 0.6})`;
          targetCtx.beginPath();
          targetCtx.arc(sx, sy, 6 + pulse * 5, 0, Math.PI * 2);
          targetCtx.fill();

          targetCtx.fillStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.5})`;
          targetCtx.beginPath();
          targetCtx.arc(sx, sy, 4 + pulse * 2, 0, Math.PI * 2);
          targetCtx.fill();
        }

        targetCtx.fillStyle = allPartsFound ? '#38bdf8' : '#38bdf8';
        targetCtx.beginPath();
        targetCtx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = '#ffffff';
        targetCtx.fillRect(sx - 1, sy - 1, 2, 2);
      } else {
        // Outside view radius: Edge pointer arrow pointing towards ship
        const angle = Math.atan2(shipDy, shipDx);
        const edgeR = radius - 8;
        const ex = center + Math.cos(angle) * edgeR;
        const ey = center + Math.sin(angle) * edgeR;

        targetCtx.save();
        targetCtx.translate(ex, ey);
        targetCtx.rotate(angle);

        if (allPartsFound) {
          const pulse = (Math.sin(time * 0.01) + 1) * 0.5;
          targetCtx.fillStyle = pulse > 0.4 ? '#fbbf24' : '#38bdf8';
        } else {
          targetCtx.fillStyle = '#38bdf8';
        }

        targetCtx.beginPath();
        targetCtx.moveTo(5, 0);
        targetCtx.lineTo(-4, -3.5);
        targetCtx.lineTo(-4, 3.5);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.restore();
      }
    }

    // 4. Player Marker (Center Arrow pointing in facing direction)
    targetCtx.save();
    targetCtx.translate(center, center);

    let rot = 0;
    if (playerFacing === 'right') rot = Math.PI / 2;
    else if (playerFacing === 'down') rot = Math.PI;
    else if (playerFacing === 'left') rot = -Math.PI / 2;

    targetCtx.rotate(rot);

    // Directional chevron
    targetCtx.fillStyle = '#06b6d4';
    targetCtx.beginPath();
    targetCtx.moveTo(0, -6);
    targetCtx.lineTo(4, 4);
    targetCtx.lineTo(0, 2);
    targetCtx.lineTo(-4, 4);
    targetCtx.closePath();
    targetCtx.fill();

    // Center white dot
    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(-1, -1, 2, 2);
    targetCtx.restore();

    targetCtx.restore(); // Restore clip

    // 5. Decorative Sci-Fi Circular Frame & Bezel
    targetCtx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    targetCtx.lineWidth = 4;
    targetCtx.beginPath();
    targetCtx.arc(center, center, radius + 1, 0, Math.PI * 2);
    targetCtx.stroke();

    targetCtx.strokeStyle = '#06b6d4';
    targetCtx.lineWidth = 1.5;
    targetCtx.beginPath();
    targetCtx.arc(center, center, radius, 0, Math.PI * 2);
    targetCtx.stroke();

    // Cardinal North tick and label
    targetCtx.fillStyle = '#f43f5e';
    targetCtx.font = 'bold 8px monospace';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'top';
    targetCtx.fillText('N', center, 3);

    // Subtle tick marks at East, South, West
    targetCtx.fillStyle = '#64748b';
    targetCtx.fillRect(size - 6, center - 1, 4, 2); // E
    targetCtx.fillRect(center - 1, size - 6, 2, 4); // S
    targetCtx.fillRect(2, center - 1, 4, 2);        // W

    targetCtx.restore();
  }

  /**
   * Renders the terrain & fog onto the offscreen Full Map Overlay canvas (throttled)
   */
  private updateOverlayOffscreen(
    world: WorldChunkManager,
    fog: FogOfWarSystem,
    playerTileX: number,
    playerTileY: number
  ): void {
    const ctx = this.overlayCtx;
    if (!ctx) return;

    const size = 440;
    const center = size / 2;
    const radius = 210;
    const viewRadius = OVERLAY_VIEW_RADIUS;
    const scale = radius / viewRadius; // pixels per tile (~1.9px)

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, size, size);

    // Draw all explored tiles within 110-tile radius
    for (let dy = -viewRadius; dy <= viewRadius; dy++) {
      const ty = playerTileY + dy;
      const screenY = Math.round(center + dy * scale);

      for (let dx = -viewRadius; dx <= viewRadius; dx++) {
        const tx = playerTileX + dx;
        const screenX = Math.round(center + dx * scale);

        if (dx * dx + dy * dy <= viewRadius * viewRadius) {
          if (fog.isExplored(tx, ty)) {
            const biome = world.getTileBiome(tx, ty);
            const prop = world.getPropAt(tx, ty);

            if (prop && prop.blocksMovement) {
              ctx.fillStyle = '#261208';
            } else {
              ctx.fillStyle = MINIMAP_BIOME_COLORS[biome] || '#a8432b';
            }

            const pSize = Math.max(2, Math.ceil(scale));
            ctx.fillRect(screenX, screenY, pSize, pSize);
          }
        }
      }
    }

    // Outer edge shadow
    const grad = ctx.createRadialGradient(center, center, radius * 0.8, center, center, radius);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(1, 'rgba(7, 10, 18, 0.7)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    ctx.restore();
  }

  /**
   * Render Enlarged Full Map Overlay (440x440)
   */
  public renderOverlayMap(
    targetCtx: CanvasRenderingContext2D,
    world: WorldChunkManager,
    fog: FogOfWarSystem,
    playerX: number,
    playerY: number,
    playerFacing: 'up' | 'down' | 'left' | 'right',
    shipX: number,
    shipY: number,
    equipmentList: PlacedEquipment[],
    completedIds: string[],
    time: number,
    samples?: PlacedSample[],
    collectedSampleIds?: string[],
    revealedSampleGlints?: boolean,
    landmarks?: PlacedLandmark[],
    discoveredLandmarkIds?: string[]
  ): void {
    const playerTileX = Math.floor(playerX / TILE_SIZE);
    const playerTileY = Math.floor(playerY / TILE_SIZE);
    const now = performance.now();

    if (
      playerTileX !== this.lastOverlayPlayerTileX ||
      playerTileY !== this.lastOverlayPlayerTileY ||
      now - this.lastOverlayUpdateTime > 200
    ) {
      this.updateOverlayOffscreen(world, fog, playerTileX, playerTileY);
      this.lastOverlayPlayerTileX = playerTileX;
      this.lastOverlayPlayerTileY = playerTileY;
      this.lastOverlayUpdateTime = now;
    }

    const size = 440;
    const center = size / 2;
    const radius = 210;
    const scale = radius / OVERLAY_VIEW_RADIUS;

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;

    // 1. Draw cached overlay terrain & fog
    targetCtx.drawImage(this.overlayCanvas, 0, 0);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.arc(center, center, radius - 1, 0, Math.PI * 2);
    targetCtx.clip();

    // 2. Equipment Pins
    for (let i = 0; i < equipmentList.length; i++) {
      const eq = equipmentList[i];
      const isDone = completedIds.includes(eq.def.id);
      const isRevealed = fog.isExplored(eq.tileX, eq.tileY);

      const dx = eq.tileX - playerTileX;
      const dy = eq.tileY - playerTileY;
      const distTiles = Math.hypot(dx, dy);

      if (isRevealed && distTiles <= OVERLAY_VIEW_RADIUS) {
        const mx = center + dx * scale;
        const my = center + dy * scale;

        if (isDone) {
          targetCtx.fillStyle = '#64748b';
          targetCtx.fillRect(mx - 3, my - 3, 6, 6);
          targetCtx.fillStyle = '#22c55e';
          targetCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);
        } else {
          const pulse = (Math.sin(time * 0.008 + i) + 1) * 0.5;
          targetCtx.fillStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.6})`;
          targetCtx.beginPath();
          targetCtx.arc(mx, my, 4 + pulse * 3, 0, Math.PI * 2);
          targetCtx.fill();

          targetCtx.fillStyle = '#fbbf24';
          targetCtx.fillRect(mx - 3, my - 3, 6, 6);
          targetCtx.fillStyle = '#ffffff';
          targetCtx.fillRect(mx - 1.5, my - 1.5, 3, 3);

          // Nametag on enlarged map
          targetCtx.fillStyle = '#e2e8f0';
          targetCtx.font = '9px monospace';
          targetCtx.textAlign = 'center';
          targetCtx.fillText(eq.def.name.split('(')[0].trim(), mx, my - 7);
        }
      } else if (!isRevealed && !isDone && ENABLE_SIGNAL_BLIP && distTiles <= SIGNAL_RANGE_TILES) {
        const angle = Math.atan2(dy, dx);
        const bx = center + Math.cos(angle) * distTiles * scale;
        const by = center + Math.sin(angle) * distTiles * scale;

        const pulse = (Math.sin(time * 0.006 + i * 2) + 1) * 0.5;
        if (pulse > 0.25) {
          targetCtx.fillStyle = `rgba(249, 115, 22, ${pulse * 0.8})`;
          targetCtx.font = 'bold 11px monospace';
          targetCtx.textAlign = 'center';
          targetCtx.textBaseline = 'middle';
          targetCtx.fillText('?', bx, by);
        }
      }
    }

    // 2b. Science Sample Glint Dots (revealed for ~6s by Sonar Scan)
    if (revealedSampleGlints && samples) {
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (collectedSampleIds && collectedSampleIds.includes(s.id)) continue;
        const dx = s.tileX - playerTileX;
        const dy = s.tileY - playerTileY;
        const distTiles = Math.hypot(dx, dy);
        if (distTiles <= OVERLAY_VIEW_RADIUS) {
          const mx = center + dx * scale;
          const my = center + dy * scale;
          const pulse = (Math.sin(time * 0.015 + i * 2) + 1) * 0.5;
          targetCtx.fillStyle = `rgba(34, 211, 238, ${0.7 + pulse * 0.3})`;
          targetCtx.beginPath();
          targetCtx.arc(mx, my, 4, 0, Math.PI * 2);
          targetCtx.fill();
        }
      }
    }

    // 2c. Discovered Natural Landmarks (Full Overlay Map)
    if (landmarks && discoveredLandmarkIds) {
      for (const lm of landmarks) {
        if (!discoveredLandmarkIds.includes(lm.id)) continue;
        const dx = lm.tileX - playerTileX;
        const dy = lm.tileY - playerTileY;
        const distTiles = Math.hypot(dx, dy);
        if (distTiles <= OVERLAY_VIEW_RADIUS - 2) {
          const mx = center + dx * scale;
          const my = center + dy * scale;
          targetCtx.save();
          targetCtx.fillStyle = lm.def.iconColor || '#fbbf24';
          targetCtx.strokeStyle = '#ffffff';
          targetCtx.lineWidth = 1.2;
          targetCtx.beginPath();
          targetCtx.moveTo(mx, my - 6);
          targetCtx.lineTo(mx + 5.5, my);
          targetCtx.lineTo(mx, my + 6);
          targetCtx.lineTo(mx - 5.5, my);
          targetCtx.closePath();
          targetCtx.fill();
          targetCtx.stroke();

          targetCtx.font = 'bold 9px monospace';
          targetCtx.fillStyle = '#f8fafc';
          targetCtx.textAlign = 'center';
          targetCtx.fillText(lm.def.name.split(' ')[0], mx, my + 13);
          targetCtx.restore();
        }
      }
    }

    // 3. Spaceship Landmark
    const shipTileX = Math.floor(shipX / TILE_SIZE);
    const shipTileY = Math.floor(shipY / TILE_SIZE);
    const shipDx = shipTileX - playerTileX;
    const shipDy = shipTileY - playerTileY;
    const isShipRevealed = fog.isExplored(shipTileX, shipTileY);
    const allPartsFound = completedIds.length >= 8;

    if ((isShipRevealed || allPartsFound) && Math.hypot(shipDx, shipDy) <= OVERLAY_VIEW_RADIUS) {
      const sx = center + shipDx * scale;
      const sy = center + shipDy * scale;

      if (allPartsFound) {
        const pulse = (Math.sin(time * 0.009) + 1) * 0.5;
        targetCtx.fillStyle = `rgba(56, 189, 248, ${0.3 + pulse * 0.6})`;
        targetCtx.beginPath();
        targetCtx.arc(sx, sy, 8 + pulse * 6, 0, Math.PI * 2);
        targetCtx.fill();
      }

      targetCtx.fillStyle = '#38bdf8';
      targetCtx.beginPath();
      targetCtx.arc(sx, sy, 5, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.fillStyle = '#ffffff';
      targetCtx.fillRect(sx - 2, sy - 2, 4, 4);

      targetCtx.fillStyle = allPartsFound ? '#fbbf24' : '#38bdf8';
      targetCtx.font = 'bold 9px monospace';
      targetCtx.textAlign = 'center';
      targetCtx.fillText(allPartsFound ? 'SHIP (RETURN TO REPAIR)' : 'CRASHED SHIP', sx, sy - 8);
    }

    // 4. Player Marker
    targetCtx.save();
    targetCtx.translate(center, center);
    let rot = 0;
    if (playerFacing === 'right') rot = Math.PI / 2;
    else if (playerFacing === 'down') rot = Math.PI;
    else if (playerFacing === 'left') rot = -Math.PI / 2;

    targetCtx.rotate(rot);
    targetCtx.fillStyle = '#06b6d4';
    targetCtx.beginPath();
    targetCtx.moveTo(0, -8);
    targetCtx.lineTo(5, 5);
    targetCtx.lineTo(0, 3);
    targetCtx.lineTo(-5, 5);
    targetCtx.closePath();
    targetCtx.fill();

    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(-1.5, -1.5, 3, 3);
    targetCtx.restore();

    targetCtx.restore(); // Restore clip

    // 5. Bezel & Coordinates
    targetCtx.strokeStyle = '#06b6d4';
    targetCtx.lineWidth = 2;
    targetCtx.beginPath();
    targetCtx.arc(center, center, radius, 0, Math.PI * 2);
    targetCtx.stroke();

    targetCtx.fillStyle = '#f43f5e';
    targetCtx.font = 'bold 10px monospace';
    targetCtx.textAlign = 'center';
    targetCtx.fillText('NORTH', center, 8);

    targetCtx.restore();
  }
}

