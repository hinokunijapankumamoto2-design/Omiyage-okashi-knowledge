/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        caramel: "#8A5A2B",
        heading: "#3D2B1F",
        cream: "#FBF7F1",
        tablehead: "#F3E7D8",
        accent: "#B0413E",
      },
      fontFamily: {
        sans: ['"Yu Gothic"', '"Hiragino Sans"', '"Noto Sans JP"', "sans-serif"],
      },
    },
  },
  plugins: [],
};
