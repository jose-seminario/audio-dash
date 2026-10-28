export interface SliderValues {
  pasos: number;            // 0 - 10: Boost 2500Hz & 4000Hz (Footsteps)
  bombas: number;           // 0 - 10: High-Pass 120Hz & Low-Shelf 200Hz (Explosions)
  disparos: number;         // 0 - 10: High-Shelf 6000Hz (Gunshots tamer)
  claridad: number;         // 0 - 10: Peaking 1500Hz (Voice clarity)
  compresion: number;       // 0 - 100%: Dynamic Loudness VST Limiter
  atenuacionPropia: number; // 0 a -12 dB: Atenuación canal central (C) contra propios disparos
  maestro: number;          // -12 to 0 dB: Preamp Master Control
}

export type ProfileType = 'JUEGOS' | 'NORMAL';
export type ProfileMode = 'auto' | 'manual';

export interface HeadphoneProfile {
  id: string;
  name: string;
  brand: string;
  type: 'Over-Ear' | 'IEM';
  filters: string[];
}

export interface HrtfProfile {
  id: string;
  name: string;
  brand: string;
  description: string;
  filename: string;
}

export interface AudioDevice {
  id: string;
  name: string;
  endpoint_name: string;
  is_virtual_cable: boolean;
}

export interface DependencyStatus {
  equalizer_apo_installed: boolean;
  config_linked: boolean;
  installed_path: string | null;
  first_run_completed: boolean;
  details: string;
}

export interface AuditCheckItem {
  id: string;
  name: string;
  status: 'optimal' | 'warning' | 'suboptimal';
  current_value: string;
  recommended: string;
  description: string;
}

export interface SystemAuditResult {
  all_optimal: boolean;
  checks: AuditCheckItem[];
  timestamp: string;
}

export interface ProcessScanResult {
  process_name: string;
  window_title: string;
  is_game: boolean;
  matched_by: string;
}
