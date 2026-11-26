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
  RecipeIngredient,
  UserConfig,
  VaultRecipe,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const catalogPath = path.resolve(__dirname, 'src/data/catalog.json');
const recipesPath = path.resolve(__dirname, 'src/data/recipes.json');

const catalog: CatalogItem[] = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const recipes: VaultRecipe[] = JSON.parse(fs.readFileSync(recipesPath, 'utf8'));

const catalogMap = new Map<number, CatalogItem>(catalog.map((item) => [item.id, item]));
const validCatalogIds = new Set<number>(catalog.map((item) => item.id));

const ALLOWED_GOALS = new Set<GoalId>([
  'high_protein',
  'quick_20min',
  'kenyan_comfort',
  'plant_forward',
  'budget_saver',
]);

const ALLOWED_HOUSEHOLDS = new Set<HouseholdSize>([
  '1 Person',
  '2 People',
  '4+ Family',
]);

const ALLOWED_DAYS = new Set<number>([3, 5, 7]);

const ALLOWED_DIETARY = new Set<DietaryFilter>([
  'vegetarian',
  'dairy_free',
  'gluten_free',
  'high_calorie',
]);

const ALLOWED_APPLIANCES = new Set<ApplianceId>([
  'stove',
  'air_fryer',
  'oven',
  'blender',
  'microwave',
  'pressure_cooker',
]);

const APPLIANCE_LABELS: Record<ApplianceId, string> = {
  stove: 'Gas / Electric Stove',
  air_fryer: 'Air Fryer',
  oven: 'Oven',
  blender: 'Blender',
  microwave: 'Microwave',
  pressure_cooker: 'Pressure / Rice Cooker',
};

const GOAL_LABELS: Record<GoalId, string> = {
  high_protein: 'High-Protein Gym (muscle & macros, high protein per meal)',
  quick_20min: '20-Min Quick (fast weeknight meals, <= 20 mins prep)',
  kenyan_comfort: 'Kenyan Comfort (hearty Nairobi / East African inspired plates)',
  plant_forward: 'Clean & Plant-Forward (vegetables, legumes, and tofu)',
  budget_saver: 'Budget Saver (lowest cost per serving, maximum ingredient reuse)',
};

const DIETARY_LABELS: Record<DietaryFilter, string> = {
  vegetarian: 'Vegetarian (no meat, poultry, fish, or meat stock cubes)',
  dairy_free: 'Dairy-Free (no butter, cheese, milk, yogurt, or cream)',
  gluten_free: 'Gluten-Free (no wheat pasta, bread, udon, couscous, pita, or regular soy sauce)',
  high_calorie: 'High-Calorie / Bulking (hearty, energy-dense meals)',
};

// In-memory per-IP rate limiter (15 req / 15 min on generate)
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

function normalizeHouseholdSize(raw: unknown): HouseholdSize | null {
  if (raw === 1 || raw === '1 Person') return '1 Person';
  if (raw === 2 || raw === '2 People') return '2 People';
  if (raw === 4 || raw === '4+ Family') return '4+ Family';
  if (typeof raw === 'string' && ALLOWED_HOUSEHOLDS.has(raw as HouseholdSize)) {
    return raw as HouseholdSize;
  }
  return null;
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
  const householdSize = normalizeHouseholdSize(body.householdSize ?? body.people);
  const days = body.days;
  const dietaryFilters = body.dietaryFilters ?? body.dietary ?? [];
  const appliances = body.appliances;

  if (typeof goal !== 'string' || !ALLOWED_GOALS.has(goal as GoalId)) {
    return { error: 'Invalid goal selection.' };
  }

  if (!householdSize) {
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
      householdSize,
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

function isPantryCatalogItem(item: CatalogItem): boolean {
  if (item.cat === 'spices_sauces') return true;
  if (item.cat === 'pantry_grains' && /\b(oil|vinegar)\b/i.test(item.name)) {
    return true;
  }
  return false;
}

function isIngredientCompatibleWithDietary(
  item: CatalogItem,
  dietaryFilters: DietaryFilter[]
): boolean {
  if (dietaryFilters.includes('vegetarian')) {
    if (/\b(chicken|tuna|sausage|sausages|beef|meat|knorrox)\b/i.test(item.name)) {
      return false;
    }
  }
  if (dietaryFilters.includes('dairy_free')) {
    if (
      item.cat === 'dairy' ||
      /\b(cheese|cheddar|mozzarella|feta|gouda|halloumi|paneer|yoghurt|yogurt|butter|cream)\b/i.test(
        item.name
      )
    ) {
      return false;
    }
  }
  if (dietaryFilters.includes('gluten_free')) {
    if (
      /\b(penne|fusilli|linguine|lasagna|udon|couscous|bread|buns|tortilla|pita|flatbread|crumbs|soy sauce|teriyaki)\b/i.test(
        item.name
      )
    ) {
      return false;
    }
  }
  return true;
}

function vaultRecipeToMeal(recipe: VaultRecipe, day: number): Meal {
  return {
    day,
    id: recipe.id,
    title: recipe.title,
    tagline: recipe.tagline,
    prep_mins: recipe.prep_mins,
    protein_g: recipe.protein_g,
    calories: recipe.calories,
    base_servings: recipe.base_servings || 2,
    appliances: recipe.appliances,
    photo: recipe.photo,
    is_dynamic_fallback: false,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
  };
}

function buildSavingsSummaryFromMeals(meals: Meal[]): string {
  const usageCounts = new Map<number, number>();
  for (const meal of meals) {
    const seen = new Set<number>();
    for (const ing of meal.ingredients) {
      if (!seen.has(ing.catalog_id) && validCatalogIds.has(ing.catalog_id)) {
        seen.add(ing.catalog_id);
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
    return `Shared-ingredient plan: your ${meals.length}-day menu reuses ${sharedNames.join(', ')} across multiple days to cut cost and waste.`;
  }
  return `Your ${meals.length}-day menu reuses core Zucchini pantry staples and fresh produce across multiple meals.`;
}

function scoreCandidateRecipe(
  candidate: VaultRecipe,
  goal: GoalId,
  usedIngredientIds: Set<number>
): number {
  const goalBonus = candidate.goals.includes(goal) ? 12 : 0;
  let sharedCount = 0;
  for (const ing of candidate.ingredients) {
    if (usedIngredientIds.has(ing.catalog_id)) {
      sharedCount += ing.is_pantry ? 1 : 2;
    }
  }
  const proteinBonus =
    goal === 'high_protein' ? Math.min(8, Math.round(candidate.protein_g / 6)) : 0;
  const speedBonus = goal === 'quick_20min' && candidate.prep_mins <= 20 ? 6 : 0;

  return goalBonus + sharedCount * 2 + proteinBonus + speedBonus;
}

function pickBestRecipesDeterministically(
  pool: VaultRecipe[],
  count: number,
  goal: GoalId,
  alreadySelectedIds: Set<string> = new Set(),
  seedIngredientIds: Set<number> = new Set()
): VaultRecipe[] {
  const chosen: VaultRecipe[] = [];
  const usedIds = new Set<string>(alreadySelectedIds);
  const usedIngIds = new Set<number>(seedIngredientIds);

  while (chosen.length < count) {
    let best: VaultRecipe | null = null;
    let bestScore = -1;

    for (const candidate of pool) {
      if (usedIds.has(candidate.id)) continue;
      const score = scoreCandidateRecipe(candidate, goal, usedIngIds);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    if (!best) break;
    chosen.push(best);
    usedIds.add(best.id);
    for (const ing of best.ingredients) {
      usedIngIds.add(ing.catalog_id);
    }
  }

  return chosen;
}

function adaptVaultRecipeToAppliances(
  recipe: VaultRecipe,
  appliances: ApplianceId[],
  day: number
): Meal {
  const primary = appliances[0] || 'stove';
  const label = APPLIANCE_LABELS[primary];

  const adaptedSteps = recipe.steps.map((step) => {
    if (primary === 'air_fryer') {
      return step
        .replace(/on the stove/gi, 'in the air fryer')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in the air fryer basket');
    }
    if (primary === 'oven') {
      return step
        .replace(/on the stove/gi, 'in a 200°C oven')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in an oven-safe roasting dish');
    }
    if (primary === 'pressure_cooker') {
      return step
        .replace(/on the stove/gi, 'in the pressure / rice cooker')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in the cooker pot');
    }
    if (primary === 'microwave') {
      return step
        .replace(/on the stove/gi, 'in the microwave')
        .replace(/in a (?:hot |dry |small |non-stick )?(?:skillet|pan|saucepan|pot|sufuria)/gi, 'in a microwave-safe bowl');
    }
    if (primary === 'blender') {
      return step.replace(/on the stove/gi, `using your ${label.toLowerCase()}`);
    }
    return step;
  });

  return {
    day,
    id: `adapted-${recipe.id}`,
    title: recipe.title,
    tagline: recipe.tagline,
    prep_mins: recipe.prep_mins,
    protein_g: recipe.protein_g,
    calories: recipe.calories,
    base_servings: recipe.base_servings || 2,
    appliances: [primary],
    photo: '',
    is_dynamic_fallback: true,
    ingredients: recipe.ingredients,
    steps: adaptedSteps,
  };
}

const vaultSelectionSchema = {
  type: Type.OBJECT,
  properties: {
    recipe_ids: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Array of unique recipe id strings chosen strictly from the eligible index.',
    },
    savings_summary: {
      type: Type.STRING,
      description: 'Concise 1-sentence note highlighting shared ingredients across days to cut cost and waste.',
    },
  },
  required: ['recipe_ids', 'savings_summary'],
};

const dynamicMealSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    tagline: { type: Type.STRING },
    prep_mins: { type: Type.INTEGER },
    protein_g: { type: Type.INTEGER },
    calories: { type: Type.INTEGER },
    ingredients: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          catalog_id: { type: Type.NUMBER },
          qty_base: {
            type: Type.NUMBER,
            description: 'Fractional pack amount for 2 servings (e.g. 0.5 for half a pack, 1 for whole unit, 0.03 for 1 tbsp oil/spice).',
          },
          display: { type: Type.STRING },
          is_pantry: { type: Type.BOOLEAN },
        },
        required: ['catalog_id', 'qty_base', 'display', 'is_pantry'],
      },
    },
    steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ['title', 'tagline', 'prep_mins', 'protein_g', 'calories', 'ingredients', 'steps'],
};

const hybridDynamicSchema = {
  type: Type.OBJECT,
  properties: {
    savings_summary: { type: Type.STRING },
    meals: {
      type: Type.ARRAY,
      items: dynamicMealSchema,
    },
  },
  required: ['savings_summary', 'meals'],
};

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

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|rate.?limit|quota|resource_exhausted/i.test(msg);
}

function extractResponseText(res: {
  text?: string;
  candidates?: Array<{
    finishReason?: unknown;
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}): string {
  const direct = (res.text ?? '').trim();
  if (direct) return direct;

  const parts = res.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const joined = parts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (joined) return joined;
  }
  return '';
}

function parseJsonText<T>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

let primaryCooldownUntil = 0;

function extractRetryDelayMs(errMessage: string): number {
  const secMatch = errMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (secMatch) {
    const parsedSec = Number(secMatch[1]);
    if (Number.isFinite(parsedSec) && parsedSec > 0) {
      return Math.min(parsedSec * 1000, 60 * 60 * 1000);
    }
  }
  if (/per day|free_tier|RequestsPerDay/i.test(errMessage)) {
    return 15 * 60 * 1000;
  }
  return 60 * 1000;
}

async function generateWithFallback<T>(
  ai: GoogleGenAI | null,
  systemInstruction: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  fallbackMaxOutputTokens: number
): Promise<{ data: T; modelUsed: string } | null> {
  if (!ai) return null;

  if (Date.now() >= primaryCooldownUntil) {
    try {
      const primaryRes = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        25000,
        'gemini-4-hydrogen'
      );
      const text = extractResponseText(primaryRes);
      if (!text) {
        const finishReason = primaryRes.candidates?.[0]?.finishReason;
        throw new Error(
          `Empty response from gemini-4-hydrogen${finishReason ? ` (finishReason: ${String(finishReason)})` : ''}`
        );
      }
      return { data: parseJsonText<T>(text), modelUsed: 'gemini-4-hydrogen' };
    } catch (primaryErr) {
      const msg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
      if (isRateLimitError(primaryErr)) {
        const cooldownMs = extractRetryDelayMs(msg);
        primaryCooldownUntil = Date.now() + cooldownMs;
        console.log(
          `gemini-4-hydrogen quota limited; routing to fallback model for ${Math.round(cooldownMs / 1000)}s.`
        );
      } else {
        console.log(`gemini-4-hydrogen unavailable (${msg.slice(0, 140)}), using fallback model.`);
      }
    }
  }

  for (const fallbackModel of ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const) {
    try {
      const fallbackRes = await withTimeout(
        ai.models.generateContent({
          model: fallbackModel,
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: schema,
            maxOutputTokens: fallbackMaxOutputTokens,
          },
        }),
        20000,
        fallbackModel
      );
      const text = extractResponseText(fallbackRes);
      if (!text) {
        const finishReason = fallbackRes.candidates?.[0]?.finishReason;
        throw new Error(
          `Empty response from ${fallbackModel}${finishReason ? ` (finishReason: ${String(finishReason)})` : ''}`
        );
      }
      return { data: parseJsonText<T>(text), modelUsed: fallbackModel };
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      console.log(`${fallbackModel} unavailable (${msg.slice(0, 120)}).`);
    }
  }

  return null;
}

function sanitizeDynamicMeal(
  raw: {
    title?: unknown;
    tagline?: unknown;
    prep_mins?: unknown;
    protein_g?: unknown;
    calories?: unknown;
    ingredients?: unknown;
    steps?: unknown;
  },
  day: number,
  config: UserConfig
): Meal | null {
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 90) : '';
  const tagline =
    typeof raw.tagline === 'string'
      ? raw.tagline.trim().slice(0, 160)
      : 'Freshly built from Zucchini Nairobi market ingredients.';

  if (!title || !Array.isArray(raw.ingredients)) return null;

  const seenIng = new Set<number>();
  const cleanIngredients: RecipeIngredient[] = [];
  for (const ing of raw.ingredients) {
    if (!ing || typeof ing !== 'object') continue;
    const ingObj = ing as Record<string, unknown>;
    const id = Number(ingObj.catalog_id);
    if (!Number.isSafeInteger(id) || !validCatalogIds.has(id) || seenIng.has(id)) {
      continue;
    }
    const catItem = catalogMap.get(id);
    if (!catItem || !isIngredientCompatibleWithDietary(catItem, config.dietaryFilters)) {
      continue;
    }
    seenIng.add(id);
    const rawQtyBase = Number(ingObj.qty_base);
    const qty_base =
      Number.isFinite(rawQtyBase) && rawQtyBase > 0
        ? Math.min(4, Math.max(0.01, rawQtyBase))
        : 0.5;
    const display =
      typeof ingObj.display === 'string' && ingObj.display.trim()
        ? ingObj.display.trim().slice(0, 60)
        : catItem.unit;

    cleanIngredients.push({
      catalog_id: id,
      qty_base,
      display,
      is_pantry: Boolean(ingObj.is_pantry) || isPantryCatalogItem(catItem),
    });
  }

  if (cleanIngredients.length === 0) return null;

  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .map((s) => (typeof s === 'string' ? s.trim() : ''))
        .filter(Boolean)
        .slice(0, 6)
    : [];

  return {
    day,
    id: `dynamic-${day}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32)}`,
    title,
    tagline,
    prep_mins: Math.min(90, Math.max(5, Math.round(Number(raw.prep_mins) || 20))),
    protein_g: Math.min(120, Math.max(5, Math.round(Number(raw.protein_g) || 24))),
    calories: Math.min(1400, Math.max(180, Math.round(Number(raw.calories) || 520))),
    base_servings: 2,
    appliances: [config.appliances[0] || 'stove'],
    photo: '',
    is_dynamic_fallback: true,
    ingredients: cleanIngredients,
    steps:
      steps.length > 0
        ? steps
        : ['Prepare all ingredients, cook with your selected kitchen appliance, season to taste, and serve hot.'],
  };
}

function buildHybridSystemPrompt(): string {
  return [
    'You are PikaCart, an expert Nairobi chef and grocery optimizer synced with Zucchini Food Market.',
    'STRICT GROUNDING RULES:',
    '1. EVERY ingredient catalog_id MUST be an exact numeric ID from the Zucchini catalog list provided in the user message.',
    '2. NEVER invent IDs, products, or salt (assume salt and water are in every kitchen).',
    '3. APPLIANCE LOCK: Only use cooking methods compatible with the user-selected appliances.',
    '4. DIETARY LOCK: Strictly obey all selected dietary filters (Vegetarian excludes meat, chicken, tuna, sausages, and Knorrox stock cubes; Dairy-Free excludes dairy, butter, cheese, yoghurt, cream; Gluten-Free excludes pasta, udon, couscous, bread, pita, wraps, breadcrumbs, regular soy sauce).',
    '5. Reuse catalog_ids from surviving meals or across generated dishes to cut waste and cost.',
    '6. Keep JSON concise: 3-4 short steps (under 20 words each) and a single-sentence savings_summary (under 25 words).',
  ].join('\n');
}

function formatCompactEligibleCatalog(dietaryFilters: DietaryFilter[]): string {
  return catalog
    .filter((item) => isIngredientCompatibleWithDietary(item, dietaryFilters))
    .map((item) => `${item.id}: ${item.name} (${item.cat}, ${item.unit}, KES ${item.price})`)
    .join('\n');
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '256kb' }));

  const generateLimiter = createRateLimiter('generate', 15);
  const swapLimiter = createRateLimiter('swap', 30);

  const hybridSystemInstruction = buildHybridSystemPrompt();

  app.post('/api/menu/generate', generateLimiter, async (req, res) => {
    const { config, error } = validateAndNormalizeConfig(req.body);
    if (!config) {
      res.status(400).json({ error: error || 'Invalid meal plan configuration.' });
      return;
    }

    // Tier 1: Deterministic Pre-Filter against 150-recipe vault
    const eligible = recipes.filter(
      (recipe) =>
        recipe.appliances.every((appId) => config.appliances.includes(appId)) &&
        config.dietaryFilters.every((df) => recipe.dietary.includes(df))
    );
    const eligibleMap = new Map<string, VaultRecipe>(eligible.map((r) => [r.id, r]));

    const ai = getAiClient();

    // Tier 2: Standard Path (eligible.length >= days)
    if (eligible.length >= config.days) {
      const compactIndex = eligible.map((r) => ({
        id: r.id,
        title: r.title,
        goals: r.goals,
        prep_mins: r.prep_mins,
        protein_g: r.protein_g,
        ingredient_ids: Array.from(new Set(r.ingredients.map((i) => i.catalog_id))),
      }));

      const selectorSystem =
        'You are PikaCart, an expert Kenyan meal-plan optimizer. Select unique recipe_ids strictly from the provided eligible recipe index to maximize goal fit, day-to-day variety, and shared ingredient_ids to minimize grocery waste and cost. Keep savings_summary to 1 concise sentence under 25 words and return only valid JSON.';

      const selectorPrompt = [
        `Select exactly ${config.days} unique recipe_ids for ${config.householdSize}.`,
        `Goal: ${GOAL_LABELS[config.goal]}`,
        `Eligible Recipes Index (${compactIndex.length} recipes):`,
        JSON.stringify(compactIndex),
        `Return JSON with "recipe_ids" (length ${config.days}, all unique IDs from the index above) and a concise 1-sentence "savings_summary" naming key shared ingredients.`,
      ].join('\n');

      const aiRes = await generateWithFallback<{
        recipe_ids?: unknown;
        savings_summary?: unknown;
      }>(ai, selectorSystem, selectorPrompt, vaultSelectionSchema, 1024);

      if (aiRes && Array.isArray(aiRes.data?.recipe_ids)) {
        const picked: VaultRecipe[] = [];
        const seen = new Set<string>();

        for (const rawId of aiRes.data.recipe_ids) {
          if (typeof rawId !== 'string' || seen.has(rawId)) continue;
          const match = eligibleMap.get(rawId);
          if (match) {
            seen.add(rawId);
            picked.push(match);
            if (picked.length === config.days) break;
          }
        }

        if (picked.length < config.days) {
          const seedIngIds = new Set<number>(
            picked.flatMap((r) => r.ingredients.map((i) => i.catalog_id))
          );
          const extra = pickBestRecipesDeterministically(
            eligible,
            config.days - picked.length,
            config.goal,
            seen,
            seedIngIds
          );
          picked.push(...extra);
        }

        if (picked.length > 0) {
          const meals = picked.map((r, idx) => vaultRecipeToMeal(r, idx + 1));
          const summary =
            typeof aiRes.data.savings_summary === 'string' &&
            aiRes.data.savings_summary.trim()
              ? aiRes.data.savings_summary.trim()
              : buildSavingsSummaryFromMeals(meals);

          const responsePayload: GeneratedMenuResponse = {
            savings_summary: summary,
            meals,
            model_used: aiRes.modelUsed,
            usedFallback: false,
            hasDynamicFallback: false,
          };
          res.json(responsePayload);
          return;
        }
      }

      // Tier 4: Zero-Error Local Safety Net on Standard Path
      const fallbackPicked = pickBestRecipesDeterministically(
        eligible,
        config.days,
        config.goal
      );
      const meals = fallbackPicked.map((r, idx) => vaultRecipeToMeal(r, idx + 1));
      const responsePayload: GeneratedMenuResponse = {
        savings_summary: buildSavingsSummaryFromMeals(meals),
        meals,
        model_used: 'vault-local-optimizer',
        usedFallback: true,
        hasDynamicFallback: false,
      };
      res.json(responsePayload);
      return;
    }

    // Tier 3: Hybrid Fallback (eligible.length < config.days)
    const survivingMeals: Meal[] = eligible.map((r, idx) =>
      vaultRecipeToMeal(r, idx + 1)
    );
    const neededCount = config.days - survivingMeals.length;

    const appliancesList = config.appliances
      .map((a) => APPLIANCE_LABELS[a])
      .join(', ');
    const dietaryList =
      config.dietaryFilters.length > 0
        ? config.dietaryFilters.map((d) => DIETARY_LABELS[d]).join('; ')
        : 'None';

    const survivingIngredients = Array.from(
      new Set(survivingMeals.flatMap((m) => m.ingredients.map((i) => i.catalog_id)))
    )
      .map((id) => `${id} (${catalogMap.get(id)?.name || id})`)
      .join(', ');

    const hybridPrompt = [
      `We already have ${survivingMeals.length} curated meals: ${
        survivingMeals.map((m) => m.title).join(', ') || 'None'
      }.`,
      `Generate ONLY ${neededCount} additional unique Kenyan-friendly dishes for ${config.householdSize} using ONLY these appliances: ${appliancesList}.`,
      `Goal: ${GOAL_LABELS[config.goal]}`,
      `Strict Dietary Filters: ${dietaryList}`,
      survivingIngredients
        ? `Try to reuse these surviving menu ingredients: ${survivingIngredients}`
        : 'Reuse ingredients across these dynamic dishes to minimize cost.',
      '',
      'Eligible Zucchini Catalog (id: name (cat, unit, price)):',
      formatCompactEligibleCatalog(config.dietaryFilters),
      '',
      `Return exactly ${neededCount} meals in "meals" and a 1-sentence "savings_summary".`,
    ].join('\n');

    const dynamicMeals: Meal[] = [];
    let modelUsed = 'vault-hybrid-local';
    let usedFallback = false;

    const hybridAiRes = await generateWithFallback<{
      savings_summary?: unknown;
      meals?: unknown[];
    }>(ai, hybridSystemInstruction, hybridPrompt, hybridDynamicSchema, 4096);

    if (hybridAiRes && Array.isArray(hybridAiRes.data?.meals)) {
      modelUsed = hybridAiRes.modelUsed;
      for (const rawMeal of hybridAiRes.data.meals) {
        if (dynamicMeals.length >= neededCount) break;
        if (!rawMeal || typeof rawMeal !== 'object') continue;
        const sanitized = sanitizeDynamicMeal(
          rawMeal as Record<string, unknown>,
          survivingMeals.length + dynamicMeals.length + 1,
          config
        );
        if (sanitized) {
          dynamicMeals.push(sanitized);
        }
      }
    }

    // Zero-Error Local Safety Net if Gemini returned fewer dynamic dishes than needed
    if (dynamicMeals.length < neededCount) {
      usedFallback = true;
      const dietaryCompatibleVault = recipes.filter(
        (r) =>
          !eligibleMap.has(r.id) &&
          config.dietaryFilters.every((df) => r.dietary.includes(df))
      );
      const fallbackPool =
        dietaryCompatibleVault.length > 0 ? dietaryCompatibleVault : recipes;
      const seedIds = new Set<number>(
        [...survivingMeals, ...dynamicMeals].flatMap((m) =>
          m.ingredients.map((i) => i.catalog_id)
        )
      );
      const adaptedCandidates = pickBestRecipesDeterministically(
        fallbackPool,
        neededCount - dynamicMeals.length,
        config.goal,
        new Set(eligible.map((e) => e.id)),
        seedIds
      );
      for (const candidate of adaptedCandidates) {
        dynamicMeals.push(
          adaptVaultRecipeToAppliances(
            candidate,
            config.appliances,
            survivingMeals.length + dynamicMeals.length + 1
          )
        );
      }
    }

    const allMeals = [...survivingMeals, ...dynamicMeals].map((m, idx) => ({
      ...m,
      day: idx + 1,
    }));

    const aiSummary =
      hybridAiRes && typeof hybridAiRes.data?.savings_summary === 'string'
        ? hybridAiRes.data.savings_summary.trim()
        : '';

    const responsePayload: GeneratedMenuResponse = {
      savings_summary: aiSummary || buildSavingsSummaryFromMeals(allMeals),
      meals: allMeals,
      model_used: modelUsed,
      usedFallback,
      hasDynamicFallback: dynamicMeals.length > 0,
    };
    res.json(responsePayload);
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
    } = req.body as {
      config?: unknown;
      dayToReplace?: unknown;
      currentMeals?: unknown;
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
    const usedRecipeIds = new Set<string>();
    const usedTitles = new Set<string>();
    const keptIngredientIds = new Set<number>();

    for (const m of safeMeals) {
      if (!m || typeof m !== 'object') continue;
      const obj = m as {
        day?: unknown;
        id?: unknown;
        title?: unknown;
        ingredients?: unknown;
      };
      if (typeof obj.id === 'string') usedRecipeIds.add(obj.id);
      if (typeof obj.title === 'string') usedTitles.add(obj.title.toLowerCase());
      if (obj.day !== dayToReplace && Array.isArray(obj.ingredients)) {
        for (const ing of obj.ingredients) {
          if (ing && typeof ing === 'object') {
            const cid = Number((ing as { catalog_id?: unknown }).catalog_id);
            if (Number.isSafeInteger(cid) && validCatalogIds.has(cid)) {
              keptIngredientIds.add(cid);
            }
          }
        }
      }
    }

    const eligible = recipes.filter(
      (r) =>
        r.appliances.every((appId) => config.appliances.includes(appId)) &&
        config.dietaryFilters.every((df) => r.dietary.includes(df))
    );

    const unusedEligible = eligible.filter(
      (r) => !usedRecipeIds.has(r.id) && !usedTitles.has(r.title.toLowerCase())
    );

    if (unusedEligible.length > 0) {
      const [best] = pickBestRecipesDeterministically(
        unusedEligible,
        1,
        config.goal,
        usedRecipeIds,
        keptIngredientIds
      );
      if (best) {
        res.json({
          meal: vaultRecipeToMeal(best, dayToReplace),
          model_used: 'vault-swap-optimizer',
          usedFallback: false,
        });
        return;
      }
    }

    // Hybrid swap when all eligible curated recipes are already used
    const ai = getAiClient();
    const appliancesList = config.appliances
      .map((a) => APPLIANCE_LABELS[a])
      .join(', ');
    const dietaryList =
      config.dietaryFilters.length > 0
        ? config.dietaryFilters.map((d) => DIETARY_LABELS[d]).join('; ')
        : 'None';
    const reusableNames = Array.from(keptIngredientIds)
      .slice(0, 20)
      .map((id) => `${id} (${catalogMap.get(id)?.name || id})`)
      .join(', ');

    const swapPrompt = [
      `Create 1 unique dish for Day ${dayToReplace} (${config.householdSize}) using ONLY: ${appliancesList}.`,
      `Goal: ${GOAL_LABELS[config.goal]}`,
      `Dietary Filters: ${dietaryList}`,
      `Avoid repeating: ${Array.from(usedTitles).join(', ') || 'None'}`,
      `Reuse existing menu ingredients where possible: ${reusableNames || 'None'}`,
      '',
      'Eligible Zucchini Catalog (id: name (cat, unit, price)):',
      formatCompactEligibleCatalog(config.dietaryFilters),
    ].join('\n');

    const aiSwap = await generateWithFallback<{
      meals?: unknown[];
    }>(
      ai,
      hybridSystemInstruction,
      `${swapPrompt}\nReturn JSON with "savings_summary" and "meals" containing 1 dish.`,
      hybridDynamicSchema,
      2048
    );

    if (aiSwap && Array.isArray(aiSwap.data?.meals) && aiSwap.data.meals[0]) {
      const sanitized = sanitizeDynamicMeal(
        aiSwap.data.meals[0] as Record<string, unknown>,
        dayToReplace,
        config
      );
      if (sanitized) {
        res.json({
          meal: sanitized,
          model_used: aiSwap.modelUsed,
          usedFallback: false,
        });
        return;
      }
    }

    // Zero-Error local swap fallback
    const dietaryCompatible = recipes.filter((r) =>
      config.dietaryFilters.every((df) => r.dietary.includes(df))
    );
    const pool = dietaryCompatible.length > 0 ? dietaryCompatible : recipes;
    const candidate =
      pool.find((r) => !usedTitles.has(r.title.toLowerCase())) || pool[0];

    res.json({
      meal: adaptVaultRecipeToAppliances(candidate, config.appliances, dayToReplace),
      model_used: 'vault-local-optimizer',
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
