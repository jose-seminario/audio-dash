# 🎧 Audio Dash v1.4.0 ELITE

**Audio Dash** es un optimizador táctico de procesamiento de audio para Windows 11 diseñado para jugadores competitivos de *Call of Duty: Warzone*, *Counter-Strike 2*, *Valorant*, *Apex Legends* y *Escape from Tarkov*. Construido nativamente en **Rust + Tauri v2** y **React + TypeScript**, opera a través del subsistema APO de Windows (`Equalizer APO`) sin inyectar código ni interferir con motores anti-cheat (Ricochet, Vanguard, Easy Anti-Cheat).

---

## ✨ Características Principales

- **⚡ Instalación y Configuración en 1-Clic:** Descarga e instala silenciosamente Equalizer APO y configura permisos NTFS (`icacls`) y enlaces (`Include:`) en `config.txt` mediante elevación segura UAC (`-EncodedCommand` UTF-16LE).
- **👣 Ingeniería Acústica Competitiva:**
  - **Nivelador de Pasos y Disparos:** Compresión dinámica y realce psicoacústico con limitador brickwall VST (`LoudMax64`).
  - **Atenuación de Canal Central (`Pre-Mix`):** Reduce el estruendo de tus propios disparos y recargas sin alterar el posicionamiento lateral de los enemigos.
  - **Amortiguador de Bombas & Disparos:** Filtros Butterworth pasa-altos unificados y *High-Shelf* con cálculo de `Preamp` anti-clipping en tiempo real.
- **🎮 Detección Dinámica de Juegos Anti-Actualizaciones:** Reconoce automáticamente todas las variantes de ejecutables de Call of Duty (`cod.exe`, `cod24-cod.exe`, `warzone.exe`, etc.), permite re-escanear al instante y vincular nuevos ejecutables personalizados.
- **🎧 Calibración AutoEQ Harman & Radar 3D HRTF:** Perfiles paramétricos para más de 20 auriculares populares y virtualización espacial 7.1 por convolución.
- **🔥 Modo Clutch (`Ctrl+Shift+C`):** Atenúa instantáneamente las voces de Discord al 10% y focaliza las frecuencias de pasos en situaciones críticas 1vX, restaurando el volumen original al finalizar.
- **🛡️ Botón de Pánico (Rollback de Fábrica):** Respalda y restaura en cualquier momento el plan de energía de Windows, prioridades MMCSS y configuración neutral de audio.

---

## 🛠️ Stack Tecnológico

- **Backend / Sistema:** [Rust](https://www.rust-lang.org/) (Win32 API, `windows-rs`, `winreg`, `winmix`)
- **Framework de Escritorio:** [Tauri v2](https://v2.tauri.app/)
- **Frontend:** [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) + [Tailwind CSS](https://tailwindcss.com/)
- **Motor DSP del Sistema:** Equalizer APO 1.3+ (Windows Audio Processing Object)

---

## 🚀 Instalación y Desarrollo Local

### Prerrequisitos

- **Windows 10 / 11 (64 bits)**
- [Node.js](https://nodejs.org/) (v20 LTS recomendado)
- [Rust & Cargo](https://rustup.rs/) (Toolchain estable `x86_64-pc-windows-msvc`)
- Microsoft Edge WebView2 Runtime (incluido por defecto en Windows 11)

### Clonar y Ejecutar

```bash
git clone https://github.com/jose-seminario/audio-dash.git
cd audio-dash
npm install
npm run tauri dev
```

### Compilar Instalador de Producción (`.exe` / `.msi`)

```bash
npm run tauri build
```

Los instaladores generados se ubicarán en `src-tauri/target/release/bundle/`.
