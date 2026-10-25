export interface SliderValues {
  pasos: number;      // 0 - 10: Boost 2500Hz & 4000Hz (Footsteps)
  bombas: number;     // 0 - 10: High-Pass 120Hz & Low-Shelf 200Hz -4dB (Explosion dampener)
  disparos: number;   // 0 - 10: High-Shelf 6000Hz -3dB (Gunshot tamer)
  claridad: number;   // 0 - 10: Peaking 1000Hz - 3000Hz (Vocal clarity)
  maestro: number;    // -12 to 0 dB: Preamp Master Control (Anti-clipping headroom)
}

export type ProfileType = 'JUEGOS' | 'NORMAL';
export type ProfileMode = 'auto' | 'manual';

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
