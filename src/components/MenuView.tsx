import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Flame,
  Package,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Timer,
  Utensils,
  X,
} from 'lucide-react';
import type { CartItem, CatalogItem, HouseholdSize, Meal } from '../types';
import {
  APPLIANCE_LABELS,
  CATALOG_MAP,
  computeMealCostPerServing,
  formatKes,
  getServingsCount,
  scaleIngredientDisplay,
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

function detectTimerMinutes(steps: string[]): number {
  const joined = steps.join(' ');
  const match = joined.match(/(\d{1,2})\s*(?:-\s*\d{1,2}\s*)?(?:mins?|minutes?)/i);
  if (match) {
    const mins = parseInt(match[1], 10);
    if (mins >= 1 && mins <= 60) return mins;
  }
  return 10;
}

function formatTimerClock(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function RecipeCookingTimer({ steps }: { steps: string[] }) {
  const defaultMins = useMemo(() => detectTimerMinutes(steps), [steps]);
  const [totalSeconds, setTotalSeconds] = useState(defaultMins * 60);
  const [remainingSeconds, setRemainingSeconds] = useState(defaultMins * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setTotalSeconds(defaultMins * 60);
    setRemainingSeconds(defaultMins * 60);
    setRunning(false);
  }, [defaultMins]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const selectPreset = (mins: number) => {
    setRunning(false);
    setTotalSeconds(mins * 60);
    setRemainingSeconds(mins * 60);
  };

  const presetMinutes = useMemo(() => {
    const base = new Set<number>([defaultMins, 5, 10, 15]);
    return Array.from(base).sort((a, b) => a - b).slice(0, 3);
  }, [defaultMins]);

  const finished = remainingSeconds === 0;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] p-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Timer
          className={`h-4 w-4 ${
            finished ? 'text-[var(--accent-ember)]' : 'text-[var(--accent-basil)]'
          }`}
          aria-hidden="true"
        />
        <span className="text-xs font-medium text-[var(--text-muted)]">Timer</span>
        <span
          role={finished ? 'status' : undefined}
          className={`font-display text-sm font-semibold tabular-nums ${
            finished ? 'text-[var(--accent-ember)]' : 'text-[var(--text)]'
          }`}
        >
          {finished ? '00:00 Done' : formatTimerClock(remainingSeconds)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        {presetMinutes.map((mins) => {
          const isCurrent = totalSeconds === mins * 60;
          return (
            <button
              key={mins}
              type="button"
              onClick={() => selectPreset(mins)}
              className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-medium tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                isCurrent
                  ? 'border-[var(--accent-basil-border)] bg-[var(--accent-basil-tint)] text-[var(--accent-basil)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              {mins}m
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => {
            if (remainingSeconds === 0) setRemainingSeconds(totalSeconds);
            setRunning((prev) => !prev);
          }}
          aria-label={running ? 'Pause timer' : 'Start timer'}
          className="h-9 w-9 rounded-lg bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] text-white flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
        >
          {running ? (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setRunning(false);
            setRemainingSeconds(totalSeconds);
          }}
          aria-label="Reset timer"
          className="h-9 w-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function PrepBoardCollage({
  ingredients,
  meal,
}: {
  ingredients: CatalogItem[];
  meal: Meal;
}) {
  const boardItems = ingredients.slice(0, 4);

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[var(--surface-elevated)] border-b border-[var(--border)]">
      {boardItems.length > 0 ? (
        <div
          className={`grid h-full w-full gap-0.5 bg-[var(--border)] ${
            boardItems.length === 1
              ? 'grid-cols-1'
              : boardItems.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-2 grid-rows-2'
          }`}
        >
          {boardItems.map((item) => (
            <div key={item.id} className="relative h-full w-full overflow-hidden bg-white">
              <img
                src={item.img}
                alt={item.name}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
          <Utensils className="h-8 w-8" aria-hidden="true" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#12100E]/90 via-[#12100E]/35 to-[#12100E]/20" />

      <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#12100E]/85 px-2.5 py-1 text-xs font-medium text-[#FAF5EE]">
        <Utensils className="h-3 w-3 text-[#22C55E]" aria-hidden="true" />
        <span>Fresh Zucchini prep board</span>
      </div>

      <FloatingMealBadges meal={meal} />
    </div>
  );
}

function FloatingMealBadges({ meal }: { meal: Meal }) {
  return (
    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
      <span className="inline-flex items-center rounded-full bg-[var(--accent-ember-solid)] px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums">
        Day {meal.day}
      </span>

      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#12100E]/85 px-2.5 py-1 text-xs font-medium text-[#FAF5EE] tabular-nums">
          <Clock className="h-3 w-3 text-[#F97316]" aria-hidden="true" />
          <span>{meal.prep_mins}m</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-[#12100E]/85 px-2.5 py-1 text-xs font-medium text-[#FAF5EE] tabular-nums">
          <Flame className="h-3 w-3 text-[#22C55E]" aria-hidden="true" />
          <span>{meal.protein_g}g protein</span>
        </span>
      </div>
    </div>
  );
}

function MealHeroMedia({
  meal,
  ingredients,
}: {
  meal: Meal;
  ingredients: CatalogItem[];
}) {
  const [imgFailed, setImgFailed] = useState(false);

  if (meal.is_dynamic_fallback || !meal.photo || imgFailed) {
    return <PrepBoardCollage ingredients={ingredients} meal={meal} />;
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[var(--surface-elevated)] border-b border-[var(--border)]">
      <img
        src={meal.photo}
        alt={meal.title}
        loading="lazy"
        onError={() => setImgFailed(true)}
        className="h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#12100E]/90 via-[#12100E]/25 to-transparent" />
      <FloatingMealBadges meal={meal} />
    </div>
  );
}

function OverlappingIngredientThumbs({ items }: { items: CatalogItem[] }) {
  const [failedIds, setFailedIds] = useState<Record<number, boolean>>({});
  const visible = items.slice(0, 5);
  const overflow = Math.max(0, items.length - visible.length);

  if (visible.length === 0) return null;

  return (
    <div className="mt-3 flex items-center gap-2.5">
      <div className="flex items-center -space-x-2">
        {visible.map((item) =>
          failedIds[item.id] || !item.img ? (
            <span
              key={item.id}
              title={item.name}
              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-elevated)] text-[var(--text-muted)]"
            >
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          ) : (
            <img
              key={item.id}
              src={item.img}
              alt={item.name}
              title={item.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() =>
                setFailedIds((prev) => ({ ...prev, [item.id]: true }))
              }
              className="h-8 w-8 rounded-full border-2 border-[var(--surface)] bg-white object-cover"
            />
          )
        )}
        {overflow > 0 && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-[var(--surface-elevated)] text-xs font-semibold text-[var(--text-muted)] tabular-nums">
            +{overflow}
          </span>
        )}
      </div>
      <span className="text-xs text-[var(--text-muted)] tabular-nums">
        {items.length} Zucchini items
      </span>
    </div>
  );
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
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [cookingMode, setCookingMode] = useState(false);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };

    if (cookingMode && nav.wakeLock?.request) {
      nav.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (cancelled) {
            sentinel.release().catch(() => {});
          } else {
            wakeLockRef.current = sentinel;
          }
        })
        .catch(() => {
          // Wake lock is optional and may be blocked in background tabs or iframes
        });
    }

    return () => {
      cancelled = true;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [cookingMode]);

  const toggleExpand = (day: number) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const toggleStep = (mealKey: string, stepIdx: number) => {
    const key = `${mealKey}:${stepIdx}`;
    setCheckedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const servingsCount = getServingsCount(householdSize);
  const uniqueItemsCount = cartItems.length;
  const estimatedTotal = cartItems
    .filter((i) => i.included)
    .reduce((sum, i) => sum + i.price * i.qty, 0);

  const totalServings = Math.max(1, meals.length * servingsCount);
  const avgPerServing = Math.round(estimatedTotal / totalServings);

  return (
    <div className="space-y-6 pb-24">
      {/* Top Bar Action & Heading */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={onBackToConfig}
            className="inline-flex items-center gap-1.5 min-h-[44px] pr-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] mb-1 transition-colors duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit preferences</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] text-balance">
            Your weekly menu
          </h1>
        </div>

        <button
          type="button"
          onClick={onToggleSaveFavorite}
          aria-pressed={isSavedFavorite}
          className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-xs sm:text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
            isSavedFavorite
              ? 'bg-[var(--accent-basil-tint)] border-[var(--accent-basil-border)] text-[var(--accent-basil)]'
              : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent-basil-border)] text-[var(--text)]'
          }`}
        >
          {isSavedFavorite ? (
            <>
              <Check className="h-4 w-4 text-[var(--accent-basil)]" aria-hidden="true" />
              <span>Saved to favorites</span>
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              <span>Save week</span>
            </>
          )}
        </button>
      </div>

      {/* Smart Pantry Savings Banner */}
      <div className="rounded-2xl border border-[var(--accent-basil-border)] bg-[var(--surface)] p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--text)] leading-relaxed">
          {savingsSummary}
        </p>
        {usedFallback && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
            <span>Selected locally from your recipe vault</span>
            {onRetryAi && (
              <button
                type="button"
                onClick={onRetryAi}
                className="font-semibold text-[var(--accent-basil)] hover:underline py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
              >
                Retry AI selection
              </button>
            )}
          </div>
        )}
      </div>

      {/* Swap Error Banner */}
      {swapError && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--accent-ember-border)] bg-[var(--accent-ember-tint)] px-4 py-3 text-sm text-[var(--accent-ember)] flex items-center justify-between gap-3"
        >
          <span>{swapError}</span>
          <button
            type="button"
            onClick={onDismissSwapError}
            aria-label="Dismiss swap error"
            className="h-11 w-11 rounded-lg flex items-center justify-center text-[var(--accent-ember)] hover:bg-black/15 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Meal Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {meals.map((meal) => {
          const isExpanded = Boolean(expandedDays[meal.day]);
          const isSwapping = swappingDay === meal.day;
          const costPerServing = computeMealCostPerServing(
            meal,
            cartItems,
            householdSize
          );

          const resolvedIngredients = meal.ingredients
            .map((ing) => CATALOG_MAP.get(ing.catalog_id))
            .filter((item): item is CatalogItem => Boolean(item));

          const applianceLabel = meal.appliances
            .map((id) => APPLIANCE_LABELS[id] || id)
            .join(', ');

          const baseServings =
            Number.isFinite(meal.base_servings) && meal.base_servings > 0
              ? meal.base_servings
              : 2;
          const ingredientScale = servingsCount / baseServings;
          const mealStepKey = `${meal.day}-${meal.id}`;

          return (
            <article
              key={mealStepKey}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden flex flex-col justify-between"
            >
              <div>
                <MealHeroMedia meal={meal} ingredients={resolvedIngredients} />

                <div className="p-5 pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-lg font-semibold text-[var(--text)] leading-snug">
                      {meal.title}
                    </h2>

                    <button
                      type="button"
                      disabled={swappingDay !== null}
                      onClick={() => onSwapMeal(meal.day)}
                      className="inline-flex items-center gap-1.5 h-11 sm:h-10 px-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--accent-ember-border)] active:scale-[0.98] text-xs font-medium text-[var(--text)] transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:opacity-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)]"
                    >
                      <RefreshCw
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 text-[var(--text-muted)] ${
                          isSwapping ? 'animate-spin text-[var(--accent-ember)]' : ''
                        }`}
                      />
                      <span>{isSwapping ? 'Swapping...' : 'Swap meal'}</span>
                    </button>
                  </div>

                  <p className="mt-1.5 text-sm text-[var(--text-muted)] leading-relaxed">
                    {meal.tagline}
                  </p>

                  <OverlappingIngredientThumbs items={resolvedIngredients} />

                  {/* Clean Metadata Row */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--text-muted)] tabular-nums">
                    <span>{meal.calories} kcal</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--text)]">
                      ~{formatKes(costPerServing)}/plate
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--accent-basil)]">{applianceLabel}</span>
                  </div>
                </div>
              </div>

              {/* View Recipe Expandable Drawer */}
              <div className="mt-4 mx-5 mb-4 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggleExpand(meal.day)}
                  aria-expanded={isExpanded}
                  className="w-full flex items-center justify-between min-h-[44px] text-sm font-semibold text-[var(--accent-basil)] hover:opacity-85 transition-opacity duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                >
                  <span>{isExpanded ? 'Hide recipe' : 'View recipe & steps'}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-[var(--border)] space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--text-muted)]">
                        Tap steps to track progress while cooking
                      </span>
                      <button
                        type="button"
                        aria-pressed={cookingMode}
                        onClick={() => setCookingMode((prev) => !prev)}
                        className={`inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-xl border text-xs font-medium transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                          cookingMode
                            ? 'bg-[var(--accent-basil-tint)] border-[var(--accent-basil-border)] text-[var(--accent-basil)]'
                            : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]'
                        }`}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{cookingMode ? 'Large cooking text on' : 'Cooking mode'}</span>
                      </button>
                    </div>

                    <RecipeCookingTimer steps={meal.steps} />

                    <div>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                        Ingredients ({servingsCount}{' '}
                        {servingsCount === 1 ? 'serving' : 'servings'})
                      </h3>
                      <ul className="space-y-1.5">
                        {meal.ingredients.map((ing, idx) => {
                          const catItem = CATALOG_MAP.get(ing.catalog_id);
                          const scaledDisplay = scaleIngredientDisplay(
                            ing.display,
                            ingredientScale
                          );
                          return (
                            <li
                              key={`${ing.catalog_id}-${idx}`}
                              className={`flex items-baseline justify-between gap-2 ${
                                cookingMode ? 'text-base' : 'text-sm'
                              }`}
                            >
                              <span className="text-[var(--text)] font-medium">
                                {catItem ? catItem.name : `Item #${ing.catalog_id}`}
                              </span>
                              <span className="text-xs text-[var(--text-muted)] shrink-0 tabular-nums">
                                {scaledDisplay}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-[var(--text-muted)] mb-2">
                        Cooking steps
                      </h3>
                      <ol className="space-y-2">
                        {meal.steps.map((step, sIdx) => {
                          const done = Boolean(checkedSteps[`${mealStepKey}:${sIdx}`]);
                          return (
                            <li key={sIdx}>
                              <button
                                type="button"
                                aria-pressed={done}
                                onClick={() => toggleStep(mealStepKey, sIdx)}
                                className={`w-full text-left flex items-start gap-2.5 min-h-[44px] p-2 rounded-xl border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                                  done
                                    ? 'border-[var(--accent-basil-border)] bg-[var(--accent-basil-tint)] text-[var(--text-muted)]'
                                    : 'border-transparent hover:bg-[var(--surface-elevated)] text-[var(--text)]'
                                } ${
                                  cookingMode
                                    ? 'text-base sm:text-lg leading-relaxed'
                                    : 'text-sm leading-relaxed'
                                }`}
                              >
                                <span
                                  aria-hidden="true"
                                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold mt-0.5 tabular-nums ${
                                    done
                                      ? 'bg-[var(--accent-basil-solid)] border-[var(--accent-basil-solid)] text-white'
                                      : 'bg-[var(--surface-elevated)] border-[var(--border)] text-[var(--text-muted)]'
                                  }`}
                                >
                                  {done ? (
                                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                                  ) : (
                                    sIdx + 1
                                  )}
                                </span>
                                <span className={done ? 'line-through' : ''}>{step}</span>
                              </button>
                            </li>
                          );
                        })}
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
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-[var(--text-muted)] tabular-nums truncate">
              {uniqueItemsCount} items · ~{formatKes(avgPerServing)}/plate avg
            </div>
            <div className="font-display text-base sm:text-lg font-semibold text-[var(--text)] tabular-nums">
              {formatKes(estimatedTotal)}
            </div>
          </div>
          <button
            type="button"
            onClick={onReviewCart}
            className="h-12 px-5 sm:px-6 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] active:scale-[0.98] text-white font-display font-semibold text-sm sm:text-base inline-flex items-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            <span>Review grocery cart</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
