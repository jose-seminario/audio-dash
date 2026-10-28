import React, { useState } from "react";
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
  HelpCircle,
} from "lucide-react";

interface AudioSlidersProps {
  values: SliderValues;
  onChange: (key: keyof SliderValues, val: number) => void;
  onRelease: () => void;
  disabled?: boolean;
  isNormalProfile?: boolean;
}

const COMPETITIVE_DEFAULTS: Record<keyof SliderValues, number> = {
  compresion: 65,
  atenuacionPropia: -6.0,
  pasos: 7.5,
  bombas: 4.0,
  disparos: 3.5,
  claridad: 6.0,
  maestro: 0.0,
};

const NORMAL_DEFAULTS: Record<keyof SliderValues, number> = {
  compresion: 0,
  atenuacionPropia: 0,
  pasos: 0,
  bombas: 0,
  disparos: 0,
  claridad: 0,
  maestro: 0,
};

export const AudioSliders: React.FC<AudioSlidersProps> = ({
  values,
  onChange,
  onRelease,
  disabled = false,
  isNormalProfile = false,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const slidersConfig: {
    key: keyof SliderValues;
    label: string;
    sublabel: string;
    tooltip: string;
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
      label: "Nivelador de Pasos y Disparos",
      sublabel: "Compresor de estudio LoudMax VST",
      tooltip: "Iguala el volumen: sube los sonidos débiles (pasos) y limita los fuertes (tiros).",
      description: "Sube automáticamente las pisadas lejanas y fija un límite para que los disparos no te ensordezcan.",
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
      label: "Silenciar mis propios disparos",
      sublabel: "Canal Central (C) Pre-Mix",
      tooltip: "Amortigua tus propios tiros y recargas para no tapar los pasos rivales.",
      description: "Amortigua el sonido de tu propia arma en el canal central sin alterar la dirección de pasos en los lados.",
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
      tooltip: "Aumenta el volumen de pisadas y movimientos enemigos en cualquier superficie.",
      description: "Aumenta la presencia acústica de pasos, crujidos y saltos de los enemigos.",
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
      sublabel: "Corte de subgraves",
      tooltip: "Reduce el estruendo de granadas y ataques aéreos para que no te ensordezcan.",
      description: "Corta las frecuencias bajas para que las explosiones y ataques aéreos no tapen los pasos.",
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
      sublabel: "Filtro High-Shelf 6.0 kHz",
      tooltip: "Suaviza el chasquido agudo de balas para evitar fatiga auditiva.",
      description: "Suaviza el chasquido agudo de armas automáticas reduciendo el dolor de oídos en partidas largas.",
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
      sublabel: "Resalte de detalles tácticos",
      tooltip: "Resalta detalles acústicos como recargas, placas de blindaje y puertas.",
      description: "Incrementa la nitidez en sonidos de placas de blindaje, puertas y avisos del equipo.",
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
      sublabel: "Ajuste fino de volumen",
      tooltip: "Volumen general calibrado con protección anti-clipping contra distorsión.",
      description: "Ajuste fino del volumen final protegido con anti-clipping automático.",
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
    const defaultVal = isNormalProfile ? NORMAL_DEFAULTS[key] : COMPETITIVE_DEFAULTS[key];
    onChange(key, defaultVal);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {slidersConfig.map((item) => {
        const val = values[item.key];
        const isMaster = item.key === "maestro";
        const isCompression = item.key === "compresion";
        const isOwnAtt = item.key === "atenuacionPropia";
        const showTooltip = activeTooltip === item.key;

        return (
          <div
            key={item.key}
            className={`p-3.5 rounded-xl bg-tactical-850/90 border border-tactical-700/80 transition-all duration-200 relative ${item.glow} ${
              isMaster ? "md:col-span-2 bg-tactical-800/90 border-tactical-600" : ""
            } ${isCompression ? "border-tactical-accent/40 bg-tactical-800/90" : ""} ${
              isOwnAtt ? "border-amber-400/30 bg-tactical-800/80" : ""
            } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 rounded-lg bg-tactical-800 border border-tactical-700">
                  {item.icon}
                </div>
                <div>
                  <div className="flex items-center space-x-1.5">
                    <h4 className="text-xs font-bold tracking-wide text-slate-100">
                      {item.label}
                    </h4>
                    {/* Tooltip trigger */}
                    <button
                      type="button"
                      onMouseEnter={() => setActiveTooltip(item.key)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => setActiveTooltip(showTooltip ? null : item.key)}
                      className="text-slate-400 hover:text-tactical-accent transition-colors focus:outline-none"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">
                    {item.sublabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span
                  className={`font-mono text-xs px-2 py-0.5 rounded bg-tactical-900 border border-tactical-700 font-bold ${item.color}`}
                >
                  {val > 0 && isMaster ? `+${val}` : val}
                  {item.unit}
                </span>
                <button
                  onClick={() => handleReset(item.key)}
                  title="Restablecer valor óptimo"
                  className="p-1 text-slate-500 hover:text-slate-200 rounded hover:bg-tactical-700/50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick 1-line friendly tooltip banner */}
            {showTooltip ? (
              <div className="p-2 mb-2 rounded bg-tactical-900 border border-tactical-accent/40 text-[11px] text-tactical-accent font-mono leading-snug animate-in fade-in duration-100">
                💡 {item.tooltip}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mb-2.5 leading-snug">
                {item.description}
              </p>
            )}

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
