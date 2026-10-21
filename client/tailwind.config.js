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
        'on-accent': c('on-accent'), ok: c('ok'), live: c('live'), chart: c('chart-1'),
        // Brand: plum accent, its lighter partner, the orange glow and the lavender haze.
        accent: c('accent'), 'accent-2': c('accent-2'), glow: c('glow'), haze: c('haze'),
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
        lift: '0 1px 0 rgb(var(--line) / 0.6), 0 18px 40px -18px rgb(var(--accent) / 0.28)',
        soft: '0 1px 2px rgb(var(--ink) / 0.04), 0 12px 32px -20px rgb(var(--accent) / 0.22)',
        glow: '0 8px 22px -10px rgb(var(--accent) / 0.55)',
      },
    },
  },
  plugins: [],
};
