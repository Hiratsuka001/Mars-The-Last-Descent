import React, { useState, useEffect, useRef } from 'react';
import { sound } from '../systems/audio';
import { isReduceMotionEnabled } from '../systems/saveManager';
import { NovaAvatar } from './NovaAvatar';
import {
  AlertTriangle,
  ChevronRight,
  Flame,
  BatteryCharging,
  Radio,
  Compass,
  HeartPulse,
  CheckCircle2,
  Wrench,
  AlertOctagon,
} from 'lucide-react';
import crashBackdropImg from '../assets/images/mars_spacecraft_crash_1791205842480.jpg';

interface CrashInterludeProps {
  onComplete: () => void;
}

interface DiagnosticSystem {
  id: string;
  name: string;
  status: string;
  statusColor: string;
  icon: React.ComponentType<{ className?: string }>;
  detail: string;
}

const SYSTEM_ITEMS: DiagnosticSystem[] = [
  {
    id: 'power',
    name: 'Power',
    status: 'Low power',
    statusColor: 'text-amber-400',
    icon: BatteryCharging,
    detail: 'Solar cells cracked on impact. We need backup power cells.',
  },
  {
    id: 'comms',
    name: 'Radio',
    status: 'Offline',
    statusColor: 'text-rose-400',
    icon: Radio,
    detail: "Our radio dish is silent. We can't call home.",
  },
  {
    id: 'gyro',
    name: 'Gyro',
    status: 'Wobbly',
    statusColor: 'text-amber-400',
    icon: Compass,
    detail: 'Steering sensors were shaken. We need to reset the gyro.',
  },
  {
    id: 'life',
    name: 'Life support',
    status: 'OK',
    statusColor: 'text-emerald-400',
    icon: HeartPulse,
    detail: 'Cabin air pressure is safe. Oxygen scrubbers are working fine.',
  },
];

export const CrashInterlude: React.FC<CrashInterludeProps> = ({ onComplete }) => {
  const [beat, setBeat] = useState<number>(1);
  const [reduceMotion] = useState<boolean>(() => isReduceMotionEnabled());
  const [activeSystemId, setActiveSystemId] = useState<string | null>(null);
  const [inspectedSystems, setInspectedSystems] = useState<Record<string, boolean>>({
    power: false,
    comms: false,
    gyro: false,
    life: false,
  });

  const completedRef = useRef(false);

  const handleFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  };

  // Sound and auto-advance timers
  useEffect(() => {
    if (beat === 1) {
      try {
        sound.playRumble?.();
      } catch {}
      const timer = setTimeout(() => {
        setBeat(2);
      }, 4200);
      return () => clearTimeout(timer);
    } else if (beat === 2) {
      try {
        sound.playMistake?.();
      } catch {}
      const timer = setTimeout(() => {
        setBeat(3);
      }, 4200);
      return () => clearTimeout(timer);
    } else if (beat === 3) {
      try {
        sound.playNovaChirp?.();
      } catch {}
      // Auto-advance after 18s on Stage 3 if untouched, giving ample time to inspect diagnostics
      const timer = setTimeout(() => {
        handleFinish();
      }, 18000);
      return () => clearTimeout(timer);
    }
  }, [beat]);

  const handleContainerClick = () => {
    if (beat < 3) {
      setBeat((prev) => prev + 1);
    }
  };

  const handleSystemClick = (e: React.MouseEvent, sub: DiagnosticSystem) => {
    e.stopPropagation();
    try {
      sound.playClick?.();
    } catch {}
    setActiveSystemId(sub.id);
    setInspectedSystems((prev) => ({ ...prev, [sub.id]: true }));
  };

  return (
    <div
      data-testid="crash-interlude"
      onClick={handleContainerClick}
      className="fixed inset-0 z-50 w-full h-full overflow-hidden bg-[#0c0302] text-slate-100 flex flex-col justify-between select-none cursor-pointer"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
      }}
    >
      <style>{`
        @keyframes crash-shake {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          15% { transform: translate(-4px, 3px) rotate(-0.5deg); }
          30% { transform: translate(4px, -3px) rotate(0.5deg); }
          45% { transform: translate(-3px, -2px) rotate(-0.3deg); }
          60% { transform: translate(3px, 2px) rotate(0.3deg); }
          75% { transform: translate(-2px, 3px) rotate(-0.2deg); }
          90% { transform: translate(2px, -1px) rotate(0.2deg); }
        }
        @keyframes crash-flash {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.85; }
        }
        .crash-shake-active {
          animation: crash-shake 0.18s infinite linear;
        }
        .crash-flash-active {
          animation: crash-flash 0.35s infinite ease-in-out;
        }
      `}</style>

      {/* Cinematic Martian Crash Backdrop Image */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <img
          src={crashBackdropImg}
          alt="Mars crash landing backdrop"
          className={`w-full h-full object-cover transition-opacity duration-700 ${
            beat === 1
              ? 'opacity-30 filter contrast-125 brightness-75'
              : beat === 2
              ? 'opacity-40 filter contrast-150 brightness-50'
              : 'opacity-55 filter contrast-125 brightness-90'
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0c0302] via-[#0c0302]/70 to-[#0c0302]/40" />
      </div>

      {/* Top Header with Progress Dots and Skip Button (>=12px from viewport edges) */}
      <div className="relative w-full flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2" data-testid="crash-progress-dots" aria-label={`Progress ${beat} of 3`}>
          {[1, 2, 3].map((step) => (
            <span
              key={step}
              className={`h-2 rounded-full transition-all duration-300 ${
                step === beat
                  ? 'w-6 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                  : step < beat
                  ? 'w-2 bg-cyan-600/70'
                  : 'w-2 bg-slate-700'
              }`}
            />
          ))}
          <span className="text-[10px] font-mono text-slate-400 ml-1">
            {beat === 1 ? 'DESCENT' : beat === 2 ? 'IMPACT' : 'DIAGNOSTICS'}
          </span>
        </div>

        <button
          data-testid="crash-skip-btn"
          onClick={(e) => {
            e.stopPropagation();
            sound.playClick?.();
            handleFinish();
          }}
          className="px-3.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono flex items-center gap-1 cursor-pointer transition-colors shadow-lg"
        >
          <span>Skip</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Center Stage */}
      <div className="relative flex-1 w-full flex items-center justify-center z-10 my-auto py-1">
        {/* BEAT 1: Entering Mars (Atmospheric Descent & Malfunction) */}
        {beat === 1 && (
          <div
            data-testid="crash-beat-1"
            className={`w-full max-w-md mx-auto text-center flex flex-col items-center justify-center gap-3.5 ${
              !reduceMotion ? 'crash-shake-active' : ''
            }`}
          >
            <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-500/50 text-rose-300 text-[11px] font-mono uppercase tracking-wider shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              <AlertOctagon className="w-3.5 h-3.5 animate-pulse" />
              <span>18,000 meters up!</span>
            </div>

            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-gradient-to-t from-orange-600 via-amber-500 to-yellow-300 shadow-[0_0_50px_rgba(249,115,22,0.8)] border border-amber-300/60">
              <Flame className="w-10 h-10 text-white animate-pulse" />
            </div>

            <div className="space-y-1.5 px-2">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white tracking-wide drop-shadow-[0_0_20px_rgba(249,115,22,0.6)]">
                Entering Mars...
              </h1>
              <p className="text-xs sm:text-sm font-mono text-orange-200/90 leading-relaxed font-semibold">
                Strong winds shake the ship. The engines are failing!
              </p>
            </div>
          </div>
        )}

        {/* BEAT 2: Hard Impact & Systems Failing */}
        {beat === 2 && (
          <div
            data-testid="crash-beat-2"
            className="w-full max-w-md mx-auto text-center flex flex-col items-center justify-center gap-3.5 relative"
          >
            {/* Emergency Red Flash Overlay (Static opacity when reduced motion is on) */}
            <div
              className={`absolute -inset-16 rounded-3xl bg-red-600/25 pointer-events-none ${
                !reduceMotion ? 'crash-flash-active' : 'opacity-30'
              }`}
            />

            <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-500/70 text-red-300 text-[11px] font-mono uppercase tracking-wider z-10 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
              <AlertTriangle className="w-3.5 h-3.5 animate-bounce" />
              <span>ALTITUDE: 0 METERS · HARD LANDING</span>
            </div>

            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center bg-red-950 border-2 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.9)] z-10">
              <AlertTriangle className="w-10 h-10 text-red-400 animate-pulse" />
            </div>

            <div className="space-y-1.5 px-2 z-10">
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-red-400 tracking-wide drop-shadow-[0_0_25px_rgba(239,68,68,0.8)]">
                SYSTEMS FAILING!
              </h1>
              <p className="text-xs sm:text-sm font-mono text-red-200/90 leading-relaxed font-semibold">
                Brace for impact!
              </p>
              <p className="text-[11px] font-mono text-slate-300 max-w-xs mx-auto pt-1 leading-snug">
                The ship hit the ground hard. Dust is everywhere!
              </p>
            </div>
          </div>
        )}

        {/* BEAT 3: Nova Reboot & 4 Systems Interactive Diagnostic Checklist */}
        {beat === 3 && (
          <div
            data-testid="crash-beat-3"
            className="w-full max-w-lg mx-auto flex flex-col items-center justify-center gap-2.5 sm:gap-3 px-2 z-10"
          >
            {/* Top Nova Header */}
            <div className="flex items-center gap-3 bg-slate-950/90 border border-cyan-500/40 rounded-xl p-2.5 sm:p-3 shadow-lg w-full">
              <NovaAvatar mood="warning" size={48} />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                  NOVA // REBOOTED
                </div>
                <p className="text-xs sm:text-sm font-mono text-cyan-200 leading-snug">
                  "Rebooting... who are you? I forgot everything."
                </p>
                <p className="text-[11px] font-mono text-cyan-300/80 leading-snug mt-0.5">
                  "I'll leave notes on old probes. Help me find them!"
                </p>
              </div>
            </div>

            {/* 4 Interactive System Diagnostic Cards */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-1.5 px-1">
                <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <Wrench className="w-3 h-3 text-cyan-400" />
                  <span>SPACECRAFT SYSTEM STATUS</span>
                </span>
                <span className="text-[9px] font-mono text-slate-400">
                  TAP TO INSPECT
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SYSTEM_ITEMS.map((sub) => {
                  const Icon = sub.icon;
                  const isInspected = inspectedSystems[sub.id];
                  const isActive = activeSystemId === sub.id;

                  return (
                    <button
                      key={sub.id}
                      onClick={(e) => handleSystemClick(e, sub)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isActive
                          ? 'bg-slate-900 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                          : isInspected
                          ? 'bg-slate-950/90 border-slate-700 hover:border-slate-500'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div className="p-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        {isInspected && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />}
                      </div>
                      <div>
                        <div className="text-xs font-bold font-display text-white">{sub.name}</div>
                        <div className={`text-[10px] font-mono font-semibold mt-0.5 ${sub.statusColor}`}>
                          {sub.status}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Diagnostic Detail Box (Displays when a card is selected) */}
            {activeSystemId && (
              <div className="w-full p-2 rounded-lg bg-slate-950/95 border border-cyan-500/40 text-[11px] font-mono text-slate-200 flex items-center justify-between shadow-md">
                <span className="flex-1 pr-2">
                  {SYSTEM_ITEMS.find((s) => s.id === activeSystemId)?.detail}
                </span>
                <span className="text-[9px] text-cyan-400 font-bold uppercase shrink-0">LOGGED</span>
              </div>
            )}

            {/* Primary Action Button: Enter Mars Open World */}
            <button
              data-testid="crash-continue-btn"
              onClick={(e) => {
                e.stopPropagation();
                sound.playClick?.();
                handleFinish();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 active:bg-cyan-200 text-slate-950 font-bold font-mono text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.5)] cursor-pointer transition-all animate-pulse"
            >
              <span>Start exploring -&gt;</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="relative w-full text-center text-[10px] font-mono text-slate-400 z-10 shrink-0">
        {beat < 3 ? 'Tap anywhere to proceed' : 'Crashed near Ares Vallis · Pressure: 610 Pa'}
      </div>
    </div>
  );
};
