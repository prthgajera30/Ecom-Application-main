This folder contains a small conservative codemod and mapping to help migrate literal Tailwind color utilities to theme-safe tokens.

- replace-tailwind-colors.js
  - Scans the apps/web source tree for common Tailwind color utility classes (text-*, bg-*, border-*) using a conservative regex.
  - Uses color-mapping.json to map literal classes to theme-safe replacements.
  - Run in dry-run mode (default): node replace-tailwind-colors.js --dry-run
  - To apply changes: node replace-tailwind-colors.js --apply

Notes:
- This script is intentionally conservative. It only updates explicit matches found by a simple regex and only when there is an exact mapping in color-mapping.json.
- Do NOT use this script to update classes inside apps/web/app/globals.css (the file is excluded and should remain the source of truth for theme variables and helper classes).
- After applying changes, visually test components and run the build to ensure no regressions.
