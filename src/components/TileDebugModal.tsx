import React, { useEffect, useRef, useState } from 'react';
import { atlas, SPRITE_MANIFEST } from '../render/atlas';
import { X, Search, Filter } from 'lucide-react';

interface TileDebugModalProps {
  onClose: () => void;
}

export const TileDebugModal: React.FC<TileDebugModalProps> = ({ onClose }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const categories = [
    { id: 'all', label: 'All Tiles' },
    { id: 'terrain', label: 'Terrain' },
    { id: 'props', label: 'Props' },
    { id: 'player', label: 'Player' },
    { id: 'nova', label: 'Nova' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'icons', label: 'Icons' },
  ];

  const entries = Object.entries(SPRITE_MANIFEST).filter(([key]) => {
    if (searchQuery.trim()) {
      if (!key.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    }
    if (filterCategory === 'all') return true;
    if (filterCategory === 'terrain') return key.startsWith('tile_');
    if (filterCategory === 'props') return key.startsWith('prop_');
    if (filterCategory === 'player') return key.startsWith('player_');
    if (filterCategory === 'nova') return key.startsWith('nova_');
    if (filterCategory === 'equipment') return key.startsWith('equipment_') || key.startsWith('ship_');
    if (filterCategory === 'icons') return key.startsWith('icon_') || key.startsWith('key_');
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 md:p-6 text-slate-100 select-none font-mono">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-700">
        <div>
          <h2 className="text-xl font-bold tracking-wider text-amber-400 flex items-center gap-2">
            <span>[ATLAS TILE DEBUGGER]</span>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-600 text-slate-300 font-normal">
              {entries.length} Slices Registered
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time integer-scaled atlas manifest inspection. Verify ground tiles, bounds, and licenses.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-600"
          title="Close Debugger (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-800">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="w-4 h-4 text-slate-500 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                filterCategory === cat.id
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sprite key..."
            className="w-full pl-8 pr-3 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Tiles Grid */}
      <div className="flex-1 overflow-y-auto pt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 pr-1">
        {entries.map(([key, def]) => (
          <TilePreviewCard key={key} spriteKey={key} def={def} />
        ))}
      </div>
    </div>
  );
};

interface TilePreviewCardProps {
  spriteKey: string;
  def: (typeof SPRITE_MANIFEST)[string];
}

const TilePreviewCard: React.FC<TilePreviewCardProps> = ({ spriteKey, def }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw dark checkered background for transparency check
    const checkSize = 4;
    for (let y = 0; y < canvas.height; y += checkSize) {
      for (let x = 0; x < canvas.width; x += checkSize) {
        ctx.fillStyle = ((x / checkSize + y / checkSize) % 2 === 0) ? '#181b22' : '#222733';
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    // Draw sprite centered at 3x scale
    const targetW = (def.renderW ?? 16) * 3;
    const targetH = (def.renderH ?? 16) * 3;
    const dx = Math.round((canvas.width - targetW) / 2);
    const dy = Math.round((canvas.height - targetH) / 2);

    atlas.drawSprite(ctx, spriteKey, dx, dy, targetW, targetH);
  }, [spriteKey, def]);

  const isCc0 = def.license === 'cc0';
  const isProcedural = def.sheet === 'procedural';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5 flex flex-col items-center hover:border-slate-600 transition-colors">
      {/* 3x Canvas Preview */}
      <div className="w-[80px] h-[80px] flex items-center justify-center bg-black/40 border border-slate-800 rounded mb-2 overflow-hidden">
        <canvas ref={canvasRef} width={76} height={76} className="image-pixelated" />
      </div>

      {/* Sprite Metadata */}
      <div className="w-full text-[11px] flex flex-col gap-0.5">
        <div className="font-bold text-amber-300 truncate" title={spriteKey}>
          {spriteKey}
        </div>

        <div className="text-slate-400 text-[10px] truncate" title={def.sheet}>
          {isProcedural ? (
            <span className="text-emerald-400 font-semibold">procedural (16x16)</span>
          ) : (
            def.sheet.replace('/assets/', '')
          )}
        </div>

        <div className="text-slate-400 text-[9px] flex justify-between pt-1 border-t border-slate-800/80">
          <span>
            {def.w}x{def.h}px
          </span>
          <span
            className={`px-1 rounded text-[9px] ${
              isCc0 ? 'bg-emerald-950 text-emerald-300' : 'bg-amber-950 text-amber-300'
            }`}
          >
            {def.license}
          </span>
        </div>
      </div>
    </div>
  );
};

