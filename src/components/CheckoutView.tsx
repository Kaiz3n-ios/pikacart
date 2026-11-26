import { useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  RotateCcw,
  ShoppingBag,
} from 'lucide-react';
import type { ApplianceId, CartItem, Meal, UserConfig } from '../types';
import {
  APPLIANCE_LABELS,
  buildShopifyCartUrl,
  buildWhatsAppShoppingList,
  formatKes,
} from '../utils/catalogHelper';

interface CheckoutViewProps {
  config: UserConfig;
  meals: Meal[];
  items: CartItem[];
  onBackToCart: () => void;
  onStartOver: () => void;
  onCheckoutClick: (totalKes: number) => void;
}

export function CheckoutView({
  config,
  meals,
  items,
  onBackToCart,
  onStartOver,
  onCheckoutClick,
}: CheckoutViewProps) {
  const [copied, setCopied] = useState(false);
  const [showItems, setShowItems] = useState(false);

  const activeItems = items.filter((i) => i.included && i.qty > 0);
  const excludedItems = items.filter((i) => !i.included);

  const totalKes = activeItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const savedKes = excludedItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const totalPacks = activeItems.reduce((sum, i) => sum + i.qty, 0);

  const shopifyUrl = buildShopifyCartUrl(items);
  const canCheckout = activeItems.length > 0 && shopifyUrl.length > 0;

  const handleCopyWhatsApp = async () => {
    if (activeItems.length === 0) return;
    const text = buildWhatsAppShoppingList(items, meals);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2600);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto">
      <div>
        <button
          type="button"
          onClick={onBackToCart}
          className="inline-flex items-center gap-1.5 min-h-[44px] pr-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] mb-1 transition-colors duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Edit grocery cart</span>
        </button>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] text-balance">
          Ready for Zucchini checkout
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Loads all {activeItems.length} items into your Zucchini Food Market Nairobi cart.
        </p>
      </div>

      {/* Checkout Summary Card */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div
              aria-hidden="true"
              className="h-12 w-12 rounded-2xl bg-[var(--accent-basil-tint)] border border-[var(--accent-basil-border)] text-[var(--accent-basil)] flex items-center justify-center shrink-0"
            >
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                {activeItems.length} products · {totalPacks} packs
              </div>
              <div className="font-display text-2xl sm:text-3xl font-semibold text-[var(--text)] tabular-nums">
                {formatKes(totalKes)}
              </div>
            </div>
          </div>

          {savedKes > 0 && (
            <div className="text-right">
              <div className="text-xs text-[var(--text-muted)]">Pantry savings</div>
              <div className="font-display text-base font-semibold text-[var(--accent-basil)] tabular-nums">
                -{formatKes(savedKes)}
              </div>
            </div>
          )}
        </div>

        {/* Selected Kitchen & Meals Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[var(--text-muted)]">
              Planned meals ({meals.length})
            </h2>
            <ul className="space-y-1.5">
              {meals.map((meal) => (
                <li key={meal.day} className="text-[var(--text)] flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[var(--accent-ember)] shrink-0 tabular-nums">
                    Day {meal.day}
                  </span>
                  <span className="truncate">{meal.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[var(--text-muted)]">
              Kitchen setup
            </h2>
            <p className="text-[var(--text)]">
              {config.householdSize} · {config.days} days
            </p>
            <p className="text-[var(--text-muted)] text-xs leading-relaxed">
              Appliances:{' '}
              {config.appliances.map((id: ApplianceId) => APPLIANCE_LABELS[id]).join(', ')}
            </p>
          </div>
        </div>

        {/* Collapsible Itemized Receipt */}
        {activeItems.length > 0 && (
          <div className="border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={() => setShowItems((prev) => !prev)}
              aria-expanded={showItems}
              className="w-full flex items-center justify-between min-h-[44px] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
            >
              <span>
                {showItems ? 'Hide itemized basket' : `View itemized basket (${activeItems.length})`}
              </span>
              {showItems ? (
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {showItems && (
              <ul className="mt-2 pt-2 border-t border-[var(--border)] space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-2 text-xs text-[var(--text)] tabular-nums"
                  >
                    <span className="truncate">
                      {item.qty}x {item.name}
                    </span>
                    <span className="font-medium shrink-0">
                      {formatKes(item.price * item.qty)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Primary & Secondary Actions */}
        <div className="pt-1 space-y-3">
          {canCheckout ? (
            <a
              href={shopifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onCheckoutClick(totalKes)}
              className="w-full h-12 px-6 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] active:scale-[0.98] text-white font-display font-semibold text-base inline-flex items-center justify-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            >
              <span>Load cart on Zucchini ({formatKes(totalKes)})</span>
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled
                className="w-full h-12 px-6 rounded-xl bg-[var(--accent-basil-solid)] opacity-45 text-white font-display font-semibold text-base inline-flex items-center justify-center gap-2 cursor-not-allowed tabular-nums"
              >
                <span>Load cart on Zucchini (KES 0)</span>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="text-xs text-center text-[var(--accent-ember)]">
                Select at least 1 item in your grocery cart to proceed to checkout.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!canCheckout}
            onClick={handleCopyWhatsApp}
            className="w-full h-12 px-5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--text-muted)] active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed text-[var(--text)] font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[var(--accent-basil)]" aria-hidden="true" />
                <span className="text-[var(--accent-basil)]">WhatsApp shopping list copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                <span>Copy WhatsApp shopping list</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Start Fresh */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex items-center gap-2 h-11 px-4 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Plan another week</span>
        </button>
      </div>
    </div>
  );
}
