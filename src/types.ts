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
  | 'high-protein-gym'
  | '20-min-quick'
  | 'kenyan-comfort'
  | 'clean-plant-forward'
  | 'budget-saver';

export type HouseholdSize = '1 Person' | '2 People' | '4+ Family';

export type DaysCount = 3 | 5 | 7;

export type DietaryFilter =
  | 'Vegetarian'
  | 'Dairy-Free'
  | 'Gluten-Free'
  | 'High-Calorie / Bulking';

export type ApplianceId =
  | 'stove'
  | 'air-fryer'
  | 'oven'
  | 'blender'
  | 'microwave'
  | 'pressure-cooker';

export interface MealIngredient {
  catalog_id: number;
  amount: string;
}

export interface Meal {
  day: number;
  title: string;
  description: string;
  prep_minutes: number;
  protein_grams: number;
  calories: number;
  appliance_used: string;
  ingredients: MealIngredient[];
  steps: string[];
}

export interface CartRecommendation {
  catalog_id: number;
  qty: number;
}

export interface GeneratedMenuResponse {
  savings_summary: string;
  meals: Meal[];
  cart_items: CartRecommendation[];
  model_used?: string;
  usedFallback?: boolean;
}

export interface SwapMealResponse {
  meal: Meal;
  cart_adjustments: CartRecommendation[];
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
