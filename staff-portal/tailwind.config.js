/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ncc: {
          red: '#EF1C25',
          redDark: '#C7131B',
          navy: '#2D3092',
          navyDark: '#1E216B',
          navyLight: '#3F43B5',
          lightblue: '#00AEEF',
          lightblueLight: '#E5F7FD',
          gold: '#FFCB06',
          goldDark: '#D9AB00',
        }
      }
    },
  },
  plugins: [],
}
