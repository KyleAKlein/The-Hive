import { checkRecovery } from "@/lib/hive-wallet";

const DATABASE_NAME = "the-hive-wallet-vault-v1";
const STORE_NAME = "secrets";
const KEY_RECORD = "device-key";
const RECOVERY_RECORD = "wallet-recovery";

type VaultRecord =
  | { id: typeof KEY_RECORD; value: CryptoKey }
  | { id: typeof RECOVERY_RECORD; iv: ArrayBuffer; ciphertext: ArrayBuffer };

function openVault() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Wallet storage is unavailable."));
  });
}

function readRecord<T extends VaultRecord>(database: IDBDatabase, id: T["id"]) {
  return new Promise<T | undefined>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error ?? new Error("Wallet storage could not be read."));
  });
}

function writeRecord(database: IDBDatabase, record: VaultRecord) {
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Wallet storage could not be written."));
  });
}

export async function saveRecoveryToDevice(recovery: string) {
  const normalized = checkRecovery(recovery);
  const database = await openVault();
  try {
    let key = (await readRecord<{ id: typeof KEY_RECORD; value: CryptoKey }>(database, KEY_RECORD))?.value;
    if (!key) {
      key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await writeRecord(database, { id: KEY_RECORD, value: key });
    }
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(normalized),
    );
    const storedIv = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
    await writeRecord(database, { id: RECOVERY_RECORD, iv: storedIv, ciphertext });
  } finally {
    database.close();
  }
}

export async function loadRecoveryFromDevice() {
  const database = await openVault();
  try {
    const key = (await readRecord<{ id: typeof KEY_RECORD; value: CryptoKey }>(database, KEY_RECORD))?.value;
    const recovery = await readRecord<{
      id: typeof RECOVERY_RECORD;
      iv: ArrayBuffer;
      ciphertext: ArrayBuffer;
    }>(database, RECOVERY_RECORD);
    if (!key || !recovery) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(recovery.iv) },
      key,
      recovery.ciphertext,
    );
    return checkRecovery(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  } finally {
    database.close();
  }
}

export async function clearRecoveryFromDevice() {
  const database = await openVault();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(RECOVERY_RECORD);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Wallet storage could not be cleared."));
    });
  } finally {
    database.close();
  }
}
