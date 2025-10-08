PR: Migrate hard-coded Tailwind color utilities to theme-safe tokens (apps/web)

What this PR does
-----------------
- Replaces usages of literal Tailwind color-scale utility classes in the storefront (`apps/web`) with theme-safe tokens and helper classes where appropriate.
- Adds conservative codemods and scripts to help audit and migrate additional occurrences safely:
  - `replace-tailwind-colors.js` — simple string-based codemod (dry-run default).
  - `ast-replace-tailwind.js` — AST-aware replacer for safe string literals.
  - `ast-replace-cn-clsx.js` — AST replacer targeting `cn(...)` and `clsx(...)` call arguments.
- Adds a small shadcn-style POC and compatibility shims for components (Button/Card) and a `cn` util re-export to keep existing imports working.
- Converts several UI components to use `cn(...)` instead of template-literal `className` strings where safe (reduces risky dynamic class concatenation).

Files changed (high level)
-------------------------
- scripts/
  - `replace-tailwind-colors.js` (added)
  - `ast-replace-tailwind.js` (added)
  - `ast-replace-cn-clsx.js` (added)
  - `color-mapping.json` (mapping of conservative replacements)
  - `MANUAL_REVIEW.md`, `ROLL_OUT.md`, `README-THEME.md` (docs)
- lib/
  - `utils.ts` (re-export of `cn`) — compatibility shim for generated components
- components/
  - adjusted `components/ui/*` (ProductCard, UserMenu, Button, Card, WishlistButton and shadcn POC) — convert safe template-literals to `cn(...)` and add small compatibility props

What I did (process)
--------------------
1. Audited the `apps/web` sources for literal color-scale utility classes using a conservative regex and an AST-based search. No remaining direct literal color utilities were found in source files (excluding `app/globals.css` and compiled `.next` artifacts).
2. Added conservative mappings to `color-mapping.json` and two codemods (string-based and AST-aware) that can perform automated replacements when safe.
3. Added `ast-replace-cn-clsx.js` to specifically target `cn(...)` and `clsx(...)` call arguments — conservative: only replaces string-literal and no-substitution template literals.
4. Converted a small batch of UI components to use `cn(...)` instead of template literals to make future automated replacements safer and consistent.
5. Ran full `pnpm --filter @apps/web run build` and verified the build completes successfully and static pages are generated.

Verification
------------
- Ran the codemods in dry-run mode (no files changed by the codemods in this repo state):
  - `node apps/web/scripts/replace-tailwind-colors.js --dry-run` — no matches
  - `node apps/web/scripts/ast-replace-tailwind.js --dry-run` — no replaceable occurrences
  - `node apps/web/scripts/ast-replace-cn-clsx.js --dry-run` — no replaceable occurrences
- Ran the web build:
  - `pnpm --filter @apps/web run build` — compiled successfully, types passed, pages generated.

Manual review items
-------------------
See `apps/web/scripts/MANUAL_REVIEW.md` — it lists dynamic/ambiguous patterns that require human review (template literals with expressions, conditional/cn usage mixing variables and literals, helper functions that return classes). I converted many easy cases already; the remaining items are documented and can be migrated incrementally.

How to run the codemods
-----------------------
- Dry-run (safe):
  - node apps/web/scripts/replace-tailwind-colors.js --dry-run
  - node apps/web/scripts/ast-replace-tailwind.js --dry-run
  - node apps/web/scripts/ast-replace-cn-clsx.js --dry-run
- Apply (only when dry-run output has been reviewed):
  - node apps/web/scripts/replace-tailwind-colors.js --apply
  - node apps/web/scripts/ast-replace-tailwind.js --apply
  - node apps/web/scripts/ast-replace-cn-clsx.js --apply

Notes and recommendations
-------------------------
- This PR intentionally takes a conservative approach: automated replacements only occur where the script can be 100% certain. Dynamic template-literals and conditional arrays are left for manual review to avoid accidental visual regressions.
- After merging, consider a small visual regression run (Playwright snapshots or screenshots) across critical pages (home, product, checkout, cart) to confirm no regressions.
- If you'd like, I can extend the AST codemod to handle a narrow set of conditional patterns (e.g., `cn(isActive && 'text-yellow-400')`) and run it in a follow-up PR.

If you'd like me to run the codemods with --apply now, say "apply now" and I'll run them, fix any fallout, and push the follow-up commit.
