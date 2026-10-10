/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard Variable', 'Pretendard',
          '-apple-system', 'BlinkMacSystemFont', 'system-ui',
          'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', 'sans-serif',
        ],
        mono: ['D2Coding', 'Consolas', 'Menlo', 'Monaco', 'monospace'],
      },
      colors: {
        dk: {
          // 테마 가능한 primary trio — CSS 변수로 정의 (index.css), alpha 모디파이어 호환
          navy: 'rgb(var(--dk-navy) / <alpha-value>)',
          blue: 'rgb(var(--dk-blue) / <alpha-value>)',
          cyan: 'rgb(var(--dk-cyan) / <alpha-value>)',
          // 의미 색상 (테마와 무관, 고정)
          green: '#6FAA52',
          orange: '#FB8C00',
          red: '#BC2C2D',
          purple: '#663399',
        },
        gray: {
          50: '#F4F6F8',
          100: '#E5E7EB',
          200: '#D1D5DB',
          300: '#9CA3AF',
          400: '#6B7280',
          500: '#4B5563',
          600: '#374151',
          700: '#1F2937',
        },
      },
    },
  },
  plugins: [],
};
