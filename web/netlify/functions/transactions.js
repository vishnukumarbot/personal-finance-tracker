import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";
import { corsHeaders, verifyToken } from "./_auth.js";

const STORE_NAME = "finance-tracker-accounts";
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const MAX_TRANSACTIONS = 5_000;

function apiError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (validIsoDate(text)) return text;

  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(text);
  if (!match) throw apiError("A transaction has an invalid date.");
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  if (!validIsoDate(iso)) throw apiError("A transaction has an invalid date.");
  return iso;
}

function normalizeTransaction(value, deleted = false) {
  const id = String(value?.id || "").trim();
  const type = value?.type;
  const amount = Math.round(Number(value?.amount) * 100) / 100;
  const category = String(value?.category || "").trim();

  if (!id || id.length > 200) throw apiError("A transaction has an invalid ID.");
  if (type !== "income" && type !== "expense") throw apiError("A transaction has an invalid type.");
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw apiError("A transaction amount must be a positive number.");
  }
  if (!category || category.length > 80) throw apiError("A transaction has an invalid category.");

  const normalized = {
    id,
    type,
    amount,
    category,
    date: normalizeDate(value?.date),
    createdAt: Number.isFinite(Number(value?.createdAt)) ? Number(value.createdAt) : Date.now(),
  };

  if (deleted) {
    normalized.deletedAt = Number.isFinite(Number(value?.deletedAt)) ? Number(value.deletedAt) : Date.now();
  }
  return normalized;
}

function normalizeList(items, deleted = false) {
  if (!Array.isArray(items)) throw apiError("Transactions must be provided as a list.");
  if (items.length > MAX_TRANSACTIONS) throw apiError("This account has too many transactions to import.");
  const byId = new Map();
  for (const item of items) {
    const transaction = normalizeTransaction(item, deleted);
    if (!byId.has(transaction.id)) byId.set(transaction.id, transaction);
  }
  return [...byId.values()];
}

function balanceInCents(transactions) {
  return transactions.reduce((balance, transaction) => {
    const amount = Math.round(transaction.amount * 100);
    return balance + (transaction.type === "income" ? amount : -amount);
  }, 0);
}

function ensureValidBalance(transactions) {
  if (balanceInCents(transactions) < 0) {
    throw apiError("This change would make your balance negative. Add enough income first.");
  }
}

export function freshState() {
  return { initialized: false, transactions: [], deletedTransactions: [], revision: 0, updatedAt: 0 };
}

function normalizeStoredState(value) {
  if (!value || typeof value !== "object") return freshState();
  const now = Date.now();
  let transactions;
  let deletedTransactions;
  try {
    transactions = normalizeList(value.transactions || []);
    deletedTransactions = normalizeList(value.deletedTransactions || [], true).filter(
      (item) => now - item.deletedAt <= THIRTY_DAYS,
    );
  } catch {
    throw apiError("Stored account data could not be read.", 500);
  }

  const deletedIds = new Set(deletedTransactions.map((item) => item.id));
  return {
    initialized: Boolean(value.initialized),
    transactions: transactions.filter((item) => !deletedIds.has(item.id)),
    deletedTransactions,
    revision: Math.max(0, Number(value.revision) || 0),
    updatedAt: Math.max(0, Number(value.updatedAt) || 0),
  };
}

function mergeMigration(state, body) {
  const incomingTransactions = normalizeList(body.transactions || []);
  const incomingDeleted = normalizeList(body.deletedTransactions || [], true).filter(
    (item) => Date.now() - item.deletedAt <= THIRTY_DAYS,
  );
  const deletedById = new Map(state.deletedTransactions.map((item) => [item.id, item]));
  for (const item of incomingDeleted) {
    const current = deletedById.get(item.id);
    if (!current || item.deletedAt > current.deletedAt) deletedById.set(item.id, item);
  }

  const transactionById = new Map(state.transactions.map((item) => [item.id, item]));
  for (const item of incomingTransactions) {
    if (!transactionById.has(item.id) && !deletedById.has(item.id)) transactionById.set(item.id, item);
  }
  for (const id of deletedById.keys()) transactionById.delete(id);

  const transactions = [...transactionById.values()];
  ensureValidBalance(transactions);
  return {
    ...state,
    initialized: true,
    transactions,
    deletedTransactions: [...deletedById.values()],
  };
}

export function applyAction(state, body) {
  switch (body.action) {
    case "migrate":
      return mergeMigration(state, body);
    case "add": {
      const transaction = normalizeTransaction(body.transaction);
      if (state.transactions.some((item) => item.id === transaction.id)) return state;
      const transactions = [transaction, ...state.transactions];
      ensureValidBalance(transactions);
      return { ...state, initialized: true, transactions };
    }
    case "delete": {
      const id = String(body.id || "");
      const transaction = state.transactions.find((item) => item.id === id);
      if (!transaction) return state;
      const transactions = state.transactions.filter((item) => item.id !== id);
      ensureValidBalance(transactions);
      return {
        ...state,
        initialized: true,
        transactions,
        deletedTransactions: [
          { ...transaction, deletedAt: Date.now() },
          ...state.deletedTransactions.filter((item) => item.id !== id),
        ],
      };
    }
    case "restore": {
      const id = String(body.id || "");
      const deleted = state.deletedTransactions.find((item) => item.id === id);
      if (!deleted) return state;
      const { deletedAt: _deletedAt, ...transaction } = deleted;
      const transactions = state.transactions.some((item) => item.id === id)
        ? state.transactions
        : [transaction, ...state.transactions];
      ensureValidBalance(transactions);
      return {
        ...state,
        initialized: true,
        transactions,
        deletedTransactions: state.deletedTransactions.filter((item) => item.id !== id),
      };
    }
    case "permanentDelete":
      return {
        ...state,
        initialized: true,
        deletedTransactions: state.deletedTransactions.filter((item) => item.id !== String(body.id || "")),
      };
    default:
      throw apiError("Unknown transaction action.");
  }
}

async function readState(store, key) {
  const entry = await store.getWithMetadata(key, { type: "json", consistency: "strong" });
  return { state: normalizeStoredState(entry?.data), etag: entry?.etag };
}

async function mutateState(store, key, body) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { state, etag } = await readState(store, key);
    const next = applyAction(state, body);
    if (next === state && state.initialized) return state;

    const saved = {
      ...next,
      initialized: true,
      revision: state.revision + 1,
      updatedAt: Date.now(),
    };
    const result = await store.setJSON(key, saved, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (result.modified) return saved;
  }
  throw apiError("Your data changed on another device. Please try again.", 409);
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(),
  });
}

function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

// The modern Netlify Functions runtime configures Blobs automatically and supports
// strongly-consistent reads. Lambda compatibility mode only exposes the cached edge URL.
export default async function transactions(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const session = verifyToken(bearerToken(request));
  if (!session) return jsonResponse(401, { error: "Your session has expired. Please log in again." });

  try {
    const store = getStore(STORE_NAME);
    const key = crypto.createHash("sha256").update(String(session.email).toLowerCase()).digest("hex");

    if (request.method === "GET") {
      const { state } = await readState(store, key);
      return jsonResponse(200, state);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      throw apiError("Invalid request body.");
    }
    const state = await mutateState(store, key, body);
    return jsonResponse(200, state);
  } catch (error) {
    console.error("Transaction sync failed", {
      name: error?.name || "Error",
      statusCode: error?.statusCode,
      message: error?.message || "Unknown sync error",
    });
    return jsonResponse(error?.statusCode || 500, {
      error: error?.statusCode ? error.message : "Cloud synchronization is temporarily unavailable.",
    });
  }
}
