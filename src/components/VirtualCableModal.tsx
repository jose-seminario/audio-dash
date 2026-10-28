import React from "react";
import {
  X,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Headphones,
} from "lucide-react";

interface VirtualCableModalProps {
  isOpen: boolean;
  onClose: () => void;
  hasVirtualCable: boolean;
  selectedDevice: string;
  onOpenAppVolumeSettings: () => void;
  onOpenSoundControlPanel: () => void;
}

export const VirtualCableModal: React.FC<VirtualCableModalProps> = ({
  isOpen,
  onClose,
  hasVirtualCable,
  selectedDevice,
  onOpenAppVolumeSettings,
  onOpenSoundControlPanel,
}) => {
  if (!isOpen) return null;

  const openDownloadSite = () => {
    window.open("https://vb-audio.com/Cable/", "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-tactical-900 border border-tactical-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tactical-700 bg-tactical-850 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-tactical-800 text-tactical-accent border border-tactical-700">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-mono tracking-wider text-slate-100">
                AISLAMIENTO DE AUDIO DE WARZONE
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Enrutamiento profesional por dispositivo virtual (Anti-Discord)
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
          {/* Missing Cable Warning Banner */}
          {!hasVirtualCable && (
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex items-center space-x-2 text-amber-300 font-mono font-bold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>VB-AUDIO VIRTUAL CABLE NO DETECTADO</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Para que Audio Dash procese únicamente Warzone y deje intacto a Discord, se recomienda instalar el controlador gratuito oficial de cable virtual.
              </p>
              <button
                onClick={openDownloadSite}
                className="py-2 px-3.5 rounded bg-amber-500 hover:bg-amber-400 text-tactical-900 font-mono text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>DESCARGAR DRIVER VB-CABLE (OFICIAL)</span>
              </button>
            </div>
          )}

          {/* Golden Rule Summary */}
          <div className="p-3.5 rounded-lg bg-tactical-800/80 border border-tactical-accent/30 text-xs text-slate-300 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-tactical-accent shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-tactical-accent font-mono">¿POR QUÉ AISLAR WARZONE?</span>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                Al enrutar el juego a <strong className="text-white">CABLE Input</strong>, los filtros extremos (pasos +8 dB, corte de explosiones y limitador) solo modifican los sonidos de Warzone. Tus compañeros en Discord, música de Spotify y videos suenan con su calidad y volumen 100% natural.
              </p>
            </div>
          </div>

          {/* 3-Step Setup Instructions */}
          <div className="space-y-3">
            {/* Step 1 */}
            <div className="p-3.5 rounded-lg bg-tactical-850 border border-tactical-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-tactical-800 border border-tactical-accent/40 text-tactical-accent flex items-center justify-center text-[11px]">
                    1
                  </span>
                  Asignar salida de Warzone a CABLE Input
                </span>
                <button
                  onClick={onOpenAppVolumeSettings}
                  className="px-2.5 py-1 rounded bg-tactical-800 hover:bg-tactical-750 border border-tactical-600 text-[11px] font-mono text-tactical-accent flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Abrir Configuración</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 pl-7 leading-relaxed">
                Abre las preferencias de volumen de Windows mientras Warzone está abierto, busca <strong className="text-slate-200">Call of Duty</strong> y selecciona <strong className="text-tactical-accent">"CABLE Input (VB-Audio Virtual Cable)"</strong> como su dispositivo de salida.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3.5 rounded-lg bg-tactical-850 border border-tactical-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-tactical-800 border border-tactical-accent/40 text-tactical-accent flex items-center justify-center text-[11px]">
                    2
                  </span>
                  Escuchar el Cable en tus Auriculares
                </span>
                <button
                  onClick={onOpenSoundControlPanel}
                  className="px-2.5 py-1 rounded bg-tactical-800 hover:bg-tactical-750 border border-tactical-600 text-[11px] font-mono text-tactical-accent flex items-center gap-1 transition-colors"
                >
                  <Headphones className="w-3 h-3" />
                  <span>Abrir Panel de Sonido</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 pl-7 leading-relaxed">
                En la pestaña <strong className="text-slate-200">Grabación</strong>, haz doble clic en <strong className="text-slate-200">CABLE Output</strong> &gt; pestaña <strong className="text-slate-200">Escuchar</strong> &gt; marca <strong className="text-tactical-accent">"Escuchar este dispositivo"</strong> y selecciona tus auriculares principales en el desplegable.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-3.5 rounded-lg bg-tactical-850 border border-tactical-700/80 space-y-1.5">
              <span className="text-xs font-mono font-bold text-slate-200 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-tactical-800 border border-tactical-green/40 text-tactical-green flex items-center justify-center text-[11px]">
                  3
                </span>
                Disfruta de la ventaja táctica
              </span>
              <p className="text-[11px] text-slate-400 pl-7 leading-relaxed">
                ¡Listo! Los filtros de Audio Dash ahora se aplican en <strong className="text-slate-200">{selectedDevice || "CABLE Input"}</strong>. Cuando juegues escucharás pasos lejanos con total claridad sin que los gritos en Discord te ensordezcan.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-tactical-700 bg-tactical-850 flex items-center justify-between shrink-0">
          <span className="text-[11px] font-mono text-slate-400">
            Esta configuración solo se realiza una sola vez en Windows.
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
