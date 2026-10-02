/** Colors are CSS variables holding RGB channels, so opacity utilities (bg-hand/10) work in both themes. */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'), surface: c('surface'), surface2: c('surface2'),
        ink: c('ink'), muted: c('muted'), line: c('line'), 'line-soft': c('line-soft'),
        'on-accent': c('on-accent'), ok: c('ok'), live: c('live'),
        // One hue per phonological parameter — used consistently everywhere that parameter appears.
        expression: c('expression'),
        hand: c('hand'),
        movement: c('movement'),
        head: c('head'),
        location: c('location'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', '"Atkinson Hyperlegible Next"', 'system-ui', 'sans-serif'],
        sans: ['"Atkinson Hyperlegible Next"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"Atkinson Hyperlegible Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: {
        lift: '0 1px 0 rgb(var(--line) / 0.6), 0 8px 24px -12px rgb(var(--ink) / 0.18)',
      },
    },
  },
  plugins: [],
};
