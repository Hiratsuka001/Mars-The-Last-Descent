import React from 'react';
import { SHIP_PARTS } from '../data/equipment';
import { Wrench } from 'lucide-react';

interface PartsHUDProps {
  collectedPartIds: string[];
}

export const PartsHUD: React.FC<PartsHUDProps> = ({ collectedPartIds }) => {
  const allParts = Object.values(SHIP_PARTS);
  const count = collectedPartIds.length;
  const total = allParts.length;

  return (
    <div data-testid="parts-hud" className="flex items-center gap-3 p-2 px-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs font-mono shadow-lg pointer-events-auto">
      <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
        <Wrench className="w-3.5 h-3.5" />
        <span>PARTS:</span>
        <span className={count >= 5 ? 'text-emerald-400' : 'text-amber-400'}>
          {count}/{total}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {allParts.map((part) => {
          const isCollected = collectedPartIds.includes(part.id);
          return (
            <div
              key={part.id}
              title={`${part.name}: ${isCollected ? 'Acquired' : 'Missing'}`}
              className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                isCollected
                  ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                  : 'border-slate-800 bg-slate-900/40 text-slate-700'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${isCollected ? 'bg-cyan-400' : 'bg-slate-700'}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

