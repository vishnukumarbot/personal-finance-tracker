import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_OPTIONS,
  calculateSummary,
  categoryBreakdown,
  filterTransactions,
  transactionValidationError,
} from "./finance.js";

test("expense categories include Fuel", () => {
  assert.ok(CATEGORY_OPTIONS.expense.includes("Fuel"));
});

const transactions = [
  { id: "1", type: "income", amount: 1200.1, category: "Salary", date: "2026-09-01", createdAt: 1 },
  { id: "2", type: "expense", amount: 19.99, category: "Food", date: "2026-09-03", createdAt: 2 },
  { id: "3", type: "expense", amount: 30.01, category: "Food", date: "2026-09-04", createdAt: 3 },
  { id: "4", type: "expense", amount: 100, category: "Bills", date: "2026-08-20", createdAt: 4 },
];

test("calculateSummary uses cent-safe totals", () => {
  assert.deepEqual(calculateSummary(transactions), {
    income: 1200.1,
    expenses: 150,
    balance: 1050.1,
  });
});

test("categoryBreakdown totals expenses and sorts largest first", () => {
  assert.deepEqual(categoryBreakdown(transactions), [
    { category: "Bills", amount: 100 },
    { category: "Food", amount: 50 },
  ]);
});

test("filterTransactions combines filters and returns newest first", () => {
  const result = filterTransactions(transactions, {
    type: "expense",
    category: "Food",
    from: "2026-09-01",
    to: "2026-09-30",
  });

  assert.deepEqual(result.map((transaction) => transaction.id), ["3", "2"]);
});

test("transaction validation rejects zero, bad dates, and overspending", () => {
  assert.match(
    transactionValidationError(
      { type: "expense", amount: "0", category: "Food", date: "2026-09-10" },
      100,
    ),
    /positive/,
  );
  assert.match(
    transactionValidationError(
      { type: "expense", amount: "10", category: "Food", date: "2026-02-31" },
      100,
    ),
    /valid date/,
  );
  assert.match(
    transactionValidationError(
      { type: "expense", amount: "100.01", category: "Food", date: "2026-09-10" },
      100,
    ),
    /available balance/,
  );
  assert.equal(
    transactionValidationError(
      { type: "expense", amount: "100", category: "Food", date: "2026-09-10" },
      100,
    ),
    "",
  );
});
