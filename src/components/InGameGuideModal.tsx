import React from "react";
import { X, Gamepad2, Sparkles } from "lucide-react";

interface InGameGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InGameGuideModal: React.FC<InGameGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const settings = [
    {
      title: "Mezcla de Audio (Audio Mix)",
      recommended: "Cine / Cinema",
      why: "Ofrece el mayor rango dinámico sin compresión interna artificial del motor del juego. Audio Dash se encarga del control de picos.",
      highlight: true,
    },
    {
      title: "Volumen de Música",
      recommended: "0%",
      why: "Elimina la música dramática en finales de zona y tiroteos para escuchar pasos sin obstáculos.",
      highlight: true,
    },
    {
      title: "Volumen de Diálogo",
      recommended: "14% - 20%",
      why: "Mantiene audibles los avisos de 'Ataque aéreo' o 'Enemigo cayendo' sin aturdirte durante combates cercanos.",
      highlight: false,
    },
    {
      title: "Volumen de Efectos",
      recommended: "100%",
      why: "Alimenta con la máxima información acústica de pisadas, recargas y placas a nuestro motor.",
      highlight: true,
    },
    {
      title: "Auriculares Mejorados (Enhanced Headphone)",
      recommended: "Desactivado (OFF)",
      why: "El procesado nativo del juego choca con el motor 3D HeSuVi y enturbia la dirección de los ángulos.",
      highlight: true,
    },
    {
      title: "Audio Mono",
      recommended: "Desactivado (OFF)",
      why: "El audio mono combina los dos canales en uno solo, haciendo imposible distinguir izquierda de derecha.",
      highlight: true,
    },
    {
      title: "Música de Juggernaut & Tácticos",
      recommended: "Desactivado (OFF)",
      why: "Cero distracciones en momentos de alta tensión.",
      highlight: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-tactical-900 border border-tactical-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tactical-700 bg-tactical-850">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-tactical-800 text-tactical-accent border border-tactical-700">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-wider text-slate-100 flex items-center gap-2">
                GUÍA DE AJUSTES EN EL JUEGO (WARZONE / COD)
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Sincronización recomendada para máxima ventaja táctica
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
          <div className="p-3.5 bg-tactical-800/80 rounded-lg border border-tactical-accent/30 text-xs text-slate-300 flex items-start space-x-3">
            <Sparkles className="w-5 h-5 text-tactical-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-tactical-accent font-mono">REGLA DE ORO DEL AUDIO COMPETITIVO</span>
              <p className="text-slate-300 leading-relaxed">
                Para que Audio Dash funcione a su máximo potencial, el juego debe entregar una señal limpia y sin filtros agresivos. Aplica estos valores en el menú <strong className="text-white">Opciones &gt; Audio</strong> dentro del juego:
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {settings.map((item, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-lg border transition-all flex items-start justify-between gap-3 ${
                  item.highlight
                    ? "bg-tactical-850 border-tactical-accent/40 shadow-sm"
                    : "bg-tactical-850/60 border-tactical-700/70"
                }`}
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-200">{item.title}</span>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-tactical-800 text-tactical-accent border border-tactical-accent/30">
                      {item.recommended}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">{item.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-tactical-700 bg-tactical-850 flex items-center justify-between">
          <span className="text-[11px] font-mono text-slate-400">
            Aplica estos cambios en el menú de Warzone una sola vez.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-mono font-bold rounded bg-tactical-accent hover:bg-cyan-400 text-tactical-900 transition-colors"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};
