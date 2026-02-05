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
          redLight: "#FF4D6A",
          redDark: "#A80F2E",
          gold: "#FFD700",
          goldLight: "#FFE44D",
          goldDark: "#C9A800",
        },
        dark: {
          bg: "#0F1419",
          bgSecondary: "#1A1F26",
          bgTertiary: "#242B33",
          border: "#2D3748",
          text: "#E8ECEF",
          textMuted: "#9CA3AF",
        },
      },
      fontFamily: {
        sans: ["Source Han Sans", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
