/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
      },
      colors: {
        esg: {
          forest: '#0d3b2e',
          sage: '#2d5a4a',
          mint: '#7eb89a',
          cream: '#f5f0e8',
          amber: '#c4952e',
          alert: '#b91c1c',
          success: '#15803d',
          /* Telemetry domain accents (sustainability metrics) */
          carbon: '#4a5568',
          water: '#2b6a8a',
          efficiency: '#2d5a4a',
          hardware: '#5a4a6a',
          'data-quality': '#6a5a4a',
          scorecard: '#0d3b2e',
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.85 },
        },
      },
    },
  },
  plugins: [],
};
