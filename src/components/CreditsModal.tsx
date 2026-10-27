import React from 'react';
import { sound } from '../systems/audio';
import { X, ExternalLink, ShieldCheck, Heart, Sparkles, Music, Image as ImageIcon } from 'lucide-react';
import { NovaAvatar } from './NovaAvatar';

interface CreditsModalProps {
  onClose: () => void;
}

export const CreditsModal: React.FC<CreditsModalProps> = ({ onClose }) => {
  return (
    <div
      data-testid="credits-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none"
    >
      <div className="relative w-full max-w-2xl bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-semibold font-display text-white">
              Official NASA Sources & Project Credits
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
        <div className="p-6 overflow-y-auto space-y-5 text-xs leading-relaxed">
          
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-slate-300">
            <strong>Educational Philosophy:</strong> All historical mission dates, scientific instruments, measured physical properties, and geological findings are factually verified against official NASA, JPL, and CNES publications. Fictional elements are strictly limited to the emergency spacecraft repair adventure mechanics.
          </div>

          {/* NASA Mission Citations */}
          <div className="space-y-3">
            <div className="font-mono text-cyan-400 font-semibold uppercase tracking-wider">
              Primary Scientific Catalogs & Mission Archives:
            </div>

            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">Apollo 11 & Lunar Laser Ranging Retroreflector (LRRR)</div>
                  <div className="text-slate-400 mt-0.5">NASA Lunar and Planetary Institute (LPI) · Apollo Surface Journal</div>
                </div>
                <a
                  href="https://www.nasa.gov/mission_pages/apollo/apollo-11.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline font-mono shrink-0 flex items-center gap-1"
                >
                  <span>Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">Mars Pathfinder & Sojourner Microrover (1997)</div>
                  <div className="text-slate-400 mt-0.5">NASA Jet Propulsion Laboratory (JPL) · Rocker-Bogie Kinematics & APXS Science</div>
                </div>
                <a
                  href="https://mars.nasa.gov/mars-exploration/missions/pathfinder/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline font-mono shrink-0 flex items-center gap-1"
                >
                  <span>Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">Mars Exploration Rover: Opportunity (MER-B, 2004–2018)</div>
                  <div className="text-slate-400 mt-0.5">NASA JPL · Meridiani Planum Hematite Concretions ("Blueberries") & Aqueous Minerals</div>
                </div>
                <a
                  href="https://mars.nasa.gov/mer/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline font-mono shrink-0 flex items-center gap-1"
                >
                  <span>Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-white">InSight Mars Lander & SEIS Seismology (2018–2022)</div>
                  <div className="text-slate-400 mt-0.5">NASA / CNES / IPGP · Martian Core-Mantle Layering & Quake Detection</div>
                </div>
                <a
                  href="https://mars.nasa.gov/insight/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline font-mono shrink-0 flex items-center gap-1"
                >
                  <span>Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Art, Sound & Open Source Asset Attributions */}
          <div className="space-y-3">
            <div className="font-mono text-cyan-400 font-semibold uppercase tracking-wider">
              Art, Sound & Open Source Asset Attributions:
            </div>

            <div className="space-y-2 text-[11px]">
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pixel Art & Procedural Terrain Engine</span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  Terrain biomes, ship parts, UI keycaps, and all 8 historical NASA wrecks are 100% CC0 procedural pixel art. Player astronaut (<code className="text-slate-300">player_walk4</code>) and NOVA companion (<code className="text-slate-300">nova_walk</code> "Ginger & Topey Sprites") are user-provided assets (owner must confirm license/source before public release).
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                <div className="font-semibold text-white flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-emerald-400" />
                  <span>WebAudio Synthesizer Engine (100% CC0 1.0 Universal)</span>
                </div>
                <div className="text-slate-400 mt-0.5">
                  Real-time procedural sound generator for dynamic biome winds, surface footsteps (regolith, sand, snow, grass, metal), engine roar, telemetry beeps, and triumph chords. Zero external audio file dependencies.
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800">
                <div className="font-semibold text-white">NASA Photographic Archive</div>
                <div className="text-slate-400 mt-0.5">NASA historic space mission photography used for menu panorama and educational modal illustrations (Public Domain / NASA Media Usage Guidelines).</div>
              </div>
            </div>
          </div>

          {/* NOVA Character & Concept */}
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center gap-4">
            <NovaAvatar mood="happy" size={54} />
            <div className="flex-1">
              <div className="font-semibold text-white">NOVA // Robotic Cat Companion</div>
              <div className="text-slate-400 mt-0.5">
                Designed to make planetary physics and aerospace history approachable, warm, and engaging for students and space enthusiasts worldwide.
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
            <span>Built for space exploration enthusiasts with</span>
            <Heart className="w-3 h-3 text-rose-500 fill-current" />
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
