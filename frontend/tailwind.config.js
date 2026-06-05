/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FAD4C0',
          light:   '#FDE8DC',
          dark:    '#F0C4B0',
          text:    '#7C4A2D',
        },
        secondary: {
          DEFAULT: '#80A1C1',
          light:   '#B8CDE0',
          dark:    '#5A82A8',
          text:    '#2C5282',
        },
        surface: {
          DEFAULT: '#FFF5E6',
          card:    '#FFFFFF',
          border:  '#E8D5C4',
        },
        danger:  '#ef4444',
        warning: '#f59e0b',
        info:    '#3b82f6',
        success: '#22c55e',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}