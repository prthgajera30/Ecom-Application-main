"use client";
import { useToast } from '../context/ToastContext';

const variantClasses: Record<string, string> = {
  success: 'bg-[color:var(--brand)]/20 border-[color:var(--brand)]/40 text-[var(--text-primary)]',
  error: 'bg-[var(--danger-10)] border-[var(--danger)]/40 text-[var(--danger-100)]',
  info: 'bg-ghost-10 border-ghost-20 text-muted',
};

export default function ToastShelf() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-6 z-[200] flex flex-col items-end gap-3 sm:bottom-8 sm:right-8 sm:left-auto">
      {toasts.map((toast) => {
        const classes = variantClasses[toast.variant || 'info'] || variantClasses.info;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg shadow-black/30 backdrop-blur ${classes}`}
            role="status"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                {toast.title && <p className="text-sm font-semibold text-primary">{toast.title}</p>}
                {toast.description && <p className="text-xs leading-relaxed text-muted">{toast.description}</p>}
              </div>
              <button
                type="button"
                className="rounded-full border border-ghost-20 bg-ghost-10 px-2 py-1 text-xs font-medium text-primary transition hover:bg-ghost-20"
                onClick={() => dismiss(toast.id)}
              >
                Close
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
