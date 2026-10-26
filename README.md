# 🎧 AudioDash

**AudioDash** es una aplicación de escritorio nativa y ligera diseñada para el monitoreo, análisis y gestión de audio en tiempo real. Construida con el stack moderno de **Rust** y **Tauri**, ofrece una experiencia de usuario fluida con un consumo de recursos mínimo en comparación con soluciones basadas en Electron.

---

### ✨ Características Principales

*   **⚡ Rendimiento Nativo:** Gracias a Tauri y Rust, la aplicación consume una fracción de la memoria RAM y CPU que requerirían alternativas tradicionales.
*   **🎛️ Monitoreo en Tiempo Real:** Visualización interactiva de niveles de audio, dispositivos de entrada/salida y métricas de rendimiento del sistema en tiempo real.
*   **🔒 Seguridad y Privacidad:** Diseñado para operar de forma local. La información de los dispositivos y las métricas de audio no se envían a servidores externos.
*   **🖥️ Interfaz Moderna:** UI limpia y minimalista construida con React y Tailwind CSS, adaptada para ofrecer una experiencia de usuario intuitiva.
*   **🔍 Auditoría del Sistema:** Módulos dedicados para la inspección de dependencias y monitoreo de ventanas/recursos del sistema.

---

### 🛠️ Stack Tecnológico

*   **Backend / Core:** [Rust](https://www.rust-lang.org/) 🦀
*   **Framework de Escritorio:** [Tauri](https://tauri.app/) (v2)
*   **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
*   **Estilos:** [Tailwind CSS](https://tailwindcss.com/)
*   **Empaquetado:** Vite

---

### 🚀 Instalación y Desarrollo

Sigue estos pasos para ejecutar AudioDash en tu entorno local.

#### Prerrequisitos

Asegúrate de tener instalado:
*   [Node.js](https://nodejs.org/) (v18 o superior)
*   [Rust y Cargo](https://www.rust-lang.org/tools/install) (Toolchain estable)
*   [Dependencias del sistema para Tauri](https://tauri.app/v1/guides/getting-started/prerequisites) (WebView2 en Windows, WebKit en Linux/macOS)

#### Clonar el repositorio

```bash
git clone https://github.com/jose-seminario/audio-dash.git
cd audio-dash
