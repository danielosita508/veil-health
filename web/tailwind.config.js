/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0B0B0E",
        surface: "#101016",
        card: "#13131A",
        cardHover: "#1A1A24",
        border: "#20202A",
        borderLight: "#2C2C3A",
        primary: {
          DEFAULT: "#F4B728",
          hover: "#E0A31E",
          subtle: "rgba(244, 183, 40, 0.12)",
        },
        secondary: {
          DEFAULT: "#F4B728",
          hover: "#E0A31E",
          subtle: "rgba(244, 183, 40, 0.12)",
        },
        accent: {
          DEFAULT: "#F4B728",
          hover: "#E0A31E",
          subtle: "rgba(244, 183, 40, 0.14)",
        },
        amber: {
          zcash: "#F4B728",
          hover: "#E0A31E",
          subtle: "rgba(244, 183, 40, 0.12)",
        },
        veil: {
          surface: "#101016",
          muted: "#9494A8",
          text: "#F4F4F8",
          danger: "#EF4444",
          success: "#10B981",
        },
      },
      fontFamily: {
        serif: ["Fraunces", "serif"],
        heading: ["Fraunces", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
