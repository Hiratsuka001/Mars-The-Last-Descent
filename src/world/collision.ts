/**
 * Collision Resolver & Spatial Obstacle Queries
 */

import { WorldChunkManager, TILE_SIZE } from './chunk';

export interface BoxCollider {
  x: number;      // Center X
  y: number;      // Center Y
  width: number;
  height: number;
}

export class CollisionSystem {
  private world: WorldChunkManager;

  constructor(world: WorldChunkManager) {
    this.world = world;
  }

  /**
   * Check if a specific tile coordinate is impassable
   */
  public isTileBlocked(tileX: number, tileY: number): boolean {
    if (typeof tileX !== 'number' || typeof tileY !== 'number' || isNaN(tileX) || isNaN(tileY)) {
      return true;
    }

    // 1. Water tiles are impassable
    const biome = this.world.getTileBiome(tileX, tileY);
    if (biome === 'water') {
      return true;
    }

    // 2. Check for blocking props on this tile
    const prop = this.world.getPropAt(tileX, tileY);
    if (prop && prop.blocksMovement) {
      return true;
    }

    return false;
  }

  /**
   * Check if a specific tile coordinate is walkable (not blocked)
   */
  public isTileWalkable(tileX: number, tileY: number): boolean {
    return !this.isTileBlocked(tileX, tileY);
  }

  /**
   * Check if a world-space point collides with an obstacle
   */
  public isPointBlocked(worldX: number, worldY: number): boolean {
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    return this.isTileBlocked(tileX, tileY);
  }

  /**
   * Check if an AABB feet hitbox overlaps any blocking tile or prop
   */
  public checkBoxCollision(x: number, y: number, halfW: number, halfH: number): boolean {
    const minTileX = Math.floor((x - halfW) / TILE_SIZE);
    const maxTileX = Math.floor((x + halfW) / TILE_SIZE);
    const minTileY = Math.floor((y - halfH) / TILE_SIZE);
    const maxTileY = Math.floor((y + halfH) / TILE_SIZE);

    for (let ty = minTileY; ty <= maxTileY; ty++) {
      for (let tx = minTileX; tx <= maxTileX; tx++) {
        if (this.isTileBlocked(tx, ty)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Slide-based movement resolution:
   * Moves along X and Y axes independently to allow smooth sliding past walls & props.
   */
  public resolveMovement(
    currentX: number,
    currentY: number,
    desiredVx: number,
    desiredVy: number,
    halfW: number = 5,
    halfH: number = 4
  ): { x: number; y: number; movedX: boolean; movedY: boolean } {
    let nextX = currentX;
    let nextY = currentY;
    let movedX = false;
    let movedY = false;

    // Try moving on X axis
    if (desiredVx !== 0) {
      const candidateX = currentX + desiredVx;
      if (!this.checkBoxCollision(candidateX, currentY, halfW, halfH)) {
        nextX = candidateX;
        movedX = true;
      }
    }

    // Try moving on Y axis
    if (desiredVy !== 0) {
      const candidateY = currentY + desiredVy;
      if (!this.checkBoxCollision(nextX, candidateY, halfW, halfH)) {
        nextY = candidateY;
        movedY = true;
      }
    }

    return { x: nextX, y: nextY, movedX, movedY };
  }

  /**
   * Find a safe, open, walkable spawn point near (0, 0)
   */
  public findSafeSpawnPoint(): { x: number; y: number; tileX: number; tileY: number } {
    // Search in an outward spiral from tile (0, 0)
    for (let radius = 0; radius < 25; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const tx = dx;
            const ty = dy;
            // Check this tile and surrounding 1-tile neighborhood are completely clear
            let neighborhoodClear = true;
            for (let ny = -1; ny <= 1; ny++) {
              for (let nx = -1; nx <= 1; nx++) {
                if (this.isTileBlocked(tx + nx, ty + ny)) {
                  neighborhoodClear = false;
                  break;
                }
              }
              if (!neighborhoodClear) break;
            }

            if (neighborhoodClear) {
              return {
                tileX: tx,
                tileY: ty,
                x: tx * TILE_SIZE + TILE_SIZE / 2,
                y: ty * TILE_SIZE + TILE_SIZE / 2,
              };
            }
          }
        }
      }
    }

    // Fallback safe center
    return { tileX: 0, tileY: 0, x: TILE_SIZE / 2, y: TILE_SIZE / 2 };
  }
}

