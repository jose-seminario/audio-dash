/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        surface: "var(--bg-surface)",
        secondary: "var(--bg-secondary)",
        tertiary: "var(--bg-tertiary)",
        hover: "var(--bg-hover)",
        active: "var(--bg-active)",
        
        "border-subtle": "var(--border-subtle)",
        "border-glow": "var(--border-glow)",
        
        "accent-primary": "var(--accent-primary)",
        "accent-cyan": "var(--accent-cyan)",
        "accent-ice": "var(--accent-ice)",
        "accent-glow": "var(--accent-glow)",
        
        primary: "var(--text-primary)",
        secondary_text: "var(--text-secondary)",
        muted: "var(--text-muted)",
        
        status: {
          online: "var(--status-online)",
          idle: "var(--status-idle)",
          dnd: "var(--status-dnd)",
          offline: "var(--status-offline)",
        }
      },
      borderRadius: {
        DEFAULT: "var(--radius-default)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        'glow-sm': '0 0 15px -3px var(--accent-glow)',
        'glow-md': '0 0 25px -4px var(--accent-glow)',
      }
    },
  },
  plugins: [],
}
