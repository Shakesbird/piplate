import Dexie, { Table } from 'dexie';
import { Recipe } from './types';

// Define the database type for better TypeScript support with Dexie
export type PiPlateDatabase = Dexie & {
  recipes: Table<Recipe>;
  settings: Table<{ key: string; value: any }>;
};

// Create the database instance
const db = new Dexie('PiPlateDB') as PiPlateDatabase;

// Define tables and indexes
db.version(1).stores({
  recipes: 'id, title', // Primary key and indexed props
  settings: 'key' // Key-value store for app settings (like weekly plan)
});

export { db };