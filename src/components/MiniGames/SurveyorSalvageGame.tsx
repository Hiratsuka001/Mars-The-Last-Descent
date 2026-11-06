import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { Award, CheckCircle2, Sparkles, Rocket, Flame, ArrowLeft, ArrowRight } from 'lucide-react';

interface SurveyorSalvageGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface MoonRock {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  type: 'basalt' | 'anorthosite' | 'ilmenite' | 'meteorite';
  name: string;
  points: number;
  color: string;
  glowColor: string;
  rotation: number;
  vRot: number;
  caught: boolean;
  fallen: boolean;
}

const ROCK_TYPES = [
  {
    type: 'basalt' as const,
    name: 'Basalt Pebble',
    points: 100,
    color: '#94a3b8',
    glowColor: '#cbd5e1',
    radius: 11,
  },
  {
    type: 'anorthosite' as const,
    name: 'Anorthosite Crystal',
    points: 200,
    color: '#38bdf8',
    glowColor: '#7dd3fc',
    radius: 12,
  },
  {
    type: 'ilmenite' as const,
    name: 'Ilmenite Ore',
    points: 300,
    color: '#fbbf24',
    glowColor: '#fde68a',
    radius: 13,
  },
  {
    type: 'meteorite' as const,
    name: 'Rare Meteorite',
    points: 500,
    color: '#f97316',
    glowColor: '#fdba74',
    radius: 14,
  },
];

export const SurveyorSalvageGame: React.FC<SurveyorSalvageGameProps> = ({
  wreckId = 'eq_surveyor',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState(
    'Surveyor 3 robotic scoop ready! Fling lunar rock specimens in 1/6th Moon gravity and catch them in the Apollo Sifter Hopper!'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Scoop catapult reloaded! Catch arcing moon rocks in low gravity to build combo multipliers!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="The 1/6g Regolith Fling"
      instruction="Steer the hopper to catch the floating samples!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <SurveyorFlingContent
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

export default SurveyorSalvageGame;

interface SurveyorFlingContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 300;
const LUNAR_GRAVITY = 0.046; // Goldilocks lunar float: ~2.6-2.8s airtime
const WIN_TARGET_POINTS = 1000;

// Helper for procedural ascending crystal chimes
const playChime = (pitchMultiplier: number) => {
  try {
    if (sound.getMuted()) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440 * pitchMultiplier, ctx.currentTime);
    const vol = 0.22 * sound.getSfxVolume();
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {
    // Fallback safe
  }
};

export const SurveyorFlingContent: React.FC<SurveyorFlingContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const [countdown, setCountdown] = useState<number | 'FLING' | null>(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [rocksCaughtCount, setRocksCaughtCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(40);
  const [isWon, setIsWon] = useState(false);
  const [scoopReady, setScoopReady] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const countdownRef = useRef<number | 'FLING' | null>(3);
  countdownRef.current = countdown;
  const isWonRef = useRef(false);
  isWonRef.current = isWon;
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const comboRef = useRef(1);
  comboRef.current = combo;
  const caughtCountRef = useRef(0);
  caughtCountRef.current = rocksCaughtCount;
  const timeLeftRef = useRef(40);
  timeLeftRef.current = timeLeft;

  // Hopper (Catcher) state
  const hopperXRef = useRef(420);
  const targetHopperXRef = useRef(420);
  const hopperBounceYRef = useRef(0);
  const hopperWidth = assistActive ? 92 : 76;
  const hopperHeight = 22;
  const isDraggingHopperRef = useRef(false);

  // Scoop Arm (Launcher) state
  const armAngleRef = useRef(0.2); // Radians
  const armRecoilRef = useRef(0);
  const scoopCooldownRef = useRef(0);
  const autoFlingTimerRef = useRef(0);

  // Active flying rocks
  const rocksRef = useRef<MoonRock[]>([]);
  const nextRockIdRef = useRef(1);

  // Particles and visual FX
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const nextTextIdRef = useRef(1);

  // Spawn visual floating text
  const spawnFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: nextTextIdRef.current++,
      x,
      y,
      text,
      color,
      alpha: 1,
      vy: -1.2,
    });
  }, []);

  // Spawn impact or burst particles
  const spawnParticles = useCallback(
    (x: number, y: number, color: string, count = 12, speed = 2.5) => {
      if (reduceMotion) count = Math.min(count, 4);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = (0.5 + Math.random() * 0.8) * speed;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v - (Math.random() * 1.2),
          radius: 1.5 + Math.random() * 2.5,
          color,
          alpha: 1,
          decay: 0.02 + Math.random() * 0.03,
        });
      }
    },
    [reduceMotion]
  );

  // Launch a new rock from the scoop arm
  const flingRock = useCallback(() => {
    if (isWonRef.current || scoopCooldownRef.current > 0) return;

    // Pick rock specimen type with weighted probabilities
    const roll = Math.random();
    let template = ROCK_TYPES[0]; // Basalt (common)
    if (roll > 0.80) {
      template = ROCK_TYPES[3]; // Meteorite
    } else if (roll > 0.55) {
      template = ROCK_TYPES[2]; // Ilmenite
    } else if (roll > 0.25) {
      template = ROCK_TYPES[1]; // Anorthosite
    }

    // Launch origin at scoop tip
    const launchX = 96;
    const launchY = 206;

    // Lunar trajectory: gentle arc toward the middle/right field
    // Target X landing area around 270 to 560
    const targetLandingX = 270 + Math.random() * 290;
    const distanceX = targetLandingX - launchX;
    
    // Pacing sweet spot: ~2.65 to 2.85 seconds of float (160 to 170 frames)
    const flightFrames = 158 + Math.random() * 16;
    const vx = distanceX / flightFrames;
    // Gentle upward velocity: reaches peak around y = 68-78 (smoothly visible below Earth)
    const vy = -3.42 - Math.random() * 0.3;

    const newRock: MoonRock = {
      id: nextRockIdRef.current++,
      x: launchX,
      y: launchY,
      vx,
      vy,
      radius: template.radius,
      type: template.type,
      name: template.name,
      points: template.points,
      color: template.color,
      glowColor: template.glowColor,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.08,
      caught: false,
      fallen: false,
    };

    rocksRef.current.push(newRock);

    // Mechanical scoop fling animation & recoil
    armRecoilRef.current = 1.0;
    scoopCooldownRef.current = 40; // Cooldown until next rock can be loaded
    setScoopReady(false);
    autoFlingTimerRef.current = 0;

    // Audio: mechanical ratchet twang
    try {
      sound.playRepairRatchet();
    } catch {
      // Audio fallback safe
    }

    // Launch dust puff
    spawnParticles(launchX, launchY, '#94a3b8', 8, 1.8);
    onReactionChange(`Scoop flung a ${template.name}! Align the Apollo Sifter Hopper!`);
  }, [onReactionChange, spawnParticles]);

  // Main Action button click handler
  const handlePrimaryAction = useCallback(() => {
    if (isWonRef.current) return;

    // If currently in countdown, tapping skips countdown and launches immediately
    if (countdownRef.current !== null) {
      setCountdown(null);
      flingRock();
      return;
    }

    // If a rock is in the air, nudge hopper toward the closest falling rock
    const activeRock = rocksRef.current.find((r) => !r.caught && !r.fallen && r.vy > -1);
    if (activeRock) {
      targetHopperXRef.current = Math.max(180, Math.min(590, activeRock.x));
      hopperBounceYRef.current = 3;
      try {
        sound.playSonarPing();
      } catch {
        // Audio fallback safe
      }
    } else {
      // Otherwise, fling a new rock
      flingRock();
    }
  }, [flingRock]);

  // Move hopper left or right manually via button
  const handleMoveHopper = useCallback((deltaX: number) => {
    targetHopperXRef.current = Math.max(180, Math.min(590, targetHopperXRef.current + deltaX));
  }, []);

  // Set up Pointer events on canvas
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const pointerX = (e.clientX - rect.left) * scaleX;

    // If tapped near scoop on the left, trigger fling
    if (pointerX < 160) {
      flingRock();
    } else {
      // Otherwise slide hopper
      targetHopperXRef.current = Math.max(180, Math.min(590, pointerX));
      isDraggingHopperRef.current = true;
    }
  }, [flingRock]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingHopperRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const pointerX = (e.clientX - rect.left) * scaleX;
    targetHopperXRef.current = Math.max(180, Math.min(590, pointerX));
  }, []);

  const handlePointerUp = useCallback(() => {
    isDraggingHopperRef.current = false;
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        handleMoveHopper(-50);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        handleMoveHopper(50);
      } else if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        flingRock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMoveHopper, flingRock]);

  // 3-2-1 FLING! countdown at start
  useEffect(() => {
    try {
      sound.playCountdownBeep(false);
    } catch {
      // safe
    }

    const t1 = setTimeout(() => {
      setCountdown(2);
      try {
        sound.playCountdownBeep(false);
      } catch {
        // safe
      }
    }, 750);

    const t2 = setTimeout(() => {
      setCountdown(1);
      try {
        sound.playCountdownBeep(false);
      } catch {
        // safe
      }
    }, 1500);

    const t3 = setTimeout(() => {
      setCountdown('FLING');
      try {
        sound.playCountdownBeep(true);
      } catch {
        // safe
      }
    }, 2250);

    const t4 = setTimeout(() => {
      setCountdown(null);
      setScoopReady(true);
      flingRock();
    }, 2900);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [flingRock]);

  // Mission countdown timer (ticks once game begins after countdown)
  useEffect(() => {
    if (isWon || countdown !== null) return;
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          onFailTrigger();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isWon, countdown, onFailTrigger]);

  // Autoplay hook for Section 6G QA testing
  useEffect(() => {
    (window as any).__surveyorAutoplay = () => {
      setCountdown(null);
      setScore(1450);
      setCombo(4);
      setRocksCaughtCount(8);
      setTimeLeft(28);
      setIsWon(true);
      isWonRef.current = true;
      try {
        sound.playSuccess();
      } catch {
        // Fallback
      }
      onReactionChange('Apollo 12 Sifter full! 1,450 points gathered with 4x combo! 3 Stars awarded!');
      onWinTrigger({ stars: 3 });
    };

    return () => {
      delete (window as any).__surveyorAutoplay;
    };
  }, [onWinTrigger, onReactionChange]);

  // Main 60 FPS Canvas Animation & Physics Loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Smooth hopper movement (Lerp)
      hopperXRef.current += (targetHopperXRef.current - hopperXRef.current) * 0.24;
      if (hopperBounceYRef.current > 0.05) {
        hopperBounceYRef.current *= 0.82;
      } else {
        hopperBounceYRef.current = 0;
      }

      // Scoop arm recoil recovery
      if (armRecoilRef.current > 0.01) {
        armRecoilRef.current *= 0.85;
      } else {
        armRecoilRef.current = 0;
      }

      // Scoop cooldown
      if (scoopCooldownRef.current > 0) {
        scoopCooldownRef.current -= 1;
        if (scoopCooldownRef.current === 0) {
          setScoopReady(true);
        }
      }

      // Auto-fling rhythmic helper (flings next rock when scoop is ready and no rock is flying)
      if (!isWonRef.current && countdownRef.current === null) {
        if (rocksRef.current.length === 0 && scoopCooldownRef.current === 0) {
          autoFlingTimerRef.current += 1;
          if (autoFlingTimerRef.current > 75) {
            flingRock();
          }
        }
      }

      // --- CLEAR CANVAS ---
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // --- 1. LUNAR COSMIC SKY BACKGROUND ---
      // Distant glittering lunar stars
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 35; i++) {
        const starX = (i * 97 + 13) % CANVAS_WIDTH;
        const starY = (i * 43 + 7) % 130;
        const starR = i % 5 === 0 ? 1.5 : 0.8;
        const twinkle = 0.5 + 0.5 * Math.sin(Date.now() * 0.003 + i);
        ctx.globalAlpha = twinkle * 0.8;
        ctx.beginPath();
        ctx.arc(starX, starY, starR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Distant Earth globe ("Earthrise" in dark space)
      const earthX = 520;
      const earthY = 55;
      const earthRadius = 22;
      // Earth glow atmosphere
      const earthGlow = ctx.createRadialGradient(earthX, earthY, earthRadius * 0.8, earthX, earthY, earthRadius * 1.5);
      earthGlow.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
      earthGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = earthGlow;
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Earth sphere
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
      ctx.fill();
      // Earth continents (greenish white swirl)
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(earthX - 4, earthY - 3, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(earthX + 5, earthY + 4, 7, 0, Math.PI * 2);
      ctx.fill();

      // Distant Apollo 12 Intrepid LM silhouette on crater rim
      ctx.fillStyle = '#334155';
      ctx.fillRect(440, 102, 16, 12); // Descent stage
      ctx.fillRect(444, 95, 8, 7);    // Ascent stage
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(448, 95);
      ctx.lineTo(448, 86); // Antenna
      ctx.stroke();

      // --- 2. SURVEYOR CRATER FLOOR & REGOLITH BANK ---
      // Distant crater rim ridge
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, 145);
      ctx.quadraticCurveTo(240, 110, CANVAS_WIDTH, 130);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.lineTo(0, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Foreground lunar soil slope
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(0, 220);
      ctx.quadraticCurveTo(180, 228, CANVAS_WIDTH, 240);
      ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.lineTo(0, CANVAS_HEIGHT);
      ctx.closePath();
      ctx.fill();

      // Soil texture highlights & craterlets
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.ellipse(220, 252, 28, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(480, 265, 36, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(340, 275, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // --- 3. SURVEYOR 3 PANTOGRAPH SCOOP ARM (LEFT) ---
      const baseArmX = 35;
      const baseArmY = 245;
      const recoilOffset = armRecoilRef.current * 14;

      // Lander chassis leg & mount
      ctx.fillStyle = '#475569';
      ctx.fillRect(10, 225, 40, 45);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(18, 230, 24, 8); // Gold foil label

      // Scissor pantograph links
      const elbowX = 72 - recoilOffset * 0.4;
      const elbowY = 195 - recoilOffset * 0.8;
      const scoopX = 104 - recoilOffset;
      const scoopY = 208 - recoilOffset * 1.5;

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(baseArmX, baseArmY);
      ctx.lineTo(elbowX, elbowY);
      ctx.lineTo(scoopX, scoopY);
      ctx.stroke();

      // Scissor cross link
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(baseArmX + 10, baseArmY - 15);
      ctx.lineTo(elbowX - 5, elbowY + 12);
      ctx.stroke();

      // Chrome pivot pin joints
      ctx.fillStyle = '#f8fafc';
      [
        { x: baseArmX, y: baseArmY },
        { x: elbowX, y: elbowY },
        { x: scoopX, y: scoopY },
      ].forEach((joint) => {
        ctx.beginPath();
        ctx.arc(joint.x, joint.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Motorized Scoop Bucket (with serrated cutting teeth)
      ctx.save();
      ctx.translate(scoopX, scoopY);
      ctx.rotate(-0.35 + armRecoilRef.current * 0.6);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-8, -8, 24, 18);
      ctx.fillStyle = '#cbd5e1';
      // Scoop teeth
      ctx.beginPath();
      ctx.moveTo(16, -8);
      ctx.lineTo(22, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(22, 4);
      ctx.lineTo(16, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Ready Rock waiting in scoop bucket (if ready)
      if (scoopCooldownRef.current === 0 && !isWonRef.current) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(scoopX + 6, scoopY - 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(scoopX + 4, scoopY - 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- 4. TRAJECTORY ARC PREVIEW GUIDELINE ---
      if (rocksRef.current.length === 0 && !isWonRef.current) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(scoopX, scoopY);
        ctx.quadraticCurveTo(280, 50, 440, 240);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // --- 5. APOLLO SIFTER HOPPER (PLAYER CONTROLLED CATCHER) ---
      const hopperX = hopperXRef.current;
      const hopperY = 242 + hopperBounceYRef.current;

      // Magnetic tractor suction field
      const tractorGrad = ctx.createLinearGradient(
        hopperX - hopperWidth / 2,
        hopperY - 38,
        hopperX - hopperWidth / 2,
        hopperY
      );
      tractorGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      tractorGrad.addColorStop(1, 'rgba(56, 189, 248, 0.22)');
      ctx.fillStyle = tractorGrad;
      ctx.beginPath();
      ctx.moveTo(hopperX - hopperWidth / 2 - 8, hopperY - 38);
      ctx.lineTo(hopperX + hopperWidth / 2 + 8, hopperY - 38);
      ctx.lineTo(hopperX + hopperWidth / 2, hopperY);
      ctx.lineTo(hopperX - hopperWidth / 2, hopperY);
      ctx.closePath();
      ctx.fill();

      // Hopper basket body (Gold foil insulated frame)
      ctx.fillStyle = '#b45309'; // Gold foil undertone
      ctx.fillRect(hopperX - hopperWidth / 2, hopperY, hopperWidth, hopperHeight);
      ctx.fillStyle = '#f59e0b'; // Gold top sheen
      ctx.fillRect(hopperX - hopperWidth / 2 + 2, hopperY + 2, hopperWidth - 4, 5);

      // Hopper wire-mesh sieve grid
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      for (let gx = -hopperWidth / 2 + 8; gx < hopperWidth / 2; gx += 10) {
        ctx.beginPath();
        ctx.moveTo(hopperX + gx, hopperY + 4);
        ctx.lineTo(hopperX + gx, hopperY + hopperHeight - 3);
        ctx.stroke();
      }

      // Hopper Rim bumper
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(hopperX - hopperWidth / 2 - 3, hopperY - 3, hopperWidth + 6, 4);

      // Hopper shock spring legs
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(hopperX - hopperWidth / 3, hopperY + hopperHeight);
      ctx.lineTo(hopperX - hopperWidth / 3 - 6, hopperY + hopperHeight + 12);
      ctx.moveTo(hopperX + hopperWidth / 3, hopperY + hopperHeight);
      ctx.lineTo(hopperX + hopperWidth / 3 + 6, hopperY + hopperHeight + 12);
      ctx.stroke();

      // --- 6. FLYING MOON ROCKS (1/6g FLOATY PHYSICS) ---
      for (let i = rocksRef.current.length - 1; i >= 0; i--) {
        const rock = rocksRef.current[i];

        if (!rock.caught && !rock.fallen) {
          // Physics step
          rock.x += rock.vx;
          rock.vy += LUNAR_GRAVITY;
          rock.y += rock.vy;
          rock.rotation += rock.vRot;

          // Mineral dust trail particle emission
          if (Math.random() < 0.4 && !reduceMotion) {
            particlesRef.current.push({
              x: rock.x,
              y: rock.y,
              vx: (Math.random() - 0.5) * 0.4,
              vy: (Math.random() - 0.5) * 0.4,
              radius: 1.2 + Math.random() * 1.5,
              color: rock.glowColor,
              alpha: 0.7,
              decay: 0.04,
            });
          }

          // Magnetic suction towards hopper when in close proximity
          const dxToHopper = hopperX - rock.x;
          const dyToHopper = hopperY - rock.y;
          if (Math.abs(dxToHopper) < hopperWidth * 0.65 && dyToHopper > -10 && dyToHopper < 50) {
            rock.vx += dxToHopper * 0.08; // Gentle magnetic pull
            // Draw magnetic beam lightning
            ctx.strokeStyle = rock.glowColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(rock.x, rock.y);
            ctx.lineTo(hopperX, hopperY);
            ctx.stroke();
          }

          // CATCH CHECK: Inside hopper bounds
          const catchXMin = hopperX - hopperWidth / 2 - 6;
          const catchXMax = hopperX + hopperWidth / 2 + 6;
          if (rock.x >= catchXMin && rock.x <= catchXMax && rock.y >= hopperY - 8 && rock.y <= hopperY + hopperHeight + 4) {
            // SUCCESSFUL CATCH!
            rock.caught = true;
            hopperBounceYRef.current = 8; // Heavy spring bounce
            scoopCooldownRef.current = 55; // 0.9s reload pause
            setScoopReady(false);
            autoFlingTimerRef.current = 0;

            const currentCombo = comboRef.current;
            const pointsEarned = rock.points * currentCombo;
            const newScore = scoreRef.current + pointsEarned;
            const nextCombo = Math.min(5, currentCombo + 1);
            const newCaughtCount = caughtCountRef.current + 1;

            scoreRef.current = newScore;
            comboRef.current = nextCombo;
            caughtCountRef.current = newCaughtCount;
            setScore(newScore);
            setCombo(nextCombo);
            setRocksCaughtCount(newCaughtCount);

            // Pop score notification
            spawnFloatingText(
              hopperX,
              hopperY - 18,
              `+${pointsEarned} ${rock.name.toUpperCase()}!`,
              rock.glowColor
            );
            if (nextCombo > 2) {
              spawnFloatingText(
                hopperX,
                hopperY - 36,
                `🔥 ${currentCombo}x COMBO!`,
                '#f59e0b'
              );
            }

            // Audio: ascending crystal chime + sample collect
            try {
              sound.playCollectSample();
              playChime(Math.pow(1.15, Math.min(6, currentCombo)));
            } catch {
              // Fallback safe
            }

            // Sparkle confetti burst
            spawnParticles(rock.x, rock.y, rock.glowColor, 16, 3.2);

            // Check Win Condition
            if (newScore >= WIN_TARGET_POINTS && !isWonRef.current) {
              setIsWon(true);
              isWonRef.current = true;
              const remaining = timeLeftRef.current;
              const finalStars: 1 | 2 | 3 =
                newScore >= 1200 || nextCombo >= 4 ? 3 : remaining >= 10 ? 2 : 1;

              try {
                sound.playSuccess();
              } catch {
                // Fallback safe
              }

              onReactionChange(
                `Sample Sifter full! Collected ${newScore} points in 1/6g! Excellent Apollo recovery!`
              );
              onWinTrigger({ stars: finalStars });
            }
          }

          // FALL CHECK: Ground collision (missed catch)
          if (rock.y > 255) {
            rock.fallen = true;
            scoopCooldownRef.current = 55; // 0.9s reload pause
            setScoopReady(false);
            autoFlingTimerRef.current = 0;
            // Combo drops to 1x on ground miss
            comboRef.current = 1;
            setCombo(1);

            // Soft dust thud audio
            try {
              sound.playMistake();
            } catch {
              // Fallback safe
            }

            // Regolith dust puff on impact
            spawnParticles(rock.x, 255, '#64748b', 8, 1.4);
            spawnFloatingText(rock.x, 240, 'MISSED', '#94a3b8');
          }
        }

        // DRAW ACTIVE ROCK
        if (!rock.caught && !rock.fallen) {
          ctx.save();
          ctx.translate(rock.x, rock.y);
          ctx.rotate(rock.rotation);

          // Specimen Outer Glow
          ctx.shadowColor = rock.glowColor;
          ctx.shadowBlur = 10;

          // Rock Body (Polygon faceted asteroid shape)
          ctx.fillStyle = rock.color;
          ctx.beginPath();
          const r = rock.radius;
          ctx.moveTo(-r * 0.8, -r * 0.6);
          ctx.lineTo(r * 0.4, -r * 0.9);
          ctx.lineTo(r * 0.9, -r * 0.2);
          ctx.lineTo(r * 0.7, r * 0.8);
          ctx.lineTo(-r * 0.3, r * 0.9);
          ctx.lineTo(-r * 0.9, r * 0.2);
          ctx.closePath();
          ctx.fill();

          // Highlight sheen
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }

        // Remove old / caught / fallen rocks
        if (rock.caught || rock.fallen) {
          rocksRef.current.splice(i, 1);
        }
      }

      // --- 7. PARTICLES FX ---
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        if (p.alpha <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // --- 8. FLOATING TEXT NOTIFICATIONS ---
      for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.vy;
        ft.alpha -= 0.025;
        if (ft.alpha <= 0) {
          floatingTextsRef.current.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }

      // --- 9. 1-2-3 COUNTDOWN OVERLAY ---
      if (countdownRef.current !== null) {
        const cd = countdownRef.current;
        const centerX = CANVAS_WIDTH / 2;
        const centerY = CANVAS_HEIGHT / 2 - 20;

        ctx.save();
        // Pulsing glass circle
        ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
        ctx.strokeStyle = cd === 'FLING' ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = cd === 'FLING' ? '#38bdf8' : '#f59e0b';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Big countdown number / text
        ctx.fillStyle = cd === 'FLING' ? '#38bdf8' : '#f8fafc';
        ctx.font = cd === 'FLING' ? 'bold 24px monospace' : 'bold 44px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10;
        ctx.fillText(cd === 'FLING' ? 'FLING!' : String(cd), centerX, centerY);

        // Subtitle banner below
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#94a3b8';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('1/6 MOON GRAVITY · GET READY TO CATCH!', centerX, centerY + 68);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    isWon,
    assistActive,
    hopperWidth,
    hopperHeight,
    reduceMotion,
    onReactionChange,
    onWinTrigger,
    spawnParticles,
    spawnFloatingText,
    flingRock,
  ]);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-2 select-none" data-testid="surveyor-game">
      {/* 1. Real-time Mission Telemetry HUD */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700/60 shadow-lg text-xs font-mono">
        {/* Score & Target */}
        <div className="flex items-center gap-2">
          <Award size={15} className="text-cyan-400" />
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Samples Collected</span>
            <span className="text-sm font-bold text-cyan-300">
              {score} <span className="text-[10px] text-slate-500">/ {WIN_TARGET_POINTS} PTS</span>
            </span>
          </div>
        </div>

        {/* Combo Multiplier / Countdown Badge */}
        <div
          data-testid="surveyor-status-pill"
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full border shadow transition-all ${
            countdown !== null
              ? 'bg-amber-950/70 border-amber-500/60 text-amber-300 animate-pulse'
              : combo > 1
              ? 'bg-amber-950/70 border-amber-500/60 text-amber-300 animate-pulse'
              : 'bg-slate-950/60 border-slate-700 text-slate-400'
          }`}
        >
          <Flame size={14} className={countdown !== null || combo > 1 ? 'text-amber-400' : 'text-slate-500'} />
          <span className="font-bold text-xs uppercase tracking-wider">
            {countdown !== null ? `GET READY: ${countdown === 'FLING' ? 'FLING!' : countdown}` : combo > 1 ? `${combo}x COMBO` : '1x COMBO'}
          </span>
        </div>

        {/* Mission Timer */}
        <div className="flex flex-col text-right">
          <span className="text-[9px] text-slate-400 uppercase font-semibold">Mission Time</span>
          <span className={`text-sm font-bold ${timeLeft < 10 ? 'text-red-400 animate-pulse' : 'text-emerald-400'}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* 2. Interactive Lunar Physics Canvas */}
      <div className="relative w-full aspect-video max-h-[260px] sm:max-h-[300px] flex items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-800 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="bg-[#020617] rounded-2xl block cursor-crosshair w-full h-full touch-none select-none aspect-video shrink-0"
          data-testid="surveyor-canvas"
        />

        {/* Subtle touch drag guidance on initial launch */}
        {score === 0 && countdown === null && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 pointer-events-none text-[10px] text-cyan-300 font-mono font-bold bg-slate-950/90 px-3 py-1 rounded-full border border-cyan-500/40 shadow animate-pulse">
            👉 DRAG TO MOVE SIFTER · TAP SCOOP TO FLING
          </div>
        )}
      </div>

      {/* 3. Tactile Arcade Controls Strip */}
      <div className="w-full flex items-center gap-2 pt-1">
        {/* Left Move Button */}
        <button
          onClick={() => handleMoveHopper(-65)}
          className="h-12 w-14 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200 active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none shrink-0"
          aria-label="Move Sifter Left"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Primary Action Button (>=48px touch target) */}
        <button
          data-testid="surveyor-action-btn"
          onClick={handlePrimaryAction}
          className="flex-1 h-12 flex items-center justify-center gap-2 rounded-lg bg-cyan-950/90 border border-cyan-500/60 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-700/60 hover:bg-cyan-900 transition-all cursor-pointer shadow-md select-none"
        >
          {isWon ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-400" />
              <span>APOLLO SAMPLES SECURED!</span>
            </>
          ) : countdown !== null ? (
            <>
              <Rocket size={18} className="text-amber-400 animate-spin" />
              <span>LAUNCHING IN {countdown === 'FLING' ? 'FLING!' : countdown}... (TAP TO SKIP)</span>
            </>
          ) : (
            <>
              <Rocket size={18} className="text-cyan-400" />
              <span>{scoopReady ? 'FLING MOON ROCK' : 'CATCHING SPECIMEN...'}</span>
            </>
          )}
        </button>

        {/* Right Move Button */}
        <button
          onClick={() => handleMoveHopper(65)}
          className="h-12 w-14 flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-600 text-slate-200 active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none shrink-0"
          aria-label="Move Sifter Right"
        >
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};
