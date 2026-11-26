/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { PikaCartLogo } from './components/Logo';
import { ConfiguratorView } from './components/ConfiguratorView';
import { MenuView } from './components/MenuView';
import { CartView } from './components/CartView';
import { CheckoutView } from './components/CheckoutView';
import { AnalyticsModal } from './components/AnalyticsModal';
import type {
  ApplianceId,
  CartItem,
  CatalogItem,
  DaysCount,
  DietaryFilter,
  GeneratedMenuResponse,
  GoalId,
  HouseholdSize,
  Meal,
  SavedWeeklyFavorite,
  SessionAnalytics,
  SwapMealResponse,
  UserConfig,
} from './types';
import {
  buildCartFromMenu,
  CATALOG,
  CATALOG_MAP,
  CATEGORY_ORDER,
  clampPackQty,
  computeSavingsSummary,
  GOAL_LABELS,
  isPantryStapleItem,
  RECIPE_MAP,
  RECIPES,
} from './utils/catalogHelper';

type AppView = 'config' | 'menu' | 'cart' | 'checkout';
type ThemeMode = 'dark' | 'light';

const ANALYTICS_STORAGE_KEY = 'pikacart_v2_analytics';
const APP_STATE_STORAGE_KEY = 'pikacart_v2_state';
const FAVORITES_STORAGE_KEY = 'pikacart_v2_favorites';
const THEME_STORAGE_KEY = 'pikacart_v2_theme';

const VALID_GOALS = new Set<GoalId>([
  'high_protein',
  'quick_20min',
  'kenyan_comfort',
  'plant_forward',
  'budget_saver',
]);

const VALID_HOUSEHOLDS = new Set<HouseholdSize>([
  '1 Person',
  '2 People',
  '4+ Family',
]);

const VALID_DAYS = new Set<DaysCount>([3, 5, 7]);

const VALID_DIETARY = new Set<DietaryFilter>([
  'vegetarian',
  'dairy_free',
  'gluten_free',
  'high_calorie',
]);

const VALID_APPLIANCES = new Set<ApplianceId>([
  'stove',
  'air_fryer',
  'oven',
  'blender',
  'microwave',
  'pressure_cooker',
]);

const DEFAULT_CONFIG: UserConfig = {
  goal: 'kenyan_comfort',
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

function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

function sanitizeConfig(raw: unknown): UserConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CONFIG;
  const obj = raw as Partial<UserConfig>;
  const goal =
    typeof obj.goal === 'string' && VALID_GOALS.has(obj.goal as GoalId)
      ? (obj.goal as GoalId)
      : DEFAULT_CONFIG.goal;
  const householdSize =
    typeof obj.householdSize === 'string' &&
    VALID_HOUSEHOLDS.has(obj.householdSize as HouseholdSize)
      ? (obj.householdSize as HouseholdSize)
      : DEFAULT_CONFIG.householdSize;
  const days =
    typeof obj.days === 'number' && VALID_DAYS.has(obj.days as DaysCount)
      ? (obj.days as DaysCount)
      : DEFAULT_CONFIG.days;
  const dietaryFilters = Array.isArray(obj.dietaryFilters)
    ? obj.dietaryFilters.filter(
        (d): d is DietaryFilter =>
          typeof d === 'string' && VALID_DIETARY.has(d as DietaryFilter)
      )
    : [];
  const appliances = Array.isArray(obj.appliances)
    ? obj.appliances.filter(
        (a): a is ApplianceId =>
          typeof a === 'string' && VALID_APPLIANCES.has(a as ApplianceId)
      )
    : [];

  return {
    goal,
    householdSize,
    days,
    dietaryFilters,
    appliances: appliances.length > 0 ? appliances : ['stove'],
  };
}

function validateAndHydrateMeals(rawMeals: unknown): Meal[] {
  if (!Array.isArray(rawMeals)) return [];
  const hydrated: Meal[] = [];

  for (let i = 0; i < rawMeals.length; i++) {
    const m = rawMeals[i];
    if (!m || typeof m !== 'object') continue;
    const obj = m as Partial<Meal>;

    if (obj.is_dynamic_fallback) {
      const validIngredients = Array.isArray(obj.ingredients)
        ? obj.ingredients.filter(
            (ing) =>
              ing &&
              Number.isSafeInteger(Number(ing.catalog_id)) &&
              CATALOG_MAP.has(Number(ing.catalog_id))
          )
        : [];
      if (validIngredients.length === 0 || typeof obj.title !== 'string') continue;

      hydrated.push({
        day: typeof obj.day === 'number' && obj.day > 0 ? obj.day : hydrated.length + 1,
        id: typeof obj.id === 'string' ? obj.id : `dynamic-${hydrated.length + 1}`,
        title: obj.title,
        tagline: typeof obj.tagline === 'string' ? obj.tagline : '',
        prep_mins: Number(obj.prep_mins) || 20,
        protein_g: Number(obj.protein_g) || 24,
        calories: Number(obj.calories) || 520,
        base_servings: Number(obj.base_servings) || 2,
        appliances: Array.isArray(obj.appliances) ? obj.appliances : ['stove'],
        photo: '',
        is_dynamic_fallback: true,
        ingredients: validIngredients,
        steps: Array.isArray(obj.steps) ? obj.steps.map(String) : [],
      });
      continue;
    }

    if (typeof obj.id === 'string' && RECIPE_MAP.has(obj.id)) {
      const vaultRecipe = RECIPE_MAP.get(obj.id)!;
      hydrated.push({
        day: typeof obj.day === 'number' && obj.day > 0 ? obj.day : hydrated.length + 1,
        id: vaultRecipe.id,
        title: vaultRecipe.title,
        tagline: vaultRecipe.tagline,
        prep_mins: vaultRecipe.prep_mins,
        protein_g: vaultRecipe.protein_g,
        calories: vaultRecipe.calories,
        base_servings: vaultRecipe.base_servings || 2,
        appliances: vaultRecipe.appliances,
        photo: vaultRecipe.photo,
        is_dynamic_fallback: false,
        ingredients: vaultRecipe.ingredients,
        steps: vaultRecipe.steps,
      });
    }
  }

  return hydrated;
}

function hydrateCartItems(rawCart: unknown): CartItem[] {
  if (!Array.isArray(rawCart)) return [];
  const items: CartItem[] = [];
  for (const raw of rawCart) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<CartItem>;
    const id = Number(item.id);
    const live = CATALOG_MAP.get(id);
    if (!live) continue;
    items.push({
      ...live,
      qty: clampPackQty(item.qty),
      included: typeof item.included === 'boolean' ? item.included : true,
      usedInDays: Array.isArray(item.usedInDays) ? item.usedInDays : [],
      isPantryStaple: Boolean(item.isPantryStaple) || isPantryStapleItem(live),
      isExtra: Boolean(item.isExtra),
    });
  }
  return items;
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
    const clean: SavedWeeklyFavorite[] = [];
    for (const f of parsed) {
      if (!f || typeof f !== 'object' || typeof f.id !== 'string') continue;
      const validMeals = validateAndHydrateMeals(f.meals);
      if (validMeals.length === 0) continue;
      const validCart = hydrateCartItems(f.cartItems);
      clean.push({
        id: f.id,
        name: typeof f.name === 'string' ? f.name : 'Saved Weekly Plan',
        savedAt: typeof f.savedAt === 'string' ? f.savedAt : new Date().toISOString(),
        config: sanitizeConfig(f.config),
        meals: validMeals,
        savingsSummary:
          typeof f.savingsSummary === 'string'
            ? f.savingsSummary
            : computeSavingsSummary(validMeals),
        cartItems: validCart,
        manualQtyIds: Array.isArray(f.manualQtyIds)
          ? f.manualQtyIds.filter((id: unknown): id is number => Number.isSafeInteger(id))
          : [],
      });
    }
    return clean;
  } catch {
    return [];
  }
}

function getMenuSignature(meals: Meal[], config: UserConfig): string {
  return `${config.goal}|${config.householdSize}|${config.days}|${meals
    .map((m) => m.id)
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
    const config = sanitizeConfig(parsed.config);
    const meals = validateAndHydrateMeals(parsed.meals);
    const ownedPantryIds = Array.isArray(parsed.ownedPantryIds)
      ? parsed.ownedPantryIds.filter((id) => Number.isSafeInteger(id))
      : [];
    const manualQtyIds = Array.isArray(parsed.manualQtyIds)
      ? parsed.manualQtyIds.filter((id) => Number.isSafeInteger(id))
      : [];
    const cartItems =
      meals.length > 0
        ? hydrateCartItems(parsed.cartItems)
        : [];
    const restoredView: AppView =
      parsed.view && parsed.view !== 'config' && meals.length > 0
        ? parsed.view
        : 'config';

    return {
      view: restoredView,
      config,
      meals,
      savingsSummary:
        typeof parsed.savingsSummary === 'string' ? parsed.savingsSummary : '',
      usedFallback: Boolean(parsed.usedFallback),
      cartItems:
        cartItems.length > 0
          ? cartItems
          : meals.length > 0
            ? buildCartFromMenu(
                meals,
                config.householdSize,
                undefined,
                new Set(ownedPantryIds),
                new Set(manualQtyIds)
              )
            : [],
      ownedPantryIds,
      manualQtyIds,
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

  const [theme, setTheme] = useState<ThemeMode>(loadTheme);
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
    document.documentElement.classList.toggle('theme-light', theme === 'light');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

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
        config.householdSize,
        undefined,
        ownedSet,
        new Set<number>()
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
      navigateToView('menu');
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

      const ownedSet = new Set<number>(ownedPantryIds);
      const manualSet = new Set<number>(manualQtyIds);
      const updatedCart = buildCartFromMenu(
        updatedMeals,
        config.householdSize,
        cartItems,
        ownedSet,
        manualSet
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
        item.id === id ? { ...item, qty: clampPackQty(item.qty + delta) } : item
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
    const hydratedFavoriteCart = hydrateCartItems(fav.cartItems);

    setConfig(fav.config);
    setMeals(fav.meals);
    setSavingsSummary(fav.savingsSummary);
    setUsedFallback(false);
    setCartItems(hydratedFavoriteCart);
    setManualQtyIds(fav.manualQtyIds || []);
    setError(null);
    setSwapError(null);
    navigateToView(goToCart ? 'cart' : 'menu');
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

  function navigateToView(target: AppView, pushHistory = true) {
    setView(target);
    if (pushHistory && typeof window !== 'undefined') {
      const nextHash = `#${target}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState({ view: target }, '', nextHash);
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    const VALID_VIEWS = new Set<AppView>(['config', 'menu', 'cart', 'checkout']);
    const initialHash = window.location.hash.replace('#', '') as AppView;
    if (VALID_VIEWS.has(initialHash)) {
      if (initialHash !== 'config' && meals.length > 0) {
        setView(initialHash);
      }
    } else {
      window.history.replaceState({ view }, '', `#${view}`);
    }

    const onPopState = (event: PopStateEvent) => {
      const stateView = (event.state as { view?: AppView } | null)?.view;
      const hashView = window.location.hash.replace('#', '') as AppView;
      const candidate = stateView || hashView || 'config';
      if (!VALID_VIEWS.has(candidate) || (candidate !== 'config' && meals.length === 0)) {
        setView('config');
        return;
      }
      setView(candidate);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [meals.length]);

  const handleNavigate = (target: AppView) => {
    if (!hasMenu && target !== 'config') return;
    navigateToView(target);
  };

  const hasStickyBottomBar = view !== 'checkout';

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-[var(--accent-basil-solid)] focus:text-white focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigate('config')}
            className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] rounded-lg"
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
                  aria-current={active ? 'step' : undefined}
                  onClick={() => handleNavigate(tab.id)}
                  className={`py-2 px-1 transition-colors duration-150 whitespace-nowrap shrink-0 border-b-2 rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                    active
                      ? 'border-[var(--accent-basil)] text-[var(--accent-basil)] font-semibold'
                      : tab.enabled
                        ? 'border-transparent text-[var(--text-muted)] hover:text-[var(--text)]'
                        : 'border-transparent text-[var(--text-muted)]/40 cursor-not-allowed'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="h-11 w-11 sm:h-10 sm:w-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent-ember-border)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[var(--accent-ember)]" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--text)]" aria-hidden="true" />
              )}
            </button>

            <div className="hidden sm:inline-flex items-center rounded-full border border-[var(--accent-basil-border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--accent-basil)] whitespace-nowrap shrink-0">
              Synced with Zucchini Nairobi
            </div>
          </div>
        </div>
      </header>

      {/* Mobile compact step bar */}
      {hasMenu && (
        <nav
          aria-label="Mobile meal planning steps"
          className="md:hidden border-b border-[var(--border)] bg-[var(--surface)]"
        >
          <div className="mx-auto max-w-5xl px-4 flex items-center justify-between gap-1">
            {navItems.map((tab) => {
              const active = view === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'step' : undefined}
                  onClick={() => handleNavigate(tab.id)}
                  className={`flex-1 min-h-[44px] py-2.5 text-xs font-semibold text-center border-b-2 transition-colors duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)] ${
                    active
                      ? 'border-[var(--accent-basil)] text-[var(--accent-basil)]'
                      : 'border-transparent text-[var(--text-muted)]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-5xl px-4 pt-6 sm:pt-8 focus:outline-none"
      >
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
            meals={meals}
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

      {/* Footer with Vault Verification & Demo Analytics */}
      <footer
        className={`border-t border-[var(--border)] bg-[var(--bg)] py-5 ${
          hasStickyBottomBar ? 'mb-16 sm:mb-14' : ''
        }`}
      >
        <div className="mx-auto max-w-5xl px-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>PikaCart, synced with Zucchini Food Market Nairobi</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              Vault: {RECIPES.length} recipes • {CATALOG.length} Zucchini SKUs
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="min-h-[44px] px-1 font-medium text-[var(--text-muted)] hover:text-[var(--text)] underline underline-offset-4 transition-colors duration-150 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-basil)]"
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
