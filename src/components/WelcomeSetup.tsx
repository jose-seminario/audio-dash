import React, { useState } from "react";
import { DependencyStatus } from "../types/audio";
import {
  DownloadCloud,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sliders,
  Shield,
  HelpCircle,
  Zap,
  Loader2,
} from "lucide-react";

interface WelcomeSetupProps {
  status: DependencyStatus;
  onRescan: () => Promise<void>;
  onCompleteFirstRun: () => void;
  onOpenDownloadUrl: () => void;
}

// Safe wrapper for Tauri invoke
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (
    typeof window !== "undefined" &&
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  ) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  }
  return true as unknown as T;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({
  status,
  onRescan,
  onCompleteFirstRun,
  onOpenDownloadUrl,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const handleRescan = async () => {
    setIsScanning(true);
    setActionFeedback(null);
    try {
      await onRescan();
    } finally {
      setIsScanning(false);
    }
  };

  const handleAutoInstall = async () => {
    setIsInstalling(true);
    setActionFeedback("Descargando instalador oficial de Equalizer APO y solicitando permisos UAC...");
    try {
      const launched = await invokeTauri<boolean>("auto_install_equalizer_apo");
      if (launched) {
        setActionFeedback("Instalador en ejecución. Cuando termine la instalación de Windows, presiona 'Re-Escanear'.");
        setTimeout(async () => {
          await onRescan();
        }, 4000);
      } else {
        setActionFeedback("Instalación cancelada en el diálogo de administrador de Windows.");
      }
    } catch (err) {
      setActionFeedback(`Error en la instalación automática: ${String(err)}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleAutoConfigure = async () => {
    setIsAutoConfiguring(true);
    setActionFeedback("Otorgando permisos NTFS (icacls), vinculando ecualizador y optimizando audio...");
    try {
      const success = await invokeTauri<boolean>("run_one_click_magic_setup");
      if (success) {
        setActionFeedback("✓ ¡Sistema configurado con éxito! Permisos y enlace listos.");
        await onRescan();
      } else {
        setActionFeedback("La optimización fue cancelada en el diálogo de administrador.");
      }
    } catch (err) {
      setActionFeedback(`Error en auto-configuración: ${String(err)}`);
    } finally {
      setIsAutoConfiguring(false);
    }
  };

  const isApoInstalled = status.equalizer_apo_installed;
  const isApoLinked = status.config_linked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tactical-900/95 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-tactical-850 border border-tactical-700 rounded-xl shadow-2xl p-6 sm:p-8 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-tactical-800 border border-tactical-700 text-tactical-accent mb-1 shadow-md">
            <Sliders className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-wider text-slate-100 font-mono">
            BIENVENIDO A AUDIO DASH
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            OPTIMIZADOR TÁCTICO DE AUDIO PARA WINDOWS 11
          </p>
        </div>

        {/* Philosophy Card */}
        <div className="p-3.5 rounded-lg bg-tactical-900/80 border border-tactical-700/80 text-xs text-slate-300 space-y-1.5">
          <div className="flex items-center space-x-2 text-tactical-accent font-semibold font-mono">
            <Shield className="w-4 h-4" />
            <span>VENTAJA LEGAL & ARQUITECTURA LIMPIA</span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">
            Audio Dash utiliza la arquitectura APO de Windows para ecualizar y comprimir el sonido a nivel del sistema operativo. Sin inyección de DLLs ni riesgo de baneo en Ricochet o Vanguard.
          </p>
        </div>

        {/* Status Component Summary */}
        <div className="space-y-2.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Estado de Componentes de Audio
          </h4>

          {/* Row 1: Equalizer APO */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
              isApoInstalled
                ? "bg-tactical-900/60 border-tactical-green/40"
                : "bg-tactical-900 border-tactical-warning/50"
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              {isApoInstalled ? (
                <CheckCircle className="w-5 h-5 text-tactical-green shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-tactical-warning shrink-0" />
              )}
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-slate-200">
                  1. Motor Equalizer APO
                </h5>
                <p className="text-[11px] text-slate-400 truncate">
                  {isApoInstalled
                    ? `Instalado en: ${status.installed_path || "C:\\Program Files\\EqualizerAPO"}`
                    : "No detectado en el sistema."}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                isApoInstalled
                  ? "bg-tactical-green/15 text-tactical-green border border-tactical-green/30"
                  : "bg-tactical-warning/15 text-tactical-warning border border-tactical-warning/30"
              }`}
            >
              {isApoInstalled ? "INSTALADO" : "PENDIENTE"}
            </span>
          </div>

          {/* Row 2: Config Link & NTFS Permissions */}
          <div
            className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
              isApoLinked
                ? "bg-tactical-900/60 border-tactical-green/40"
                : "bg-tactical-900 border-tactical-warning/50"
            }`}
          >
            <div className="flex items-center space-x-3 min-w-0">
              {isApoLinked ? (
                <CheckCircle className="w-5 h-5 text-tactical-green shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-tactical-warning shrink-0" />
              )}
              <div className="min-w-0">
                <h5 className="text-xs font-bold text-slate-200">
                  2. Vinculación y Permisos de Perillas
                </h5>
                <p className="text-[11px] text-slate-400 truncate">
                  {isApoLinked
                    ? "AudioDash.txt vinculado en config.txt con permisos activos."
                    : "Requiere auto-configuración para que las perillas modifiquen el audio."}
                </p>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase shrink-0 ${
                isApoLinked
                  ? "bg-tactical-green/15 text-tactical-green border border-tactical-green/30"
                  : "bg-tactical-warning/15 text-tactical-warning border border-tactical-warning/30"
              }`}
            >
              {isApoLinked ? "VINCULADO" : "POR VINCULAR"}
            </span>
          </div>
        </div>

        {/* Action Buttons: Automated 1-Click Operations */}
        <div className="space-y-2.5 pt-1">
          {!isApoInstalled ? (
            /* Paso 1: Instalar APO automáticamente */
            <div className="space-y-2">
              <button
                onClick={handleAutoInstall}
                disabled={isInstalling}
                className="w-full py-3 px-4 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 font-mono text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-tactical-accent/20 disabled:opacity-50"
              >
                {isInstalling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                <span>
                  {isInstalling
                    ? "INSTALANDO EQUALIZER APO..."
                    : "1. INSTALAR EQUALIZER APO (AUTOMÁTICO)"}
                </span>
              </button>

              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                <button
                  onClick={onOpenDownloadUrl}
                  className="hover:text-slate-200 flex items-center gap-1 underline underline-offset-2"
                >
                  <span>Descargar manualmente desde SourceForge</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  onClick={handleRescan}
                  disabled={isScanning}
                  className="hover:text-tactical-accent flex items-center gap-1 text-slate-300"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
                  <span>Re-Escanear</span>
                </button>
              </div>
            </div>
          ) : !isApoLinked ? (
            /* Paso 2: Auto-Configurar Todo */
            <div className="space-y-2">
              <button
                onClick={handleAutoConfigure}
                disabled={isAutoConfiguring}
                className="w-full py-3 px-4 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 font-mono text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-tactical-accent/20 disabled:opacity-50"
              >
                {isAutoConfiguring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>
                  {isAutoConfiguring
                    ? "CONFIGURANDO Y VINCULANDO..."
                    : "2. AUTO-CONFIGURAR TODO (1-CLIC)"}
                </span>
              </button>
              <p className="text-[11px] text-center text-slate-400 font-mono">
                Aplica permisos NTFS (icacls), vincula config.txt y reinicia el servicio de audio de Windows.
              </p>
            </div>
          ) : (
            /* Paso 3: Listo para jugar */
            <div className="space-y-2">
              <button
                onClick={onCompleteFirstRun}
                className="w-full py-3 px-4 rounded-lg bg-tactical-green hover:bg-emerald-400 text-tactical-900 font-mono text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-tactical-green/20"
              >
                <CheckCircle className="w-4 h-4" />
                <span>INICIAR DASHBOARD TÁCTICO</span>
              </button>
            </div>
          )}

          {/* Feedback message banner */}
          {actionFeedback && (
            <div className="p-2.5 rounded bg-tactical-800 border border-tactical-accent/40 text-xs font-mono text-tactical-accent text-center animate-in fade-in duration-150">
              {actionFeedback}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-1 text-center text-[10px] font-mono text-slate-500 flex items-center justify-center gap-1 border-t border-tactical-800">
          <HelpCircle className="w-3 h-3" />
          <span>Configuración guardada en %APPDATA%\AudioDash\settings.json</span>
        </div>
      </div>
    </div>
  );
};
