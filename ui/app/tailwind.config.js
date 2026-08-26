/** Provenance typography + the reserved accents (specs/components-layouts.md
 * §visual language): mono = engine truth, serif = conversation, sans = the
 * bridge's chrome; gold reserved for gates; steel blue = navigation; a muted
 * status family that competes with neither. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      serif: ['Charter', 'Iowan Old Style', 'Georgia', 'serif'],
      mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
    extend: {
      colors: {
        // Gold means gate — the single reserved accent. Unused until Phase 2
        // renders a gate; defined now so nothing else can claim it.
        gate: { DEFAULT: '#b48a1e', dim: '#8a6a17' },
        // The bridge's own navigation family.
        nav: { DEFAULT: '#4878a8', dim: '#36618c' },
        // Muted semantic status.
        ok: '#4d7c58',
        warn: '#a1772e',
        blocked: '#a35252',
      },
      maxWidth: {
        // The Read lens is never squeezed below its minimum measure.
        measure: '60ch',
        'measure-wide': '78ch',
      },
    },
  },
  plugins: [],
};
