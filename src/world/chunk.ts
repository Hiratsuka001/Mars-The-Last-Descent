/**
 * Chunk Management & Procedural Chunk Generation
 * 32x32 tiles per chunk, pre-rendered to an offscreen canvas for optimal performance.
 */

import { atlas } from '../render/atlas';
import { PerlinNoise2D, SeededRNG } from './noise';
import { BiomeType, BIOMES, getBiomeAt, PropSpawnRule } from './biomes';

export const TILE_SIZE = 16;
export const CHUNK_SIZE = 32;
export const CHUNK_PIXEL_SIZE = CHUNK_SIZE * TILE_SIZE; // 512 px

export interface WorldProp {
  id: string;
  x: number;          // World pixel X (centered on tile)
  y: number;          // World pixel Y (base / feet for Y-sorting)
  tileX: number;
  tileY: number;
  spriteKey: string;
  blocksMovement: boolean;
  width: number;
  height: number;
  offsetY?: number;
}

export interface GroundDecoration {
  x: number;          // World tile X
  y: number;          // World tile Y
  spriteKey: string;
}

export interface ChunkData {
  cx: number;
  cy: number;
  tiles: string[][];       // 32x32 sprite keys
  biomes: BiomeType[][];   // 32x32 biome types
  decorations: GroundDecoration[]; // non-blocking ground details baked on chunk canvas
  props: WorldProp[];      // entities / obstacles in this chunk
  canvas: HTMLCanvasElement | null;
  isPrerendered: boolean;
}

export class WorldChunkManager {
  public seed: string | number;
  private elevNoise: PerlinNoise2D;
  private moistNoise: PerlinNoise2D;
  private tempNoise: PerlinNoise2D;
  private clusterNoise: PerlinNoise2D;
  private patchNoise: PerlinNoise2D;
  private decorNoise: PerlinNoise2D;
  private chunks: Map<string, ChunkData> = new Map();

  constructor(seed: string | number = 4242) {
    this.seed = seed;
    this.elevNoise = new PerlinNoise2D(`${seed}_elev`);
    this.moistNoise = new PerlinNoise2D(`${seed}_moist`);
    this.tempNoise = new PerlinNoise2D(`${seed}_temp`);
    this.clusterNoise = new PerlinNoise2D(`${seed}_prop_cluster`);
    this.patchNoise = new PerlinNoise2D(`${seed}_patch`);
    this.decorNoise = new PerlinNoise2D(`${seed}_decor`);
  }

  public getChunkKey(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  public getChunk(cx: number, cy: number): ChunkData {
    const key = this.getChunkKey(cx, cy);
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = this.generateChunk(cx, cy);
      this.chunks.set(key, chunk);
    }
    return chunk;
  }

  /**
   * Helper to sample raw biome config at any world tile coordinate
   * Uses low frequency noise for large, coherent continental-scale biomes
   */
  public sampleRawBiome(worldTileX: number, worldTileY: number) {
    // Low frequency: biomes span 60-150 tiles with smooth transitions
    const elevation = this.elevNoise.fbm(worldTileX * 0.005, worldTileY * 0.005, 2, 0.4, 2.0);
    const moisture = this.moistNoise.fbm(worldTileX * 0.006, worldTileY * 0.006, 2, 0.4, 2.0);
    const temperature = this.tempNoise.fbm(worldTileX * 0.004, worldTileY * 0.004, 2, 0.4, 2.0);
    return getBiomeAt(elevation, moisture, temperature);
  }

  /**
   * Generates tiles and props for chunk (cx, cy)
   * Applies majority smoothing to remove isolated 1-tile speckles
   */
  private generateChunk(cx: number, cy: number): ChunkData {
    const tiles: string[][] = [];
    const biomes: BiomeType[][] = [];
    const props: WorldProp[] = [];

    // Step 1: Sample raw biomes including a 1-tile perimeter for seamless boundary smoothing
    const rawBiomes: BiomeType[][] = [];
    for (let py = -1; py <= CHUNK_SIZE; py++) {
      const row: BiomeType[] = [];
      for (let px = -1; px <= CHUNK_SIZE; px++) {
        const wx = cx * CHUNK_SIZE + px;
        const wy = cy * CHUNK_SIZE + py;
        row.push(this.sampleRawBiome(wx, wy).id);
      }
      rawBiomes.push(row);
    }

    // Step 2: Cellular majority smoothing pass to eliminate isolated 1-tile speckles
    const smoothedBiomes: BiomeType[][] = [];
    for (let y = 0; y < CHUNK_SIZE; y++) {
      const sRow: BiomeType[] = [];
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const center = rawBiomes[y + 1][x + 1];
        
        // Count surrounding 8 neighbors
        const neighborCounts: Record<string, number> = {};
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nBiome = rawBiomes[y + 1 + dy][x + 1 + dx];
            neighborCounts[nBiome] = (neighborCounts[nBiome] || 0) + 1;
          }
        }

        // If center is an isolated 1-tile speckle surrounded by >= 6 neighbors of another biome
        let majorityBiome: BiomeType = center;
        for (const [b, count] of Object.entries(neighborCounts)) {
          if (count >= 6 && b !== center) {
            majorityBiome = b as BiomeType;
            break;
          }
        }
        sRow.push(majorityBiome);
      }
      smoothedBiomes.push(sRow);
    }

    // Step 3: Tile selection with biome transition borders, ground variation patches,
    // and shoreline edge tile placement for lakes
    const decorations: GroundDecoration[] = [];

    for (let y = 0; y < CHUNK_SIZE; y++) {
      const tileRow: string[] = [];
      const biomeRow: BiomeType[] = [];

      for (let x = 0; x < CHUNK_SIZE; x++) {
        const worldTileX = cx * CHUNK_SIZE + x;
        const worldTileY = cy * CHUNK_SIZE + y;
        const biomeId = smoothedBiomes[y][x];
        const biome = BIOMES[biomeId];
        biomeRow.push(biomeId);

        const tileRng = new SeededRNG(`${this.seed}_${worldTileX}_${worldTileY}`);
        const roll = tileRng.next();

        // Check orthogonal neighbors for transition borders
        const upBiome = y > 0 ? smoothedBiomes[y - 1][x] : rawBiomes[0][x + 1];
        const downBiome = y < CHUNK_SIZE - 1 ? smoothedBiomes[y + 1][x] : rawBiomes[CHUNK_SIZE + 1][x + 1];
        const leftBiome = x > 0 ? smoothedBiomes[y][x - 1] : rawBiomes[y + 1][0];
        const rightBiome = x < CHUNK_SIZE - 1 ? smoothedBiomes[y][x + 1] : rawBiomes[y + 1][CHUNK_SIZE + 1];

        let tileKey = biome.baseTile;

        // Shoreline edge detection for water
        if (biomeId === 'water') {
          const upIsWater = upBiome === 'water';
          const downIsWater = downBiome === 'water';
          const leftIsWater = leftBiome === 'water';
          const rightIsWater = rightBiome === 'water';

          if (!upIsWater || !downIsWater || !leftIsWater || !rightIsWater) {
            tileKey = biome.variantTile || 'tile_water_shallow';
          } else {
            tileKey = roll > 0.85 ? (biome.variantTile || 'tile_water_shallow') : biome.baseTile;
          }
        } else {
          // Check for land-to-land biome borders (Bayer dither transitions)
          const neighbors = [upBiome, downBiome, leftBiome, rightBiome];
          const hasNeighbor = (target: BiomeType) => neighbors.some(n => n === target);

          let isBorder = false;
          if (biomeId === 'rocky') {
            if (hasNeighbor('desert')) {
              tileKey = 'tile_border_mars_sand';
              isBorder = true;
            } else if (hasNeighbor('grassland')) {
              tileKey = 'tile_border_mars_grass';
              isBorder = true;
            } else if (hasNeighbor('snow')) {
              tileKey = 'tile_border_mars_snow';
              isBorder = true;
            }
          } else if (biomeId === 'desert') {
            if (hasNeighbor('grassland')) {
              tileKey = 'tile_border_sand_grass';
              isBorder = true;
            } else if (hasNeighbor('rocky')) {
              tileKey = 'tile_border_mars_sand';
              isBorder = true;
            } else if (hasNeighbor('snow')) {
              tileKey = 'tile_border_sand_snow';
              isBorder = true;
            }
          } else if (biomeId === 'snow') {
            if (hasNeighbor('rocky') || hasNeighbor('desert')) {
              tileKey = 'tile_border_snow_mars';
              isBorder = true;
            }
          }

          if (!isBorder) {
            // Interior land tile: check for tonal variation patches (lighter/darker blobs)
            const patchSample = this.patchNoise.fbm(worldTileX * 0.1, worldTileY * 0.1, 2, 0.5, 2.0);
            if (patchSample > 0.62) {
              if (biomeId === 'rocky') {
                tileKey = patchSample > 0.74 ? 'tile_mars_light_patch' : 'tile_mars_dark_patch';
              } else if (biomeId === 'desert') {
                tileKey = 'tile_sand_dark_patch';
              } else if (biomeId === 'grassland') {
                tileKey = 'tile_grass_dark_patch';
              } else if (biomeId === 'snow') {
                tileKey = 'tile_snow_dark_patch';
              }
            } else {
              // Standard weighted base / variant / accent
              if (roll > 0.85 && biome.variantTile) {
                if (roll > 0.95 && biome.accentTile) {
                  tileKey = biome.accentTile;
                } else {
                  tileKey = biome.variantTile;
                }
              }
            }
          }
        }
        tileRow.push(tileKey);

        // ==========================================
        // GROUND DECORATION OVERLAYS (Clustered & Non-blocking)
        // ==========================================
        const distFromSpawn = Math.hypot(worldTileX, worldTileY);
        const isNearSpawn = distFromSpawn < 8;

        const distFromShip = Math.hypot(worldTileX - 3, worldTileY - 3);
        const isNearShip = distFromShip < 4.5;

        if (!isNearSpawn && !isNearShip && biomeId !== 'water') {
          // Cluster noise for ground detail patches
          const decorSample = this.decorNoise.fbm(worldTileX * 0.14, worldTileY * 0.14, 2, 0.5, 2.0);
          if (decorSample > 0.56) {
            const decorRoll = tileRng.next();
            if (decorRoll < 0.40) { // 40% density inside clusters
              let decorKey: string | null = null;
              const subRoll = tileRng.next();

              if (biomeId === 'rocky') {
                if (subRoll < 0.20) decorKey = 'decor_mars_crater';
                else if (subRoll < 0.38) decorKey = 'decor_dune_ridge';
                else if (subRoll < 0.52) decorKey = 'decor_dust_devil_track';
                else if (subRoll < 0.66) decorKey = 'decor_riverbed_gravel';
                else if (subRoll < 0.82) decorKey = 'decor_mars_rubble';
                else if (subRoll < 0.92) decorKey = 'decor_crater_ring';
                else decorKey = 'decor_mars_fissure';
              } else if (biomeId === 'desert') {
                if (subRoll < 0.50) decorKey = 'decor_sand_ripple';
                else if (subRoll < 0.80) decorKey = 'decor_sand_pebbles';
                else decorKey = 'decor_sand_scrub';
              } else if (biomeId === 'grassland') {
                if (subRoll < 0.25) decorKey = 'decor_grass_flower_red';
                else if (subRoll < 0.50) decorKey = 'decor_grass_flower_yellow';
                else if (subRoll < 0.70) decorKey = 'decor_grass_flower_white';
                else decorKey = 'decor_grass_tuft';
              } else if (biomeId === 'snow') {
                if (subRoll < 0.30) decorKey = 'decor_snow_shard';
                else if (subRoll < 0.55) decorKey = 'decor_snow_mound';
                else if (subRoll < 0.78) decorKey = 'decor_snow_drift';
                else decorKey = 'decor_frost_rim';
              }

              if (decorKey) {
                decorations.push({
                  x: worldTileX,
                  y: worldTileY,
                  spriteKey: decorKey,
                });
              }
            }
          }
        }

        // ==========================================
        // PROP PLACEMENT (Sparse & Clustered)
        // ==========================================
        if (!isNearSpawn && !isNearShip && biomeId !== 'water' && biome.props.length > 0) {
          // Prop cluster noise: group trees and rocks into natural groves with open space between them
          const clusterSample = this.clusterNoise.fbm(worldTileX * 0.08, worldTileY * 0.08, 2, 0.5, 2.0);
          const inCluster = clusterSample > 0.52;

          if (inCluster) {
            const propRoll = tileRng.next();
            if (propRoll < biome.propDensity * 2.5) { // spawn only inside clusters
              const chosenProp = this.pickWeightedProp(biome.props, tileRng.next());
              if (chosenProp) {
                const worldPx = worldTileX * TILE_SIZE + TILE_SIZE / 2;
                const worldPy = worldTileY * TILE_SIZE + TILE_SIZE; // base of tile

                props.push({
                  id: `prop_${worldTileX}_${worldTileY}`,
                  x: worldPx,
                  y: worldPy,
                  tileX: worldTileX,
                  tileY: worldTileY,
                  spriteKey: chosenProp.spriteKey,
                  blocksMovement: chosenProp.blocksMovement,
                  width: chosenProp.width,
                  height: chosenProp.height,
                  offsetY: chosenProp.offsetY,
                });
              }
            }
          }
        }
      }

      tiles.push(tileRow);
      biomes.push(biomeRow);
    }

    return {
      cx,
      cy,
      tiles,
      biomes,
      decorations,
      props,
      canvas: null,
      isPrerendered: false,
    };
  }

  private pickWeightedProp(rules: PropSpawnRule[], roll: number): PropSpawnRule | null {
    const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
    let target = roll * totalWeight;
    for (const rule of rules) {
      if (target <= rule.weight) {
        return rule;
      }
      target -= rule.weight;
    }
    return rules[0] || null;
  }

  /**
   * Pre-renders chunk terrain to offscreen canvas
   */
  public prerenderChunk(chunk: ChunkData): HTMLCanvasElement {
    if (chunk.canvas && chunk.isPrerendered) {
      return chunk.canvas;
    }

    const canvas = chunk.canvas || document.createElement('canvas');
    canvas.width = CHUNK_PIXEL_SIZE;
    canvas.height = CHUNK_PIXEL_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    ctx.imageSmoothingEnabled = false;

    // Pass 1: Base & border ground tiles
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const spriteKey = chunk.tiles[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        atlas.drawSprite(ctx, spriteKey, px, py, TILE_SIZE, TILE_SIZE);
      }
    }

    // Pass 2: Ground decoration overlays (baked directly onto chunk canvas)
    if (chunk.decorations && chunk.decorations.length > 0) {
      for (const decor of chunk.decorations) {
        const lx = ((decor.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const ly = ((decor.y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        atlas.drawSprite(ctx, decor.spriteKey, lx * TILE_SIZE, ly * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    chunk.canvas = canvas;
    chunk.isPrerendered = true;
    return canvas;
  }

  /**
   * Invalidate offscreen canvases if assets finish loading
   */
  public invalidateAllCanvases(): void {
    for (const chunk of this.chunks.values()) {
      chunk.isPrerendered = false;
    }
  }

  /**
   * Prune distant chunks and release canvas memory to prevent memory leaks during long walks
   */
  public cleanupDistantChunks(playerCx: number, playerCy: number, maxChunkRadius: number = 4): void {
    if (this.chunks.size <= 36) return;
    for (const [key, chunk] of this.chunks.entries()) {
      const dx = Math.abs(chunk.cx - playerCx);
      const dy = Math.abs(chunk.cy - playerCy);
      if (dx > maxChunkRadius || dy > maxChunkRadius) {
        if (chunk.canvas) {
          chunk.canvas.width = 0;
          chunk.canvas.height = 0;
          chunk.canvas = null;
        }
        this.chunks.delete(key);
      }
    }
  }

  public getTileBiome(tileX: number, tileY: number): BiomeType {
    if (typeof tileX !== 'number' || typeof tileY !== 'number' || isNaN(tileX) || isNaN(tileY)) {
      return 'rocky';
    }
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.biomes[localY][localX];
  }

  public getTileKey(tileX: number, tileY: number): string {
    if (typeof tileX !== 'number' || typeof tileY !== 'number' || isNaN(tileX) || isNaN(tileY)) {
      return 'tile_dirt_0';
    }
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);
    const localX = ((tileX % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((tileY % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk.tiles[localY][localX];
  }

  public getPropAt(tileX: number, tileY: number): WorldProp | undefined {
    if (typeof tileX !== 'number' || typeof tileY !== 'number' || isNaN(tileX) || isNaN(tileY)) {
      return undefined;
    }
    const cx = Math.floor(tileX / CHUNK_SIZE);
    const cy = Math.floor(tileY / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cy);
    return chunk.props.find((p) => p.tileX === tileX && p.tileY === tileY);
  }
}

