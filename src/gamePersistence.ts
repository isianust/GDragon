import type { EngineRegistrySnapshot } from "./tickEngine.ts";
import type { GameState } from "./types.ts";

const DB_NAME = "project-dragon-db";
const DB_VERSION = 1;
const STORE_NAME = "game-saves";
const AUTO_SAVE_KEY = "autosave";
const PAYLOAD_VERSION = 1 as const;

export interface PersistedGamePayload {
  version: typeof PAYLOAD_VERSION;
  gameState: GameState;
  registries: EngineRegistrySnapshot;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

function idbRequestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error ?? new Error("indexedDB request failed"));
    req.onsuccess = () => resolve(req.result as T);
  });
}

export async function exportGameState(
  state: GameState,
  registries: EngineRegistrySnapshot,
): Promise<void> {
  const db = await openDb();
  const payload: PersistedGamePayload = {
    version: PAYLOAD_VERSION,
    gameState: structuredClone(state),
    registries: structuredClone(registries),
  };
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await idbRequestToPromise(store.put(payload, AUTO_SAVE_KEY));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("indexedDB transaction aborted"));
  });
  db.close();
}

export async function importGameState(): Promise<PersistedGamePayload | null> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const raw = await idbRequestToPromise(store.get(AUTO_SAVE_KEY));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("indexedDB read failed"));
  });
  db.close();
  if (!raw || typeof raw !== "object") return null;
  const payload = raw as PersistedGamePayload;
  if (payload.version !== PAYLOAD_VERSION || !payload.gameState || !payload.registries) {
    return null;
  }
  return payload;
}
