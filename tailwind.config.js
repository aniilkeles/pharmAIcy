/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F0F0F',
        surface: '#1A1A1A',
        card: '#242424',
        border: '#2E2E2E',
        accent: '#00C896',
        blue: '#5B8DEF',
        warning: '#F59E0B',
        danger: '#EF4444',
        success: '#10B981',
        text: '#EDEDEC',
        muted: '#6B6B6B'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
}
