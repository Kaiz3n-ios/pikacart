/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { PikaCartLogo } from './components/Logo';
import { ConfiguratorView } from './components/ConfiguratorView';
import { MenuView } from './components/MenuView';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { AnalyticsModal } from './components/AnalyticsModal';
import type {
  CartItem,
  CatalogItem,
  GeneratedMenuResponse,
  GoalId,
  Meal,
  SavedWeeklyFavorite,
  SessionAnalytics,
  SwapMealResponse,
  UserConfig,
} from './types';
import {
  buildCartFromMenu,
  CATALOG_MAP,
  CATEGORY_ORDER,
  clampPackQty,
  computeSavingsSummary,
  isPantryStapleItem,
} from './utils/catalogHelper';

type AppView = 'config' | 'menu' | 'cart' | 'checkout';

const ANALYTICS_STORAGE_KEY = 'pikacart_session_analytics_v1';
const APP_STATE_STORAGE_KEY = 'pikacart_app_state_v1';
const FAVORITES_STORAGE_KEY = 'pikacart_saved_favorites_v1';

const GOAL_LABELS: Record<GoalId, string> = {
  'high-protein-gym': 'High-Protein Gym',
  '20-min-quick': '20-Min Quick',
  'kenyan-comfort': 'Kenyan Comfort',
  'clean-plant-forward': 'Clean & Plant-Forward',
  'budget-saver': 'Budget Saver',
};

const DEFAULT_CONFIG: UserConfig = {
  goal: 'kenyan-comfort',
  householdSize: '2 People',
  days: 3,
  dietaryFilters: [],
  appliances: ['stove'],
};

const DEFAULT_ANALYTICS: SessionAnalytics = {
  menusGenerated: 0,
  checkoutClicks: 0,
  totalKesRouted: 0,
};

interface PersistedState {
  view: AppView;
  config: UserConfig;
  meals: Meal[];
  savingsSummary: string;
  usedFallback: boolean;
  cartItems: CartItem[];
  ownedPantryIds: number[];
  manualQtyIds: number[];
}

function loadAnalytics(): SessionAnalytics {
  try {
    const raw = localStorage.getItem(ANALYTICS_STORAGE_KEY);
    if (!raw) return DEFAULT_ANALYTICS;
    const parsed = JSON.parse(raw) as Partial<SessionAnalytics>;
    return {
      menusGenerated: Number(parsed.menusGenerated) || 0,
      checkoutClicks: Number(parsed.checkoutClicks) || 0,
      totalKesRouted: Number(parsed.totalKesRouted) || 0,
    };
  } catch {
    return DEFAULT_ANALYTICS;
  }
}

function loadFavorites(): SavedWeeklyFavorite[] {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is SavedWeeklyFavorite =>
        Boolean(f && typeof f.id === 'string' && Array.isArray(f.meals) && Array.isArray(f.cartItems))
    );
  } catch {
    return [];
  }
}

function getMenuSignature(meals: Meal[], config: UserConfig): string {
  return `${config.goal}|${config.householdSize}|${config.days}|${meals
    .map((m) => m.title)
    .join('|')}`;
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) {
      return {
        view: 'config',
        config: DEFAULT_CONFIG,
        meals: [],
        savingsSummary: '',
        usedFallback: false,
        cartItems: [],
        ownedPantryIds: [],
        manualQtyIds: [],
      };
    }
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const meals = Array.isArray(parsed.meals) ? parsed.meals : [];
    const cartItems = Array.isArray(parsed.cartItems) ? parsed.cartItems : [];
    const restoredView: AppView =
      parsed.view && parsed.view !== 'config' && meals.length > 0
        ? parsed.view
        : 'config';

    return {
      view: restoredView,
      config: parsed.config || DEFAULT_CONFIG,
      meals,
      savingsSummary:
        typeof parsed.savingsSummary === 'string' ? parsed.savingsSummary : '',
      usedFallback: Boolean(parsed.usedFallback),
      cartItems,
      ownedPantryIds: Array.isArray(parsed.ownedPantryIds)
        ? parsed.ownedPantryIds.filter((id) => Number.isSafeInteger(id))
        : [],
      manualQtyIds: Array.isArray(parsed.manualQtyIds)
        ? parsed.manualQtyIds.filter((id) => Number.isSafeInteger(id))
        : [],
    };
  } catch {
    return {
      view: 'config',
      config: DEFAULT_CONFIG,
      meals: [],
      savingsSummary: '',
      usedFallback: false,
      cartItems: [],
      ownedPantryIds: [],
      manualQtyIds: [],
    };
  }
}

export default function App() {
  const [initial] = useState<PersistedState>(loadPersistedState);

  const [view, setView] = useState<AppView>(initial.view);
  const [config, setConfig] = useState<UserConfig>(initial.config);
  const [meals, setMeals] = useState<Meal[]>(initial.meals);
  const [savingsSummary, setSavingsSummary] = useState<string>(
    initial.savingsSummary
  );
  const [usedFallback, setUsedFallback] = useState<boolean>(
    initial.usedFallback
  );
  const [cartItems, setCartItems] = useState<CartItem[]>(initial.cartItems);
  const [ownedPantryIds, setOwnedPantryIds] = useState<number[]>(
    initial.ownedPantryIds
  );
  const [manualQtyIds, setManualQtyIds] = useState<number[]>(
    initial.manualQtyIds
  );
  const [savedFavorites, setSavedFavorites] = useState<SavedWeeklyFavorite[]>(
    loadFavorites
  );

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [swappingDay, setSwappingDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  const [analytics, setAnalytics] = useState<SessionAnalytics>(loadAnalytics);
  const [analyticsOpen, setAnalyticsOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(ANALYTICS_STORAGE_KEY, JSON.stringify(analytics));
    } catch {
      // Ignore storage quota errors
    }
  }, [analytics]);

  useEffect(() => {
    try {
      localStorage.setItem(
        FAVORITES_STORAGE_KEY,
        JSON.stringify(savedFavorites)
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [savedFavorites]);

  useEffect(() => {
    try {
      const payload: PersistedState = {
        view,
        config,
        meals,
        savingsSummary,
        usedFallback,
        cartItems,
        ownedPantryIds,
        manualQtyIds,
      };
      localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    view,
    config,
    meals,
    savingsSummary,
    usedFallback,
    cartItems,
    ownedPantryIds,
    manualQtyIds,
  ]);

  const handleGenerateMenu = async () => {
    setIsGenerating(true);
    setError(null);
    setSwapError(null);
    try {
      const response = await fetch('/api/menu/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          errBody?.error || 'Could not generate your meal plan. Please try again.'
        );
      }

      const data = (await response.json()) as GeneratedMenuResponse;
      const ownedSet = new Set<number>(ownedPantryIds);
      const hydratedCart = buildCartFromMenu(
        data.meals,
        data.cart_items,
        undefined,
        ownedSet,
        new Set<number>(),
        config.householdSize
      );

      setMeals(data.meals);
      setSavingsSummary(data.savings_summary);
      setUsedFallback(Boolean(data.usedFallback));
      setCartItems(hydratedCart);
      setManualQtyIds([]);
      setAnalytics((prev) => ({
        ...prev,
        menusGenerated: prev.menusGenerated + 1,
      }));
      setView('menu');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while building your menu.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSwapMeal = async (dayToReplace: number) => {
    setSwappingDay(dayToReplace);
    setSwapError(null);
    try {
      const response = await fetch('/api/menu/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          dayToReplace,
          currentMeals: meals,
          existingCatalogIds: cartItems.map((i) => i.id),
        }),
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          errBody?.error || 'Could not swap that meal right now. Please try again.'
        );
      }

      const data = (await response.json()) as SwapMealResponse;
      const updatedMeals = meals.map((m) =>
        m.day === dayToReplace ? data.meal : m
      );

      const recMap = new Map<number, number>();
      for (const c of cartItems) {
        recMap.set(c.id, c.qty);
      }
      for (const adj of data.cart_adjustments || []) {
        if (!recMap.has(adj.catalog_id)) {
          recMap.set(adj.catalog_id, adj.qty);
        }
      }
      const mergedRecs = Array.from(recMap.entries()).map(([catalog_id, qty]) => ({
        catalog_id,
        qty,
      }));

      const ownedSet = new Set<number>(ownedPantryIds);
      const manualSet = new Set<number>(manualQtyIds);
      const updatedCart = buildCartFromMenu(
        updatedMeals,
        mergedRecs,
        cartItems,
        ownedSet,
        manualSet,
        config.householdSize
      );

      const activeIds = new Set(updatedCart.map((i) => i.id));
      setMeals(updatedMeals);
      setSavingsSummary(computeSavingsSummary(updatedMeals));
      setCartItems(updatedCart);
      setManualQtyIds((prev) => prev.filter((id) => activeIds.has(id)));
      if (data.usedFallback) {
        setUsedFallback(true);
      }
    } catch (err) {
      setSwapError(
        err instanceof Error
          ? err.message
          : 'Could not swap that meal right now. Please try again.'
      );
    } finally {
      setSwappingDay(null);
    }
  };

  const handleToggleInclude = (id: number) => {
    setCartItems((prev) => {
      const next = prev.map((item) =>
        item.id === id ? { ...item, included: !item.included } : item
      );
      const toggled = next.find((i) => i.id === id);
      if (toggled && toggled.isPantryStaple) {
        setOwnedPantryIds((prevOwned) => {
          const set = new Set(prevOwned);
          if (toggled.included) {
            set.delete(id);
          } else {
            set.add(id);
          }
          return Array.from(set);
        });
      }
      return next;
    });
  };

  const handleUpdateQty = (id: number, delta: number) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, qty: clampPackQty(item.qty + delta) }
          : item
      )
    );
    setManualQtyIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleAddExtraItem = (catalogItem: CatalogItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === catalogItem.id);
      if (existing) {
        return prev.map((item) =>
          item.id === catalogItem.id
            ? {
                ...item,
                qty: clampPackQty(item.qty + 1),
                included: true,
              }
            : item
        );
      }

      const nextItem: CartItem = {
        ...catalogItem,
        qty: 1,
        included: true,
        usedInDays: [],
        isPantryStaple: isPantryStapleItem(catalogItem),
        isExtra: true,
      };

      const next = [...prev, nextItem];
      next.sort((a, b) => {
        const catDiff =
          CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat);
        if (catDiff !== 0) return catDiff;
        return a.name.localeCompare(b.name);
      });
      return next;
    });
    setManualQtyIds((prev) =>
      prev.includes(catalogItem.id) ? prev : [...prev, catalogItem.id]
    );
  };

  const handleRemoveExtraItem = (id: number) => {
    setCartItems((prev) =>
      prev.filter((item) => !(item.id === id && item.isExtra))
    );
    setManualQtyIds((prev) => prev.filter((mId) => mId !== id));
  };

  const handleSwapCartItem = (oldId: number, newItem: CatalogItem) => {
    if (oldId === newItem.id) return;

    const nextMeals = meals.map((meal) => {
      const hasOld = meal.ingredients.some((ing) => ing.catalog_id === oldId);
      if (!hasOld) return meal;
      const seen = new Set<number>();
      const nextIngredients = [];
      for (const ing of meal.ingredients) {
        const mappedId = ing.catalog_id === oldId ? newItem.id : ing.catalog_id;
        if (seen.has(mappedId)) continue;
        seen.add(mappedId);
        nextIngredients.push({ ...ing, catalog_id: mappedId });
      }
      return { ...meal, ingredients: nextIngredients };
    });

    const newUsedInDays = nextMeals
      .filter((m) => m.ingredients.some((ing) => ing.catalog_id === newItem.id))
      .map((m) => m.day)
      .sort((a, b) => a - b);

    setMeals(nextMeals);
    setSavingsSummary(computeSavingsSummary(nextMeals));

    setCartItems((prev) => {
      const oldItem = prev.find((i) => i.id === oldId);
      if (!oldItem) return prev;
      const existingNew = prev.find((i) => i.id === newItem.id);

      let next: CartItem[];
      if (existingNew) {
        next = prev
          .filter((i) => i.id !== oldId)
          .map((i) =>
            i.id === newItem.id
              ? {
                  ...i,
                  qty: clampPackQty(i.qty + oldItem.qty),
                  included: true,
                  usedInDays: newUsedInDays,
                  isPantryStaple: isPantryStapleItem(newItem),
                  isExtra: newUsedInDays.length === 0,
                }
              : i
          );
      } else {
        const swapped: CartItem = {
          ...newItem,
          qty: oldItem.qty,
          included: oldItem.included,
          usedInDays: newUsedInDays,
          isPantryStaple: isPantryStapleItem(newItem),
          isExtra: Boolean(oldItem.isExtra && newUsedInDays.length === 0),
        };
        next = prev.map((i) => (i.id === oldId ? swapped : i));
      }

      next.sort((a, b) => {
        const catDiff =
          CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat);
        if (catDiff !== 0) return catDiff;
        return a.name.localeCompare(b.name);
      });
      return next;
    });

    setManualQtyIds((prev) => {
      const hadOld = prev.includes(oldId);
      const filtered = prev.filter((id) => id !== oldId);
      if (hadOld && !filtered.includes(newItem.id)) {
        return [...filtered, newItem.id];
      }
      return filtered;
    });

    setOwnedPantryIds((prev) => prev.filter((id) => id !== oldId));
  };

  const handleExcludeAllPantry = () => {
    setCartItems((prev) => {
      const pantryItems = prev.filter((i) => i.isPantryStaple);
      const allExcluded =
        pantryItems.length > 0 && pantryItems.every((i) => !i.included);
      const targetIncluded = allExcluded;

      setOwnedPantryIds((prevOwned) => {
        const set = new Set(prevOwned);
        for (const p of pantryItems) {
          if (targetIncluded) {
            set.delete(p.id);
          } else {
            set.add(p.id);
          }
        }
        return Array.from(set);
      });

      return prev.map((item) =>
        item.isPantryStaple ? { ...item, included: targetIncluded } : item
      );
    });
  };

  const handleCheckoutClick = (totalKes: number) => {
    setAnalytics((prev) => ({
      ...prev,
      checkoutClicks: prev.checkoutClicks + 1,
      totalKesRouted: prev.totalKesRouted + totalKes,
    }));
  };

  const currentMenuSig =
    meals.length > 0 ? getMenuSignature(meals, config) : '';

  const isCurrentMenuSaved = Boolean(
    currentMenuSig &&
      savedFavorites.some(
        (fav) => getMenuSignature(fav.meals, fav.config) === currentMenuSig
      )
  );

  const handleToggleSaveFavorite = () => {
    if (meals.length === 0) return;

    if (isCurrentMenuSaved) {
      setSavedFavorites((prev) =>
        prev.filter(
          (fav) => getMenuSignature(fav.meals, fav.config) !== currentMenuSig
        )
      );
      return;
    }

    const fav: SavedWeeklyFavorite = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${GOAL_LABELS[config.goal]} · ${config.days} days`,
      savedAt: new Date().toISOString(),
      config,
      meals,
      savingsSummary,
      cartItems,
      manualQtyIds,
    };

    setSavedFavorites((prev) => [fav, ...prev].slice(0, 8));
  };

  const handleLoadFavorite = (
    fav: SavedWeeklyFavorite,
    goToCart = false
  ) => {
    const hydratedFavoriteCart: CartItem[] = (fav.cartItems || [])
      .filter((i) => CATALOG_MAP.has(i.id))
      .map((i) => {
        const live = CATALOG_MAP.get(i.id)!;
        return {
          ...live,
          qty: clampPackQty(i.qty),
          included: Boolean(i.included),
          usedInDays: Array.isArray(i.usedInDays) ? i.usedInDays : [],
          isPantryStaple: isPantryStapleItem(live),
          isExtra: Boolean(i.isExtra),
        };
      });

    setConfig(fav.config);
    setMeals(fav.meals);
    setSavingsSummary(fav.savingsSummary);
    setUsedFallback(false);
    setCartItems(hydratedFavoriteCart);
    setManualQtyIds(fav.manualQtyIds || []);
    setError(null);
    setSwapError(null);
    setView(goToCart ? 'cart' : 'menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFavorite = (id: string) => {
    setSavedFavorites((prev) => prev.filter((fav) => fav.id !== id));
  };

  const hasMenu = meals.length > 0;

  const navItems: { id: AppView; label: string; enabled: boolean }[] = [
    { id: 'config', label: 'Plan', enabled: true },
    { id: 'menu', label: 'Menu', enabled: hasMenu },
    { id: 'cart', label: 'Cart', enabled: hasMenu },
    { id: 'checkout', label: 'Checkout', enabled: hasMenu },
  ];

  const handleNavigate = (target: AppView) => {
    if (!hasMenu && target !== 'config') return;
    setView(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasStickyBottomBar = view !== 'checkout';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#18181B]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-[#18181B]/10 bg-[#FAF9F6]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => handleNavigate('config')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] rounded-lg"
          >
            <PikaCartLogo />
          </button>

          {/* Desktop step tabs */}
          <nav
            aria-label="Meal planning steps"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navItems.map((tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={!tab.enabled}
                  onClick={() => handleNavigate(tab.id)}
                  className={`py-1 transition-colors duration-150 whitespace-nowrap shrink-0 border-b-2 ${
                    active
                      ? 'border-[#15803D] text-[#15803D] font-semibold'
                      : tab.enabled
                        ? 'border-transparent text-[#52525B] hover:text-[#18181B]'
                        : 'border-transparent text-[#A1A1AA] cursor-not-allowed'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Store sync badge */}
          <div className="inline-flex items-center rounded-full border border-[#15803D]/25 bg-white px-3 py-1 text-xs font-medium text-[#15803D] whitespace-nowrap shrink-0">
            Synced with Zucchini Nairobi
          </div>
        </div>
      </header>

      {/* Mobile compact step bar (shown only once a menu exists) */}
      {hasMenu && (
        <div className="md:hidden border-b border-[#18181B]/10 bg-white">
          <div className="mx-auto max-w-5xl px-4 flex items-center justify-between gap-1">
            {navItems.map((tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id)}
                  className={`flex-1 py-2.5 text-xs font-semibold text-center border-b-2 transition-colors duration-150 whitespace-nowrap ${
                    active
                      ? 'border-[#15803D] text-[#15803D]'
                      : 'border-transparent text-[#52525B]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 pt-6 sm:pt-8">
        {view === 'config' && (
          <ConfiguratorView
            config={config}
            savedFavorites={savedFavorites}
            onChange={setConfig}
            onGenerate={handleGenerateMenu}
            onLoadFavorite={handleLoadFavorite}
            onDeleteFavorite={handleDeleteFavorite}
            isLoading={isGenerating}
            error={error}
          />
        )}

        {view === 'menu' && (
          <MenuView
            meals={meals}
            householdSize={config.householdSize}
            savingsSummary={savingsSummary}
            usedFallback={usedFallback}
            cartItems={cartItems}
            swappingDay={swappingDay}
            swapError={swapError}
            isSavedFavorite={isCurrentMenuSaved}
            onToggleSaveFavorite={handleToggleSaveFavorite}
            onDismissSwapError={() => setSwapError(null)}
            onSwapMeal={handleSwapMeal}
            onReviewCart={() => handleNavigate('cart')}
            onBackToConfig={() => handleNavigate('config')}
            onRetryAi={handleGenerateMenu}
          />
        )}

        {view === 'cart' && (
          <CartView
            items={cartItems}
            onToggleInclude={handleToggleInclude}
            onUpdateQty={handleUpdateQty}
            onExcludeAllPantry={handleExcludeAllPantry}
            onAddExtraItem={handleAddExtraItem}
            onRemoveExtraItem={handleRemoveExtraItem}
            onSwapCartItem={handleSwapCartItem}
            onBackToMenu={() => handleNavigate('menu')}
            onProceedToCheckout={() => handleNavigate('checkout')}
          />
        )}

        {view === 'checkout' && (
          <CheckoutView
            config={config}
            meals={meals}
            items={cartItems}
            onBackToCart={() => handleNavigate('cart')}
            onStartOver={() => handleNavigate('config')}
            onCheckoutClick={handleCheckoutClick}
          />
        )}
      </main>

      {/* Subtle Footer with Demo Analytics */}
      <footer
        className={`border-t border-[#18181B]/10 bg-[#FAF9F6] py-5 ${
          hasStickyBottomBar ? 'mb-16 sm:mb-14' : ''
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#52525B]">
          <span>PikaCart, synced with Zucchini Food Market Nairobi</span>
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="font-medium text-[#52525B] hover:text-[#18181B] underline underline-offset-4 py-1 transition-colors duration-150"
          >
            Demo analytics
          </button>
        </div>
      </footer>

      <AnalyticsModal
        open={analyticsOpen}
        analytics={analytics}
        onClose={() => setAnalyticsOpen(false)}
        onReset={() => setAnalytics(DEFAULT_ANALYTICS)}
      />
    </div>
  );
}
