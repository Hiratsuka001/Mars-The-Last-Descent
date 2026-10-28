/**
 * Ending Screen Modal & Epilogue
 * Displays campaign metrics, completion epilogue, and restart/menu options.
 */

import React, { useState } from 'react';
import { sound } from '../systems/audio';
import { NovaAvatar } from './NovaAvatar';
import { formatPlayTime } from '../systems/saveManager';
import { ORDERED_LOGS } from '../data/logs';
import { Award, RotateCcw, Home, Info, Sparkles, Clock, Wrench, Compass, Radio } from 'lucide-react';

interface EndingScreenProps {
  playTimeSeconds: number;
  partsCount: number;
  totalParts?: number;
  exploredTiles: number;
  seed: number | string;
  recoveredLogIds?: string[];
  onPlayAgain: (newSeed: boolean) => void;
  onReturnToMenu: () => void;
  onOpenCredits: () => void;
}

export const EndingScreen: React.FC<EndingScreenProps> = ({
  playTimeSeconds,
  partsCount = 8,
  totalParts = 8,
  exploredTiles = 0,
  seed,
  recoveredLogIds = [],
  onPlayAgain,
  onReturnToMenu,
  onOpenCredits,
}) => {
  const [isLogsSkipped, setIsLogsSkipped] = useState<boolean>(false);

  const unlockedLogs = ORDERED_LOGS.filter(
    (log) =>
      recoveredLogIds.includes(log.id) ||
      recoveredLogIds.includes(log.wreckId) ||
      recoveredLogIds.includes(log.partId)
  );

  return (
    <div data-testid="ending-screen" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300 select-none">
      <div className="relative w-full max-w-xl p-6 sm:p-8 rounded-2xl bg-slate-950/95 border border-cyan-500/50 shadow-[0_0_80px_rgba(6,182,212,0.4)] flex flex-col items-center text-center space-y-6 max-h-[92vh] overflow-y-auto">
        
        {/* Nova Celebration Avatar */}
        <div className="relative">
          <NovaAvatar mood="celebrate" size={88} />
          <div className="absolute -top-1 -right-1 p-1.5 rounded-full bg-amber-400 text-slate-950 animate-bounce">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Title & Epilogue */}
        <div className="space-y-2">
          <div className="text-xs font-mono text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1.5 font-bold">
            <Award className="w-4 h-4" />
            <span>MISSION ACCOMPLISHED</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-white tracking-wide">
            RETURN FROM MARS
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 font-light leading-relaxed max-w-md mx-auto pt-1">
            "With all 8 historical instruments salvaged and analyzed, your spacecraft achieved trans-Earth injection orbit. The knowledge preserved from Mars' earliest robotic explorers will guide humanity for generations."
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full pt-1">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>TIME PLAYED</span>
            </div>
            <div className="text-sm font-bold font-mono text-cyan-300 mt-1">
              {formatPlayTime(playTimeSeconds)}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Wrench className="w-3 h-3 text-amber-400" />
              <span>SHIP PARTS</span>
            </div>
            <div className="text-sm font-bold font-mono text-amber-300 mt-1">
              {partsCount} / {totalParts}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>EXPLORED</span>
            </div>
            <div className="text-sm font-bold font-mono text-emerald-300 mt-1">
              {exploredTiles} tiles
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-left">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Award className="w-3 h-3 text-purple-400" />
              <span>WORLD SEED</span>
            </div>
            <div className="text-sm font-bold font-mono text-purple-300 mt-1 truncate" title={String(seed)}>
              {seed}
            </div>
          </div>
        </div>

        {/* Story Logs: Memory Fragments */}
        {unlockedLogs.length > 0 && !isLogsSkipped && (
          <div data-testid="ending-logs-section" className="w-full text-left space-y-3 pt-3 border-t border-slate-800 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                  Recovered Memory Logs ({unlockedLogs.length}/8)
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                  FICTION
                </span>
              </div>
              <button
                data-testid="skip-logs-btn"
                onClick={() => {
                  sound.playClick();
                  setIsLogsSkipped(true);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-white cursor-pointer transition-colors"
              >
                Skip Logs →
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {unlockedLogs.map((log) => (
                <div key={log.id} data-testid="ending-log-item" className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
                  <div className="text-[10px] font-mono text-cyan-400 font-semibold mb-0.5">
                    Log #{log.order}: {log.probeName}
                  </div>
                  <div className="text-slate-200 italic font-mono text-[11px] leading-relaxed">
                    "{log.text}"
                  </div>
                </div>
              ))}
            </div>

            {unlockedLogs.length >= 8 && (
              <div
                data-testid="nova-log-reveal"
                className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-400 text-cyan-200 text-xs font-mono flex items-center gap-2.5 shadow-[0_0_20px_rgba(6,182,212,0.3)] animate-in fade-in duration-300"
              >
                <span className="text-lg">🐱</span>
                <span className="font-semibold text-white">
                  "Those were my words. I'd forgotten them. Thank you for finding me."
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons Matrix */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <button
            data-testid="play-again-btn"
            onClick={() => {
              sound.playClick();
              onPlayAgain(true); // New random seed
            }}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold font-mono text-xs tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again (New Seed)</span>
          </button>

          <button
            data-testid="replay-seed-btn"
            onClick={() => {
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span>Replay Same Seed</span>
          </button>

          <button
            data-testid="ending-menu-btn"
            onClick={() => {
              sound.playClick();
              onReturnToMenu();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Menu</span>
          </button>

          <button
            data-testid="ending-credits-btn"
            onClick={() => {
              sound.playClick();
              onOpenCredits();
            }}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 cursor-pointer transition-colors"
            title="Credits & Attributions"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};

