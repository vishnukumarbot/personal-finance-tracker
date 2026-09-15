import React from "react";
import { useEffect, useMemo, useReducer, useState } from "react";
import { CATEGORIES, calculateSummary, categoryBreakdown, formatCurrency, todayString } from "./finance";
import { loadTransactions, saveTransactions, loadDeletedTransactions, saveDeletedTransactions } from "./storage";
import { clearSession, getSession, requestOtp, verifyOtp } from "./auth";

const initialFilters = {
  type: "all",
  category: "all",
  from: "",
  to: ""
};

function reducer(state, action) {
  switch (action.type) {
    case "add":
      return [action.transaction, ...state];

    case "delete":
      return state.filter((tx) => tx.id !== action.id);
    case "replace":
      return action.transactions || [];

    default:
      return state;
  }
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await requestOtp(email); setSent(true); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  async function submitCode(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try { const session = await verifyOtp(email, code); onLogin(session); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <span className="eyebrow">PERSONAL FINANCE</span><h1>Finance Tracker</h1>
    <p>Sign in securely with a one-time code sent to your email.</p>
    {!sent ? <form onSubmit={sendCode} className="auth-form">
      <label>Email<input type="email" required value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" /></label>
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "Sending..." : "Send OTP"}</button>
    </form> : <form onSubmit={submitCode} className="auth-form">
      <label>One-time password<input inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e)=>setCode(e.target.value.replace(/\D/g, ""))} placeholder="Enter OTP" /></label>
      <p className="auth-hint">Code sent to {email}</p>
      {error && <div className="error">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "Verifying..." : "Verify & Login"}</button>
      <button type="button" className="secondary" onClick={()=>setSent(false)}>Change email</button>
    </form>}
  </section></main>;
}

function TransactionForm({ transactions, onAdd }) {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(todayString());
  const [error, setError] = useState("");

  const balance = useMemo(() => calculateSummary(transactions).balance, [transactions]);

  function submit(event) {
    event.preventDefault();
    setError("");

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("Amount must be a positive number.");
      return;
    }

    if (!category) {
      setError("Please select a category.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (type === "expense" && numericAmount > balance) {
      setError(
        `This expense is greater than the available balance of ${formatCurrency(balance)}.`
      );
      return;
    }

    onAdd({
      id: crypto.randomUUID(),
      type,
      amount: Math.round(numericAmount * 100) / 100,
      category,
      date,
      createdAt: Date.now()
    });

    setAmount("");
  }

  return (
    <form className="card form" onSubmit={submit}>
      <div className="card-heading">
        <div>
          <h2>Add transaction</h2>
          <p>Record income or an expense.</p>
        </div>
      </div>

      <label>
        Type
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>

      <label>
        Amount
        <input
          inputMode="decimal"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />
      </label>

      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>

      {error && <div className="error">{error}</div>}

      <button className="primary" type="submit">
        Add transaction
      </button>
    </form>
  );
}

function Summary({ summary }) {
  return (
    <section className="summary-grid">
      <div className="summary-card income">
        <span>Total Income</span>
        <strong>{formatCurrency(summary.income)}</strong>
      </div>
      <div className="summary-card expense">
        <span>Total Expenses</span>
        <strong>{formatCurrency(summary.expenses)}</strong>
      </div>
      <div className="summary-card balance">
        <span>Remaining Balance</span>
        <strong>{formatCurrency(summary.balance)}</strong>
      </div>
    </section>
  );
}

function Filters({ filters, setFilters }) {
  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="card filters">
      <div className="card-heading">
        <div>
          <h2>Filters</h2>
          <p>Refine the transaction list.</p>
        </div>
        <button
          className="secondary"
          type="button"
          onClick={() => setFilters(initialFilters)}
        >
          Clear
        </button>
      </div>

      <div className="filter-grid">
        <label>
          Type
          <select value={filters.type} onChange={(e) => update("type", e.target.value)}>
            <option value="all">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label>
          Category
          <select
            value={filters.category}
            onChange={(e) => update("category", e.target.value)}
          >
            <option value="all">All</option>
            {CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(e) => update("from", e.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            value={filters.to}
            onChange={(e) => update("to", e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}

function RecentlyDeleted({ items, onRestore, onPermanentDelete }) {
  return <div className="card">
    <div className="card-heading"><div><h2>Recently Deleted</h2><p>Deleted transactions are kept for 30 days.</p></div></div>
    {items.length === 0 ? <div className="empty">No recently deleted transactions.</div> : <div className="transaction-list">{items.map((tx) => <div className="transaction" key={tx.id}>
      <div><strong>{tx.category}</strong><span>{tx.date} · {tx.type}</span></div>
      <div className="transaction-right"><strong className={tx.type === "income" ? "positive" : "negative"}>{tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}</strong><button className="secondary" type="button" onClick={() => onRestore(tx.id)}>Restore</button><button className="delete" type="button" onClick={() => onPermanentDelete(tx.id)}>Delete permanently</button></div>
    </div>)}</div>}
  </div>;
}

function TransactionList({ transactions, onDelete }) {
  return (
    <div className="card">
      <div className="card-heading">
        <div>
          <h2>Transactions</h2>
          <p>{transactions.length} transaction(s)</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty">No transactions match the current filters.</div>
      ) : (
        <div className="transaction-list">
          {transactions.map((tx) => (
            <div className="transaction" key={tx.id}>
              <div>
                <strong>{tx.category}</strong>
                <span>{tx.date} · {tx.type}</span>
              </div>
              <div className="transaction-right">
                <strong className={tx.type === "income" ? "positive" : "negative"}>
                  {tx.type === "income" ? "+" : "-"}{formatCurrency(tx.amount)}
                </strong>
                <button
                  className="delete"
                  type="button"
                  onClick={() => onDelete(tx.id)}
                  aria-label={`Delete ${tx.category} transaction`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryBreakdown({ breakdown }) {
  const max = breakdown[0]?.amount || 1;

  return (
    <div className="card">
      <div className="card-heading">
        <div>
          <h2>Category Breakdown</h2>
          <p>Total spending by expense category.</p>
        </div>
      </div>

      {breakdown.length === 0 ? (
        <div className="empty">No expense data yet.</div>
      ) : (
        <div className="breakdown">
          {breakdown.map((item) => (
            <div className="breakdown-row" key={item.category}>
              <div className="breakdown-label">
                <span>{item.category}</span>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
              <div className="bar">
                <div style={{ width: `${(item.amount / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(getSession);
  const [transactions, dispatch] = useReducer(reducer, [], () => loadTransactions(session?.email));
  const [filters, setFilters] = useState(initialFilters);
  const [storageError, setStorageError] = useState("");
  const [deletedTransactions, setDeletedTransactions] = useState(() => loadDeletedTransactions(session?.email));

  useEffect(() => {
    if (!session?.email) return;
    if (!saveTransactions(session.email, transactions)) setStorageError("Could not save data to browser storage.");
    else setStorageError("");
  }, [transactions, session?.email]);

  useEffect(() => {
    if (session?.email) saveDeletedTransactions(session.email, deletedTransactions);
  }, [deletedTransactions, session?.email]);

  if (!session) return <Login onLogin={(next) => { setSession(next); dispatch({ type: "replace", transactions: loadTransactions(next.email) }); setDeletedTransactions(loadDeletedTransactions(next.email)); }} />;

  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const breakdown = useMemo(() => categoryBreakdown(transactions), [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.type !== "all" && tx.type !== filters.type) return false;
      if (filters.category !== "all" && tx.category !== filters.category) return false;
      if (filters.from && tx.date < filters.from) return false;
      if (filters.to && tx.date > filters.to) return false;
      return true;
    });
  }, [transactions, filters]);

  function deleteTransaction(id) {
    const tx = transactions.find((item) => item.id === id);
    if (!tx) return;
    dispatch({ type: "delete", id });
    setDeletedTransactions((items) => [{ ...tx, deletedAt: Date.now() }, ...items.filter((item) => item.id !== id)]);
  }

  function restoreTransaction(id) {
    const tx = deletedTransactions.find((item) => item.id === id);
    if (!tx) return;
    const { deletedAt, ...restored } = tx;
    dispatch({ type: "add", transaction: restored });
    setDeletedTransactions((items) => items.filter((item) => item.id !== id));
  }

  function permanentlyDelete(id) {
    setDeletedTransactions((items) => items.filter((item) => item.id !== id));
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <span className="eyebrow">PERSONAL FINANCE</span>
          <h1>Finance Tracker</h1>
          <p>Track your money with a simple, focused dashboard.</p>
          <small>Signed in as {session.email}</small>
        </div>
        <button className="secondary" type="button" onClick={() => { clearSession(); setSession(null); }}>Log out</button>
      </header>

      {storageError && <div className="error global">{storageError}</div>}

      <Summary summary={summary} />

      <div className="layout">
        <div className="left-column">
          <TransactionForm
            transactions={transactions}
            onAdd={(transaction) => dispatch({ type: "add", transaction })}
          />
          <Filters filters={filters} setFilters={setFilters} />
          <TransactionList
            transactions={filteredTransactions}
            onDelete={deleteTransaction}
          />
          <RecentlyDeleted items={deletedTransactions} onRestore={restoreTransaction} onPermanentDelete={permanentlyDelete} />
        </div>

        <aside className="right-column">
          <CategoryBreakdown breakdown={breakdown} />
        </aside>
      </div>
    </main>
  );
}
