import type { AtelierData, OfflineOperation, SyncConflict } from "@/lib/atelier-types";

type KeyValueRecord = { key: string; value: AtelierData };
type StoredOperation = OfflineOperation & { queuedAt: number; ownerId: string };

type StoreDatabase = IDBDatabase;

const DATABASE_NAME = "atelierplus-local";
const DATABASE_VERSION = 1;
const SNAPSHOT_KEY = "atelier-snapshot";
let lastQueueTimestamp = 0;

function openDatabase(): Promise<StoreDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("Le stockage hors-ligne n’est pas disponible sur cet appareil."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("keyval")) {
        database.createObjectStore("keyval", { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains("operations")) {
        database.createObjectStore("operations", { keyPath: "queueId" });
      }
      if (!database.objectStoreNames.contains("conflicts")) {
        database.createObjectStore("conflicts", { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error("Impossible d’ouvrir le stockage local."));
    request.onblocked = () => reject(new Error("Fermez puis rouvrez les autres onglets AtelierPLUS pour accéder au stockage local."));
  });
}

async function withStore<T>(
  storeName: "keyval" | "operations" | "conflicts",
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    return await new Promise<T>((resolve, reject) => {
      let requestFinished = false;
      let transactionFinished = false;
      let result: T;
      let failure: Error | null = null;

      const settle = () => {
        if (failure) reject(failure);
        else if (requestFinished && transactionFinished) resolve(result);
      };

      transaction.oncomplete = () => {
        transactionFinished = true;
        settle();
      };
      transaction.onerror = () => {
        failure = transaction.error ?? new Error("La transaction locale n’a pas pu être validée.");
        settle();
      };
      transaction.onabort = () => {
        failure = transaction.error ?? new Error("La transaction locale a été interrompue.");
        settle();
      };

      let request: IDBRequest<T>;
      try {
        request = run(transaction.objectStore(storeName));
      } catch (error) {
        reject(error instanceof Error ? error : new Error("La requête locale a échoué."));
        return;
      }
      request.onsuccess = () => {
        result = request.result;
        requestFinished = true;
        settle();
      };
      request.onerror = () => {
        failure = request.error ?? new Error("La requête locale a échoué.");
        settle();
      };
    });
  } finally {
    database.close();
  }
}

export async function readSnapshot(): Promise<AtelierData | null> {
  const record = await withStore<KeyValueRecord | undefined>("keyval", "readonly", (store) =>
    store.get(SNAPSHOT_KEY),
  );
  return record?.value ?? null;
}

export async function saveSnapshot(value: AtelierData): Promise<void> {
  await withStore<IDBValidKey>("keyval", "readwrite", (store) =>
    store.put({ key: SNAPSHOT_KEY, value } satisfies KeyValueRecord),
  );
}

export async function addToQueue(operation: OfflineOperation, ownerId: string): Promise<void> {
  lastQueueTimestamp = Math.max(Date.now(), lastQueueTimestamp + 1);
  await withStore<IDBValidKey>("operations", "readwrite", (store) =>
    store.put({ ...operation, ownerId, queuedAt: lastQueueTimestamp } satisfies StoredOperation),
  );
}

export async function readQueue(ownerId?: string): Promise<OfflineOperation[]> {
  let operations = await withStore<StoredOperation[]>("operations", "readonly", (store) => store.getAll());
  if (ownerId) {
    const legacyOperations = operations.filter((operation) => !operation.ownerId);
    for (const operation of legacyOperations) {
      await withStore<IDBValidKey>("operations", "readwrite", (store) =>
        store.put({ ...operation, ownerId }),
      );
    }
    operations = operations.map((operation) => operation.ownerId ? operation : { ...operation, ownerId });
    operations = operations.filter((operation) => operation.ownerId === ownerId);
  }
  return operations
    .sort((first, second) => first.queuedAt - second.queuedAt)
    .map(({ queuedAt: _queuedAt, ownerId: _ownerId, ...operation }) => operation);
}

export async function removeFromQueue(queueId: string): Promise<void> {
  await withStore<undefined>("operations", "readwrite", (store) => store.delete(queueId));
}

export async function saveConflict(conflict: SyncConflict): Promise<void> {
  await withStore<IDBValidKey>("conflicts", "readwrite", (store) => store.put(conflict));
}

export async function moveToConflict(queueId: string, conflict: SyncConflict): Promise<void> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(["operations", "conflicts"], "readwrite");
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Impossible d’enregistrer l’alerte de synchronisation."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Déplacement de l’opération interrompu."));
      transaction.objectStore("conflicts").put(conflict);
      transaction.objectStore("operations").delete(queueId);
    });
  } finally {
    database.close();
  }
}

export async function readConflicts(ownerId?: string): Promise<SyncConflict[]> {
  let conflicts = await withStore<SyncConflict[]>("conflicts", "readonly", (store) => store.getAll());
  if (ownerId) {
    const legacyConflicts = conflicts.filter((conflict) => !conflict.ownerId);
    for (const conflict of legacyConflicts) {
      await withStore<IDBValidKey>("conflicts", "readwrite", (store) =>
        store.put({ ...conflict, ownerId }),
      );
    }
    conflicts = conflicts.map((conflict) => conflict.ownerId ? conflict : { ...conflict, ownerId });
    conflicts = conflicts.filter((conflict) => conflict.ownerId === ownerId);
  }
  return conflicts.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function removeConflict(id: string): Promise<void> {
  await withStore<undefined>("conflicts", "readwrite", (store) => store.delete(id));
}

export async function clearLocalWorkspace(ownerId?: string): Promise<void> {
  const snapshot = await readSnapshot();
  if (!ownerId || snapshot?.user.id === ownerId) {
    await withStore<undefined>("keyval", "readwrite", (store) => store.delete(SNAPSHOT_KEY));
  }

  const [operations, conflicts] = await Promise.all([
    withStore<StoredOperation[]>("operations", "readonly", (store) => store.getAll()),
    withStore<SyncConflict[]>("conflicts", "readonly", (store) => store.getAll()),
  ]);
  const ownedOperations = operations.filter((operation) => !ownerId || operation.ownerId === ownerId);
  const ownedConflicts = conflicts.filter((conflict) => !ownerId || conflict.ownerId === ownerId);
  await Promise.all([
    ...ownedOperations.map((operation) => removeFromQueue(operation.queueId)),
    ...ownedConflicts.map((conflict) => removeConflict(conflict.id)),
  ]);
}

