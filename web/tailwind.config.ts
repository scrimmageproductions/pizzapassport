import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tomato: "#C8102E",
        mozzarella: "#FFFDD0",
        charcoal: "#1C1C1E",
        crust: "#D1A34F",
        basil: "#2E7D32",
      },
      fontFamily: {
        serif: ["Georgia", "ui-serif", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
