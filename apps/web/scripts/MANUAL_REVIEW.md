Manual review items for color-token migration

This file will contain a short list of dynamic or ambiguous className occurrences that require human attention. The AST codemod only updates string literals and no-substitution template literals. Cases to look for:

- Template literals with expressions: `className={`text-${color}-400`}`
- Conditional class arrays / joins: `className={[isActive ? 'text-yellow-400' : 'text-gray-500', 'px-2'].join(' ')}`
- Class construction helpers (clsx / cn) mixing variables and literals: `cn(isActive && 'text-yellow-400', 'px-2')`
- Inline SVG color attributes (fill/stroke) in JSX.

If you want, I can try to handle some of these patterns automatically, but it requires careful AST transformations per pattern and likely a test run per component area.

Detailed occurrences found (file:line -> snippet) and suggested manual actions

1) `components/ui/UserMenu.tsx` : line ~75
	- Snippet: `<span className={`text-subtle transition-transform text-sm ${isOpen ? 'rotate-180 inline-block' : 'inline-block'}`}>`
	- Suggestion: Replace with `className={cn('text-subtle transition-transform text-sm', isOpen ? 'rotate-180 inline-block' : 'inline-block')}`. No color token changes needed.

2) `components/ui/ProductCard.tsx` : lines ~79-131
	- Snippets: several template literals building classes, e.g. `className={`card group overflow-hidden ${variant === 'category' ? 'flex h-full flex-col' : ''}`}` and `className={`flex h-full items-center justify-center text-xs text-muted ${...}`}`
	- Suggestion: Convert to `cn('card group overflow-hidden', variant === 'category' && 'flex h-full flex-col')` and ensure any literal color utilities inside are mapped to tokens (e.g., `text-muted` is fine).

3) `components/ui/AddressForm.tsx` : multiple lines (~175,198,234,270,290,322)
	- Snippet example: `className={`mt-1 block w-full rounded-xl border px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:ring-2 ${` + conditional + `}`}`
	- Suggestion: Use `cn('mt-1 block w-full rounded-xl border px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:ring-2', conditional)` and ensure any added classes reference tokens.

4) `app/page.tsx` and `app/(shop)/products/page.tsx` and other pages: many template-literal classNames building badge/button classes
	- Snippet example: `className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${ ... }`}`
	- Suggestion: Convert to `cn('rounded-full px-4 py-1.5 text-xs font-semibold transition', dynamicPart)`.

5) `components/ToastShelf.tsx` : line ~21
	- Snippet: `className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg shadow-black/30 backdrop-blur ${classes}`}`
	- Suggestion: `cn('pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg shadow-black/30 backdrop-blur', classes)`.

6) `app/(shop)/product/[slug]/page.tsx` : multiple template usages (~363,469)
	- Snippet: `className={`h-16 w-16 ... ${ isSelected ? 'border-ghost-20 ring-2 ring-[color:var(--brand)]/80' : 'border-ghost-10 hover:border-[color:var(--brand)]/60' }`}
	- Suggestion: Consider extracting conditional classes into explicit variables (e.g., `const imageSelectedClass = isSelected ? 'border-ghost-20 ring-2 ring-[color:var(--brand)]/80' : 'border-ghost-10 hover:border-[color:var(--brand)]/60'`) and then `cn(base, imageSelectedClass)` so mapping remains clear.

7) `components/ReviewCard.tsx` & `components/ProductReviews.tsx` & `components/ReviewForm.tsx` : inline template literals for star icons / text sizing
	- Suggestion: Replace with `cn` and ensure color tokens (e.g., `text-[color:var(--accent)]`) are used where appropriate.

8) `app/admin/*` pages: many tab/label elements use template literal classNames with helper functions like `getStatusBg(...)` and `getStatusColor(...)`
	- Suggestion: Ensure those helper functions return token-aware classes (not raw color-scale utilities). If they return e.g. `bg-yellow-400`, update them to return `bg-[color:var(--accent)]/10` or a helper class.

9) `components/ui/WishlistButton.tsx` and other components using `size`/`variant` props
	- Note: I adjusted `Button` to accept `md` alias and Card to accept `variant='elevated'` earlier; verify there are no more mismatches.

General guidance for manual edits
 - Prefer `cn()` wrapping over template literals when mixing static and dynamic classes.
 - For any conditional or computed classes, ensure the literal strings use tokenized helpers or CSS-var arbitrary values (e.g., `text-[color:var(--accent)]`).
 - If a dynamic variable (like `item.tone` or `getStatusBg(...)`) may contain legacy Tailwind color utilities, update the source of that variable to return tokenized classes.

If you want, I can start fixing these files in small batches. Recommended batch order:
 1. `components/ui/*` (Button, Card, ProductCard, WishlistButton) — low risk
 2. Product pages (`app/(shop)/product/*`, `app/(shop)/products/page.tsx`) — moderate risk, visual check recommended
 3. Admin pages — cautious, review helpers like `getStatusBg` first

Which batch should I start with? If you say "start", I'll update the first batch automatically using safe AST transforms (replace template literals with `cn(...)` where the template contains only string parts and simple conditionals). 
