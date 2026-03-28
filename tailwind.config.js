
export default {
  content: [
  './index.html',
  './src/**/*.{js,ts,jsx,tsx}'
],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans Thai"', 'sans-serif'],
      },
      colors: {
        app: {
          black: '#0A0A0A',
          dark: '#1A1A1A',
          red: '#DC2626',
          'red-dark': '#991B1B',
        }
      }
    },
  },
  plugins: [],
}
