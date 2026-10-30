import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniGameShell } from './MiniGameShell';
import { sound } from '../../systems/audio';
import { isReduceMotionEnabled } from '../../systems/saveManager';
import { Activity, Shield, ShieldAlert, ShieldCheck, ChevronLeft, ChevronRight, Sparkles, Radio } from 'lucide-react';

interface InSightSeismicGameProps {
  wreckId?: string;
  onSuccess: () => void;
  onClose: () => void;
  onAwardBonusRp?: () => boolean;
  hasBonusRp?: boolean;
}

export const InSightSeismicGame: React.FC<InSightSeismicGameProps> = ({
  wreckId = 'eq_insight',
  onSuccess,
  onClose,
  onAwardBonusRp,
  hasBonusRp,
}) => {
  const [retryNonce, setRetryNonce] = useState(0);
  const [reactionText, setReactionText] = useState('Wind gusts are loud! Deploy the shield dome!');

  const isDeepSpace = wreckId === 'eq_deep_space_dish';
  const gameTitle = isDeepSpace ? 'Deep Space Relay Array' : "InSight's Marsquake Tuner";
  const instruction = isDeepSpace
    ? 'Align carrier frequency to catch Earth transmission!'
    : 'Lower the shield dome & tune frequency to isolate the Marsquake!';

  const handleRetry = useCallback(() => {
    setRetryNonce((n) => n + 1);
    setReactionText('Sensors reset! Isolate the seismic wave!');
  }, []);

  return (
    <MiniGameShell
      wreckId={wreckId}
      title={gameTitle}
      instruction={instruction}
      onWin={onSuccess}
      onExit={onClose}
      onRetry={handleRetry}
      onAwardBonusRp={onAwardBonusRp}
      hasBonusRp={hasBonusRp}
      footerReaction={reactionText}
    >
      {({ win, fail, assistActive }) => (
        <InSightContent
          key={retryNonce}
          wreckId={wreckId}
          onWinTrigger={win}
          onFailTrigger={fail}
          onReactionChange={setReactionText}
          assistActive={assistActive}
        />
      )}
    </MiniGameShell>
  );
};

export { InSightSeismicGame as InSightSeismicPuzzle };
export default InSightSeismicGame;

interface InSightContentProps {
  wreckId: string;
  onWinTrigger: (result: { stars: 1 | 2 | 3 }) => void;
  onFailTrigger: () => void;
  onReactionChange: (text: string) => void;
  assistActive?: boolean;
}

// Target frequency sweet spot: 50 on slider (0.50 Hz)
const TARGET_FREQ = 50;

const InSightContent: React.FC<InSightContentProps> = ({
  wreckId,
  onWinTrigger,
  onFailTrigger,
  onReactionChange,
  assistActive = false,
}) => {
  const isDeepSpace = wreckId === 'eq_deep_space_dish';

  // Start with shield open (false) and frequency off-target (20) to require active player participation
  const [domeLowered, setDomeLowered] = useState<boolean>(isDeepSpace); // deep space dish doesn't need physical dome
  const [frequency, setFrequency] = useState<number>(20); // 0 to 100
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [mistakes, setMistakes] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const reduceMotion = useRef(isReduceMotionEnabled()).current;

  // Calculate resonance match (0% to 100%)
  // Proximity to TARGET_FREQ (50)
  const freqDist = Math.abs(frequency - TARGET_FREQ);
  const freqClarity = Math.max(0, 1 - freqDist / 35); // 0 at distance 35, 1 at 0
  
  // Shield factor: If dome is open on InSight, max resonance is capped at 35% due to wind noise
  const domeFactor = domeLowered ? 1.0 : 0.25;
  const rawResonance = Math.round(freqClarity * 100 * domeFactor);
  const resonance = Math.max(0, Math.min(100, rawResonance));
  const isOptimal = resonance >= 85;

  // Canvas drawing loop
  useEffect(() => {
    let animId: number;
    let time = 0;

    const render = () => {
      time += 0.04;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // 1. Grid Background
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
      ctx.lineWidth = 1;
      const stepX = Math.max(25, Math.floor(w / 12));
      for (let x = 0; x < w; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // 2. Waveform calculation
      ctx.lineWidth = isOptimal ? 2.5 : 1.8;
      ctx.strokeStyle = isOptimal
        ? '#10b981'
        : resonance > 50
        ? '#06b6d4'
        : domeLowered
        ? '#f59e0b'
        : '#f43f5e';

      ctx.beginPath();

      // Wind noise amplitude
      const windAmp = domeLowered ? 4 : 26;
      const waveQuality = resonance / 100;

      for (let x = 0; x < w; x++) {
        const normX = x / w;
        let y = h / 2;

        // Chaotic surface wind turbulence
        const windNoise =
          (Math.sin(normX * 80 + time * 3.5) * 0.6 +
            Math.cos(normX * 160 - time * 5) * 0.4) *
          windAmp *
          (1 - waveQuality * 0.8);

        // Marsquake signal (or Deep space carrier)
        let seismicSignal = 0;
        if (!isDeepSpace) {
          // P-Wave (Primary compressional packet) around normX 0.25 - 0.45
          if (normX > 0.22 && normX < 0.44) {
            const pEnvelope = Math.sin(((normX - 0.22) / 0.22) * Math.PI);
            seismicSignal += Math.sin((normX - 0.22) * 50 + time * 1.2) * 26 * pEnvelope;
          }
          // S-Wave (Secondary shear packet) around normX 0.50 - 0.85
          if (normX >= 0.48 && normX < 0.86) {
            const sEnvelope = Math.sin(((normX - 0.48) / 0.38) * Math.PI);
            seismicSignal += Math.sin((normX - 0.48) * 28 + time * 0.9) * 44 * sEnvelope;
          }
        } else {
          // Carrier sine packet with Earth telemetry pulse
          const carrier = Math.sin(normX * 36 + time * 4) * 36;
          seismicSignal = carrier;
        }

        y += windNoise + seismicSignal * (0.2 + waveQuality * 0.8);

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // 3. Annotations on screen when near resonance
      if (resonance >= 60) {
        ctx.fillStyle = isOptimal ? '#34d399' : '#38bdf8';
        ctx.font = 'bold 10px monospace';
        if (!isDeepSpace) {
          ctx.fillText('▼ P-WAVE (CRUST)', w * 0.25, Math.max(16, h * 0.2));
          ctx.fillText('▼ S-WAVE (CORE REFLECTION)', w * 0.55, Math.max(16, h * 0.16));
        } else {
          ctx.fillText('▼ EARTH CARRIER BEACON', w * 0.35, Math.max(16, h * 0.2));
        }
      }

      if (!reduceMotion && !isLocked) {
        animId = requestAnimationFrame(render);
      }
    };

    render();
    if (!reduceMotion && !isLocked) {
      animId = requestAnimationFrame(render);
    }
    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [frequency, domeLowered, resonance, isOptimal, isDeepSpace, reduceMotion, isLocked]);

  // Handle Shield Dome Toggle
  const toggleDome = useCallback(() => {
    if (isLocked) return;
    const nextState = !domeLowered;
    setDomeLowered(nextState);

    if (nextState) {
      sound.playRepairRatchet();
      onReactionChange('Shield dome clamped down! Wind noise blocked!');
    } else {
      sound.playMistake();
      onReactionChange('Dome raised! Surface wind gusts interfering!');
    }
  }, [domeLowered, isLocked, onReactionChange]);

  // Handle Frequency Tuning
  const handleTuneChange = useCallback(
    (newVal: number) => {
      if (isLocked) return;
      const clamped = Math.max(5, Math.min(95, newVal));
      setFrequency(clamped);
      sound.playHover();

      const dist = Math.abs(clamped - TARGET_FREQ);
      if (dist <= 4 && domeLowered) {
        onReactionChange('Resonance lock! Core wave isolated!');
      } else if (dist <= 10) {
        onReactionChange('Signal getting clearer! Almost there!');
      } else if (!domeLowered && !isDeepSpace) {
        onReactionChange('Wind is too loud! Lower the shield dome first!');
      } else {
        onReactionChange('Tune slider toward 0.50 Hz center sweet spot.');
      }
    },
    [isLocked, domeLowered, isDeepSpace, onReactionChange]
  );

  const stepTune = useCallback(
    (delta: number) => {
      handleTuneChange(frequency + delta);
    },
    [frequency, handleTuneChange]
  );

  // Lock In Quake / Claim Action
  const handleLockIn = useCallback(async () => {
    if (isLocked) return;

    if (!isOptimal) {
      sound.playMistake();
      setMistakes((m) => m + 1);
      onFailTrigger();
      if (!domeLowered && !isDeepSpace) {
        onReactionChange('Cannot lock! Deploy the shield dome to block wind!');
      } else {
        onReactionChange('Signal not in resonance! Tune closer to 0.50 Hz!');
      }
      return;
    }

    setIsLocked(true);
    sound.playSonarPing();
    sound.playSuccess();
    onReactionChange('MARS INTERIOR MAPPED! Liquid core confirmed!');

    await new Promise((r) => setTimeout(r, 600));

    // Calculate stars:
    // 3 Stars: < 15 seconds and 0 mistakes
    // 2 Stars: <= 30 seconds or <= 1 mistake
    // 1 Star: > 30 seconds or multiple mistakes or assist
    const elapsedSec = (Date.now() - startTimeRef.current) / 1000;
    let earnedStars: 1 | 2 | 3 = 3;
    if (assistActive || mistakes >= 2 || elapsedSec > 30) {
      earnedStars = 1;
    } else if (mistakes === 1 || elapsedSec > 15) {
      earnedStars = 2;
    }

    onWinTrigger({ stars: earnedStars });
  }, [isLocked, isOptimal, domeLowered, isDeepSpace, assistActive, mistakes, onWinTrigger, onFailTrigger, onReactionChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLocked) return;

      if (e.key === ' ' || e.key === 's' || e.key === 'S') {
        if (!isDeepSpace) {
          e.preventDefault();
          toggleDome();
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        stepTune(-3);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        stepTune(3);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleLockIn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleDome, stepTune, handleLockIn, isLocked, isDeepSpace]);

  // QA Runner Autoplay hook
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__insightAutoplay = async () => {
        setDomeLowered(true);
        setFrequency(TARGET_FREQ);
        setIsLocked(true);
        sound.playSonarPing();
        sound.playSuccess();
        onWinTrigger({ stars: 3 });
      };
      return () => {
        delete (window as any).__insightAutoplay;
      };
    }
  }, [onWinTrigger]);

  const displayHz = (frequency / 100 * 2.5).toFixed(2);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-between select-none p-1 sm:p-2 max-w-[700px] mx-auto min-h-0"
      data-testid="insight-game"
    >
      {/* 1. Oscilloscope Monitor Screen */}
      <div
        className="w-full flex-1 max-h-[300px] bg-[#030712] border-2 border-cyan-500/40 rounded-xl p-2 sm:p-3 shadow-[inset_0_0_20px_rgba(6,182,212,0.15)] flex flex-col justify-between min-h-0 overflow-hidden relative"
        data-testid="insight-monitor"
      >
        {/* Monitor Top Status Ribbon */}
        <div className="flex items-center justify-between text-[11px] font-mono border-b border-cyan-500/20 pb-1.5 shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOptimal
                  ? 'bg-emerald-400 animate-pulse'
                  : domeLowered
                  ? 'bg-amber-400'
                  : 'bg-rose-500 animate-ping'
              }`}
            />
            <span className="text-cyan-300 font-bold uppercase tracking-wider">
              {isDeepSpace ? 'DSN CARRIER SENSOR' : 'SEIS VBB SENSOR · M4.7 QUAKE'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {!isDeepSpace && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  domeLowered
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                }`}
              >
                DOME: {domeLowered ? 'CLAMPED' : 'EXPOSED'}
              </span>
            )}
            <span className="text-cyan-400 font-bold">{displayHz} Hz</span>
          </div>
        </div>

        {/* Oscilloscope Canvas */}
        <div className="w-full flex-1 flex items-center justify-center my-1 min-h-0 relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            className="w-full h-full max-h-[160px] bg-[#020617] rounded-lg block border border-cyan-900/50"
            data-testid="insight-seismic-canvas"
          />

          {/* Wind turbulence overlay alert if dome is open */}
          {!domeLowered && !isDeepSpace && (
            <div className="absolute inset-0 bg-rose-950/20 backdrop-blur-[0.5px] rounded-lg flex flex-col items-center justify-center pointer-events-none border border-rose-500/30">
              <span className="text-rose-400 font-mono font-bold text-xs sm:text-sm animate-pulse flex items-center gap-1.5 bg-slate-950/90 px-3 py-1 rounded-full border border-rose-500/50 shadow-lg">
                <ShieldAlert size={16} /> ⚠ HIGH SURFACE WIND BUFFETING
              </span>
            </div>
          )}
        </div>

        {/* Monitor Bottom Resonance Gauge */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-cyan-500/20 shrink-0">
          <span className="text-[10px] sm:text-xs font-mono text-slate-400 font-semibold shrink-0">
            SIGNAL RESONANCE:
          </span>

          {/* Progress bar */}
          <div className="flex-1 h-3.5 bg-slate-900 rounded-full overflow-hidden border border-slate-700/80 relative">
            <div
              className={`h-full transition-all duration-200 ${
                isOptimal
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_10px_#10b981]'
                  : resonance > 50
                  ? 'bg-gradient-to-r from-amber-500 to-cyan-400'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${resonance}%` }}
            />
          </div>

          <span
            className={`text-xs font-mono font-bold shrink-0 min-w-[50px] text-right ${
              isOptimal ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            {resonance}%
          </span>
        </div>
      </div>

      {/* 2. Tactile Controls Deck */}
      <div className="w-full flex flex-col gap-2 pt-1 shrink-0">
        {/* Row A: Frequency Slider with Big Step Buttons */}
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 p-2 rounded-xl">
          <button
            data-testid="insight-btn-tune-down"
            disabled={isLocked}
            onClick={() => stepTune(-5)}
            className="min-h-[48px] min-w-[48px] sm:min-w-[52px] rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-cyan-300 flex items-center justify-center font-mono font-bold text-base cursor-pointer disabled:opacity-40 transition-transform active:scale-95 border border-slate-700"
            title="Tune Down (Left Arrow / A)"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex-1 flex flex-col gap-1 px-1 relative">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold">
              <span className="text-slate-400 flex items-center gap-1">
                <Radio size={12} className="text-cyan-400" />
                FREQUENCY FILTER
              </span>
              <span className={isOptimal ? 'text-emerald-400' : 'text-cyan-300'}>
                {displayHz} Hz {isOptimal ? '✓ OPTIMAL' : ''}
              </span>
            </div>

            <input
              data-testid="insight-frequency-slider"
              type="range"
              min="10"
              max="90"
              value={frequency}
              disabled={isLocked}
              onChange={(e) => handleTuneChange(Number(e.target.value))}
              className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />

            {/* Assist marker highlight */}
            {assistActive && (
              <div
                className="absolute top-6 w-3 h-3 bg-amber-400 rounded-full -translate-x-1/2 animate-ping pointer-events-none"
                style={{ left: '50%' }}
              />
            )}
          </div>

          <button
            data-testid="insight-btn-tune-up"
            disabled={isLocked}
            onClick={() => stepTune(5)}
            className="min-h-[48px] min-w-[48px] sm:min-w-[52px] rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-cyan-300 flex items-center justify-center font-mono font-bold text-base cursor-pointer disabled:opacity-40 transition-transform active:scale-95 border border-slate-700"
            title="Tune Up (Right Arrow / D)"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {/* Row B: Two Big Action Buttons (Min 48px Touch Targets) */}
        <div className="flex items-center gap-2">
          {/* Shield Dome Button (For InSight) */}
          {!isDeepSpace && (
            <button
              data-testid="insight-btn-dome"
              disabled={isLocked}
              onClick={toggleDome}
              className={`min-h-[48px] flex-1 flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all cursor-pointer active:scale-95 border ${
                domeLowered
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/60'
                  : 'bg-rose-950/70 border-rose-500/60 text-rose-200 hover:bg-rose-900/60 animate-pulse'
              }`}
            >
              {domeLowered ? <ShieldCheck size={18} /> : <Shield size={18} />}
              <span>{domeLowered ? 'SHIELD: CLAMPED' : 'LOWER SHIELD DOME'}</span>
            </button>
          )}

          {/* Lock In Marsquake Button */}
          <button
            data-testid="insight-btn-lock"
            disabled={isLocked || !isOptimal}
            onClick={handleLockIn}
            className={`min-h-[48px] flex-[1.2] flex items-center justify-center gap-2 rounded-xl text-xs sm:text-sm font-bold font-mono transition-all cursor-pointer shadow-md ${
              isOptimal
                ? 'bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 border border-emerald-300 animate-pulse active:scale-95'
                : 'bg-slate-800/80 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
            }`}
          >
            <Activity size={18} />
            <span>{isLocked ? 'SIGNAL LOCKED!' : 'LOCK MARSQUAKE'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
