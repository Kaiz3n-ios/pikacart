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

const APPLIANCE_NAMES: Record<ApplianceId, string> = {
  stove: 'Gas / Electric Stove',
  'air-fryer': 'Air Fryer',
  oven: 'Oven',
  blender: 'Blender',
  microwave: 'Microwave',
  'pressure-cooker': 'Pressure / Rice Cooker',
};

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
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#18181B] mb-2 py-1 transition-colors duration-150"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Edit grocery cart</span>
        </button>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#18181B] text-balance">
          Ready for Zucchini checkout
        </h1>
        <p className="mt-1 text-sm text-[#52525B]">
          Loads all {activeItems.length} items into your Zucchini Food Market cart.
        </p>
      </div>

      {/* Checkout Summary Card */}
      <div className="rounded-3xl border border-[#18181B]/10 bg-white p-6 space-y-6 shadow-[0_1px_2px_rgb(0_0_0/0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#18181B]/10">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#FAF9F6] border border-[#18181B]/10 text-[#15803D] flex items-center justify-center shrink-0">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xs font-medium text-[#52525B] tabular-nums">
                {activeItems.length} products · {totalPacks} packs
              </div>
              <div className="font-display text-2xl sm:text-3xl font-semibold text-[#18181B] tabular-nums">
                {formatKes(totalKes)}
              </div>
            </div>
          </div>

          {savedKes > 0 && (
            <div className="text-right">
              <div className="text-xs text-[#52525B]">Pantry savings</div>
              <div className="font-display text-base font-semibold text-[#15803D] tabular-nums">
                -{formatKes(savedKes)}
              </div>
            </div>
          )}
        </div>

        {/* Selected Kitchen & Meals Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[#52525B]">
              Planned meals ({meals.length})
            </h2>
            <ul className="space-y-1.5">
              {meals.map((meal) => (
                <li key={meal.day} className="text-[#18181B] flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[#EA580C] shrink-0 tabular-nums">
                    Day {meal.day}
                  </span>
                  <span className="truncate">{meal.title}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-[#52525B]">
              Kitchen setup
            </h2>
            <p className="text-[#18181B]">
              {config.householdSize} · {config.days} days
            </p>
            <p className="text-[#52525B] text-xs leading-relaxed">
              Appliances:{' '}
              {config.appliances.map((id) => APPLIANCE_NAMES[id]).join(', ')}
            </p>
          </div>
        </div>

        {/* Collapsible Itemized Receipt */}
        {activeItems.length > 0 && (
          <div className="border-t border-[#18181B]/10 pt-3">
            <button
              type="button"
              onClick={() => setShowItems((prev) => !prev)}
              aria-expanded={showItems}
              className="w-full flex items-center justify-between h-9 text-xs font-semibold text-[#52525B] hover:text-[#18181B] transition-colors duration-150"
            >
              <span>{showItems ? 'Hide itemized basket' : `View itemized basket (${activeItems.length})`}</span>
              {showItems ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showItems && (
              <ul className="mt-2 pt-2 border-t border-[#18181B]/5 space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {activeItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-2 text-xs text-[#18181B] tabular-nums"
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
              className="w-full h-12 px-6 rounded-xl bg-[#15803D] hover:bg-[#166534] active:scale-[0.98] text-white font-display font-semibold text-base inline-flex items-center justify-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] tabular-nums"
            >
              <span>Load cart on Zucchini ({formatKes(totalKes)})</span>
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                disabled
                className="w-full h-12 px-6 rounded-xl bg-[#15803D] opacity-45 text-white font-display font-semibold text-base inline-flex items-center justify-center gap-2 cursor-not-allowed tabular-nums"
              >
                <span>Load cart on Zucchini (KES 0)</span>
                <ExternalLink className="h-4 w-4" />
              </button>
              <p className="text-xs text-center text-[#9A3412]">
                Select at least 1 item in your grocery cart to proceed to checkout.
              </p>
            </div>
          )}

          <button
            type="button"
            disabled={!canCheckout}
            onClick={handleCopyWhatsApp}
            className="w-full h-12 px-5 rounded-xl border border-[#18181B]/10 bg-[#FAF9F6] hover:bg-[#F4F4F5] active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed text-[#18181B] font-display font-semibold text-sm inline-flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-[#15803D]" />
                <span className="text-[#15803D]">WhatsApp shopping list copied</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 text-[#52525B]" />
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
          className="inline-flex items-center gap-2 h-11 px-4 text-sm font-medium text-[#52525B] hover:text-[#18181B] transition-colors duration-150"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Plan another week</span>
        </button>
      </div>
    </div>
  );
}
