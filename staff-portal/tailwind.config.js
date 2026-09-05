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
          red: '#E52327',
          redDark: '#C1161A',
          navy: '#1A1E5C',
          navyDark: '#121543',
          navyLight: '#2A318A',
          skyblue: '#00A6EB',
          skyblueLight: '#E3F5FC',
          gold: '#FFC800',
          goldDark: '#D9AB00',
        }
      }
    },
  },
  plugins: [],
}
