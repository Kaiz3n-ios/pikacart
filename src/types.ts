export type CatalogCategory =
  | 'protein'
  | 'produce'
  | 'dairy'
  | 'pantry_grains'
  | 'spices_sauces'
  | 'bakery';

export interface CatalogItem {
  id: number;
  name: string;
  cat: CatalogCategory;
  unit: string;
  price: number;
  img: string;
}

export type GoalId =
  | 'high_protein'
  | 'quick_20min'
  | 'kenyan_comfort'
  | 'plant_forward'
  | 'budget_saver';

export type HouseholdSize = '1 Person' | '2 People' | '4+ Family';

export type DaysCount = 3 | 5 | 7;

export type DietaryFilter =
  | 'vegetarian'
  | 'dairy_free'
  | 'gluten_free'
  | 'high_calorie';

export type ApplianceId =
  | 'stove'
  | 'air_fryer'
  | 'oven'
  | 'blender'
  | 'microwave'
  | 'pressure_cooker';

export interface RecipeIngredient {
  catalog_id: number;
  qty_base: number;
  display: string;
  is_pantry: boolean;
}

export interface VaultRecipe {
  id: string;
  title: string;
  tagline: string;
  goals: GoalId[];
  appliances: ApplianceId[];
  dietary: DietaryFilter[];
  prep_mins: number;
  protein_g: number;
  calories: number;
  base_servings: number;
  photo: string;
  photo_search_query?: string;
  source_inspiration?: string;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface Meal {
  day: number;
  id: string;
  title: string;
  tagline: string;
  prep_mins: number;
  protein_g: number;
  calories: number;
  base_servings: number;
  appliances: ApplianceId[];
  photo: string;
  is_dynamic_fallback?: boolean;
  ingredients: RecipeIngredient[];
  steps: string[];
}

export interface GeneratedMenuResponse {
  savings_summary: string;
  meals: Meal[];
  model_used?: string;
  usedFallback?: boolean;
  hasDynamicFallback?: boolean;
}

export interface SwapMealResponse {
  meal: Meal;
  model_used?: string;
  usedFallback?: boolean;
}

export interface CartItem extends CatalogItem {
  qty: number;
  included: boolean;
  usedInDays: number[];
  isPantryStaple: boolean;
  isExtra?: boolean;
}

export interface UserConfig {
  goal: GoalId;
  householdSize: HouseholdSize;
  days: DaysCount;
  dietaryFilters: DietaryFilter[];
  appliances: ApplianceId[];
}

export interface SessionAnalytics {
  menusGenerated: number;
  checkoutClicks: number;
  totalKesRouted: number;
}

export interface SavedWeeklyFavorite {
  id: string;
  name: string;
  savedAt: string;
  config: UserConfig;
  meals: Meal[];
  savingsSummary: string;
  cartItems: CartItem[];
  manualQtyIds: number[];
}
