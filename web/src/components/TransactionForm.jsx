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

function TransactionForm({ balance, onAdd }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS.expense[0]);
  const [date, setDate] = useState(todayString());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const categories = useMemo(() => CATEGORY_OPTIONS[type], [type]);

  function changeType(nextType) {
    setType(nextType);
    setCategory(CATEGORY_OPTIONS[nextType][0]);
    setError("");
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

        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

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

      {error && <div className="error" id="transaction-error" role="alert">{error}</div>}

      <button className="primary add-button" type="submit" disabled={saving}>
        <span aria-hidden="true">+</span> {saving ? "Saving..." : `Add ${type}`}
      </button>
    </form>
  );
}

export default memo(TransactionForm);
