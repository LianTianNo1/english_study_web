import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 温暖友好主题
        cream: {
          50: '#FFFBF5',
          100: '#FEF6E7',
          200: '#FCEACB',
        },
        warm: {
          50: '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#F97316', // 主强调色
          600: '#EA580C',
          700: '#C2410C',
        },
        ink: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          400: '#94A3B8',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        mint: {
          400: '#34D399',
          500: '#10B981',
        },
        sky2: {
          400: '#60A5FA',
          500: '#3B82F6',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        soft: '0 4px 24px -8px rgba(251, 146, 60, 0.18)',
        card: '0 2px 12px -4px rgba(15, 23, 42, 0.08)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'pop': { '0%': { transform: 'scale(0.96)' }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out',
        'pop': 'pop 0.3s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
