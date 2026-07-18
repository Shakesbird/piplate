import { db } from '../db';
import { Recipe, SyncOperationType, WeeklyPlan } from '../types';

const replacePending = async (
  type: SyncOperationType,
  entityId: string,
  payload: Recipe | WeeklyPlan | undefined,
  createdAt: number,
) => {
  const householdId = String((await db.settings.get('activeSyncHouseholdId'))?.value || '') || undefined;
  const replaced = await db.syncQueue
    .where('entityId')
    .equals(entityId)
    .and(item => item.type === type && item.householdId === householdId)
    .primaryKeys();
  await db.syncQueue.bulkDelete(replaced);
  await db.syncQueue.add({ type, entityId, householdId, payload, createdAt });
};

export const queueRecipeUpsert = (recipe: Recipe) =>
  replacePending('recipe-upsert', recipe.id, recipe, recipe.updatedAt || Date.now());

export const queueRecipeDelete = (recipeId: string, deletedAt: number) =>
  replacePending('recipe-delete', recipeId, undefined, deletedAt);

export const queuePlannerUpsert = (plan: WeeklyPlan, updatedAt: number) =>
  replacePending('planner-upsert', 'current', plan, updatedAt);
