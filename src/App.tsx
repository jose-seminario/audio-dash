import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SliderValues,
  ProfileType,
  ProfileMode,
  DependencyStatus,
  SystemAuditResult,
  HrtfProfile,
} from "./types/audio";
import { AudioSliders } from "./components/AudioSliders";
import { AuditModal } from "./components/AuditModal";
import { WelcomeSetup } from "./components/WelcomeSetup";
import { HEADPHONE_PROFILES } from "./data/headphones";
import {
  ShieldAlert,
  Volume2,
  RefreshCw,
  Cpu,
  Gamepad2,
  SlidersHorizontal,
  Info,
  Headphones,
  Radio,
  Sparkles,
  Target,
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
      checks: [],
    } as unknown as T;
  }
  if (cmd === "ensure_vst_plugin_installed" || cmd === "ensure_hrir_installed") {
    return true as unknown as T;
  }
  if (cmd === "get_clutch_state") {
    return false as unknown as T;
  }
  if (cmd === "toggle_clutch_mode") {
    return true as unknown as T;
  }
  return true as unknown as T;
}

const HRTF_OPTIONS: HrtfProfile[] = [
  {
    id: "stereo_direct",
    name: "Estéreo Directo (Sin HRTF / Bypass)",
    brand: "Puro",
    description: "Audio 1:1 original sin procesado convolutivo",
    filename: "",
  },
  {
    id: "sennheiser_gsx",
    name: "Sennheiser GSX 1000 (7.1 Pinpoint FPS)",
    brand: "EPOS",
    description: "Máxima precisión en pasos traseros y ángulos de 45°",
    filename: "sennheiser_gsx.wav",
  },
  {
    id: "waves_nx",
    name: "Waves Nx (Studio Virtualization)",
    brand: "Waves",
    description: "Separación tridimensional sin eco ni distorsión",
    filename: "waves_nx.wav",
  },
  {
    id: "dts_headphone_x",
    name: "DTS Headphone:X v1 (Tactical Stage)",
    brand: "DTS",
    description: "Escenario sonoro expandido para detección temprana",
    filename: "dts_headphone_x.wav",
  },
  {
    id: "dolby_atmos_ref",
    name: "Dolby Atmos Binaural Reference",
    brand: "Dolby",
    description: "Inmersión espacial balanceada de amplio espectro",
    filename: "dolby_atmos_ref.wav",
  },
];

const DEFAULT_GAME_SLIDERS: SliderValues = {
  pasos: 7.5,
  bombas: 4.0,
  disparos: 3.5,
  claridad: 6.0,
  compresion: 65,
  atenuacionPropia: -6.0,
  maestro: 0,
};

const DEFAULT_NORMAL_SLIDERS: SliderValues = {
  pasos: 0,
  bombas: 0,
  disparos: 0,
  claridad: 0,
  compresion: 0,
  atenuacionPropia: 0,
  maestro: 0,
};

export const App: React.FC = () => {
  // Profiles and active mode state
  const [profileMode, setProfileMode] = useState<ProfileMode>("auto");
  const [activeProfile, setActiveProfile] = useState<ProfileType>("JUEGOS");
  const [currentProcess, setCurrentProcess] = useState<string>("Buscando...");
  const [isGameActive, setIsGameActive] = useState<boolean>(false);

  // Per-profile slider values
  const [gameSliders, setGameSliders] = useState<SliderValues>(DEFAULT_GAME_SLIDERS);
  const [normalSliders, setNormalSliders] = useState<SliderValues>(DEFAULT_NORMAL_SLIDERS);

  // Hardware AutoEQ Profile
  const [selectedHeadphoneId, setSelectedHeadphoneId] = useState<string>("flat");

  // HeSuVi HRTF Positional Audio Profile
  const [selectedHrtf, setSelectedHrtf] = useState<string>("sennheiser_gsx.wav");

  // Clutch Mode state (Hotkeyed via Ctrl+Shift+C)
  const [isClutchActive, setIsClutchActive] = useState<boolean>(false);

  // Distance Aware mode state
  const [distanceAware, setDistanceAware] = useState<boolean>(false);
  const distanceAwareRef = useRef(distanceAware);
  distanceAwareRef.current = distanceAware;

  // A/B Testing comparison state (Temporary bypass while mouse down)
  const [isAbBypassActive, setIsAbBypassActive] = useState<boolean>(false);

  // System setup & audit modal states
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [auditData, setAuditData] = useState<SystemAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const activeSliders = activeProfile === "JUEGOS" ? gameSliders : normalSliders;

  // Refs for stable event callbacks and listeners
  const profileModeRef = useRef(profileMode);
  profileModeRef.current = profileMode;

  const gameSlidersRef = useRef(gameSliders);
  gameSlidersRef.current = gameSliders;

  const normalSlidersRef = useRef(normalSliders);
  normalSlidersRef.current = normalSliders;

  const activeProfileRef = useRef(activeProfile);
  activeProfileRef.current = activeProfile;

  const selectedHeadphoneIdRef = useRef(selectedHeadphoneId);
  selectedHeadphoneIdRef.current = selectedHeadphoneId;

  const selectedHrtfRef = useRef(selectedHrtf);
  selectedHrtfRef.current = selectedHrtf;

  const isClutchActiveRef = useRef(isClutchActive);
  isClutchActiveRef.current = isClutchActive;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getActiveHeadphoneFilters = useCallback((): string[] => {
    const found = HEADPHONE_PROFILES.find((h) => h.id === selectedHeadphoneIdRef.current);
    return found ? found.filters : [];
  }, []);

  // Sync EQ configuration to backend file
  const syncEqProfile = useCallback(
    async (
      values: SliderValues,
      profile: ProfileType,
      hrtfFile?: string,
      clutch?: boolean,
      distAware?: boolean
    ) => {
      try {
        const hrtf = hrtfFile !== undefined ? hrtfFile : selectedHrtfRef.current;
        const cl = clutch !== undefined ? clutch : isClutchActiveRef.current;
        const dist = distAware !== undefined ? distAware : distanceAwareRef.current;

        await tauriInvoke("update_eq_profile", {
          sliderValues: values,
          profile: profile,
          headphoneFilters: getActiveHeadphoneFilters(),
          hrtfFilename: hrtf || null,
          isClutch: cl,
          distanceAware: dist,
        });
      } catch (err) {
        console.error("Error sincronizando archivo de EQ:", err);
      }
    },
    [getActiveHeadphoneFilters]
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

  const handleToggleClutch = async () => {
    try {
      const newState = await tauriInvoke<boolean>("toggle_clutch_mode");
      setIsClutchActive(newState);
      isClutchActiveRef.current = newState;
      const currentVals =
        activeProfileRef.current === "JUEGOS"
          ? gameSlidersRef.current
          : normalSlidersRef.current;
      syncEqProfile(
        currentVals,
        activeProfileRef.current,
        selectedHrtfRef.current,
        newState,
        distanceAwareRef.current
      );
      triggerAudioRefresh();
    } catch (e) {
      console.error("Error toggling clutch mode:", e);
    }
  };

  const handleToggleDistanceAware = () => {
    const nextVal = !distanceAware;
    setDistanceAware(nextVal);
    distanceAwareRef.current = nextVal;
    const values =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(values, activeProfileRef.current, undefined, undefined, nextVal);
    triggerAudioRefresh();
  };

  const handleAbMouseDown = async () => {
    setIsAbBypassActive(true);
    try {
      await tauriInvoke("update_eq_profile", {
        sliderValues: DEFAULT_NORMAL_SLIDERS,
        profile: "NORMAL",
        headphoneFilters: [],
        hrtfFilename: null,
        isClutch: false,
        distanceAware: false,
      });
      await tauriInvoke("force_audio_refresh");
    } catch (err) {
      console.error("Error activando Bypass A/B:", err);
    }
  };

  const handleAbMouseUp = async () => {
    if (!isAbBypassActive) return;
    setIsAbBypassActive(false);
    try {
      const currentVals =
        activeProfileRef.current === "JUEGOS"
          ? gameSlidersRef.current
          : normalSlidersRef.current;
      await tauriInvoke("update_eq_profile", {
        sliderValues: currentVals,
        profile: activeProfileRef.current,
        headphoneFilters: getActiveHeadphoneFilters(),
        hrtfFilename: selectedHrtfRef.current || null,
        isClutch: isClutchActiveRef.current,
        distanceAware: distanceAwareRef.current,
      });
      await tauriInvoke("force_audio_refresh");
    } catch (err) {
      console.error("Error restaurando perfil tras A/B:", err);
    }
  };

  useEffect(() => {
    checkDependencies();
    runAudit();
    // Silently verify/download VST and HRIR on the user's machine
    tauriInvoke("ensure_vst_plugin_installed").catch(() => {});
    if (selectedHrtf) {
      tauriInvoke("ensure_hrir_installed", { filename: selectedHrtf }).catch(() => {});
    }
    syncEqProfile(activeSliders, activeProfile);
  }, []);

  // Listen to background window detector events and clutch toggle events
  useEffect(() => {
    let unlistenWindow: (() => void) | undefined;
    let unlistenClutch: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      if (
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
      ) {
        try {
          const { listen } = await import("@tauri-apps/api/event");

          // Window detector listener
          unlistenWindow = await listen<{ process_name: string; is_game: boolean }>(
            "window_changed",
            (event) => {
              if (!isMounted) return;
              const { process_name, is_game } = event.payload;
              setCurrentProcess(process_name);
              setIsGameActive(is_game);

              if (profileModeRef.current === "auto") {
                const targetProfile: ProfileType = is_game ? "JUEGOS" : "NORMAL";
                setActiveProfile((prev) => {
                  if (prev !== targetProfile) {
                    const values =
                      targetProfile === "JUEGOS"
                        ? gameSlidersRef.current
                        : normalSlidersRef.current;
                    syncEqProfile(values, targetProfile);
                    triggerAudioRefresh();
                  }
                  return targetProfile;
                });
              }
            }
          );

          // Clutch mode toggled via hotkey (Ctrl+Shift+C)
          unlistenClutch = await listen<boolean>("clutch_mode_toggled", (event) => {
            if (!isMounted) return;
            const newState = event.payload;
            setIsClutchActive(newState);
            isClutchActiveRef.current = newState;
            const currentVals =
              activeProfileRef.current === "JUEGOS"
                ? gameSlidersRef.current
                : normalSlidersRef.current;
            syncEqProfile(
              currentVals,
              activeProfileRef.current,
              selectedHrtfRef.current,
              newState,
              distanceAwareRef.current
            );
            triggerAudioRefresh();
          });
        } catch (e) {
          console.warn("No se pudo registrar listener de eventos Tauri:", e);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (unlistenWindow) unlistenWindow();
      if (unlistenClutch) unlistenClutch();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [syncEqProfile, triggerAudioRefresh]);

  // Debounced slider handler
  const handleSliderChange = (key: keyof SliderValues, val: number) => {
    if (activeProfile === "JUEGOS") {
      const updated = { ...gameSliders, [key]: val };
      setGameSliders(updated);
      gameSlidersRef.current = updated;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        syncEqProfile(updated, "JUEGOS");
      }, 75);
    } else {
      const updated = { ...normalSliders, [key]: val };
      setNormalSliders(updated);
      normalSlidersRef.current = updated;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        syncEqProfile(updated, "NORMAL");
      }, 75);
    }
  };

  const handleSliderRelease = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const currentValues =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(currentValues, activeProfileRef.current);
    triggerAudioRefresh();
  };

  const handleToggleProfile = (target: ProfileType) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    setActiveProfile(target);
    activeProfileRef.current = target;
    const values = target === "JUEGOS" ? gameSlidersRef.current : normalSlidersRef.current;
    syncEqProfile(values, target);
    triggerAudioRefresh();
  };

  const handleHeadphoneChange = (id: string) => {
    setSelectedHeadphoneId(id);
    selectedHeadphoneIdRef.current = id;
    const values =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(values, activeProfileRef.current);
    triggerAudioRefresh();
  };

  const handleHrtfChange = (filename: string) => {
    setSelectedHrtf(filename);
    selectedHrtfRef.current = filename;
    if (filename) {
      tauriInvoke("ensure_hrir_installed", { filename }).catch(() => {});
    }
    const values =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(values, activeProfileRef.current, filename);
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
                v1.3.0 OPEN SOURCE
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              TACTICAL AUDIO OPTIMIZER • ANTI-DISCORD & ANTI-CLIPPING
            </p>
          </div>
        </div>

        {/* Tactical Controls & Actions */}
        <div className="flex items-center space-x-2.5">
          {/* Clutch Mode Trigger */}
          <button
            onClick={handleToggleClutch}
            title="Modo Clutch: Atenúa Discord al 10% y aplica hiper-realce táctico de pasos (+8 dB). Atajo global: Ctrl+Shift+C"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
              isClutchActive
                ? "bg-tactical-alert text-white border-white animate-pulse shadow-md shadow-tactical-alert/40"
                : "bg-tactical-800 hover:bg-tactical-700 border-tactical-alert/40 text-tactical-alert"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isClutchActive ? "CLUTCH ACTIVO [ON]" : "MODO CLUTCH"}</span>
            <span className="hidden lg:inline text-[9px] px-1 py-0.2 rounded bg-black/40 border border-current font-normal">
              Ctrl+Shift+C
            </span>
          </button>

          {/* A/B Comparison Testing Button */}
          <button
            onMouseDown={handleAbMouseDown}
            onMouseUp={handleAbMouseUp}
            onTouchStart={handleAbMouseDown}
            onTouchEnd={handleAbMouseUp}
            onMouseLeave={handleAbMouseUp}
            title="Mantén presionado para escuchar el audio original de Windows (Bypass) y suelta para reactivar el audio táctico de Audio Dash"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer select-none ${
              isAbBypassActive
                ? "bg-amber-500 text-tactical-900 border-amber-300 shadow-md shadow-amber-500/40 animate-pulse scale-95"
                : "bg-tactical-800 hover:bg-tactical-700 border-amber-400/40 text-amber-300"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isAbBypassActive ? "ORIGINAL (BYPASS)" : "A/B TEST"}</span>
          </button>

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
            <span>Refrescar</span>
          </button>

          {/* System Audit Trigger */}
          <button
            onClick={() => setIsAuditOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-accent/40 text-xs font-mono text-tactical-accent flex items-center space-x-1.5 transition-all shadow-sm shadow-tactical-accent/10"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Auditoría & MMCSS</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-5xl w-full mx-auto space-y-4 overflow-y-auto">
        {/* Hardware & Spatial Engine Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Headphone AutoEQ Calibration Selector */}
          <section className="p-3 rounded-xl bg-tactical-850 border border-tactical-700 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-tactical-800 text-tactical-accent border border-tactical-700 shrink-0">
                <Headphones className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider truncate">
                  Calibración AutoEQ
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  Neutraliza la curva de fábrica
                </p>
              </div>
            </div>

            <select
              value={selectedHeadphoneId}
              onChange={(e) => handleHeadphoneChange(e.target.value)}
              className="w-48 sm:w-56 px-2.5 py-1.5 rounded-lg bg-tactical-900 border border-tactical-600 text-xs font-mono text-slate-200 focus:outline-none focus:border-tactical-accent transition-colors shrink-0"
            >
              {HEADPHONE_PROFILES.map((hp) => (
                <option key={hp.id} value={hp.id}>
                  {hp.brand} - {hp.name}
                </option>
              ))}
            </select>
          </section>

          {/* HeSuVi HRTF Positional Spatial Engine Selector */}
          <section className="p-3 rounded-xl bg-tactical-850 border border-tactical-700 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-tactical-800 text-tactical-green border border-tactical-700 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider truncate">
                  Motor HRTF (HeSuVi 7.1)
                </h4>
                <p className="text-[10px] text-slate-400 truncate">
                  Convolución binaural posicional
                </p>
              </div>
            </div>

            <select
              value={selectedHrtf}
              onChange={(e) => handleHrtfChange(e.target.value)}
              className="w-48 sm:w-56 px-2.5 py-1.5 rounded-lg bg-tactical-900 border border-tactical-600 text-xs font-mono text-slate-200 focus:outline-none focus:border-tactical-green transition-colors shrink-0"
            >
              {HRTF_OPTIONS.map((hrtf) => (
                <option key={hrtf.id} value={hrtf.filename}>
                  {hrtf.name}
                </option>
              ))}
            </select>
          </section>
        </div>

        {/* Profile Switcher & Process Detection Header */}
        <section className="p-4 rounded-xl bg-tactical-850/80 border border-tactical-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Gamepad2
                className={`w-4 h-4 transition-colors ${
                  isGameActive ? "text-tactical-green animate-pulse" : "text-slate-500"
                }`}
              />
              <span className="text-xs font-mono uppercase text-slate-400">
                Ventana en Primer Plano:
              </span>
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded bg-tactical-900 border transition-all ${
                  isGameActive
                    ? "text-tactical-green border-tactical-green/40 shadow-sm shadow-tactical-green/20"
                    : "text-slate-300 border-tactical-700"
                }`}
              >
                {currentProcess}
              </span>
            </div>

            <div className="flex items-center space-x-2 text-xs">
              <span className="text-slate-400">Perfil en uso:</span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] ${
                  isClutchActive
                    ? "bg-tactical-alert/20 text-tactical-alert border border-tactical-alert/40 animate-pulse"
                    : activeProfile === "JUEGOS"
                    ? "bg-tactical-green/15 text-tactical-green border border-tactical-green/30"
                    : "bg-slate-700/50 text-slate-300 border border-slate-600"
                }`}
              >
                {isClutchActive
                  ? "CLUTCH MODE (DISCORD AL 10% + HIPER-REALCE PASOS)"
                  : activeProfile === "JUEGOS"
                  ? "TACTICAL GAMING (EQ + VST + HRTF)"
                  : "NORMAL (PLANO / CHAT)"}
              </span>
            </div>
          </div>

          {/* Profile Mode & Switcher Controls */}
          <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
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

        {/* Global Notice Banner */}
        {profileMode === "auto" && (
          <div className="px-4 py-2.5 rounded-lg bg-tactical-800/80 border border-tactical-accent/20 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center space-x-2.5">
              <Info className="w-4 h-4 text-tactical-accent shrink-0" />
              <span>
                <strong className="text-tactical-accent">Ventaja Táctica Activa:</strong> AutoEQ, compresor LoudMax VST y convolución espacial 7.1 procesando a nivel de Windows sin latencia.
              </span>
            </div>
            {refreshNotice && (
              <span className="font-mono text-[11px] text-tactical-green font-bold shrink-0 ml-2">
                ✓ {refreshNotice}
              </span>
            )}
          </div>
        )}

        {/* Perceptual & Dynamic Sliders */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <h3 className="text-sm font-bold font-mono tracking-wider text-slate-200 flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-tactical-accent" />
              CONTROLES DE INGENIERÍA PERCEPTUAL & DINÁMICA
            </h3>

            {/* Toggle Modo Distancia (Distance Aware) */}
            <div className="flex items-center space-x-2 bg-tactical-850 px-3 py-1.5 rounded-lg border border-tactical-700">
              <Target className="w-3.5 h-3.5 text-tactical-accent shrink-0" />
              <span className="text-[11px] font-mono text-slate-300 font-bold">
                Modo Distancia:
              </span>
              <button
                onClick={handleToggleDistanceAware}
                title={
                  distanceAware
                    ? "Compresión suave (-12 dB): Preserva la atenuación de volumen por distancia para calcular la lejanía exacta de pasos y disparos."
                    : "Compresión agresiva (-24 dB): Máximo realce de volumen en pasos lejanos a expensas de la percepción de profundidad."
                }
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  distanceAware
                    ? "bg-tactical-accent text-tactical-900 shadow-sm shadow-tactical-accent/30"
                    : "bg-tactical-800 text-slate-400 hover:text-slate-200 border border-tactical-700"
                }`}
              >
                {distanceAware ? "ON (-12 dB SUAVE)" : "OFF (-24 dB AGRESIVO)"}
              </button>
            </div>
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
            <span>MMCSS: AUDITADO</span>
          </div>
          <span>•</span>
          <div className="flex items-center space-x-1">
            <Radio className="w-3 h-3 text-slate-400" />
            <span>HOTKEY: CTRL+SHIFT+C</span>
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

      {/* Welcome Setup Modal */}
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
