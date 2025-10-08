Manual review items for color-token migration

This file will contain a short list of dynamic or ambiguous className occurrences that require human attention. The AST codemod only updates string literals and no-substitution template literals. Cases to look for:

- Template literals with expressions: `className={`text-${color}-400`}`
- Conditional class arrays / joins: `className={[isActive ? 'text-yellow-400' : 'text-gray-500', 'px-2'].join(' ')}`
- Class construction helpers (clsx / cn) mixing variables and literals: `cn(isActive && 'text-yellow-400', 'px-2')`
- Inline SVG color attributes (fill/stroke) in JSX.

If you want, I can try to handle some of these patterns automatically, but it requires careful AST transformations per pattern and likely a test run per component area.
