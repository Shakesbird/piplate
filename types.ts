export interface NutritionalValue {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  title: string;
  ingredients: string[];
  instructions: string[];
  portions: number;
  nutrition: NutritionalValue;
  imageUri: string;
  createdAt: number;
  updatedAt?: number;
  syncedImagePath?: string;
}

export interface WeeklyPlan {
  [day: string]: string[];
}

export type SyncOperationType = 'recipe-upsert' | 'recipe-delete' | 'planner-upsert';

export interface SyncOperation {
  id?: number;
  type: SyncOperationType;
  entityId: string;
  householdId?: string;
  payload?: Recipe | WeeklyPlan;
  createdAt: number;
}

export interface LocalRecipeBackup {
  id: string;
  recipes: Recipe[];
  weeklyPlan: WeeklyPlan;
  createdAt: number;
  reason: string;
}

export type ViewState = 'GALLERY' | 'PLANNER' | 'SETTINGS';

export const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const getTodayFirstDayOrder = (date = new Date()) => {
  const mondayBasedIndex = (date.getDay() + 6) % DAYS_OF_WEEK.length;
  return [...DAYS_OF_WEEK.slice(mondayBasedIndex), ...DAYS_OF_WEEK.slice(0, mondayBasedIndex)];
};

export const DEFAULT_RECIPE_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600' viewBox='0 0 800 600'%3E%3Crect width='100%25' height='100%25' fill='%23FAFAFA'/%3E%3Cpath d='M250 350 Q400 480 550 350' stroke='%23E5E7EB' stroke-width='16' fill='none' stroke-linecap='round'/%3E%3Cpath d='M300 320 Q400 400 500 320' stroke='%23F3F4F6' stroke-width='12' fill='none' stroke-linecap='round'/%3E%3Cpath d='M370 280 L370 200' stroke='%23E5E7EB' stroke-width='8' stroke-linecap='round'/%3E%3Cpath d='M400 290 L400 180' stroke='%23E5E7EB' stroke-width='8' stroke-linecap='round'/%3E%3Cpath d='M430 280 L430 200' stroke='%23E5E7EB' stroke-width='8' stroke-linecap='round'/%3E%3C/svg%3E`;
