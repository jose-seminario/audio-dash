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
} from "lucide-react";

interface WelcomeSetupProps {
  status: DependencyStatus;
  onRescan: () => Promise<void>;
  onCompleteFirstRun: () => void;
  onOpenDownloadUrl: () => void;
}

export const WelcomeSetup: React.FC<WelcomeSetupProps> = ({
  status,
  onRescan,
  onCompleteFirstRun,
  onOpenDownloadUrl,
}) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleRescan = async () => {
    setIsScanning(true);
    try {
      await onRescan();
    } finally {
      setIsScanning(false);
    }
  };

  const isApoReady = status.equalizer_apo_installed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-tactical-900/95 backdrop-blur-md p-4">
      <div className="w-full max-w-xl bg-tactical-850 border border-tactical-700 rounded-xl shadow-2xl p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-tactical-800 border border-tactical-700 text-tactical-accent mb-2">
            <Sliders className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-wider text-slate-100">
            BIENVENIDO A AUDIO DASH
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            ASISTENTE DE CONFIGURACIÓN INICIAL DEL MOTOR DE AUDIO
          </p>
        </div>

        {/* Philosophy Card */}
        <div className="p-4 rounded-lg bg-tactical-900/80 border border-tactical-700/80 text-xs text-slate-300 space-y-2">
          <div className="flex items-center space-x-2 text-tactical-accent font-semibold font-mono">
            <Shield className="w-4 h-4" />
            <span>VENTAJA LEGAL & ARQUITECTURA LIMPIA</span>
          </div>
          <p>
            Audio Dash utiliza la arquitectura APO de Windows para procesar el sonido a nivel de
            sistema operativo. No inyecta DLLs, no lee la memoria de los juegos y es 100%
            indetectable por anti-cheats (Ricochet, BattlEye, Vanguard).
          </p>
        </div>

        {/* Dependency Status Card */}
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Estado de Componentes del Sistema
          </h4>

          <div
            className={`p-4 rounded-lg border flex items-start justify-between gap-3 ${
              isApoReady
                ? "bg-tactical-900/60 border-tactical-green/40"
                : "bg-tactical-900 border-tactical-warning/50"
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className="mt-0.5">
                {isApoReady ? (
                  <CheckCircle className="w-5 h-5 text-tactical-green" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-tactical-warning" />
                )}
              </div>
              <div>
                <h5 className="text-sm font-semibold text-slate-100">
                  Equalizer APO (Motor de Filtros de Windows)
                </h5>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isApoReady
                    ? `Detectado en: ${status.installed_path || "C:\\Program Files\\EqualizerAPO"}`
                    : "No se detectó la instalación base de Equalizer APO en el sistema."}
                </p>
                {status.details && (
                  <p className="text-[11px] font-mono text-slate-500 mt-1">
                    {status.details}
                  </p>
                )}
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                isApoReady
                  ? "bg-tactical-green/10 text-tactical-green border border-tactical-green/30"
                  : "bg-tactical-warning/10 text-tactical-warning border border-tactical-warning/30"
              }`}
            >
              {isApoReady ? "INSTALADO" : "FALTA APO"}
            </span>
          </div>
        </div>

        {/* Action Steps */}
        {!isApoReady ? (
          <div className="space-y-3">
            <div className="p-3 bg-tactical-800 rounded border border-tactical-700 text-xs text-slate-300">
              <span className="font-semibold text-slate-100">Paso 1:</span> Descarga e instala
              Equalizer APO desde el repositorio oficial. Durante la instalación, marca tus
              auriculares en el configurador.
            </div>

            <div className="flex gap-3">
              <button
                onClick={onOpenDownloadUrl}
                className="flex-1 py-2.5 px-4 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 font-mono text-xs font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-tactical-accent/20"
              >
                <DownloadCloud className="w-4 h-4" />
                <span>DESCARGAR EQUALIZER APO</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleRescan}
                disabled={isScanning}
                className="py-2.5 px-4 rounded-lg bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-slate-200 font-mono text-xs font-semibold flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
                <span>RE-ESCANEAR</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-tactical-green/10 border border-tactical-green/30 rounded text-xs text-tactical-green">
              Motor Equalizer APO detectado correctamente. El enlace dinámico de configuración en
              tu carpeta de usuario está preparado.
            </div>

            <button
              onClick={onCompleteFirstRun}
              className="w-full py-3 px-4 rounded-lg bg-tactical-green hover:bg-emerald-400 text-tactical-900 font-mono text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-lg shadow-tactical-green/20"
            >
              <span>INICIAR DASHBOARD TÁCTICO</span>
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="pt-2 text-center text-[11px] font-mono text-slate-500 flex items-center justify-center gap-1">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Configuración guardada en %APPDATA%\AudioDash\settings.json</span>
        </div>
      </div>
    </div>
  );
};
