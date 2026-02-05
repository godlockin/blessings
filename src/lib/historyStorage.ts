import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { HistoryItem } from '@/types/history';

const MAX_HISTORY_ITEMS = 100;
const MAX_STORAGE_SIZE = 50 * 1024 * 1024;

interface HistoryDBSchema extends DBSchema {
  history: {
    key: string;
    value: HistoryItem;
    indexes: { 'by-timestamp': number };
  };
}

let dbInstance: IDBPDatabase<HistoryDBSchema> | null = null;

export const initHistoryDB = async (): Promise<IDBPDatabase<HistoryDBSchema>> => {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<HistoryDBSchema>('blessings-history', 1, {
    upgrade(db) {
      const store = db.createObjectStore('history', { keyPath: 'id' });
      store.createIndex('by-timestamp', 'timestamp');
    },
  });

  return dbInstance;
};

export const saveHistoryItem = async (item: HistoryItem): Promise<void> => {
  const db = await initHistoryDB();
  const tx = db.transaction('history', 'readwrite');
  const store = tx.objectStore('history');

  await store.put(item);

  const allItems = await store.index('by-timestamp').getAll();
  const itemsToDelete: string[] = [];
  let currentSize = 0;

  for (const existingItem of allItems.reverse()) {
    currentSize += (existingItem.originalImage.length + existingItem.resultImage.length) * 0.75;
    if (allItems.length > MAX_HISTORY_ITEMS || currentSize > MAX_STORAGE_SIZE) {
      itemsToDelete.push(existingItem.id);
    }
  }

  for (const id of itemsToDelete) {
    await store.delete(id);
  }

  await tx.done;
};

export const getAllHistory = async (): Promise<HistoryItem[]> => {
  const db = await initHistoryDB();
  const all = await db.getAll('history');
  return all.reverse();
};

export const getHistoryItem = async (id: string): Promise<HistoryItem | undefined> => {
  const db = await initHistoryDB();
  return db.get('history', id);
};

export const deleteHistoryItem = async (id: string): Promise<void> => {
  const db = await initHistoryDB();
  await db.delete('history', id);
};

export const clearHistory = async (): Promise<void> => {
  const db = await initHistoryDB();
  await db.clear('history');
};

export const getHistoryStats = async (): Promise<{ count: number; size: number }> => {
  const db = await initHistoryDB();
  const items = await db.getAll('history');

  let totalSize = 0;
  for (const item of items) {
    totalSize += (item.originalImage.length + item.resultImage.length) * 0.75;
  }

  return { count: items.length, size: totalSize };
};
