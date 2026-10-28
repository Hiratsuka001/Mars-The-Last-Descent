import React, { useState } from 'react';
import { sound } from '../systems/audio';
import { resetProgress, isReduceMotionEnabled, setReduceMotionEnabled } from '../systems/saveManager';
import { X, Volume2, VolumeX, RotateCcw, Keyboard, Sliders, Eye } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onResetSave: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onResetSave }) => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [musicVol, setMusicVol] = useState(sound.getMusicVolume());
  const [sfxVol, setSfxVol] = useState(sound.getSfxVolume());
  const [reduceMotion, setReduceMotion] = useState(isReduceMotionEnabled());
  const [confirmReset, setConfirmReset] = useState(false);

  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    if (!muted) sound.playClick();
  };

  const handleMusicChange = (val: number) => {
    setMusicVol(val);
    sound.setMusicVolume(val);
  };

  const handleSfxChange = (val: number) => {
    setSfxVol(val);
    sound.setSfxVolume(val);
    sound.playHover();
  };

  const handleToggleReduceMotion = () => {
    const nextVal = !reduceMotion;
    setReduceMotion(nextVal);
    setReduceMotionEnabled(nextVal);
    sound.playClick();
  };

  const handleReset = () => {
    sound.playClick();
    resetProgress();
    onResetSave();
    setConfirmReset(false);
    onClose();
  };

  return (
    <div
      data-testid="settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold font-display text-white">
              Mission Control Settings
            </h3>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          
          {/* Audio Synthesizer Master Mute */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Procedural WebAudio Synthesizer</div>
                <div className="text-slate-400 mt-0.5">
                  100% CC0 real-time synthesis: wind loops, footsteps, blips, & fanfares
                </div>
              </div>
              <button
                onClick={toggleSound}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                  isMuted
                    ? 'bg-slate-900 border-slate-800 text-slate-500'
                    : 'bg-cyan-950 border-cyan-500/50 text-cyan-300'
                }`}
                title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            </div>

            {/* Volume Sliders */}
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-slate-300 font-mono">
                <span>Music & Biome Wind:</span>
                <span className="text-cyan-400 font-bold">{Math.round(musicVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVol}
                onChange={(e) => handleMusicChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />

              <div className="flex items-center justify-between text-slate-300 font-mono pt-1">
                <span>Sound Effects & Footsteps:</span>
                <span className="text-cyan-400 font-bold">{Math.round(sfxVol * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={sfxVol}
                onChange={(e) => handleSfxChange(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>

          {/* Keyboard Controls Guide */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2.5">
            <div className="flex items-center gap-2 font-mono text-cyan-400 font-semibold uppercase">
              <Keyboard className="w-4 h-4" />
              <span>Exploration Keybindings</span>
            </div>
            <div className="space-y-1.5 text-slate-300 font-mono">
              <div className="flex justify-between">
                <span>Move Astronaut:</span>
                <span className="text-white">W, A, S, D / Arrow Keys</span>
              </div>
              <div className="flex justify-between">
                <span>Interact / Salvage:</span>
                <span className="text-cyan-300 font-semibold">[E] or Enter</span>
              </div>
              <div className="flex justify-between">
                <span>Open Mission Codex:</span>
                <span className="text-white">[M] or [C]</span>
              </div>
            </div>
          </div>

          {/* Accessibility: Reduce Motion */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Reduce Motion</span>
              </div>
              <div className="text-slate-400 mt-0.5">
                Disable camera shake, nudges, and intense visual tremors
              </div>
            </div>
            <button
              data-testid="reduce-motion-toggle"
              onClick={handleToggleReduceMotion}
              className={`px-3 py-1.5 rounded-lg border font-mono font-bold text-xs transition-colors cursor-pointer shrink-0 ${
                reduceMotion
                  ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {reduceMotion ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          {/* Save Management */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">Local Expedition Data</div>
                <div className="text-slate-400 mt-0.5">
                  Clear unlocked missions, badges, and progress from localStorage
                </div>
              </div>

              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="px-3 py-1.5 rounded-lg border border-red-500/40 hover:bg-red-950/40 text-red-400 font-mono transition-colors cursor-pointer shrink-0"
                >
                  Reset Save
                </button>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleReset}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono font-bold transition-colors cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
