import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, freshState } from "../netlify/functions/transactions.js";

const income = {
  id: "income-1",
  type: "income",
  amount: 100,
  category: "Salary",
  date: "2026-09-17",
  createdAt: 1,
};

test("migration converts legacy mobile dates and lets deleted records win", () => {
  const expense = { ...income, id: "expense-1", type: "expense", amount: 20, date: "16-09-2026" };
  const result = applyAction(freshState(), {
    action: "migrate",
    transactions: [income, expense],
    deletedTransactions: [{ ...expense, deletedAt: Date.now() }],
  });

  assert.equal(result.initialized, true);
  assert.deepEqual(result.transactions.map((item) => item.id), ["income-1"]);
  assert.deepEqual(result.deletedTransactions.map((item) => item.id), ["expense-1"]);
  assert.equal(result.deletedTransactions[0].date, "2026-09-16");
});

test("adding an expense cannot make the account balance negative", () => {
  const state = { ...freshState(), initialized: true, transactions: [income] };
  assert.throws(
    () => applyAction(state, {
      action: "add",
      transaction: { ...income, id: "expense-1", type: "expense", amount: 100.01 },
    }),
    /balance negative/,
  );
});

test("deleting income cannot leave existing expenses unsupported", () => {
  const expense = { ...income, id: "expense-1", type: "expense", amount: 75 };
  const state = { ...freshState(), initialized: true, transactions: [income, expense] };
  assert.throws(() => applyAction(state, { action: "delete", id: income.id }), /balance negative/);
});

test("add, delete, and restore preserve the transaction", () => {
  let state = applyAction(freshState(), { action: "add", transaction: income });
  state = applyAction(state, { action: "delete", id: income.id });
  assert.equal(state.transactions.length, 0);
  assert.equal(state.deletedTransactions.length, 1);

  state = applyAction(state, { action: "restore", id: income.id });
  assert.deepEqual(state.transactions[0], income);
  assert.equal(state.deletedTransactions.length, 0);
});

test("custom expense categories are normalized and deduplicated", () => {
  let state = applyAction(freshState(), { action: "addExpenseCategory", category: "  Pet   Care  " });
  state = applyAction(state, { action: "addExpenseCategory", category: "pet care" });
  state = applyAction(state, { action: "addExpenseCategory", category: "Food" });

  assert.deepEqual(state.customExpenseCategories, ["Pet Care"]);
});

test("migration merges custom expense categories across devices", () => {
  const state = {
    ...freshState(),
    initialized: true,
    customExpenseCategories: ["Pets"],
  };
  const result = applyAction(state, {
    action: "migrate",
    transactions: [],
    deletedTransactions: [],
    customExpenseCategories: ["Home Maintenance", "pets"],
  });

  assert.deepEqual(result.customExpenseCategories, ["Pets", "Home Maintenance"]);
});

test("removing a custom expense category keeps existing transactions", () => {
  const expense = { ...income, id: "expense-1", type: "expense", amount: 25, category: "Pet Care" };
  let state = {
    ...freshState(),
    initialized: true,
    transactions: [income, expense],
    customExpenseCategories: ["Pet Care", "Home Maintenance"],
  };

  state = applyAction(state, { action: "removeExpenseCategory", category: "pet care" });

  assert.deepEqual(state.customExpenseCategories, ["Home Maintenance"]);
  assert.equal(state.transactions.find((item) => item.id === expense.id)?.category, "Pet Care");
});
