import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        // School-paper handwritten vibe for the dossier surfaces.
        casefile: ['"Caveat"', '"Patrick Hand"', 'cursive'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      colors: {
        paper: '#fbf6e9',
        ink: '#1f1c18',
        stamp: '#c0392b',
        marker: '#f1c40f',
      },
      backgroundImage: {
        grid: 'linear-gradient(#dcd2b6 1px, transparent 1px), linear-gradient(90deg, #dcd2b6 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid-sm': '24px 24px',
      },
    },
  },
  plugins: [],
};

export default config;
