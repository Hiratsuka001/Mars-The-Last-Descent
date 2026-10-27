import React from 'react';
import { sound } from '../systems/audio';
import { X, Gamepad2, Search, Wrench, Rocket, Zap, Radio, Heart } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  return (
    <div
      data-testid="how-to-play-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none"
    >
      <div className="relative w-full max-w-lg bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.25)] overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold font-display tracking-wider text-white">
              MISSION BRIEFING & CONTROLS
            </h3>
          </div>
          <button
            data-testid="how-to-play-close-btn"
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Grid & List */}
        <div className="p-5 space-y-2.5 font-mono text-xs overflow-y-auto max-h-[calc(90vh-120px)] custom-scrollbar">
          <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold shrink-0">
              🕹️
            </div>
            <div>
              <div className="font-bold text-white text-[13px] flex items-center gap-2">
                MOVE & JETPACK SPRINT
                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">NEW</span>
              </div>
              <div className="text-slate-400 text-[11px] font-sans">
                <span className="text-cyan-300 font-mono">[WASD]</span> / Arrows to walk · Hold <span className="text-amber-300 font-mono font-bold">[Shift]</span> / <span className="text-amber-300 font-mono font-bold">BOOST</span> button for Jetpack Thruster sprint!
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-9 h-9 rounded-lg bg-blue-950/80 border border-blue-500/40 flex items-center justify-center text-blue-300 font-bold shrink-0">
              <Radio className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="font-bold text-white text-[13px] flex items-center gap-2">
                NOVA SONAR RADAR PING
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono">NEW</span>
              </div>
              <div className="text-slate-400 text-[11px] font-sans">
                Press <span className="text-cyan-300 font-mono font-bold">[Space]</span> / <span className="text-cyan-300 font-mono font-bold">[Q]</span> / <span className="text-cyan-300 font-mono font-bold">SCAN</span> to emit an expanding radar wave that clears fog and reveals rover beacons!
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-9 h-9 rounded-lg bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-300 font-bold shrink-0">
              <Heart className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <div className="font-bold text-white text-[13px] flex items-center gap-2">
                PET NOVA COMPANION
                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-mono">NEW</span>
              </div>
              <div className="text-slate-400 text-[11px] font-sans">
                Walk up to robotic cat NOVA and press <span className="text-rose-300 font-mono font-bold">[P]</span> or tap NOVA to pet! Triggers purr and <span className="text-emerald-300 font-bold">+15% Morale Overdrive</span>.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-9 h-9 rounded-lg bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold shrink-0">
              <Search className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <div className="font-bold text-white text-[13px] flex items-center gap-2">
                FIELD SCIENCE SAMPLES
                <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono">NEW</span>
              </div>
              <div className="text-slate-400 text-[11px] font-sans">
                Collect 6 rare Martian geological specimens with <span className="text-cyan-300 font-mono font-bold">[E]</span>. Inspect NASA discovery facts in Mission Codex (<span className="text-cyan-300 font-mono font-bold">[C]</span>).
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-bold shrink-0">
              <Wrench className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="font-bold text-white text-[13px]">SALVAGE 8 ROVER PARTS</div>
              <div className="text-slate-400 text-[11px] font-sans">
                Follow radar signals to historical rovers (Sojourner, Opportunity, InSight, Spirit...) and solve engineering puzzles to salvage parts.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3.5 p-2.5 rounded-xl bg-slate-900/50 border border-slate-800/80">
            <div className="w-9 h-9 rounded-lg bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold shrink-0">
              <Rocket className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="font-bold text-white text-[13px]">REPAIR & LAUNCH</div>
              <div className="text-slate-400 text-[11px] font-sans">
                Return to your crashed ship · Calibrate subsystems with your salvaged components · Ascent to orbit!
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/40 flex justify-end">
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs cursor-pointer transition-colors shadow-md"
          >
            Got it, Let's Explore! →
          </button>
        </div>
      </div>
    </div>
  );
};

