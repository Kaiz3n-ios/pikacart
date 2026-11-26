import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Flame,
  Leaf,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import type {
  ApplianceId,
  DaysCount,
  DietaryFilter,
  GoalId,
  HouseholdSize,
  SavedWeeklyFavorite,
  UserConfig,
} from '../types';
import { formatKes } from '../utils/catalogHelper';
import { ApplianceIllustration } from './ApplianceIcons';

interface ConfiguratorViewProps {
  config: UserConfig;
  savedFavorites: SavedWeeklyFavorite[];
  onChange: (next: UserConfig) => void;
  onGenerate: () => void;
  onLoadFavorite: (fav: SavedWeeklyFavorite, goToCart?: boolean) => void;
  onDeleteFavorite: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

const GOALS: {
  id: GoalId;
  label: string;
  subtitle: string;
  icon: typeof Flame;
}[] = [
  {
    id: 'high-protein-gym',
    label: 'High-Protein Gym',
    subtitle: 'Lean cuts, eggs, and high protein per meal',
    icon: Flame,
  },
  {
    id: '20-min-quick',
    label: '20-Min Quick',
    subtitle: 'Meals ready in 20 minutes or less',
    icon: Clock,
  },
  {
    id: 'kenyan-comfort',
    label: 'Kenyan Comfort',
    subtitle: 'Kenyan stews, greens, and everyday staples',
    icon: UtensilsCrossed,
  },
  {
    id: 'clean-plant-forward',
    label: 'Clean & Plant-Forward',
    subtitle: 'Vegetables, legumes, and tofu',
    icon: Leaf,
  },
  {
    id: 'budget-saver',
    label: 'Budget Saver',
    subtitle: 'Lowest cost per serving by reusing ingredients',
    icon: Wallet,
  },
];

const HOUSEHOLD_OPTIONS: HouseholdSize[] = ['1 Person', '2 People', '4+ Family'];
const DAY_OPTIONS: DaysCount[] = [3, 5, 7];
const DIETARY_OPTIONS: DietaryFilter[] = [
  'Vegetarian',
  'Dairy-Free',
  'Gluten-Free',
  'High-Calorie / Bulking',
];

const APPLIANCES: { id: ApplianceId; label: string }[] = [
  { id: 'stove', label: 'Gas / Electric Stove' },
  { id: 'air-fryer', label: 'Air Fryer' },
  { id: 'oven', label: 'Oven' },
  { id: 'blender', label: 'Blender' },
  { id: 'microwave', label: 'Microwave' },
  { id: 'pressure-cooker', label: 'Pressure / Rice Cooker' },
];

const LOADING_MESSAGES = [
  'Checking Zucchini shelves...',
  'Matching pantry staples...',
  'Optimizing your basket...',
];

export function ConfiguratorView({
  config,
  savedFavorites,
  onChange,
  onGenerate,
  onLoadFavorite,
  onDeleteFavorite,
  isLoading,
  error,
}: ConfiguratorViewProps) {
  const [loadingIdx, setLoadingIdx] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setLoadingIdx(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLoadingIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  const toggleDietary = (item: DietaryFilter) => {
    const exists = config.dietaryFilters.includes(item);
    const next = exists
      ? config.dietaryFilters.filter((f) => f !== item)
      : [...config.dietaryFilters, item];
    onChange({ ...config, dietaryFilters: next });
  };

  const toggleAppliance = (id: ApplianceId) => {
    const exists = config.appliances.includes(id);
    if (exists && config.appliances.length === 1) {
      return;
    }
    const next = exists
      ? config.appliances.filter((a) => a !== id)
      : [...config.appliances, id];
    onChange({ ...config, appliances: next });
  };

  return (
    <div className="space-y-8 pb-24">
      <section className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[#18181B] text-balance">
          What are we cooking this week?
        </h1>
        <p className="text-sm sm:text-base text-[#52525B] max-w-2xl">
          Choose your meal goal, household size, and kitchen appliances to build a menu from Zucchini Nairobi products.
        </p>
      </section>

      {/* Saved Weekly Favorites */}
      {savedFavorites.length > 0 && (
        <section className="space-y-3" aria-labelledby="saved-favorites-heading">
          <div className="flex items-baseline justify-between">
            <h2
              id="saved-favorites-heading"
              className="font-display text-base font-semibold text-[#18181B] inline-flex items-center gap-2"
            >
              <Bookmark className="h-4 w-4 text-[#15803D]" />
              <span>Saved weekly favorites</span>
            </h2>
            <span className="text-xs text-[#52525B] tabular-nums">
              {savedFavorites.length} saved
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedFavorites.map((fav) => {
              const activeItems = fav.cartItems.filter((i) => i.included && i.qty > 0);
              const totalKes = activeItems.reduce(
                (sum, i) => sum + i.price * i.qty,
                0
              );
              return (
                <div
                  key={fav.id}
                  className="rounded-2xl border border-[#18181B]/10 bg-white p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-semibold text-[#18181B] truncate">
                        {fav.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[#52525B] tabular-nums">
                        {fav.meals.length} meals · {fav.config.householdSize} ·{' '}
                        <span className="font-semibold text-[#18181B]">
                          {formatKes(totalKes)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-[#52525B] truncate">
                        {fav.meals.map((m) => m.title).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFavorite(fav.id)}
                      aria-label={`Remove saved favorite ${fav.name}`}
                      className="h-9 w-9 shrink-0 rounded-xl border border-[#18181B]/10 bg-[#FAF9F6] hover:bg-white flex items-center justify-center text-[#52525B] hover:text-[#9A3412] transition-colors duration-150"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[#18181B]/10">
                    <button
                      type="button"
                      onClick={() => onLoadFavorite(fav, false)}
                      className="flex-1 h-10 px-3 rounded-xl border border-[#18181B]/10 bg-[#FAF9F6] hover:bg-white active:scale-[0.98] text-xs font-semibold text-[#18181B] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap"
                    >
                      Open menu
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadFavorite(fav, true)}
                      className="flex-1 h-10 px-3 rounded-xl bg-[#15803D] hover:bg-[#166534] active:scale-[0.98] text-xs font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap"
                    >
                      Reorder cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Step 1: Pick Your Vibe / Goal */}
      <section className="space-y-3" aria-labelledby="step-goal">
        <div className="flex items-baseline justify-between">
          <h2 id="step-goal" className="font-display text-base font-semibold text-[#18181B]">
            1. Pick your vibe
          </h2>
          <span className="text-xs text-[#52525B]">Select one</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            const active = config.goal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => onChange({ ...config, goal: goal.id })}
                className={`relative flex items-start gap-3 p-4 rounded-2xl border text-left transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] ${
                  active
                    ? 'bg-white border-[#15803D] shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                    : 'bg-white border-[#18181B]/10 hover:border-[#18181B]/25'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 ${
                    active
                      ? 'bg-[#15803D] text-white'
                      : 'bg-[#FAF9F6] text-[#52525B] border border-[#18181B]/10'
                  }`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <div className="font-display text-sm font-semibold text-[#18181B]">
                    {goal.label}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#52525B]">
                    {goal.subtitle}
                  </p>
                </div>
                {active && (
                  <span
                    className="absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full bg-[#15803D] text-white"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Household & Days */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-labelledby="step-household">
        <div className="space-y-3">
          <h2 id="step-household" className="font-display text-base font-semibold text-[#18181B]">
            2. Household size
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {HOUSEHOLD_OPTIONS.map((size) => {
              const active = config.householdSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange({ ...config, householdSize: size })}
                  className={`h-12 px-3 rounded-xl border text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] ${
                    active
                      ? 'bg-[#15803D] border-[#15803D] text-white shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                      : 'bg-white border-[#18181B]/10 text-[#18181B] hover:border-[#18181B]/25'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-base font-semibold text-[#18181B]">
            Plan length
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {DAY_OPTIONS.map((days) => {
              const active = config.days === days;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ ...config, days })}
                  className={`h-12 px-3 rounded-xl border text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] ${
                    active
                      ? 'bg-[#15803D] border-[#15803D] text-white shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                      : 'bg-white border-[#18181B]/10 text-[#18181B] hover:border-[#18181B]/25'
                  }`}
                >
                  {days} Days
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Step 3: Dietary Filters */}
      <section className="space-y-3" aria-labelledby="step-dietary">
        <div className="flex items-baseline justify-between">
          <h2 id="step-dietary" className="font-display text-base font-semibold text-[#18181B]">
            3. Dietary filters
          </h2>
          <span className="text-xs text-[#52525B]">Optional</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((filter) => {
            const active = config.dietaryFilters.includes(filter);
            return (
              <button
                key={filter}
                type="button"
                onClick={() => toggleDietary(filter)}
                className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] ${
                  active
                    ? 'bg-white border-[#EA580C] text-[#9A3412]'
                    : 'bg-white border-[#18181B]/10 text-[#52525B] hover:border-[#18181B]/25 hover:text-[#18181B]'
                }`}
              >
                {active && <Check className="h-3.5 w-3.5 text-[#EA580C]" strokeWidth={2.5} />}
                <span>{filter}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 4: What's in your kitchen? */}
      <section className="space-y-3" aria-labelledby="step-appliances">
        <div className="flex items-baseline justify-between">
          <h2 id="step-appliances" className="font-display text-base font-semibold text-[#18181B]">
            4. What’s in your kitchen?
          </h2>
          <span className="text-xs text-[#52525B]">Select what you own</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {APPLIANCES.map((appliance) => {
            const active = config.appliances.includes(appliance.id);
            return (
              <button
                key={appliance.id}
                type="button"
                onClick={() => toggleAppliance(appliance.id)}
                className={`relative flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border text-center transition-[border-color,background-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] ${
                  active
                    ? 'bg-white border-[#15803D] shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                    : 'bg-white border-[#18181B]/10 hover:border-[#18181B]/25'
                }`}
              >
                {active && (
                  <span
                    className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#15803D] text-white"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                )}
                <ApplianceIllustration id={appliance.id} active={active} />
                <span
                  className={`text-xs sm:text-sm font-medium leading-snug ${
                    active ? 'text-[#15803D] font-semibold' : 'text-[#18181B]'
                  }`}
                >
                  {appliance.label}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#EA580C] bg-white px-4 py-3 text-sm text-[#9A3412]"
        >
          {error}
        </div>
      )}

      {/* Sticky Bottom Primary CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#18181B]/10 bg-[#FAF9F6]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="hidden sm:block text-xs text-[#52525B] tabular-nums">
            <span className="font-medium text-[#18181B]">{config.days} days</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{config.householdSize}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{config.appliances.length} appliance{config.appliances.length > 1 ? 's' : ''}</span>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onGenerate}
            className="w-full sm:w-auto sm:min-w-64 h-12 px-6 rounded-xl bg-[#15803D] hover:bg-[#166534] active:scale-[0.98] disabled:opacity-80 text-white font-display font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>{LOADING_MESSAGES[loadingIdx]}</span>
              </>
            ) : (
              <>
                <span>Generate my menu</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
