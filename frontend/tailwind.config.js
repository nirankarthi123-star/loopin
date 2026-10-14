/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "Consolas", "monospace"],
      },
      colors: {
        // LoopIn brand — violet
        brand: {
          50:  "hsl(250 100% 97%)",
          100: "hsl(250 96% 93%)",
          200: "hsl(250 93% 86%)",
          300: "hsl(250 90% 76%)",
          400: "hsl(250 86% 68%)",
          500: "hsl(250 84% 60%)",
          600: "hsl(250 78% 50%)",
          700: "hsl(250 74% 42%)",
          800: "hsl(250 68% 34%)",
          900: "hsl(250 62% 26%)",
          950: "hsl(250 58% 18%)",
        },
        // Electric lime — accent (restrained use only)
        lime: {
          50:  "hsl(74 100% 96%)",
          100: "hsl(74 100% 90%)",
          200: "hsl(74 100% 80%)",
          300: "hsl(74 100% 66%)",
          400: "hsl(74 100% 52%)",
          500: "hsl(74 100% 40%)",
          600: "hsl(74 96% 34%)",
        },
        // Neutral surface (light)
        surface: {
          DEFAULT: "hsl(220 16% 97%)",
          card:    "hsl(0 0% 100%)",
          border:  "hsl(220 13% 91%)",
          "border-strong": "hsl(220 13% 82%)",
          muted:   "hsl(220 13% 95%)",
        },
        // Text scale
        ink: {
          DEFAULT: "hsl(222 47% 11%)",
          muted:   "hsl(220 9% 46%)",
          subtle:  "hsl(220 9% 64%)",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      animation: {
        "fade-in":   "fadeIn 0.25s ease-out both",
        "slide-up":  "slideUp 0.3s ease-out both",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:   { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp:  { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        pulseDot: { "0%,100%": { transform: "scale(1)", opacity: "1" }, "50%": { transform: "scale(1.3)", opacity: "0.6" } },
      },
      boxShadow: {
        "card": "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 16px 0 rgb(0 0 0 / 0.10), 0 2px 4px -1px rgb(0 0 0 / 0.06)",
        "brand": "0 4px 14px 0 hsl(250 84% 60% / 0.3)",
        "brand-sm": "0 2px 6px 0 hsl(250 84% 60% / 0.25)",
      },
    },
  },
  plugins: [],
};
