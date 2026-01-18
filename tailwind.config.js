/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        china: {
          red: "#DC143C",
          gold: "#FFD700",
        },
      },
      fontFamily: {
        sans: ["Source Han Sans", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};