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
import {
  APPLIANCE_LABELS,
  DIETARY_LABELS,
  formatKes,
  RECIPES,
} from '../utils/catalogHelper';
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
  tagline: string;
  photo: string;
  icon: typeof Flame;
}[] = [
  {
    id: 'high_protein',
    label: 'High-Protein Gym',
    tagline: 'Lean cuts, eggs, and protein-dense plates (26g to 52g)',
    photo: '/dishes/lemon-pepper-chicken-sweet-potato-skillet.jpg',
    icon: Flame,
  },
  {
    id: 'quick_20min',
    label: '20-Min Quick',
    tagline: 'Weeknight skillets and stir-fries ready in 20 minutes or less',
    photo: '/dishes/teriyaki-chicken-udon.jpg',
    icon: Clock,
  },
  {
    id: 'kenyan_comfort',
    label: 'Kenyan Comfort',
    tagline: 'Rich tomato stews, sukuma, and warm matoke',
    photo: '/dishes/kenyan-tomato-chicken-stew.jpg',
    icon: UtensilsCrossed,
  },
  {
    id: 'plant_forward',
    label: 'Clean & Plant-Forward',
    tagline: 'Greens, chickpeas, avocado, and tofu',
    photo: '/dishes/smashed-chickpea-avocado-toast.jpg',
    icon: Leaf,
  },
  {
    id: 'budget_saver',
    label: 'Budget Saver',
    tagline: 'Lowest cost per serving with ingredient reuse',
    photo: '/dishes/paprika-drumstick-potato-stew.jpg',
    icon: Wallet,
  },
];

const HOUSEHOLD_OPTIONS: HouseholdSize[] = ['1 Person', '2 People', '4+ Family'];
const DAY_OPTIONS: DaysCount[] = [3, 5, 7];
const DIETARY_OPTIONS: DietaryFilter[] = [
  'vegetarian',
  'dairy_free',
  'gluten_free',
  'high_calorie',
];

const APPLIANCE_OPTIONS: ApplianceId[] = [
  'stove',
  'air_fryer',
  'oven',
  'blender',
  'microwave',
  'pressure_cooker',
];

const LOADING_MESSAGES = [
  'Checking Zucchini shelves...',
  `Scanning ${RECIPES.length}-recipe vault...`,
  'Preparing your basket...',
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
    }, 1400);
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
        <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text)] text-balance">
          What are we cooking this week?
        </h1>
        <p className="text-sm sm:text-base text-[var(--text-muted)] max-w-2xl">
          Pick your vibe, household size, and kitchen setup to build a menu from Zucchini Nairobi stock.
        </p>
      </section>

      {/* Saved Weekly Favorites */}
      {savedFavorites.length > 0 && (
        <section className="space-y-3" aria-labelledby="saved-favorites-heading">
          <div className="flex items-baseline justify-between">
            <h2
              id="saved-favorites-heading"
              className="font-display text-base font-semibold text-[var(--text)] inline-flex items-center gap-2"
            >
              <Bookmark className="h-4 w-4 text-[var(--accent-basil)]" aria-hidden="true" />
              <span>Saved weekly favorites</span>
            </h2>
            <span className="text-xs text-[var(--text-muted)] tabular-nums">
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
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-semibold text-[var(--text)] truncate">
                        {fav.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-[var(--text-muted)] tabular-nums">
                        {fav.meals.length} meals · {fav.config.householdSize} ·{' '}
                        <span className="font-semibold text-[var(--text)]">
                          {formatKes(totalKes)}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-muted)] truncate">
                        {fav.meals.map((m) => m.title).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteFavorite(fav.id)}
                      aria-label={`Remove saved favorite ${fav.name}`}
                      className="h-11 w-11 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--accent-ember-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--accent-ember)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => onLoadFavorite(fav, false)}
                      className="flex-1 h-11 px-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--text-muted)] active:scale-[0.98] text-xs font-semibold text-[var(--text)] transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
                    >
                      Open menu
                    </button>
                    <button
                      type="button"
                      onClick={() => onLoadFavorite(fav, true)}
                      className="flex-1 h-11 px-3 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] active:scale-[0.98] text-xs font-semibold text-white transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
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

      {/* Step 1: Photographic Vibe / Goal Cards */}
      <section className="space-y-3" aria-labelledby="step-goal">
        <div className="flex items-baseline justify-between">
          <h2 id="step-goal" className="font-display text-base font-semibold text-[var(--text)]">
            1. Pick your vibe
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Select one</span>
        </div>

        <div
          role="radiogroup"
          aria-labelledby="step-goal"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            const active = config.goal === goal.id;
            return (
              <button
                key={goal.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ ...config, goal: goal.id })}
                className={`relative h-44 rounded-2xl overflow-hidden border text-left transition-[border-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                  active
                    ? 'border-[var(--accent-ember-solid)] ring-1 ring-[var(--accent-ember-solid)]'
                    : 'border-[var(--border)] hover:border-[var(--accent-ember-border)]'
                }`}
              >
                <img
                  src={goal.photo}
                  alt={goal.label}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  className={`absolute inset-0 ${
                    active
                      ? 'bg-gradient-to-t from-[#12100E]/95 via-[#12100E]/60 to-[#12100E]/20'
                      : 'bg-gradient-to-t from-[#12100E]/95 via-[#12100E]/65 to-[#12100E]/25'
                  }`}
                />

                <div className="relative z-10 h-full p-4 flex flex-col justify-between">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        active
                          ? 'bg-[var(--accent-ember-solid)] border-[var(--accent-ember-solid)] text-white'
                          : 'bg-[#12100E]/80 border-white/15 text-[#FAF5EE]'
                      }`}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2.1} />
                    </span>

                    {active && (
                      <span
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent-ember-solid)] text-white"
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-display text-base font-semibold text-[#FAF5EE] leading-snug">
                      {goal.label}
                    </div>
                    <p className="mt-0.5 text-xs text-[#E7E5E4] leading-relaxed">
                      {goal.tagline}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Household & Days */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6" aria-labelledby="step-household">
        <div className="space-y-3">
          <h2 id="step-household" className="font-display text-base font-semibold text-[var(--text)]">
            2. Household size
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="step-household"
            className="grid grid-cols-3 gap-3"
          >
            {HOUSEHOLD_OPTIONS.map((size) => {
              const active = config.householdSize === size;
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ ...config, householdSize: size })}
                  className={`h-12 px-3 rounded-xl border text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                    active
                      ? 'bg-[var(--accent-ember-solid)] border-[var(--accent-ember-solid)] text-white shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent-ember-border)]'
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 id="step-days" className="font-display text-base font-semibold text-[var(--text)]">
            Plan length
          </h2>
          <div
            role="radiogroup"
            aria-labelledby="step-days"
            className="grid grid-cols-3 gap-3"
          >
            {DAY_OPTIONS.map((days) => {
              const active = config.days === days;
              return (
                <button
                  key={days}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onChange({ ...config, days })}
                  className={`h-12 px-3 rounded-xl border text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                    active
                      ? 'bg-[var(--accent-ember-solid)] border-[var(--accent-ember-solid)] text-white shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--accent-ember-border)]'
                  }`}
                >
                  {days} days
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Step 3: Dietary Filters */}
      <section className="space-y-3" aria-labelledby="step-dietary">
        <div className="flex items-baseline justify-between">
          <h2 id="step-dietary" className="font-display text-base font-semibold text-[var(--text)]">
            3. Dietary filters
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Optional</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map((filter) => {
            const active = config.dietaryFilters.includes(filter);
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={active}
                onClick={() => toggleDietary(filter)}
                className={`inline-flex items-center gap-2 h-11 px-4 rounded-xl border text-sm font-medium transition-[border-color,background-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                  active
                    ? 'bg-[var(--accent-ember-tint)] border-[var(--accent-ember-border)] text-[var(--accent-ember)]'
                    : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent-ember-border)] hover:text-[var(--text)]'
                }`}
              >
                {active && (
                  <Check
                    className="h-3.5 w-3.5 text-[var(--accent-ember)]"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                )}
                <span>{DIETARY_LABELS[filter]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 4: Kitchen Appliances */}
      <section className="space-y-3" aria-labelledby="step-appliances">
        <div className="flex items-baseline justify-between">
          <h2 id="step-appliances" className="font-display text-base font-semibold text-[var(--text)]">
            4. What’s in your kitchen?
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Select what you own</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {APPLIANCE_OPTIONS.map((applianceId) => {
            const active = config.appliances.includes(applianceId);
            return (
              <button
                key={applianceId}
                type="button"
                aria-pressed={active}
                onClick={() => toggleAppliance(applianceId)}
                className={`relative flex flex-col items-center justify-center gap-2.5 p-5 rounded-2xl border text-center transition-[border-color,background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ember)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ${
                  active
                    ? 'bg-[var(--surface)] border-[var(--accent-ember-solid)] ring-1 ring-[var(--accent-ember-border)] shadow-[0_1px_2px_rgb(0_0_0/0.05)]'
                    : 'bg-[var(--surface)] border-[var(--border)] hover:border-[var(--accent-ember-border)]'
                }`}
              >
                {active && (
                  <span
                    className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent-ember-solid)] text-white"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                )}
                <ApplianceIllustration id={applianceId} active={active} />
                <span
                  className={`text-xs sm:text-sm font-medium leading-snug ${
                    active ? 'text-[var(--accent-ember)] font-semibold' : 'text-[var(--text)]'
                  }`}
                >
                  {APPLIANCE_LABELS[applianceId]}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[var(--accent-ember-border)] bg-[var(--accent-ember-tint)] px-4 py-3 text-sm text-[var(--accent-ember)]"
        >
          {error}
        </div>
      )}

      {/* Sticky Bottom Primary CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="hidden sm:block text-xs text-[var(--text-muted)] tabular-nums">
            <span className="font-medium text-[var(--text)]">{config.days} days</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{config.householdSize}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>{config.appliances.length} appliance{config.appliances.length > 1 ? 's' : ''}</span>
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={onGenerate}
            className="w-full sm:w-auto sm:min-w-64 h-12 px-6 rounded-xl bg-[var(--accent-basil-solid)] hover:bg-[var(--accent-basil-solid-hover)] active:scale-[0.98] disabled:opacity-80 text-white font-display font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
          >
            {isLoading ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin"
                />
                <span>{LOADING_MESSAGES[loadingIdx]}</span>
              </>
            ) : (
              <>
                <span>Generate my menu</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
