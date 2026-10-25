import React, { useState, useEffect, useCallback } from "react";
import {
  SliderValues,
  ProfileType,
  ProfileMode,
  DependencyStatus,
  SystemAuditResult,
} from "./types/audio";
import { AudioSliders } from "./components/AudioSliders";
import { AuditModal } from "./components/AuditModal";
import { WelcomeSetup } from "./components/WelcomeSetup";
import {
  ShieldAlert,
  Volume2,
  RefreshCw,
  Cpu,
  Gamepad2,
  SlidersHorizontal,
  Info,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// Safe wrapper for Tauri invoke (falls back gracefully in browser dev mode)
async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<T>(cmd, args);
    } catch (e) {
      console.warn(`[Tauri] Invoke '${cmd}' failed:`, e);
      throw e;
    }
  }

  // Development/Mock fallback when running in a pure browser without Tauri backend
  console.log(`[Dev Mock] Invoking Tauri command: ${cmd}`, args);
  if (cmd === "check_system_dependencies") {
    return {
      equalizer_apo_installed: false,
      config_linked: false,
      installed_path: "C:\\Program Files\\EqualizerAPO",
      first_run_completed: false,
      details: "Modo de desarrollo detectado (Simulador web)",
    } as unknown as T;
  }
  if (cmd === "audit_system") {
    return {
      all_optimal: false,
      timestamp: new Date().toLocaleTimeString(),
      checks: [
        {
          id: "audio_enhancements",
          name: "Mejoras de Audio de Windows",
          status: "warning",
          current_value: "Habilitadas (Distorsión presente)",
          recommended: "Deshabilitar para audio directo",
          description: "Las mejoras de Windows agregan compresión y latencia en tiempo real.",
        },
        {
          id: "spatial_sound",
          name: "Sonido Espacial (Sonic/Dolby)",
          status: "warning",
          current_value: "Activo",
          recommended: "Desactivar (Audio Estéreo Puro)",
          description: "La virtualización espacial altera la respuesta de frecuencia en pasos lejanos.",
        },
        {
          id: "audio_format",
          name: "Formato de Muestreo de Audio",
          status: "optimal",
          current_value: "24 bits, 48000 Hz",
          recommended: "16/24 bits, 48000 Hz",
          description: "Frecuencia nativa para juegos y streaming.",
        },
        {
          id: "power_plan",
          name: "Plan de Energía de Windows",
          status: "warning",
          current_value: "Equilibrado",
          recommended: "Alto Rendimiento / Máximo Desempeño",
          description: "Evita que el kernel reduzca la frecuencia del chip de audio en reposo.",
        },
      ],
    } as unknown as T;
  }
  if (cmd === "request_system_optimization") {
    return true as unknown as T;
  }
  return true as unknown as T;
}

const DEFAULT_GAME_SLIDERS: SliderValues = {
  pasos: 7.5,
  bombas: 6.0,
  disparos: 5.0,
  claridad: 4.0,
  maestro: -2.0,
};

const DEFAULT_NORMAL_SLIDERS: SliderValues = {
  pasos: 0.0,
  bombas: 0.0,
  disparos: 0.0,
  claridad: 0.0,
  maestro: 0.0,
};

export const App: React.FC = () => {
  const [profileMode, setProfileMode] = useState<ProfileMode>("auto");
  const [activeProfile, setActiveProfile] = useState<ProfileType>("JUEGOS");
  const [currentProcess, setCurrentProcess] = useState<string>("Buscando...");
  const [isGameActive, setIsGameActive] = useState<boolean>(true);

  const [gameSliders, setGameSliders] = useState<SliderValues>(DEFAULT_GAME_SLIDERS);
  const [normalSliders, setNormalSliders] = useState<SliderValues>(DEFAULT_NORMAL_SLIDERS);

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [auditData, setAuditData] = useState<SystemAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);

  const activeSliders = activeProfile === "JUEGOS" ? gameSliders : normalSliders;

  // Sync EQ configuration to backend file
  const syncEqProfile = useCallback(
    async (values: SliderValues, profile: ProfileType) => {
      try {
        await tauriInvoke("update_eq_profile", {
          sliderValues: values,
          profile: profile,
        });
      } catch (err) {
        console.error("Error sincronizando archivo de EQ:", err);
      }
    },
    []
  );

  // Trigger audio refresh
  const triggerAudioRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setRefreshNotice(null);
    try {
      await tauriInvoke("force_audio_refresh");
      setRefreshNotice("Audio sincronizado");
      setTimeout(() => setRefreshNotice(null), 2000);
    } catch (err) {
      console.error("Error al refrescar audio:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Check dependencies on startup
  const checkDependencies = useCallback(async () => {
    try {
      const res = await tauriInvoke<DependencyStatus>("check_system_dependencies");
      setDependencyStatus(res);
      if (!res.equalizer_apo_installed || !res.first_run_completed) {
        setShowWelcome(true);
      }
    } catch (e) {
      console.error("Error comprobando dependencias:", e);
    }
  }, []);

  // Run Windows 11 system audit
  const runAudit = useCallback(async () => {
    setIsAuditing(true);
    try {
      const res = await tauriInvoke<SystemAuditResult>("audit_system");
      setAuditData(res);
    } catch (e) {
      console.error("Error auditando sistema:", e);
    } finally {
      setIsAuditing(false);
    }
  }, []);

  const handleRequestOptimization = async (): Promise<boolean> => {
    return await tauriInvoke<boolean>("request_system_optimization");
  };

  useEffect(() => {
    checkDependencies();
    runAudit();
    syncEqProfile(activeSliders, activeProfile);
  }, []);

  // Listen to background window detector events if in Tauri
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      if (
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
      ) {
        try {
          const { listen } = await import("@tauri-apps/api/event");
          unlisten = await listen<{ process_name: string; is_game: boolean }>(
            "window_changed",
            (event) => {
              const { process_name, is_game } = event.payload;
              setCurrentProcess(process_name);
              setIsGameActive(is_game);

              if (profileMode === "auto") {
                const targetProfile: ProfileType = is_game ? "JUEGOS" : "NORMAL";
                setActiveProfile((prev) => {
                  if (prev !== targetProfile) {
                    const values = targetProfile === "JUEGOS" ? gameSliders : normalSliders;
                    syncEqProfile(values, targetProfile);
                    triggerAudioRefresh();
                  }
                  return targetProfile;
                });
              }
            }
          );
        } catch (e) {
          console.warn("No se pudo registrar listener de eventos Tauri:", e);
        }
      }
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [profileMode, gameSliders, normalSliders, syncEqProfile, triggerAudioRefresh]);

  const handleSliderChange = (key: keyof SliderValues, val: number) => {
    if (activeProfile === "JUEGOS") {
      const updated = { ...gameSliders, [key]: val };
      setGameSliders(updated);
      syncEqProfile(updated, "JUEGOS");
    } else {
      const updated = { ...normalSliders, [key]: val };
      setNormalSliders(updated);
      syncEqProfile(updated, "NORMAL");
    }
  };

  const handleSliderRelease = () => {
    triggerAudioRefresh();
  };

  const handleToggleProfile = (target: ProfileType) => {
    setActiveProfile(target);
    const values = target === "JUEGOS" ? gameSliders : normalSliders;
    syncEqProfile(values, target);
    triggerAudioRefresh();
  };

  const openSourceForge = () => {
    window.open("https://sourceforge.net/projects/equalizerapo/", "_blank");
  };

  return (
    <div className="min-h-screen bg-tactical-900 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Bar / Navigation */}
      <header className="px-6 py-3.5 bg-tactical-850 border-b border-tactical-700 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-tactical-accent/10 border border-tactical-accent/40 flex items-center justify-center text-tactical-accent">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-base font-bold tracking-wider text-slate-100">
                AUDIO DASH
              </span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-tactical-accent/20 text-tactical-accent border border-tactical-accent/40">
                v1.0 MVP
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              OPTIMIZADOR DE AUDIO COMPETITIVO • APO ENGINE
            </p>
          </div>
        </div>

        {/* Tactical Controls & Actions */}
        <div className="flex items-center space-x-3">
          {/* Refresh Audio Button */}
          <button
            onClick={triggerAudioRefresh}
            disabled={isRefreshing}
            title="Forzar actualización inmediata del búfer de audio"
            className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-xs font-mono text-slate-200 flex items-center space-x-1.5 transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-tactical-accent ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>Refrescar Audio</span>
          </button>

          {/* System Audit Trigger */}
          <button
            onClick={() => setIsAuditOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-accent/40 text-xs font-mono text-tactical-accent flex items-center space-x-1.5 transition-all shadow-sm shadow-tactical-accent/10"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Auditoría Win11</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-5 overflow-y-auto">
        {/* Profile Switcher & Process Detection Header */}
        <section className="p-4 rounded-xl bg-tactical-850/80 border border-tactical-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Gamepad2 className="w-4 h-4 text-tactical-accent" />
              <span className="text-xs font-mono uppercase text-slate-400">
                Ventana en Primer Plano:
              </span>
              <span className="font-mono text-xs font-bold text-slate-200 px-2 py-0.5 rounded bg-tactical-900 border border-tactical-700">
                {currentProcess}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Perfil en uso:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                  activeProfile === "JUEGOS"
                    ? "bg-tactical-green/15 text-tactical-green border border-tactical-green/30"
                    : "bg-slate-700/50 text-slate-300 border border-slate-600"
                }`}
              >
                {activeProfile === "JUEGOS" ? "TACTICAL GAMING (EQ ACTIVO)" : "NORMAL (PLANO / CHAT)"}
              </span>
            </div>
          </div>

          {/* Profile Mode & Switcher Controls */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
            {/* Auto vs Manual Switch */}
            <div className="flex items-center p-1 rounded-lg bg-tactical-900 border border-tactical-700 text-xs font-mono">
              <button
                onClick={() => setProfileMode("auto")}
                className={`px-3 py-1 rounded transition-colors ${
                  profileMode === "auto"
                    ? "bg-tactical-accent text-tactical-900 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Automático (Ventana)
              </button>
              <button
                onClick={() => setProfileMode("manual")}
                className={`px-3 py-1 rounded transition-colors ${
                  profileMode === "manual"
                    ? "bg-tactical-accent text-tactical-900 font-bold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Manual
              </button>
            </div>

            {/* Manual Toggle Buttons (Available when Manual mode is active) */}
            {profileMode === "manual" && (
              <div className="flex items-center space-x-1 p-1 rounded-lg bg-tactical-900 border border-tactical-700 text-xs font-mono">
                <button
                  onClick={() => handleToggleProfile("JUEGOS")}
                  className={`px-3 py-1 rounded font-bold transition-all ${
                    activeProfile === "JUEGOS"
                      ? "bg-tactical-green text-tactical-900 shadow-md shadow-tactical-green/20"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  JUEGOS
                </button>
                <button
                  onClick={() => handleToggleProfile("NORMAL")}
                  className={`px-3 py-1 rounded font-bold transition-all ${
                    activeProfile === "NORMAL"
                      ? "bg-slate-300 text-tactical-900 shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  NORMAL
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Global EQ Notice Banner */}
        {profileMode === "auto" && (
          <div className="px-4 py-2.5 rounded-lg bg-tactical-800/80 border border-tactical-accent/20 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2.5">
              <Info className="w-4 h-4 text-tactical-accent shrink-0" />
              <span>
                <strong className="text-tactical-accent">Aviso de Dispositivo Global:</strong> Al
                minimizar el juego o cambiar a Discord/escritorio, Equalizer APO ajustará el audio
                general para proteger la claridad vocal.
              </span>
            </div>
            {refreshNotice && (
              <span className="font-mono text-[11px] text-tactical-green font-bold shrink-0 ml-2">
                ✓ {refreshNotice}
              </span>
            )}
          </div>
        )}

        {/* Perceptual Sliders Container */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold font-mono tracking-wider text-slate-200 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-tactical-accent" />
              CONTROLES DE INGENIERÍA PERCEPTUAL (0 - 10)
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Escritura atómica en %APPDATA%\AudioDash\config.txt
            </span>
          </div>

          <AudioSliders
            values={activeSliders}
            onChange={handleSliderChange}
            onRelease={handleSliderRelease}
            disabled={activeProfile === "NORMAL" && profileMode === "manual"}
          />
        </section>
      </main>

      {/* Status Bar Footer */}
      <footer className="px-6 py-2.5 bg-tactical-850 border-t border-tactical-700 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-tactical-green animate-pulse"></span>
            <span>MOTOR RUST: ACTIVO (0.0% CPU)</span>
          </div>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <Cpu className="w-3 h-3 text-slate-400" />
            <span>SONDEO WIN32 NATIVO: 500ms</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span>APO STATUS:</span>
          <span
            className={`font-bold ${
              dependencyStatus?.equalizer_apo_installed
                ? "text-tactical-green"
                : "text-tactical-warning"
            }`}
          >
            {dependencyStatus?.equalizer_apo_installed ? "VINCULADO" : "PENDIENTE"}
          </span>
        </div>
      </footer>

      {/* Windows 11 System Audit Modal */}
      <AuditModal
        isOpen={isAuditOpen}
        onClose={() => setIsAuditOpen(false)}
        auditData={auditData}
        isLoading={isAuditing}
        onRunAudit={runAudit}
        onRequestOptimization={handleRequestOptimization}
      />

      {/* Welcome Setup Modal (First-Run / Dependency missing) */}
      {showWelcome && dependencyStatus && (
        <WelcomeSetup
          status={dependencyStatus}
          onRescan={checkDependencies}
          onCompleteFirstRun={() => setShowWelcome(false)}
          onOpenDownloadUrl={openSourceForge}
        />
      )}
    </div>
  );
};
