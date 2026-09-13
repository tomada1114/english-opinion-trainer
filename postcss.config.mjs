/**
 * Tailwind v4's PostCSS entry point.
 *
 * Tailwind v4 is configured in CSS, not in JavaScript: the theme lives in
 * `src/app/globals.css`'s `@theme` blocks, and there is deliberately no
 * `tailwind.config.*` for a reader to have to reconcile with it.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
