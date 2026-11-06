import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { isDebugMode } from '../../systems/debug';
import { Flame } from 'lucide-react';

interface LunaSoftLandingGameProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const LunaSoftLandingGame: React.FC<LunaSoftLandingGameProps> = ({ onSuccess, onClose }) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState<string | undefined>(undefined);

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText(undefined);
  }, []);

  return (
    <MiniGameShell
      wreckId="moon_luna9"
      title="Luna 9 Soft Landing"
      instruction="Hold to slow down. Touch down gently!"
      winTitle={(stars) => (stars === 1 ? 'BOUNCY LANDING!' : 'TOUCHDOWN!')}
      claimLabel="Log Relic ->"
      factTeaser="Tap to unlock a real Moon mission fact!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <LunaContent
          key={retryNonce}
          onWinTrigger={win}
          onFailTrigger={fail}
          onReactionChange={setReactionText}
          assistActive={assistActive}
        />
      )}
    </MiniGameShell>
  );
};

export default LunaSoftLandingGame;

interface LunaContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

// Deterministic Physics Tuning
// Alt 100 -> 0. Initial downward speed 5.0.
// Zero thrust free-fall takes ~7.3s + 1.6s airbag bounce = ~8.9s (< 12s).
// Full hold consumes fuel in 18.2s, then falls in ~9.1s + 1.6s bounce = ~28.9s (< 30s).
// Good landing / autopilot takes 18-22s, uses ~58% of fuel (55-65%), lands with 3 stars.
const GRAVITY = 2.4; // units/s^2 downward
const BASE_THRUST = 4.8; // units/s^2 (~2x gravity)
const FUEL_BURN_RATE = 5.8; // fuel/s
const INITIAL_ALTITUDE = 100.0;
const INITIAL_SPEED = 5.0; // units/s downward
const SAFE_SPEED_BASE = 3.5; // units/s for 3 stars
const SAFE_SPEED_ASSIST = 5.0; // wider green zone under assist
const MEDIUM_SPEED_MAX = 7.0; // units/s for 2 stars; above is 1 star (hard)

export const LunaContent: React.FC<LunaContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useMemo(() => isReduceMotionEnabled(), []);

  // Active state
  const [phase, setPhase] = useState<'falling' | 'landed'>('falling');
  const phaseRef = useRef<'falling' | 'landed'>('falling');
  phaseRef.current = phase;

  const altRef = useRef(INITIAL_ALTITUDE);
  const vyRef = useRef(INITIAL_SPEED);
  const fuelRef = useRef(100.0);
  const starsRef = useRef<1 | 2 | 3>(3);
  const elapsedMsRef = useRef(0);
  const autopilotRef = useRef<'none' | 'perfect' | 'hold'>('none');

  // Input tracking: active sources set guarantees no stuck thrust on blur/cancel/unmount
  const thrustSources = useRef(new Set<string>());
  const [isThrustingState, setIsThrustingState] = useState(false);
  const isThrustingRef = useRef(false);

  // Bounce / Landing animation state
  const bounceTimerRef = useRef(0);
  const bounceTotalRef = useRef(0);
  const bounceActiveRef = useRef(false);
  const screenShakeRef = useRef(0);

  // Reaction flags
  const lowFuelWarnedRef = useRef(false);

  // Procedural Stars Seed
  const starsData = useMemo(() => {
    const list: { x: number; y: number; r: number; phase: number }[] = [];
    let seed = 19660203;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 70; i++) {
      list.push({
        x: rnd() * CANVAS_WIDTH,
        y: rnd() * (CANVAS_HEIGHT - 75),
        r: rnd() > 0.85 ? 1.5 : 0.9,
        phase: rnd() * Math.PI * 2,
      });
    }
    return list;
  }, []);

  // Update thrusting flag
  const updateThrusting = useCallback(() => {
    const auto = autopilotRef.current;
    let wantThrust = false;

    if (auto === 'hold') {
      wantThrust = true;
    } else if (auto === 'perfect') {
      const vTarget = 2.4 + 4.6 * (altRef.current / 100);
      wantThrust = vyRef.current > vTarget;
    } else {
      wantThrust = thrustSources.current.size > 0;
    }

    const canThrust = wantThrust && fuelRef.current > 0 && phaseRef.current === 'falling';
    if (canThrust !== isThrustingRef.current) {
      isThrustingRef.current = canThrust;
      setIsThrustingState(canThrust);
      if (canThrust) sound.playClick();
    }
  }, []);

  // Safe speed limit depending on assist
  const safeSpeedLimit = assistActive ? SAFE_SPEED_ASSIST : SAFE_SPEED_BASE;
  const thrustAccel = assistActive ? BASE_THRUST * 1.2 : BASE_THRUST;

  // Window event listeners to guarantee no stuck thrust
  useEffect(() => {
    const handleBlur = () => {
      thrustSources.current.clear();
      updateThrusting();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        thrustSources.current.clear();
        updateThrusting();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        thrustSources.current.add('key');
        updateThrusting();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        thrustSources.current.delete('key');
        updateThrusting();
      }
    };

    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      thrustSources.current.clear();
      isThrustingRef.current = false;
    };
  }, [updateThrusting]);

  // QA Debug Hook
  useEffect(() => {
    if (isDebugMode && typeof window !== 'undefined') {
      (window as any).__lunaGame = {
        getState: () => ({
          phase: phaseRef.current,
          altitude: Math.round(altRef.current * 10) / 10,
          speed: Math.round(vyRef.current * 10) / 10,
          fuel: Math.round(fuelRef.current * 10) / 10,
          stars: starsRef.current,
          elapsedMs: Math.round(elapsedMsRef.current),
        }),
        getEarthRect: () => ({
          x: 500 - 24,
          y: 72 - 24,
          width: 48,
          height: 48,
          canvasWidth: CANVAS_WIDTH,
          canvasHeight: CANVAS_HEIGHT,
          isFullyInside: 72 - 24 >= 0 && 72 + 24 <= CANVAS_HEIGHT && 500 - 24 >= 0 && 500 + 24 <= CANVAS_WIDTH,
        }),
        getLanderMetrics: () => ({
          height: 52,
          canvasHeight: CANVAS_HEIGHT,
          ratio: 52 / CANVAS_HEIGHT,
        }),
        setAutopilot: (mode: 'perfect' | 'none' | 'hold') => {
          autopilotRef.current = mode;
          updateThrusting();
        },
      };
      return () => {
        delete (window as any).__lunaGame;
      };
    }
  }, [updateThrusting]);

  // Main 60fps Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      // 1. Simulation step
      if (phaseRef.current === 'falling') {
        elapsedMsRef.current += dt * 1000;
        updateThrusting();

        // Acceleration
        let netAcc = GRAVITY;
        if (isThrustingRef.current && fuelRef.current > 0) {
          netAcc -= thrustAccel;
          fuelRef.current = Math.max(0, fuelRef.current - FUEL_BURN_RATE * dt);

          if (fuelRef.current <= 0) {
            isThrustingRef.current = false;
            setIsThrustingState(false);
          }
        }

        // Low fuel reaction check
        if (fuelRef.current < 25.0 && !lowFuelWarnedRef.current) {
          lowFuelWarnedRef.current = true;
          onReactionChange('Fuel low! Balance thrust carefully!');
        }

        vyRef.current += netAcc * dt;
        altRef.current -= vyRef.current * dt;

        // Clamp ceiling
        if (altRef.current >= 100.0) {
          altRef.current = 100.0;
          if (vyRef.current < 0) vyRef.current = 0;
        }

        // Touchdown trigger
        if (altRef.current <= 0) {
          altRef.current = 0;
          const touchSpeed = vyRef.current;
          phaseRef.current = 'landed';
          setPhase('landed');
          isThrustingRef.current = false;
          setIsThrustingState(false);

          if (touchSpeed <= safeSpeedLimit) {
            // 3 Stars: Soft landing
            starsRef.current = 3;
            sound.playSuccess();
            onReactionChange('Flawless touchdown! Pristine telemetry secured!');
            setTimeout(() => {
              onWinTrigger({ stars: 3 });
            }, 700);
          } else if (touchSpeed <= MEDIUM_SPEED_MAX) {
            // 2 Stars: Moderate landing
            starsRef.current = 2;
            sound.playClick();
            onReactionChange('A bit fast, but we made it!');
            bounceActiveRef.current = true;
            bounceTotalRef.current = 0.7;
            bounceTimerRef.current = 0.7;
            setTimeout(() => {
              onWinTrigger({ stars: 2 });
            }, 900);
          } else {
            // 1 Star: Hard landing with airbag bounce
            starsRef.current = 1;
            sound.playMistake();
            onFailTrigger();
            onReactionChange('Bouncy! The airbags saved us!');
            bounceActiveRef.current = true;
            bounceTotalRef.current = 1.6;
            bounceTimerRef.current = 1.6;
            if (!reduceMotion) screenShakeRef.current = 6;

            setTimeout(() => {
              onWinTrigger({ stars: 1 });
            }, 1700);
          }
        }
      } else if (bounceActiveRef.current) {
        bounceTimerRef.current = Math.max(0, bounceTimerRef.current - dt);
        if (bounceTimerRef.current <= 0) {
          bounceActiveRef.current = false;
        }
      }

      if (screenShakeRef.current > 0) {
        screenShakeRef.current = Math.max(0, screenShakeRef.current - dt * 15);
      }

      // 2. Render Frame
      render(time);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [onWinTrigger, onFailTrigger, onReactionChange, reduceMotion, safeSpeedLimit, thrustAccel, updateThrusting]);

  // Render to 640x360 Canvas
  const render = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Screen Shake (skipped under reduceMotion)
    if (screenShakeRef.current > 0 && !reduceMotion) {
      const shakeX = (Math.random() - 0.5) * screenShakeRef.current;
      const shakeY = (Math.random() - 0.5) * screenShakeRef.current;
      ctx.translate(shakeX, shakeY);
    }

    // A. Sky Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // B. Stars (seeded, twinkling)
    for (const s of starsData) {
      const alpha = 0.4 + 0.5 * Math.sin(time * 0.003 + s.phase);
      ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // C. Earth in the Lunar Sky (upper right, sits comfortably fully inside canvas)
    const earthX = 500;
    const earthY = 72;
    const earthR = 24;

    // Atmospheric halo
    const haloGrad = ctx.createRadialGradient(earthX, earthY, earthR * 0.8, earthX, earthY, earthR * 1.4);
    haloGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    haloGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR * 1.4, 0, Math.PI * 2);
    ctx.fill();

    // Earth orb
    const earthGrad = ctx.createRadialGradient(earthX - 6, earthY - 6, 2, earthX, earthY, earthR);
    earthGrad.addColorStop(0, '#38bdf8');
    earthGrad.addColorStop(0.5, '#1d4ed8');
    earthGrad.addColorStop(1, '#0c1a4d');
    ctx.fillStyle = earthGrad;
    ctx.beginPath();
    ctx.arc(earthX, earthY, earthR, 0, Math.PI * 2);
    ctx.fill();

    // Cloud swirls
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.beginPath();
    ctx.ellipse(earthX - 4, earthY - 4, 11, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(earthX + 5, earthY + 6, 9, 3, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // D. Lunar Regolith Ground Strip (~20% height, bottom 72px)
    const groundY = CANVAS_HEIGHT - 72; // Y = 288

    // Distant ridge
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.bezierCurveTo(120, groundY - 14, 240, groundY + 6, 380, groundY - 10);
    ctx.bezierCurveTo(480, groundY - 18, 560, groundY - 4, 640, groundY);
    ctx.lineTo(640, CANVAS_HEIGHT);
    ctx.lineTo(0, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Fore regolith surface
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.bezierCurveTo(160, groundY + 8, 300, groundY - 4, 460, groundY + 4);
    ctx.lineTo(640, groundY);
    ctx.lineTo(640, CANVAS_HEIGHT);
    ctx.lineTo(0, CANVAS_HEIGHT);
    ctx.closePath();
    ctx.fill();

    // Crater bumps & rims
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(140, groundY + 22, 35, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(480, groundY + 32, 45, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Surface texture rim highlights
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.bezierCurveTo(160, groundY + 8, 300, groundY - 4, 460, groundY + 4);
    ctx.lineTo(640, groundY);
    ctx.stroke();

    // E. Lander Position Calculation
    const landerTravelHeight = groundY - 44; // From Y=44 down to groundY
    let landerY = groundY - (altRef.current / 100) * landerTravelHeight;
    const landerX = CANVAS_WIDTH / 2;

    // Apply bounce offset if in airbag bounce
    let bounceHop = 0;
    if (bounceActiveRef.current) {
      const elapsedBounce = bounceTotalRef.current - bounceTimerRef.current;
      if (starsRef.current === 1) {
        // 2 Hops: Hop 1 (0 to 0.9s, peak 26px), Hop 2 (0.9 to 1.6s, peak 11px)
        if (elapsedBounce < 0.9) {
          bounceHop = Math.sin((elapsedBounce / 0.9) * Math.PI) * 26;
        } else if (elapsedBounce < 1.6) {
          bounceHop = Math.sin(((elapsedBounce - 0.9) / 0.7) * Math.PI) * 11;
        }
      } else if (starsRef.current === 2) {
        // Minor bump
        bounceHop = Math.sin((elapsedBounce / 0.7) * Math.PI) * 8;
      }
    }
    const currentY = landerY - bounceHop;

    // F. Draw Thrust Flame
    const isThrusting = isThrustingRef.current && fuelRef.current > 0 && phaseRef.current === 'falling';
    if (isThrusting) {
      const flameJitter = Math.sin(time * 0.05) * 4;
      const flameLen = 30 + flameJitter;

      // Outer orange flame
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(landerX - 6, currentY + 20);
      ctx.lineTo(landerX + 6, currentY + 20);
      ctx.lineTo(landerX, currentY + 20 + flameLen);
      ctx.closePath();
      ctx.fill();

      // Inner cyan/white core
      ctx.fillStyle = '#e0f2fe';
      ctx.beginPath();
      ctx.moveTo(landerX - 3.5, currentY + 20);
      ctx.lineTo(landerX + 3.5, currentY + 20);
      ctx.lineTo(landerX, currentY + 20 + flameLen * 0.65);
      ctx.closePath();
      ctx.fill();

      // Flame glow
      ctx.save();
      ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';
      ctx.beginPath();
      ctx.arc(landerX, currentY + 26, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // G. Draw Luna 9 Lander (~14% of play height = 52px on 360px canvas)
    const isSafeSpeed = vyRef.current <= safeSpeedLimit;

    // Airbags (drawn during bounce / hard landing)
    if (bounceActiveRef.current && starsRef.current === 1) {
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;

      const airbagRadius = 13;
      const offsets = [
        { dx: -16, dy: -6 },
        { dx: 16, dy: -6 },
        { dx: -12, dy: 13 },
        { dx: 12, dy: 13 },
      ];

      for (const off of offsets) {
        ctx.beginPath();
        ctx.arc(landerX + off.dx, currentY + off.dy, airbagRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Landing Legs / Struts (Prominent and readable, glow green when safe)
    ctx.save();
    const legColor = isSafeSpeed ? '#10b981' : '#94a3b8';
    ctx.strokeStyle = legColor;
    ctx.lineWidth = 3;

    if (isSafeSpeed) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
    }

    // Left strut & pad
    ctx.beginPath();
    ctx.moveTo(landerX - 9, currentY + 6);
    ctx.lineTo(landerX - 19, currentY + 22);
    ctx.lineTo(landerX - 24, currentY + 22);
    ctx.stroke();

    // Right strut & pad
    ctx.beginPath();
    ctx.moveTo(landerX + 9, currentY + 6);
    ctx.lineTo(landerX + 19, currentY + 22);
    ctx.lineTo(landerX + 24, currentY + 22);
    ctx.stroke();

    // Footpad circles
    ctx.fillStyle = isSafeSpeed ? '#34d399' : '#64748b';
    ctx.beginPath();
    ctx.arc(landerX - 21, currentY + 22, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(landerX + 21, currentY + 22, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Lander Descent Stage (Gold foil cylinder, width 26, height 16)
    ctx.fillStyle = '#d97706';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(landerX - 13, currentY - 2, 26, 16);
    ctx.strokeRect(landerX - 13, currentY - 2, 26, 16);

    // Rocket Nozzle (bottom center)
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(landerX - 6, currentY + 14);
    ctx.lineTo(landerX + 6, currentY + 14);
    ctx.lineTo(landerX + 4, currentY + 20);
    ctx.lineTo(landerX - 4, currentY + 20);
    ctx.closePath();
    ctx.fill();

    // Luna 9 Spherical Capsule Payload (Top, radius 13, top reaches currentY - 26)
    const sphereGrad = ctx.createRadialGradient(
      landerX - 4,
      currentY - 17,
      2,
      landerX,
      currentY - 13,
      14
    );
    sphereGrad.addColorStop(0, '#f8fafc');
    sphereGrad.addColorStop(0.7, '#cbd5e1');
    sphereGrad.addColorStop(1, '#64748b');

    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(landerX, currentY - 13, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Antennas (angled rods at top)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(landerX - 7, currentY - 23);
    ctx.lineTo(landerX - 16, currentY - 33);
    ctx.moveTo(landerX + 7, currentY - 23);
    ctx.lineTo(landerX + 16, currentY - 33);
    ctx.stroke();

    // H. Speed Gauge (Vertical, Right Side, NO numeric thresholds)
    const gaugeX = CANVAS_WIDTH - 44;
    const gaugeY = 70;
    const gaugeW = 14;
    const gaugeH = 150;

    // Track
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
    ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

    // Zones mapping: Max speed mapped on gauge is 12.0
    const maxGaugeSpeed = 12.0;
    const safeH = (safeSpeedLimit / maxGaugeSpeed) * gaugeH;
    const medH = ((MEDIUM_SPEED_MAX - safeSpeedLimit) / maxGaugeSpeed) * gaugeH;
    const fastH = gaugeH - safeH - medH;

    // Safe Green Zone
    ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, safeH);

    // Medium Yellow Zone
    ctx.fillStyle = 'rgba(234, 179, 8, 0.35)';
    ctx.fillRect(gaugeX, gaugeY + safeH, gaugeW, medH);

    // Fast Red Zone
    ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
    ctx.fillRect(gaugeX, gaugeY + safeH + medH, gaugeW, fastH);

    // Current Speed Pointer
    const clampedSpeed = Math.max(0, Math.min(maxGaugeSpeed, vyRef.current));
    const pointerY = gaugeY + (clampedSpeed / maxGaugeSpeed) * gaugeH;

    ctx.save();
    ctx.fillStyle = isSafeSpeed ? '#10b981' : vyRef.current <= MEDIUM_SPEED_MAX ? '#eab308' : '#ef4444';
    ctx.beginPath();
    ctx.moveTo(gaugeX - 8, pointerY);
    ctx.lineTo(gaugeX - 1, pointerY - 4);
    ctx.lineTo(gaugeX - 1, pointerY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Gauge Title
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPEED', gaugeX + gaugeW / 2, gaugeY - 8);

    // I. Fuel Gauge Bar (Top Left)
    const fuelX = 24;
    const fuelY = 24;
    const fuelW = 120;
    const fuelH = 10;
    const fuelPct = Math.max(0, Math.min(100, fuelRef.current));

    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.fillRect(fuelX, fuelY, fuelW, fuelH);
    ctx.strokeRect(fuelX, fuelY, fuelW, fuelH);

    // Fuel fill
    const fuelFillGrad = ctx.createLinearGradient(fuelX, fuelY, fuelX + fuelW, fuelY);
    if (fuelPct < 25) {
      fuelFillGrad.addColorStop(0, '#ef4444');
      fuelFillGrad.addColorStop(1, '#f97316');
    } else {
      fuelFillGrad.addColorStop(0, '#06b6d4');
      fuelFillGrad.addColorStop(1, '#10b981');
    }
    ctx.fillStyle = fuelFillGrad;
    ctx.fillRect(fuelX + 1, fuelY + 1, (fuelW - 2) * (fuelPct / 100), fuelH - 2);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`FUEL`, fuelX, fuelY - 5);

    ctx.restore();
  };

  // Pointer event handlers with capture and cleanup
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    thrustSources.current.add('canvas');
    updateThrusting();
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    thrustSources.current.delete('canvas');
    updateThrusting();
  };

  const handleButtonPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    thrustSources.current.add('button');
    updateThrusting();
  };

  const handleButtonPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    thrustSources.current.delete('button');
    updateThrusting();
  };

  return (
    <div
      data-testid="luna-game"
      data-phase={phase}
      data-earth-inside="true"
      data-lander-height="52"
      data-lander-ratio="0.144"
      className="w-full flex-1 flex flex-col items-center justify-between min-h-0 select-none touch-none overscroll-none"
    >
      {/* 1. Luna Descent Canvas (aspect ratio tuned for desktop >= 60% viewport width, mobile >= 340px) */}
      <div className="w-full flex-1 flex items-center justify-center my-0.5 sm:my-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handleCanvasPointerDown}
          onPointerUp={handleCanvasPointerUp}
          onPointerCancel={handleCanvasPointerUp}
          onPointerLeave={handleCanvasPointerUp}
          className="bg-[#020617] rounded-2xl block border-2 border-slate-800 shadow-2xl cursor-pointer w-[350px] sm:w-[840px] max-w-full h-auto aspect-video shrink-0 touch-none select-none"
        />
      </div>

      {/* 2. Tactile Big THRUST Button (>= 72px tall, >= 48px wide) */}
      <div className="w-full flex items-center justify-center pt-1.5 pb-0.5 shrink-0">
        <button
          data-testid="luna-thrust-btn"
          onPointerDown={handleButtonPointerDown}
          onPointerUp={handleButtonPointerUp}
          onPointerCancel={handleButtonPointerUp}
          onPointerLeave={handleButtonPointerUp}
          disabled={phase === 'landed'}
          className={`min-h-[72px] h-[72px] min-w-[48px] w-full max-w-sm rounded-2xl font-mono font-bold tracking-widest text-sm uppercase flex items-center justify-center gap-3 border shadow-xl transition-all select-none cursor-pointer active:scale-98 ${
            phase === 'landed'
              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
              : isThrustingState
              ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.6)] scale-[0.98]'
              : 'bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-400 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)]'
          }`}
        >
          <Flame size={24} className={isThrustingState ? 'animate-bounce text-slate-950' : 'text-cyan-200'} />
          <span>{isThrustingState ? 'THRUSTING...' : 'HOLD TO THRUST'}</span>
        </button>
      </div>
    </div>
  );
};
