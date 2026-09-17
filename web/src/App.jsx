import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { clearSession, getSession } from "./auth";
import {
  calculateSummary,
  categoryBreakdown,
  filterTransactions,
  formatCurrency,
} from "./finance";
import {
  loadDeletedTransactions,
  loadTransactions,
  saveDeletedTransactions,
  saveTransactions,
} from "./storage";
import Login from "./components/Login";
import TransactionForm from "./components/TransactionForm";
import {
  CategoryBreakdown,
  Filters,
  RecentlyDeleted,
  Summary,
  TransactionList,
} from "./components/Dashboard";

const INITIAL_FILTERS = { type: "all", category: "all", from: "", to: "" };

function transactionReducer(state, action) {
  switch (action.type) {
    case "add":
      return [action.transaction, ...state];
    case "delete":
      return state.filter((transaction) => transaction.id !== action.id);
    case "replace":
      return action.transactions || [];
    default:
      return state;
  }
}

export default function App() {
  const [session, setSession] = useState(getSession);
  const [transactions, dispatch] = useReducer(
    transactionReducer,
    [],
    () => loadTransactions(session?.email),
  );
  const [deletedTransactions, setDeletedTransactions] = useState(
    () => loadDeletedTransactions(session?.email),
  );
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [feedback, setFeedback] = useState(null);
  const [transactionStorageError, setTransactionStorageError] = useState(false);
  const [deletedStorageError, setDeletedStorageError] = useState(false);

  // These hooks intentionally run before the signed-out return to keep hook order stable after login.
  const summary = useMemo(() => calculateSummary(transactions), [transactions]);
  const breakdown = useMemo(() => categoryBreakdown(transactions), [transactions]);
  const filteredTransactions = useMemo(
    () => filterTransactions(transactions, filters),
    [transactions, filters],
  );

  useEffect(() => {
    if (!session?.email) return;
    setTransactionStorageError(!saveTransactions(session.email, transactions));
  }, [transactions, session?.email]);

  useEffect(() => {
    if (!session?.email) return;
    setDeletedStorageError(!saveDeletedTransactions(session.email, deletedTransactions));
  }, [deletedTransactions, session?.email]);

  const handleLogin = useCallback((nextSession) => {
    setSession(nextSession);
    dispatch({ type: "replace", transactions: loadTransactions(nextSession.email) });
    setDeletedTransactions(loadDeletedTransactions(nextSession.email));
    setFilters(INITIAL_FILTERS);
    setFeedback(null);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setFeedback(null);
  }, []);

  const addTransaction = useCallback((transaction) => {
    dispatch({ type: "add", transaction });
    setFeedback({ type: "success", message: "Transaction added." });
  }, []);

  const deleteTransaction = useCallback((id) => {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return;

    const remaining = transactions.filter((item) => item.id !== id);
    if (calculateSummary(remaining).balance < 0) {
      setFeedback({
        type: "error",
        message: "That income cannot be deleted because it would make your balance negative.",
      });
      return;
    }

    dispatch({ type: "delete", id });
    setDeletedTransactions((items) => [
      { ...transaction, deletedAt: Date.now() },
      ...items.filter((item) => item.id !== id),
    ]);
    setFeedback({ type: "success", message: "Transaction moved to recently deleted." });
  }, [transactions]);

  const restoreTransaction = useCallback((id) => {
    const transaction = deletedTransactions.find((item) => item.id === id);
    if (!transaction) return;

    const { deletedAt: _deletedAt, ...restored } = transaction;
    if (calculateSummary([...transactions, restored]).balance < 0) {
      setFeedback({
        type: "error",
        message: `Add enough income before restoring this ${formatCurrency(restored.amount)} expense.`,
      });
      return;
    }

    dispatch({ type: "add", transaction: restored });
    setDeletedTransactions((items) => items.filter((item) => item.id !== id));
    setFeedback({ type: "success", message: "Transaction restored." });
  }, [deletedTransactions, transactions]);

  const permanentlyDelete = useCallback((id) => {
    setDeletedTransactions((items) => items.filter((item) => item.id !== id));
    setFeedback({ type: "success", message: "Transaction permanently deleted." });
  }, []);

  if (!session) return <Login onLogin={handleLogin} />;

  const storageError = transactionStorageError || deletedStorageError;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Ledger home">
          <div className="brand-mark compact" aria-hidden="true"><span /><span /><span /></div>
          <span>Ledger</span>
        </a>
        <div className="account-menu">
          <div className="account-copy">
            <strong>{session.email.split("@")[0]}</strong>
            <span>{session.email}</span>
          </div>
          <button className="avatar-button" type="button" onClick={handleLogout} title="Log out">
            {session.email.slice(0, 1).toUpperCase()}
            <span className="sr-only">Log out</span>
          </button>
        </div>
      </header>

      <div className="page" id="top">
        <section className="hero">
          <div>
            <span className="eyebrow">FINANCIAL OVERVIEW</span>
            <h1>Your money, made clear.</h1>
            <p>Track every dollar and build better habits—one transaction at a time.</p>
          </div>
          <div className="local-badge"><span /> Saved on this device</div>
        </section>

        {storageError && (
          <div className="notice error" role="alert">
            Browser storage is unavailable. New changes may be lost when you close this page.
          </div>
        )}
        {feedback && (
          <div className={`notice ${feedback.type}`} role={feedback.type === "error" ? "alert" : "status"}>
            <span>{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Dismiss message">×</button>
          </div>
        )}

        <Summary summary={summary} />

        <div className="dashboard-grid">
          <div className="main-column">
            <TransactionForm balance={summary.balance} onAdd={addTransaction} />
            <Filters
              filters={filters}
              setFilters={setFilters}
              resultCount={filteredTransactions.length}
            />
            <TransactionList transactions={filteredTransactions} onDelete={deleteTransaction} />
            <RecentlyDeleted
              items={deletedTransactions}
              onRestore={restoreTransaction}
              onRemove={permanentlyDelete}
            />
          </div>

          <aside className="side-column">
            <CategoryBreakdown breakdown={breakdown} />
            <section className="privacy-card">
              <span aria-hidden="true">⌁</span>
              <div>
                <strong>Private by default</strong>
                <p>Your transactions are stored locally in this browser, not in a shared database.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <footer>Ledger · A simple personal finance tracker</footer>
    </main>
  );
}
