import { useRef } from 'react';
import { BarChart3, RotateCcw, X } from 'lucide-react';
import type { SessionAnalytics } from '../types';
import { formatKes } from '../utils/catalogHelper';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface AnalyticsModalProps {
  open: boolean;
  analytics: SessionAnalytics;
  onClose: () => void;
  onReset: () => void;
}

export function AnalyticsModal({
  open,
  analytics,
  onClose,
  onReset,
}: AnalyticsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useModalFocusTrap(open, dialogRef, onClose, closeBtnRef);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5 shadow-[0_8px_24px_rgb(0_0_0/0.06)] focus:outline-none"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className="h-10 w-10 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border)] text-[var(--accent-basil)] flex items-center justify-center"
            >
              <BarChart3 className="h-4 w-4" />
            </div>
            <h2
              id="analytics-modal-title"
              className="font-display text-base font-semibold text-[var(--text)]"
            >
              Session analytics
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close analytics modal"
            className="h-11 w-11 rounded-xl flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--surface-elevated)] hover:text-[var(--text)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Menus generated</span>
            <span className="font-display text-xl font-semibold text-[var(--text)] tabular-nums">
              {analytics.menusGenerated}
            </span>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Zucchini checkout clicks</span>
            <span className="font-display text-xl font-semibold text-[var(--text)] tabular-nums">
              {analytics.checkoutClicks}
            </span>
          </div>
          <div className="rounded-2xl border border-[var(--accent-basil-border)] bg-[var(--surface-elevated)] p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--accent-basil)]">
              Total KES routed
            </span>
            <span className="font-display text-xl font-semibold text-[var(--accent-basil)] tabular-nums">
              {formatKes(analytics.totalKesRouted)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset counters</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-5 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] text-white text-xs font-semibold active:scale-[0.98] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
