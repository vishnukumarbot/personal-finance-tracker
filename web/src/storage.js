const LEGACY_STORAGE_KEY = "finance-tracker-transactions-v1";
const DELETED_KEY = (email) => `finance-tracker-deleted-v1:${String(email || "").trim().toLowerCase()}`;
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const keyFor = (email) => `finance-tracker-transactions-v2:${String(email || "").trim().toLowerCase()}`;

function validate(parsed) {
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (item) =>
      item &&
      typeof item.id === "string" &&
      (item.type === "income" || item.type === "expense") &&
      Number.isFinite(Number(item.amount)) &&
      Number(item.amount) > 0 &&
      typeof item.category === "string" &&
      typeof item.date === "string"
  );
}

export function loadTransactions(email) {
  try {
    if (!email) return [];
    const key = keyFor(email);
    const raw = window.localStorage.getItem(key);
    if (raw) return validate(JSON.parse(raw));

    // One-time migration of the old pre-login data set to the first authenticated account.
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = validate(JSON.parse(legacy));
      if (migrated.length) window.localStorage.setItem(key, JSON.stringify(migrated));
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
    return [];
  } catch {
    return [];
  }
}

export function loadDeletedTransactions(email) {
  try {
    if (!email) return [];
    const raw = window.localStorage.getItem(DELETED_KEY(email));
    const items = validate(raw ? JSON.parse(raw) : []);
    const now = Date.now();
    const recent = items.filter((item) => now - Number(item.deletedAt || now) <= THIRTY_DAYS);
    window.localStorage.setItem(DELETED_KEY(email), JSON.stringify(recent));
    return recent;
  } catch { return []; }
}

export function saveDeletedTransactions(email, transactions) {
  try {
    if (!email) return false;
    window.localStorage.setItem(DELETED_KEY(email), JSON.stringify(transactions));
    return true;
  } catch { return false; }
}

export function saveTransactions(email, transactions) {
  try {
    if (!email) return false;
    window.localStorage.setItem(keyFor(email), JSON.stringify(transactions));
    return true;
  } catch {
    return false;
  }
}
