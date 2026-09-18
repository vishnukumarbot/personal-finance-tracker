import AsyncStorage from "@react-native-async-storage/async-storage";

const keyFor = (email: string) => `finance-tracker-transactions-v2:${email.trim().toLowerCase()}`;
const deletedKeyFor = (email: string) => `finance-tracker-deleted-v1:${email.trim().toLowerCase()}`;
const migrationKeyFor = (email: string) => `finance-tracker-cloud-migrated-v1:${email.trim().toLowerCase()}`;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

export async function loadTransactions(email: string) {
  try { const raw = await AsyncStorage.getItem(keyFor(email)); const parsed = raw ? JSON.parse(raw) : []; return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

export async function saveTransactions(email: string, transactions: any[]) {
  await AsyncStorage.setItem(keyFor(email), JSON.stringify(transactions));
}


export async function loadDeletedTransactions(email: string) {
  try {
    const raw = await AsyncStorage.getItem(deletedKeyFor(email));
    const parsed = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = Array.isArray(parsed) ? parsed.filter((item) => now - Number(item.deletedAt || now) <= THIRTY_DAYS) : [];
    await AsyncStorage.setItem(deletedKeyFor(email), JSON.stringify(recent));
    return recent;
  } catch { return []; }
}

export async function saveDeletedTransactions(email: string, transactions: any[]) {
  await AsyncStorage.setItem(deletedKeyFor(email), JSON.stringify(transactions));
}

export async function hasCloudMigration(email: string) {
  try { return await AsyncStorage.getItem(migrationKeyFor(email)) === "true"; } catch { return false; }
}

export async function markCloudMigration(email: string) {
  await AsyncStorage.setItem(migrationKeyFor(email), "true");
}
