Rollout strategy for migrating literal Tailwind color utilities to theme-safe tokens

Goal
----
Replace hard-coded Tailwind color-scale utilities (examples: `text-yellow-400`, `bg-indigo-200`, `border-emerald-300`) inside `apps/web` only with theme-safe tokens that reference the CSS variables and helper classes defined in `apps/web/app/globals.css`.

Principles
----------
- Do not edit `apps/web/app/globals.css`. It is the source of truth for tokens and helper classes.
- Keep edits minimal and conservative. Prefer adding helper classes or using Tailwind arbitrary values that reference CSS vars (e.g., `text-[color:var(--accent)]`, `bg-[color:var(--brand)]/10`).
- Only change files inside `apps/web`.
- Exclude `.next`, `node_modules`, and generated artifacts from automated replacements and verification.

Automation artifacts
--------------------
- `replace-tailwind-colors.js` — conservative codemod that scans `apps/web` for literal color utilities and replaces only when an explicit mapping exists in `color-mapping.json`. Dry-run by default.
- `color-mapping.json` — starter mapping of common literal classes to theme-safe tokens. Expand this file as you decide canonical replacements for patterns in the UI.

Recommended rollout plan (safe / staged)
---------------------------------------
1. Audit (dry-run)
   - Run the codemod in dry-run mode to get a list of occurrences and suggested mappings:

     ```powershell
     node ./apps/web/scripts/replace-tailwind-colors.js --dry-run
     ```

   - Inspect the output. Unmapped occurrences will be flagged for manual review.

2. Extend mapping
   - Add conservative mappings to `apps/web/scripts/color-mapping.json` for classes that should be automated.
   - For ambiguous uses (e.g., the same color used for different semantics), prefer manual edits and document the rationale.

3. Apply codemod (small batch)
   - Run the codemod with `--apply` locally. Commit the changes as a single small PR.

     ```powershell
     node ./apps/web/scripts/replace-tailwind-colors.js --apply
     ```

4. Verify
   - Run the web build and run a visual smoke test for the pages/components edited.
   - Run an automated search to ensure no accidental literal classes remain (see verification commands below).

5. Roll forward by teams or component areas
   - Migrate one area at a time (Header, Product pages, Reviews, Account) to keep PRs small and reviewable.
   - Encourage reviewers to focus on visual regressions and semantic mapping correctness, not only diffs.

6. Clean up
   - After migrating all areas, consider removing now-unused helpers or consolidating helper names in `globals.css`.

Verification commands
---------------------
- Quick grep (PowerShell):

  ```powershell
  # from repo root
  Get-ChildItem -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.html -File |
    Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.next\\' } |
    Select-Object -ExpandProperty FullName |
    ForEach-Object { Select-String -Path $_ -Pattern '\b(?:text|bg|border)-(?:[a-z]+)-\d{3}\b' -AllMatches -List }
  ```

PR checklist
------------
- All changes confined to `apps/web`.
- `apps/web/app/globals.css` not modified.
- Codemod run in dry-run before apply and output attached to PR or pasted in PR description.
- Visual smoke test performed (screenshots optional) showing unchanged or acceptable visuals.
- One or two reviewers signed off on semantic choices for mappings.
- Run `pnpm --filter @apps/web run build` successfully.

Edge cases & guidance
---------------------
- Dynamic/conatenated className strings — the codemod won't catch all forms (template strings, conditional arrays). Use manual edits for these.
- Icon fills and SVG colors — often use `stroke-`/`fill-` utilities or inline attributes. Review manually and replace with `stroke-[color:var(--accent)]` or `className` driven approaches.
- Third-party components — prefer wrapper components in `apps/web/components/ui/` that map legacy literal usage to the new tokenized props.

Mapping maintenance
-------------------
- Keep `color-mapping.json` small and conservative. Add to it as teams agree on canonical mappings.
- For large projects, consider codemods that consume a richer AST (jscodeshift) to handle conditional classNames and JSX expressions safely.

If you want me to continue
-------------------------
- I can apply the current mapping automatically (`--apply`) and run the build + verification.
- Or I can produce a short list of unmapped occurrences (manual review items) and propose mapping candidates per occurrence.

Contact
-------
If anything in this plan should be stricter or more permissive, tell me which components you want to prioritize next (e.g., admin pages, checkout, product listing) and I’ll proceed.
