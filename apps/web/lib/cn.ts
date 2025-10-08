// Simple className joiner used by many projects (lightweight alternative to clsx)
export function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(' ');
}
