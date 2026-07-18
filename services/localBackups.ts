import { db } from '../db';
import { LocalRecipeBackup, WeeklyPlan } from '../types';

export const createLocalBackup = async (reason: string) => {
  const recipes = await db.recipes.toArray();
  if (recipes.length === 0) return;
  const planRecord = await db.settings.get('weeklyPlan');
  const backup: LocalRecipeBackup = {
    id: crypto.randomUUID(),
    recipes,
    weeklyPlan: (planRecord?.value || {}) as WeeklyPlan,
    createdAt: Date.now(),
    reason,
  };
  await db.backups.put(backup);

  const backupIds = await db.backups.orderBy('createdAt').primaryKeys();
  if (backupIds.length > 5) await db.backups.bulkDelete(backupIds.slice(0, backupIds.length - 5));
};

export const restoreLatestBackupIfRecipesAreEmpty = async () => {
  if (await db.recipes.count() > 0) return false;
  const backup = await db.backups.orderBy('createdAt').last();
  const queuedRecipeOperations = await db.syncQueue.where('type').equals('recipe-upsert').toArray();
  const queuedRecipes = [...new Map(queuedRecipeOperations
    .filter(operation => operation.payload && 'title' in operation.payload)
    .map(operation => {
      const recipe = operation.payload as LocalRecipeBackup['recipes'][number];
      return [recipe.id, recipe] as const;
    })).values()];
  const recipesToRestore = backup?.recipes.length ? backup.recipes : queuedRecipes;
  if (recipesToRestore.length === 0) return false;
  const queuedPlan = (await db.syncQueue.where('type').equals('planner-upsert').last())?.payload as WeeklyPlan | undefined;

  await db.transaction('rw', db.recipes, db.settings, async () => {
    if (await db.recipes.count() > 0) return;
    await db.recipes.bulkPut(recipesToRestore);
    await db.settings.put({ key: 'weeklyPlan', value: backup?.weeklyPlan || queuedPlan || {} });
    await db.settings.put({ key: 'lastAutomaticRestoreAt', value: Date.now() });
  });
  return true;
};
