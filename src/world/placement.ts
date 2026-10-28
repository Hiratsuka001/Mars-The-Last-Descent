/**
 * Deterministic Equipment Placement & Reachability Validation
 */

import { EquipmentDefinition, EQUIPMENT_DEFINITIONS } from '../data/equipment';
import { ScienceSampleDefinition, SCIENCE_SAMPLES } from '../data/samples';
import { LandmarkDefinition, LANDMARK_DEFINITIONS } from '../data/landmarks';
import { WorldChunkManager, TILE_SIZE } from './chunk';
import { SeededRNG } from './noise';

export const MIN_EQUIPMENT_DISTANCE = 18; // Minimum tiles between pieces
export const PLAY_RADIUS_TILES = 120;     // Max placement radius from spawn

export interface EquipmentDebris {
  relX: number;
  relY: number;
  spriteKey: string;
}

export interface PlacedEquipment {
  def: EquipmentDefinition;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  distanceFromSpawn: number;
  debris: EquipmentDebris[];
}

export interface PlacedSample {
  id: string;
  def: ScienceSampleDefinition;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  distanceFromSpawn: number;
}

export interface PlacedLandmark {
  id: string;
  def: LandmarkDefinition;
  tileX: number;
  tileY: number;
  worldX: number;
  worldY: number;
  distanceFromSpawn: number;
  widthTiles: number;
  heightTiles: number;
}

// Distance rings for progressive placement
interface RingTarget {
  id: string;
  minDist: number;
  maxDist: number;
}

const PLACEMENT_RINGS: RingTarget[] = [
  { id: 'eq_sojourner', minDist: 16, maxDist: 24 },       // Early quick win
  { id: 'eq_opportunity', minDist: 26, maxDist: 42 },     // Close exploration
  { id: 'eq_insight', minDist: 38, maxDist: 55 },         // Mid exploration
  { id: 'eq_spirit', minDist: 48, maxDist: 68 },          // Mid-far
  { id: 'eq_deep_space_dish', minDist: 58, maxDist: 80 }, // Outer array
  { id: 'eq_phoenix', minDist: 68, maxDist: 95 },         // Polar / distant
  { id: 'eq_lrv_buggy', minDist: 78, maxDist: 105 },      // Far expedition
  { id: 'eq_surveyor', minDist: 88, maxDist: 120 },       // Deep frontier
];

export class EquipmentPlacementSystem {
  private seed: string | number;
  private world: WorldChunkManager;
  private spawnTileX: number;
  private spawnTileY: number;
  private placedEquipment: PlacedEquipment[] = [];
  private placedSamples: PlacedSample[] = [];
  private placedLandmarks: PlacedLandmark[] = [];
  private reachableTiles: Set<number> = new Set();
  private isGenerated = false;
  private isSamplesGenerated = false;
  private isLandmarksGenerated = false;

  constructor(seed: string | number, world: WorldChunkManager, spawnTileX: number, spawnTileY: number) {
    this.seed = seed;
    this.world = world;
    this.spawnTileX = spawnTileX;
    this.spawnTileY = spawnTileY;
  }

  private encodeCoord(x: number, y: number): number {
    return ((x + 2048) << 16) | ((y + 2048) & 0xffff);
  }

  private decodeCoord(encoded: number): { x: number; y: number } {
    const x = (encoded >> 16) - 2048;
    const y = (encoded & 0xffff) - 2048;
    return { x, y };
  }

  /**
   * Pre-calculates reachable walkable tiles from spawn via BFS flood-fill
   */
  private computeReachableSet(maxRadius: number): void {
    const queue: [number, number][] = [[this.spawnTileX, this.spawnTileY]];
    const startKey = this.encodeCoord(this.spawnTileX, this.spawnTileY);
    this.reachableTiles.add(startKey);

    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1],
      [1, 1], [-1, 1], [1, -1], [-1, -1]
    ];

    while (queue.length > 0) {
      const [currX, currY] = queue.shift()!;
      const distFromSpawn = Math.hypot(currX - this.spawnTileX, currY - this.spawnTileY);

      if (distFromSpawn >= maxRadius) continue;

      for (const [dx, dy] of dirs) {
        const nx = currX + dx;
        const ny = currY + dy;
        const key = this.encodeCoord(nx, ny);

        if (!this.reachableTiles.has(key)) {
          const biome = this.world.getTileBiome(nx, ny);
          if (biome !== 'water') {
            this.reachableTiles.add(key);
            queue.push([nx, ny]);
          }
        }
      }
    }
  }

  /**
   * Generate deterministic placement of all equipment
   */
  public generate(): PlacedEquipment[] {
    if (this.isGenerated) {
      return this.placedEquipment;
    }

    this.computeReachableSet(280);
    const rng = new SeededRNG(`${this.seed}_equip_placement`);

    for (const ring of PLACEMENT_RINGS) {
      const def = EQUIPMENT_DEFINITIONS[ring.id];
      if (!def) continue;

      let bestCandidate: { x: number; y: number; score: number } | null = null;

      // Sample 60 candidate positions within the target ring
      for (let attempt = 0; attempt < 60; attempt++) {
        const angle = rng.next() * Math.PI * 2;
        const dist = ring.minDist + rng.next() * (ring.maxDist - ring.minDist);
        const candidateX = Math.round(this.spawnTileX + Math.cos(angle) * dist);
        const candidateY = Math.round(this.spawnTileY + Math.sin(angle) * dist);

        // 1. Must be reachable via flood-fill from spawn
        const key = this.encodeCoord(candidateX, candidateY);
        if (!this.reachableTiles.has(key)) {
          continue;
        }

        // 2. Must not be in water
        const biome = this.world.getTileBiome(candidateX, candidateY);
        if (biome === 'water') {
          continue;
        }

        // 3. Minimum distance spacing to all already-placed equipment
        let tooClose = false;
        for (const existing of this.placedEquipment) {
          const d = Math.hypot(candidateX - existing.tileX, candidateY - existing.tileY);
          if (d < MIN_EQUIPMENT_DISTANCE) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Score candidate (biome preference match gets high score)
        let score = 100;
        if (def.preferredBiomes.includes(biome)) {
          score += 150;
        }

        if (!bestCandidate || score > bestCandidate.score) {
          bestCandidate = { x: candidateX, y: candidateY, score };
        }
      }

      if (bestCandidate) {
        const dist = Math.hypot(bestCandidate.x - this.spawnTileX, bestCandidate.y - this.spawnTileY);
        
        // Generate deterministic ground debris & scorch around wreck
        const debris: EquipmentDebris[] = [
          { relX: -8, relY: -8, spriteKey: 'decor_scorch_crater' },
          { relX: 10, relY: -6, spriteKey: 'decor_metal_scrap' },
          { relX: -14, relY: 2, spriteKey: 'decor_metal_scrap' },
        ];
        // If it's a wheeled rover/buggy, add tire ruts
        if (ring.id.includes('sojourner') || ring.id.includes('opportunity') || ring.id.includes('spirit') || ring.id.includes('buggy')) {
          debris.push({ relX: -16, relY: 6, spriteKey: 'decor_tire_track' });
          debris.push({ relX: 12, relY: 8, spriteKey: 'decor_tire_track' });
        }

        this.placedEquipment.push({
          def,
          tileX: bestCandidate.x,
          tileY: bestCandidate.y,
          worldX: bestCandidate.x * TILE_SIZE + TILE_SIZE / 2,
          worldY: bestCandidate.y * TILE_SIZE + TILE_SIZE,
          distanceFromSpawn: Math.round(dist),
          debris,
        });

        // Clear blocking props in 2-tile radius around equipment
        this.clearPropsAround(bestCandidate.x, bestCandidate.y, 2);
      } else {
        console.warn(`[Placement] Could not find valid reachable position for ${def.name}`);
      }
    }

    this.isGenerated = true;
    return this.placedEquipment;
  }

  /**
   * Remove any blocking props inside radius around equipment
   */
  private clearPropsAround(centerX: number, centerY: number, radius: number): void {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const tx = centerX + dx;
        const ty = centerY + dy;
        const cx = Math.floor(tx / 32);
        const cy = Math.floor(ty / 32);
        const chunk = this.world.getChunk(cx, cy);
        chunk.props = chunk.props.filter((p) => p.tileX !== tx || p.tileY !== ty);
      }
    }
  }

  public getEquipmentAt(tileX: number, tileY: number): PlacedEquipment | undefined {
    return this.placedEquipment.find((e) => e.tileX === tileX && e.tileY === tileY);
  }

  public getEquipmentList(): PlacedEquipment[] {
    if (!this.isGenerated) {
      this.generate();
    }
    return this.placedEquipment;
  }

  public generateSamples(): PlacedSample[] {
    if (this.isSamplesGenerated) return this.placedSamples;
    if (!this.isGenerated) this.generate();

    const rng = new SeededRNG(typeof this.seed === 'number' ? this.seed + 9999 : this.seed + '_samples');
    const sampleKeys = Object.keys(SCIENCE_SAMPLES);
    const targetSamplesCount = 18; // 3 of each of 6 types
    this.placedSamples = [];

    const existingCoords: [number, number][] = this.placedEquipment.map((e) => [e.tileX, e.tileY]);

    for (let i = 0; i < targetSamplesCount; i++) {
      const defKey = sampleKeys[i % sampleKeys.length];
      const def = SCIENCE_SAMPLES[defKey];
      const minDist = 12 + i * 4;
      const maxDist = minDist + 24;

      let bestCand: { x: number; y: number } | null = null;

      // 1. Radial stochastic search within preferred biomes
      for (let attempt = 0; attempt < 80; attempt++) {
        const angle = rng.next() * Math.PI * 2;
        const dist = minDist + rng.next() * (maxDist - minDist + (attempt > 40 ? (attempt - 40) * 1.5 : 0));
        const cx = Math.round(this.spawnTileX + Math.cos(angle) * dist);
        const cy = Math.round(this.spawnTileY + Math.sin(angle) * dist);

        if (!this.reachableTiles.has(this.encodeCoord(cx, cy))) continue;
        const biome = this.world.getTileBiome(cx, cy);
        if (biome === 'water') continue;

        // Strictly enforce preferred biomes (e.g. Cryo-Ice Core ONLY in snow, Stromatolite ONLY in grassland)
        if (!def.preferredBiomes.includes(biome)) continue;

        // Check distance to existing equipment and samples
        const tooClose = existingCoords.some(([ex, ey]) => Math.hypot(cx - ex, cy - ey) < 6);
        if (tooClose) continue;

        bestCand = { x: cx, y: cy };
        break;
      }

      // 2. Deterministic reachableTiles fallback if radial search did not find preferred biome
      if (!bestCand) {
        const matchingTiles: { x: number; y: number; dist: number }[] = [];
        for (const encoded of this.reachableTiles) {
          const { x, y } = this.decodeCoord(encoded);
          const biome = this.world.getTileBiome(x, y);
          if (def.preferredBiomes.includes(biome) && biome !== 'water') {
            const tooClose = existingCoords.some(([ex, ey]) => Math.hypot(x - ex, y - ey) < 3.5);
            if (!tooClose) {
              const d = Math.hypot(x - this.spawnTileX, y - this.spawnTileY);
              matchingTiles.push({ x, y, dist: d });
            }
          }
        }
        if (matchingTiles.length === 0) {
          // Relax spacing if biome area is compact
          for (const encoded of this.reachableTiles) {
            const { x, y } = this.decodeCoord(encoded);
            const biome = this.world.getTileBiome(x, y);
            if (def.preferredBiomes.includes(biome) && biome !== 'water') {
              const tooClose = existingCoords.some(([ex, ey]) => ex === x && ey === y);
              if (!tooClose) {
                const d = Math.hypot(x - this.spawnTileX, y - this.spawnTileY);
                matchingTiles.push({ x, y, dist: d });
              }
            }
          }
        }
        if (matchingTiles.length > 0) {
          matchingTiles.sort((a, b) => Math.abs(a.dist - minDist) - Math.abs(b.dist - minDist));
          const pickIndex = Math.floor(rng.next() * Math.min(matchingTiles.length, 12));
          bestCand = { x: matchingTiles[pickIndex].x, y: matchingTiles[pickIndex].y };
        }
      }

      // 3. Outward search in reachableTiles if preferred biome is located in farther regions
      if (!bestCand) {
        for (let r = minDist; r <= 280; r += 4) {
          const numSamples = Math.max(16, Math.floor(r * 0.75));
          const angleStep = (Math.PI * 2) / numSamples;
          const angleOffset = rng.next() * Math.PI * 2;
          for (let step = 0; step < numSamples; step++) {
            const angle = angleOffset + step * angleStep;
            const sx = Math.round(this.spawnTileX + Math.cos(angle) * r);
            const sy = Math.round(this.spawnTileY + Math.sin(angle) * r);
            if (!this.reachableTiles.has(this.encodeCoord(sx, sy))) continue;
            const biome = this.world.getTileBiome(sx, sy);
            if (def.preferredBiomes.includes(biome) && biome !== 'water') {
              const tooClose = existingCoords.some(([ex, ey]) => Math.hypot(sx - ex, sy - ey) < 3);
              if (!tooClose) {
                bestCand = { x: sx, y: sy };
                break;
              }
            }
          }
          if (bestCand) break;
        }
      }

      if (bestCand) {
        existingCoords.push([bestCand.x, bestCand.y]);
        this.clearPropsAround(bestCand.x, bestCand.y, 0);
        this.placedSamples.push({
          id: `sample_${def.id}_${i}`,
          def,
          tileX: bestCand.x,
          tileY: bestCand.y,
          worldX: bestCand.x * TILE_SIZE + TILE_SIZE / 2,
          worldY: bestCand.y * TILE_SIZE + TILE_SIZE,
          distanceFromSpawn: Math.round(Math.hypot(bestCand.x - this.spawnTileX, bestCand.y - this.spawnTileY)),
        });
      }
    }

    this.isSamplesGenerated = true;
    return this.placedSamples;
  }

  public getSampleList(): PlacedSample[] {
    if (!this.isSamplesGenerated) {
      this.generateSamples();
    }
    return this.placedSamples;
  }

  /**
   * Deterministic placement of 5 large Martian landmarks (6-10 tiles wide)
   * Placed away from ship (>22 tiles), away from wrecks (>14 tiles), away from each other (>20 tiles),
   * and verified reachable from spawn via BFS flood-fill.
   */
  public generateLandmarks(): PlacedLandmark[] {
    if (this.isLandmarksGenerated) return this.placedLandmarks;
    if (!this.isGenerated) this.generate();

    const rng = new SeededRNG(typeof this.seed === 'number' ? this.seed + 77777 : this.seed + '_landmarks');
    const landmarkKeys = Object.keys(LANDMARK_DEFINITIONS);
    this.placedLandmarks = [];

    // Avoid spawn, equipment, and other landmarks
    const avoidCoords: [number, number, number][] = [
      [this.spawnTileX, this.spawnTileY, 24], // keep >= 24 tiles from ship spawn
      ...this.placedEquipment.map((e): [number, number, number] => [e.tileX, e.tileY, 15]), // keep >= 15 tiles from wrecks
    ];

    for (let i = 0; i < landmarkKeys.length; i++) {
      const defKey = landmarkKeys[i];
      const def = LANDMARK_DEFINITIONS[defKey];
      // Progressive exploration distance: 28 to 110 tiles
      const minDist = 26 + i * 16;
      const maxDist = minDist + 24;

      let bestCand: { x: number; y: number; score: number } | null = null;

      for (let attempt = 0; attempt < 80; attempt++) {
        const angle = rng.next() * Math.PI * 2;
        const dist = minDist + rng.next() * (maxDist - minDist);
        const cx = Math.round(this.spawnTileX + Math.cos(angle) * dist);
        const cy = Math.round(this.spawnTileY + Math.sin(angle) * dist);

        // 1. Must be reachable via flood-fill from spawn
        if (!this.reachableTiles.has(this.encodeCoord(cx, cy))) continue;

        // 2. Must not be in water
        const biome = this.world.getTileBiome(cx, cy);
        if (biome === 'water') continue;

        // 3. Must be away from ship, wrecks, and other landmarks
        const tooClose = avoidCoords.some(([ax, ay, minAllowed]) => Math.hypot(cx - ax, cy - ay) < minAllowed);
        if (tooClose) continue;

        let score = 100;
        if (def.preferredBiomes.includes(biome)) score += 200;

        if (!bestCand || score > bestCand.score) {
          bestCand = { x: cx, y: cy, score };
          if (score >= 300) break; // optimal biome match found
        }
      }

      if (bestCand) {
        avoidCoords.push([bestCand.x, bestCand.y, 22]);
        const dist = Math.round(Math.hypot(bestCand.x - this.spawnTileX, bestCand.y - this.spawnTileY));
        this.placedLandmarks.push({
          id: def.id,
          def,
          tileX: bestCand.x,
          tileY: bestCand.y,
          worldX: bestCand.x * TILE_SIZE + (def.widthTiles * TILE_SIZE) / 2,
          worldY: bestCand.y * TILE_SIZE + def.heightTiles * TILE_SIZE,
          distanceFromSpawn: dist,
          widthTiles: def.widthTiles,
          heightTiles: def.heightTiles,
        });

        // Clear blocking props in landmark footprint so it has an open vista
        this.clearPropsAround(bestCand.x, bestCand.y, Math.ceil(def.widthTiles / 2) + 1);
      }
    }

    this.isLandmarksGenerated = true;
    return this.placedLandmarks;
  }

  public getLandmarksList(): PlacedLandmark[] {
    if (!this.isLandmarksGenerated) {
      this.generateLandmarks();
    }
    return this.placedLandmarks;
  }
}

