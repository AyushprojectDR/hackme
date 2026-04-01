import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        bg:      '#020817',
        surface: 'rgba(15,23,42,0.75)',
        border:  'rgba(99,102,241,0.2)',
        accent:  '#6366f1',
        sky:     '#0ea5e9',
        violet:  '#a78bfa',
        success: '#22c55e',
        danger:  '#ef4444',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.45s ease forwards',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },               to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(18px)' },
                   to:   { opacity: '1', transform: 'translateY(0)' } },
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cpath d='M 40 0 L 0 0 0 40' fill='none' stroke='rgba(99,102,241,0.06)' stroke-width='1'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}
export default config
