import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'sf-bg':    '#03080F',
        'sf-bg2':   '#060D18',
        'sf-card':  '#0D1B2E',
        'sf-blue':  '#1B7FFF',
        'sf-cyan':  '#00D4FF',
        'sf-green': '#00E576',
        'sf-red':   '#FF3B5C',
        'sf-amber': '#FFB020',
      },
      fontFamily: {
        syne: ['Syne', 'system-ui', 'sans-serif'],
        dm:   ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
