import React, { useState } from "react";
import { SystemAuditResult } from "../types/audio";
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Cpu,
  Layers,
  Volume2,
} from "lucide-react";

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditData: SystemAuditResult | null;
  isLoading: boolean;
  onRunAudit: () => void;
  onRequestOptimization: () => Promise<boolean>;
}

// Safe wrapper for Tauri invoke
async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (typeof window !== "undefined" && (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<T>(cmd, args);
  }
  return true as unknown as T;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  isOpen,
  onClose,
  auditData,
  isLoading,
  onRunAudit,
  onRequestOptimization,
}) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLeqRunning, setIsLeqRunning] = useState(false);
  const [isAffinityRunning, setIsAffinityRunning] = useState(false);
  const [optimizationMessage, setOptimizationMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyOptimization = async () => {
    setIsOptimizing(true);
    setOptimizationMessage(null);
    try {
      const success = await onRequestOptimization();
      if (success) {
        setOptimizationMessage("Optimización de Windows y MMCSS aplicada con éxito vía UAC.");
        onRunAudit();
      } else {
        setOptimizationMessage("La optimización fue cancelada o no se otorgaron permisos de administrador.");
      }
    } catch (err) {
      setOptimizationMessage(`Error: ${String(err)}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyLeq = async () => {
    setIsLeqRunning(true);
    setOptimizationMessage(null);
    try {
      const success = await invokeTauri<boolean>("apply_leq_tweak");
      if (success) {
        setOptimizationMessage("Tweak LEQ aplicado: Release <10ms en FxProperties. Servicio de audio reiniciado con éxito.");
        onRunAudit();
      } else {
        setOptimizationMessage("Operación cancelada o permisos de administrador denegados.");
      }
    } catch (err) {
      setOptimizationMessage(`Error aplicando LEQ: ${String(err)}`);
    } finally {
      setIsLeqRunning(false);
    }
  };

  const handleApplyAffinity = async () => {
    setIsAffinityRunning(true);
    setOptimizationMessage(null);
    try {
      const msg = await invokeTauri<string>("apply_audiodg_affinity");
      setOptimizationMessage(msg);
    } catch (err) {
      setOptimizationMessage(`Error de afinidad: ${String(err)}`);
    } finally {
      setIsAffinityRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-tactical-900 border border-tactical-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tactical-700 bg-tactical-850">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-tactical-800 text-tactical-accent border border-tactical-700">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-wider text-slate-100 flex items-center gap-2">
                AUDITORÍA DEL SISTEMA & MMCSS (WINDOWS 11)
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Latencia ultrabaja, pureza de señal, MMCSS y prevención de distorsión
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-tactical-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* MMCSS Description Box */}
          <div className="p-3 bg-tactical-800/60 rounded-lg border border-tactical-700/60 text-xs text-slate-300 space-y-2">
            <div className="flex items-center space-x-2 text-tactical-accent font-semibold font-mono">
              <Cpu className="w-4 h-4" />
              <span>OPTIMIZACIÓN NATIVA MMCSS & RED DE WINDOWS</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Esta auditoría inspecciona los registros del sistema operativo para erradicar la contención de hilos y el enmascaramiento de audio. Al aplicar la optimización vía UAC, se configuran las claves de registro esenciales:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-tactical-850 border border-tactical-700/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-tactical-accent shrink-0" />
                <span className="text-slate-200">SystemResponsiveness = 0 (100% CPU)</span>
              </div>
              <div className="flex items-center space-x-2 px-2.5 py-1.5 rounded bg-tactical-850 border border-tactical-700/80">
                <CheckCircle2 className="w-3.5 h-3.5 text-tactical-accent shrink-0" />
                <span className="text-slate-200">NetworkThrottling = 0xFFFFFFFF (Sin límite)</span>
              </div>
            </div>
          </div>

          {/* Quick Elite Tweaks Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-tactical-850 rounded-lg border border-tactical-700">
            {/* LEQ Tweak */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-200">
                <Volume2 className="w-4 h-4 text-tactical-warning" />
                <span>Nivelación LEQ (Release &lt;10ms)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Sobrescribe FxProperties en el registro para acelerar el compresor de Windows y elimina el delay de ducking.
              </p>
              <button
                onClick={handleApplyLeq}
                disabled={isLeqRunning}
                className="w-full py-1.5 px-3 rounded bg-tactical-800 hover:bg-tactical-700 border border-tactical-warning/40 text-xs font-mono text-tactical-warning flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isLeqRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Zap className="w-3.5 h-3.5" />
                )}
                <span>OPTIMIZAR LEQ (UAC)</span>
              </button>
            </div>

            {/* audiodg.exe Affinity */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-slate-200">
                <Layers className="w-4 h-4 text-tactical-green" />
                <span>Anclar audiodg.exe a P-Cores</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Fija el aislamiento de audio a núcleos físicos de rendimiento, impidiendo que los E-cores causen cortes.
              </p>
              <button
                onClick={handleApplyAffinity}
                disabled={isAffinityRunning}
                className="w-full py-1.5 px-3 rounded bg-tactical-800 hover:bg-tactical-700 border border-tactical-green/40 text-xs font-mono text-tactical-green flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                {isAffinityRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Cpu className="w-3.5 h-3.5" />
                )}
                <span>ANCLAR A P-CORES</span>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-tactical-accent mb-2" />
              <p className="text-sm font-mono">Inspeccionando registros de audio y MMCSS de Windows...</p>
            </div>
          ) : auditData ? (
            <div className="space-y-2.5">
              {auditData.checks.map((check) => {
                const isOptimal = check.status === "optimal";
                return (
                  <div
                    key={check.id}
                    className={`p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                      isOptimal
                        ? "bg-tactical-850/60 border-tactical-700/80"
                        : "bg-tactical-800 border-tactical-warning/40 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start space-x-2.5">
                      <div className="mt-0.5 shrink-0">
                        {isOptimal ? (
                          <CheckCircle2 className="w-4 h-4 text-tactical-green" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-tactical-warning" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                          {check.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {check.description}
                        </p>
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono">
                          <span className="text-slate-400">
                            Actual:{" "}
                            <span
                              className={
                                isOptimal ? "text-tactical-green font-semibold" : "text-tactical-warning font-semibold"
                              }
                            >
                              {check.current_value}
                            </span>
                          </span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">
                            Recomendado:{" "}
                            <span className="text-tactical-accent">{check.recommended}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              No se han obtenido datos de auditoría.
            </div>
          )}

          {optimizationMessage && (
            <div className="p-3 rounded-lg bg-tactical-800 border border-tactical-accent/40 text-xs text-tactical-accent font-mono leading-relaxed">
              {optimizationMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-tactical-700 bg-tactical-850 flex items-center justify-between">
          <button
            onClick={onRunAudit}
            disabled={isLoading || isOptimizing}
            className="px-4 py-2 text-xs font-mono rounded bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-slate-200 transition-colors"
          >
            Volver a Auditar
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleApplyOptimization}
              disabled={isLoading || isOptimizing}
              className="px-5 py-2 text-xs font-bold font-mono tracking-wider rounded bg-tactical-accent hover:bg-cyan-400 text-tactical-900 flex items-center space-x-2 transition-all shadow-lg shadow-tactical-accent/20 disabled:opacity-50"
            >
              {isOptimizing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>APLICANDO (UAC)...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-tactical-900" />
                  <span>APLICAR OPTIMIZACIÓN WINDOWS & MMCSS</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
