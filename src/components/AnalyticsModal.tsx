import { BarChart3, RotateCcw, X } from 'lucide-react';
import type { SessionAnalytics } from '../types';
import { formatKes } from '../utils/catalogHelper';

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
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analytics-modal-title"
    >
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-[#18181B]/10 bg-white p-6 space-y-5 shadow-[0_8px_24px_rgb(0_0_0/0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#FAF9F6] border border-[#18181B]/10 text-[#15803D] flex items-center justify-center">
              <BarChart3 className="h-4 w-4" />
            </div>
            <h2
              id="analytics-modal-title"
              className="font-display text-base font-semibold text-[#18181B]"
            >
              Session analytics
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close analytics modal"
            className="h-10 w-10 rounded-xl flex items-center justify-center text-[#52525B] hover:bg-[#FAF9F6] hover:text-[#18181B] transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-2xl border border-[#18181B]/10 bg-[#FAF9F6] p-4 flex items-center justify-between">
            <span className="text-sm text-[#52525B]">Menus generated</span>
            <span className="font-display text-xl font-semibold text-[#18181B] tabular-nums">
              {analytics.menusGenerated}
            </span>
          </div>
          <div className="rounded-2xl border border-[#18181B]/10 bg-[#FAF9F6] p-4 flex items-center justify-between">
            <span className="text-sm text-[#52525B]">Zucchini checkout clicks</span>
            <span className="font-display text-xl font-semibold text-[#18181B] tabular-nums">
              {analytics.checkoutClicks}
            </span>
          </div>
          <div className="rounded-2xl border border-[#15803D]/25 bg-[#FAF9F6] p-4 flex items-center justify-between">
            <span className="text-sm font-medium text-[#15803D]">Total KES routed</span>
            <span className="font-display text-xl font-semibold text-[#15803D] tabular-nums">
              {formatKes(analytics.totalKesRouted)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#18181B] py-2 transition-colors duration-150"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset counters</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl bg-[#18181B] text-white text-xs font-semibold hover:bg-[#27272A] active:scale-[0.98] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
