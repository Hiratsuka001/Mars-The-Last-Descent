import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { ChevronLeft, ChevronRight, Zap, Sparkles, Wind, Trophy } from 'lucide-react';

interface ApolloLrvGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface SampleCrate {
  id: number;
  x: number;
  y: number;
  name: string;
  subname: string;
  collected: boolean;
  color: string;
}

interface Boulder {
  id: number;
  x: number;
  y: number;
  radius: number;
  hit: boolean;
}

interface CraterJump {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  triggered: boolean;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  decay: number;
  color: string;
}

interface FloatingNotification {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export const ApolloLrvGame: React.FC<ApolloLrvGameProps> = ({
  wreckId = 'eq_lrv_buggy',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState(
    'Apollo Lunar Roving Vehicle online! Ferenc Pavlics wire-mesh tires engaged! Steer across Hadley Rille to collect 4 sample crates!'
  );

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Buggy reset at Taurus-Littrow crater ridge! Carve corners for wire-mesh rooster tails and hit crater jumps!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="Wire-Mesh Moon Drift"
      instruction="Steer the Apollo Moon Buggy! Drift across lunar regolith, hit crater jumps for 1/6g air-time, and recover 4 Apollo sample crates!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <LrvCourseContent
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

export default ApolloLrvGame;

interface LrvCourseContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 300;
const TOTAL_COURSE_DISTANCE = 1600; // Total scroll units to Lunar Module finish line
const TOTAL_SAMPLES = 4;

export const LrvCourseContent: React.FC<LrvCourseContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const [phase, setPhase] = useState<'driving' | 'won' | 'failed'>('driving');
  const [samplesCollected, setSamplesCollected] = useState(0);
  const [driftScore, setDriftScore] = useState(0);
  const [distanceProgress, setDistanceProgress] = useState(0);
  const [isAirborne, setIsAirborne] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Real-time animation references
  const phaseRef = useRef<'driving' | 'won' | 'failed'>('driving');
  phaseRef.current = phase;

  // Rover physics state
  const roverXRef = useRef(320);
  const targetXRef = useRef(320);
  const roverVxRef = useRef(0);
  const roverAngleRef = useRef(0);
  const roverSpeedRef = useRef(4.0);
  const distanceRef = useRef(0);
  const altitudeZRef = useRef(0); // 0 = ground, >0 = 1/6g airborne jump
  const altitudeVzRef = useRef(0);
  const jumpCountRef = useRef(0);
  const rockHitsRef = useRef(0);
  const isDriftingRef = useRef(false);
  const isBoostingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const shakeRef = useRef(0);

  // Input keys
  const keysHeldRef = useRef<Set<string>>(new Set());

  // Interactive world objects
  const samplesRef = useRef<SampleCrate[]>([
    {
      id: 1,
      x: 200,
      y: -300,
      name: 'Genesis Rock',
      subname: 'Anorthosite Crust (Apollo 15)',
      collected: false,
      color: '#e2e8f0',
    },
    {
      id: 2,
      x: 440,
      y: -650,
      name: 'Orange Volcanic Soil',
      subname: 'Pyroclastic Glass (Apollo 17)',
      collected: false,
      color: '#f97316',
    },
    {
      id: 3,
      x: 180,
      y: -1000,
      name: 'Big Muley Boulder',
      subname: 'Shock Impact Breccia (Apollo 16)',
      collected: false,
      color: '#38bdf8',
    },
    {
      id: 4,
      x: 360,
      y: -1350,
      name: 'Troctolite 76535',
      subname: 'Pristine Lunar Mantle (Apollo 17)',
      collected: false,
      color: '#a855f7',
    },
  ]);

  const bouldersRef = useRef<Boulder[]>([
    { id: 1, x: 310, y: -180, radius: 24, hit: false },
    { id: 2, x: 480, y: -420, radius: 26, hit: false },
    { id: 3, x: 150, y: -540, radius: 22, hit: false },
    { id: 4, x: 260, y: -800, radius: 25, hit: false },
    { id: 5, x: 420, y: -1150, radius: 26, hit: false },
    { id: 6, x: 220, y: -1250, radius: 24, hit: false },
  ]);

  const craterJumpsRef = useRef<CraterJump[]>([
    { id: 1, x: 290, y: -480, width: 140, height: 40, triggered: false },
    { id: 2, x: 380, y: -880, width: 150, height: 45, triggered: false },
    { id: 3, x: 220, y: -1200, width: 140, height: 40, triggered: false },
  ]);

  const dustParticlesRef = useRef<DustParticle[]>([]);
  const notificationsRef = useRef<FloatingNotification[]>([]);

  // NASA Quindar audio tone / Sample Chime
  const playQuindarTone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Authentic NASA Quindar Beep: 2524 Hz
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2524, ctx.currentTime);

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      sound.playSonarPing();
    }
  }, []);

  const playJumpSwoosh = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      sound.playSonarPing();
    }
  }, []);

  const playLandingThump = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(90, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      sound.playSonarPing();
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysHeldRef.current.add(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        isDriftingRef.current = true;
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        isBoostingRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        isDriftingRef.current = false;
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        isBoostingRef.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const addNotification = useCallback((x: number, y: number, text: string, color: string) => {
    notificationsRef.current.push({
      id: Date.now() + Math.random(),
      x,
      y,
      text,
      color,
      alpha: 1.0,
      vy: -1.2,
    });
  }, []);

  // Spawn wire-mesh regolith rooster-tail dust sprays
  const spawnRoosterTail = useCallback((x: number, y: number, angle: number, intensity: number) => {
    const count = Math.min(8, Math.floor(intensity * 4));
    for (let i = 0; i < count; i++) {
      const sprayAngle = angle + Math.PI + (Math.random() - 0.5) * 0.9;
      const speed = (Math.random() * 3.5 + 2.0) * intensity;
      dustParticlesRef.current.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(sprayAngle) * speed,
        vy: Math.sin(sprayAngle) * speed + 1.2, // Gravity pulls regolith down
        radius: Math.random() * 3.0 + 1.2,
        alpha: 0.85,
        decay: 0.04 + Math.random() * 0.03,
        color: Math.random() > 0.4 ? '#cbd5e1' : '#94a3b8',
      });
    }
  }, []);

  // Main canvas animation and game loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (phaseRef.current === 'driving') {
        // -------------------------------------------------------------
        // 1. UPDATE ROVER SPEED, THROTTLE & STEERING
        // -------------------------------------------------------------
        const isBoost = isBoostingRef.current || keysHeldRef.current.has('ArrowUp') || keysHeldRef.current.has('KeyW');
        const targetSpeed = isBoost ? 6.2 : 4.2;
        roverSpeedRef.current += (targetSpeed - roverSpeedRef.current) * 0.1;

        const forwardSpeed = roverSpeedRef.current;
        distanceRef.current += forwardSpeed;
        setDistanceProgress(Math.min(100, Math.round((distanceRef.current / TOTAL_COURSE_DISTANCE) * 100)));

        // Handle Steering Inputs
        let steerInput = 0;
        if (keysHeldRef.current.has('ArrowLeft') || keysHeldRef.current.has('KeyA')) steerInput -= 1;
        if (keysHeldRef.current.has('ArrowRight') || keysHeldRef.current.has('KeyD')) steerInput += 1;

        if (steerInput !== 0) {
          targetXRef.current = Math.max(90, Math.min(550, targetXRef.current + steerInput * 6.5));
        }

        // Horizontal position interpolation
        const currentX = roverXRef.current;
        const targetX = targetXRef.current;
        const dx = targetX - currentX;

        // Low-gravity drift inertia: turning hard creates drift
        roverVxRef.current = dx * 0.16;
        roverXRef.current += roverVxRef.current;

        // Calculate rover chassis tilt and drift angle
        const targetAngle = (roverVxRef.current / 12) * (Math.PI / 8);
        roverAngleRef.current += (targetAngle - roverAngleRef.current) * 0.2;

        const isDrifting = Math.abs(roverVxRef.current) > 2.5 || isDriftingRef.current;
        if (isDrifting && altitudeZRef.current <= 0) {
          setDriftScore((s) => s + 1);
        }

        // -------------------------------------------------------------
        // 2. LOW-GRAVITY JUMP & ALTITUDE SIMULATION (1/6g AIR-TIME)
        // -------------------------------------------------------------
        if (altitudeZRef.current > 0 || altitudeVzRef.current > 0) {
          altitudeZRef.current += altitudeVzRef.current;
          altitudeVzRef.current -= 0.22; // 1/6th lunar gravity downward acceleration

          if (altitudeZRef.current <= 0) {
            altitudeZRef.current = 0;
            altitudeVzRef.current = 0;
            setIsAirborne(false);
            playLandingThump();
            if (!reduceMotion) shakeRef.current = 8;
            addNotification(roverXRef.current, 200, 'LANDED! +BOOST 🚀', '#38bdf8');
            // Kick up landing dust cloud
            for (let i = 0; i < 16; i++) {
              const ang = Math.random() * Math.PI * 2;
              dustParticlesRef.current.push({
                x: roverXRef.current,
                y: 220,
                vx: Math.cos(ang) * 4,
                vy: Math.sin(ang) * 3,
                radius: Math.random() * 3 + 1.5,
                alpha: 0.9,
                decay: 0.05,
                color: '#e2e8f0',
              });
            }
          }
        }

        // -------------------------------------------------------------
        // 3. COLLISION WITH CRATER JUMP RAMPS
        // -------------------------------------------------------------
        for (const ramp of craterJumpsRef.current) {
          const worldRampY = ramp.y + distanceRef.current;
          if (
            !ramp.triggered &&
            altitudeZRef.current === 0 &&
            Math.abs(worldRampY - 220) < 22 &&
            Math.abs(roverXRef.current - ramp.x) < ramp.width / 2
          ) {
            ramp.triggered = true;
            altitudeVzRef.current = 4.8; // Launch into 1/6g parabolic air-time!
            altitudeZRef.current = 1;
            jumpCountRef.current += 1;
            setIsAirborne(true);
            playJumpSwoosh();
            addNotification(roverXRef.current, 190, '1/6g LUNAR JUMP! 🚀', '#38bdf8');
            onReactionChange('🚀 1/6th LUNAR GRAVITY JUMP! Floaty air-time over the crater rim!');
          }
        }

        // -------------------------------------------------------------
        // 4. COLLISION WITH APOLLO SAMPLE CRATES
        // -------------------------------------------------------------
        for (const sample of samplesRef.current) {
          const worldSampleY = sample.y + distanceRef.current;
          if (
            !sample.collected &&
            Math.abs(worldSampleY - 220) < 32 &&
            Math.abs(roverXRef.current - sample.x) < 42
          ) {
            sample.collected = true;
            playQuindarTone();
            sound.playSuccess();
            setSamplesCollected((c) => {
              const next = c + 1;
              return next;
            });

            addNotification(sample.x, 200, `RECOVERED: ${sample.name}! ✨`, sample.color);
            onReactionChange(`RECOVERED ${sample.name.toUpperCase()}! [ ${sample.subname} ]`);
          }
        }

        // -------------------------------------------------------------
        // 5. COLLISION WITH JAGGED LUNAR BOULDERS
        // -------------------------------------------------------------
        for (const b of bouldersRef.current) {
          const worldBoulderY = b.y + distanceRef.current;
          if (
            !b.hit &&
            altitudeZRef.current === 0 &&
            Math.abs(worldBoulderY - 220) < b.radius + 18 &&
            Math.abs(roverXRef.current - b.x) < b.radius + 18
          ) {
            b.hit = true;
            rockHitsRef.current += 1;
            roverSpeedRef.current = 1.8; // Clatter and stall speed
            if (!reduceMotion) shakeRef.current = 14;
            sound.playMistake();
            addNotification(b.x, 210, 'BOULDER CLANK! -SPEED', '#ef4444');
            onReactionChange('⚠ BOULDER IMPACT! Wire-mesh wheel clattered on basalt! Maintain steering!');
          }
        }

        // -------------------------------------------------------------
        // 6. SPAWN WIRE-MESH ROOSTER TAILS
        // -------------------------------------------------------------
        if (altitudeZRef.current === 0) {
          const intensity = isDrifting ? 2.2 : isBoost ? 1.4 : 0.8;
          // Left rear wheel
          spawnRoosterTail(roverXRef.current - 18, 240, roverAngleRef.current, intensity);
          // Right rear wheel
          spawnRoosterTail(roverXRef.current + 18, 240, roverAngleRef.current, intensity);
        }

        // -------------------------------------------------------------
        // 7. FINISH LINE AT TOTAL DISTANCE
        // -------------------------------------------------------------
        if (distanceRef.current >= TOTAL_COURSE_DISTANCE) {
          phaseRef.current = 'won';
          setPhase('won');

          const collectedCount = samplesRef.current.filter((s) => s.collected).length;
          // 3 Stars: 4 samples collected AND <= 1 rock hit AND >= 1 jump
          const stars: 1 | 2 | 3 =
            collectedCount >= TOTAL_SAMPLES && rockHitsRef.current <= 1 && jumpCountRef.current >= 1
              ? 3
              : collectedCount >= TOTAL_SAMPLES
              ? 2
              : 1;

          sound.playSuccess();
          onReactionChange(
            `MISSION ACCOMPLISHED! Apollo Lunar Module reached! Recovered ${collectedCount}/${TOTAL_SAMPLES} lunar samples!`
          );
          onWinTrigger({ stars });
        }
      }

      // Update screen shake
      if (shakeRef.current > 0) {
        shakeRef.current = Math.max(0, shakeRef.current - 0.7);
      }
      const shakeX = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;
      const shakeY = shakeRef.current > 0 ? (Math.random() - 0.5) * shakeRef.current : 0;

      ctx.save();
      ctx.translate(shakeX, shakeY);
      ctx.clearRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

      // -------------------------------------------------------------
      // 8. RENDER LUNAR ENVIRONMENT & HADLEY RILLE VALLEY
      // -------------------------------------------------------------
      // Black deep space sky
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Stars in lunar sky
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97) % CANVAS_WIDTH);
        const sy = ((i * 47) % 65);
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // Distant Blue Earth Marble rising over lunar horizon
      const earthX = 540;
      const earthY = 40;
      const earthGrad = ctx.createRadialGradient(earthX - 3, earthY - 3, 2, earthX, earthY, 16);
      earthGrad.addColorStop(0, '#bae6fd');
      earthGrad.addColorStop(0.4, '#0284c7');
      earthGrad.addColorStop(0.8, '#0369a1');
      earthGrad.addColorStop(1, '#082f49');
      ctx.fillStyle = earthGrad;
      ctx.beginPath();
      ctx.arc(earthX, earthY, 16, 0, Math.PI * 2);
      ctx.fill();

      // Lunar terrain gradient (stark gray regolith with harsh lighting)
      const groundY = 65;
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, CANVAS_HEIGHT);
      groundGrad.addColorStop(0, '#1e293b');
      groundGrad.addColorStop(0.2, '#334155');
      groundGrad.addColorStop(0.6, '#475569');
      groundGrad.addColorStop(1, '#64748b');
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, CANVAS_WIDTH, CANVAS_HEIGHT - groundY);

      // Distant Lunar Mountain Silhouettes (Hadley Rille Mountain Rim)
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(80, groundY - 20);
      ctx.lineTo(190, groundY - 10);
      ctx.lineTo(310, groundY - 32);
      ctx.lineTo(440, groundY - 14);
      ctx.lineTo(580, groundY - 28);
      ctx.lineTo(CANVAS_WIDTH, groundY);
      ctx.closePath();
      ctx.fill();

      // Procedural scrolling crater ridges & wheel ruts
      const scrollOffset = distanceRef.current % 120;
      ctx.strokeStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.lineWidth = 1.5;
      for (let y = groundY; y <= CANVAS_HEIGHT; y += 40) {
        const ry = y + scrollOffset;
        if (ry > groundY && ry < CANVAS_HEIGHT) {
          ctx.beginPath();
          ctx.moveTo(0, ry);
          ctx.lineTo(CANVAS_WIDTH, ry);
          ctx.stroke();
        }
      }

      // -------------------------------------------------------------
      // 9. DRAW CRATER JUMP RAMPS
      // -------------------------------------------------------------
      for (const ramp of craterJumpsRef.current) {
        const ry = ramp.y + distanceRef.current;
        if (ry > -50 && ry < CANVAS_HEIGHT + 50) {
          ctx.save();
          // Pale crater rim ridge (Launch ramp)
          ctx.fillStyle = 'rgba(241, 245, 249, 0.35)';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(ramp.x, ry, ramp.width / 2, ramp.height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Inside crater shadow
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
          ctx.beginPath();
          ctx.ellipse(ramp.x, ry + 4, ramp.width / 2.6, ramp.height / 3, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 8px monospace';
          ctx.fillStyle = '#38bdf8';
          ctx.textAlign = 'center';
          ctx.fillText('▲ CRATER JUMP RAMP ▲', ramp.x, ry - 14);
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 10. DRAW JAGGED LUNAR BOULDERS (Hazards)
      // -------------------------------------------------------------
      for (const b of bouldersRef.current) {
        const by = b.y + distanceRef.current;
        if (by > -40 && by < CANVAS_HEIGHT + 40) {
          ctx.save();
          // Harsh lunar boulder drop shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.ellipse(b.x + b.radius * 0.7, by + b.radius * 0.5, b.radius * 1.1, b.radius * 0.6, 0.3, 0, Math.PI * 2);
          ctx.fill();

          // Jagged rock body
          ctx.fillStyle = b.hit ? '#ef4444' : '#1e293b';
          ctx.strokeStyle = b.hit ? '#f87171' : '#475569';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(b.x, by, b.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Surface texture highlight
          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.arc(b.x - b.radius * 0.3, by - b.radius * 0.3, b.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 7px monospace';
          ctx.fillStyle = '#94a3b8';
          ctx.textAlign = 'center';
          ctx.fillText('BASALT', b.x, by + 3);
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 11. DRAW APOLLO SAMPLE CRATES (Objectives)
      // -------------------------------------------------------------
      for (const sample of samplesRef.current) {
        const sy = sample.y + distanceRef.current;
        if (sy > -50 && sy < CANVAS_HEIGHT + 50) {
          ctx.save();
          if (sample.collected) {
            // Faint collected ghost marker
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
            ctx.beginPath();
            ctx.arc(sample.x, sy, 14, 0, Math.PI * 2);
            ctx.stroke();
          } else {
            // Pulsing sample pickup halo
            const pulse = 1 + Math.sin(Date.now() / 150) * 0.15;
            const halo = ctx.createRadialGradient(sample.x, sy, 2, sample.x, sy, 28 * pulse);
            halo.addColorStop(0, sample.color);
            halo.addColorStop(0.5, sample.color + '44');
            halo.addColorStop(1, 'transparent');
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(sample.x, sy, 28 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Insulated Sample Box Body
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = sample.color;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(sample.x - 14, sy - 12, 28, 24, 4);
            ctx.fill();
            ctx.stroke();

            // Core Tube Icon
            ctx.fillStyle = sample.color;
            ctx.fillRect(sample.x - 3, sy - 8, 6, 16);

            // Label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(sample.name, sample.x, sy - 16);
          }
          ctx.restore();
        }
      }

      // -------------------------------------------------------------
      // 12. DRAW FINISH LINE: APOLLO LUNAR MODULE DESCENT STAGE
      // -------------------------------------------------------------
      const finishWorldY = -TOTAL_COURSE_DISTANCE + distanceRef.current + 220;
      if (finishWorldY > -100 && finishWorldY < CANVAS_HEIGHT + 100) {
        ctx.save();
        // LM Descent Stage Base & Gold Foil Wrapping
        ctx.fillStyle = '#ca8a04';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(260, finishWorldY - 40, 120, 50, 8);
        ctx.fill();
        ctx.stroke();

        // 4 Quad Outriggers & Footpads
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        // Left gear
        ctx.beginPath();
        ctx.moveTo(270, finishWorldY - 15);
        ctx.lineTo(210, finishWorldY + 15);
        ctx.stroke();
        // Right gear
        ctx.beginPath();
        ctx.moveTo(370, finishWorldY - 15);
        ctx.lineTo(430, finishWorldY + 15);
        ctx.stroke();

        // Descent engine bell
        ctx.fillStyle = '#1e293b';
        ctx.beginPath();
        ctx.arc(320, finishWorldY + 10, 16, 0, Math.PI * 2);
        ctx.fill();

        // Banner
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('🏁 APOLLO 17 LUNAR MODULE FINISH 🏁', 320, finishWorldY - 50);
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 13. DRAW DUST PARTICLES (Rooster Tails)
      // -------------------------------------------------------------
      for (let i = dustParticlesRef.current.length - 1; i >= 0; i--) {
        const p = dustParticlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          dustParticlesRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // -------------------------------------------------------------
      // 14. DRAW APOLLO LUNAR ROVING VEHICLE (LRV BUGGY)
      // -------------------------------------------------------------
      const roverX = roverXRef.current;
      const roverY = 220;
      const altitude = altitudeZRef.current;
      const scale = 1 + altitude * 0.04;

      ctx.save();
      // Drop Shadow (Detaches during low-gravity jump)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(roverX + 8, roverY + 12 + altitude * 14, 28 * scale, 14 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Transform Rover Position, Angle, and Jump Altitude
      ctx.translate(roverX, roverY - altitude * 18);
      ctx.rotate(roverAngleRef.current);
      ctx.scale(scale, scale);

      // Aluminum Ladder Chassis Frame
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-20, -28, 40, 56, 4);
      ctx.fill();
      ctx.stroke();

      // Gold Foil Insulation on forward electronics console
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-16, -24, 32, 12);

      // High-Gain Parabolic Umbrella Dish (Front)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -32, 10, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -28);
      ctx.lineTo(0, -32);
      ctx.stroke();

      // Astronaut 1 (Commander, Left Seat with Red Stripe)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(-8, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444'; // Red commander stripe
      ctx.fillRect(-10, -12, 4, 3);
      // Blue visor
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(-11, -9, 6, 4);

      // Astronaut 2 (Lunar Module Pilot, Right Seat)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(8, -6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(5, -9, 6, 4);

      // Rear Payload Deck (Sample Box Carrier)
      ctx.fillStyle = '#334155';
      ctx.fillRect(-16, 12, 32, 14);

      // 4 WOVEN WIRE-MESH WHEELS with Herringbone Cleats
      const wheelSteerAngle = roverAngleRef.current * 1.5;
      const wheels = [
        { x: -24, y: -20, isFront: true }, // Front-Left
        { x: 24, y: -20, isFront: true },  // Front-Right
        { x: -24, y: 18, isFront: false }, // Rear-Left
        { x: 24, y: 18, isFront: false },  // Rear-Right
      ];

      for (const w of wheels) {
        ctx.save();
        ctx.translate(w.x, w.y);
        // 4-Wheel Steering: Rear wheels steer opposite to front!
        ctx.rotate(w.isFront ? wheelSteerAngle : -wheelSteerAngle);

        // Open Woven Wire-Mesh Wheel Rim
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-4, -9, 8, 18, 3);
        ctx.fill();
        ctx.stroke();

        // Titanium Chevron Cleats (Herringbone pattern)
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-3, -5);
        ctx.lineTo(0, -2);
        ctx.lineTo(3, -5);
        ctx.moveTo(-3, 2);
        ctx.lineTo(0, 5);
        ctx.lineTo(3, 2);
        ctx.stroke();

        ctx.restore();
      }

      ctx.restore();

      // -------------------------------------------------------------
      // 15. DRAW FLOATING NOTIFICATIONS
      // -------------------------------------------------------------
      for (let i = notificationsRef.current.length - 1; i >= 0; i--) {
        const n = notificationsRef.current[i];
        n.y += n.vy;
        n.alpha -= 0.022;

        if (n.alpha <= 0) {
          notificationsRef.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = n.alpha;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = n.color;
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.fillText(n.text, n.x, n.y);
        ctx.restore();
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [addNotification, onReactionChange, onWinTrigger, playJumpSwoosh, playLandingThump, playQuindarTone, reduceMotion, spawnRoosterTail]);

  // Touch and Mouse Drag Steering
  const handlePointerDown = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX;

    isDraggingRef.current = true;
    targetXRef.current = Math.max(90, Math.min(550, x));
  };

  const handlePointerMove = (clientX: number) => {
    if (!isDraggingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (clientX - rect.left) * scaleX;

    targetXRef.current = Math.max(90, Math.min(550, x));
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const nudge = (dx: number) => {
    targetXRef.current = Math.max(90, Math.min(550, targetXRef.current + dx));
  };

  // Autoplay hook for test automation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const runAutoplay = () => {
        setSamplesCollected(TOTAL_SAMPLES);
        for (const s of samplesRef.current) {
          s.collected = true;
        }
        rockHitsRef.current = 0;
        jumpCountRef.current = 2;
        distanceRef.current = TOTAL_COURSE_DISTANCE;
        setDistanceProgress(100);
        phaseRef.current = 'won';
        setPhase('won');
        sound.playSuccess();
        onWinTrigger({ stars: 3 });
      };

      (window as any).__lrvAutoplay = runAutoplay;
      return () => {
        delete (window as any).__lrvAutoplay;
      };
    }
  }, [onWinTrigger]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[760px] mx-auto min-h-0"
      data-testid="lrv-game"
    >
      {/* 1. Header Telemetry HUD */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-slate-700/60 rounded-xl shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-slate-200 font-bold uppercase tracking-wider hidden sm:inline">
            APOLLO 17 LUNAR ROVING VEHICLE
          </span>
          <span className="text-slate-200 font-bold uppercase tracking-wider sm:hidden">
            APOLLO LRV
          </span>
          {isAirborne && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 animate-bounce">
              1/6g AIR-TIME 🚀
            </span>
          )}
        </div>

        {/* Samples Collected Counter */}
        <div
          data-testid="lrv-samples-counter"
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500/50 shadow-md"
        >
          <Trophy size={14} className="text-amber-400 animate-pulse" />
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Samples</span>
            <span className="text-xs font-bold font-mono text-cyan-300">
              {samplesCollected} / {TOTAL_SAMPLES}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Lunar Course Canvas */}
      <div className="w-full flex-1 flex items-center justify-center my-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerDown={(e) => handlePointerDown(e.clientX)}
          onPointerMove={(e) => handlePointerMove(e.clientX)}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="bg-[#020617] rounded-2xl block border-2 border-slate-800 shadow-2xl cursor-grab active:cursor-grabbing w-full h-full max-h-[220px] sm:max-h-[260px] touch-none select-none aspect-video shrink-0"
          data-testid="lrv-canvas"
        />

        {/* Course Progress Pill */}
        <div className="absolute top-2 right-3 pointer-events-none text-[9px] text-cyan-300 font-mono font-bold bg-slate-950/80 px-2.5 py-1 rounded-full border border-cyan-500/40 shadow">
          COURSE: {distanceProgress}%
        </div>
      </div>

      {/* 3. Tactile Steering & Throttle Controls Strip */}
      <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 bg-slate-900/90 border border-slate-800/80 rounded-xl shrink-0">
        {/* Steer Left Button (>=48px touch target) */}
        <button
          data-testid="lrv-steer-left"
          onClick={() => nudge(-45)}
          className="flex-1 h-12 flex items-center justify-center gap-1 rounded-lg bg-slate-800/80 border border-slate-600 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <ChevronLeft size={18} />
          <span>STEER LEFT</span>
        </button>

        {/* Throttle Boost Button (>=48px touch target) */}
        <button
          data-testid="lrv-throttle"
          onPointerDown={() => {
            isBoostingRef.current = true;
          }}
          onPointerUp={() => {
            isBoostingRef.current = false;
          }}
          className="flex-1 h-12 flex items-center justify-center gap-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <Zap size={16} className="text-cyan-400" />
          <span>BOOST</span>
        </button>

        {/* Steer Right Button (>=48px touch target) */}
        <button
          data-testid="lrv-steer-right"
          onClick={() => nudge(45)}
          className="flex-1 h-12 flex items-center justify-center gap-1 rounded-lg bg-slate-800/80 border border-slate-600 text-cyan-300 font-mono font-bold text-xs uppercase tracking-wider active:bg-cyan-700/60 transition-all cursor-pointer shadow-md select-none"
        >
          <span>STEER RIGHT</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
