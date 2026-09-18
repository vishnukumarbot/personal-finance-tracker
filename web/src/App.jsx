import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { clearSession, getSession } from "./auth";
import {
  calculateSummary,
  categoryBreakdown,
  filterTransactions,
} from "./finance";
import {
  loadDeletedTransactions,
  hasCloudMigration,
  loadTransactions,
  markCloudMigration,
  saveDeletedTransactions,
  saveTransactions,
} from "./storage";
import { changeCloudState, getCloudState } from "./sync";
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
  const [syncStatus, setSyncStatus] = useState(session ? "syncing" : "idle");
  const [syncError, setSyncError] = useState("");
  const revisionRef = useRef(-1);
  const mutationRef = useRef(false);

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

  const applyCloudState = useCallback((cloud) => {
    if (!Array.isArray(cloud?.transactions) || !Array.isArray(cloud?.deletedTransactions)) return;
    const revision = Number(cloud.revision) || 0;
    if (revision < revisionRef.current) return;
    revisionRef.current = revision;
    dispatch({ type: "replace", transactions: cloud.transactions });
    setDeletedTransactions(cloud.deletedTransactions);
  }, []);

  useEffect(() => {
    if (!session?.email || !session?.token) return undefined;
    let cancelled = false;

    async function synchronize(showProgress = true) {
      if (mutationRef.current) return;
      mutationRef.current = true;
      if (showProgress) setSyncStatus("syncing");
      try {
        let cloud = await getCloudState(session);
        if (!hasCloudMigration(session.email) || !cloud.initialized) {
          cloud = await changeCloudState(session, "migrate", {
            transactions: loadTransactions(session.email),
            deletedTransactions: loadDeletedTransactions(session.email),
          });
          markCloudMigration(session.email);
        }
        if (cancelled) return;
        applyCloudState(cloud);
        setSyncError("");
        setSyncStatus("synced");
      } catch (error) {
        if (cancelled) return;
        setSyncError(error.message || "Could not synchronize your transactions.");
        setSyncStatus("offline");
      } finally {
        mutationRef.current = false;
      }
    }

    synchronize();
    const interval = window.setInterval(() => synchronize(false), 30_000);
    const onFocus = () => synchronize(false);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [applyCloudState, session]);

  const handleLogin = useCallback((nextSession) => {
    revisionRef.current = -1;
    setSession(nextSession);
    dispatch({ type: "replace", transactions: loadTransactions(nextSession.email) });
    setDeletedTransactions(loadDeletedTransactions(nextSession.email));
    setFilters(INITIAL_FILTERS);
    setFeedback(null);
    setSyncError("");
    setSyncStatus("syncing");
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setFeedback(null);
    setSyncError("");
    setSyncStatus("idle");
  }, []);

  const runCloudAction = useCallback(async (action, payload, successMessage) => {
    if (mutationRef.current) {
      setFeedback({ type: "error", message: "Please wait for the current change to finish syncing." });
      return false;
    }
    mutationRef.current = true;
    setSyncStatus("syncing");
    try {
      const cloud = await changeCloudState(session, action, payload);
      applyCloudState(cloud);
      setSyncError("");
      setSyncStatus("synced");
      setFeedback({ type: "success", message: successMessage });
      return true;
    } catch (error) {
      setSyncError(error.message || "Could not synchronize your change.");
      setSyncStatus("offline");
      setFeedback({ type: "error", message: error.message || "Could not save your change." });
      return false;
    } finally {
      mutationRef.current = false;
    }
  }, [applyCloudState, session]);

  const addTransaction = useCallback(
    (transaction) => runCloudAction("add", { transaction }, "Transaction added and synced."),
    [runCloudAction],
  );

  const deleteTransaction = useCallback((id) => {
    runCloudAction("delete", { id }, "Transaction moved to recently deleted.");
  }, [runCloudAction]);

  const restoreTransaction = useCallback((id) => {
    runCloudAction("restore", { id }, "Transaction restored and synced.");
  }, [runCloudAction]);

  const permanentlyDelete = useCallback((id) => {
    runCloudAction("permanentDelete", { id }, "Transaction permanently deleted.");
  }, [runCloudAction]);

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
          <div className="local-badge"><span /> {
            syncStatus === "syncing" ? "Syncing..." : syncStatus === "offline" ? "Offline cache" : "Synced across devices"
          }</div>
        </section>

        {storageError && (
          <div className="notice error" role="alert">
            Browser cache is unavailable, but saved cloud data is still protected.
          </div>
        )}
        {syncError && (
          <div className="notice error" role="alert">
            Cloud sync is unavailable: {syncError} Your last synchronized data is still shown.
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
                <p>Your signed-in account keeps transactions synchronized across your web and Android devices.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>

      <footer>Ledger · A simple personal finance tracker</footer>
    </main>
  );
}
