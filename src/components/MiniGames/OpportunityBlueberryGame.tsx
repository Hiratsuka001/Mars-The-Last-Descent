import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { isDebugMode } from '../../systems/debug';
import { Flame, Sparkles, AlertCircle, ShieldAlert, Award } from 'lucide-react';

interface OpportunityBlueberryGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

interface BerryItem {
  id: number;
  x: number;
  y: number;
  radius: number;
  isGold: boolean;
  isDecoy: boolean;
  spawnTime: number;
  duration: number; // how long it stays before dust re-covers it (ms)
  popped: boolean;
  coverDust: number; // 0 (exposed) to 1 (covered)
}

interface FlyingParticle {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: string;
  radius: number;
  progress: number;
  speed: number;
  isGold?: boolean;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
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

const TOTAL_BERRIES_TARGET = 12;

export const OpportunityBlueberryGame: React.FC<OpportunityBlueberryGameProps> = ({
  wreckId = 'eq_opportunity',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState('Outcrop located! Hold on the rock to drill into the vein!');

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Fresh bedrock positioned! Drill the core and catch the berries!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title="The Blueberry Lab"
      instruction="Hold to drill, then tap the blueberries!"
      winTitle="SAMPLES SECURED!"
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <BlueberryContent
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

export { OpportunityBlueberryGame as NovaMarathonGame };
export default OpportunityBlueberryGame;

interface BlueberryContentProps {
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

// Procedural audio synthesizer for rising combo scale and drill whines
function playComboChime(combo: number, isGold = false) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pentatonic scale rising pitch: C5, D5, E5, G5, A5, C6, D6, E6...
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
    const freq = isGold ? 1760.0 : scale[Math.min(combo, scale.length - 1)];

    osc.type = isGold ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (isGold) {
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.18);
    }

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (isGold ? 0.35 : 0.22));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (isGold ? 0.36 : 0.23));
  } catch {}
}

const BlueberryContent: React.FC<BlueberryContentProps> = ({
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Phase: 'drill' | 'berries' | 'finished'
  const [phase, setPhase] = useState<'drill' | 'berries' | 'finished'>('drill');
  const [coreProgress, setCoreProgress] = useState<number>(0); // 0 to 100%
  const [heat, setHeat] = useState<number>(0); // 0 to 100%
  const [isOverheated, setIsOverheated] = useState<boolean>(false);
  const [berriesCollected, setBerriesCollected] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [goldBerryCaught, setGoldBerryCaught] = useState<boolean>(false);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [isQuaking, setIsQuaking] = useState<boolean>(false);

  // Refs for animation loop
  const phaseRef = useRef<'drill' | 'berries' | 'finished'>('drill');
  const isDrillingRef = useRef<boolean>(false);
  const coreProgressRef = useRef<number>(0);
  const heatRef = useRef<number>(0);
  const isOverheatedRef = useRef<boolean>(false);
  const overheatTimerRef = useRef<number>(0);
  const berriesCollectedRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const goldBerryCaughtRef = useRef<boolean>(false);
  const roundRef = useRef<number>(1);
  const mistakeCountRef = useRef<number>(0);

  const berriesRef = useRef<BerryItem[]>([]);
  const flyingParticlesRef = useRef<FlyingParticle[]>([]);
  const sparksRef = useRef<SparkParticle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);

  const screenShakeRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const lastSpawnTimeRef = useRef<number>(0);
  const lastDrillSoundRef = useRef<number>(0);
  const nextItemIdRef = useRef<number>(1);

  // Add floating text popups
  const addFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
    floatingTextsRef.current.push({
      id: nextItemIdRef.current++,
      x,
      y,
      text,
      color,
      alpha: 1.0,
      vy: -1.8,
    });
  }, []);

  // Spawn berries & decoy pebbles for active round
  const spawnBerryWave = useCallback((round: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    // Rock boundaries (rock fills ~75% of canvas)
    const minX = w * 0.16;
    const maxX = w * 0.84;
    const minY = h * 0.22;
    const maxY = h * 0.84;

    const count = round === 1 ? 4 : round === 2 ? 5 : 6;
    const decoys = round === 1 ? 1 : round === 2 ? 2 : 2;
    const spawnGold = round === 3 && !goldBerryCaughtRef.current;

    const newItems: BerryItem[] = [];

    // Spawn Blueberries
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: nextItemIdRef.current++,
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
        radius: 14 + Math.random() * 4,
        isGold: false,
        isDecoy: false,
        spawnTime: Date.now(),
        duration: Math.max(1800, 3200 - round * 400), // faster dust cover in later rounds
        popped: false,
        coverDust: 0,
      });
    }

    // Spawn Decoy Pebbles
    for (let i = 0; i < decoys; i++) {
      newItems.push({
        id: nextItemIdRef.current++,
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
        radius: 12 + Math.random() * 5,
        isGold: false,
        isDecoy: true,
        spawnTime: Date.now(),
        duration: 3800,
        popped: false,
        coverDust: 0,
      });
    }

    // Rare Gold Berry in Round 3
    if (spawnGold) {
      newItems.push({
        id: nextItemIdRef.current++,
        x: minX + Math.random() * (maxX - minX),
        y: minY + Math.random() * (maxY - minY),
        radius: 18,
        isGold: true,
        isDecoy: false,
        spawnTime: Date.now(),
        duration: 3500,
        popped: false,
        coverDust: 0,
      });
      sound.playNovaChirp();
      onReactionChange('★ RARE GOLD BERRY DETECTED! TAP IT FOR BONUS RP!');
    }

    berriesRef.current = newItems;
    lastSpawnTimeRef.current = Date.now();
  }, [onReactionChange]);

  // Trigger mid-round quake event
  const triggerQuake = useCallback((nextRound: number) => {
    setIsQuaking(true);
    screenShakeRef.current = 14;
    sound.playRumble();
    onReactionChange('⚡ MARSQUAKE! Rock strata shifting and scattering dust!');

    // Explosion of dust particles across rock
    for (let i = 0; i < 40; i++) {
      sparksRef.current.push({
        x: 300 + (Math.random() - 0.5) * 200,
        y: 130 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.5) * 18,
        radius: Math.random() * 5 + 2,
        color: Math.random() > 0.4 ? '#c2410c' : '#ea580c',
        alpha: 1.0,
      });
    }

    setTimeout(() => {
      setIsQuaking(false);
      roundRef.current = nextRound;
      setRoundNumber(nextRound);
      spawnBerryWave(nextRound);
    }, 600);
  }, [onReactionChange, spawnBerryWave]);

  // Handle direct tap on canvas
  const handleCanvasInteraction = useCallback(
    (clientX: number, clientY: number) => {
      if (phaseRef.current === 'finished') return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (clientX - rect.x) * scaleX;
      const clickY = (clientY - rect.y) * scaleY;

      // In Drill Phase: tapping starts drill, but user can also hold down
      if (phaseRef.current === 'drill') {
        return; // Handled by pointerDown / pointerUp on the rock target
      }

      // In Berries Phase: check which berry was tapped
      // Berry tap hit radius >= 24 CSS px (keep the existing getBoundingClientRect scaling)
      const minHitRadiusInCanvas = 24 * (canvas.width / rect.width);
      const hit = berriesRef.current.find(
        (b) => !b.popped && b.coverDust < 0.85 && Math.hypot(clickX - b.x, clickY - b.y) <= Math.max(b.radius + 14, minHitRadiusInCanvas)
      );

      if (!hit) {
        // Drag to blow rolling dust away
        berriesRef.current.forEach((b) => {
          if (!b.popped && Math.hypot(clickX - b.x, clickY - b.y) < 60) {
            b.coverDust = Math.max(0, b.coverDust - 0.4);
          }
        });
        return;
      }

      // 1. Tapped a DECOY PEBBLE
      if (hit.isDecoy) {
        hit.popped = true;
        mistakeCountRef.current += 1;
        comboRef.current = 0;
        setCombo(0);
        screenShakeRef.current = 8;
        sound.playMistake();
        onFailTrigger();
        addFloatingText(hit.x, hit.y, 'DECOY PEBBLE! -1s', '#f87171');
        onReactionChange('Ouch! That was a plain basalt pebble, not hematite!');

        // Break particles
        for (let i = 0; i < 10; i++) {
          sparksRef.current.push({
            x: hit.x,
            y: hit.y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            radius: 3,
            color: '#78350f',
            alpha: 1.0,
          });
        }
        return;
      }

      // 2. Tapped a REAL BLUEBERRY or GOLD BERRY!
      hit.popped = true;
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);

      const jarX = canvas.width - 48;
      const jarY = 36;

      // Arc particle to Sample Jar
      flyingParticlesRef.current.push({
        x: hit.x,
        y: hit.y,
        targetX: jarX,
        targetY: jarY,
        color: hit.isGold ? '#facc15' : '#38bdf8',
        radius: hit.radius,
        progress: 0,
        speed: 3.2,
        isGold: hit.isGold,
      });

      if (hit.isGold) {
        goldBerryCaughtRef.current = true;
        setGoldBerryCaught(true);
        playComboChime(nextCombo, true);
        sound.playDiscovery();
        addFloatingText(hit.x, hit.y, '★ GOLDEN SPHERULE! +1 RP!', '#facc15');
        onReactionChange('GOLD BERRY CAPTURED! Rare water nodule found!');
      } else {
        playComboChime(nextCombo, false);
        addFloatingText(hit.x, hit.y, nextCombo > 1 ? `POP! x${nextCombo}` : 'POP!', '#38bdf8');
        onReactionChange(`Blueberry secured! Combo x${nextCombo}!`);
      }

      const nextCollected = berriesCollectedRef.current + 1;
      berriesCollectedRef.current = nextCollected;
      setBerriesCollected(nextCollected);

      // Check if current wave is cleared
      const remainingInWave = berriesRef.current.filter((b) => !b.isDecoy && !b.popped).length;
      if (remainingInWave === 0 || nextCollected >= TOTAL_BERRIES_TARGET) {
        if (nextCollected >= TOTAL_BERRIES_TARGET || roundRef.current >= 3) {
          // Finished entire mini-game!
          phaseRef.current = 'finished';
          setPhase('finished');
          sound.playSuccess();
          sound.playDiscovery();
          onReactionChange('SAMPLE JAR FULL! Past standing water definitively proven!');

          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          let earnedStars: 1 | 2 | 3 = 3;
          if (assistActive || mistakeCountRef.current >= 2 || elapsed > 30) {
            earnedStars = 1;
          } else if (mistakeCountRef.current === 1 || !goldBerryCaughtRef.current) {
            earnedStars = 2;
          }

          setTimeout(() => {
            onWinTrigger({ stars: earnedStars });
          }, 700);
        } else {
          // Transition to next escalating round with a quake!
          triggerQuake(roundRef.current + 1);
        }
      }
    },
    [assistActive, onWinTrigger, onFailTrigger, onReactionChange, addFloatingText, triggerQuake]
  );

  // Drill Hold Handler (Direct on the rock target)
  const handleDrillStart = useCallback(() => {
    if (phaseRef.current !== 'drill' || isOverheatedRef.current) return;
    isDrillingRef.current = true;
  }, []);

  const handleDrillEnd = useCallback(() => {
    isDrillingRef.current = false;
  }, []);

  // Main animation / simulation loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min(0.1, (currentTime - lastTime) / 1000);
      lastTime = currentTime;
      const reduceMotion = isReduceMotionEnabled();

      // Handle Overheat cooldown timer
      if (isOverheatedRef.current) {
        overheatTimerRef.current -= dt;
        if (overheatTimerRef.current <= 0) {
          isOverheatedRef.current = false;
          setIsOverheated(false);
          heatRef.current = 20;
          setHeat(20);
          onReactionChange('Drill cooled down! Hold to drill again!');
        }
      }

      // Handle Drilling Phase
      if (phaseRef.current === 'drill') {
        if (isDrillingRef.current && !isOverheatedRef.current) {
          // Heat climbs: 0% -> 100% in 3.0 seconds
          const nextHeat = Math.min(100, heatRef.current + 34 * dt);
          heatRef.current = nextHeat;
          setHeat(nextHeat);

          // Green zone is between 35% and 80%
          const inGreenZone = nextHeat >= 35 && nextHeat <= 80;
          const rate = inGreenZone ? 45 : 22; // Core progress speed (%/s)
          const nextCore = Math.min(100, coreProgressRef.current + rate * dt);
          coreProgressRef.current = nextCore;
          setCoreProgress(nextCore);

          // Drill sparks & screen shake
          screenShakeRef.current = inGreenZone ? 3.5 : 2.0;
          if (currentTime - lastDrillSoundRef.current > 110) {
            lastDrillSoundRef.current = currentTime;
            sound.playRepairRatchet();
          }

          if (!reduceMotion) {
            const cx = (canvasRef.current?.width || 640) * 0.5;
            const cy = (canvasRef.current?.height || 360) * 0.5;
            for (let i = 0; i < 3; i++) {
              sparksRef.current.push({
                x: cx + (Math.random() - 0.5) * 40,
                y: cy + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 18,
                vy: (Math.random() - 0.5) * 18 - 2,
                radius: Math.random() * 3 + 1,
                color: inGreenZone ? '#fef08a' : '#f97316',
                alpha: 1.0,
              });
            }
          }

          // Check Overheat condition
          if (nextHeat >= 100) {
            isDrillingRef.current = false;
            isOverheatedRef.current = true;
            setIsOverheated(true);
            overheatTimerRef.current = 1.5;
            screenShakeRef.current = 10;
            sound.playMistake();
            onFailTrigger();
            onReactionChange('DRILL OVERHEATED! Let it cool for 1.5s!');
            const cx = (canvasRef.current?.width || 640) * 0.5;
            const cy = (canvasRef.current?.height || 360) * 0.5;
            addFloatingText(cx, cy - 40, 'OVERHEATED!', '#ef4444');
          }

          // Check Core drilled complete
          if (nextCore >= 100) {
            isDrillingRef.current = false;
            sound.playSuccess();
            sound.playRumble();
            screenShakeRef.current = 12;
            phaseRef.current = 'berries';
            setPhase('berries');
            onReactionChange('ROCK CORE SHATTERED! TAP THE BLUEBERRIES BEFORE DUST COVERS THEM!');
            spawnBerryWave(1);
          }
        } else if (!isOverheatedRef.current) {
          // Passive cooling when not drilling
          const nextHeat = Math.max(0, heatRef.current - 45 * dt);
          heatRef.current = nextHeat;
          setHeat(nextHeat);
        }
      }

      // Handle Berries Phase (Dust rolling over unpopped berries)
      if (phaseRef.current === 'berries') {
        const now = Date.now();
        berriesRef.current.forEach((b) => {
          if (!b.popped) {
            const age = now - b.spawnTime;
            // Dust accumulates after half duration
            if (age > b.duration * 0.45) {
              const coverRate = (age - b.duration * 0.45) / (b.duration * 0.55);
              b.coverDust = Math.min(1.0, coverRate);
            }
          }
        });
      }

      // Update Flying Berries to Sample Jar
      flyingParticlesRef.current = flyingParticlesRef.current
        .map((p) => {
          const nextProg = p.progress + p.speed * dt;
          return { ...p, progress: nextProg };
        })
        .filter((p) => {
          if (p.progress >= 1.0) {
            // Reached jar
            sound.playClick();
            if (!reduceMotion) {
              for (let i = 0; i < 6; i++) {
                sparksRef.current.push({
                  x: p.targetX,
                  y: p.targetY,
                  vx: (Math.random() - 0.5) * 8,
                  vy: (Math.random() - 0.5) * 8,
                  radius: 2.5,
                  color: p.isGold ? '#facc15' : '#38bdf8',
                  alpha: 1.0,
                });
              }
            }
            return false;
          }
          return true;
        });

      // Update Sparks
      sparksRef.current = sparksRef.current
        .map((s) => ({
          ...s,
          x: s.x + s.vx,
          y: s.y + s.vy,
          vy: s.vy + 0.15,
          alpha: s.alpha - 0.04,
        }))
        .filter((s) => s.alpha > 0);

      // Update Floating Texts
      floatingTextsRef.current = floatingTextsRef.current
        .map((t) => ({
          ...t,
          y: t.y + t.vy,
          alpha: t.alpha - 0.025,
        }))
        .filter((t) => t.alpha > 0);

      // Dampen screen shake
      screenShakeRef.current = Math.max(0, screenShakeRef.current - 22 * dt);

      // RENDER CANVAS
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.clearRect(0, 0, w, h);

          ctx.save();
          if (screenShakeRef.current > 0 && !reduceMotion) {
            const sx = (Math.random() - 0.5) * screenShakeRef.current;
            const sy = (Math.random() - 0.5) * screenShakeRef.current;
            ctx.translate(sx, sy);
          }

          // 1. Rock Outcrop (Fills 75-80% of canvas)
          const rockX = w * 0.04;
          const rockY = h * 0.05;
          const rockW = w * 0.92;
          const rockH = h * 0.90;

          const rockGrad = ctx.createLinearGradient(rockX, rockY, rockX + rockW, rockY + rockH);
          rockGrad.addColorStop(0, '#b45309');
          rockGrad.addColorStop(0.5, '#78350f');
          rockGrad.addColorStop(1, '#451a03');

          ctx.fillStyle = rockGrad;
          ctx.beginPath();
          ctx.roundRect(rockX, rockY, rockW, rockH, Math.round(h * 0.06));
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#92400e';
          ctx.stroke();

          // Horizontal geological stratification lines
          ctx.strokeStyle = 'rgba(217, 119, 6, 0.35)';
          ctx.lineWidth = 2;
          for (let ly = rockY + h * 0.07; ly < rockY + rockH - h * 0.05; ly += h * 0.06) {
            ctx.beginPath();
            ctx.moveTo(rockX + w * 0.03, ly + Math.sin(ly * 0.1) * 3);
            ctx.lineTo(rockX + rockW - w * 0.03, ly + Math.cos(ly * 0.1) * 4);
            ctx.stroke();
          }

          // Fractures in rock
          ctx.strokeStyle = 'rgba(69, 26, 3, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(w * 0.45, h * 0.3);
          ctx.lineTo(w * 0.52, h * 0.55);
          ctx.lineTo(w * 0.62, h * 0.7);
          ctx.stroke();

          // 2. PHASE: DRILL CORE ON THE ROCK
          if (phaseRef.current === 'drill') {
            const cx = w * 0.5;
            const cy = h * 0.5;
            const radius = Math.min(w, h) * 0.18;

            // Core hole being cut
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = '#1e1b4b'; // deep drilled core
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#38bdf8';
            ctx.stroke();

            // Circular Heat Gauge directly around drill target
            const heatPct = heatRef.current / 100;
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + heatPct * Math.PI * 2;

            ctx.lineWidth = Math.max(5, Math.round(h * 0.022));
            ctx.strokeStyle = heatRef.current > 80 ? '#ef4444' : heatRef.current >= 35 ? '#10b981' : '#38bdf8';
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 12, startAngle, endAngle);
            ctx.stroke();

            // Optimal Green Zone markers on gauge (35% to 80%)
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
            ctx.beginPath();
            ctx.arc(cx, cy, radius + 12, startAngle + 0.35 * Math.PI * 2, startAngle + 0.8 * Math.PI * 2);
            ctx.stroke();

            // Drill Target Text & Prompt
            ctx.fillStyle = isOverheatedRef.current ? '#ef4444' : isDrillingRef.current ? '#fef08a' : '#ffffff';
            ctx.font = 'bold 13px monospace';
            ctx.textAlign = 'center';
            if (isOverheatedRef.current) {
              ctx.fillText('⚠ OVERHEATED! COOLING...', cx, cy - 6);
              ctx.font = '11px monospace';
              ctx.fillText('Wait 1.5s', cx, cy + 14);
            } else if (isDrillingRef.current) {
              ctx.fillText(`DRILLING ${Math.round(coreProgressRef.current)}%`, cx, cy - 6);
              ctx.font = '11px monospace';
              ctx.fillStyle = heatRef.current > 80 ? '#ef4444' : '#a7f3d0';
              ctx.fillText(heatRef.current > 80 ? 'HOT! RELEASE!' : 'GREEN ZONE ✓', cx, cy + 14);
            } else {
              ctx.fillText('HOLD TO DRILL', cx, cy - 6);
              ctx.font = '11px monospace';
              ctx.fillStyle = '#38bdf8';
              ctx.fillText('Keep in Green Zone', cx, cy + 14);
            }

            ctx.restore();
          }

          // 3. PHASE: BERRIES ON THE ROCK
          if (phaseRef.current === 'berries' || phaseRef.current === 'finished') {
            berriesRef.current.forEach((b) => {
              if (b.popped) return;

              ctx.save();

              // Berry or Pebble
              if (b.isDecoy) {
                // Brown jagged pebble
                ctx.fillStyle = '#573010';
                ctx.strokeStyle = '#291404';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(b.x - b.radius, b.y);
                ctx.lineTo(b.x - b.radius * 0.4, b.y - b.radius);
                ctx.lineTo(b.x + b.radius * 0.8, b.y - b.radius * 0.5);
                ctx.lineTo(b.x + b.radius, b.y + b.radius * 0.6);
                ctx.lineTo(b.x - b.radius * 0.3, b.y + b.radius);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              } else {
                // Shiny metallic Hematite Blueberry
                const grad = ctx.createRadialGradient(
                  b.x - b.radius * 0.3,
                  b.y - b.radius * 0.3,
                  2,
                  b.x,
                  b.y,
                  b.radius
                );

                if (b.isGold) {
                  grad.addColorStop(0, '#fef08a');
                  grad.addColorStop(0.5, '#eab308');
                  grad.addColorStop(1, '#854d0e');
                } else {
                  grad.addColorStop(0, '#93c5fd');
                  grad.addColorStop(0.5, '#1d4ed8');
                  grad.addColorStop(1, '#0f172a');
                }

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.lineWidth = b.isGold ? 2.5 : 1.5;
                ctx.strokeStyle = b.isGold ? '#fef08a' : '#60a5fa';
                ctx.stroke();

                // Sparkle on Gold Berry (skip on reduceMotion)
                if (b.isGold && !reduceMotion) {
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(b.x - 2, b.y - 8, 4, 16);
                  ctx.fillRect(b.x - 8, b.y - 2, 16, 4);
                }
              }

              // Dust covering overlay (if dust is rolling over)
              if (b.coverDust > 0.05) {
                ctx.fillStyle = `rgba(194, 65, 12, ${b.coverDust * 0.88})`;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
                ctx.fill();
              }

              ctx.restore();
            });
          }

          // 4. Flying Particles to Sample Jar
          flyingParticlesRef.current.forEach((p) => {
            const curX = p.x + (p.targetX - p.x) * p.progress;
            const curY = p.y + (p.targetY - p.y) * p.progress - Math.sin(p.progress * Math.PI) * 45; // parabolic arc

            ctx.save();
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(curX, curY, p.radius * (1 - p.progress * 0.4), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          });

          // 5. Sparks (skip drawing if reduceMotion)
          if (!reduceMotion) {
            sparksRef.current.forEach((s) => {
              ctx.save();
              ctx.globalAlpha = s.alpha;
              ctx.fillStyle = s.color;
              ctx.beginPath();
              ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            });
          }

          // 6. Floating Texts (skip drawing if reduceMotion)
          if (!reduceMotion) {
            floatingTextsRef.current.forEach((t) => {
              ctx.save();
              ctx.globalAlpha = t.alpha;
              ctx.fillStyle = t.color;
              ctx.font = 'bold 12px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(t.text, t.x, t.y);
              ctx.restore();
            });
          }

          ctx.restore(); // end screen shake
        }
      }

      // Always reschedule the animation loop until finished, regardless of reduceMotion!
      if (phaseRef.current !== 'finished') {
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [spawnBerryWave, onFailTrigger, onReactionChange, addFloatingText]);

  // QA Runner Autoplay hook (gated by isDebugMode)
  useEffect(() => {
    if (typeof window !== 'undefined' && isDebugMode) {
      const runAutoplay = async () => {
        setCoreProgress(100);
        coreProgressRef.current = 100;
        setBerriesCollected(TOTAL_BERRIES_TARGET);
        berriesCollectedRef.current = TOTAL_BERRIES_TARGET;
        setGoldBerryCaught(true);
        goldBerryCaughtRef.current = true;
        setCombo(6);
        comboRef.current = 6;
        phaseRef.current = 'finished';
        setPhase('finished');
        sound.playSuccess();
        sound.playDiscovery();
        onWinTrigger({ stars: 3 });
      };

      (window as any).__blueberryAutoplay = runAutoplay;
      (window as any).__craterAutoplay = runAutoplay;
      (window as any).__marathonAutoplay = runAutoplay;

      return () => {
        delete (window as any).__blueberryAutoplay;
        delete (window as any).__craterAutoplay;
        delete (window as any).__marathonAutoplay;
      };
    }
  }, [onWinTrigger]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[760px] mx-auto min-h-0"
      data-testid="blueberry-game"
      data-core-progress={Math.round(coreProgress)}
      data-berries={berriesCollected}
    >
      {/* 1. Header Telemetry & Sample Jar HUD */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-900/80 border border-amber-900/40 rounded-xl shrink-0 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-amber-300 font-bold uppercase tracking-wider">
            {phase === 'drill' ? 'STAGE 1: RAT DRILL CORE' : `WAVE ${roundNumber} / 3: BERRY EXTRACTION`}
          </span>
          {combo > 1 && (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 animate-bounce">
              COMBO x{combo} 🔥
            </span>
          )}
        </div>

        {/* High-tech Sample Jar Container */}
        <div
          data-testid="sample-jar"
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-cyan-500/50 shadow-md shadow-cyan-950/40"
        >
          <span className="text-cyan-400 font-bold text-sm">🫐</span>
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-slate-400 uppercase font-semibold">Sample Jar</span>
            <span className="text-xs font-bold text-cyan-300 font-mono">
              {berriesCollected} / {TOTAL_BERRIES_TARGET}
            </span>
          </div>
          {goldBerryCaught && <Sparkles size={14} className="text-amber-400 animate-spin" />}
        </div>
      </div>

      {/* 2. Direct Interaction Rock Canvas (Derives 640x360 16:9 aspect, non-stretched) */}
      <div className="w-full flex-1 flex items-center justify-center my-1 min-h-0 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          onPointerDown={(e) => {
            if (phase === 'drill') {
              handleDrillStart();
            } else {
              handleCanvasInteraction(e.clientX, e.clientY);
            }
          }}
          onPointerUp={() => {
            if (phase === 'drill') handleDrillEnd();
          }}
          onPointerLeave={() => {
            if (phase === 'drill') handleDrillEnd();
          }}
          className="bg-[#120501] rounded-2xl block border-2 border-amber-950 shadow-2xl cursor-pointer aspect-video h-[265px] sm:h-[345px] w-auto max-w-none shrink-0"
          data-testid="crater-canvas"
        />

        {/* Invisible Overlay Button for Drill accessibility on touch */}
        {phase === 'drill' && (
          <button
            data-testid="rock-drill-target"
            onPointerDown={handleDrillStart}
            onPointerUp={handleDrillEnd}
            onPointerLeave={handleDrillEnd}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            aria-label="Hold to drill core"
          />
        )}
      </div>

      {/* 3. Direct Rock Guidance Strip (No bottom buttons!) */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 bg-amber-950/20 border border-amber-900/30 rounded-xl shrink-0 text-xs font-mono text-slate-300">
        <span className="flex items-center gap-1.5">
          {phase === 'drill' ? (
            <>
              <Flame size={14} className="text-amber-400" />
              <span>
                <strong>Hold on rock to drill.</strong> Release in green zone before red overheat!
              </span>
            </>
          ) : (
            <>
              <Sparkles size={14} className="text-cyan-400" />
              <span>
                <strong>Tap blue berries</strong> as they pop out! Avoid brown pebbles!
              </span>
            </>
          )}
        </span>

        {goldBerryCaught && (
          <span className="text-amber-400 font-bold flex items-center gap-1">
            <Award size={13} /> Gold Berry Secured!
          </span>
        )}
      </div>
    </div>
  );
};
