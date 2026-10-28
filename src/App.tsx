import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  SliderValues,
  ProfileType,
  DependencyStatus,
  SystemAuditResult,
  HrtfProfile,
  AudioDevice,
  ProcessScanResult,
} from "./types/audio";
import { AudioSliders } from "./components/AudioSliders";
import { AuditModal } from "./components/AuditModal";
import { WelcomeSetup } from "./components/WelcomeSetup";
import { HeadphoneSearch } from "./components/HeadphoneSearch";
import { InGameGuideModal } from "./components/InGameGuideModal";
import { VirtualCableModal } from "./components/VirtualCableModal";
import { CustomGameModal } from "./components/CustomGameModal";
import {
  Volume2,
  RefreshCw,
  Cpu,
  Gamepad2,
  Info,
  Radio,
  Sparkles,
  Target,
  Sliders,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  AlertOctagon,
  Layers,
  Headphones,
  Plus,
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
  if (cmd === "scan_running_game_now") {
    return {
      process_name: "cod.exe",
      window_title: "Call of Duty® HQ",
      is_game: true,
      matched_by: "cod_family",
    } as unknown as T;
  }
  if (cmd === "get_running_processes_list") {
    return ["cod.exe", "Discord.exe", "Spotify.exe", "chrome.exe"] as unknown as T;
  }
  if (cmd === "get_custom_game_exes") {
    return [] as unknown as T;
  }
  if (cmd === "add_custom_game_exe") {
    return [(args?.exe_name as string) || "game.exe"] as unknown as T;
  }
  if (cmd === "get_audio_devices") {
    return [
      {
        id: "cable_input",
        name: "CABLE Input (VB-Audio Virtual Cable)",
        endpoint_name: "CABLE Input",
        is_virtual_cable: true,
      },
      {
        id: "speakers",
        name: "Altavoces (Realtek Audio)",
        endpoint_name: "Altavoces",
        is_virtual_cable: false,
      },
    ] as unknown as T;
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
    name: "Waves Nx (Estudio Virtual)",
    brand: "Waves",
    description: "Separación acústica tridimensional de sala controlada",
    filename: "waves_nx.wav",
  },
  {
    id: "dts_headphone_x",
    name: "DTS Headphone:X (Escenario Táctico)",
    brand: "DTS",
    description: "Campo sonoro expandido para detección temprana de vehículos",
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

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return { ...fallback, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore storage read errors
  }
  return fallback;
}

function loadStoredString(key: string, fallback: string): string {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val : fallback;
  } catch {
    return fallback;
  }
}

export const App: React.FC = () => {
  // Navigation Tabs state
  const [activeTab, setActiveTab] = useState<ActiveTab>("perfil");

  // Active profile state
  const [activeProfile, setActiveProfile] = useState<ProfileType>("JUEGOS");

  // Real-time Dynamic Game Detection state
  const [currentProcess, setCurrentProcess] = useState<string>("Buscando juego...");
  const [isGameActive, setIsGameActive] = useState<boolean>(false);
  const [gameMatchDetail, setGameMatchDetail] = useState<string>("none");
  const [isScanningGame, setIsScanningGame] = useState<boolean>(false);
  const [showCustomGameModal, setShowCustomGameModal] = useState<boolean>(false);
  const [customGameList, setCustomGameList] = useState<string[]>([]);
  const [runningProcessList, setRunningProcessList] = useState<string[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState<boolean>(false);

  // Audio Devices & Routing (Warzone Isolation & Test Mode)
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>(() =>
    loadStoredString("audiodash_device", "")
  );
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [showCableModal, setShowCableModal] = useState<boolean>(false);

  // Per-profile slider values (Persisted in localStorage)
  const [gameSliders, setGameSliders] = useState<SliderValues>(() =>
    loadStoredJson("audiodash_game_sliders", DEFAULT_GAME_SLIDERS)
  );
  const [normalSliders, setNormalSliders] = useState<SliderValues>(() =>
    loadStoredJson("audiodash_normal_sliders", DEFAULT_NORMAL_SLIDERS)
  );

  // Hardware AutoEQ Profile (Persisted)
  const [selectedHeadphoneId, setSelectedHeadphoneId] = useState<string>(() =>
    loadStoredString("audiodash_headphone", "flat")
  );

  // HeSuVi HRTF Positional Audio Profile (Audio 3D - Persisted)
  const [selectedHrtf, setSelectedHrtf] = useState<string>(() =>
    loadStoredString("audiodash_hrtf", "")
  );

  // Clutch Mode state (Hotkeyed via Ctrl+Shift+C)
  const [isClutchActive, setIsClutchActive] = useState<boolean>(false);

  // Distance Aware mode state (Persisted)
  const [distanceAware, setDistanceAware] = useState<boolean>(() =>
    loadStoredString("audiodash_distance_aware", "false") === "true"
  );
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
  const [isConfiguringApo, setIsConfiguringApo] = useState<boolean>(false);
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

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Core synchronization logic to write Equalizer APO config
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

        setPermissionError(null);
      } catch (err) {
        console.error("Error sincronizando archivo de EQ:", err);
        const errStr = String(err);
        setPermissionError(errStr);
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
      if (!res.equalizer_apo_installed || !res.config_linked || !res.first_run_completed) {
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

  const loadAudioDevices = useCallback(async () => {
    try {
      const devs = await tauriInvoke<AudioDevice[]>("get_audio_devices");
      setAudioDevices(devs);
    } catch (e) {
      console.warn("No se pudieron cargar dispositivos de audio:", e);
    }
  }, []);

  // Real-time Manual Game Scan Action
  const handleScanGameNow = useCallback(async () => {
    setIsScanningGame(true);
    try {
      const res = await tauriInvoke<ProcessScanResult>("scan_running_game_now");
      setCurrentProcess(res.process_name || "Sin juego activo");
      setIsGameActive(res.is_game);
      setGameMatchDetail(res.matched_by);

      if (res.is_game) {
        setActiveProfile("JUEGOS");
        activeProfileRef.current = "JUEGOS";
        syncEqProfile(
          gameSlidersRef.current,
          "JUEGOS",
          selectedHrtfRef.current,
          isClutchActiveRef.current,
          distanceAwareRef.current,
          selectedDeviceRef.current,
          isTestModeRef.current
        );
        triggerAudioRefresh();
      }
    } catch (e) {
      console.error("Error en escaneo manual:", e);
    } finally {
      setIsScanningGame(false);
    }
  }, [syncEqProfile, triggerAudioRefresh]);

  const handleLoadCustomGames = useCallback(async () => {
    try {
      const list = await tauriInvoke<string[]>("get_custom_game_exes");
      setCustomGameList(list);
    } catch (e) {
      console.error("Error cargando juegos personalizados:", e);
    }
  }, []);

  const handleOpenCustomGameModal = async () => {
    setShowCustomGameModal(true);
    setIsLoadingProcesses(true);
    try {
      const procs = await tauriInvoke<string[]>("get_running_processes_list");
      setRunningProcessList(procs);
    } catch (e) {
      console.error("Error listando procesos:", e);
    } finally {
      setIsLoadingProcesses(false);
    }
  };

  const handleRefreshProcesses = async () => {
    setIsLoadingProcesses(true);
    try {
      const procs = await tauriInvoke<string[]>("get_running_processes_list");
      setRunningProcessList(procs);
    } catch (e) {
      console.error("Error refrescando procesos:", e);
    } finally {
      setIsLoadingProcesses(false);
    }
  };

  const handleAddCustomExe = async (exe: string) => {
    const updated = await tauriInvoke<string[]>("add_custom_game_exe", { exeName: exe });
    setCustomGameList(updated);
    handleScanGameNow();
  };

  const handleRequestOptimization = async (): Promise<boolean> => {
    setIsConfiguringApo(true);
    try {
      const success = await tauriInvoke<boolean>("request_system_optimization");
      if (success) {
        setPermissionError(null);
        await checkDependencies();
        await runAudit();
        return true;
      }
      return false;
    } catch (e) {
      setPermissionError(`Error optimizando sistema: ${String(e)}`);
      return false;
    } finally {
      setIsConfiguringApo(false);
    }
  };

  const handleDeviceChange = (dev: string) => {
    setSelectedDevice(dev);
    selectedDeviceRef.current = dev;
    try {
      localStorage.setItem("audiodash_device", dev);
    } catch {
      // Ignore storage write errors
    }
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

  const handleToggleClutch = async () => {
    try {
      const newState = await tauriInvoke<boolean>("toggle_clutch_mode");
      const isNativeTauri =
        typeof window !== "undefined" &&
        Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

      // En entorno nativo Tauri, el evento 'clutch_mode_toggled' actualiza el estado y el archivo de EQ.
      if (!isNativeTauri) {
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
      }
    } catch (e) {
      console.error("Error toggling clutch mode:", e);
    }
  };

  const handleToggleDistanceAware = () => {
    const nextVal = !distanceAware;
    setDistanceAware(nextVal);
    distanceAwareRef.current = nextVal;
    try {
      localStorage.setItem("audiodash_distance_aware", String(nextVal));
    } catch {
      // Ignore storage write errors
    }
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

  // A/B Testing comparison handlers (Temporary bypass while holding mouse button down)
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
        testMode: false,
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
      await syncEqProfile(
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
        setTabFeedbackMessage("✓ Estado de fábrica de Windows restaurado con éxito.");
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
    handleLoadCustomGames();
    handleScanGameNow();
    tauriInvoke("ensure_vst_plugin_installed").catch(() => {});
    if (selectedHrtf) {
      tauriInvoke("ensure_hrir_installed", { filename: selectedHrtf }).catch(() => {});
    }
    syncEqProfile(activeSliders, activeProfile);
  }, []);

  // Listen to background clutch toggle events and dynamic game scan events
  useEffect(() => {
    let unlistenClutch: (() => void) | undefined;
    let unlistenWindow: (() => void) | undefined;
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

          // Dynamic background window & game monitor listener
          unlistenWindow = await listen<ProcessScanResult>("window_changed", (event) => {
            if (!isMounted) return;
            const res = event.payload;
            setCurrentProcess(res.process_name);
            setIsGameActive(res.is_game);
            setGameMatchDetail(res.matched_by);

            // Si se detecta un juego, conmutar automáticamente al perfil JUEGOS
            if (res.is_game && activeProfileRef.current !== "JUEGOS") {
              setActiveProfile("JUEGOS");
              activeProfileRef.current = "JUEGOS";
              syncEqProfile(
                gameSlidersRef.current,
                "JUEGOS",
                selectedHrtfRef.current,
                isClutchActiveRef.current,
                distanceAwareRef.current,
                selectedDeviceRef.current,
                isTestModeRef.current
              );
              triggerAudioRefresh();
            }
          });
        } catch (e) {
          console.warn("No se pudo registrar listener de eventos Tauri:", e);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (unlistenClutch) unlistenClutch();
      if (unlistenWindow) unlistenWindow();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [syncEqProfile, triggerAudioRefresh]);

  // Debounced slider handler with complete parameter propagation & localStorage persistence
  const handleSliderChange = (key: keyof SliderValues, val: number) => {
    if (activeProfile === "JUEGOS") {
      const updated = { ...gameSliders, [key]: val };
      setGameSliders(updated);
      gameSlidersRef.current = updated;
      try {
        localStorage.setItem("audiodash_game_sliders", JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        await syncEqProfile(
          updated,
          "JUEGOS",
          selectedHrtfRef.current,
          isClutchActiveRef.current,
          distanceAwareRef.current,
          selectedDeviceRef.current,
          isTestModeRef.current
        );
        triggerAudioRefresh();
      }, 60);
    } else {
      const updated = { ...normalSliders, [key]: val };
      setNormalSliders(updated);
      normalSlidersRef.current = updated;
      try {
        localStorage.setItem("audiodash_normal_sliders", JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        await syncEqProfile(
          updated,
          "NORMAL",
          selectedHrtfRef.current,
          isClutchActiveRef.current,
          distanceAwareRef.current,
          selectedDeviceRef.current,
          isTestModeRef.current
        );
        triggerAudioRefresh();
      }, 60);
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
    await syncEqProfile(
      currentValues,
      activeProfileRef.current,
      selectedHrtfRef.current,
      isClutchActiveRef.current,
      distanceAwareRef.current,
      selectedDeviceRef.current,
      isTestModeRef.current
    );
    triggerAudioRefresh();
  };

  const handleHeadphoneChange = (id: string) => {
    setSelectedHeadphoneId(id);
    selectedHeadphoneIdRef.current = id;
    try {
      localStorage.setItem("audiodash_headphone", id);
    } catch {
      // Ignore storage write errors
    }
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
      isTestModeRef.current
    );
    triggerAudioRefresh();
  };

  const handleHrtfChange = (filename: string) => {
    setSelectedHrtf(filename);
    selectedHrtfRef.current = filename;
    try {
      localStorage.setItem("audiodash_hrtf", filename);
    } catch {
      // Ignore storage write errors
    }
    if (filename) {
      tauriInvoke("ensure_hrir_installed", { filename }).catch(() => {});
    }
    const values =
      activeProfileRef.current === "JUEGOS"
        ? gameSlidersRef.current
        : normalSlidersRef.current;
    syncEqProfile(
      values,
      activeProfileRef.current,
      filename,
      isClutchActiveRef.current,
      distanceAwareRef.current,
      selectedDeviceRef.current,
      isTestModeRef.current
    );
    triggerAudioRefresh();
  };

  const hasVirtualCable = audioDevices.some((d) => d.is_virtual_cable);

  return (
    <div className="flex flex-col h-screen w-screen bg-tactical-900 text-slate-100 font-sans select-none overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-14 border-b border-tactical-700 bg-tactical-850 px-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-tactical-800 border border-tactical-700 text-tactical-accent shadow-sm">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold font-mono tracking-wider flex items-center gap-2">
              AUDIO DASH
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-tactical-accent/15 border border-tactical-accent/30 text-tactical-accent font-mono font-semibold">
                v1.4.0 ELITE
              </span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Optimizador de Procesamiento de Audio & Detección Psicoacústica
            </p>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center space-x-2">
          {/* 1-Click Auto-Configure Pill if APO config is pending */}
          {(!dependencyStatus?.config_linked || permissionError) && (
            <button
              onClick={handleRequestOptimization}
              disabled={isConfiguringApo}
              className="px-3 py-1.5 rounded-lg bg-tactical-accent/20 hover:bg-tactical-accent/30 border border-tactical-accent/60 text-xs font-mono font-bold text-tactical-accent flex items-center space-x-1.5 transition-all shadow-sm"
              title="Aplica permisos NTFS (icacls) y vincula Equalizer APO en 1 clic"
            >
              <Zap className={`w-3.5 h-3.5 ${isConfiguringApo ? "animate-spin" : ""}`} />
              <span>{isConfiguringApo ? "Configurando..." : "Auto-Configurar (1-Clic)"}</span>
            </button>
          )}

          {/* Warzone Ideal Settings Guide Button */}
          <button
            onClick={() => setIsGuideOpen(true)}
            title="Guía de configuración de audio recomendada para Warzone / CoD"
            className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-xs font-mono text-slate-200 flex items-center space-x-1.5 transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-tactical-accent" />
            <span className="hidden sm:inline">Guía Warzone</span>
          </button>

          {/* Clutch Mode Hotkey Button */}
          <button
            onClick={handleToggleClutch}
            title="Atenúa Discord al 10% y resalta frecuencias de pasos (Hotkey: Ctrl+Shift+C)"
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

          {/* A/B Comparison Testing Button (Protected against mouseleave and blur) */}
          <button
            onMouseDown={handleAbMouseDown}
            onMouseUp={handleAbMouseUp}
            onTouchStart={handleAbMouseDown}
            onTouchEnd={handleAbMouseUp}
            onMouseLeave={handleAbMouseUp}
            onBlur={handleAbMouseUp}
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
                : isGameActive
                ? "bg-tactical-green animate-pulse"
                : "bg-slate-500"
            }`}
          ></span>
          <span
            className={
              isTestMode
                ? "text-amber-400 font-bold"
                : isGameActive
                ? "text-tactical-green font-bold"
                : "text-slate-400"
            }
          >
            {isTestMode
              ? "Prueba Activa (Todo el Sistema)"
              : isGameActive
              ? `Juego Activo: ${currentProcess}`
              : "Esperando juego..."}
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
          <div className="flex items-center space-x-2">
            <button
              onClick={handleRequestOptimization}
              className="px-3 py-1 rounded bg-tactical-accent hover:bg-cyan-400 text-tactical-900 text-xs font-mono font-bold transition-colors shadow-sm"
            >
              Corregir Permisos (1-Clic)
            </button>
            <button
              onClick={() => setPermissionError(null)}
              className="px-2 py-1 rounded bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-xs font-mono text-slate-300"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Tab Content */}
      <main className="flex-1 min-h-0 px-6 pt-6 pb-8 max-w-5xl w-full mx-auto space-y-4 overflow-y-auto">
        {/* TAB 1: PERFIL DE JUEGO */}
        {activeTab === "perfil" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* Real-time Dynamic Game Detection & Re-scan Panel */}
            <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
              <div className="flex items-center space-x-3 min-w-0">
                <div
                  className={`p-2.5 rounded-xl border shrink-0 transition-colors ${
                    isGameActive
                      ? "bg-tactical-green/15 text-tactical-green border-tactical-green/40 shadow-sm"
                      : "bg-tactical-800 text-slate-400 border-tactical-700"
                  }`}
                >
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono uppercase text-slate-400">
                      Detección Inteligente de Juego:
                    </span>
                    <span
                      className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
                        isGameActive
                          ? "bg-tactical-green/20 text-tactical-green border border-tactical-green/40 animate-pulse"
                          : "bg-tactical-900 text-slate-400 border border-tactical-700"
                      }`}
                    >
                      {isGameActive ? "JUEGO ACTIVO" : "EN ESPERA"}
                    </span>
                  </div>
                  <h4 className="text-sm font-mono font-bold text-slate-100 flex items-center gap-1.5 mt-0.5 truncate">
                    {isGameActive ? (
                      <>
                        <span className="text-tactical-accent truncate">🎮 {currentProcess}</span>
                        <span className="text-xs text-slate-400 font-normal shrink-0">
                          ({gameMatchDetail === "cod_family" ? "Call of Duty / Warzone" : gameMatchDetail === "custom_exe" ? "Personalizado" : gameMatchDetail})
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-400 font-normal truncate">
                        {currentProcess || "Ningún juego detectado"}
                      </span>
                    )}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {isGameActive
                      ? "✓ Sincronizado en tiempo real. Modo competitivo activo."
                      : "Las perillas están activas para pruebas en escritorio o YouTube. Al abrir el juego, se sincronizará automáticamente."}
                  </p>
                </div>
              </div>

              {/* Action Buttons: Re-scan & Configure custom games */}
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  onClick={handleScanGameNow}
                  disabled={isScanningGame}
                  className="px-3.5 py-2 rounded-lg bg-tactical-800 hover:bg-tactical-750 border border-tactical-accent/40 text-xs font-mono font-bold text-tactical-accent flex items-center space-x-1.5 transition-all shadow-sm disabled:opacity-50"
                  title="Escanea inmediatamente todas las ventanas y procesos en busca de COD o cualquier shooter"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningGame ? "animate-spin" : ""}`} />
                  <span>{isScanningGame ? "Analizando..." : "Re-Analizar Juego"}</span>
                </button>

                <button
                  onClick={handleOpenCustomGameModal}
                  className="px-3 py-2 rounded-lg bg-tactical-800 hover:bg-tactical-750 border border-tactical-600 text-xs font-mono text-slate-300 hover:text-slate-100 flex items-center space-x-1.5 transition-colors"
                  title="Configurar ejecutables personalizados o elegir de la lista de procesos abiertos"
                >
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                  <span>Configurar Juegos</span>
                </button>
              </div>
            </div>

            {/* Tactical Routing Banner & Profile Switch */}
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
                      : selectedDevice || "Todos los Dispositivos (Estándar)"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  {isTestMode
                    ? "⚠️ Modo de prueba activo. Filtros tácticos reproduciéndose en todo el sistema para testear."
                    : hasVirtualCable
                    ? `✓ Warzone aislado en '${selectedDevice || "CABLE Input"}'. Discord y Windows suenan sin compresión ni distorsión.`
                    : "Filtros tácticos aplicándose a tus auriculares o altavoces predeterminados."}
                </p>
              </div>

              {/* Profile switch (Perfil Juegos / Perfil Normal) */}
              <div className="flex items-center space-x-2">
                <div className="flex items-center p-1 rounded-lg bg-tactical-900 border border-tactical-700 text-xs font-mono shrink-0">
                  <button
                    onClick={() => {
                      setActiveProfile("JUEGOS");
                      activeProfileRef.current = "JUEGOS";
                      syncEqProfile(
                        gameSlidersRef.current,
                        "JUEGOS",
                        selectedHrtfRef.current,
                        isClutchActiveRef.current,
                        distanceAwareRef.current,
                        selectedDeviceRef.current,
                        isTestModeRef.current
                      );
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
                      syncEqProfile(
                        normalSlidersRef.current,
                        "NORMAL",
                        selectedHrtfRef.current,
                        isClutchActiveRef.current,
                        distanceAwareRef.current,
                        selectedDeviceRef.current,
                        isTestModeRef.current
                      );
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
                  className="w-full accent-tactical-accent"
                />
                <p className="text-[11px] text-slate-400 leading-snug">
                  Compresión dinámica LoudMax: realza pasos débiles y amortigua disparos.
                </p>
              </div>

              {/* Card 3: Modo Distancia (Distance Aware Toggle) */}
              <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 space-y-2 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-tactical-green" />
                    Modo Distancia
                  </span>
                  <button
                    onClick={handleToggleDistanceAware}
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold transition-all ${
                      distanceAware
                        ? "bg-tactical-green text-tactical-900 border border-emerald-400"
                        : "bg-tactical-800 text-slate-400 border border-tactical-600"
                    }`}
                  >
                    {distanceAware ? "SUAVE" : "AGRESIVO"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  {distanceAware
                    ? "✓ Compresión suave para diferenciar si el rival está a 5 o 20 metros."
                    : "Compresión agresiva para máxima detección auditiva a cualquier distancia."}
                </p>
              </div>
            </div>

            {/* Sliders tácticos completos */}
            <div className="pt-2">
              <AudioSliders
                values={activeSliders}
                onChange={handleSliderChange}
                onRelease={handleSliderRelease}
                isNormalProfile={activeProfile === "NORMAL"}
              />
            </div>
          </div>
        )}

        {/* TAB 2: CALIDAD DE SONIDO */}
        {activeTab === "calidad" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* AutoEQ Hardware Profile Search */}
            <div className="p-5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-tactical-800 border border-tactical-700 text-tactical-accent">
                    <Headphones className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-slate-100">
                      Calibración de Auriculares (AutoEQ Harman)
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Compensa las deficiencias físicas de tus audífonos para una respuesta acústica plana.
                    </p>
                  </div>
                </div>
              </div>

              <HeadphoneSearch
                selectedId={selectedHeadphoneId}
                onSelect={handleHeadphoneChange}
              />
            </div>

            {/* Audio 3D / HRTF HeSuVi Spatial Radar */}
            <div className="p-5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-4 shadow-md">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-tactical-800 border border-tactical-700 text-tactical-green">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-mono text-slate-100">
                    Audio 3D - Radar Espacial (Convolución HRTF / HeSuVi)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Virtualiza 7.1 canales en auriculares estéreo mediante respuestas de impulso de laboratorio.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
                {HRTF_OPTIONS.map((profile) => {
                  const isSelected = selectedHrtf === profile.filename;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => handleHrtfChange(profile.filename)}
                      className={`p-3.5 rounded-xl border text-left transition-all relative ${
                        isSelected
                          ? "bg-tactical-800 border-tactical-accent shadow-lg shadow-tactical-accent/10 scale-[1.01]"
                          : "bg-tactical-900/60 border-tactical-700/80 hover:border-tactical-600 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-tactical-850 border border-tactical-700 text-slate-400 uppercase">
                          {profile.brand}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-tactical-accent animate-pulse"></span>
                        )}
                      </div>
                      <h4 className="text-xs font-bold text-slate-100 font-mono mt-1">
                        {profile.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {profile.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Virtual Cable Isolation Card */}
            <div className="p-5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-tactical-800 border border-tactical-700 text-amber-400">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-slate-100">
                      Aislamiento Táctico de Discord & Juegos (VB-Cable)
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Separa el audio de Warzone del resto de Windows para que la compresión no distorsione las voces de tu escuadrón.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowCableModal(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-750 border border-tactical-600 text-xs font-mono text-slate-200 transition-colors"
                >
                  Asistente de Cable
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-tactical-900 border border-tactical-750">
                <div className="space-y-1 flex-1">
                  <span className="text-xs font-bold font-mono text-slate-200 block">
                    Dispositivo Activo para Filtros:
                  </span>
                  <select
                    value={selectedDevice}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    className="w-full sm:max-w-xs px-2.5 py-1.5 rounded bg-tactical-850 border border-tactical-600 text-xs font-mono text-slate-200 focus:outline-none focus:border-tactical-accent"
                  >
                    <option value="">Todos los Dispositivos (Estándar Global)</option>
                    {audioDevices.map((dev) => {
                      const val = dev.endpoint_name || dev.name;
                      return (
                        <option key={dev.id} value={val}>
                          {dev.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={handleToggleTestMode}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                      isTestMode
                        ? "bg-amber-400 text-tactical-900 border-amber-300 shadow-md shadow-amber-400/20"
                        : "bg-tactical-800 hover:bg-tactical-750 border-tactical-600 text-slate-300"
                    }`}
                  >
                    {isTestMode ? "MODO DE PRUEBA: ACTIVO" : "PROBAR EN TODO EL SISTEMA"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: OPTIMIZACIÓN DE WINDOWS */}
        {activeTab === "optimizacion" && (
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            {/* 1-CLICK AUTO-CONFIGURATION HERO CARD */}
            <div className="p-5 rounded-xl bg-tactical-850 border border-tactical-accent/40 space-y-3 shadow-lg shadow-tactical-accent/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-tactical-accent/20 border border-tactical-accent/50 text-tactical-accent">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-slate-100">
                      Auto-Configuración Integral de Equalizer APO (1-Clic)
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Otorga permisos NTFS (icacls) a la carpeta de Equalizer APO, vincula config.txt y reinicia el servicio de audio.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRequestOptimization}
                  disabled={isConfiguringApo}
                  className="px-4 py-2 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 font-mono text-xs font-bold flex items-center space-x-2 transition-all shadow-md shadow-tactical-accent/20 disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 ${isConfiguringApo ? "animate-spin" : ""}`} />
                  <span>{isConfiguringApo ? "CONFIGURANDO..." : "AUTO-CONFIGURAR (UAC)"}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed font-mono">
                Al ejecutar esto una sola vez, Audio Dash obtiene permiso completo para escribir en `AudioDash.txt` en tiempo real sin tener que abrir la app como Administrador todos los días.
              </p>
            </div>

            {/* Diagnostic Health Check Card */}
            <div className="p-5 rounded-xl bg-tactical-850 border border-tactical-700 space-y-4 shadow-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-tactical-800 border border-tactical-700 text-tactical-accent">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-mono text-slate-100">
                      Auditoría de Salud de Audio en Windows 11
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Diagnostica mejoras de audio conflictivas, formato de muestreo y planes de energía.
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={runAudit}
                    disabled={isAuditing}
                    className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-xs font-mono text-slate-200 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin" : ""}`} />
                    <span>{isAuditing ? "Auditando..." : "Re-Auditar"}</span>
                  </button>

                  <button
                    onClick={() => setIsAuditOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-xs font-mono text-tactical-accent flex items-center space-x-1.5 transition-colors"
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
                  Fija el proceso de aislamiento de audio (`audiodg.exe`) a alta prioridad y núcleos físicos para evitar micro-cortes y latencia DPC.
                </p>
                <button
                  onClick={async () => {
                    const msg = await tauriInvoke<string>("apply_audiodg_affinity");
                    setTabFeedbackMessage(msg);
                  }}
                  className="w-full py-1.5 px-3 rounded bg-tactical-800 hover:bg-tactical-750 border border-tactical-green/40 text-xs font-mono text-tactical-green flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>OPTIMIZAR AUDIODG (P-CORES)</span>
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
                      setTabFeedbackMessage("✓ Prioridad máxima MMCSS y red sin límite aplicadas con éxito.");
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
            <span>MOTOR RUST: ACTIVO</span>
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
              dependencyStatus?.config_linked
                ? "text-tactical-green"
                : "text-tactical-warning"
            }`}
          >
            {dependencyStatus?.config_linked ? "VINCULADO" : "PENDIENTE"}
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
          onCompleteFirstRun={async () => {
            try {
              await tauriInvoke("mark_first_run_completed");
            } catch (e) {
              console.warn("No se pudo marcar first_run_completed:", e);
            }
            setShowWelcome(false);
          }}
          onOpenDownloadUrl={() => {
            if (typeof window !== "undefined") {
              window.open("https://sourceforge.net/projects/equalizerapo/", "_blank");
            }
          }}
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

      {/* Custom Game Detection Modal */}
      <CustomGameModal
        isOpen={showCustomGameModal}
        onClose={() => setShowCustomGameModal(false)}
        onAddCustomExe={handleAddCustomExe}
        customGameList={customGameList}
        runningProcesses={runningProcessList}
        isLoadingProcesses={isLoadingProcesses}
        onRefreshProcesses={handleRefreshProcesses}
        currentDetectedGame={currentProcess}
        isGameActive={isGameActive}
      />
    </div>
  );
};
