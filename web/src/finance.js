export const CATEGORY_OPTIONS = Object.freeze({
  income: ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other"],
  expense: [
    "Food",
    "Transport",
    "Bills",
    "Shopping",
    "Health",
    "Entertainment",
    "Travel",
    "Education",
    "Other",
  ],
});

// Includes legacy categories so older saved transactions remain filterable.
export const CATEGORIES = [
  ...new Set([
    ...CATEGORY_OPTIONS.expense,
    ...CATEGORY_OPTIONS.income,
    "Fuel",
    "Income",
  ]),
].sort((a, b) => a.localeCompare(b));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (!ISO_DATE.test(value || "")) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toCents(value) {
  return Math.round(Number(value) * 100);
}

function fromCents(value) {
  return value / 100;
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function formatDate(value) {
  if (!isValidDate(value)) return value || "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function todayString() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function calculateSummary(transactions) {
  const totals = transactions.reduce(
    (summary, transaction) => {
      const amount = toCents(transaction.amount);
      if (transaction.type === "income") summary.income += amount;
      if (transaction.type === "expense") summary.expenses += amount;
      return summary;
    },
    { income: 0, expenses: 0 },
  );

  return {
    income: fromCents(totals.income),
    expenses: fromCents(totals.expenses),
    balance: fromCents(totals.income - totals.expenses),
  };
}

export function categoryBreakdown(transactions) {
  const totals = new Map();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") continue;
    const current = totals.get(transaction.category) || 0;
    totals.set(transaction.category, current + toCents(transaction.amount));
  }

  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount: fromCents(amount) }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
}

export function filterTransactions(transactions, filters) {
  return transactions
    .filter((transaction) => {
      if (filters.type !== "all" && transaction.type !== filters.type) return false;
      if (filters.category !== "all" && transaction.category !== filters.category) return false;
      if (filters.from && transaction.date < filters.from) return false;
      if (filters.to && transaction.date > filters.to) return false;
      return true;
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || Number(b.createdAt || 0) - Number(a.createdAt || 0),
    );
}

export function transactionValidationError({ type, amount, category, date }, balance) {
  const numericAmount = Number(amount);
  const cents = toCents(numericAmount);

  if (type !== "income" && type !== "expense") return "Choose income or expense.";
  if (amount === "" || !Number.isFinite(numericAmount) || numericAmount <= 0 || cents <= 0) {
    return "Amount must be a positive number.";
  }
  if (!Number.isSafeInteger(cents)) return "That amount is too large to save safely.";
  if (!String(category || "").trim()) return "Please select a category.";
  if (!isValidDate(date)) return "Please select a valid date.";
  if (type === "expense" && cents > toCents(balance)) {
    return `This expense is greater than your available balance of ${formatCurrency(balance)}.`;
  }

  return "";
}
