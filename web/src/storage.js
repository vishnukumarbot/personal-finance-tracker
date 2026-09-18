const LEGACY_STORAGE_KEY = "finance-tracker-transactions-v1";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1_000;
const transactionKey = (email) =>
  `finance-tracker-transactions-v2:${String(email || "").trim().toLowerCase()}`;
const deletedKey = (email) =>
  `finance-tracker-deleted-v1:${String(email || "").trim().toLowerCase()}`;
const migrationKey = (email) =>
  `finance-tracker-cloud-migrated-v1:${String(email || "").trim().toLowerCase()}`;
const customCategoriesKey = (email) =>
  `finance-tracker-custom-expense-categories-v1:${String(email || "").trim().toLowerCase()}`;

function normalizeCategories(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.flatMap((item) => {
    const category = String(item || "").trim().replace(/\s+/g, " ");
    const key = category.toLocaleLowerCase();
    if (!category || category.length > 40 || seen.has(key)) return [];
    seen.add(key);
    return [category];
  });
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalize(items) {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    const amount = Math.round(Number(item?.amount) * 100) / 100;
    const category = String(item?.category || "").trim();
    if (
      !item ||
      typeof item.id !== "string" ||
      (item.type !== "income" && item.type !== "expense") ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !category ||
      !validDate(item.date)
    ) {
      return [];
    }

    return [{ ...item, amount, category }];
  });
}

export function loadTransactions(email) {
  try {
    if (!email) return [];
    const key = transactionKey(email);
    const raw = window.localStorage.getItem(key);
    if (raw) return normalize(JSON.parse(raw));

    // One-time migration of data created before accounts were introduced.
    const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy) return [];

    const migrated = normalize(JSON.parse(legacy));
    if (migrated.length) window.localStorage.setItem(key, JSON.stringify(migrated));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return migrated;
  } catch {
    return [];
  }
}

export function saveTransactions(email, transactions) {
  try {
    if (!email) return false;
    window.localStorage.setItem(transactionKey(email), JSON.stringify(transactions));
    return true;
  } catch {
    return false;
  }
}

export function loadDeletedTransactions(email) {
  try {
    if (!email) return [];
    const key = deletedKey(email);
    const raw = window.localStorage.getItem(key);
    const now = Date.now();
    const recent = normalize(raw ? JSON.parse(raw) : []).filter(
      (item) => now - Number(item.deletedAt || now) <= THIRTY_DAYS,
    );
    window.localStorage.setItem(key, JSON.stringify(recent));
    return recent;
  } catch {
    return [];
  }
}

export function saveDeletedTransactions(email, transactions) {
  try {
    if (!email) return false;
    window.localStorage.setItem(deletedKey(email), JSON.stringify(transactions));
    return true;
  } catch {
    return false;
  }
}

export function loadCustomExpenseCategories(email) {
  try {
    if (!email) return [];
    const raw = window.localStorage.getItem(customCategoriesKey(email));
    return normalizeCategories(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

export function saveCustomExpenseCategories(email, categories) {
  try {
    if (!email) return false;
    window.localStorage.setItem(customCategoriesKey(email), JSON.stringify(normalizeCategories(categories)));
    return true;
  } catch {
    return false;
  }
}

export function hasCloudMigration(email) {
  try {
    return Boolean(email) && window.localStorage.getItem(migrationKey(email)) === "true";
  } catch {
    return false;
  }
}

export function markCloudMigration(email) {
  try {
    if (!email) return false;
    window.localStorage.setItem(migrationKey(email), "true");
    return true;
  } catch {
    return false;
  }
}
