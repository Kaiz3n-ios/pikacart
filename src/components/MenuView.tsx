import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
} from 'lucide-react';
import type { CartItem, HouseholdSize, Meal } from '../types';
import {
  CATALOG_MAP,
  computeMealCostPerServing,
  formatKes,
  getServingsCount,
} from '../utils/catalogHelper';

interface MenuViewProps {
  meals: Meal[];
  householdSize: HouseholdSize;
  savingsSummary: string;
  usedFallback: boolean;
  cartItems: CartItem[];
  swappingDay: number | null;
  swapError: string | null;
  isSavedFavorite: boolean;
  onToggleSaveFavorite: () => void;
  onDismissSwapError: () => void;
  onSwapMeal: (day: number) => void;
  onReviewCart: () => void;
  onBackToConfig: () => void;
  onRetryAi?: () => void;
}

export function MenuView({
  meals,
  householdSize,
  savingsSummary,
  usedFallback,
  cartItems,
  swappingDay,
  swapError,
  isSavedFavorite,
  onToggleSaveFavorite,
  onDismissSwapError,
  onSwapMeal,
  onReviewCart,
  onBackToConfig,
  onRetryAi,
}: MenuViewProps) {
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({});

  const toggleExpand = (day: number) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const uniqueItemsCount = cartItems.length;
  const estimatedTotal = cartItems
    .filter((i) => i.included)
    .reduce((sum, i) => sum + i.price * i.qty, 0);

  const totalServings = Math.max(1, meals.length * getServingsCount(householdSize));
  const avgPerServing = Math.round(estimatedTotal / totalServings);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Bar Action & Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBackToConfig}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525B] hover:text-[#18181B] mb-2 py-1 transition-colors duration-150"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Edit preferences</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#18181B] text-balance">
            Your weekly menu
          </h1>
        </div>

        <button
          type="button"
          onClick={onToggleSaveFavorite}
          aria-pressed={isSavedFavorite}
          className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs sm:text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap shrink-0 ${
            isSavedFavorite
              ? 'bg-white border-[#15803D] text-[#15803D]'
              : 'bg-white border-[#18181B]/10 hover:border-[#15803D] text-[#18181B]'
          }`}
        >
          {isSavedFavorite ? (
            <>
              <Check className="h-4 w-4 text-[#15803D]" />
              <span>Saved to favorites</span>
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4 text-[#52525B]" />
              <span>Save week</span>
            </>
          )}
        </button>
      </div>

      {/* Smart Pantry Savings Banner */}
      <div className="rounded-2xl border border-[#15803D]/25 bg-white p-4 space-y-2">
        <p className="text-sm font-medium text-[#18181B] leading-relaxed">
          {savingsSummary}
        </p>
        {usedFallback && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#52525B]">
            <span>Showing curated chef menu</span>
            {onRetryAi && (
              <button
                type="button"
                onClick={onRetryAi}
                className="font-semibold text-[#15803D] hover:underline"
              >
                Retry AI menu
              </button>
            )}
          </div>
        )}
      </div>

      {/* Swap Error Banner */}
      {swapError && (
        <div
          role="alert"
          className="rounded-xl border border-[#EA580C] bg-white px-4 py-3 text-sm text-[#9A3412] flex items-center justify-between gap-3"
        >
          <span>{swapError}</span>
          <button
            type="button"
            onClick={onDismissSwapError}
            aria-label="Dismiss swap error"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[#9A3412] hover:bg-[#FAF9F6] shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Meal Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {meals.map((meal) => {
          const isExpanded = Boolean(expandedDays[meal.day]);
          const isSwapping = swappingDay === meal.day;
          const costPerServing = computeMealCostPerServing(
            meal,
            cartItems,
            householdSize
          );

          return (
            <article
              key={`${meal.day}-${meal.title}`}
              className="rounded-2xl border border-[#18181B]/10 bg-white p-5 flex flex-col justify-between"
            >
              <div>
                {/* Top Day + Swap Action */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold text-[#EA580C] tabular-nums">
                    Day {meal.day}
                  </span>

                  <button
                    type="button"
                    disabled={swappingDay !== null}
                    onClick={() => onSwapMeal(meal.day)}
                    className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#18181B]/10 bg-[#FAF9F6] hover:bg-[#F4F4F5] active:scale-[0.98] text-xs font-medium text-[#18181B] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 text-[#52525B] ${
                        isSwapping ? 'animate-spin text-[#15803D]' : ''
                      }`}
                    />
                    <span>{isSwapping ? 'Swapping...' : 'Swap meal'}</span>
                  </button>
                </div>

                {/* Title & 1-line Description */}
                <h2 className="font-display text-lg font-semibold text-[#18181B] leading-snug">
                  {meal.title}
                </h2>
                <p className="mt-1 text-sm text-[#52525B] leading-relaxed">
                  {meal.description}
                </p>

                {/* Clean Unboxed Metadata Row */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[#52525B] tabular-nums">
                  <span>{meal.prep_minutes} min</span>
                  <span aria-hidden="true">·</span>
                  <span>{meal.protein_grams}g protein</span>
                  <span aria-hidden="true">·</span>
                  <span>{meal.calories} kcal</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#18181B]">
                    ~{formatKes(costPerServing)}/plate
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#15803D]">{meal.appliance_used}</span>
                </div>
              </div>

              {/* View Recipe Expandable Drawer */}
              <div className="mt-4 pt-3 border-t border-[#18181B]/10">
                <button
                  type="button"
                  onClick={() => toggleExpand(meal.day)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between h-10 text-sm font-semibold text-[#15803D] hover:text-[#166534] transition-colors duration-150"
                >
                  <span>{isExpanded ? 'Hide recipe' : 'View recipe'}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[#18181B]/10 space-y-4">
                    <div>
                      <h3 className="text-xs font-semibold text-[#52525B] mb-2">
                        Ingredients
                      </h3>
                      <ul className="space-y-1.5">
                        {meal.ingredients.map((ing, idx) => {
                          const catItem = CATALOG_MAP.get(ing.catalog_id);
                          return (
                            <li
                              key={`${ing.catalog_id}-${idx}`}
                              className="flex items-baseline justify-between gap-2 text-sm"
                            >
                              <span className="text-[#18181B] font-medium">
                                {catItem ? catItem.name : `Item #${ing.catalog_id}`}
                              </span>
                              <span className="text-xs text-[#52525B] shrink-0">
                                {ing.amount}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-[#52525B] mb-2">
                        Steps
                      </h3>
                      <ol className="space-y-2">
                        {meal.steps.map((step, sIdx) => (
                          <li
                            key={sIdx}
                            className="flex items-start gap-2.5 text-sm text-[#18181B] leading-relaxed"
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FAF9F6] border border-[#18181B]/10 text-xs font-semibold text-[#52525B] mt-0.5 tabular-nums">
                              {sIdx + 1}
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Compact Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#18181B]/10 bg-[#FAF9F6]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-[#52525B] tabular-nums truncate">
              {uniqueItemsCount} items · ~{formatKes(avgPerServing)}/plate avg
            </div>
            <div className="font-display text-base sm:text-lg font-semibold text-[#18181B] tabular-nums">
              {formatKes(estimatedTotal)}
            </div>
          </div>
          <button
            type="button"
            onClick={onReviewCart}
            className="h-12 px-5 sm:px-6 rounded-xl bg-[#15803D] hover:bg-[#166534] active:scale-[0.98] text-white font-display font-semibold text-sm sm:text-base inline-flex items-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap shrink-0"
          >
            <span>Review grocery cart</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
