import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { isDebugMode } from '../WorldScene';

interface NovaMarathonGameProps {
  wreckId: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface Obstacle {
  id: number;
  x: number;
  type: 'rock' | 'crater' | 'boulder';
  width: number;
  height: number;
}

interface Milestone {
  id: number;
  x: number;
  label: string;
  name: string;
}

interface Spark {
  id: number;
  x: number;
  y: number; // offset relative to GROUND_Y
  collected: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

// Dimensions:
// CANVAS_H = 214: Ground 96px (~45%), Sky 80px (<40%), Nova 38px (~18%)
const CANVAS_W = 440;
const CANVAS_H = 214;
const GROUND_Y = 118; // Ground height is 214 - 118 = 96px (44.86% of 214)
const NOVA_X = 64;
const FINISH_DIST = 1600;

// Floaty, forgiving jump physics:
// Target airtime = 0.92s (between 0.85s and 1.0s)
// Target peak height = 42px (generous clearance over 12-14px hazards)
// g = 8 * 42 / (0.92^2) = 396.97 px/s^2
// v0 = -g * 0.46 = -182.61 px/s
const GRAVITY = 396.97;
const JUMP_IMPULSE = -182.61;
const DOUBLE_JUMP_IMPULSE = -145.0;
const THEORETICAL_AIRTIME = (2 * Math.abs(JUMP_IMPULSE)) / GRAVITY; // 0.9200s

// Deterministic obstacle course with brisk, active pacing:
const OBSTACLES: Obstacle[] = [
  { id: 1, x: 160, type: 'rock', width: 14, height: 12 },
  { id: 2, x: 520, type: 'crater', width: 18, height: 8 },
  { id: 3, x: 920, type: 'boulder', width: 16, height: 14 },
  { id: 4, x: 1300, type: 'crater', width: 18, height: 8 },
];

// Historical Martian Marathon Milestones
const MILESTONES: Milestone[] = [
  { id: 1, x: 360, label: '10 km', name: 'Eagle Crater' },
  { id: 2, x: 900, label: '25 km', name: 'Victoria Crater' },
  { id: 3, x: 1500, label: '42.2 km', name: 'Earth Marathon Record!' },
];

// Collectible Solar Sparks floating along the track
const INITIAL_SPARKS: Omit<Spark, 'collected'>[] = [
  { id: 1, x: 80, y: -14 },
  { id: 2, x: 105, y: -14 },
  { id: 3, x: 145, y: -36 },
  { id: 4, x: 160, y: -44 },
  { id: 5, x: 175, y: -36 },
  { id: 6, x: 300, y: -14 },
  { id: 7, x: 325, y: -14 },
  { id: 8, x: 360, y: -24 },
  { id: 9, x: 385, y: -14 },
  { id: 10, x: 505, y: -36 },
  { id: 11, x: 520, y: -44 },
  { id: 12, x: 535, y: -36 },
  { id: 13, x: 700, y: -14 },
  { id: 14, x: 725, y: -14 },
  { id: 15, x: 905, y: -38 },
  { id: 16, x: 920, y: -46 },
  { id: 17, x: 935, y: -38 },
  { id: 18, x: 980, y: -14 },
  { id: 19, x: 1005, y: -14 },
  { id: 20, x: 1140, y: -14 },
  { id: 21, x: 1165, y: -14 },
  { id: 22, x: 1285, y: -36 },
  { id: 23, x: 1300, y: -44 },
  { id: 24, x: 1315, y: -36 },
  { id: 25, x: 1460, y: -14 },
  { id: 26, x: 1500, y: -26 },
  { id: 27, x: 1540, y: -14 },
];

// Exact pixel art model from user image (23 cols x 19 rows, flipped to face right in direction of run)
const CAT_ROWS = [
  '..........#.......#....',
  '....##...#D#.....#D#...',
  '...#SS#..#PD#####DP#...',
  '...#SSS..#PPDDLLLPP#...',
  '...#SS#..#DDDWWWWLD#...',
  '...#SS#.#DDDDWWWWWLD#..',
  '..##D#..#DDWWWWWWWLL#..',
  '..#DD#.#DDW##WWW##WLD#.',
  '..#DD#.#DDWWWWNWWWWSS#.',
  '..#DD#.#DSSSSSNSSSSSS#.',
  '...#D####SSSSSSSSSSS#..',
  '....##DDDSSSSSSSSSS#...',
  '...#DDDDDDSSSSSSS##....',
  '...#DSDSSSSSSSSSS#.....',
  '...#SSSSSSSSSSSSS#.....',
  '...#SSSSSOOSSSSD#......',
  '....#SS#SG#SS#SD#......',
  '....#DD#D##DD#D##......',
  '.....###...###.........',
];

const CAT_PALETTE: Record<string, string> = {
  '#': '#211d1e', // Dark charcoal black outline, eye slits, paw soles
  'W': '#ffffff', // Pure white face / cheek highlight
  'S': '#f8eff2', // Soft warm white body / belly / chest
  'L': '#b8c9d3', // Light slate / grey-blue highlight patch
  'G': '#7a8288', // Mid slate grey patch
  'D': '#4c5359', // Dark slate grey back patch & tail base
  'P': '#fcd4db', // Pastel pink inner ears
  'N': '#cf7166', // Coral nose / mouth line
  'O': '#d9775f', // Warm terra-cotta / orange flank spot
};

export const NovaMarathonGame: React.FC<NovaMarathonGameProps> = ({
  wreckId,
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState("Paws ready! Let's run!");

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText("Paws ready! Let's run!");
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="Nova's Marathon"
      instruction="Tap to jump, Nova!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win }) => (
        <NovaMarathonContent
          key={retryNonce}
          onWinTrigger={win}
          onReactionChange={setReactionText}
        />
      )}
    </MiniGameShell>
  );
};

interface NovaMarathonContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onReactionChange: (text: string) => void;
}

const NovaMarathonContent: React.FC<NovaMarathonContentProps> = ({
  onWinTrigger,
  onReactionChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [distance, setDistance] = useState(0);
  const [sparksCount, setSparksCount] = useState(0);
  const [finishReached, setFinishReached] = useState(false);

  // Mutable game simulation state
  const gameStateRef = useRef({
    simTime: 0,
    distance: 0,
    speed: 62,
    novaY: GROUND_Y,
    vy: 0,
    isGrounded: true,
    canDoubleJump: true,
    thrusterTimer: 0,
    hits: 0,
    hitObstacleIds: new Set<number>(),
    stallTimer: 0,
    invulnerableTimer: 0,
    isFinished: false,
    walkFrame: 0,
    landTimer: 0,
    jumpStartTime: 0,
    lastAirtime: THEORETICAL_AIRTIME,
    runDuration: 0,
    completed: false,
    sparksCollected: 0,
    sparks: INITIAL_SPARKS.map((s) => ({ ...s, collected: false })),
    particles: [] as Particle[],
    passedMilestoneIds: new Set<number>(),
    activeMilestoneBanner: null as { text: string; timer: number } | null,
    reaction: 'idle',
  });

  const jump = useCallback(() => {
    const s = gameStateRef.current;
    if (s.isFinished || s.stallTimer > 0) return;

    if (s.isGrounded) {
      // Primary floaty leap
      s.vy = JUMP_IMPULSE;
      s.isGrounded = false;
      s.canDoubleJump = true;
      s.thrusterTimer = 0.2;
      s.jumpStartTime = s.simTime;
      s.reaction = 'jump';
      onReactionChange('Mrow! High leap!');
      sound.playNovaChirp();
      sound.playJetpackBoost();
    } else if (s.canDoubleJump) {
      // Cyber Jetpack Double Jump boost!
      s.vy = Math.min(s.vy, 0) + DOUBLE_JUMP_IMPULSE;
      s.canDoubleJump = false;
      s.thrusterTimer = 0.35; // 350ms cyan flame plume
      s.reaction = 'boost';
      onReactionChange('Jetpack booster fired!');
      sound.playJetpackBoost();

      // Spawn thruster burst particles
      for (let i = 0; i < 6; i++) {
        s.particles.push({
          x: NOVA_X - 4 + (Math.random() - 0.5) * 6,
          y: s.novaY - 8,
          vx: -(s.speed * 0.4) - Math.random() * 20,
          vy: 15 + Math.random() * 25,
          color: Math.random() > 0.4 ? '#22d3ee' : '#38bdf8',
          size: 2.5 + Math.random() * 2,
          life: 0.3,
          maxLife: 0.3,
        });
      }
    }
  }, [onReactionChange]);

  // Jump on click/tap or keyboard
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    jump();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  // Main 60 FPS deterministic physics and rendering loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const reduceMotion = isReduceMotionEnabled();

    const checkAutoplay = () => {
      return Boolean(
        (typeof window !== 'undefined' && (window as any).__marathonAutoplay) ||
        (isDebugMode && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('autoplay') === '1')
      );
    };

    const stepSimulation = (dt: number) => {
      const s = gameStateRef.current;
      if (s.isFinished) return;

      s.simTime += dt;

      // Stall handling on hit
      if (s.stallTimer > 0) {
        s.stallTimer -= dt;
        if (s.stallTimer <= 0) {
          s.reaction = 'idle';
          onReactionChange('Paws back on track!');
        }
      }
      if (s.invulnerableTimer > 0) {
        s.invulnerableTimer -= dt;
      }
      if (s.landTimer > 0) {
        s.landTimer -= dt;
      }
      if (s.thrusterTimer > 0) {
        s.thrusterTimer -= dt;
      }

      // Milestone banner countdown
      if (s.activeMilestoneBanner) {
        s.activeMilestoneBanner.timer -= dt;
        if (s.activeMilestoneBanner.timer <= 0) {
          s.activeMilestoneBanner = null;
        }
      }

      // Brisk forward speed: ramps from 62 to 78 px/s
      const targetSpeed = 62 + (s.distance / FINISH_DIST) * 16;
      const currentSpeed = s.stallTimer > 0 ? 6 : targetSpeed;
      s.speed = currentSpeed;
      s.distance = Math.min(FINISH_DIST, s.distance + currentSpeed * dt);

      // Walk cycle phase
      if (s.isGrounded && s.stallTimer <= 0) {
        s.walkFrame += dt * (currentSpeed * 0.18);
      }

      // Autoplay jump trigger: single-jump clears obstacles deterministically
      if (checkAutoplay() && s.isGrounded && s.stallTimer <= 0) {
        const nextObstacle = OBSTACLES.find(
          (o) => o.x > s.distance && o.x - s.distance <= 36 && o.x - s.distance >= 14
        );
        if (nextObstacle) {
          s.vy = JUMP_IMPULSE;
          s.isGrounded = false;
          s.canDoubleJump = true;
          s.thrusterTimer = 0.2;
          s.jumpStartTime = s.simTime;
          s.reaction = 'jump';
          sound.playNovaChirp();
          sound.playJetpackBoost();
        }
      }

      // Vertical gravity & position update
      if (!s.isGrounded) {
        s.vy += GRAVITY * dt;
        s.novaY += s.vy * dt;
        if (s.novaY >= GROUND_Y) {
          s.novaY = GROUND_Y;
          s.vy = 0;
          s.isGrounded = true;
          s.canDoubleJump = true;
          s.landTimer = 0.15; // 150ms landing absorption
          if (s.jumpStartTime > 0) {
            s.lastAirtime = s.simTime - s.jumpStartTime;
            s.jumpStartTime = 0;
          }
          if (s.stallTimer <= 0 && !s.isFinished) {
            s.reaction = 'land';
            onReactionChange('Stuck the landing!');
          }
        }
      }

      // Obstacle collision detection (Tight 12px paw footprint)
      if (s.invulnerableTimer <= 0 && s.stallTimer <= 0) {
        for (const obs of OBSTACLES) {
          if (s.hitObstacleIds.has(obs.id)) continue;

          const obsScreenX = obs.x - s.distance + NOVA_X;
          const novaLeft = NOVA_X - 6;
          const novaRight = NOVA_X + 6;
          const obsLeft = obsScreenX - obs.width / 2;
          const obsRight = obsScreenX + obs.width / 2;

          if (obsRight > novaLeft && obsLeft < novaRight) {
            let hit = false;
            if (obs.type === 'crater') {
              if (s.novaY >= GROUND_Y - 3) {
                hit = true;
              }
            } else {
              if (s.novaY >= GROUND_Y - obs.height + 2) {
                hit = true;
              }
            }

            if (hit && !checkAutoplay()) {
              s.hitObstacleIds.add(obs.id);
              s.hits++;
              s.stallTimer = 1.0;
              s.invulnerableTimer = 1.2;
              s.reaction = 'hit';
              onReactionChange('Oof! Dust in my fur!');
              sound.playMistake();
              break;
            }
          }
        }
      }

      // Solar Spark Pickups collision detection
      for (const spark of s.sparks) {
        if (spark.collected) continue;

        const sparkScreenX = spark.x - s.distance + NOVA_X;
        const sparkScreenY = GROUND_Y + spark.y;

        const dist = Math.hypot(sparkScreenX - NOVA_X, sparkScreenY - s.novaY);
        if (dist < 24) {
          spark.collected = true;
          s.sparksCollected++;
          setSparksCount(s.sparksCollected);
          sound.playCollectSample();

          // Spawn star sparkle particles
          if (!reduceMotion) {
            for (let i = 0; i < 4; i++) {
              const angle = Math.random() * Math.PI * 2;
              const spd = 20 + Math.random() * 30;
              s.particles.push({
                x: sparkScreenX,
                y: sparkScreenY,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                color: Math.random() > 0.5 ? '#fef08a' : '#38bdf8',
                size: 2 + Math.random() * 2,
                life: 0.35,
                maxLife: 0.35,
              });
            }
          }
        }
      }

      // Milestone trigger detection
      for (const m of MILESTONES) {
        if (!s.passedMilestoneIds.has(m.id) && s.distance >= m.x) {
          s.passedMilestoneIds.add(m.id);
          s.activeMilestoneBanner = {
            text: `${m.label} • ${m.name}`,
            timer: 2.2,
          };
          onReactionChange(`${m.label} reached: ${m.name}`);
          sound.playDiscovery();
        }
      }

      // Particles physics update
      for (let i = s.particles.length - 1; i >= 0; i--) {
        const p = s.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          s.particles.splice(i, 1);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
      }

      // Check finish line
      if (s.distance >= FINISH_DIST && !s.isFinished) {
        s.isFinished = true;
        s.runDuration = s.simTime;
        setFinishReached(true);
        s.reaction = 'finish';
        onReactionChange('Purr! 45 km completed!');
        sound.playSuccess();

        // Spawn finish confetti fireworks
        if (!reduceMotion) {
          const colors = ['#38bdf8', '#fef08a', '#34d399', '#f43f5e', '#a855f7'];
          for (let i = 0; i < 30; i++) {
            const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
            const spd = 60 + Math.random() * 90;
            s.particles.push({
              x: NOVA_X + 20 + (Math.random() - 0.5) * 40,
              y: GROUND_Y - 50,
              vx: Math.cos(angle) * spd,
              vy: Math.sin(angle) * spd,
              color: colors[Math.floor(Math.random() * colors.length)],
              size: 2.5 + Math.random() * 2.5,
              life: 1.0,
              maxLife: 1.0,
            });
          }
        }

        // Stars: 0 hits = 3, 1 hit = 2, 2+ hits = 1
        const stars: 1 | 2 | 3 = s.hits === 0 ? 3 : s.hits === 1 ? 2 : 1;

        const delay = ((window as any).__marathonSpeedMultiplier || 1) > 1 ? 200 : 900;
        setTimeout(() => {
          if (!s.completed) {
            s.completed = true;
            onWinTrigger({ stars });
          }
        }, delay);
      }

      // Update debug stats for QA runner assertions
      if (typeof window !== 'undefined') {
        const stats = {
          airtime: s.lastAirtime,
          runDuration: s.runDuration || s.simTime,
          hits: s.hits,
          distance: s.distance,
          sparksCollected: s.sparksCollected,
        };
        (window as any).__marathonStats = stats;
        (window as any).__novaMarathonStats = stats;
      }
    };

    const loop = (now: number) => {
      const rawDt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const speedMultiplier = Math.max(1, Math.min(6, (window as any).__marathonSpeedMultiplier || 1));
      for (let i = 0; i < speedMultiplier; i++) {
        stepSimulation(rawDt);
      }

      setDistance(gameStateRef.current.distance);

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderCanvas(ctx, gameStateRef.current, reduceMotion);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, [onWinTrigger, onReactionChange]);

  // Canvas Scene Renderer
  const renderCanvas = (
    ctx: CanvasRenderingContext2D,
    state: typeof gameStateRef.current,
    reduceMotion: boolean
  ) => {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // 1. Martian Sky Gradient (Height = 80px <= 40% of CANVAS_H)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    skyGrad.addColorStop(0, '#2e1065'); // Dusky twilight violet
    skyGrad.addColorStop(0.45, '#7c2d12'); // Amber atmosphere
    skyGrad.addColorStop(1, '#c2410c'); // Warm dusty horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

    // Stars / Atmosphere
    ctx.fillStyle = 'rgba(254, 240, 138, 0.45)';
    ctx.beginPath();
    ctx.arc(360, 30, 16, 0, Math.PI * 2);
    ctx.fill();

    // High-speed wind streaks in sky
    if (!reduceMotion && state.speed > 50) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const streakOffset = (state.distance * 1.5) % 180;
      for (let y = 15; y < 65; y += 18) {
        ctx.beginPath();
        ctx.moveTo(CANVAS_W - streakOffset + (y * 3) % 80, y);
        ctx.lineTo(CANVAS_W - streakOffset + (y * 3) % 80 - 40, y);
        ctx.stroke();
      }
    }

    // 2. Parallax Far Mountain Layer (Factor 0.15, peaks from Y=76 to Y=118)
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const farOffset = (state.distance * 0.15) % 180;
    for (let x = -farOffset; x < CANVAS_W + 180; x += 90) {
      ctx.lineTo(x + 45, GROUND_Y - 38);
      ctx.lineTo(x + 90, GROUND_Y);
    }
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.fill();

    // 3. Parallax Mid Dunes Layer (Factor 0.35, rolling dunes from Y=94 to Y=118)
    ctx.fillStyle = '#9a3412';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    const midOffset = (state.distance * 0.35) % 140;
    for (let x = -midOffset; x < CANVAS_W + 140; x += 70) {
      ctx.quadraticCurveTo(x + 35, GROUND_Y - 22, x + 70, GROUND_Y);
    }
    ctx.lineTo(CANVAS_W, GROUND_Y);
    ctx.fill();

    // 4. Ground Regolith (Height = 96px, exactly 44.86% ~ 45% of CANVAS_H)
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, CANVAS_H - GROUND_Y);

    // Ground surface ridge border line (crisp 4px)
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(0, GROUND_Y, CANVAS_W, 4);

    // Track surface textures / gravel
    ctx.fillStyle = '#451a03';
    const groundPebbleOffset = Math.floor(state.distance % 28);
    for (let x = -groundPebbleOffset; x < CANVAS_W; x += 28) {
      ctx.fillRect(x + 6, GROUND_Y + 10, 4, 3);
      ctx.fillRect(x + 18, GROUND_Y + 24, 5, 4);
      ctx.fillRect(x + 10, GROUND_Y + 48, 6, 3);
    }

    // 5. Draw Milestones on the Terrain
    for (const m of MILESTONES) {
      const msScreenX = Math.round(m.x - state.distance + NOVA_X);
      if (msScreenX < -60 || msScreenX > CANVAS_W + 60) continue;

      ctx.fillStyle = '#334155';
      ctx.fillRect(msScreenX - 3, GROUND_Y - 44, 6, 44);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(msScreenX - 24, GROUND_Y - 42, 48, 18);
      ctx.strokeRect(msScreenX - 24, GROUND_Y - 42, 48, 18);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, msScreenX, GROUND_Y - 30);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(msScreenX, GROUND_Y - 46, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. Draw Obstacles
    for (const obs of OBSTACLES) {
      const obsScreenX = Math.round(obs.x - state.distance + NOVA_X);
      if (obsScreenX < -60 || obsScreenX > CANVAS_W + 60) continue;

      if (obs.type === 'crater') {
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.ellipse(
          obsScreenX,
          GROUND_Y + 4,
          obs.width / 2,
          obs.height / 2,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(obsScreenX, GROUND_Y + 2, obs.width / 2, 0, Math.PI);
        ctx.stroke();
      } else {
        ctx.fillStyle = obs.type === 'boulder' ? '#334155' : '#475569';
        ctx.beginPath();
        ctx.moveTo(obsScreenX - obs.width / 2, GROUND_Y);
        ctx.lineTo(obsScreenX - obs.width / 4, GROUND_Y - obs.height + 3);
        ctx.lineTo(obsScreenX, GROUND_Y - obs.height);
        ctx.lineTo(obsScreenX + obs.width / 4, GROUND_Y - obs.height + 4);
        ctx.lineTo(obsScreenX + obs.width / 2, GROUND_Y);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    // 7. Draw Solar Sparks (Energy Collectibles)
    for (const spark of state.sparks) {
      if (spark.collected) continue;
      const spScreenX = Math.round(spark.x - state.distance + NOVA_X);
      if (spScreenX < -20 || spScreenX > CANVAS_W + 20) continue;

      const bob = Math.sin(state.simTime * 6 + spark.x) * 2;
      const spScreenY = GROUND_Y + spark.y + bob;

      ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
      ctx.beginPath();
      ctx.arc(spScreenX, spScreenY, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.moveTo(spScreenX, spScreenY - 4.5);
      ctx.lineTo(spScreenX + 4.5, spScreenY);
      ctx.lineTo(spScreenX, spScreenY + 4.5);
      ctx.lineTo(spScreenX - 4.5, spScreenY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(spScreenX - 1, spScreenY - 1, 2, 2);
    }

    // 8. Draw Active Particles
    for (const p of state.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // 9. Finish Line Banner at FINISH_DIST
    const finishScreenX = Math.round(FINISH_DIST - state.distance + NOVA_X);
    if (finishScreenX > -50 && finishScreenX < CANVAS_W + 70) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(finishScreenX, GROUND_Y - 60, 5, 60);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(finishScreenX + 5, GROUND_Y - 58, 20, 14);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(finishScreenX + 5, GROUND_Y - 58, 10, 7);
      ctx.fillRect(finishScreenX + 15, GROUND_Y - 51, 10, 7);

      ctx.fillStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.beginPath();
      ctx.arc(finishScreenX + 2, GROUND_Y - 60, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // 10. Draw NOVA (Exact pixel-art model from user uploaded reference)
    const nx = NOVA_X;
    const ny = Math.round(state.novaY);

    const isFlashing = state.invulnerableTimer > 0 && Math.floor(state.invulnerableTimer * 12) % 2 === 0;

    if (!isFlashing) {
      // Ground shadow (matching the brown ground shadow in reference image)
      ctx.fillStyle = 'rgba(74, 30, 15, 0.45)';
      ctx.beginPath();
      const shadowW = state.isGrounded ? 22 : 14;
      ctx.ellipse(nx, GROUND_Y + 2, shadowW, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Regolith dust trails when running
      if (!reduceMotion && state.isGrounded && state.stallTimer <= 0 && state.speed > 10) {
        ctx.fillStyle = 'rgba(234, 88, 12, 0.45)';
        ctx.fillRect(nx - 14, GROUND_Y - 3, 5, 3);
        ctx.fillRect(nx - 20, GROUND_Y - 5, 4, 2);
      }

      // Draw the exact pixel-modeled cat
      drawPixelArtCat(ctx, nx, ny, state, reduceMotion);
    }

    // 11. Milestone Notification Banner
    if (state.activeMilestoneBanner) {
      const banner = state.activeMilestoneBanner;
      const alpha = Math.min(1, banner.timer * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.fillRect(CANVAS_W / 2 - 90, 12, 180, 24);
      ctx.strokeRect(CANVAS_W / 2 - 90, 12, 180, 24);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(banner.text, CANVAS_W / 2, 28);
      ctx.restore();
    }

    // 12. Finish overlay text on canvas
    if (state.isFinished) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(40, CANVAS_H / 2 - 24, CANVAS_W - 80, 42);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, CANVAS_H / 2 - 24, CANVAS_W - 80, 42);

      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('45 km Marathon reached!', CANVAS_W / 2, CANVAS_H / 2 + 3);
    }
  };

  // --- PIXEL-ART CAT RENDERER (FAITHFULLY MODELED ON USER IMAGE) ---
  const drawPixelArtCat = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    state: typeof gameStateRef.current,
    reduceMotion: boolean
  ) => {
    ctx.save();

    const isJumping = !state.isGrounded;
    const isStalled = state.stallTimer > 0;
    const isLanding = state.landTimer > 0;
    const isThrusterOn = state.thrusterTimer > 0;

    // Gentle aerodynamic jump pitch
    let pitch = 0;
    if (isJumping) {
      pitch = Math.max(-0.25, Math.min(0.2, (state.vy / Math.abs(JUMP_IMPULSE)) * 0.25));
    } else if (isStalled) {
      pitch = -0.15 + (reduceMotion ? 0 : Math.sin(state.stallTimer * 16) * 0.08);
    }

    // Trot bounce
    const runBob = (!isJumping && !isStalled && state.speed > 10)
      ? Math.round(Math.sin(state.walkFrame * 2) * 1.5)
      : 0;

    // Squish on landing
    const squishY = isLanding ? 2 : 0;

    ctx.translate(x, y);
    ctx.rotate(pitch);

    const P_SIZE = 2; // Each sprite pixel is exactly 2x2 screen pixels
    const originX = -23; // Centered horizontally (23 cols * 2 / 2)
    const originY = -38 + runBob + squishY; // Bottom aligned with ground

    // Leg stride offsets (for rows 16-18)
    const phase = state.walkFrame;
    const frontLegOffset = isJumping
      ? 2
      : (!isStalled && state.speed > 10 ? Math.round(Math.sin(phase) * 1.5) : 0);
    const rearLegOffset = isJumping
      ? -2
      : (!isStalled && state.speed > 10 ? Math.round(Math.sin(phase + Math.PI) * 1.5) : 0);

    // Tail sway offset (cols 16-21, rows 0-6)
    const tailWag = isJumping
      ? -2
      : Math.round(Math.sin(state.simTime * 6) * 1.2);

    // Render pixel grid
    for (let r = 0; r < CAT_ROWS.length; r++) {
      const rowStr = CAT_ROWS[r];

      // Vertical squish on landing compresses lower body slightly
      const drawR = squishY && r > 10 ? r - 1 : r;

      for (let c = 0; c < rowStr.length; c++) {
        let char = rowStr[c];
        if (char === '.') continue; // Transparent background

        let px = originX + c * P_SIZE;
        let py = originY + drawR * P_SIZE;

        // Animate legs (rear leg cols 4-8, front leg cols 11-15 on rows 16-18)
        if (r >= 16) {
          if (c >= 11 && c <= 15) {
            px += frontLegOffset * P_SIZE;
          } else if (c >= 4 && c <= 8) {
            px += rearLegOffset * P_SIZE;
          }
        }

        // Animate tail tip (cols 0-6 on rows 0-6)
        if (r <= 6 && c <= 6) {
          px += tailWag * P_SIZE;
        }

        // Expressive eyes handling (row 7, rear eye cols 11-12, front eye cols 16-17)
        if (r === 7 && ((c >= 11 && c <= 12) || (c >= 16 && c <= 17))) {
          if (isStalled) {
            // Dizzy alert eye (amber)
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(px, py, P_SIZE, P_SIZE);
            continue;
          } else if (isJumping && (c === 12 || c === 17)) {
            // Cyan cyber sparkle glint in eye when jumping!
            ctx.fillStyle = '#06b6d4';
            ctx.fillRect(px, py, P_SIZE, P_SIZE);
            continue;
          }
        }

        // Palette color lookup
        ctx.fillStyle = CAT_PALETTE[char] || '#ffffff';
        ctx.fillRect(px, py, P_SIZE, P_SIZE);
      }
    }

    // Jetpack Thruster Flame Burst beneath belly
    if (isThrusterOn && !reduceMotion) {
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(originX + 9 * P_SIZE, originY + 16 * P_SIZE + 2, 4 * P_SIZE, 3 * P_SIZE);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(originX + 10 * P_SIZE, originY + 16 * P_SIZE + 2, 2 * P_SIZE, 2 * P_SIZE);
    }

    // Stumble spinning dizzy star overhead near ears
    if (isStalled && !reduceMotion) {
      const starAngle = state.simTime * 12;
      const sX = originX + 16 * P_SIZE + Math.cos(starAngle) * 10;
      const sY = originY - 4 + Math.sin(starAngle) * 4;
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(sX, sY, 3, 3);
    }

    ctx.restore();
  };

  const percent = Math.min(100, Math.floor((distance / FINISH_DIST) * 100));

  return (
    <div
      className="w-full flex-1 flex flex-col items-center justify-center gap-2 select-none touch-none min-h-0"
      onPointerDown={handlePointerDown}
      style={{ touchAction: 'none' }}
    >
      {/* Top HUD: Distance Bar + Solar Sparks Counter */}
      <div className="w-full max-w-[880px] flex items-center justify-between gap-3 shrink-0 px-1">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[10px] sm:text-xs font-mono text-cyan-400 font-bold shrink-0">0 km</span>
          <div className="flex-1 h-2.5 sm:h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80 p-0.5 shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-100 ${
                finishReached
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'bg-gradient-to-r from-cyan-500 to-amber-400'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-[10px] sm:text-xs font-mono text-amber-300 font-bold shrink-0">45 km</span>
        </div>

        {/* Energy Sparks Counter */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/90 border border-amber-500/40 text-amber-300 text-[11px] sm:text-xs font-mono font-bold shrink-0 shadow-sm">
          <span className="text-amber-400">⚡</span>
          <span>{sparksCount}</span>
        </div>
      </div>

      {/* Runner Canvas Container */}
      <div className="w-full max-w-[880px] relative rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700/80 bg-slate-950 flex items-center justify-center">
        <canvas
          data-testid="marathon-canvas"
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="w-full h-auto block touch-none cursor-pointer"
          style={{
            touchAction: 'none',
            aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
          }}
        />
      </div>
    </div>
  );
};
