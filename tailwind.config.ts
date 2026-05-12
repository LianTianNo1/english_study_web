import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 编辑式笔记本配色 —— 奶油纸 + 深墨 + 复古柿橙 + 墨蓝
        paper: '#FBF7F0',        // 主背景：奶油纸
        paper2: '#F4ECDF',       // 次背景：略深的纸色
        paper3: '#EADFC8',       // 分隔线/底纹
        ink: '#1A1614',          // 主文本：深墨
        ink2: '#3B342E',         // 次级文本
        ink3: '#6B6058',         // 弱文本
        muted: '#A89B8E',        // 占位/边框
        // 单一记忆色：复古柿橙
        persimmon: {
          DEFAULT: '#D9501F',
          50: '#FBE9DF',
          100: '#F6CFB9',
          300: '#E68861',
          500: '#D9501F',
          600: '#B83F12',
          700: '#8C2F0D',
        },
        // 第二色：墨蓝（语法模块）
        indigo2: {
          DEFAULT: '#243B5C',
          50: '#E6EAF1',
          300: '#6B85AB',
          500: '#243B5C',
          700: '#162236',
        },
        // 第三色：苔藓绿（成功/掌握）
        moss: {
          DEFAULT: '#5B7F4C',
          50: '#E8EDE3',
          300: '#8AA77D',
          500: '#5B7F4C',
          700: '#3D5832',
        },
        // 红色仅用于错误
        crimson: {
          DEFAULT: '#A8362B',
          50: '#F4DCD8',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"DM Sans"', '"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        '7xl': ['5rem', { lineHeight: '0.95', letterSpacing: '-0.04em' }],
        '6xl': ['4rem', { lineHeight: '0.98', letterSpacing: '-0.035em' }],
        '5xl': ['3rem', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
      },
      boxShadow: {
        paper: '0 1px 0 rgba(26,22,20,0.04), 0 8px 24px -12px rgba(26,22,20,0.12)',
        tape: '2px 4px 0 rgba(26,22,20,0.08)',
        ink: '0 2px 0 #1A1614',
        focus: '0 0 0 3px rgba(217, 80, 31, 0.25)',
      },
      backgroundImage: {
        noise:
          'url("data:image/svg+xml;utf8,<svg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\' numOctaves=\'3\' stitchTiles=\'stitch\'/><feColorMatrix values=\'0 0 0 0 0.1 0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 0.05 0\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\'/></svg>")',
        dots:
          'radial-gradient(circle, #A89B8E 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'underline-grow': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        'pop': {
          '0%': { transform: 'scale(0.94)' },
          '60%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'underline-grow': 'underline-grow 0.6s 0.2s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        'pop': 'pop 0.35s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
