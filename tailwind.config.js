/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tactical: {
          900: "#0b0e14",
          850: "#0f131a",
          800: "#151b24",
          700: "#1d2532",
          600: "#2a3445",
          accent: "#00f0ff",
          green: "#00ff66",
          alert: "#ff3366",
          warning: "#ffaa00",
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
