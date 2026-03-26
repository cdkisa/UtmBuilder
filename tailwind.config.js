/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f3f0ff',
          100: '#e9e3ff',
          200: '#d4c9ff',
          300: '#b5a0ff',
          400: '#9171f5',
          500: '#7c5cbf',
          600: '#6b4aad',
          700: '#5a3d91',
          800: '#4a3377',
          900: '#3d2b62',
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
