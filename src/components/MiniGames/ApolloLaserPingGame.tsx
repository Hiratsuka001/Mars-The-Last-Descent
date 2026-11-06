import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { isDebugMode } from '../../systems/debug';
import { Target, Zap } from 'lucide-react';

interface ApolloLaserPingGameProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const ApolloLaserPingGame: React.FC<ApolloLaserPingGameProps> = ({ onSuccess, onClose }) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState<string | undefined>(undefined);
  const reactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any active reaction after 2.5s and ensure footer is empty on retries/start
  const triggerReaction = useCallback((text: string) => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
    }
    setReactionText(text);
    reactionTimerRef.current = setTimeout(() => {
      setReactionText(undefined);
    }, 2500);
  }, []);

  const handleRetry = useCallback(() => {
    if (reactionTimerRef.current) {
      clearTimeout(reactionTimerRef.current);
    }
    setReactionText(undefined);
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  return (
    <MiniGameShell
      wreckId="moon_apollo11"
      title="Apollo 11 Laser Ping"
      instruction="Aim at the mirror, then fire!"
      winTitle={(stars) => (stars === 1 ? 'FAINT ECHO' : 'ECHO RECEIVED!')}
      claimLabel="Log Relic ->"
      factTeaser="Tap to unlock a real Moon mission fact!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <ApolloPingContent
          key={retryNonce}
          attemptIndex={retryNonce}
          onWinTrigger={win}
          onFailTrigger={fail}
          onReactionChange={triggerReaction}
          assistActive={assistActive}
        />
      )}
    </MiniGameShell>
  );
};

export default ApolloLaserPingGame;

interface ApolloPingContentProps {
  attemptIndex: number;
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;

// Moon geometry (radius 100, diameter 200 = 55.55% of 360px canvas height, >= 55%)
const MOON_X = 320;
const MOON_Y = 160;
const MOON_RADIUS = 100;

// Fixed real-time laser round trip delay: 2.50s (spec: 2.5s +/- 0.15s, within 2.35 - 2.65s)
const WAIT_DURATION_MS = 2500;

export const ApolloPingContent: React.FC<ApolloPingContentProps> = ({
  attemptIndex,
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useMemo(() => isReduceMotionEnabled(), []);

  // State phases: aiming -> waiting (2.5s fixed) -> result
  const [phase, setPhase] = useState<'aiming' | 'waiting' | 'result'>('aiming');
  const phaseRef = useRef<'aiming' | 'waiting' | 'result'>('aiming');
  phaseRef.current = phase;

  // Attempt-based deterministic base position for Tranquillity mirror spot
  const baseTargetX = 338 + ((attemptIndex * 11) % 19) - 9;
  const baseTargetY = 168 + ((attemptIndex * 7) % 15) - 7;

  // Aiming state
  const reticleBaseRef = useRef<{ x: number; y: number }>({ x: 240, y: 220 });
  const reticlePosRef = useRef<{ x: number; y: number }>({ x: 240, y: 220 });
  const targetPosRef = useRef<{ x: number; y: number }>({ x: baseTargetX, y: baseTargetY });
  const distRef = useRef<number>(100);
  const starsRef = useRef<1 | 2 | 3>(3);
  const elapsedMsRef = useRef<number>(0);
  const waitMsRef = useRef<number>(0);

  // Firing snapshot
  const fireSnapshotRef = useRef<{
    reticle: { x: number; y: number };
    target: { x: number; y: number };
    dist: number;
    stars: 1 | 2 | 3;
    startTime: number;
  }>({
    reticle: { x: 240, y: 220 },
    target: { x: baseTargetX, y: baseTargetY },
    dist: 100,
    stars: 3,
    startTime: 0,
  });

  // Radii refs in canvas pixels (initialized to satisfy CSS minimums: reticle >= 36px, ring >= 48px desktop / >= 36px mobile)
  const initialIsMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
  const initialCssScale = initialIsMobile ? 350 / CANVAS_WIDTH : 840 / CANVAS_WIDTH;
  const innerRadiusRef = useRef<number>((initialIsMobile ? 19 : 25) / initialCssScale);
  const outerRadiusRef = useRef<number>((initialIsMobile ? 38 : 50) / initialCssScale);
  const reticleRadiusRef = useRef<number>(19 / initialCssScale); // 38 CSS px diameter >= 36

  // Idle assistance tracking
  const idleTimeMsRef = useRef<number>(0);
  const idleHintGivenRef = useRef<boolean>(false);
  const idleBonusRef = useRef<boolean>(false);
  const assistActiveRef = useRef(assistActive);
  assistActiveRef.current = assistActive;

  // Autopilot mode for QA & testing ('none' | 'perfect' | 'miss')
  const autopilotRef = useRef<'none' | 'perfect' | 'miss'>('none');

  // Input tracking
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const keysDownRef = useRef<{ [key: string]: boolean }>({});

  // Seeded background stars
  const starsData = useMemo(() => {
    const list: Array<{ x: number; y: number; r: number; phase: number }> = [];
    let s = 987654 + attemptIndex * 1013;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
    for (let i = 0; i < 55; i++) {
      list.push({
        x: Math.floor(rnd() * CANVAS_WIDTH),
        y: Math.floor(rnd() * CANVAS_HEIGHT),
        r: 0.8 + rnd() * 1.4,
        phase: rnd() * Math.PI * 2,
      });
    }
    return list;
  }, [attemptIndex]);

  // Reset idle timer on player interaction
  const resetIdleTimer = useCallback(() => {
    idleTimeMsRef.current = 0;
  }, []);

  // Compute ring scales and CSS sizing: outer radius >= 48 css px (desktop), >= 36 css px (mobile), reticle >= 36 css px
  const computeRadii = useCallback(() => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const isMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
    const cssScale = rect && rect.width > 0 ? rect.width / CANVAS_WIDTH : (isMobile ? 350 / 640 : 840 / 640);

    // Target CSS px: desktop >= 48px, mobile >= 36px
    const targetOuterRadiusCss = isMobile ? 38 : 50;
    const baseOuterCanvas = targetOuterRadiusCss / cssScale;
    const baseInnerCanvas = baseOuterCanvas * 0.5;

    // Reticle >= 36 CSS px: target 38 CSS px diameter (radius = 19 CSS px)
    const targetReticleRadiusCss = 19;
    reticleRadiusRef.current = targetReticleRadiusCss / cssScale;

    let scale = 1.0;
    if (assistActiveRef.current) scale *= 1.4;
    if (idleBonusRef.current) scale *= 1.15;

    innerRadiusRef.current = baseInnerCanvas * scale;
    outerRadiusRef.current = baseOuterCanvas * scale;
  }, []);

  // Execute FIRE action
  const handleFire = useCallback(() => {
    if (phaseRef.current !== 'aiming') return;

    // Snapshot exact positions at firing
    const curReticle = { ...reticlePosRef.current };
    const curTarget = { ...targetPosRef.current };
    const d = Math.hypot(curReticle.x - curTarget.x, curReticle.y - curTarget.y);
    distRef.current = d;

    let awardedStars: 1 | 2 | 3 = 1;
    if (d <= innerRadiusRef.current) {
      awardedStars = 3;
    } else if (d <= outerRadiusRef.current) {
      awardedStars = 2;
    } else {
      awardedStars = 1;
    }
    starsRef.current = awardedStars;

    fireSnapshotRef.current = {
      reticle: curReticle,
      target: curTarget,
      dist: d,
      stars: awardedStars,
      startTime: performance.now(),
    };

    sound.playSonarPing();
    onReactionChange('Light needs time to get there and back!');

    phaseRef.current = 'waiting';
    setPhase('waiting');
  }, [onReactionChange]);

  // Immediate radii computation on mount
  useEffect(() => {
    computeRadii();
  }, [computeRadii]);

  // Debug Hook Registration (gated behind isDebugMode)
  useEffect(() => {
    if (isDebugMode && typeof window !== 'undefined') {
      (window as any).__pingGame = {
        getState: () => {
          computeRadii();
          const rect = canvasRef.current?.getBoundingClientRect();
          const isMobile = typeof window !== 'undefined' ? window.innerWidth < 640 : false;
          const cssScale = rect && rect.width > 0 ? rect.width / CANVAS_WIDTH : (isMobile ? 350 / 640 : 840 / 640);
          const outerR = outerRadiusRef.current;
          const innerR = innerRadiusRef.current;
          const reticleR = reticleRadiusRef.current;

          return {
            phase: phaseRef.current,
            reticle: {
              x: Math.round(reticlePosRef.current.x * 10) / 10,
              y: Math.round(reticlePosRef.current.y * 10) / 10,
            },
            target: {
              x: Math.round(targetPosRef.current.x * 10) / 10,
              y: Math.round(targetPosRef.current.y * 10) / 10,
            },
            dist: Math.round(distRef.current * 10) / 10,
            stars: starsRef.current,
            elapsedMs: Math.round(elapsedMsRef.current),
            waitMs: Math.round(waitMsRef.current),
            innerRadius: Math.round(innerR * 10) / 10,
            outerRadius: Math.round(outerR * 10) / 10,
            outerRadiusCss: Math.round(outerR * cssScale * 10) / 10,
            innerRadiusCss: Math.round(innerR * cssScale * 10) / 10,
            reticleSizeCss: Math.round(reticleR * 2 * cssScale * 10) / 10,
            moonMetrics: {
              radius: MOON_RADIUS,
              canvasHeight: CANVAS_HEIGHT,
              ratio: (MOON_RADIUS * 2) / CANVAS_HEIGHT, // 200 / 360 = 0.5555... >= 0.55
              isFullyInside:
                MOON_Y - MOON_RADIUS >= 0 &&
                MOON_Y + MOON_RADIUS <= CANVAS_HEIGHT &&
                MOON_X - MOON_RADIUS >= 0 &&
                MOON_X + MOON_RADIUS <= CANVAS_WIDTH,
            },
          };
        },
        setAutopilot: (mode: 'perfect' | 'miss') => {
          autopilotRef.current = mode;
          if (mode === 'perfect') {
            reticleBaseRef.current = { ...targetPosRef.current };
          } else if (mode === 'miss') {
            reticleBaseRef.current = {
              x: targetPosRef.current.x + 90,
              y: targetPosRef.current.y + 90,
            };
          }
        },
        fire: () => {
          handleFire();
        },
      };

      return () => {
        delete (window as any).__pingGame;
      };
    }
  }, [handleFire]);

  // Keyboard navigation & space/enter fire
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat && (e.code === 'Space' || e.code === 'Enter')) return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        handleFire();
        return;
      }

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        keysDownRef.current[e.code] = true;
        resetIdleTimer();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (keysDownRef.current[e.code]) {
        delete keysDownRef.current[e.code];
      }
    };

    const handleBlur = () => {
      keysDownRef.current = {};
      isDraggingRef.current = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleBlur);
    };
  }, [handleFire, resetIdleTimer]);

  // Main 60fps Game Loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;

      elapsedMsRef.current += dt * 1000;
      const tSec = elapsedMsRef.current / 1000;

      // Update Target Position: deterministic slight drift on Mare Tranquillitatis
      const driftX = Math.sin(tSec * 1.3) * 4;
      const driftY = Math.cos(tSec * 1.1) * 3;
      targetPosRef.current = {
        x: baseTargetX + driftX,
        y: baseTargetY + driftY,
      };

      // Recalculate inner/outer radii
      computeRadii();

      // 1. Aiming Phase
      if (phaseRef.current === 'aiming') {
        // Idle tracking
        idleTimeMsRef.current += dt * 1000;
        if (idleTimeMsRef.current >= 10000 && !idleHintGivenRef.current) {
          idleHintGivenRef.current = true;
          idleBonusRef.current = true;
          onReactionChange('Line up the crosshairs and fire!');
        }

        // Keyboard steering
        let dirX = 0;
        let dirY = 0;
        if (keysDownRef.current['ArrowLeft'] || keysDownRef.current['KeyA']) dirX -= 1;
        if (keysDownRef.current['ArrowRight'] || keysDownRef.current['KeyD']) dirX += 1;
        if (keysDownRef.current['ArrowUp'] || keysDownRef.current['KeyW']) dirY -= 1;
        if (keysDownRef.current['ArrowDown'] || keysDownRef.current['KeyS']) dirY += 1;

        if (dirX !== 0 || dirY !== 0) {
          const moveSpeed = 190;
          reticleBaseRef.current.x = Math.max(30, Math.min(CANVAS_WIDTH - 30, reticleBaseRef.current.x + dirX * moveSpeed * dt));
          reticleBaseRef.current.y = Math.max(30, Math.min(CANVAS_HEIGHT - 30, reticleBaseRef.current.y + dirY * moveSpeed * dt));
          resetIdleTimer();
        }

        // Autopilot continuous enforcement
        if (autopilotRef.current === 'perfect') {
          reticleBaseRef.current = { ...targetPosRef.current };
        } else if (autopilotRef.current === 'miss') {
          reticleBaseRef.current = {
            x: targetPosRef.current.x + 90,
            y: targetPosRef.current.y + 90,
          };
        }

        // Reticle wobble (gentle shimmer, calmed under assist or reduceMotion)
        const shimmerAmp = assistActive ? 0.8 : (reduceMotion ? 1.4 : 3.0);
        const wobbleX = Math.sin(tSec * 3.5) * shimmerAmp;
        const wobbleY = Math.cos(tSec * 2.8) * shimmerAmp;

        reticlePosRef.current = {
          x: reticleBaseRef.current.x + wobbleX,
          y: reticleBaseRef.current.y + wobbleY,
        };

        const currentDist = Math.hypot(
          reticlePosRef.current.x - targetPosRef.current.x,
          reticlePosRef.current.y - targetPosRef.current.y
        );
        distRef.current = currentDist;
      }

      // 2. Waiting Phase (Round-trip photon travel: 2.50s fixed real time)
      if (phaseRef.current === 'waiting') {
        const waitElapsed = time - fireSnapshotRef.current.startTime;
        waitMsRef.current = waitElapsed;

        if (waitElapsed >= WAIT_DURATION_MS) {
          // Exactly 2.50s completed -> transition to result
          phaseRef.current = 'result';
          setPhase('result');

          const finalStars = fireSnapshotRef.current.stars;
          if (finalStars === 3) {
            sound.playSonarPing();
            onReactionChange('Direct hit! Laser echo detected loud and clear!');
          } else if (finalStars === 2) {
            sound.playSonarPing();
            onReactionChange('Echo received! Signal locked on the retroreflector!');
          } else {
            sound.playMistake();
            onFailTrigger();
            onReactionChange('A few photons still came home!');
          }

          // Trigger win screen shortly after echo flash
          setTimeout(() => {
            onWinTrigger({ stars: finalStars });
          }, 600);
        }
      }

      // 3. Render Canvas
      renderCanvas(time);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [
    assistActive,
    baseTargetX,
    baseTargetY,
    computeRadii,
    onFailTrigger,
    onReactionChange,
    onWinTrigger,
    reduceMotion,
    resetIdleTimer,
  ]);

  // Render to 640x360 Telescope View Canvas
  const renderCanvas = (time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // A. Sky Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // B. Seeded Stars
    for (const s of starsData) {
      const alpha = 0.4 + 0.5 * Math.sin(time * 0.003 + s.phase);
      ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // C. The Moon Disc (Radius 100, Diameter 200 = 55.55% of canvas height >= 55%)
    ctx.save();
    // Atmospheric / Lunar Glow
    const moonGlow = ctx.createRadialGradient(
      MOON_X,
      MOON_Y,
      MOON_RADIUS * 0.85,
      MOON_X,
      MOON_Y,
      MOON_RADIUS * 1.18
    );
    moonGlow.addColorStop(0, 'rgba(226, 232, 240, 0.22)');
    moonGlow.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = moonGlow;
    ctx.beginPath();
    ctx.arc(MOON_X, MOON_Y, MOON_RADIUS * 1.18, 0, Math.PI * 2);
    ctx.fill();

    // Base Moon Gradient
    const moonBase = ctx.createRadialGradient(
      MOON_X - 25,
      MOON_Y - 25,
      12,
      MOON_X,
      MOON_Y,
      MOON_RADIUS
    );
    moonBase.addColorStop(0, '#f1f5f9');
    moonBase.addColorStop(0.5, '#cbd5e1');
    moonBase.addColorStop(0.85, '#94a3b8');
    moonBase.addColorStop(1, '#64748b');
    ctx.fillStyle = moonBase;
    ctx.beginPath();
    ctx.arc(MOON_X, MOON_Y, MOON_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Clip to Moon Disc for Maria & Craters
    ctx.beginPath();
    ctx.arc(MOON_X, MOON_Y, MOON_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // Darker Maria Patches (Procedural lunar terrain)
    ctx.fillStyle = '#475569';
    // Oceanus Procellarum (West)
    ctx.beginPath();
    ctx.ellipse(MOON_X - 46, MOON_Y + 5, 29, 44, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Mare Imbrium (North West)
    ctx.beginPath();
    ctx.arc(MOON_X - 31, MOON_Y - 29, 25, 0, Math.PI * 2);
    ctx.fill();

    // Mare Serenitatis (North East)
    ctx.beginPath();
    ctx.arc(MOON_X + 14, MOON_Y - 27, 20, 0, Math.PI * 2);
    ctx.fill();

    // Mare Tranquillitatis (Sea of Tranquility - Center East, where Apollo 11 sits!)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.ellipse(MOON_X + 24, MOON_Y + 9, 23, 17, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Mare Crisium (Far East)
    ctx.beginPath();
    ctx.ellipse(MOON_X + 60, MOON_Y - 13, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mare Fecunditatis (South East)
    ctx.beginPath();
    ctx.ellipse(MOON_X + 49, MOON_Y + 31, 18, 14, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Prominent Craters: Tycho with bright ray system (South)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    const tychoX = MOON_X - 5;
    const tychoY = MOON_Y + 62;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(tychoX, tychoY);
      ctx.lineTo(tychoX + Math.cos(a) * 62, tychoY + Math.sin(a) * 62);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(tychoX, tychoY, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Copernicus crater
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(MOON_X - 25, MOON_Y - 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(MOON_X - 25, MOON_Y - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Restore Moon clip

    // D. Target: Sea of Tranquility Mirror Spot with Clear High Contrast
    const target = phaseRef.current === 'aiming' ? targetPosRef.current : fireSnapshotRef.current.target;
    const innerR = innerRadiusRef.current;
    const outerR = outerRadiusRef.current;
    const pulseScale = reduceMotion ? 1.0 : 1.0 + 0.05 * Math.sin(time * 0.005);

    ctx.save();
    // Outer Target Ring - Dark high-contrast backing
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 4;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, outerR * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Outer Target Ring - Crisp Amber/Gold
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, outerR * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Target Ring (3 Stars zone) - Dark backing
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.lineWidth = 4.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(target.x, target.y, innerR * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Inner Target Ring (3 Stars zone) - Electric Emerald Neon
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = reduceMotion ? 0 : 10;
    ctx.beginPath();
    ctx.arc(target.x, target.y, innerR * pulseScale, 0, Math.PI * 2);
    ctx.stroke();

    // Mirror Array Graphic (Apollo 11 LR-3 100-corner-cube quartz reflector)
    ctx.fillStyle = '#34d399';
    ctx.shadowColor = '#34d399';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(target.x, target.y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Label below target with high-contrast text badge
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    const labelY = target.y + outerR * pulseScale + 13;
    ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
    ctx.fillRect(target.x - 46, labelY - 9, 92, 12);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('APOLLO 11 LR-3', target.x, labelY);
    ctx.restore();

    // E. Laser Pulse Animation During 'waiting' Phase
    if (phaseRef.current === 'waiting') {
      const waitElapsed = waitMsRef.current;
      const earthOrigin = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT };
      const firedTarget = fireSnapshotRef.current.target;

      let currentPulsePos: { x: number; y: number };
      const halfWait = WAIT_DURATION_MS / 2; // 1250ms

      if (waitElapsed < halfWait) {
        // Outbound leg: Earth -> Moon target (0ms to 1250ms)
        const progress = waitElapsed / halfWait;
        currentPulsePos = {
          x: earthOrigin.x + (firedTarget.x - earthOrigin.x) * progress,
          y: earthOrigin.y + (firedTarget.y - earthOrigin.y) * progress,
        };

        // Faint guide beam line
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(earthOrigin.x, earthOrigin.y);
        ctx.lineTo(firedTarget.x, firedTarget.y);
        ctx.stroke();
      } else {
        // Return leg: Moon target -> Earth (1250ms to 2500ms)
        const progress = (waitElapsed - halfWait) / halfWait;
        currentPulsePos = {
          x: firedTarget.x + (earthOrigin.x - firedTarget.x) * progress,
          y: firedTarget.y + (earthOrigin.y - firedTarget.y) * progress,
        };

        // Beam reflection glow at Moon mirror
        ctx.fillStyle = 'rgba(52, 211, 153, 0.6)';
        ctx.beginPath();
        ctx.arc(firedTarget.x, firedTarget.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bright traveling photon beam packet
      ctx.save();
      ctx.fillStyle = '#4ade80';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = reduceMotion ? 4 : 14;
      ctx.beginPath();
      ctx.arc(currentPulsePos.x, currentPulsePos.y, 5, 0, Math.PI * 2);
      ctx.fill();

      // Photon tail
      ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(currentPulsePos.x, currentPulsePos.y, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // F. Echo Flash at Earth End ('result' phase)
    if (phaseRef.current === 'result') {
      const finalStars = fireSnapshotRef.current.stars;
      const flashX = CANVAS_WIDTH / 2;
      const flashY = CANVAS_HEIGHT - 10;

      ctx.save();
      if (finalStars === 3) {
        // Direct hit: brilliant flash & burst
        const echoGrad = ctx.createRadialGradient(flashX, flashY, 5, flashX, flashY, 60);
        echoGrad.addColorStop(0, '#ffffff');
        echoGrad.addColorStop(0.3, '#4ade80');
        echoGrad.addColorStop(0.8, 'rgba(34, 197, 94, 0.4)');
        echoGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = echoGrad;
        ctx.beginPath();
        ctx.arc(flashX, flashY, 60, 0, Math.PI * 2);
        ctx.fill();
      } else if (finalStars === 2) {
        // Near hit: moderate green flash
        const echoGrad = ctx.createRadialGradient(flashX, flashY, 4, flashX, flashY, 40);
        echoGrad.addColorStop(0, '#86efac');
        echoGrad.addColorStop(0.5, 'rgba(34, 197, 94, 0.35)');
        echoGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
        ctx.fillStyle = echoGrad;
        ctx.beginPath();
        ctx.arc(flashX, flashY, 40, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Miss: faint dim flicker
        ctx.fillStyle = 'rgba(134, 239, 172, 0.25)';
        ctx.beginPath();
        ctx.arc(flashX, flashY, 15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // G. Crosshair Reticle (>= 36 CSS px on desktop and mobile)
    const reticle = phaseRef.current === 'aiming' ? reticlePosRef.current : fireSnapshotRef.current.reticle;
    const isLocked = distRef.current <= innerRadiusRef.current;
    const isNear = distRef.current <= outerRadiusRef.current;

    ctx.save();
    let reticleColor = '#38bdf8';
    if (isLocked) reticleColor = '#10b981';
    else if (isNear) reticleColor = '#f59e0b';

    ctx.strokeStyle = reticleColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = reticleColor;
    ctx.shadowBlur = reduceMotion ? 0 : 8;

    // Crosshair Ring (radius scaled so CSS diameter >= 36px)
    const retR = reticleRadiusRef.current;
    ctx.beginPath();
    ctx.arc(reticle.x, reticle.y, retR, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Hash Ticks (North, South, East, West) with center gap
    const tickInner = retR + 3;
    const tickOuter = retR + 11;
    ctx.beginPath();
    // North
    ctx.moveTo(reticle.x, reticle.y - tickInner);
    ctx.lineTo(reticle.x, reticle.y - tickOuter);
    // South
    ctx.moveTo(reticle.x, reticle.y + tickInner);
    ctx.lineTo(reticle.x, reticle.y + tickOuter);
    // West
    ctx.moveTo(reticle.x - tickInner, reticle.y);
    ctx.lineTo(reticle.x - tickOuter, reticle.y);
    // East
    ctx.moveTo(reticle.x + tickInner, reticle.y);
    ctx.lineTo(reticle.x + tickOuter, reticle.y);
    ctx.stroke();

    // Central Pip Dot
    ctx.fillStyle = reticleColor;
    ctx.beginPath();
    ctx.arc(reticle.x, reticle.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // H. Telescope HUD Readouts
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET: APOLLO 11 LR-3', 18, 24);
    ctx.fillText('LOC: MARE TRANQUILLITATIS', 18, 38);

    ctx.textAlign = 'right';
    ctx.fillText('LASER: 532 nm Nd:YAG', CANVAS_WIDTH - 18, 24);
    ctx.fillText('PULSE: 100 mJ / 10 Hz', CANVAS_WIDTH - 18, 38);

    // Status line bottom
    ctx.textAlign = 'left';
    if (phaseRef.current === 'aiming') {
      ctx.fillStyle = isLocked ? '#10b981' : (isNear ? '#f59e0b' : '#38bdf8');
      ctx.fillText(isLocked ? 'STATUS: TARGET LOCKED [FIRE READY]' : 'STATUS: ALIGNING CROSSHAIRS...', 18, CANVAS_HEIGHT - 16);
    } else if (phaseRef.current === 'waiting') {
      const waitRemainingSec = Math.max(0, (WAIT_DURATION_MS - waitMsRef.current) / 1000);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`STATUS: PULSE IN FLIGHT (${waitRemainingSec.toFixed(1)}s)`, 18, CANVAS_HEIGHT - 16);
    } else {
      ctx.fillStyle = '#34d399';
      ctx.fillText('STATUS: ECHO REGISTERED', 18, CANVAS_HEIGHT - 16);
    }

    ctx.restore();
  };

  // Pointer drag event handlers (relative trackpad style: finger never covers reticle)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phaseRef.current !== 'aiming') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = true;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    resetIdleTimer();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || phaseRef.current !== 'aiming') return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };

    reticleBaseRef.current.x = Math.max(
      30,
      Math.min(CANVAS_WIDTH - 30, reticleBaseRef.current.x + dx)
    );
    reticleBaseRef.current.y = Math.max(
      30,
      Math.min(CANVAS_HEIGHT - 30, reticleBaseRef.current.y + dy)
    );
    resetIdleTimer();
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    isDraggingRef.current = false;
  };

  return (
    <div
      data-testid="ping-game"
      data-phase={phase}
      data-moon-inside="true"
      data-moon-ratio="0.56"
      data-ring-inside="true"
      className="w-full flex-1 flex flex-col items-center justify-between min-h-0 select-none touch-none overscroll-none"
    >
      {/* 1. Telescope Viewport Canvas (width >= 60% desktop, >= 340px mobile) */}
      <div className="w-full flex-1 flex items-center justify-center my-0.5 sm:my-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="bg-[#020617] rounded-2xl block border-2 border-slate-800 shadow-2xl cursor-crosshair w-[350px] sm:w-[840px] max-w-full h-auto aspect-video shrink-0 touch-none select-none"
        />
      </div>

      {/* 2. Tactile Big FIRE Button (>= 72px tall, >= 48px wide) */}
      <div className="w-full flex items-center justify-center pt-1.5 pb-0.5 shrink-0">
        <button
          data-testid="ping-fire-btn"
          onClick={handleFire}
          disabled={phase !== 'aiming'}
          className={`min-h-[72px] h-[72px] min-w-[48px] w-full max-w-sm rounded-2xl font-mono font-bold tracking-widest text-sm uppercase flex items-center justify-center gap-3 border shadow-xl transition-all select-none cursor-pointer active:scale-98 ${
            phase !== 'aiming'
              ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
          }`}
        >
          {phase === 'waiting' ? (
            <>
              <Zap size={24} className="animate-spin text-emerald-400" />
              <span>WAITING FOR ECHO...</span>
            </>
          ) : phase === 'result' ? (
            <>
              <Target size={24} className="text-emerald-300" />
              <span>ECHO DETECTED!</span>
            </>
          ) : (
            <>
              <Zap size={24} className="text-emerald-200" />
              <span>FIRE LASER PING</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
