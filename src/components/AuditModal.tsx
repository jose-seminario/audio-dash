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
} from "lucide-react";

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditData: SystemAuditResult | null;
  isLoading: boolean;
  onRunAudit: () => void;
  onRequestOptimization: () => Promise<boolean>;
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
          <div className="p-3 bg-tactical-800/60 rounded-lg border border-tactical-700/60 text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center space-x-2 text-tactical-accent font-semibold font-mono">
              <Cpu className="w-4 h-4" />
              <span>OPTIMIZACIÓN NATIVA MMCSS & RED DE WINDOWS</span>
            </div>
            <p>
              Esta auditoría inspecciona los registros del sistema operativo (Mejoras de audio, Sonido Espacial, Plan de Energía y el Planificador Multimedia MMCSS). Al aplicar la optimización, se ajusta <code className="text-tactical-accent font-mono">SystemResponsiveness = 0</code> y <code className="text-tactical-accent font-mono">NetworkThrottlingIndex = 0xFFFFFFFF</code> para máxima fluidez y cero jitter.
            </p>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-tactical-accent mb-2" />
              <p className="text-sm font-mono">Inspeccionando registros de audio y MMCSS de Windows...</p>
            </div>
          ) : auditData ? (
            <div className="space-y-3">
              {auditData.checks.map((check) => {
                const isOptimal = check.status === "optimal";
                return (
                  <div
                    key={check.id}
                    className={`p-3.5 rounded-lg border transition-all flex items-start justify-between gap-4 ${
                      isOptimal
                        ? "bg-tactical-850/60 border-tactical-700/80"
                        : "bg-tactical-800 border-tactical-warning/40 shadow-sm"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="mt-0.5">
                        {isOptimal ? (
                          <CheckCircle2 className="w-5 h-5 text-tactical-green" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-tactical-warning" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                          {check.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {check.description}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-[11px] font-mono">
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
            <div className="p-3 rounded-lg bg-tactical-800 border border-tactical-accent/40 text-xs text-tactical-accent font-mono">
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
