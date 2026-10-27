/**
 * Seeded PRNG and 2D Coherent Gradient Noise (Zero Dependencies)
 * Deterministic: the same seed always yields the exact same noise values.
 */

export class SeededRNG {
  private state: number;

  constructor(seed: number | string) {
    if (typeof seed === 'string') {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      this.state = hash >>> 0;
    } else {
      this.state = (seed >>> 0) || 1337;
    }
  }

  // Mulberry32 32-bit generator
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }
}

export class PerlinNoise2D {
  private perm: Uint8Array = new Uint8Array(512);

  constructor(seed: number | string = 42) {
    this.reseed(seed);
  }

  public reseed(seed: number | string): void {
    const rng = new SeededRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    // Duplicate for wrapping
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * Sample 2D Perlin noise in [-1, 1]
   */
  public sample(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const gaa = this.grad(aa, xf, yf);
    const gba = this.grad(ba, xf - 1, yf);
    const gab = this.grad(ab, xf, yf - 1);
    const gbb = this.grad(bb, xf - 1, yf - 1);

    const x1 = this.lerp(u, gaa, gba);
    const x2 = this.lerp(u, gab, gbb);

    return this.lerp(v, x1, x2);
  }

  /**
   * Normalized sample in [0, 1]
   */
  public sample01(x: number, y: number): number {
    return (this.sample(x, y) + 1) * 0.5;
  }

  /**
   * Fractal Brownian Motion (multiple octaves)
   */
  public fbm(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.sample(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return (total / maxValue + 1) * 0.5;
  }
}

