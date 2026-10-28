import React, { useState } from "react";
import {
  Gamepad2,
  X,
  Search,
  Plus,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

interface CustomGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomExe: (exe: string) => Promise<void>;
  customGameList: string[];
  runningProcesses: string[];
  isLoadingProcesses: boolean;
  onRefreshProcesses: () => Promise<void>;
  currentDetectedGame: string;
  isGameActive: boolean;
}

export const CustomGameModal: React.FC<CustomGameModalProps> = ({
  isOpen,
  onClose,
  onAddCustomExe,
  customGameList,
  runningProcesses,
  isLoadingProcesses,
  onRefreshProcesses,
  currentDetectedGame,
  isGameActive,
}) => {
  const [manualInput, setManualInput] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAdd = async (exe: string) => {
    const clean = exe.trim();
    if (!clean) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await onAddCustomExe(clean);
      setFeedback(`✓ '${clean}' agregado a la lista de juegos.`);
      setManualInput("");
      setTimeout(() => setFeedback(null), 3000);
    } catch (err) {
      setFeedback(`Error: ${String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRunning = runningProcesses.filter((proc) => {
    if (!filterQuery) return true;
    return proc.toLowerCase().includes(filterQuery.toLowerCase());
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-tactical-900 border border-tactical-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tactical-700 bg-tactical-850">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-tactical-800 text-tactical-accent border border-tactical-700">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-wider text-slate-100 flex items-center gap-2">
                CONFIGURACIÓN DE JUEGOS & DETECCIÓN DINÁMICA
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Protección contra cambios de nombre en actualizaciones de COD
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
          {/* Current Game Status Card */}
          <div className="p-3.5 bg-tactical-850 rounded-xl border border-tactical-700 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase text-slate-400">
                Estado de Detección en Tiempo Real:
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                  isGameActive
                    ? "bg-tactical-green/20 text-tactical-green border border-tactical-green/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {isGameActive ? "JUEGO DETECTADO" : "SIN JUEGO ACTIVO"}
              </span>
            </div>
            <p className="text-xs font-mono font-bold text-slate-200">
              Proceso actual: <span className="text-tactical-accent">{currentDetectedGame}</span>
            </p>
            <p className="text-[11px] text-slate-400 leading-snug">
              Audio Dash detecta automáticamente patrones como <code className="text-slate-300">cod*.exe</code>, <code className="text-slate-300">warzone*.exe</code>, <code className="text-slate-300">CallOfDuty*.exe</code> y títulos de ventana. Si Activision renombra el ejecutable en una actualización, puedes agregarlo aquí para siempre.
            </p>
          </div>

          {/* Add Manual Exe Section */}
          <div className="space-y-2">
            <label className="text-xs font-mono font-bold text-slate-300">
              Agregar Ejecutable Manualmente:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Ejemplo: cod25-cod.exe, custom_warzone.exe..."
                className="flex-1 px-3 py-2 rounded-lg bg-tactical-850 border border-tactical-600 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-tactical-accent"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd(manualInput);
                }}
              />
              <button
                onClick={() => handleAdd(manualInput)}
                disabled={isSubmitting || !manualInput.trim()}
                className="px-4 py-2 rounded-lg bg-tactical-accent hover:bg-cyan-400 text-tactical-900 font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          {/* Saved Custom Games List */}
          {customGameList.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                Tus Ejecutables Personalizados Guardados:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {customGameList.map((exe) => (
                  <span
                    key={exe}
                    className="px-2 py-1 rounded bg-tactical-800 border border-tactical-accent/30 text-xs font-mono text-tactical-accent flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-tactical-accent" />
                    {exe}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Running Processes Picker */}
          <div className="space-y-2 pt-2 border-t border-tactical-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-300">
                Seleccionar de Procesos Abiertos en esta PC:
              </span>
              <button
                onClick={onRefreshProcesses}
                disabled={isLoadingProcesses}
                className="text-[11px] font-mono text-tactical-accent hover:underline flex items-center gap-1"
              >
                <RefreshCw
                  className={`w-3 h-3 ${isLoadingProcesses ? "animate-spin" : ""}`}
                />
                <span>Actualizar Lista</span>
              </button>
            </div>

            {/* Filter Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filtrar procesos abiertos..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-tactical-850 border border-tactical-700 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-tactical-accent"
              />
            </div>

            {/* Process list */}
            <div className="max-h-44 overflow-y-auto rounded-lg border border-tactical-750 bg-tactical-850/60 divide-y divide-tactical-800 p-1">
              {isLoadingProcesses ? (
                <div className="p-4 text-center text-xs font-mono text-slate-400">
                  Cargando procesos en ejecución...
                </div>
              ) : filteredRunning.length > 0 ? (
                filteredRunning.map((proc) => {
                  const isCurrent =
                    proc.toLowerCase() === currentDetectedGame.toLowerCase();
                  return (
                    <div
                      key={proc}
                      className="px-3 py-1.5 flex items-center justify-between hover:bg-tactical-800/80 rounded transition-colors"
                    >
                      <span className="text-xs font-mono text-slate-300 truncate mr-2">
                        {proc} {isCurrent ? "⭐ (En primer plano)" : ""}
                      </span>
                      <button
                        onClick={() => handleAdd(proc)}
                        className="px-2 py-0.5 rounded bg-tactical-800 hover:bg-tactical-700 border border-tactical-600 text-[10px] font-mono text-slate-200 shrink-0 transition-colors"
                      >
                        + Vincular
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="p-4 text-center text-xs font-mono text-slate-500">
                  No se encontraron procesos coincidentes.
                </div>
              )}
            </div>
          </div>

          {feedback && (
            <div className="p-3 rounded-lg bg-tactical-800 border border-tactical-accent/40 text-xs font-mono text-tactical-accent">
              {feedback}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-tactical-700 bg-tactical-850 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">
            Los juegos agregados se recuerdan automáticamente.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-mono font-bold rounded bg-tactical-accent hover:bg-cyan-400 text-tactical-900 transition-colors"
          >
            LISTO
          </button>
        </div>
      </div>
    </div>
  );
};
