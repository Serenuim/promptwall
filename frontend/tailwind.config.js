/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:      '#050700',
        card:    '#001200',
        accent:  '#00ff41',
        'accent-dim': '#00cc33',
        danger:  '#ff3b3b',
        warning: '#ffaa00',
        muted:   '#0a1a0a',
        border:  '#0d2000',
      },
      fontFamily: {
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans:    ['Syne', 'system-ui', 'sans-serif'],
        display: ['Bebas Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
