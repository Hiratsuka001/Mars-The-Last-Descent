import React, { useState } from 'react';
import { MISSIONS_DATA, MissionDiscovery } from '../data/missions';
import { SCIENCE_SAMPLES, getSampleResearchPoints } from '../data/samples';
import { ORDERED_LOGS, LogEntry } from '../data/logs';
import { atlas } from '../render/atlas';
import { sound } from '../systems/audio';
import { X, Award, ExternalLink, Cpu, Compass, Sparkles, CheckCircle2, ChevronDown, ChevronUp, Lock, Microscope, Radio } from 'lucide-react';
import { NovaAvatar } from './NovaAvatar';

export interface CodexEntry {
  id: string;
  name: string;
  agencyYear: string;
  spriteKey: string;
  headlineFact: string;
  bullets: string[];
}

export const MARS_CODEX_ENTRIES: CodexEntry[] = [
  {
    id: 'eq_sojourner',
    name: 'Sojourner Microrover',
    agencyYear: 'NASA / JPL · 1997',
    spriteKey: 'wreck_sojourner',
    headlineFact: 'First wheeled rover on Mars, proving extraterrestrial mobility across Ares Vallis with a 6-wheel rocker-bogie chassis.',
    bullets: [
      'Operated 83 Martian days (12x beyond designed 7-day lifespan).',
      'Autonomous hazard sensors detected rocks and prevented rollovers.',
      'Alpha Proton X-ray Spectrometer measured volcanic rock compositions.',
    ],
  },
  {
    id: 'eq_opportunity',
    name: 'Opportunity Rover (MER-B)',
    agencyYear: 'NASA / JPL · 2004',
    spriteKey: 'wreck_opportunity',
    headlineFact: 'Discovered hematite spherules and sedimentary sulfate ripples in Meridiani Planum, definitively confirming ancient Martian standing liquid water.',
    bullets: [
      'Explored Mars for 14 years and drove over 45 kilometers.',
      'Surfaced evidence of acidic lakes and flowing groundwater.',
      'Endured dust storms via periodic wind-cleaning of solar panels.',
    ],
  },
  {
    id: 'eq_insight',
    name: 'InSight Geophysical Station',
    agencyYear: 'NASA / CNES · 2018',
    spriteKey: 'wreck_insight',
    headlineFact: 'Probed the deep Martian interior with a dome-shielded seismometer, confirming a liquid iron-nickel core and recording 1,300+ marsquakes.',
    bullets: [
      'Wind & Thermal Shield isolated sensors down to picometer vibrations.',
      'Mapped crust thickness between 24 km and 72 km.',
      'Measured core radius at approximately 1,830 kilometers.',
    ],
  },
  {
    id: 'eq_spirit',
    name: 'Spirit Rover (MER-A)',
    agencyYear: 'NASA / JPL · 2004',
    spriteKey: 'wreck_spirit',
    headlineFact: 'Uncovered 90% pure silica deposits at Gusev Crater, proving ancient volcanic hot springs once bubbled on early Mars.',
    bullets: [
      'Stalled front wheel churned up bright white subsurface silica.',
      'Explored Columbia Hills and survived severe Martian winters.',
      'Operated for over 2,200 sols—more than 24x design expectations.',
    ],
  },
  {
    id: 'eq_deep_space_dish',
    name: 'Deep Space Relay Array',
    agencyYear: 'NASA / JPL · 1963–Present',
    spriteKey: 'wreck_deep_space_dish',
    headlineFact: 'Global parabolic antenna network providing uninterrupted microwave telemetry, high-bandwidth data transmission, and navigation to deep-space probes.',
    bullets: [
      'Features 70-meter dishes stationed 120° apart worldwide.',
      'Maintains contact with probes billions of kilometers from Earth.',
      'Critical communication bridge for all Mars orbiters and rovers.',
    ],
  },
  {
    id: 'eq_phoenix',
    name: 'Phoenix Polar Ice Lander',
    agencyYear: 'NASA / Univ of Arizona · 2008',
    spriteKey: 'wreck_phoenix',
    headlineFact: 'Dug trenches into northern arctic permafrost, directly exposing and imaging subsurface water ice sublimating in sunlight.',
    bullets: [
      'Robotic scoop arm excavated bright white pure water ice slabs.',
      'Detected perchlorate salts that lower water freezing point.',
      'Observed snow falling from Martian cirrus clouds via lidar.',
    ],
  },
  {
    id: 'eq_lrv_buggy',
    name: 'Apollo Lunar Roving Vehicle',
    agencyYear: 'NASA / Boeing · 1971–1972',
    spriteKey: 'wreck_lrv_buggy',
    headlineFact: 'Electric 4-wheel rover with woven piano-wire mesh wheels that expanded astronaut surface exploration traverse radius from 1 km to 7 km.',
    bullets: [
      'Driven across Apollo 15, 16, and 17 rilles and mountains.',
      'Woven zinc-coated steel mesh prevented vacuum blowouts.',
      'Carried 490 kg of astronauts, equipment, and geological samples.',
    ],
  },
  {
    id: 'eq_surveyor',
    name: 'Surveyor 3 Lunar Lander',
    agencyYear: 'NASA / JPL · 1967',
    spriteKey: 'wreck_surveyor',
    headlineFact: 'First robotic probe visited by humans on another world when Apollo 12 astronauts walked to it and retrieved its camera.',
    bullets: [
      'Proved lunar soil was firm enough for astronaut landers.',
      'Robotic scoop dug trenches televised live back to Earth.',
      'Returned camera helped scientists study long-term space radiation exposure.',
    ],
  },
];

interface MissionArchiveModalProps {
  completedEquipmentIds?: string[];
  unlockedMissionIds?: string[];
  collectedSampleIds?: string[];
  discoveredLandmarkIds?: string[];
  recoveredLogIds?: string[];
  researchPoints?: number;
  onClose: () => void;
  onSelectDiscovery?: (discovery: MissionDiscovery) => void;
}

export const MissionArchiveModal: React.FC<MissionArchiveModalProps> = ({
  completedEquipmentIds = [],
  unlockedMissionIds = [],
  collectedSampleIds = [],
  discoveredLandmarkIds = [],
  recoveredLogIds = [],
  researchPoints = 0,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'mars' | 'samples' | 'logs' | 'legacy'>('mars');
  const [selectedMarsId, setSelectedMarsId] = useState<string>(
    completedEquipmentIds[0] || MARS_CODEX_ENTRIES[0].id
  );
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  const toggleCardExpanded = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Legacy tab state
  const allLegacyMissions = Object.values(MISSIONS_DATA);
  const [selectedLegacyId, setSelectedLegacyId] = useState<string>(
    unlockedMissionIds[0] || allLegacyMissions[0].id
  );

  const unlockedCount = completedEquipmentIds.length;
  const samplesCount = collectedSampleIds.length;
  const unlockedLogsCount = ORDERED_LOGS.filter(
    (log) =>
      recoveredLogIds.includes(log.id) ||
      recoveredLogIds.includes(log.wreckId) ||
      recoveredLogIds.includes(log.partId)
  ).length;
  const activeMarsEntry = MARS_CODEX_ENTRIES.find((e) => e.id === selectedMarsId) || MARS_CODEX_ENTRIES[0];
  const isMarsUnlocked = completedEquipmentIds.includes(activeMarsEntry.id);

  const activeLegacyMission = MISSIONS_DATA[selectedLegacyId] || allLegacyMissions[0];
  const isLegacyUnlocked = unlockedMissionIds.includes(activeLegacyMission.id);

  return (
    <div data-testid="codex-modal" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-cyan-500/40 rounded-2xl shadow-[0_16px_60px_rgba(0,0,0,0.8)] overflow-hidden text-slate-200 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/70 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                PLANETARY EXPLORATION CODEX
              </div>
              <h3 className="text-base font-semibold text-white font-display">
                Field Discoveries & Machine Lore
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div
              data-testid="landmarks-codex-counter"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-950/60 border border-indigo-500/40 text-xs font-mono text-indigo-300 font-bold"
            >
              <span>Landmarks {discoveredLandmarkIds.length}/5</span>
            </div>
            <div
              data-testid="codex-research-points"
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-mono text-amber-300 font-bold"
            >
              <span>{researchPoints} RP</span>
            </div>
            <button
              data-testid="codex-close-btn"
              onClick={() => {
                sound.playClick();
                onClose();
              }}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-slate-800/80 bg-slate-950 px-4 pt-2 gap-2 shrink-0">
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('mars');
            }}
            data-testid="mars-relics-tab-btn"
            className={`px-4 py-2 rounded-t-xl text-xs font-mono font-bold transition-all cursor-pointer border-t border-x ${
              activeTab === 'mars'
                ? 'bg-slate-900 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Mars Surface Relics ({unlockedCount}/8)
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('samples');
            }}
            data-testid="specimen-book-tab-btn"
            className={`px-4 py-2 rounded-t-xl text-xs font-mono font-bold transition-all cursor-pointer border-t border-x flex items-center gap-1.5 ${
              activeTab === 'samples'
                ? 'bg-slate-900 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Microscope className="w-3.5 h-3.5 text-cyan-400" />
            <span>Specimen Book ({collectedSampleIds.length}/18)</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('logs');
            }}
            data-testid="logs-tab-btn"
            className={`px-4 py-2 rounded-t-xl text-xs font-mono font-bold transition-all cursor-pointer border-t border-x flex items-center gap-1.5 ${
              activeTab === 'logs'
                ? 'bg-slate-900 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400" />
            <span>Logs ({unlockedLogsCount}/8)</span>
          </button>
          <button
            onClick={() => {
              sound.playClick();
              setActiveTab('legacy');
            }}
            data-testid="legacy-archive-tab-btn"
            className={`px-4 py-2 rounded-t-xl text-xs font-mono font-medium transition-all cursor-pointer border-t border-x ${
              activeTab === 'legacy'
                ? 'bg-slate-900 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Historical Apollo Archive
          </button>
        </div>

        {/* Tab 1: Mars Open-World Codex */}
        {activeTab === 'mars' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Left Equipment List */}
            <div className="w-full md:w-72 border-r border-slate-800/80 p-2.5 space-y-1.5 overflow-y-auto bg-slate-950/50 shrink-0">
              {MARS_CODEX_ENTRIES.map((entry) => {
                const isUnlocked = completedEquipmentIds.includes(entry.id);
                const isSelected = selectedMarsId === entry.id;

                return (
                  <button
                    key={entry.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedMarsId(entry.id);
                      setIsLearnMoreOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 text-white shadow-sm'
                        : 'border-slate-800/80 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {/* Silhouette or Icon */}
                      <div className={`w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 ${
                        !isUnlocked ? 'brightness-0 opacity-30 contrast-200' : ''
                      }`}>
                        {isUnlocked ? (
                          <div className="w-5 h-5 flex items-center justify-center text-xs font-mono text-cyan-300 font-bold">
                            {entry.name.slice(0, 2).toUpperCase()}
                          </div>
                        ) : (
                          <Lock className="w-3.5 h-3.5 text-slate-600" />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="text-xs font-semibold truncate text-slate-100">
                          {isUnlocked ? entry.name : '???'}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate">
                          {isUnlocked ? entry.agencyYear : 'Signal Uncharted'}
                        </div>
                      </div>
                    </div>

                    {isUnlocked ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <span className="text-[9px] font-mono text-slate-600 shrink-0">LOCKED</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Entry Inspector */}
            <div className="flex-1 p-5 sm:p-7 overflow-y-auto space-y-4">
              {isMarsUnlocked ? (
                <>
                  <div className="border-b border-slate-800/80 pb-3">
                    <div className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider">
                      {activeMarsEntry.agencyYear}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold font-display text-white mt-0.5">
                      {activeMarsEntry.name}
                    </h3>
                  </div>

                  {/* Headline Fact (Single sentence, max ~20 words) */}
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-cyan-500/20 text-slate-100 text-sm leading-relaxed">
                    {activeMarsEntry.headlineFact}
                  </div>

                  {/* Collapsible Learn More */}
                  <div className="border border-slate-800 rounded-xl bg-slate-900/30 overflow-hidden">
                    <button
                      onClick={() => setIsLearnMoreOpen((prev) => !prev)}
                      className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono text-cyan-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="font-semibold uppercase tracking-wider">
                        {isLearnMoreOpen ? 'Hide Engineering Notes' : 'Learn More (Engineering Notes)'}
                      </span>
                      {isLearnMoreOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {isLearnMoreOpen && (
                      <div className="px-4 pb-4 pt-1 space-y-2 text-xs text-slate-300 border-t border-slate-800/60 animate-in fade-in duration-200">
                        {activeMarsEntry.bullets.map((bullet, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <span className="text-cyan-400 font-mono mt-0.5">▪</span>
                            <span className="leading-relaxed">{bullet}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center brightness-0 opacity-40">
                    <Lock className="w-8 h-8 text-slate-500" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-base font-semibold text-slate-200 font-display">
                      Signal Undetected
                    </h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Traverse the Martian surface and locate this relic to extract its telemetry and unlock its entry.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Specimen Book (Martian Geological & Astrobiological Specimens) */}
        {activeTab === 'samples' && (
          <div data-testid="specimen-book-tab" className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Specimen Book · Martian Field Science
                </h4>
                <p className="text-xs text-slate-400">
                  6 unique geological specimens cataloged. Earn Research Points to upgrade ascent vehicle systems.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div
                  data-testid="specimen-book-total-gathered"
                  className="px-3 py-1 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shrink-0"
                >
                  {samplesCount} / 18 Found
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Object.values(SCIENCE_SAMPLES).map((sample) => {
                const collectedOfType = collectedSampleIds.filter((id) => id.includes(sample.id) || id === sample.id).length;
                const isDiscovered = collectedOfType > 0;
                const rpVal = getSampleResearchPoints(sample.rarity);

                const rarityColor =
                  sample.rarity === 'exotic'
                    ? 'border-amber-500/50 bg-amber-950/30 text-amber-300'
                    : sample.rarity === 'rare'
                    ? 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300'
                    : 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300';

                return (
                  <div
                    key={sample.id}
                    data-testid={`specimen-card-${sample.id}`}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isDiscovered
                        ? 'border-slate-800 bg-slate-900/40 shadow-sm'
                        : 'border-slate-800/40 bg-slate-950/40 opacity-75'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            data-testid={isDiscovered ? `specimen-sprite-${sample.id}` : `specimen-silhouette-${sample.id}`}
                            className={`w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 ${
                              !isDiscovered ? 'brightness-0 opacity-25 contrast-200' : ''
                            }`}
                          >
                            <canvas
                              ref={(node) => {
                                if (node) {
                                  const c = node.getContext('2d');
                                  if (c) {
                                    c.clearRect(0, 0, 32, 32);
                                    c.imageSmoothingEnabled = false;
                                    atlas.drawSprite(c, sample.spriteKey, 0, 0, 32, 32);
                                  }
                                }
                              }}
                              width={32}
                              height={32}
                              className="w-8 h-8"
                            />
                          </div>
                          <div>
                            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">
                              {sample.category}
                            </div>
                            <h5
                              data-testid={`specimen-name-${sample.id}`}
                              className={`text-xs font-bold leading-tight ${isDiscovered ? 'text-white' : 'text-slate-500'}`}
                            >
                              {isDiscovered ? sample.name : 'Unknown Specimen'}
                            </h5>
                          </div>
                        </div>

                        <span
                          data-testid={`specimen-rarity-${sample.id}`}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider font-bold border ${rarityColor}`}
                        >
                          {sample.rarity} (+{rpVal} RP)
                        </span>
                      </div>

                      {isDiscovered ? (
                        <div className="space-y-2">
                          <p
                            data-testid={`specimen-fact-${sample.id}`}
                            className="text-[11px] text-slate-300 leading-relaxed"
                          >
                            {sample.scienceFact}
                          </p>

                          <div>
                            <button
                              type="button"
                              onClick={() => toggleCardExpanded(sample.id)}
                              className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
                              data-testid={`specimen-toggle-${sample.id}`}
                            >
                              {expandedCards[sample.id] ? 'Hide details' : 'Learn more'}
                            </button>

                            {expandedCards[sample.id] && (
                              <p className="mt-1.5 text-[11px] text-slate-300 leading-relaxed bg-slate-950/60 p-2 rounded border border-slate-800/80">
                                {sample.description}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center space-y-1.5">
                          <Lock className="w-5 h-5 text-slate-600 mx-auto" />
                          <p
                            data-testid={`specimen-fact-${sample.id}`}
                            className="text-[11px] text-slate-500 font-mono"
                          >
                            Undiscovered · Survey {sample.preferredBiomes.join(' or ')} to discover and record.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-500">Native: {sample.preferredBiomes.join(', ')}</span>
                      <span
                        data-testid={`specimen-status-${sample.id}`}
                        className={isDiscovered ? 'text-emerald-400 font-bold' : 'text-slate-600'}
                      >
                        {isDiscovered ? 'FOUND' : 'SILHOUETTE'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: Story Memory Logs (FICTION) */}
        {activeTab === 'logs' && (
          <div data-testid="codex-logs-tab-content" className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
              <div>
                <div className="text-xs font-mono text-cyan-400 font-semibold uppercase tracking-wider flex items-center gap-2">
                  <span>Telemetric Memory Fragments</span>
                  <span
                    data-testid="fiction-tag"
                    className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase"
                  >
                    FICTION
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-arrival memory fragments left by Nova on historical probes across Mars.
                </p>
              </div>
              <div className="text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1 rounded-xl">
                Decrypted: {unlockedLogsCount} / 8
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ORDERED_LOGS.map((log) => {
                const isUnlocked =
                  recoveredLogIds.includes(log.id) ||
                  recoveredLogIds.includes(log.wreckId) ||
                  recoveredLogIds.includes(log.partId);

                return (
                  <div
                    key={log.id}
                    data-testid={`codex-log-entry-${log.order}`}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isUnlocked
                        ? 'bg-slate-900/60 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.08)]'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <div className="flex items-center gap-2">
                        <span className={isUnlocked ? 'text-cyan-400 font-bold' : 'text-slate-500'}>
                          Log #{log.order}: {log.probeName}
                        </span>
                        {isUnlocked && (
                          <span
                            data-testid="fiction-tag"
                            className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase"
                          >
                            FICTION
                          </span>
                        )}
                      </div>
                      {isUnlocked ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div
                          data-testid={`codex-log-locked-${log.order}`}
                          className="flex items-center gap-1 text-[10px] text-slate-500"
                        >
                          <Lock className="w-3 h-3" />
                          <span>LOCKED</span>
                        </div>
                      )}
                    </div>

                    {isUnlocked ? (
                      <p
                        data-testid={`log-text-${log.order}`}
                        className="text-xs text-slate-200 italic font-mono leading-relaxed"
                      >
                        "{log.text}"
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-[11px] font-mono text-slate-500 tracking-wider flex items-center gap-1.5">
                          <Lock className="w-3 h-3 text-slate-600" />
                          <span>[ ENCRYPTED TELEMETRY FRAGMENT ]</span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-600">
                          Salvage probe to decrypt memory fragment.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Historical Apollo Archive (Preserved Legacy Content) */}
        {activeTab === 'legacy' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            {/* Left Mission List */}
            <div className="w-full md:w-72 border-r border-slate-800/80 p-2.5 space-y-1.5 overflow-y-auto bg-slate-950/50 shrink-0">
              {allLegacyMissions.map((m) => {
                const isUnlocked = unlockedMissionIds.includes(m.id);
                const isSelected = selectedLegacyId === m.id;

                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      sound.playClick();
                      setSelectedLegacyId(m.id);
                    }}
                    className={`w-full p-2.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/40 text-white'
                        : 'border-slate-800/80 bg-slate-900/20 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                      <span className={isUnlocked ? 'text-cyan-400' : 'text-slate-600'}>
                        {m.year}
                      </span>
                      {isUnlocked ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span className="text-[9px] text-slate-600">LOCKED</span>
                      )}
                    </div>
                    <div className="text-xs font-semibold truncate text-slate-100">
                      {isUnlocked ? m.name : 'Unknown Signal'}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Legacy Details */}
            <div className="flex-1 p-5 sm:p-7 overflow-y-auto space-y-4">
              {isLegacyUnlocked ? (
                <>
                  <div>
                    <div className="text-xs font-mono text-cyan-400">{activeLegacyMission.location}</div>
                    <h3 className="text-xl font-bold font-display text-white mt-0.5">
                      {activeLegacyMission.name}
                    </h3>
                    <p className="text-xs text-slate-300 italic mt-0.5">"{activeLegacyMission.tagline}"</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
                    <div className="text-xs font-mono text-cyan-400 font-semibold">1. THE MACHINE</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{activeLegacyMission.machine.description}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
                    <div className="text-xs font-mono text-emerald-400 font-semibold">2. THE SCIENCE</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{activeLegacyMission.science.description}</p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
                    <div className="text-xs font-mono text-amber-400 font-semibold">3. WHY IT MATTERS</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{activeLegacyMission.whyItMatters.keyTakeaway}</p>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2">
                  <NovaAvatar mood="curious" size={60} />
                  <div className="text-sm font-semibold text-slate-200">Uncharted Sector</div>
                  <p className="text-xs text-slate-400">Play the Earth and Moon chapters to unlock these historical files.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
          <div className="text-[11px] font-mono text-slate-400">
            Inspired by real NASA missions · Mars Exploration Surface Survey
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onClose();
            }}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          >
            Close Codex
          </button>
        </div>

      </div>
    </div>
  );
};
