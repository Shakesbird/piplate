import Dexie, { Table } from 'dexie';
import { LocalRecipeBackup, Recipe, SyncOperation, WeeklyPlan } from './types';

// Define the database type for better TypeScript support with Dexie
export type PiPlateDatabase = Dexie & {
  recipes: Table<Recipe>;
  settings: Table<{ key: string; value: any }>;
  syncQueue: Table<SyncOperation, number>;
  backups: Table<LocalRecipeBackup, string>;
};

// Create the database instance
const db = new Dexie('PiPlateDB') as PiPlateDatabase;

// Define tables and indexes
db.version(1).stores({
  recipes: 'id, title', // Primary key and indexed props
  settings: 'key' // Key-value store for app settings (like weekly plan)
});

// Version 2 only adds a pending-change queue. Existing recipes and settings are
// intentionally left untouched during the upgrade.
db.version(2).stores({
  recipes: 'id, title',
  settings: 'key',
  syncQueue: '++id, type, entityId, createdAt',
});

// Preserve a complete local snapshot before introducing any further schema
// changes. The backup lives in a separate object store and can repair an empty
// recipe table without replacing a non-empty collection.
db.version(3).stores({
  recipes: 'id, title',
  settings: 'key',
  syncQueue: '++id, type, entityId, createdAt',
  backups: 'id, createdAt',
}).upgrade(async transaction => {
  const recipes = await transaction.table<Recipe>('recipes').toArray();
  if (recipes.length === 0) return;
  const planRecord = await transaction.table<{ key: string; value: any }>('settings').get('weeklyPlan');
  await transaction.table<LocalRecipeBackup>('backups').put({
    id: 'before-version-3',
    recipes,
    weeklyPlan: (planRecord?.value || {}) as WeeklyPlan,
    createdAt: Date.now(),
    reason: 'database-upgrade',
  });
});

export { db };
