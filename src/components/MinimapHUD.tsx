/**
 * Minimap HUD & Enlarged Full Map Overlay Modal
 * Renders the circular HUD radar and the fullscreen tactical map view.
 */

import React from 'react';
import { Map, X, Compass, Radio } from 'lucide-react';

interface MinimapHUDProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  isOpen: boolean;
  exploredCount: number;
  totalChunks: number;
  onToggle: () => void;
  onClose: () => void;
}

export const MinimapHUD: React.FC<MinimapHUDProps> = ({
  canvasRef,
  overlayCanvasRef,
  isOpen,
  exploredCount,
  onToggle,
  onClose,
}) => {
  return (
    <>
      {/* ========================================== */}
      {/* 1. ROUND HUD MINIMAP (Bottom-Right Corner)  */}
      {/* ========================================== */}
      <div data-testid="minimap-hud" className="absolute sm:bottom-4 sm:right-4 bottom-20 right-4 z-20 pointer-events-auto select-none">
        <div
          onClick={onToggle}
          className="relative group cursor-pointer rounded-full shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-transform hover:scale-105 active:scale-95"
          title="Click or press [M] to open full map"
        >
          {/* Circular Minimap Canvas */}
          <canvas
            ref={canvasRef}
            width={150}
            height={150}
            className="w-[140px] h-[140px] sm:w-[150px] sm:h-[150px] rounded-full block bg-slate-950/90"
          />

          {/* Quick HUD [M] Keycap Pill */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-950/90 border border-cyan-500/50 text-[9px] font-mono text-cyan-300 font-bold tracking-wider flex items-center gap-1 shadow-md group-hover:border-cyan-400 group-hover:text-cyan-200">
            <Map className="w-2.5 h-2.5 text-cyan-400" />
            <span>[M] MAP</span>
          </div>
        </div>
      </div>

      {/* ========================================== */}
      {/* 2. ENLARGED FULL MAP OVERLAY MODAL         */}
      {/* ========================================== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative max-w-xl w-full p-5 rounded-2xl bg-slate-950/95 border border-cyan-500/50 shadow-[0_0_60px_rgba(6,182,212,0.4)] flex flex-col items-center">
            
            {/* Header */}
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400 animate-spin-slow" />
                <div>
                  <h3 className="text-sm font-bold text-white font-mono tracking-wider">
                    TACTICAL RADAR · MARS SURFACE
                  </h3>
                  <div className="text-[10px] font-mono text-cyan-400">
                    Explored: <span className="text-white font-bold">{exploredCount}</span> tiles · Status: <span className="text-emerald-400 font-bold">ACTIVE</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white cursor-pointer transition-colors"
                title="Close map (Esc or M)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tactical Radar Display Canvas */}
            <div className="my-4 relative rounded-full shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] border border-cyan-500/30 p-1">
              <canvas
                ref={overlayCanvasRef}
                width={440}
                height={440}
                className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full block bg-slate-950"
              />
            </div>

            {/* Map Legend & Instructions */}
            <div className="w-full pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
                  <span className="text-slate-300">Player</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                  <span className="text-slate-300">Ship Crash</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-amber-400 rotate-45 inline-block" />
                  <span className="text-slate-300">Wreck</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-slate-300">Salvaged</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-orange-400 animate-pulse" />
                  <span className="text-orange-400">Signal Blip</span>
                </div>
              </div>

              <div className="text-[10px] text-slate-400">
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">M</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">ESC</kbd> to return
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

