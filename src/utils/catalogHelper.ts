import catalogData from '../data/catalog.json';
import recipesData from '../data/recipes.json';
import type {
  ApplianceId,
  CartItem,
  CatalogCategory,
  CatalogItem,
  DietaryFilter,
  GoalId,
  HouseholdSize,
  Meal,
  VaultRecipe,
} from '../types';

export const CATALOG: CatalogItem[] = catalogData as CatalogItem[];
export const RECIPES: VaultRecipe[] = recipesData as VaultRecipe[];

export const CATALOG_MAP: Map<number, CatalogItem> = new Map(
  CATALOG.map((item) => [item.id, item])
);

export const RECIPE_MAP: Map<string, VaultRecipe> = new Map(
  RECIPES.map((recipe) => [recipe.id, recipe])
);

export const CATEGORY_ORDER: CatalogCategory[] = [
  'protein',
  'produce',
  'dairy',
  'pantry_grains',
  'spices_sauces',
  'bakery',
];

export const CATEGORY_LABELS: Record<CatalogCategory, string> = {
  protein: 'Protein',
  produce: 'Produce',
  dairy: 'Dairy',
  pantry_grains: 'Pantry & Grains',
  spices_sauces: 'Spices & Sauces',
  bakery: 'Bakery',
};

export const GOAL_LABELS: Record<GoalId, string> = {
  high_protein: 'High-Protein Gym',
  quick_20min: '20-Min Quick',
  kenyan_comfort: 'Kenyan Comfort',
  plant_forward: 'Clean & Plant-Forward',
  budget_saver: 'Budget Saver',
};

export const DIETARY_LABELS: Record<DietaryFilter, string> = {
  vegetarian: 'Vegetarian',
  dairy_free: 'Dairy-Free',
  gluten_free: 'Gluten-Free',
  high_calorie: 'High-Calorie / Bulking',
};

export const APPLIANCE_LABELS: Record<ApplianceId, string> = {
  stove: 'Gas / Electric Stove',
  air_fryer: 'Air Fryer',
  oven: 'Oven',
  blender: 'Blender',
  microwave: 'Microwave',
  pressure_cooker: 'Pressure / Rice Cooker',
};

export function clampPackQty(qty: unknown): number {
  const num = Math.trunc(Number(qty) || 1);
  return Math.min(20, Math.max(1, num));
}

export function formatKes(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function getServingsCount(householdSize: HouseholdSize): number {
  if (householdSize === '1 Person') return 1;
  if (householdSize === '4+ Family') return 4;
  return 2;
}

const FRACTION_MAP: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};

function formatScaledKitchenAmount(value: number): string {
  if (value <= 0) return '0';
  const whole = Math.floor(value + 1e-6);
  const rem = value - whole;

  const fractionEntries: [number, string][] = [
    [0.25, '¼'],
    [1 / 3, '⅓'],
    [0.5, '½'],
    [2 / 3, '⅔'],
    [0.75, '¾'],
  ];

  if (rem < 0.08) {
    return String(Math.max(1, whole));
  }
  if (rem > 0.92) {
    return String(whole + 1);
  }
  for (const [frac, glyph] of fractionEntries) {
    if (Math.abs(rem - frac) < 0.08) {
      return whole > 0 ? `${whole}${glyph}` : glyph;
    }
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function scaleIngredientDisplay(display: string, scaleFactor: number): string {
  if (!display || Math.abs(scaleFactor - 1) < 0.01) return display;

  const trimmed = display.trim();
  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)(?:\s*([¼½¾⅓⅔]))?(.*)$|^([¼½¾⅓⅔])(.*)$/
  );
  if (!match) return display;

  let numericValue = 0;
  let rest = '';

  if (match[1] !== undefined) {
    numericValue = parseFloat(match[1]) + (match[2] ? FRACTION_MAP[match[2]] || 0 : 0);
    rest = match[3] || '';
  } else if (match[4] !== undefined) {
    numericValue = FRACTION_MAP[match[4]] || 0;
    rest = match[5] || '';
  }

  if (!Number.isFinite(numericValue) || numericValue <= 0) return display;

  const scaled = numericValue * scaleFactor;
  // For grams/ml (e.g. 300g, 150ml), round to clean whole numbers
  if (/^(?:g|ml|kg|l)\b/i.test(rest.trim())) {
    const roundedMeasure =
      scaled >= 20 ? Math.round(scaled / 5) * 5 : Math.max(1, Math.round(scaled));
    return `${roundedMeasure}${rest}`;
  }

  return `${formatScaledKitchenAmount(scaled)}${rest}`;
}

export function isPantryStapleItem(item: CatalogItem): boolean {
  if (item.cat === 'spices_sauces') return true;
  if (item.cat === 'pantry_grains' && /\b(oil|vinegar)\b/i.test(item.name)) {
    return true;
  }
  return false;
}

export function computeMealCostPerServing(
  meal: Meal,
  cartItems: CartItem[],
  householdSize: HouseholdSize
): number {
  const servings = getServingsCount(householdSize);
  const cartMap = new Map(cartItems.map((c) => [c.id, c]));

  let mealCost = 0;
  for (const ing of meal.ingredients || []) {
    const id = Number(ing.catalog_id);
    const catalogItem = CATALOG_MAP.get(id);
    if (!catalogItem) continue;
    const cartItem = cartMap.get(id);
    if (cartItem && !cartItem.included) continue;
    const totalPackCost = cartItem ? cartItem.price * cartItem.qty : catalogItem.price;
    const sharedAcrossDays =
      cartItem && cartItem.usedInDays.length > 0 ? cartItem.usedInDays.length : 1;
    mealCost += totalPackCost / sharedAcrossDays;
  }

  return Math.round(mealCost / servings);
}

export function computeSavingsSummary(meals: Meal[]): string {
  const usageCounts = new Map<number, number>();
  for (const meal of meals) {
    const seen = new Set<number>();
    for (const ing of meal.ingredients || []) {
      const id = Number(ing.catalog_id);
      if (CATALOG_MAP.has(id) && !seen.has(id)) {
        seen.add(id);
        usageCounts.set(id, (usageCounts.get(id) || 0) + 1);
      }
    }
  }

  const sharedNames = Array.from(usageCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => CATALOG_MAP.get(id)?.name.split(' - ')[0].split('(')[0].trim())
    .filter((n): n is string => Boolean(n));

  if (sharedNames.length >= 2) {
    return `Shared-ingredient plan: your ${meals.length}-day menu reuses ${sharedNames.join(', ')} across multiple days to cut cost and waste.`;
  }
  return `Your ${meals.length}-day menu reuses core Zucchini pantry staples and fresh produce across multiple meals.`;
}

export function buildCartFromMenu(
  meals: Meal[],
  householdSize: HouseholdSize = '2 People',
  previousItems?: CartItem[],
  ownedPantryIds?: Set<number>,
  manualQtyIds?: Set<number>
): CartItem[] {
  const people = getServingsCount(householdSize);
  const prevMap = new Map((previousItems || []).map((i) => [i.id, i]));

  const scaledQtyByCatalogId = new Map<number, number>();
  const daysByCatalogId = new Map<number, Set<number>>();
  const pantryHintByCatalogId = new Map<number, boolean>();

  for (const meal of meals) {
    const baseServings =
      Number.isFinite(meal.base_servings) && meal.base_servings > 0
        ? meal.base_servings
        : 2;
    const scale = people / baseServings;

    for (const ing of meal.ingredients || []) {
      const id = Number(ing.catalog_id);
      if (!Number.isSafeInteger(id) || !CATALOG_MAP.has(id)) continue;

      const qtyBase =
        Number.isFinite(ing.qty_base) && ing.qty_base > 0 ? ing.qty_base : 0.5;
      scaledQtyByCatalogId.set(
        id,
        (scaledQtyByCatalogId.get(id) || 0) + qtyBase * scale
      );

      if (!daysByCatalogId.has(id)) {
        daysByCatalogId.set(id, new Set());
      }
      daysByCatalogId.get(id)!.add(meal.day);

      if (ing.is_pantry) {
        pantryHintByCatalogId.set(id, true);
      }
    }
  }

  // Retain user-added extras not currently referenced by meals
  const extraIds = (previousItems || [])
    .filter((i) => i.isExtra && !daysByCatalogId.has(i.id) && CATALOG_MAP.has(i.id))
    .map((i) => i.id);

  const allIds = new Set<number>([...daysByCatalogId.keys(), ...extraIds]);

  const items: CartItem[] = [];
  for (const id of allIds) {
    const catalogItem = CATALOG_MAP.get(id);
    if (!catalogItem) continue;

    const prev = prevMap.get(id);
    const usedInDays = Array.from(daysByCatalogId.get(id) || []).sort((a, b) => a - b);
    const isManual = Boolean(manualQtyIds && manualQtyIds.has(id));
    const isExtra = Boolean(prev?.isExtra && usedInDays.length === 0);

    let qty: number;
    if (prev && (isManual || isExtra)) {
      qty = clampPackQty(prev.qty);
    } else {
      const totalScaledQty = scaledQtyByCatalogId.get(id) || 0;
      const cleanScaled = Math.round(totalScaledQty * 10000) / 10000;
      qty = clampPackQty(Math.max(1, Math.ceil(cleanScaled)));
    }

    const isPantry =
      isPantryStapleItem(catalogItem) || Boolean(pantryHintByCatalogId.get(id));
    const defaultIncluded =
      isPantry && ownedPantryIds && ownedPantryIds.has(id) ? false : true;

    items.push({
      ...catalogItem,
      qty,
      included: prev ? prev.included : defaultIncluded,
      usedInDays,
      isPantryStaple: isPantry,
      isExtra,
    });
  }

  items.sort((a, b) => {
    const catDiff = CATEGORY_ORDER.indexOf(a.cat) - CATEGORY_ORDER.indexOf(b.cat);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });

  return items;
}

export function buildShopifyCartUrl(items: CartItem[]): string {
  const lineItems = items
    .filter(
      (i) =>
        i.included &&
        Number.isSafeInteger(i.id) &&
        i.id > 0 &&
        CATALOG_MAP.has(i.id) &&
        Number.isFinite(i.qty) &&
        i.qty > 0
    )
    .map((i) => `${Math.trunc(i.id)}:${clampPackQty(i.qty)}`)
    .join(',');

  if (!lineItems) {
    return '';
  }

  return `https://zucchini.co.ke/cart/${lineItems}`;
}

export function buildWhatsAppShoppingList(items: CartItem[], meals: Meal[]): string {
  const activeItems = items.filter((i) => i.included && i.qty > 0);
  const totalKes = activeItems.reduce((sum, i) => sum + i.price * i.qty, 0);

  const lines: string[] = [
    '🛒 *PikaCart x Zucchini Nairobi Shopping List*',
    '',
    '🍽️ *This Week’s Menu:*',
    ...meals.map((m) => `• Day ${m.day}: ${m.title}`),
    '',
    '🥬 *Groceries to Buy:*',
  ];

  for (const cat of CATEGORY_ORDER) {
    const catItems = activeItems.filter((i) => i.cat === cat);
    if (catItems.length === 0) continue;
    lines.push(`\n*${CATEGORY_LABELS[cat]}*`);
    for (const item of catItems) {
      lines.push(
        `☐ ${item.qty}x ${item.name} (${item.unit}) - ${formatKes(item.price * item.qty)}`
      );
    }
  }

  const cartUrl = buildShopifyCartUrl(items);
  lines.push('');
  lines.push(`💰 *Estimated Total:* ${formatKes(totalKes)}`);
  if (cartUrl) {
    lines.push(`🔗 *1-Click Cart:* ${cartUrl}`);
  }

  return lines.join('\n');
}
