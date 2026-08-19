import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  {
    rules: {
      /* OFF, deliberately, for this codebase only.
       *
       * The rule assumes client-side navigation is always the better answer. This site
       * decided otherwise, on purpose and with the reason recorded: every route change is
       * a full document load, because the Preloader curtain and the entrance choreography
       * are armed at document load. A <Link> would navigate without one, and sections
       * would paint composed and then snap back to play — the exact "obvious shortcut"
       * tell the whole design is built to avoid.
       *
       * Leaving the rule on produced 23 errors that were all correct-by-the-rule and all
       * wrong-for-this-site, which is worse than useless: a lint run nobody trusts is a
       * lint run nobody reads, and the next real error goes past unnoticed. Turned off at
       * S8 so `npm run check` means something again.
       *
       * If the choreography is ever reworked to survive client navigation, delete this
       * block first — the errors it hides are the map of what to change. */
      "@next/next/no-html-link-for-pages": "off",
    },
  },
]);

export default eslintConfig;
