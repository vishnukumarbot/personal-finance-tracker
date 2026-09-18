import React, { memo, useMemo, useState } from "react";
import {
  CATEGORY_OPTIONS,
  formatCurrency,
  todayString,
  transactionValidationError,
} from "../finance";

function createId() {
  return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function TransactionForm({ balance, expenseCategories, onAdd, onAddExpenseCategory }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS.expense[0]);
  const [date, setDate] = useState(todayString());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);
  const categories = useMemo(
    () => (type === "expense" ? expenseCategories : CATEGORY_OPTIONS.income),
    [expenseCategories, type],
  );

  function changeType(nextType) {
    setType(nextType);
    setCategory(CATEGORY_OPTIONS[nextType][0]);
    setError("");
    setCategoryError("");
    setShowCustomCategory(false);
  }

  async function addCustomCategory() {
    const normalized = customCategory.trim().replace(/\s+/g, " ");
    if (!normalized) {
      setCategoryError("Enter a category name.");
      return;
    }
    if (normalized.length > 40) {
      setCategoryError("Category names can contain up to 40 characters.");
      return;
    }

    setSavingCategory(true);
    setCategoryError("");
    try {
      const savedCategory = await onAddExpenseCategory(normalized);
      if (savedCategory) {
        setCategory(savedCategory);
        setCustomCategory("");
        setShowCustomCategory(false);
      }
    } finally {
      setSavingCategory(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    const validationError = transactionValidationError(
      { type, amount, category, date },
      balance,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      const saved = await onAdd({
        id: createId(),
        type,
        amount: Math.round(Number(amount) * 100) / 100,
        category,
        date,
        createdAt: Date.now(),
      });
      if (saved) {
        setAmount("");
        setError("");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card transaction-form" onSubmit={submit} noValidate>
      <div className="card-heading">
        <div>
          <span className="section-kicker">QUICK ENTRY</span>
          <h2>Add transaction</h2>
          <p>Record money in or money out.</p>
        </div>
        <span className="balance-pill">Available {formatCurrency(balance)}</span>
      </div>

      <div className="type-switch" aria-label="Transaction type">
        {[
          ["expense", "Expense"],
          ["income", "Income"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={type === value ? "active" : ""}
            aria-pressed={type === value}
            onClick={() => changeType(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label>
          Amount
          <div className="amount-input">
            <span>$</span>
            <input
              inputMode="decimal"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              aria-describedby={error ? "transaction-error" : undefined}
              required
            />
          </div>
        </label>

        <div className="category-control">
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {type === "expense" && !showCustomCategory && (
            <button
              className="custom-category-toggle"
              type="button"
              onClick={() => setShowCustomCategory(true)}
            >
              + Add custom category
            </button>
          )}
        </div>

        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
      </div>

      {type === "expense" && showCustomCategory && (
        <div className="custom-category-editor">
          <input
            type="text"
            value={customCategory}
            onChange={(event) => setCustomCategory(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addCustomCategory();
              }
            }}
            placeholder="Example: Pet care"
            maxLength="40"
            aria-label="New expense category name"
            autoFocus
          />
          <button className="small-button save-category-button" type="button" onClick={addCustomCategory} disabled={savingCategory}>
            {savingCategory ? "Saving..." : "Add category"}
          </button>
          <button
            className="text-button cancel-category-button"
            type="button"
            onClick={() => { setShowCustomCategory(false); setCustomCategory(""); setCategoryError(""); }}
          >
            Cancel
          </button>
        </div>
      )}

      {categoryError && <div className="error category-error" role="alert">{categoryError}</div>}

      {error && <div className="error" id="transaction-error" role="alert">{error}</div>}

      <button className="primary add-button" type="submit" disabled={saving}>
        <span aria-hidden="true">+</span> {saving ? "Saving..." : `Add ${type}`}
      </button>
    </form>
  );
}

export default memo(TransactionForm);
