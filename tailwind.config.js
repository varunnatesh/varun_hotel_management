/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        surface: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in':        'fadeIn 0.4s ease-out',
        'fade-in-up':     'fadeInUp 0.5s ease-out',
        'slide-in-right': 'slideInRight 0.35s ease-out',
        'slide-in-left':  'slideInLeft 0.35s ease-out',
        'scale-in':       'scaleIn 0.3s ease-out',
        'shimmer':        'shimmer 2s linear infinite',
        'pulse-soft':     'pulseSoft 2.5s ease-in-out infinite',
        'float':          'float 4s ease-in-out infinite',
        'spin-slow':      'spin 3s linear infinite',
        'ping-slow':      'ping 2.5s cubic-bezier(0,0,0.2,1) infinite',
        'counter':        'counter 1.2s ease-out',
        'glow':           'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
        counter: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%':   { boxShadow: '0 0 5px rgba(59,130,246,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(59,130,246,0.6)' },
        },
      },
      boxShadow: {
        'glass':       '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
        'card':        '0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.08)',
        'card-hover':  '0 4px 20px rgba(0,0,0,0.12), 0 8px 28px rgba(0,0,0,0.1)',
        'brand':       '0 4px 20px rgba(59,130,246,0.3)',
        'emerald':     '0 4px 20px rgba(16,185,129,0.3)',
        'amber':       '0 4px 20px rgba(245,158,11,0.3)',
        'danger':      '0 4px 20px rgba(239,68,68,0.3)',
        'glow-sm':     '0 0 12px rgba(59,130,246,0.25)',
        'inner-top':   'inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      backgroundImage: {
        'gradient-radial':  'radial-gradient(var(--tw-gradient-stops))',
        'shimmer-light':    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
        'mesh-dark':        'radial-gradient(at 20% 20%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(at 80% 80%, rgba(16,185,129,0.1) 0%, transparent 50%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
