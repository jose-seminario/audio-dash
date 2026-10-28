import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SliderValues,
  ProfileType,
  DependencyStatus,
  SystemAuditResult,
  HrtfProfile,
  AudioDevice,
} from "./types/audio";
import { AudioSliders } from "./components/AudioSliders";
import { AuditModal } from "./components/AuditModal";
import { WelcomeSetup } from "./components/WelcomeSetup";
import { HeadphoneSearch } from "./components/HeadphoneSearch";
import { InGameGuideModal } from "./components/InGameGuideModal";
import { VirtualCableModal } from "./components/VirtualCableModal";
import {
  Volume2,
  RefreshCw,
  Cpu,
  Gamepad2,
  SlidersHorizontal,
  Info,
  Radio,
  Sparkles,
  Target,
  Sliders,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Zap,
  AlertOctagon,
  Layers,
  Headphones,
  FlaskConical,
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
      all_optimal: true,
      timestamp: new Date().toLocaleTimeString(),
      checks: [
        {
          id: "sample_rate",
          name: "Formato y Muestreo de Audio",
          status: "optimal",
          current_value: "24 bits, 48000 Hz",
          recommended: "24 bits, 48000 Hz",
          description: "Formato de estudio táctico sin remuestreo.",
        },
        {
          id: "spatial_sound",
          name: "Sonido Espacial de Windows",
          status: "optimal",
          current_value: "Desactivado (Estéreo Puro)",
          recommended: "Desactivado",
          description: "Señal estéreo directa.",
        },
      ],
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
  if (cmd === "get_audio_devices") {
    return [
      {
        id: "{mock-cable-guid}",
        name: "CABLE Input (VB-Audio Virtual Cable)",
        endpoint_name: "CABLE Input",
        is_virtual_cable: true,
      },
      {
        id: "{mock-realtek-guid}",
        name: "Altavoces (Realtek(R) Audio)",
        endpoint_name: "Altavoces",
        is_virtual_cable: false,
      },
    ] as unknown as T;
  }
  if (cmd === "route_game_to_virtual_cable") {
    return "Call of Duty no está abierto. Sigue las instrucciones del asistente." as unknown as T;
  }
  if (cmd === "open_app_volume_settings" || cmd === "open_sound_control_panel") {
    return true as unknown as T;
  }
  return true as unknown as T;
}

const HRTF_OPTIONS: HrtfProfile[] = [
  {
    id: "stereo_direct",
    name: "Estéreo Directo (Bypass 3D)",
    brand: "Puro",
    description: "Audio 1:1 original sin procesado convolutivo",
    filename: "",
  },
  {
    id: "sennheiser_gsx",
    name: "Sennheiser GSX 1000 (Radar FPS 7.1)",
    brand: "EPOS",
    description: "Máxima precisión en pasos traseros y ángulos de 45°",
    filename: "sennheiser_gsx.wav",
  },
  {
    id: "waves_nx",
    name: "Waves Nx (Virtualización 3D)",
    brand: "Waves",
    description: "Separación tridimensional sin distorsión",
    filename: "waves_nx.wav",
  },
  {
    id: "dts_headphone_x",
    name: "DTS Headphone:X (Escenario Táctico)",
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

type ActiveTab = "perfil" | "calidad" | "optimizacion";

export const App: React.FC = () => {
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<ActiveTab>("perfil");

  // Profiles and active mode state
  const [activeProfile, setActiveProfile] = useState<ProfileType>("JUEGOS");

  // Audio Devices & Routing (Warzone Isolation & Test Mode)
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [showCableModal, setShowCableModal] = useState<boolean>(false);
  const [routingNotice, setRoutingNotice] = useState<string | null>(null);

  // Per-profile slider values
  const [gameSliders, setGameSliders] = useState<SliderValues>(DEFAULT_GAME_SLIDERS);
  const [normalSliders, setNormalSliders] = useState<SliderValues>(DEFAULT_NORMAL_SLIDERS);

  // Hardware AutoEQ Profile
  const [selectedHeadphoneId, setSelectedHeadphoneId] = useState<string>("flat");

  // HeSuVi HRTF Positional Audio Profile (Audio 3D)
  const [selectedHrtf, setSelectedHrtf] = useState<string>("sennheiser_gsx.wav");

  // Clutch Mode state (Hotkeyed via Ctrl+Shift+C)
  const [isClutchActive, setIsClutchActive] = useState<boolean>(false);

  // Distance Aware mode state
  const [distanceAware, setDistanceAware] = useState<boolean>(false);
  const distanceAwareRef = useRef(distanceAware);
  distanceAwareRef.current = distanceAware;

  // A/B Testing comparison state (Temporary bypass while mouse down)
  const [isAbBypassActive, setIsAbBypassActive] = useState<boolean>(false);

  // Modals state
  const [dependencyStatus, setDependencyStatus] = useState<DependencyStatus | null>(null);
  const [showWelcome, setShowWelcome] = useState<boolean>(false);
  const [isAuditOpen, setIsAuditOpen] = useState<boolean>(false);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [auditData, setAuditData] = useState<SystemAuditResult | null>(null);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [showPanicConfirm, setShowPanicConfirm] = useState<boolean>(false);
  const [tabFeedbackMessage, setTabFeedbackMessage] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const activeSliders = activeProfile === "JUEGOS" ? gameSliders : normalSliders;

  // Refs for stable event callbacks and listeners
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

  const selectedDeviceRef = useRef(selectedDevice);
  selectedDeviceRef.current = selectedDevice;

  const isTestModeRef = useRef(isTestMode);
  isTestModeRef.current = isTestMode;

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasVirtualCable = audioDevices.some((d) => d.is_virtual_cable);

  // Sync EQ configuration to backend file
  const syncEqProfile = useCallback(
    async (
      values: SliderValues,
      profile: ProfileType,
      hrtfFile?: string,
      clutch?: boolean,
      distAware?: boolean,
      device?: string,
      testMode?: boolean
    ) => {
      try {
        const { HEADPHONE_PROFILES } = await import("./data/headphones");
        const found = HEADPHONE_PROFILES.find((h) => h.id === selectedHeadphoneIdRef.current);
        const filters = found ? found.filters : [];

        const hrtf = hrtfFile !== undefined ? hrtfFile : selectedHrtfRef.current;
        const cl = clutch !== undefined ? clutch : isClutchActiveRef.current;
        const dist = distAware !== undefined ? distAware : distanceAwareRef.current;
        const targetDev = device !== undefined ? device : selectedDeviceRef.current;
        const isTest = testMode !== undefined ? testMode : isTestModeRef.current;

        await tauriInvoke("update_eq_profile", {
          sliderValues: values,
          profile: profile,
          headphoneFilters: filters,
          hrtfFilename: hrtf || null,
          isClutch: cl,
          distanceAware: dist,
          selectedDevice: targetDev || null,
          testMode: isTest,
        });

        // Limpiar advertencia si la sincronización fue exitosa
        setPermissionError(null);
      } catch (err) {
        console.error("Error sincronizando archivo de EQ:", err);
        const errStr = String(err);
        if (
          errStr.includes("PERMISSION_DENIED") ||
          errStr.includes("Administrador") ||
          errStr.includes("Access is denied") ||
          errStr.includes("denied")
        ) {
          setPermissionError(
            "No se pudo actualizar el audio. Reabre Audio Dash como Administrador"
          );
        } else {
          setPermissionError(`Error de sincronización: ${errStr}`);
        }
      }
    },
    []
  );

  // Trigger audio refresh
  const triggerAudioRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await tauriInvoke("force_audio_refresh");
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

  const loadAudioDevices = useCallback(async () => {
    try {
      const devices = await tauriInvoke<AudioDevice[]>("get_audio_devices");
      if (Array.isArray(devices) && devices.length > 0) {
        setAudioDevices(devices);
        const cable = devices.find((d) => d.is_virtual_cable);
        if (cable) {
          const defaultDev = cable.endpoint_name || cable.name;
          setSelectedDevice((prev) => prev || defaultDev);
          selectedDeviceRef.current = selectedDeviceRef.current || defaultDev;
        } else if (devices.length > 0) {
          const defaultDev = devices[0].endpoint_name || devices[0].name;
          setSelectedDevice((prev) => prev || defaultDev);
          selectedDeviceRef.current = selectedDeviceRef.current || defaultDev;
        }
      }
    } catch (e) {
      console.warn("Error cargando dispositivos de audio:", e);
    }
  }, []);

  const handleDeviceChange = (dev: string) => {
    setSelectedDevice(dev);
    selectedDeviceRef.current = dev;
    const values =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(
      values,
      activeProfileRef.current,
      selectedHrtfRef.current,
      isClutchActiveRef.current,
      distanceAwareRef.current,
      dev,
      isTestModeRef.current
    );
    triggerAudioRefresh();
  };

  const handleToggleTestMode = () => {
    const nextVal = !isTestMode;
    setIsTestMode(nextVal);
    isTestModeRef.current = nextVal;
    const values =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(
      values,
      activeProfileRef.current,
      selectedHrtfRef.current,
      isClutchActiveRef.current,
      distanceAwareRef.current,
      selectedDeviceRef.current,
      nextVal
    );
    triggerAudioRefresh();
  };

  const handleOpenAppVolume = async () => {
    try {
      await tauriInvoke("open_app_volume_settings");
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenSoundControl = async () => {
    try {
      await tauriInvoke("open_sound_control_panel");
    } catch (e) {
      console.error(e);
    }
  };

  const handleAutoRouteGame = async () => {
    try {
      await tauriInvoke("route_game_to_virtual_cable");
      setRoutingNotice("Warzone asignado a CABLE Input exitosamente.");
      setTimeout(() => setRoutingNotice(null), 6000);
    } catch (e) {
      setRoutingNotice(String(e));
      setTimeout(() => setRoutingNotice(null), 6000);
    }
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
        distanceAwareRef.current,
        selectedDeviceRef.current,
        isTestModeRef.current
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
    syncEqProfile(
      values,
      activeProfileRef.current,
      undefined,
      undefined,
      nextVal,
      selectedDeviceRef.current,
      isTestModeRef.current
    );
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
        selectedDevice: null,
        testMode: true,
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
      syncEqProfile(
        currentVals,
        activeProfileRef.current,
        selectedHrtfRef.current,
        isClutchActiveRef.current,
        distanceAwareRef.current,
        selectedDeviceRef.current,
        isTestModeRef.current
      );
      await tauriInvoke("force_audio_refresh");
    } catch (err) {
      console.error("Error restaurando perfil tras A/B:", err);
    }
  };

  // Restore factory defaults (Panic Button)
  const handlePanicRestore = async () => {
    setIsRestoring(true);
    setShowPanicConfirm(false);
    setTabFeedbackMessage(null);
    try {
      const success = await tauriInvoke<boolean>("restore_defaults");
      if (success) {
        setTabFeedbackMessage("Estado de fábrica restaurado con éxito. Se desactivaron todas las optimizaciones.");
        runAudit();
        triggerAudioRefresh();
      } else {
        setTabFeedbackMessage("La restauración fue cancelada en el diálogo de administrador.");
      }
    } catch (e) {
      setTabFeedbackMessage(`Error al restaurar: ${String(e)}`);
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    checkDependencies();
    runAudit();
    loadAudioDevices();
    tauriInvoke("ensure_vst_plugin_installed").catch(() => {});
    if (selectedHrtf) {
      tauriInvoke("ensure_hrir_installed", { filename: selectedHrtf }).catch(() => {});
    }
    syncEqProfile(activeSliders, activeProfile);
  }, []);

  // Listen to background clutch toggle events (hotkey Ctrl+Shift+C)
  useEffect(() => {
    let unlistenClutch: (() => void) | undefined;
    let isMounted = true;

    (async () => {
      if (
        typeof window !== "undefined" &&
        (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
      ) {
        try {
          const { listen } = await import("@tauri-apps/api/event");

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
              distanceAwareRef.current,
              selectedDeviceRef.current,
              isTestModeRef.current
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
      debounceTimerRef.current = setTimeout(async () => {
        await syncEqProfile(updated, "JUEGOS");
        triggerAudioRefresh();
      }, 75);
    } else {
      const updated = { ...normalSliders, [key]: val };
      setNormalSliders(updated);
      normalSlidersRef.current = updated;

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        await syncEqProfile(updated, "NORMAL");
        triggerAudioRefresh();
      }, 75);
    }
  };

  const handleSliderRelease = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const currentValues =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    await syncEqProfile(currentValues, activeProfileRef.current);
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
    <div className="h-screen max-h-screen bg-tactical-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="shrink-0 px-6 py-3.5 bg-tactical-850 border-b border-tactical-700 flex items-center justify-between">
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
                v1.4.0 OPEN SOURCE
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              OPTIMIZADOR DE AUDIO TÁCTICO PARA JUGADORES
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {/* In-Game Guide Button (ℹ️) */}
          <button
            onClick={() => setIsGuideOpen(true)}
            title="Ver configuración recomendada dentro de Warzone / Call of Duty"
            className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-750 border border-tactical-accent/40 text-xs font-mono font-bold text-tactical-accent flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Guía Warzone</span>
          </button>

          {/* Clutch Mode Trigger */}
          <button
            onClick={handleToggleClutch}
            title="Modo Clutch: Silencia Discord al 10% y sube al máximo los pasos rivales (+8 dB). Atajo: Ctrl+Shift+C"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all ${
              isClutchActive
                ? "bg-tactical-alert text-white border-white animate-pulse shadow-md shadow-tactical-alert/40"
                : "bg-tactical-800 hover:bg-tactical-700 border-tactical-alert/40 text-tactical-alert"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isClutchActive ? "CLUTCH [ACTIVO]" : "MODO CLUTCH"}</span>
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
            title="Mantén presionado para escuchar el audio original sin efectos (Bypass)"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center space-x-1.5 transition-all cursor-pointer select-none ${
              isAbBypassActive
                ? "bg-amber-500 text-tactical-900 border-amber-300 shadow-md shadow-amber-500/40 animate-pulse scale-95"
                : "bg-tactical-800 hover:bg-tactical-700 border-amber-400/40 text-amber-300"
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{isAbBypassActive ? "AUDIO ORIGINAL" : "PROBAR A/B"}</span>
          </button>

          {/* Refresh Audio Button */}
          <button
            onClick={triggerAudioRefresh}
            disabled={isRefreshing}
            title="Forzar actualización inmediata del ecualizador"
            className="p-2 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-slate-200 flex items-center justify-center transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-tactical-accent ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </header>

      {/* Main 3-Tab Navigation Bar */}
      <nav className="shrink-0 px-6 border-b border-tactical-700 bg-tactical-850/90 flex items-center justify-between">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("perfil")}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === "perfil"
                ? "border-tactical-accent text-tactical-accent bg-tactical-800/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
            <span>1. PERFIL DE JUEGO</span>
          </button>

          <button
            onClick={() => setActiveTab("calidad")}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === "calidad"
                ? "border-tactical-accent text-tactical-accent bg-tactical-800/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>2. CALIDAD DE SONIDO</span>
          </button>

          <button
            onClick={() => setActiveTab("optimizacion")}
            className={`px-4 py-3 text-xs font-mono font-bold border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === "optimizacion"
                ? "border-tactical-accent text-tactical-accent bg-tactical-800/50"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span>3. OPTIMIZACIÓN DE WINDOWS</span>
          </button>
        </div>

        {/* Friendly Routing Status Badge */}
        <div className="hidden sm:flex items-center space-x-2 font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isTestMode
                ? "bg-amber-400 animate-pulse"
                : hasVirtualCable
                ? "bg-tactical-green animate-pulse"
                : "bg-tactical-accent"
            }`}
          ></span>
          <span
            className={
              isTestMode
                ? "text-amber-400 font-bold"
                : hasVirtualCable
                ? "text-tactical-green font-bold"
                : "text-slate-300"
            }
          >
            {isTestMode
              ? "Prueba Activa (Todo el Sistema)"
              : `Filtros en: ${selectedDevice || "Salida Principal"}`}
          </span>
        </div>
      </nav>

      {/* Permission Denied Alert Toast */}
      {permissionError && (
        <div className="shrink-0 px-6 py-3 bg-red-950/80 border-b border-red-500/80 text-white flex items-center justify-between shadow-2xl animate-in slide-in-from-top-1 duration-150 z-40">
          <div className="flex items-center space-x-3">
            <div className="p-1 rounded-md bg-red-600/30 text-red-400 border border-red-500/50">
              <AlertOctagon className="w-5 h-5 text-red-400 shrink-0" />
            </div>
            <div className="text-xs font-mono">
              <span className="font-bold text-red-300 uppercase mr-2 tracking-wide">
                [Acceso Denegado]
              </span>
              <span className="text-white font-semibold">{permissionError}</span>
            </div>
          </div>
          <button
            onClick={() => setPermissionError(null)}
            className="px-3 py-1 rounded bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-xs font-mono text-slate-200 transition-colors shadow-sm"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 min-h-0 px-6 pt-6 pb-8 max-w-5xl w-full mx-auto space-y-4 overflow-y-auto">
        {/* TAB 1: PERFIL DE JUEGO */}
        {activeTab === "perfil" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Friendly Game & Device Routing Status Banner */}
            <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono uppercase text-slate-400">
                    Aislamiento Táctico de Audio:
                  </span>
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded bg-tactical-900 border ${
                      isTestMode
                        ? "text-amber-400 border-amber-500/40"
                        : hasVirtualCable
                        ? "text-tactical-green border-tactical-green/40 shadow-sm"
                        : "text-tactical-accent border-tactical-accent/40"
                    }`}
                  >
                    {isTestMode
                      ? "MODO DE PRUEBA (GLOBAL)"
                      : selectedDevice || "Dispositivo Estándar"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  {isTestMode
                    ? "⚠️ Modo de prueba activo. Filtros tácticos reproduciéndose en todo el sistema para testear."
                    : hasVirtualCable
                    ? `✓ Warzone aislado en '${selectedDevice || "CABLE Input"}'. Discord y Windows suenan sin compresión ni distorsión.`
                    : "Para aislar Discord de los filtros de Warzone, recomendamos configurar VB-Cable en la pestaña 'Calidad de Sonido'."}
                </p>
              </div>

              {/* Profile switch (Juegos / Normal) */}
              <div className="flex items-center p-1 rounded-lg bg-tactical-900 border border-tactical-700 text-xs font-mono shrink-0">
                <button
                  onClick={() => {
                    setActiveProfile("JUEGOS");
                    activeProfileRef.current = "JUEGOS";
                    syncEqProfile(gameSlidersRef.current, "JUEGOS");
                    triggerAudioRefresh();
                  }}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeProfile === "JUEGOS"
                      ? "bg-tactical-accent text-tactical-900 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Perfil Juegos
                </button>
                <button
                  onClick={() => {
                    setActiveProfile("NORMAL");
                    activeProfileRef.current = "NORMAL";
                    syncEqProfile(normalSlidersRef.current, "NORMAL");
                    triggerAudioRefresh();
                  }}
                  className={`px-3 py-1 rounded transition-colors ${
                    activeProfile === "NORMAL"
                      ? "bg-tactical-accent text-tactical-900 font-bold"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Perfil Normal
                </button>
              </div>
            </div>

            {/* Quick Tactical Controls Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Volumen Maestro */}
              <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-slate-300" />
                    Volumen Maestro
                  </span>
                  <span className="text-xs font-mono text-tactical-accent font-bold">
                    {activeSliders.maestro} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={0}
                  step={0.5}
                  value={activeSliders.maestro}
                  onChange={(e) => handleSliderChange("maestro", parseFloat(e.target.value))}
                  onMouseUp={handleSliderRelease}
                  className="w-full"
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  Ajuste de ganancia general con protección anti-clipping.
                </p>
              </div>

              {/* Card 2: Nivelador de Pasos y Disparos */}
              <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-accent/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-tactical-accent" />
                    Nivelador de Pasos
                  </span>
                  <span className="text-xs font-mono text-tactical-accent font-bold">
                    {activeSliders.compresion}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={activeSliders.compresion}
                  onChange={(e) => handleSliderChange("compresion", parseFloat(e.target.value))}
                  onMouseUp={handleSliderRelease}
                  className="w-full"
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  Eleva pasos débiles y contiene el volumen de disparos.
                </p>
              </div>

              {/* Card 3: Silenciar mis disparos */}
              <div className="p-4 rounded-xl bg-tactical-850 border border-amber-400/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-amber-400" />
                    Mis Disparos
                  </span>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {activeSliders.atenuacionPropia} dB
                  </span>
                </div>
                <input
                  type="range"
                  min={-12}
                  max={0}
                  step={0.5}
                  value={activeSliders.atenuacionPropia}
                  onChange={(e) => handleSliderChange("atenuacionPropia", parseFloat(e.target.value))}
                  onMouseUp={handleSliderRelease}
                  className="w-full"
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  Amortigua tu propia arma para no tapar los pasos rivales.
                </p>
              </div>
            </div>

            {/* Jump to Fine Tuning Banner */}
            <div className="p-4 rounded-xl bg-tactical-800/80 border border-tactical-700 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <SlidersHorizontal className="w-5 h-5 text-tactical-accent shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-100 font-mono">
                    CALIBRACIÓN PRECISA DE AURICULARES & AUDIO 3D
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Ajusta tu modelo de auriculares, el radar 3D y los 7 filtros tácticos en la pestaña de Calidad.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("calidad")}
                className="px-3 py-1.5 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 text-xs font-mono font-bold transition-all shrink-0"
              >
                Personalizar Sonido ➔
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: CALIDAD DE SONIDO */}
        {activeTab === "calidad" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Test Mode Banner Alert */}
            {isTestMode && (
              <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200 animate-in fade-in duration-150">
                <div className="flex items-start sm:items-center space-x-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="text-xs font-mono font-bold block text-amber-300">
                      ⚠️ MODO DE PRUEBA ACTIVO: FILTROS APLICADOS A TODO EL SISTEMA
                    </span>
                    <span className="text-[11px] text-slate-300 block">
                      Los filtros de pasos, compresión dinámica y limitador se están aplicando globalmente. Abre YouTube o Spotify para calibrar.
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleToggleTestMode}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-tactical-900 font-mono text-xs font-bold shrink-0 transition-colors shadow-sm"
                >
                  Desactivar Modo de Prueba
                </button>
              </div>
            )}

            {/* Audio Routing & Warzone Isolation Panel */}
            <section className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 space-y-3.5 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-tactical-800 text-tactical-accent border border-tactical-700">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-slate-100 flex items-center gap-2">
                      ENRUTAMIENTO DE AUDIO (AISLAMIENTO DE WARZONE)
                      {hasVirtualCable && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-tactical-green/20 text-tactical-green border border-tactical-green/40 font-normal">
                          VB-CABLE ACTIVO
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Aplica el ecualizador y compresor únicamente a Call of Duty; Discord y tu navegador se mantienen intactos.
                    </p>
                  </div>
                </div>

                {/* Test Mode Switch button */}
                <button
                  onClick={handleToggleTestMode}
                  title="Activa el modo de prueba para escuchar los filtros en YouTube o Spotify"
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shrink-0 border ${
                    isTestMode
                      ? "bg-amber-500 text-tactical-900 border-amber-400 shadow-md shadow-amber-500/30"
                      : "bg-tactical-800 hover:bg-tactical-750 text-slate-300 border-tactical-600"
                  }`}
                >
                  <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isTestMode ? "MODO DE PRUEBA [ON]" : "PROBAR EN YOUTUBE"}</span>
                </button>
              </div>

              {/* Selector and Actions */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                <div className="md:col-span-7 flex flex-col space-y-1">
                  <label className="text-[11px] font-mono text-slate-400">
                    Dispositivo filtrado por Equalizer APO:
                  </label>
                  <div className="relative">
                    <select
                      value={selectedDevice}
                      onChange={(e) => handleDeviceChange(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-tactical-900 border border-tactical-600 text-xs font-mono text-slate-200 focus:outline-none focus:border-tactical-accent transition-colors"
                    >
                      {audioDevices.length === 0 ? (
                        <option value="">Cargando dispositivos de audio...</option>
                      ) : (
                        audioDevices.map((dev) => (
                          <option
                            key={dev.id}
                            value={dev.endpoint_name || dev.name}
                          >
                            {dev.name} {dev.is_virtual_cable ? "⭐ (Recomendado)" : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="md:col-span-5 flex items-end space-x-2 pt-1 md:pt-5">
                  <button
                    onClick={() => setShowCableModal(true)}
                    className="flex-1 px-3 py-2 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 font-mono text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    <span>Aislar Warzone (Cable)</span>
                  </button>

                  <button
                    onClick={handleAutoRouteGame}
                    title="Intenta reasignar la salida de cod.exe automáticamente a CABLE Input"
                    className="px-3 py-2 rounded-lg bg-tactical-800 hover:bg-tactical-750 border border-tactical-600 text-xs font-mono text-slate-300 flex items-center justify-center transition-colors"
                  >
                    <span>Auto-Enrutar</span>
                  </button>
                </div>
              </div>

              {/* Notice Message if any */}
              {routingNotice && (
                <div className="p-2.5 rounded-lg bg-tactical-900 border border-tactical-accent/40 text-xs text-tactical-accent font-mono">
                  {routingNotice}
                </div>
              )}

              {/* Status footer pill */}
              <div className="p-2.5 rounded-lg bg-tactical-900/80 border border-tactical-750 flex flex-wrap items-center justify-between text-[11px] font-mono gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-400">Destino de Filtros:</span>
                  <span className="text-tactical-accent font-bold">
                    {isTestMode ? "TODO EL SISTEMA (Modo de Prueba)" : selectedDevice || "Dispositivo no seleccionado"}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-slate-400">
                  <span>Discord & Navegador:</span>
                  <span className="text-tactical-green font-bold">
                    {hasVirtualCable && !isTestMode ? "100% Intacto (Salida Directa)" : "Compartido"}
                  </span>
                </div>
              </div>
            </section>

            {/* Top Selectors: AutoEQ Search + 3D Spatial Radar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Headphone Real-time Search */}
              <section className="p-3.5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                    1. Tu Modelo de Auriculares (AutoEQ)
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Curva de fábrica neutralizada</span>
                </div>
                <HeadphoneSearch
                  selectedId={selectedHeadphoneId}
                  onSelect={handleHeadphoneChange}
                />
              </section>

              {/* 3D Audio Positional Radar (HeSuVi 7.1) */}
              <section className="p-3.5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-tactical-green" />
                    2. Audio 3D (Radar Espacial)
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">Convolución HeSuVi 7.1</span>
                </div>
                <select
                  value={selectedHrtf}
                  onChange={(e) => handleHrtfChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-tactical-900 border border-tactical-600 text-xs font-mono text-slate-200 focus:outline-none focus:border-tactical-green transition-colors"
                >
                  {HRTF_OPTIONS.map((hrtf) => (
                    <option key={hrtf.id} value={hrtf.filename}>
                      {hrtf.name}
                    </option>
                  ))}
                </select>
              </section>
            </div>

            {/* Distance Aware Mode Switch */}
            <div className="p-3.5 rounded-xl bg-tactical-850 border border-tactical-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-tactical-accent" />
                  <span className="text-xs font-mono font-bold text-slate-200">
                    Modo Percepción de Distancia (Distance Aware)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {distanceAware
                    ? "Compresión suave activada (-12 dB): Conserva el decaimiento de volumen para que calcules por el oído a qué distancia exacta viene el enemigo."
                    : "Compresión agresiva activada (-24 dB): Máximo volumen posible en pasos lejanos a expensas de la sensación de distancia."}
                </p>
              </div>

              <button
                onClick={handleToggleDistanceAware}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
                  distanceAware
                    ? "bg-tactical-accent text-tactical-900 shadow-md shadow-tactical-accent/20"
                    : "bg-tactical-800 text-slate-400 hover:text-slate-200 border border-tactical-700"
                }`}
              >
                {distanceAware ? "DISTANCIA ACTIVA (-12 dB)" : "PASOS LEJANOS (-24 dB)"}
              </button>
            </div>

            {/* Complete Sliders Engine */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-mono tracking-wider text-slate-200 flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-tactical-accent" />
                  CONTROLES TÁCTICOS AMIGABLES
                </h3>
                <span className="text-[11px] font-mono text-slate-400">
                  Pasa el mouse sobre (?) para ver qué hace cada control
                </span>
              </div>

              <AudioSliders
                values={activeSliders}
                onChange={handleSliderChange}
                onRelease={handleSliderRelease}
                disabled={activeProfile === "NORMAL"}
              />
            </section>
          </div>
        )}

        {/* TAB 3: OPTIMIZACIÓN DE WINDOWS */}
        {activeTab === "optimizacion" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Quick Diagnostic Card */}
            <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded bg-tactical-800 text-tactical-accent border border-tactical-700">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-slate-100">
                      DIAGNÓSTICO DEL SISTEMA (SALUD DE AUDIO)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Inspección de registros, frecuencia de muestreo y reloj de Windows
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => tauriInvoke("open_windows_sound_settings")}
                    className="px-3 py-1.5 rounded bg-tactical-800 hover:bg-tactical-750 border border-tactical-600 text-xs font-mono text-slate-200 flex items-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-tactical-accent" />
                    <span>Ajustes de Sonido de Windows</span>
                  </button>

                  <button
                    onClick={() => setIsAuditOpen(true)}
                    className="px-3 py-1.5 rounded bg-tactical-accent hover:bg-cyan-400 text-tactical-900 text-xs font-mono font-bold transition-all shadow-sm"
                  >
                    Ver Auditoría Completa
                  </button>
                </div>
              </div>

              {/* Status Checklist Summary */}
              {auditData && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
                  {auditData.checks.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="p-2.5 rounded-lg bg-tactical-900/80 border border-tactical-750 flex items-start space-x-2"
                    >
                      {c.status === "optimal" ? (
                        <CheckCircle2 className="w-4 h-4 text-tactical-green shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-tactical-warning shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold text-slate-200 block text-[11px]">{c.name}</span>
                        <span className="text-[10px] text-slate-400 block">{c.current_value}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Elite Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-2">
                <span className="text-xs font-bold font-mono text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-tactical-green" />
                  Optimizar procesador para audio
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Fija el proceso de aislamiento de audio (`audiodg.exe`) a los núcleos físicos de rendimiento (P-Cores) para evitar micro-cortes.
                </p>
                <button
                  onClick={async () => {
                    const msg = await tauriInvoke<string>("apply_audiodg_affinity");
                    setTabFeedbackMessage(msg);
                  }}
                  className="w-full py-1.5 px-3 rounded bg-tactical-800 hover:bg-tactical-750 border border-tactical-green/40 text-xs font-mono text-tactical-green flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>ANCLAR A NÚCLEOS P-CORE</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-2">
                <span className="text-xs font-bold font-mono text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-tactical-accent" />
                  Prioridad Máxima de Audio (Anti-Lag)
                </span>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Configura SystemResponsiveness = 0 y elimina el estrangulamiento de paquetes de red durante el juego vía UAC.
                </p>
                <button
                  onClick={async () => {
                    const success = await handleRequestOptimization();
                    if (success) {
                      setTabFeedbackMessage("Prioridad máxima MMCSS y red sin límite aplicadas con éxito.");
                      runAudit();
                    }
                  }}
                  className="w-full py-1.5 px-3 rounded bg-tactical-800 hover:bg-tactical-750 border border-tactical-accent/40 text-xs font-mono text-tactical-accent flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>APLICAR ANTI-LAG (UAC)</span>
                </button>
              </div>
            </div>

            {/* RED PANIC BUTTON / ROLLBACK CARD */}
            <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-alert/40 space-y-3">
              <div className="flex items-center space-x-2 text-tactical-alert font-bold text-xs font-mono">
                <AlertOctagon className="w-4 h-4" />
                <span>BOTÓN DE PÁNICO (RESTAURACIÓN TOTAL DE FÁBRICA)</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Si alguna vez deseas dejar tu computadora exactamente como estaba antes de usar Audio Dash: este botón restablece el ecualizador a modo neutral (`Preamp: 0.0 dB`), devuelve el registro de Windows y el plan de energía a sus valores originales respaldados y desancla el procesador.
              </p>

              {!showPanicConfirm ? (
                <button
                  onClick={() => setShowPanicConfirm(true)}
                  className="px-4 py-2 rounded-lg bg-tactical-alert/20 hover:bg-tactical-alert/30 border border-tactical-alert/60 text-xs font-mono font-bold text-tactical-alert flex items-center space-x-2 transition-all shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>REVERTIR Y RESTAURAR ESTADO DE FÁBRICA</span>
                </button>
              ) : (
                <div className="p-3 rounded-lg bg-tactical-900 border border-tactical-alert flex items-center justify-between gap-3 animate-in zoom-in-95 duration-100">
                  <span className="text-xs font-mono text-slate-200">
                    ¿Confirmas volver al estado original de fábrica de Windows?
                  </span>
                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => setShowPanicConfirm(false)}
                      className="px-3 py-1 rounded text-xs font-mono bg-tactical-800 text-slate-300 hover:bg-tactical-700"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handlePanicRestore}
                      disabled={isRestoring}
                      className="px-3 py-1 rounded text-xs font-mono font-bold bg-tactical-alert hover:bg-red-600 text-white shadow-md shadow-tactical-alert/40"
                    >
                      {isRestoring ? "Restaurando..." : "Sí, Restaurar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback message banner */}
            {tabFeedbackMessage && (
              <div className="p-3 rounded-lg bg-tactical-800 border border-tactical-accent/40 text-xs text-tactical-accent font-mono">
                {tabFeedbackMessage}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Bar */}
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

      {/* In-Game Settings Guide Modal */}
      <InGameGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

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

      {/* Virtual Cable Isolation Setup Modal */}
      <VirtualCableModal
        isOpen={showCableModal}
        onClose={() => setShowCableModal(false)}
        hasVirtualCable={hasVirtualCable}
        selectedDevice={selectedDevice}
        onOpenAppVolumeSettings={handleOpenAppVolume}
        onOpenSoundControlPanel={handleOpenSoundControl}
      />
    </div>
  );
};
