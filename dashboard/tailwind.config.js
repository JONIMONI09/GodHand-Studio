/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        minecraft: {
          dark: '#1e1e1e',
          gray: '#3c3c3c',
          green: '#5b8731',
          gold: '#fdb813',
        }
      }
    },
  },
  plugins: [],
}
