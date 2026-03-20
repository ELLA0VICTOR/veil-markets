/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "bg-base": "var(--bg-base)",
        "bg-surface": "var(--bg-surface)",
        "bg-elevated": "var(--bg-elevated)",
        "bg-hover": "var(--bg-hover)",
        accent: "var(--accent)",
        "accent-bright": "var(--accent-bright)",
        "accent-dim": "var(--accent-dim)",
        "yes-color": "var(--yes-color)",
        "yes-dim": "var(--yes-dim)",
        "no-color": "var(--no-color)",
        "no-dim": "var(--no-dim)",
        pending: "var(--pending)",
        "pending-dim": "var(--pending-dim)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
      },
      fontFamily: {
        display: ["Syne", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
        body: ["Plus Jakarta Sans", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
    },
  },
  plugins: [],
};
