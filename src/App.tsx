import React, { useState, useEffect, Suspense } from 'react';
import { sound } from './systems/audio';
import { getSavedProgress, saveProgress, resetProgress, hasSavedWorldRun, GameProgress } from './systems/saveManager';
import { MISSIONS_DATA, MissionDiscovery } from './data/missions';
import { MainMenu } from './components/MainMenu';
import { GameCanvas, InteractiveEntity } from './components/GameCanvas';
import { NovaDialogue } from './components/NovaDialogue';
import { Compass, Volume2, VolumeX, Menu, Award, ArrowRight } from 'lucide-react';

// Code-split heavy scenes, modals, cinematics, and mini-games
const WorldScene = React.lazy(() => import('./components/WorldScene').then(m => ({ default: m.WorldScene })));
const LaunchCinematic = React.lazy(() => import('./components/LaunchCinematic').then(m => ({ default: m.LaunchCinematic })));
const SpacecraftRepairScene = React.lazy(() => import('./components/SpacecraftRepairScene').then(m => ({ default: m.SpacecraftRepairScene })));
const MissionArchiveModal = React.lazy(() => import('./components/MissionArchiveModal').then(m => ({ default: m.MissionArchiveModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const CreditsModal = React.lazy(() => import('./components/CreditsModal').then(m => ({ default: m.CreditsModal })));
const PrologueScene = React.lazy(() => import('./components/PrologueScene').then(m => ({ default: m.PrologueScene })));
const MarsCrashScene = React.lazy(() => import('./components/MarsCrashScene').then(m => ({ default: m.MarsCrashScene })));
const MarsWeatherChallenge = React.lazy(() => import('./components/MarsWeatherChallenge').then(m => ({ default: m.MarsWeatherChallenge })));
const DiscoveryModal = React.lazy(() => import('./components/DiscoveryModal').then(m => ({ default: m.DiscoveryModal })));
const QuizModal = React.lazy(() => import('./components/QuizModal').then(m => ({ default: m.QuizModal })));
const SojournerRoverPuzzle = React.lazy(() => import('./components/MiniGames/SojournerRoverPuzzle').then(m => ({ default: m.SojournerRoverPuzzle })));
const OpportunityWaterPuzzle = React.lazy(() => import('./components/MiniGames/OpportunityWaterPuzzle').then(m => ({ default: m.OpportunityWaterPuzzle })));
const InSightSeismicPuzzle = React.lazy(() => import('./components/MiniGames/InSightSeismicPuzzle').then(m => ({ default: m.InSightSeismicPuzzle })));

// Overhaul feature flag: Mars top-down open world
export const USE_TOPDOWN_WORLD = true;

const LoadingFallback: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#03060d] text-cyan-400 font-mono text-sm select-none">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
      <span className="tracking-widest uppercase text-xs">Synchronizing Subsystems...</span>
    </div>
  </div>
);

export default function App() {
  const [progress, setProgress] = useState<GameProgress>(getSavedProgress());
  const [worldSeed, setWorldSeed] = useState<number | string>(() => {
    const saved = getSavedProgress();
    return saved.worldSave?.seed ?? 19970704;
  });
  
  // Active modals
  const [activeDiscovery, setActiveDiscovery] = useState<MissionDiscovery | null>(null);
  const [activeQuiz, setActiveQuiz] = useState<MissionDiscovery | null>(null);
  const [activeMiniGame, setActiveMiniGame] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showCredits, setShowCredits] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(sound.getMuted());

  // In-game dialogue overlay state
  const [novaDialogue, setNovaDialogue] = useState<{
    text: string;
    mood?: 'idle' | 'happy' | 'curious' | 'warning' | 'scanning' | 'celebrate';
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  // Sync progress changes to localStorage
  const updateProgress = (updater: (prev: GameProgress) => GameProgress) => {
    setProgress((prev) => {
      const next = updater(prev);
      saveProgress(next);
      return next;
    });
  };

  // Sound toggle
  const toggleSound = () => {
    const muted = sound.toggleMute();
    setIsMuted(muted);
    if (!muted) sound.playClick();
  };

  // Switch chapter
  const goToChapter = (chapter: number) => {
    updateProgress((prev) => ({ ...prev, currentChapter: chapter }));
    setNovaDialogue(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__getSavedProgress = getSavedProgress;
    }
    return () => {
      delete (window as any).__getSavedProgress;
    };
  }, []);

  // Ambient setup for legacy lunar surface
  useEffect(() => {
    if (progress.currentChapter === 2) {
      sound.startAmbience('moon');
      const timer = setTimeout(() => {
        setNovaDialogue({
          text: "Welcome to the Moon, Explorer! Gravity here is only 1/6th of Earth's (1.62 m/s²). Try moving and jumping. When you find historical instruments, press [E] or tap SCAN to deploy my sensor array!",
          mood: 'happy',
          actionLabel: 'Explore Lunar Surface'
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [progress.currentChapter]);

  // Handle interaction on canvas (Legacy chapters)
  const handleCanvasInteraction = (entityId: string) => {
    if (MISSIONS_DATA[entityId]) {
      setActiveDiscovery(MISSIONS_DATA[entityId]);
    } else if (entityId === 'crashed_ship') {
      if (progress.unlockedMissions.filter(m => !['apollo_lrrr', 'apollo_lrv', 'surveyor_3'].includes(m)).length >= 3) {
        goToChapter(6);
      } else {
        setNovaDialogue({
          text: "The spacecraft ascent thrusters are still inoperable. We need engineering principles from the 3 historic Mars missions before we can recalibrate the systems!",
          mood: 'warning'
        });
      }
    }
  };

  // Handle completing a discovery
  const handleDiscoveryDone = (missionId: string) => {
    const discovery = MISSIONS_DATA[missionId];
    if (!discovery) return;

    updateProgress((prev) => ({
      ...prev,
      unlockedMissions: Array.from(new Set([...prev.unlockedMissions, missionId])),
      badges: Array.from(new Set([...prev.badges, discovery.badge]))
    }));

    setActiveDiscovery(null);

    if (['apollo_lrrr', 'apollo_lrv', 'surveyor_3'].includes(missionId)) {
      setActiveQuiz(discovery);
    } else if (missionId === 'sojourner') {
      setActiveMiniGame('sojourner');
    } else if (missionId === 'opportunity') {
      setActiveMiniGame('opportunity');
    } else if (missionId === 'insight') {
      setActiveMiniGame('insight');
    }
  };

  // Handle quiz success
  const handleQuizSuccess = (missionId: string) => {
    const nextQuizzes = Array.from(new Set([...progress.quizzesCompleted, missionId]));
    updateProgress((prev) => ({
      ...prev,
      quizzesCompleted: nextQuizzes
    }));
    setActiveQuiz(null);

    const moonMissions = ['apollo_lrrr', 'apollo_lrv', 'surveyor_3'];
    const allMoonDone = moonMissions.every((id) => nextQuizzes.includes(id));

    if (allMoonDone) {
      setNovaDialogue({
        text: "Outstanding work, Explorer! All 3 Lunar Instruments are analyzed and verified. Our spacecraft systems are configured for the interplanetary transfer burn to Mars!",
        mood: 'celebrate',
        actionLabel: 'Initiate Mars Descent Burn →',
        onAction: () => goToChapter(3)
      });
    } else {
      setNovaDialogue({
        text: `Lunar survey progress updated (${nextQuizzes.length}/3)! Keep exploring the Moon's surface to find remaining historical NASA instruments.`,
        mood: 'happy'
      });
    }
  };

  // Handle mini-game victory
  const handleMiniGameSuccess = (gameId: string) => {
    updateProgress((prev) => {
      const nextGames = Array.from(new Set([...prev.solvedMiniGames, gameId]));
      return { ...prev, solvedMiniGames: nextGames };
    });
    setActiveMiniGame(null);

    const marsMissions = ['sojourner', 'opportunity', 'insight'];
    const marsSolved = marsMissions.every((m) =>
      progress.solvedMiniGames.includes(m) || m === gameId
    );

    if (marsSolved) {
      setNovaDialogue({
        text: "ALERT! A massive thermal convection dust storm is sweeping across the Martian horizon! We must make an urgent tactical routing decision!",
        mood: 'warning',
        actionLabel: 'Assess Weather Crisis →',
        onAction: () => goToChapter(5)
      });
    } else {
      setNovaDialogue({
        text: "Scientific data logged and analyzed! Check your Mission Archive or continue scanning the dunes for remaining historical machines.",
        mood: 'happy'
      });
    }
  };

  // Chapter 1: Moon entities (Legacy)
  const moonEntities: InteractiveEntity[] = [
    {
      id: 'apollo_lrrr',
      name: 'Laser Retroreflector (Apollo 11)',
      x: 650,
      y: 420,
      width: 60,
      height: 40,
      type: 'station',
      discovered: progress.unlockedMissions.includes('apollo_lrrr'),
      label: 'Apollo 11 ALSEP'
    },
    {
      id: 'apollo_lrv',
      name: 'Lunar Roving Vehicle (Apollo 17)',
      x: 1350,
      y: 410,
      width: 90,
      height: 45,
      type: 'rover',
      discovered: progress.unlockedMissions.includes('apollo_lrv'),
      label: 'Apollo 17 LRV'
    },
    {
      id: 'surveyor_3',
      name: 'Surveyor 3 Lander (1967)',
      x: 2050,
      y: 410,
      width: 100,
      height: 45,
      type: 'lander',
      discovered: progress.unlockedMissions.includes('surveyor_3'),
      label: 'Surveyor 3 Site'
    }
  ];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#03060d] text-slate-100 flex flex-col font-sans select-none">
      <Suspense fallback={<LoadingFallback />}>
        {/* CHAPTER 0: MAIN MENU */}
        {progress.currentChapter === 0 && (
          <MainMenu
            progress={progress}
            onStartNewMission={() => {
              resetProgress();
              setProgress(getSavedProgress());
              goToChapter(1); // Launch prologue leading into open world
            }}
            onContinueMission={() => {
              if (hasSavedWorldRun()) {
                goToChapter(4);
              } else {
                const ch = progress.currentChapter === 0 ? 4 : progress.currentChapter;
                goToChapter(ch);
              }
            }}
            onSelectChapter={(ch) => goToChapter(ch)}
            onOpenArchive={() => setShowArchive(true)}
            onOpenKnowledge={() => setShowArchive(true)}
            onOpenSettings={() => setShowSettings(true)}
            onOpenCredits={() => setShowCredits(true)}
          />
        )}

        {/* CHAPTER 1: PROLOGUE — THE EXPEDITION TO MARS */}
        {progress.currentChapter === 1 && (
          <PrologueScene onComplete={() => goToChapter(4)} />
        )}

        {/* CHAPTER 2: ECHOES OF THE MOON (SURFACE EXPLORATION - LEGACY) */}
        {progress.currentChapter === 2 && (
          <div className="relative w-full h-full flex flex-col">
            <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 pointer-events-auto">
                <button
                  onClick={() => goToChapter(0)}
                  className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title="Main Menu"
                >
                  <Menu className="w-4 h-4" />
                </button>
                <div className="text-xs font-mono">
                  <span className="text-cyan-400 font-semibold">LEGACY: THE MOON</span>
                  <span className="text-slate-500 mx-2">·</span>
                  <span className="text-slate-300">Gravity: 1.62 m/s²</span>
                  <span className="text-slate-500 mx-2">·</span>
                  <span className="text-slate-400">
                    Discoveries: {progress.unlockedMissions.filter(m => ['apollo_lrrr', 'apollo_lrv', 'surveyor_3'].includes(m)).length} / 3
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pointer-events-auto">
                <button
                  onClick={() => setShowArchive(true)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 hover:border-cyan-500/50 text-xs font-mono text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Archive</span>
                </button>
                <button
                  onClick={toggleSound}
                  className="p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800 text-slate-300 cursor-pointer"
                >
                  {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
                </button>
              </div>
            </div>

            <div className="flex-1 w-full h-full">
              <GameCanvas
                environment="moon"
                entities={moonEntities}
                onInteract={handleCanvasInteraction}
              />
            </div>

            {novaDialogue && (
              <div className="absolute bottom-20 left-4 right-4 max-w-xl mx-auto z-30">
                <NovaDialogue
                  text={novaDialogue.text}
                  mood={novaDialogue.mood || 'idle'}
                  actionLabel={novaDialogue.actionLabel}
                  onAction={novaDialogue.onAction}
                  onDismiss={() => setNovaDialogue(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* CHAPTER 3: THE CRASH & MALFUNCTION (LEGACY) */}
        {progress.currentChapter === 3 && (
          <MarsCrashScene onDiagnosticComplete={() => goToChapter(4)} />
        )}

        {/* CHAPTER 4: MARS OPEN-WORLD EXPEDITION */}
        {progress.currentChapter === 4 && (
          <WorldScene
            key={String(worldSeed)}
            config={{ seed: worldSeed }}
            onExitToMenu={() => {
              setProgress(getSavedProgress());
              goToChapter(0);
            }}
            onOpenArchive={() => setShowArchive(true)}
            onRestartWithSeed={(newSeed) => {
              setWorldSeed(newSeed);
              setProgress({ ...getSavedProgress(), currentChapter: 4 });
            }}
            isMuted={isMuted}
            onToggleSound={toggleSound}
          />
        )}

        {/* CHAPTER 5: MARS WEATHER CHALLENGE (LEGACY) */}
        {progress.currentChapter === 5 && (
          <MarsWeatherChallenge
            onChallengeResolved={(decision) => {
              updateProgress((prev) => ({ ...prev, stormDecisionMade: decision }));
              goToChapter(6);
            }}
          />
        )}

        {/* CHAPTER 6: SPACECRAFT REPAIR (LEGACY MODAL) */}
        {progress.currentChapter === 6 && (
          <SpacecraftRepairScene onRepairComplete={() => goToChapter(7)} />
        )}

        {/* CHAPTER 7: LAUNCH CINEMATIC & MISSION COMPLETE */}
        {progress.currentChapter === 7 && (
          <LaunchCinematic
            progress={progress}
            onReturnToMenu={() => goToChapter(0)}
            onRestartCampaign={() => {
              resetProgress();
              setProgress(getSavedProgress());
              goToChapter(1);
            }}
          />
        )}

        {/* DISCOVERY MODAL */}
        {activeDiscovery && (
          <DiscoveryModal
            discovery={activeDiscovery}
            onClose={() => handleDiscoveryDone(activeDiscovery.id)}
            onStartActivity={() => handleDiscoveryDone(activeDiscovery.id)}
            activityLabel={
              activeDiscovery.id === 'apollo_lrrr'
                ? 'Begin Knowledge Quiz'
                : 'Launch Engineering Simulator'
            }
          />
        )}

        {/* INTERACTIVE QUIZ MODAL */}
        {activeQuiz && (
          <QuizModal
            discovery={activeQuiz}
            onSuccess={() => handleQuizSuccess(activeQuiz.id)}
            onClose={() => setActiveQuiz(null)}
          />
        )}

        {/* MINI-GAMES */}
        {activeMiniGame === 'sojourner' && (
          <SojournerRoverPuzzle
            onSuccess={() => handleMiniGameSuccess('sojourner')}
            onClose={() => setActiveMiniGame(null)}
          />
        )}

        {activeMiniGame === 'opportunity' && (
          <OpportunityWaterPuzzle
            onSuccess={() => handleMiniGameSuccess('opportunity')}
            onClose={() => setActiveMiniGame(null)}
          />
        )}

        {activeMiniGame === 'insight' && (
          <InSightSeismicPuzzle
            onSuccess={() => handleMiniGameSuccess('insight')}
            onClose={() => setActiveMiniGame(null)}
          />
        )}

        {/* MISSION ARCHIVE & CODEX */}
        {showArchive && (
          <MissionArchiveModal
            unlockedMissionIds={progress.unlockedMissions}
            completedEquipmentIds={progress.worldSave?.completedEquipmentIds || []}
            collectedSampleIds={progress.worldSave?.collectedSampleIds || []}
            discoveredLandmarkIds={progress.worldSave?.discoveredLandmarkIds || []}
            researchPoints={progress.worldSave?.researchPoints || 0}
            onClose={() => setShowArchive(false)}
          />
        )}

        {/* SETTINGS MODAL */}
        {showSettings && (
          <SettingsModal
            onClose={() => setShowSettings(false)}
            onResetSave={() => {
              setProgress(getSavedProgress());
              goToChapter(0);
            }}
          />
        )}

        {/* CREDITS & NASA SOURCES */}
        {showCredits && (
          <CreditsModal onClose={() => setShowCredits(false)} />
        )}
      </Suspense>
    </div>
  );
}