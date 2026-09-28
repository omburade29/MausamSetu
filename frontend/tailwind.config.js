/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        paper: "#eef3f8",
        card: "#ffffff",
        line: "#d7e0ea",
        field: "#0b1c33",
        leaf: "#0f766e",
        monsoon: "#0369a1",
        watch: "#a16207",
        warn: "#c2410c",
        severe: "#b91c1c",
        ok: "#166534",
        muted: "#5b6b7c",
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Nirmala UI"', "sans-serif"],
        serif: ['"Segoe UI"', '"Nirmala UI"', "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};
