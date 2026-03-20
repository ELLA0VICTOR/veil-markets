/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"SUSE Mono"', "monospace"],
        sans: ['"Space Grotesk"', "sans-serif"],
      },
      colors: {
        bg:       "var(--bg)",
        card:     "var(--bg-card)",
        cyan:     "var(--cyan)",
        green:    "var(--green)",
        red:      "var(--red)",
        amber:    "var(--amber)",
      },
    },
  },
  plugins: [],
};
