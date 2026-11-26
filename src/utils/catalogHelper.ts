import catalogData from '../data/catalog.json';
import type {
  CartItem,
  CartRecommendation,
  CatalogCategory,
  CatalogItem,
  HouseholdSize,
  Meal,
} from '../types';

export const CATALOG: CatalogItem[] = catalogData as CatalogItem[];

export const CATALOG_MAP: Map<number, CatalogItem> = new Map(
  CATALOG.map((item) => [item.id, item])
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
    const sharedAcrossDays = cartItem && cartItem.usedInDays.length > 0 ? cartItem.usedInDays.length : 1;
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
    return `Your ${meals.length}-day plan shares ${sharedNames.join(', ')} across multiple meals to cut waste and cost.`;
  }
  return `Your ${meals.length}-day menu reuses core pantry staples and fresh produce across multiple meals.`;
}

export function computeOptimizedPackQty(
  item: CatalogItem,
  usesAcrossMeals: number,
  householdSize: HouseholdSize
): number {
  const mult = householdSize === '4+ Family' ? 2 : 1;
  if (item.cat === 'protein' || item.cat === 'bakery') {
    return clampPackQty(Math.ceil((usesAcrossMeals * mult) / 2));
  }
  if (item.cat === 'produce' && mult > 1 && usesAcrossMeals >= 2) {
    return 2;
  }
  return 1;
}

export function buildCartFromMenu(
  meals: Meal[],
  cartRecommendations: CartRecommendation[],
  previousItems?: CartItem[],
  ownedPantryIds?: Set<number>,
  manualQtyIds?: Set<number>,
  householdSize: HouseholdSize = '2 People'
): CartItem[] {
  const prevMap = new Map((previousItems || []).map((i) => [i.id, i]));

  // Merge duplicate catalog_ids from recommendations by summing and clamping 1-20
  const recQtyMap = new Map<number, number>();
  for (const r of cartRecommendations || []) {
    const id = Number(r.catalog_id);
    if (!Number.isSafeInteger(id) || !CATALOG_MAP.has(id)) continue;
    const prevRecQty = recQtyMap.get(id) || 0;
    recQtyMap.set(id, clampPackQty(prevRecQty + clampPackQty(r.qty)));
  }

  const daysByCatalogId = new Map<number, Set<number>>();
  for (const meal of meals) {
    for (const ing of meal.ingredients || []) {
      const id = Number(ing.catalog_id);
      if (!Number.isSafeInteger(id) || !CATALOG_MAP.has(id)) continue;
      if (!daysByCatalogId.has(id)) {
        daysByCatalogId.set(id, new Set());
      }
      daysByCatalogId.get(id)!.add(meal.day);
    }
  }

  // Keep items referenced in meals PLUS any manually added extras from previousItems
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

    let rawQty: number;
    if (prev && (isManual || isExtra)) {
      rawQty = prev.qty;
    } else if (previousItems && usedInDays.length > 0) {
      // Re-optimize pack qty after a meal swap if user didn't lock a manual qty
      const optimized = computeOptimizedPackQty(catalogItem, usedInDays.length, householdSize);
      const recQty = recQtyMap.get(id);
      rawQty = recQty ? Math.min(recQty, optimized) : optimized;
    } else {
      rawQty = recQtyMap.get(id) ?? 1;
    }

    const isPantry = isPantryStapleItem(catalogItem);
    const defaultIncluded =
      isPantry && ownedPantryIds && ownedPantryIds.has(id) ? false : true;

    items.push({
      ...catalogItem,
      qty: clampPackQty(rawQty),
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
