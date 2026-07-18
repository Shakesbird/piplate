import Dexie, { Table } from 'dexie';
import { Recipe, SyncOperation } from './types';

// Define the database type for better TypeScript support with Dexie
export type PiPlateDatabase = Dexie & {
  recipes: Table<Recipe>;
  settings: Table<{ key: string; value: any }>;
  syncQueue: Table<SyncOperation, number>;
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

export { db };
