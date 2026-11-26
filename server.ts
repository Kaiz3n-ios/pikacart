import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ApplianceId,
  CatalogItem,
  DietaryFilter,
  GeneratedMenuResponse,
  GoalId,
  HouseholdSize,
  Meal,
  UserConfig,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.resolve(__dirname, 'src/data/catalog.json');
const fallbackMenusPath = path.resolve(__dirname, 'src/data/fallbackMenus.json');

const catalog: CatalogItem[] = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const fallbackMenus: Record<GoalId, GeneratedMenuResponse> = JSON.parse(
  fs.readFileSync(fallbackMenusPath, 'utf8')
);

const catalogMap = new Map<number, CatalogItem>(catalog.map((item) => [item.id, item]));
const validCatalogIds = new Set(catalog.map((item) => item.id));
const compactCatalog = catalog.map(({ id, name, cat, unit, price }) => ({
  id,
  name,
  cat,
  unit,
  price,
}));
const compactCatalogJson = JSON.stringify(compactCatalog);

const ALLOWED_GOALS = new Set<GoalId>([
  'high-protein-gym',
  '20-min-quick',
  'kenyan-comfort',
  'clean-plant-forward',
  'budget-saver',
]);

const ALLOWED_HOUSEHOLDS = new Set<HouseholdSize>([
  '1 Person',
  '2 People',
  '4+ Family',
]);

const ALLOWED_DAYS = new Set<number>([3, 5, 7]);

const ALLOWED_DIETARY = new Set<DietaryFilter>([
  'Vegetarian',
  'Dairy-Free',
  'Gluten-Free',
  'High-Calorie / Bulking',
]);

const ALLOWED_APPLIANCES = new Set<ApplianceId>([
  'stove',
  'air-fryer',
  'oven',
  'blender',
  'microwave',
  'pressure-cooker',
]);

const APPLIANCE_LABELS: Record<ApplianceId, string> = {
  stove: 'Gas / Electric Stove',
  'air-fryer': 'Air Fryer',
  oven: 'Oven',
  blender: 'Blender',
  microwave: 'Microwave',
  'pressure-cooker': 'Pressure / Rice Cooker',
};

const GOAL_LABELS: Record<GoalId, string> = {
  'high-protein-gym': 'High-Protein Gym (muscle & macros, high protein per meal)',
  '20-min-quick': '20-Min Quick (fast weeknight meals, <= 20 mins prep)',
  'kenyan-comfort': 'Kenyan Comfort (hearty Nairobi / East African inspired plates)',
  'clean-plant-forward': 'Clean & Plant-Forward (light, veggies, legumes, tofu)',
  'budget-saver': 'Budget Saver (lowest cost per serving, maximum ingredient reuse)',
};

// Extra verified catalog-grounded meals so 5-day and 7-day fallbacks stay varied and dietary-safe
const EXTRA_FALLBACK_MEALS: Meal[] = [
  {
    day: 1,
    title: 'Garlic-Ginger Tofu & Sukuma Wiki Quinoa Bowl',
    description: 'Crispy pan-seared Vegany tofu with garlicky sukuma wiki, cherry tomatoes, and quinoa.',
    prep_minutes: 22,
    protein_grams: 25,
    calories: 510,
    appliance_used: 'Gas / Electric Stove',
    ingredients: [
      { catalog_id: 51744615858336, amount: '250g plain tofu, cubed' },
      { catalog_id: 13193862447165, amount: '150g quinoa' },
      { catalog_id: 7419230945341, amount: '1 bunch sukuma wiki, shredded' },
      { catalog_id: 35886113783968, amount: '125g cherry tomatoes' },
      { catalog_id: 41433457459360, amount: '2 cloves garlic, minced' },
      { catalog_id: 34584972755104, amount: '1 tsp grated ginger' },
      { catalog_id: 37343312085152, amount: '1.5 tbsp sunflower oil' },
    ],
    steps: [
      'Simmer rinsed quinoa in 2 parts salted water for 15 minutes until fluffy.',
      'Sear cubed tofu in sunflower oil until golden on all sides, then season with salt and black pepper.',
      'Add garlic, ginger, and cherry tomatoes for 2 minutes until blistered, then toss in shredded sukuma wiki to wilt.',
      'Serve warm over the quinoa.',
    ],
  },
  {
    day: 1,
    title: 'Kenyan Matoke & Chickpea Coconut Pot',
    description: 'Tender matoke bananas braised with Cooks & Co chickpeas, tomatoes, and Kentaste coconut milk.',
    prep_minutes: 30,
    protein_grams: 18,
    calories: 540,
    appliance_used: 'Gas / Electric Stove',
    ingredients: [
      { catalog_id: 31018896687242, amount: '500g matoke, peeled & halved' },
      { catalog_id: 39813626232992, amount: '400g canned chickpeas, drained' },
      { catalog_id: 35036154724512, amount: '200ml coconut milk' },
      { catalog_id: 7419219640381, amount: '2 round tomatoes, diced' },
      { catalog_id: 7419222818877, amount: '1 red onion, chopped' },
      { catalog_id: 36653145522336, amount: '1 tsp curry powder' },
      { catalog_id: 37343312085152, amount: '1 tbsp sunflower oil' },
    ],
    steps: [
      'Sauté chopped red onion and curry powder in sunflower oil for 3 minutes until fragrant.',
      'Stir in diced round tomatoes and cook into a thick sauce.',
      'Add peeled matoke, chickpeas, coconut milk, and 1/2 cup water; cover and simmer 18 minutes until matoke is tender.',
      'Season with salt to taste and serve warm.',
    ],
  },
  {
    day: 1,
    title: 'Spiced Sweet Potato, Avocado & French Bean Skillet',
    description: 'Caramelized sweet potato cubes tossed with French beans, hoho peppers, eggs, and avocado.',
    prep_minutes: 25,
    protein_grams: 21,
    calories: 530,
    appliance_used: 'Gas / Electric Stove',
    ingredients: [
      { catalog_id: 8723260244029, amount: '400g sweet potato, small dice' },
      { catalog_id: 51849485779104, amount: '2 eggs' },
      { catalog_id: 42650279706784, amount: '125g French beans, trimmed' },
      { catalog_id: 34584997593248, amount: '1 green bell pepper (hoho), diced' },
      { catalog_id: 7652709269565, amount: '1 avocado, sliced' },
      { catalog_id: 43001750257824, amount: '1 tsp paprika' },
      { catalog_id: 37343312085152, amount: '1.5 tbsp sunflower oil' },
    ],
    steps: [
      'Pan-cook small-diced sweet potatoes in sunflower oil with paprika for 12 minutes until tender and browned.',
      'Toss in trimmed French beans and diced hoho peppers for 4 minutes until crisp-tender.',
      'Crack two eggs directly into wells in the skillet, cover for 3 minutes until set.',
      'Serve hot topped with sliced fresh avocado.',
    ],
  },
  {
    day: 1,
    title: 'Herb-Crusted Chicken Breast & Broccoli Skillet',
    description: 'Juicy chicken breast seared with mixed herbs, tenderstem broccoli, and baby potatoes.',
    prep_minutes: 25,
    protein_grams: 45,
    calories: 560,
    appliance_used: 'Gas / Electric Stove',
    ingredients: [
      { catalog_id: 42659654205600, amount: '300g chicken breast' },
      { catalog_id: 35245324861600, amount: '350g white potatoes, diced' },
      { catalog_id: 31198343233674, amount: '1 pack tenderstem broccoli' },
      { catalog_id: 30365999988874, amount: '1 tsp mixed herbs' },
      { catalog_id: 41433457459360, amount: '2 cloves garlic, minced' },
      { catalog_id: 46919944241312, amount: '1.5 tbsp extra virgin olive oil' },
    ],
    steps: [
      'Simmer diced white potatoes in salted water for 12 minutes until tender, then drain.',
      'Rub chicken breast with mixed herbs, garlic, salt, and olive oil; sear 5–6 minutes per side until cooked through.',
      'Char tenderstem broccoli in the same skillet with a splash of water for 3 minutes.',
      'Plate sliced chicken alongside the potatoes and broccoli.',
    ],
  },
  {
    day: 1,
    title: 'Tuna, Quinoa & Cucumber Lemon Bowl',
    description: 'Flaked John West tuna steak over warm quinoa with crunchy cucumber, cherry tomatoes, and lemon.',
    prep_minutes: 18,
    protein_grams: 34,
    calories: 470,
    appliance_used: 'Gas / Electric Stove',
    ingredients: [
      { catalog_id: 46149588549792, amount: '1 can (160g) John West tuna' },
      { catalog_id: 13193862447165, amount: '150g quinoa' },
      { catalog_id: 58575660613792, amount: '1/2 English cucumber, diced' },
      { catalog_id: 35886113783968, amount: '125g cherry tomatoes, halved' },
      { catalog_id: 7652709269565, amount: '1 avocado, sliced' },
      { catalog_id: 34585034850464, amount: '1/2 lemon, juiced' },
    ],
    steps: [
      'Cook rinsed quinoa in salted water for 15 minutes until tender, then fluff.',
      'Dice cucumber and halve cherry tomatoes in a serving bowl.',
      'Flake tuna steak over the warm quinoa with fresh vegetables and sliced avocado.',
      'Dress with fresh lemon juice and black pepper.',
    ],
  },
];

// In-memory per-IP rate limiter (separate buckets per route)
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function createRateLimiter(bucketPrefix: string, maxRequests: number) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const now = Date.now();
    if (rateLimitMap.size > 1000) {
      for (const [key, entry] of rateLimitMap.entries()) {
        if (entry.resetAt <= now) {
          rateLimitMap.delete(key);
        }
      }
    }

    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${bucketPrefix}:${clientIp}`;
    const existing = rateLimitMap.get(key);

    if (!existing || existing.resetAt <= now) {
      rateLimitMap.set(key, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      next();
      return;
    }

    if (existing.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait a few minutes and try again.',
      });
      return;
    }

    existing.count += 1;
    next();
  };
}

function validateAndNormalizeConfig(rawBody: unknown): {
  config?: UserConfig;
  error?: string;
} {
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return { error: 'Request body must be a JSON object.' };
  }

  const body = rawBody as Record<string, unknown>;
  const goal = body.goal;
  const householdSize = body.householdSize ?? body.people;
  const days = body.days;
  const dietaryFilters = body.dietaryFilters ?? body.dietary ?? [];
  const appliances = body.appliances;

  if (typeof goal !== 'string' || !ALLOWED_GOALS.has(goal as GoalId)) {
    return { error: 'Invalid goal selection.' };
  }

  if (
    typeof householdSize !== 'string' ||
    !ALLOWED_HOUSEHOLDS.has(householdSize as HouseholdSize)
  ) {
    return { error: 'Invalid household size selection.' };
  }

  if (
    typeof days !== 'number' ||
    !Number.isInteger(days) ||
    !ALLOWED_DAYS.has(days)
  ) {
    return { error: 'Invalid plan length. Choose 3, 5, or 7 days.' };
  }

  if (!Array.isArray(dietaryFilters)) {
    return { error: 'Dietary filters must be an array.' };
  }
  const normalizedDietary: DietaryFilter[] = [];
  for (const d of dietaryFilters) {
    if (typeof d !== 'string' || !ALLOWED_DIETARY.has(d as DietaryFilter)) {
      return { error: 'Invalid dietary filter value.' };
    }
    if (!normalizedDietary.includes(d as DietaryFilter)) {
      normalizedDietary.push(d as DietaryFilter);
    }
  }

  if (!Array.isArray(appliances) || appliances.length === 0) {
    return { error: 'Select at least one kitchen appliance.' };
  }
  const normalizedAppliances: ApplianceId[] = [];
  for (const a of appliances) {
    if (typeof a !== 'string' || !ALLOWED_APPLIANCES.has(a as ApplianceId)) {
      return { error: 'Invalid kitchen appliance selection.' };
    }
    if (!normalizedAppliances.includes(a as ApplianceId)) {
      normalizedAppliances.push(a as ApplianceId);
    }
  }

  return {
    config: {
      goal: goal as GoalId,
      householdSize: householdSize as HouseholdSize,
      days: days as 3 | 5 | 7,
      dietaryFilters: normalizedDietary,
      appliances: normalizedAppliances,
    },
  };
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const mealSchema = {
  type: Type.OBJECT,
  properties: {
    day: { type: Type.INTEGER, description: 'Day number starting at 1.' },
    title: { type: Type.STRING, description: 'Appetizing meal title.' },
    description: {
      type: Type.STRING,
      description: 'Short appetizing 1-line description of the dish.',
    },
    prep_minutes: { type: Type.INTEGER, description: 'Estimated prep and cook time in minutes.' },
    protein_grams: { type: Type.INTEGER, description: 'Estimated protein per serving in grams.' },
    calories: { type: Type.INTEGER, description: 'Estimated calories per serving.' },
    appliance_used: {
      type: Type.STRING,
      description: 'Primary appliance used from the user selected appliances.',
    },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          catalog_id: {
            type: Type.NUMBER,
            description: 'Exact numeric product id from the Zucchini catalog.',
          },
          amount: {
            type: Type.STRING,
            description: 'Human-readable recipe portion (e.g. "300g", "2 eggs", "1 tbsp").',
          },
        },
        required: ['catalog_id', 'amount'],
      },
    },
    steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: '4 to 5 clear cooking steps using only the selected appliances.',
    },
  },
  required: [
    'day',
    'title',
    'description',
    'prep_minutes',
    'protein_grams',
    'calories',
    'appliance_used',
    'ingredients',
    'steps',
  ],
};

const generateMenuSchema = {
  type: Type.OBJECT,
  properties: {
    savings_summary: {
      type: Type.STRING,
      description:
        'A concise 1-sentence zero-waste tip highlighting shared ingredients across multiple days.',
    },
    meals: {
      type: Type.ARRAY,
      items: mealSchema,
    },
    cart_items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          catalog_id: {
            type: Type.NUMBER,
            description: 'Exact numeric product id from the Zucchini catalog.',
          },
          qty: {
            type: Type.INTEGER,
            description: 'Number of store packs needed for the whole meal plan and household size.',
          },
        },
        required: ['catalog_id', 'qty'],
      },
    },
  },
  required: ['savings_summary', 'meals', 'cart_items'],
};

const swapMealSchema = {
  type: Type.OBJECT,
  properties: {
    meal: mealSchema,
    cart_adjustments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          catalog_id: { type: Type.NUMBER },
          qty: { type: Type.INTEGER },
        },
        required: ['catalog_id', 'qty'],
      },
      description: 'Recommended pack quantities for any ingredients used by this swapped meal.',
    },
  },
  required: ['meal', 'cart_adjustments'],
};

function buildSystemInstruction(): string {
  return [
    'You are PikaCart, an expert Nairobi chef and smart grocery planner synced with Zucchini Food Market.',
    'STRICT GROUNDING RULES:',
    '1. EVERY ingredient catalog_id MUST be an exact numeric "id" from the Zucchini catalog JSON below. NEVER invent IDs, products, or prices.',
    '2. Do NOT use foods that are missing from the catalog (for example, do not invent beef steak or basmati rice if not in the catalog). Build every recipe strictly from items in the catalog.',
    '3. Assume the user already has water and table salt at home — NEVER add salt to ingredients or cart_items.',
    '4. APPLIANCE GUARDRAILS (STRICT): Only use cooking methods compatible with the user-selected appliances. If Oven is NOT selected, NEVER suggest baking, roasting in an oven, or preheating an oven. If Air Fryer is NOT selected, NEVER suggest air frying. If only Gas / Electric Stove is selected (Stove Only), EVERY step must be cooked exclusively on the stovetop in pots, pans, or skillets.',
    '5. DIETARY GUARDRAILS (STRICT):',
    '   - Vegetarian: Strictly exclude ALL meat, poultry, fish/tuna, sausages, AND meat-based stock cubes (NEVER use Knorrox Chicken Flavor stock cubes id 43111787266208 or Knorrox Beef Flavoured Stock Cubes id 43111796768928).',
    '   - Dairy-Free: Strictly exclude ALL butter, cheese, yoghurt, and cooking cream.',
    '   - Gluten-Free: Strictly exclude wheat pasta, lasagna, udon, couscous, bread, buns, tortilla wraps, pita bread, flatbread, breadcrumbs, and regular soy sauce.',
    '6. MINIMIZE WASTE & COST: Reuse spices, sauces, oils, herbs, and large-pack produce (1kg tomatoes, 1kg onions, 500g garlic, 12-pack eggs) across multiple days.',
    '7. Compute accurate pack quantities (qty, integer 1-20) in cart_items for the chosen household size and number of days.',
    '8. Write clear, appetizing 4-5 step recipes tailored to Nairobi home kitchens.',
    '',
    'ZUCCHINI CATALOG (id, name, cat, unit, price in KES):',
    compactCatalogJson,
  ].join('\n');
}

function clampQty(value: unknown): number {
  const num = Math.trunc(Number(value) || 1);
  return Math.min(20, Math.max(1, num));
}

function isMealCompatibleWithDietary(
  meal: Meal,
  dietaryFilters: DietaryFilter[]
): boolean {
  if (!dietaryFilters || dietaryFilters.length === 0) return true;

  const items = meal.ingredients
    .map((ing) => catalogMap.get(ing.catalog_id))
    .filter((item): item is CatalogItem => Boolean(item));

  if (dietaryFilters.includes('Vegetarian')) {
    const hasAnimalOrStock = items.some((item) =>
      /\b(chicken|tuna|sausage|sausages|beef|meat|knorrox)\b/i.test(item.name)
    );
    if (hasAnimalOrStock) return false;
  }

  if (dietaryFilters.includes('Dairy-Free')) {
    const hasDairy = items.some(
      (item) =>
        item.cat === 'dairy' ||
        /\b(cheese|cheddar|mozzarella|feta|gouda|halloumi|paneer|yoghurt|yogurt|butter|cream)\b/i.test(
          item.name
        )
    );
    if (hasDairy) return false;
  }

  if (dietaryFilters.includes('Gluten-Free')) {
    const hasGluten = items.some((item) =>
      /\b(penne|fusilli|linguine|lasagna|udon|couscous|bread|buns|tortilla|pita|flatbread|crumbs|soy sauce|teriyaki)\b/i.test(
        item.name
      )
    );
    if (hasGluten) return false;
  }

  return true;
}

function adaptMealForAppliances(meal: Meal, appliances: ApplianceId[]): Meal {
  if (appliances.includes('stove')) {
    return meal;
  }

  const primaryAppliance = appliances[0] || 'air-fryer';
  const label = APPLIANCE_LABELS[primaryAppliance];

  const adaptedSteps = meal.steps.map((step) => {
    if (primaryAppliance === 'air-fryer') {
      return step
        .replace(/on the stove/gi, 'in the air fryer')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in the air fryer basket');
    }
    if (primaryAppliance === 'oven') {
      return step
        .replace(/on the stove/gi, 'in a 200°C oven')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in an oven-safe roasting dish');
    }
    if (primaryAppliance === 'pressure-cooker') {
      return step
        .replace(/on the stove/gi, 'in the pressure / rice cooker')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in the cooker pot');
    }
    return step.replace(/on the stove/gi, `using your ${label.toLowerCase()}`);
  });

  return {
    ...meal,
    appliance_used: label,
    steps: adaptedSteps,
  };
}

function buildSavingsSummaryFromMeals(meals: Meal[]): string {
  const usageCounts = new Map<number, number>();
  for (const meal of meals) {
    const seenInMeal = new Set<number>();
    for (const ing of meal.ingredients) {
      if (!seenInMeal.has(ing.catalog_id)) {
        seenInMeal.add(ing.catalog_id);
        usageCounts.set(ing.catalog_id, (usageCounts.get(ing.catalog_id) || 0) + 1);
      }
    }
  }

  const sharedNames = Array.from(usageCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => catalogMap.get(id)?.name.split(' - ')[0].split('(')[0].trim())
    .filter((n): n is string => Boolean(n));

  if (sharedNames.length >= 2) {
    return `Your ${meals.length}-day plan shares ${sharedNames.join(', ')} across multiple meals to cut waste and cost.`;
  }

  return `Your ${meals.length}-day menu reuses core pantry staples and fresh produce across multiple meals.`;
}

function sanitizeMenuResponse(raw: GeneratedMenuResponse): GeneratedMenuResponse {
  const sanitizedMeals = (raw.meals || [])
    .map((meal, index) => {
      const validIngredients = (meal.ingredients || [])
        .map((ing) => ({
          catalog_id: Number(ing.catalog_id),
          amount: typeof ing.amount === 'string' ? ing.amount.slice(0, 80) : '1 portion',
        }))
        .filter((ing) => Number.isSafeInteger(ing.catalog_id) && validCatalogIds.has(ing.catalog_id));

      return {
        ...meal,
        day: Number.isInteger(meal.day) && meal.day > 0 ? meal.day : index + 1,
        ingredients: validIngredients,
        steps: Array.isArray(meal.steps) ? meal.steps.slice(0, 6).map(String) : [],
      };
    })
    .filter((meal) => meal.ingredients.length > 0);

  const cartMap = new Map<number, number>();
  for (const item of raw.cart_items || []) {
    const id = Number(item.catalog_id);
    if (Number.isSafeInteger(id) && validCatalogIds.has(id)) {
      const qty = clampQty(item.qty);
      const summed = (cartMap.get(id) || 0) + qty;
      cartMap.set(id, clampQty(summed));
    }
  }

  for (const meal of sanitizedMeals) {
    for (const ing of meal.ingredients) {
      if (!cartMap.has(ing.catalog_id)) {
        cartMap.set(ing.catalog_id, 1);
      }
    }
  }

  const sanitizedCart = Array.from(cartMap.entries()).map(([catalog_id, qty]) => ({
    catalog_id,
    qty,
  }));

  return {
    savings_summary:
      raw.savings_summary || buildSavingsSummaryFromMeals(sanitizedMeals),
    meals: sanitizedMeals,
    cart_items: sanitizedCart,
  };
}

function getCuratedFallback(config: UserConfig): GeneratedMenuResponse {
  const primaryMenu = fallbackMenus[config.goal] || fallbackMenus['kenyan-comfort'];
  const otherGoalMeals = (Object.entries(fallbackMenus) as [GoalId, GeneratedMenuResponse][])
    .filter(([g]) => g !== config.goal)
    .flatMap(([, menu]) => menu.meals);

  const rawPool = [...primaryMenu.meals, ...EXTRA_FALLBACK_MEALS, ...otherGoalMeals];

  // Deduplicate by title and filter strictly by dietary constraints
  const seenTitles = new Set<string>();
  const compatiblePool: Meal[] = [];
  for (const meal of rawPool) {
    const key = meal.title.toLowerCase();
    if (seenTitles.has(key)) continue;
    if (!isMealCompatibleWithDietary(meal, config.dietaryFilters)) continue;
    seenTitles.add(key);
    compatiblePool.push(meal);
  }

  const selectedMeals: Meal[] = [];
  for (let i = 0; i < config.days; i++) {
    const baseMeal = compatiblePool[i % compatiblePool.length] || primaryMenu.meals[i % primaryMenu.meals.length];
    const adapted = adaptMealForAppliances(baseMeal, config.appliances);
    selectedMeals.push({
      ...adapted,
      day: i + 1,
    });
  }

  // Compute consolidated pack quantities across the selected meals
  const usageCounts = new Map<number, number>();
  for (const meal of selectedMeals) {
    for (const ing of meal.ingredients) {
      if (validCatalogIds.has(ing.catalog_id)) {
        usageCounts.set(ing.catalog_id, (usageCounts.get(ing.catalog_id) || 0) + 1);
      }
    }
  }

  const householdMultiplier = config.householdSize === '4+ Family' ? 2 : 1;
  const cart_items = Array.from(usageCounts.entries()).map(([catalog_id, uses]) => {
    const catItem = catalogMap.get(catalog_id);
    let qty = 1;
    if (catItem) {
      if (catItem.cat === 'protein' || catItem.cat === 'bakery') {
        qty = Math.ceil((uses * householdMultiplier) / 2);
      } else if (catItem.cat === 'produce' && householdMultiplier > 1 && uses >= 2) {
        qty = 2;
      }
    }
    return { catalog_id, qty: clampQty(qty) };
  });

  return {
    savings_summary: buildSavingsSummaryFromMeals(selectedMeals),
    meals: selectedMeals,
    cart_items,
    model_used: 'curated-fallback',
    usedFallback: true,
  };
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateWithFallback<T>(
  ai: GoogleGenAI | null,
  systemInstruction: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  maxOutputTokens: number
): Promise<{ data: T; modelUsed: string } | null> {
  if (!ai) return null;

  try {
    const primaryRes = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          maxOutputTokens,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      20000,
      'gemini-4-hydrogen'
    );
    const text = (primaryRes.text ?? '').trim();
    if (!text) throw new Error('Empty response from gemini-4-hydrogen');
    return { data: JSON.parse(text) as T, modelUsed: 'gemini-4-hydrogen' };
  } catch (primaryErr) {
    const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    console.warn(`gemini-4-hydrogen fallback triggered: ${msg}`);
  }

  try {
    const fallbackRes = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: schema,
          maxOutputTokens,
        },
      }),
      20000,
      'gemini-3.5-flash-lite'
    );
    const text = (fallbackRes.text ?? '').trim();
    if (!text) throw new Error('Empty response from gemini-3.5-flash-lite');
    return { data: JSON.parse(text) as T, modelUsed: 'gemini-3.5-flash-lite' };
  } catch (fallbackErr) {
    const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
    console.warn(`gemini-3.5-flash-lite fallback triggered: ${msg}`);
    return null;
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  const generateLimiter = createRateLimiter('generate', 15);
  const swapLimiter = createRateLimiter('swap', 30);

  const systemInstruction = buildSystemInstruction();

  app.post('/api/menu/generate', generateLimiter, async (req, res) => {
    const { config, error } = validateAndNormalizeConfig(req.body);
    if (!config) {
      res.status(400).json({ error: error || 'Invalid meal plan configuration.' });
      return;
    }

    const appliancesList = config.appliances
      .map((a) => APPLIANCE_LABELS[a])
      .join(', ');

    const isStoveOnly =
      config.appliances.length === 1 && config.appliances[0] === 'stove';

    const dietaryList =
      config.dietaryFilters.length > 0
        ? config.dietaryFilters.join(', ')
        : 'None';

    const userPrompt = [
      `Create a ${config.days}-day meal plan for ${config.householdSize}.`,
      `Goal / Vibe: ${GOAL_LABELS[config.goal]}`,
      `Dietary Filters: ${dietaryList}`,
      `Available Kitchen Appliances ONLY: ${appliancesList}${isStoveOnly ? ' (Stove Only: NEVER output oven, baking, or air-fryer steps)' : ''}`,
      `Return exactly ${config.days} meals (Day 1 through Day ${config.days}) and the consolidated cart_items with total pack quantities needed (clamped 1-20). Keep steps concise.`,
      'Remember: Use ONLY exact numeric catalog_id values from the Zucchini catalog, exclude meat stock cubes if Vegetarian, reuse pantry staples/produce across days, and never suggest appliances the user did not select.',
    ].join('\n');

    const ai = getAiClient();
    const result = await generateWithFallback<GeneratedMenuResponse>(
      ai,
      systemInstruction,
      userPrompt,
      generateMenuSchema,
      8192
    );

    if (result && result.data?.meals?.length > 0) {
      const sanitized = sanitizeMenuResponse(result.data);
      if (sanitized.meals.length > 0) {
        res.json({
          ...sanitized,
          model_used: result.modelUsed,
          usedFallback: false,
        });
        return;
      }
    }

    res.json(getCuratedFallback(config));
  });

  app.post('/api/menu/swap', swapLimiter, async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      res.status(400).json({ error: 'Request body must be a JSON object.' });
      return;
    }

    const {
      config: rawConfig,
      dayToReplace,
      currentMeals,
      existingCatalogIds,
    } = req.body as {
      config?: unknown;
      dayToReplace?: unknown;
      currentMeals?: unknown;
      existingCatalogIds?: unknown;
    };

    const { config, error } = validateAndNormalizeConfig(rawConfig);
    if (!config) {
      res.status(400).json({ error: error || 'Invalid meal plan configuration.' });
      return;
    }

    if (
      typeof dayToReplace !== 'number' ||
      !Number.isInteger(dayToReplace) ||
      dayToReplace < 1 ||
      dayToReplace > config.days
    ) {
      res.status(400).json({ error: 'Invalid dayToReplace value.' });
      return;
    }

    const safeMeals = Array.isArray(currentMeals) ? currentMeals.slice(0, 7) : [];
    const safeCatalogIds = Array.isArray(existingCatalogIds)
      ? existingCatalogIds
          .map(Number)
          .filter((id) => Number.isSafeInteger(id) && validCatalogIds.has(id))
          .slice(0, 60)
      : [];

    const appliancesList = config.appliances
      .map((a) => APPLIANCE_LABELS[a])
      .join(', ');

    const isStoveOnly =
      config.appliances.length === 1 && config.appliances[0] === 'stove';

    const dietaryList =
      config.dietaryFilters.length > 0
        ? config.dietaryFilters.join(', ')
        : 'None';

    const currentTitles = safeMeals
      .map((m: unknown) => {
        if (!m || typeof m !== 'object') return '';
        const mealObj = m as { day?: unknown; title?: unknown };
        const cleanTitle =
          typeof mealObj.title === 'string'
            ? mealObj.title.replace(/[\r\n]/g, ' ').slice(0, 100)
            : '';
        const dayNum = Number(mealObj.day) || 0;
        return cleanTitle ? `Day ${dayNum}: ${cleanTitle}` : '';
      })
      .filter(Boolean)
      .join('; ');

    const reusableNames = safeCatalogIds
      .map((id) => catalogMap.get(id))
      .filter((c): c is CatalogItem => Boolean(c))
      .map((c) => `${c.id} (${c.name})`)
      .join(', ');

    const userPrompt = [
      `Replace ONLY Day ${dayToReplace} with a brand-new, different meal for ${config.householdSize}.`,
      `Goal / Vibe: ${GOAL_LABELS[config.goal]}`,
      `Dietary Filters: ${dietaryList}`,
      `Available Kitchen Appliances ONLY: ${appliancesList}${isStoveOnly ? ' (Stove Only: NEVER output oven, baking, or air-fryer steps)' : ''}`,
      `Avoid repeating any of these existing meals: ${currentTitles || 'None'}`,
      `Try to reuse existing menu ingredients where possible: ${reusableNames || 'None'}`,
      `Set meal.day = ${dayToReplace}. Return ONLY exact numeric catalog_id values from the Zucchini catalog, and exclude meat stock cubes if Vegetarian.`,
    ].join('\n');

    const ai = getAiClient();
    const result = await generateWithFallback<{
      meal: Meal;
      cart_adjustments: { catalog_id: number; qty: number }[];
    }>(ai, systemInstruction, userPrompt, swapMealSchema, 2048);

    if (result && result.data?.meal) {
      const cleanedIngredients = (result.data.meal.ingredients || [])
        .map((ing) => ({
          catalog_id: Number(ing.catalog_id),
          amount: typeof ing.amount === 'string' ? ing.amount.slice(0, 80) : '1 portion',
        }))
        .filter(
          (ing) => Number.isSafeInteger(ing.catalog_id) && validCatalogIds.has(ing.catalog_id)
        );

      if (cleanedIngredients.length > 0) {
        const cleanedMeal: Meal = {
          ...result.data.meal,
          day: dayToReplace,
          ingredients: cleanedIngredients,
          steps: Array.isArray(result.data.meal.steps)
            ? result.data.meal.steps.slice(0, 6).map(String)
            : [],
        };

        const adjMap = new Map<number, number>();
        for (const a of result.data.cart_adjustments || []) {
          const id = Number(a.catalog_id);
          if (Number.isSafeInteger(id) && validCatalogIds.has(id)) {
            adjMap.set(id, clampQty((adjMap.get(id) || 0) + clampQty(a.qty)));
          }
        }
        for (const ing of cleanedIngredients) {
          if (!adjMap.has(ing.catalog_id)) {
            adjMap.set(ing.catalog_id, 1);
          }
        }

        const cleanedAdjustments = Array.from(adjMap.entries()).map(([catalog_id, qty]) => ({
          catalog_id,
          qty,
        }));

        res.json({
          meal: cleanedMeal,
          cart_adjustments: cleanedAdjustments,
          model_used: result.modelUsed,
          usedFallback: false,
        });
        return;
      }
    }

    // Dietary- and appliance-compatible swap fallback
    const allPool = [
      ...(fallbackMenus[config.goal]?.meals || []),
      ...EXTRA_FALLBACK_MEALS,
      ...Object.values(fallbackMenus).flatMap((m) => m.meals),
    ];

    const compatiblePool = allPool.filter((m) =>
      isMealCompatibleWithDietary(m, config.dietaryFilters)
    );
    const pool = compatiblePool.length > 0 ? compatiblePool : allPool;

    const existingTitleSet = new Set(
      safeMeals
        .map((m: unknown) =>
          m && typeof m === 'object' && typeof (m as { title?: unknown }).title === 'string'
            ? (m as { title: string }).title.toLowerCase()
            : ''
        )
        .filter(Boolean)
    );
    const rawCandidate =
      pool.find((m) => !existingTitleSet.has(m.title.toLowerCase())) || pool[0];
    const adaptedCandidate = adaptMealForAppliances(rawCandidate, config.appliances);

    res.json({
      meal: { ...adaptedCandidate, day: dayToReplace },
      cart_adjustments: adaptedCandidate.ingredients.map((i) => ({
        catalog_id: i.catalog_id,
        qty: clampQty(config.householdSize === '4+ Family' ? 2 : 1),
      })),
      model_used: 'curated-fallback',
      usedFallback: true,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`PikaCart server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start PikaCart server:', err);
  process.exit(1);
});
