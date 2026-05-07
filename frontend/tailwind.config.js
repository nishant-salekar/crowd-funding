/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // ── Nuke Default Colors: Restrict strictly to White, Dusty Blue, Beige (+ Black void) ──
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#ffffff',
      black: '#000000',

      // Remap all classic Tailwind colors generated dynamically throughout the HTML components 
      // into purely interpolated steps of White, Beige (#e8dfd5), and Dusty Blue (#8a9ea8).
      indigo: { 50: '#ffffff', 100: '#e8dfd5', 200: '#dcd1c4', 300: '#afbccc', 400: '#9eb0be', 500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      purple: { 50: '#ffffff', 100: '#ffffff', 200: '#e8dfd5', 300: '#e8dfd5', 400: '#afbccc', 500: '#8a9ea8', 600: '#6d818d', 700: '#36454f', 800: '#1e262c', 900: '#000000', 950: '#000000' },
      cyan:   { 50: '#ffffff', 100: '#e8dfd5', 200: '#dcd1c4', 300: '#afbccc', 400: '#9eb0be', 500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      blue:   { 50: '#ffffff', 100: '#e8dfd5', 200: '#dcd1c4', 300: '#afbccc', 400: '#9eb0be', 500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      red:    { 50: '#ffffff', 100: '#e8dfd5', 200: '#dcd1c4', 300: '#afbccc', 400: '#9eb0be', 500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      green:  { 50: '#ffffff', 100: '#e8dfd5', 200: '#dcd1c4', 300: '#afbccc', 400: '#9eb0be', 500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      emerald:{ 50: '#ffffff', 100: '#e8dfd5', 200: '#dcd1c4', 300: '#afbccc', 400: '#9eb0be', 500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      
      slate:  { 50: '#ffffff', 100: '#ffffff', 200: '#e8dfd5', 300: '#e8dfd5', 400: '#dcd1c4', 500: '#afbccc', 600: '#8a9ea8', 700: '#6d818d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      gray:   { 50: '#ffffff', 100: '#ffffff', 200: '#e8dfd5', 300: '#e8dfd5', 400: '#dcd1c4', 500: '#afbccc', 600: '#8a9ea8', 700: '#6d818d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },
      zinc:   { 50: '#ffffff', 100: '#ffffff', 200: '#e8dfd5', 300: '#e8dfd5', 400: '#dcd1c4', 500: '#afbccc', 600: '#8a9ea8', 700: '#6d818d', 800: '#36454f', 900: '#1e262c', 950: '#000000' },

      // Map previously rigid custom theme keys
      brand: {
        50:  '#ffffff', 100: '#ffffff', 200: '#e8dfd5', 300: '#afbccc', 400: '#9eb0be', 
        500: '#8a9ea8', 600: '#6d818d', 700: '#50626d', 800: '#36454f', 900: '#1e262c', 950: '#000000'
      },
      dark: {
        900: "#000000", 800: "#000000", 700: "#030405", 600: "#080b0e", 500: "#141920", 400: "#222a33", 300: "#384552" 
      },
      neon: {
        purple: "#e8dfd5", blue: "#8a9ea8", cyan: "#8a9ea8", green: "#e8dfd5", pink: "#e8dfd5"
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      backgroundImage: {
        "hero-gradient": "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(138,158,168,0.2), transparent)",
        "card-gradient":   "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.01) 100%)",
        "progress-gradient": "linear-gradient(90deg, #8a9ea8, #e8dfd5, #ffffff)",
        "btn-gradient": "linear-gradient(135deg, #8a9ea8 0%, #6d818d 100%)",
      },
      boxShadow: {
        "glass": "0 8px 32px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
        "card":  "0 4px 24px rgba(0,0,0,0.7)",
        "glow":  "0 0 30px rgba(138,158,168,0.35)",  
        "glow-sm": "0 0 15px rgba(138,158,168,0.25)",
        "btn":   "0 4px 20px rgba(138,158,168,0.4)",
      },
      animation: {
        "fade-in":    "fadeIn 0.5s ease-out",
        "slide-up":   "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s infinite",
        "shimmer":    "shimmer 2s linear infinite",
        "float":      "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn:  { "0%": { opacity: 0 }, "100%": { opacity: 1 } },
        slideUp: { "0%": { opacity: 0, transform: "translateY(20px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-10px)" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
