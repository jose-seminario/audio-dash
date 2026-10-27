import React from "react";
import { SliderValues } from "../types/audio";
import {
  Footprints,
  Bomb,
  Crosshair,
  Volume2,
  Sparkles,
  RotateCcw,
  Activity,
  VolumeX,
} from "lucide-react";

interface AudioSlidersProps {
  values: SliderValues;
  onChange: (key: keyof SliderValues, val: number) => void;
  onRelease: () => void;
  disabled?: boolean;
}

const COMPETITIVE_DEFAULTS: Record<keyof SliderValues, number> = {
  compresion: 65,
  atenuacionPropia: 0,
  pasos: 7.5,
  bombas: 6.0,
  disparos: 5.0,
  claridad: 4.0,
  maestro: -2.0,
};

export const AudioSliders: React.FC<AudioSlidersProps> = ({
  values,
  onChange,
  onRelease,
  disabled = false,
}) => {
  const slidersConfig: {
    key: keyof SliderValues;
    label: string;
    sublabel: string;
    description: string;
    min: number;
    max: number;
    step: number;
    unit: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
  }[] = [
    {
      key: "compresion",
      label: "Compresión Táctica (Loudness VST)",
      sublabel: "Umbral Dinámico & Limitador -1.0 dB",
      description: "Eleva pasos distantes y fija un techo estricto para que los disparos no te ensordezcan",
      min: 0,
      max: 100,
      step: 5,
      unit: "%",
      icon: <Activity className="w-5 h-5 text-tactical-accent" />,
      color: "text-tactical-accent",
      glow: "hover:border-tactical-accent/50",
    },
    {
      key: "atenuacionPropia",
      label: "Atenuación Disparos Propios",
      sublabel: "Canal Central (C) Pre-Mix (0 a -12 dB)",
      description: "Atenúa recargas y disparos de tu propia arma en el canal central sin alterar pasos en L/R",
      min: -12,
      max: 0,
      step: 0.5,
      unit: " dB",
      icon: <VolumeX className="w-5 h-5 text-amber-400" />,
      color: "text-amber-400",
      glow: "hover:border-amber-400/50",
    },
    {
      key: "pasos",
      label: "Pasos Enemigos",
      sublabel: "Realce 2.5 kHz & 4.0 kHz",
      description: "Aumenta la presencia de pisadas y crujidos en superficies duras",
      min: 0,
      max: 10,
      step: 1,
      unit: "/10",
      icon: <Footprints className="w-5 h-5 text-tactical-green" />,
      color: "text-tactical-green",
      glow: "hover:border-tactical-green/50",
    },
    {
      key: "bombas",
      label: "Amortiguador de Bombas",
      sublabel: "Corte Graves HP 120 Hz & LS 200 Hz",
      description: "Corta subgraves para que las explosiones y ataques no enmascaren los pasos",
      min: 0,
      max: 10,
      step: 1,
      unit: "/10",
      icon: <Bomb className="w-5 h-5 text-tactical-alert" />,
      color: "text-tactical-alert",
      glow: "hover:border-tactical-alert/50",
    },
    {
      key: "disparos",
      label: "Atenuador de Disparos",
      sublabel: "Filtro High-Shelf 6.0 kHz (-3 dB)",
      description: "Suaviza el chasquido estridente de armas automáticas reduciendo fatiga auditiva",
      min: 0,
      max: 10,
      step: 1,
      unit: "/10",
      icon: <Crosshair className="w-5 h-5 text-tactical-warning" />,
      color: "text-tactical-warning",
      glow: "hover:border-tactical-warning/50",
    },
    {
      key: "claridad",
      label: "Claridad & Voces",
      sublabel: "Peaking 1.0 kHz - 3.0 kHz",
      description: "Incrementa la inteligibilidad en callouts de equipo y sonidos de recargas",
      min: 0,
      max: 10,
      step: 1,
      unit: "/10",
      icon: <Sparkles className="w-5 h-5 text-purple-400" />,
      color: "text-purple-400",
      glow: "hover:border-purple-400/50",
    },
    {
      key: "maestro",
      label: "Control Maestro (Preamp)",
      sublabel: "Margen de Ganancia General",
      description: "Ajuste fino de volumen master que se complementa con la protección anti-clipping",
      min: -12,
      max: 0,
      step: 0.5,
      unit: " dB",
      icon: <Volume2 className="w-5 h-5 text-slate-300" />,
      color: "text-slate-300",
      glow: "hover:border-slate-400/50",
    },
  ];

  const handleReset = (key: keyof SliderValues) => {
    if (disabled) return;
    const defaultVal = COMPETITIVE_DEFAULTS[key];
    onChange(key, defaultVal);
    setTimeout(() => onRelease(), 50);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {slidersConfig.map((item) => {
        const val = values[item.key];
        const isMaster = item.key === "maestro";
        const isCompression = item.key === "compresion";
        const isOwnAtt = item.key === "atenuacionPropia";

        return (
          <div
            key={item.key}
            className={`p-4 rounded-lg bg-tactical-850/80 border border-tactical-700/80 transition-all duration-200 ${item.glow} ${
              isMaster ? "md:col-span-2 bg-tactical-800/90 border-tactical-600" : ""
            } ${isCompression ? "border-tactical-accent/40 bg-tactical-800/90" : ""} ${
              isOwnAtt ? "border-amber-400/30 bg-tactical-800/80" : ""
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded bg-tactical-800 border border-tactical-700">
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-2">
                    {item.label}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {item.sublabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`font-mono text-sm px-2 py-0.5 rounded bg-tactical-900 border border-tactical-700 font-bold ${item.color}`}
                >
                  {val > 0 && isMaster ? `+${val}` : val}
                  {item.unit}
                </span>
                <button
                  onClick={() => handleReset(item.key)}
                  title="Restablecer valor por defecto"
                  className="p-1 text-slate-500 hover:text-slate-200 rounded hover:bg-tactical-700/50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <p className="text-[12px] text-slate-400 mb-3 leading-snug">
              {item.description}
            </p>

            <div className="relative flex items-center">
              <input
                type="range"
                min={item.min}
                max={item.max}
                step={item.step}
                value={val}
                disabled={disabled}
                onChange={(e) => onChange(item.key, parseFloat(e.target.value))}
                onMouseUp={onRelease}
                onTouchEnd={onRelease}
                className="w-full"
              />
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1 px-1">
              <span>{item.min}{item.unit}</span>
              <span>
                {isMaster ? "-6 dB" : isCompression ? "50%" : isOwnAtt ? "-6 dB" : "5"}
              </span>
              <span>{item.max}{item.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
