import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../systems/audio';
import { NovaAvatar } from './NovaAvatar';
import { GameProgress } from '../systems/saveManager';
import { CheckCircle2, Rocket, Award, RotateCcw, Home, FastForward } from 'lucide-react';

interface LaunchCinematicProps {
  progress?: GameProgress;
  onReturnToMenu?: () => void;
  onRestartCampaign?: () => void;
  onCinematicComplete?: () => void;
}

export const LaunchCinematic: React.FC<LaunchCinematicProps> = ({
  progress,
  onReturnToMenu = () => {},
  onRestartCampaign = () => {},
  onCinematicComplete,
}) => {
  // Phase 0: Pre-flight systems check
  // Phase 1: Hatch seal & Engine ignition countdown (3s)
  // Phase 2: Ascent through Martian sky (3.2s)
  // Phase 3: Trans-Earth injection burn & Earth in view (3.2s)
  // Phase 4: Mission Complete victory screen (fallback if no onCinematicComplete)
  const [phase, setPhase] = useState<number>(0);
  const [countdown, setCountdown] = useState<number>(3);
  const timerRefs = useRef<number[]>([]);

  const handleSkip = () => {
    sound.playClick();
    timerRefs.current.forEach((t) => clearTimeout(t));
    if (onCinematicComplete) {
      onCinematicComplete();
    } else {
      setPhase(4);
    }
  };

  const startIgnition = () => {
    sound.playClick();
    setPhase(1);

    let cnt = 3;
    setCountdown(3);
    const interval = window.setInterval(() => {
      cnt--;
      setCountdown(cnt);
      sound.playHover();
      if (cnt <= 0) {
        clearInterval(interval);
        sound.playLaunchIgnition();
        setPhase(2);

        const t1 = window.setTimeout(() => {
          setPhase(3);
        }, 3200);
        timerRefs.current.push(t1);

        const t2 = window.setTimeout(() => {
          sound.playSuccess();
          if (onCinematicComplete) {
            onCinematicComplete();
          } else {
            setPhase(4);
          }
        }, 6500);
        timerRefs.current.push(t2);
      }
    }, 1000);
    timerRefs.current.push(interval);
  };

  useEffect(() => {
    sound.startAmbience('space');
    // Auto-advance to ignition countdown after brief verification pause (1.4s)
    const autoTimer = window.setTimeout(() => {
      startIgnition();
    }, 1400);
    timerRefs.current.push(autoTimer);

    return () => {
      timerRefs.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  return (
    <div
      data-testid="launch-cinematic"
      className="fixed inset-0 z-[100] w-screen h-screen bg-[#03060d] text-slate-100 flex flex-col justify-between p-4 sm:p-8 md:p-12 overflow-hidden select-none animate-in fade-in duration-300"
    >
      
      {/* Dynamic Cinematic Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {phase <= 2 ? (
          // Mars atmosphere launch view
          <div className="w-full h-full bg-gradient-to-t from-[#83341d] via-[#38160d] to-[#04060d]">
            {phase === 2 && (
              <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-32 h-64 bg-gradient-to-t from-amber-400 via-orange-500 to-transparent blur-md animate-pulse" />
            )}
          </div>
        ) : (
          // Deep space with distant Mars & glowing Earth
          <div className="w-full h-full bg-[#04060e] flex items-center justify-center relative">
            {/* Distant Mars receding */}
            <div className="absolute top-1/4 left-1/4 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-orange-500 to-red-900 shadow-xl opacity-60" />
            {/* Earth glowing in front */}
            <div className="w-40 h-40 sm:w-64 sm:h-64 rounded-full bg-gradient-to-tr from-sky-950 via-blue-700 to-cyan-500 shadow-[0_0_80px_rgba(56,189,248,0.4)] animate-in zoom-in-75 duration-1000" />
          </div>
        )}
      </div>

      {/* Top Header with Skip Button */}
      <div className="relative z-10 flex items-center justify-between w-full">
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>RETURN ASCENT // ORBITAL INJECTION</span>
        </div>

        <button
          data-testid="skip-cinematic-btn"
          onClick={handleSkip}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono text-cyan-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-lg active:scale-95"
          title="Skip cinematic"
        >
          <span>Skip Cinematic</span>
          <FastForward className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center Cinematic Stage */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center my-4 max-w-xl mx-auto w-full px-2">
        
        {/* Phase 0: Pre-flight Verification Checklist */}
        {phase === 0 && (
          <div className="w-full p-5 sm:p-7 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 shadow-2xl space-y-4 animate-in fade-in duration-300">
            <div className="text-center space-y-0.5">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                AUTOMATED LAUNCH AUTHORIZATION
              </span>
              <h2 className="text-xl sm:text-2xl font-bold font-display text-white">
                RETURN MISSION READY
              </h2>
            </div>

            {/* Checklist */}
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                <span className="text-slate-200">POWER & ENGINES:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% NOMINAL
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                <span className="text-slate-200">ASCENT CORRIDOR:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> CLEAR
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex items-center justify-between">
                <span className="text-slate-200">EARTH TRAJECTORY:</span>
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> LOCKED
                </span>
              </div>
            </div>

            <button
              onClick={startIgnition}
              className="w-full py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold font-mono text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(6,182,212,0.5)] transition-all cursor-pointer"
            >
              <Rocket className="w-4 h-4" />
              <span>IGNITE ENGINES NOW</span>
            </button>
          </div>
        )}

        {/* Phase 1: Ignition Countdown */}
        {phase === 1 && (
          <div className="text-center space-y-3 p-6 sm:p-8 rounded-2xl bg-black/85 backdrop-blur-md border border-cyan-500/40 animate-in zoom-in-95 duration-200">
            <div className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
              PRIMARY ENGINE IGNITION
            </div>
            <div className="text-6xl sm:text-7xl font-bold font-mono text-white animate-pulse">
              T-00:0{countdown}
            </div>
            <p className="text-xs text-slate-400 font-mono">
              HATCH SEALED · THRUST VECTORS 100% · READY FOR LIFTOFF
            </p>
          </div>
        )}

        {/* Phase 2: Mars Liftoff Ascent */}
        {phase === 2 && (
          <div className="text-center space-y-3 p-6 sm:p-8 rounded-2xl bg-black/80 backdrop-blur-md border border-orange-500/40 animate-in fade-in duration-500">
            <div className="text-xs font-mono text-orange-400 uppercase tracking-widest animate-pulse">
              LIFTOFF // ASCENT
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold font-display text-white">
              CLIMBING THROUGH MARTIAN SKY
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-mono">
              VELOCITY: 3.8 KM/S · ATMOSPHERIC BREAKOUT NOMINAL
            </p>
          </div>
        )}

        {/* Phase 3: Trans-Earth Trajectory */}
        {phase === 3 && (
          <div className="text-center space-y-3 p-6 sm:p-8 rounded-2xl bg-black/85 backdrop-blur-md border border-sky-500/40 animate-in fade-in duration-500">
            <div className="text-xs font-mono text-sky-400 uppercase tracking-widest animate-pulse">
              TRANS-EARTH INJECTION BURN
            </div>
            <h3 className="text-2xl sm:text-3xl font-bold font-display text-white">
              HEADING HOME
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              Mars recedes behind us. Earth is in view ahead.
            </p>
          </div>
        )}

        {/* Phase 4: MISSION COMPLETE Victory Screen (Fallback) */}
        {phase === 4 && (
          <div className="w-full max-w-xl p-6 sm:p-8 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-cyan-500/50 shadow-2xl space-y-5 animate-in zoom-in-95 duration-500 text-center">
            <div className="flex justify-center">
              <NovaAvatar mood="celebrate" size={80} />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                <Award className="w-4 h-4" />
                <span>EXPEDITION ACCOMPLISHED</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-wide">
                MISSION COMPLETE
              </h2>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  sound.playClick();
                  onReturnToMenu();
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                <span>Main Menu</span>
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  onRestartCampaign();
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold font-mono text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Footer Subtext */}
      <div className="relative z-10 text-[10px] sm:text-xs font-mono text-slate-500 text-center">
        MARS: THE LAST DESCENT · Open-World Sci-Fi Educational Exploration
      </div>

    </div>
  );
};
