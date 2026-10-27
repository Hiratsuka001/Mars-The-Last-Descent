import React, { useState } from 'react';
import { sound } from '../systems/audio';
import { NovaAvatar } from './NovaAvatar';
import { GameProgress, formatPlayTime, resetProgress } from '../systems/saveManager';
import { HowToPlayModal } from './HowToPlayModal';
import { LegacyChaptersModal } from './LegacyChaptersModal';
import {
  Play,
  RotateCcw,
  BookOpen,
  Compass,
  Settings as SettingsIcon,
  Info,
  Volume2,
  VolumeX,
  AlertTriangle,
  History,
  Gamepad2,
} from 'lucide-react';
import nasaMontageImg from '../assets/images/nasa_mars_missions_1791205882072.jpg';

interface MainMenuProps {
  progress: GameProgress;
  onStartNewMission: () => void;
  onContinueMission: () => void;
  onSelectChapter?: (chapter: number) => void;
  onOpenArchive: () => void;
  onOpenKnowledge: () => void;
  onOpenSettings: () => void;
  onOpenCredits: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  progress,
  onStartNewMission,
  onContinueMission,
  onSelectChapter,
  onOpenArchive,
  onOpenKnowledge,
  onOpenSettings,
  onOpenCredits,
}) => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showLegacyChapters, setShowLegacyChapters] = useState(false);

  const completedCount = progress.worldSave?.completedEquipmentIds?.length ?? 0;
  const partsCount = progress.worldSave?.collectedPartIds?.length ?? 0;

  const hasSavedProgress =
    progress.currentChapter > 0 ||
    progress.unlockedMissions.length > 0 ||
    partsCount > 0 ||
    (progress.worldSave?.playTimeSeconds ?? 0) > 10;

  // Keyboard shortcut: Press Enter or Space to start/continue immediately
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showResetConfirm || showHowToPlay || showLegacyChapters) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        sound.playClick();
        if (hasSavedProgress) {
          onContinueMission();
        } else {
          onStartNewMission();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [hasSavedProgress, onContinueMission, onStartNewMission, showResetConfirm, showHowToPlay, showLegacyChapters]);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    if (!muted) sound.playClick();
  };

  return (
    <div
      data-testid="main-menu"
      className="relative w-full h-full min-h-screen bg-[#04060d] text-slate-100 flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Background Cinematic Space Panorama */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <img
          src={nasaMontageImg}
          alt="Deep Space Planetary Exploration"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-35 filter brightness-75 contrast-125"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060d] via-[#04060d]/60 to-transparent" />
        <div className="absolute inset-0 sci-fi-grid opacity-30" />
      </div>

      {/* Top Bar: Wordmark, Navigation, Audio/Settings */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-base sm:text-lg font-bold font-display tracking-wider text-white">
            MARS: THE LAST DESCENT
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-slate-400">
          <button
            data-testid="menu-how-to-play-link"
            onClick={() => {
              sound.playClick();
              setShowHowToPlay(true);
            }}
            className="hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Gamepad2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>How to Play</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onOpenArchive();
            }}
            className="hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>Codex ({completedCount}/8)</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setShowLegacyChapters(true);
            }}
            className="hover:text-amber-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>Legacy Chapters</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onOpenCredits();
            }}
            className="hover:text-cyan-300 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Credits & Sources</span>
          </button>
        </nav>

        {/* Audio & Settings */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
          <button
            onClick={() => {
              sound.playClick();
              onOpenSettings();
            }}
            className="p-2 rounded-xl bg-slate-900/80 border border-slate-700/60 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Hero & Menu Options */}
      <main className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center px-6 sm:px-12 py-8 gap-8 max-w-6xl mx-auto w-full">
        {/* Left Column: Title & Action Matrix */}
        <div className="flex-1 space-y-6 max-w-lg">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-xs font-mono text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>NASA PLANETARY SALVAGE EXPEDITION</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-black font-display tracking-tight text-white leading-tight">
              MARS: THE LAST DESCENT
            </h1>

            <p className="text-sm text-slate-400 font-normal leading-relaxed">
              Stranded on the Martian surface with critical system failures. Traverse open-world regolith plains, salvage historical NASA rovers and landers, solve diagnostic engineering puzzles, and repair your spacecraft before atmospheric dust storms overwhelm the landing site.
            </p>
          </div>

          {/* Action Buttons Matrix */}
          <div className="space-y-3 pt-1">
            {hasSavedProgress && (
              <button
                data-testid="continue-mission-btn"
                onClick={() => {
                  sound.playClick();
                  onContinueMission();
                }}
                className="w-full p-4 rounded-xl font-bold font-mono text-sm tracking-wider flex items-center justify-between transition-all cursor-pointer bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.5)] animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <Play className="w-4 h-4 fill-current" />
                  <div className="text-left">
                    <div>CONTINUE EXPEDITION</div>
                    {progress.worldSave && (
                      <div className="text-[10px] text-slate-900 font-mono font-normal">
                        Parts: {partsCount}/8 · Time: {formatPlayTime(progress.worldSave.playTimeSeconds)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900/20 text-slate-950 font-mono font-bold">
                    PRESS ENTER ↵
                  </span>
                  <span className="text-xs text-slate-900 font-mono">RESUME →</span>
                </div>
              </button>
            )}

            <button
              data-testid="start-mission-btn"
              onClick={() => {
                sound.playClick();
                if (hasSavedProgress) {
                  setShowResetConfirm(true);
                } else {
                  onStartNewMission();
                }
              }}
              className={`w-full p-4 rounded-xl font-bold font-mono text-sm tracking-wider flex items-center justify-between transition-all cursor-pointer ${
                hasSavedProgress
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(6,182,212,0.5)] animate-pulse'
              }`}
            >
              <div className="flex items-center gap-3">
                <RotateCcw className="w-4 h-4" />
                <span>START NEW EXPEDITION</span>
              </div>
              <div className="flex items-center gap-2">
                {!hasSavedProgress && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900/20 text-slate-950 font-mono font-bold">
                    PRESS ENTER ↵
                  </span>
                )}
                <span className="text-xs opacity-75 font-mono">EXPLORE MARS →</span>
              </div>
            </button>

            {/* Quick Access Grid: How to Play, Codex, Legacy, Credits */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                data-testid="how-to-play-btn"
                onClick={() => {
                  sound.playClick();
                  setShowHowToPlay(true);
                }}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Gamepad2 className="w-4 h-4 text-cyan-400" />
                <span>HOW TO PLAY</span>
              </button>

              <button
                data-testid="open-codex-btn"
                onClick={() => {
                  sound.playClick();
                  onOpenArchive();
                }}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-mono font-medium flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Compass className="w-4 h-4 text-emerald-400" />
                <span>CODEX ({completedCount}/8)</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                data-testid="legacy-chapters-btn"
                onClick={() => {
                  sound.playClick();
                  setShowLegacyChapters(true);
                }}
                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-amber-300 border border-slate-800/80 text-xs font-mono flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>LEGACY CHAPTERS</span>
              </button>

              <button
                data-testid="open-credits-btn"
                onClick={() => {
                  sound.playClick();
                  onOpenCredits();
                }}
                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800/80 text-xs font-mono flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Info className="w-3.5 h-3.5" />
                <span>CREDITS & SOURCES</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: NOVA Interactive Companion Showcase */}
        <div className="relative flex flex-col items-center justify-center">
          <div className="relative p-8 rounded-3xl bg-slate-950/60 backdrop-blur-md border border-cyan-500/20 shadow-2xl flex flex-col items-center text-center max-w-sm">
            {/* Holographic Badge */}
            <div className="absolute -top-3 px-3 py-1 bg-cyan-950 border border-cyan-500/40 rounded-full text-[10px] font-mono text-cyan-300 tracking-widest uppercase">
              AUTONOMOUS SCIENCE COMPANION
            </div>

            <div className="my-4">
              <NovaAvatar mood="idle" size={130} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold font-display text-white">NOVA</h3>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                "Pre-flight systems nominal, Explorer! 8 NASA relics are scattered across the sector. Let's find them and repair our ascent module."
              </p>
            </div>

            {/* Quick Interactive Chirp */}
            <button
              onClick={() => sound.playNovaChirp()}
              className="mt-4 px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>Meow / Chirp Test</span>
              <span className="text-[10px]">♫</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-3 border-t border-slate-800/80 bg-slate-950/80 text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>Mars: The Last Descent · Authentic NASA Planetary Aerospace Science</div>
        <div className="text-[11px] text-slate-500">
          8 Relics · 4 Biomes · Seeded Procedural World · CC0 Assets
        </div>
      </footer>

      {/* How to Play Modal */}
      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}

      {/* Legacy Chapters Modal */}
      {showLegacyChapters && (
        <LegacyChaptersModal
          onSelectChapter={(ch) => {
            if (onSelectChapter) onSelectChapter(ch);
          }}
          onClose={() => setShowLegacyChapters(false)}
        />
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div
          data-testid="reset-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div className="relative max-w-md w-full p-6 rounded-2xl bg-slate-950 border border-amber-500/50 shadow-[0_0_50px_rgba(245,158,11,0.3)] space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold font-display text-white">
                Start New Expedition?
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Starting a new mission will overwrite your existing saved Mars expedition progress
              {progress.worldSave ? ` (${partsCount}/8 parts collected)` : ''}.
              Are you sure you want to begin a fresh journey?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  sound.playClick();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                data-testid="confirm-new-game-btn"
                onClick={() => {
                  sound.playClick();
                  setShowResetConfirm(false);
                  resetProgress();
                  onStartNewMission();
                }}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono text-xs cursor-pointer shadow-lg transition-all"
              >
                Confirm New Game
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
