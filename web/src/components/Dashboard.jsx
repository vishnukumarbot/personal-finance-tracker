import { memo } from "react";
import { CATEGORIES, formatCurrency, formatDate } from "../finance";

const SUMMARY_ITEMS = [
  { key: "income", label: "Total income", symbol: "↗" },
  { key: "expenses", label: "Total expenses", symbol: "↘" },
  { key: "balance", label: "Remaining balance", symbol: "=" },
];

export const Summary = memo(function Summary({ summary }) {
  return (
    <section className="summary-grid" aria-label="Account summary">
      {SUMMARY_ITEMS.map((item) => (
        <article className={`summary-card ${item.key}`} key={item.key}>
          <div className="summary-label">
            <span className="summary-icon" aria-hidden="true">{item.symbol}</span>
            <span>{item.label}</span>
          </div>
          <strong>{formatCurrency(summary[item.key])}</strong>
          <small>{item.key === "balance" ? "Ready to spend" : "All-time total"}</small>
        </article>
      ))}
    </section>
  );
});

export const Filters = memo(function Filters({ filters, setFilters, resultCount }) {
  const hasFilters = Object.values(filters).some((value) => value && value !== "all");
  const invalidRange = filters.from && filters.to && filters.from > filters.to;

  function update(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="card filters" aria-labelledby="filter-title">
      <div className="card-heading compact-heading">
        <div>
          <span className="section-kicker">FIND &amp; SORT</span>
          <h2 id="filter-title">Filter transactions</h2>
        </div>
        <div className="filter-meta">
          <span>{resultCount} found</span>
          <button
            className="text-button"
            type="button"
            disabled={!hasFilters}
            onClick={() => setFilters({ type: "all", category: "all", from: "", to: "" })}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="filter-grid">
        <label>
          Type
          <select value={filters.type} onChange={(event) => update("type", event.target.value)}>
            <option value="all">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </label>

        <label>
          Category
          <select
            value={filters.category}
            onChange={(event) => update("category", event.target.value)}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>

        <label>
          From
          <input
            type="date"
            value={filters.from}
            onChange={(event) => update("from", event.target.value)}
          />
        </label>

        <label>
          To
          <input
            type="date"
            min={filters.from || undefined}
            value={filters.to}
            onChange={(event) => update("to", event.target.value)}
          />
        </label>
      </div>

      {invalidRange && <div className="error" role="alert">The end date must be after the start date.</div>}
    </section>
  );
});

function TransactionRow({ transaction, action }) {
  const income = transaction.type === "income";
  return (
    <li className="transaction">
      <div className={`transaction-icon ${transaction.type}`} aria-hidden="true">
        {income ? "↗" : "↘"}
      </div>
      <div className="transaction-detail">
        <strong>{transaction.category}</strong>
        <span>{formatDate(transaction.date)} · {income ? "Income" : "Expense"}</span>
      </div>
      <strong className={`transaction-amount ${income ? "positive" : "negative"}`}>
        {income ? "+" : "−"}{formatCurrency(transaction.amount)}
      </strong>
      {action}
    </li>
  );
}

export const TransactionList = memo(function TransactionList({ transactions, onDelete }) {
  return (
    <section className="card transaction-card" aria-labelledby="transactions-title">
      <div className="card-heading">
        <div>
          <span className="section-kicker">ACTIVITY</span>
          <h2 id="transactions-title">Transactions</h2>
          <p>Newest transactions appear first.</p>
        </div>
        <span className="count-badge">{transactions.length}</span>
      </div>

      {transactions.length === 0 ? (
        <div className="empty">
          <span aria-hidden="true">◎</span>
          <strong>No transactions found</strong>
          <p>Add your first transaction or adjust the filters.</p>
        </div>
      ) : (
        <ul className="transaction-list">
          {transactions.map((transaction) => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              action={(
                <button
                  className="icon-button delete-button"
                  type="button"
                  onClick={() => onDelete(transaction.id)}
                  aria-label={`Delete ${transaction.category} transaction`}
                  title="Move to recently deleted"
                >
                  ×
                </button>
              )}
            />
          ))}
        </ul>
      )}
    </section>
  );
});

export const CategoryBreakdown = memo(function CategoryBreakdown({ breakdown }) {
  const total = breakdown.reduce((sum, item) => sum + item.amount, 0);

  return (
    <section className="card breakdown-card" aria-labelledby="breakdown-title">
      <div className="card-heading">
        <div>
          <span className="section-kicker">SPENDING</span>
          <h2 id="breakdown-title">By category</h2>
          <p>Where your expenses go.</p>
        </div>
      </div>

      {breakdown.length === 0 ? (
        <div className="empty small-empty">
          <span aria-hidden="true">◔</span>
          <strong>No spending yet</strong>
          <p>Expense categories will show up here.</p>
        </div>
      ) : (
        <div className="breakdown">
          {breakdown.map((item, index) => {
            const percentage = total ? (item.amount / total) * 100 : 0;
            return (
              <div className="breakdown-row" key={item.category}>
                <div className="breakdown-label">
                  <span><i style={{ "--dot-index": index }} />{item.category}</span>
                  <strong>{formatCurrency(item.amount)}</strong>
                </div>
                <div className="bar" aria-label={`${item.category}: ${percentage.toFixed(0)}%`}>
                  <div style={{ width: `${percentage}%`, "--bar-index": index }} />
                </div>
                <small>{percentage.toFixed(0)}% of spending</small>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
});

export const RecentlyDeleted = memo(function RecentlyDeleted({ items, onRestore, onRemove }) {
  if (items.length === 0) return null;

  return (
    <details className="card deleted-card">
      <summary>
        <span>
          <strong>Recently deleted</strong>
          <small>Kept for 30 days</small>
        </span>
        <span className="count-badge">{items.length}</span>
      </summary>
      <ul className="transaction-list deleted-list">
        {items.map((transaction) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            action={(
              <div className="row-actions">
                <button className="small-button" type="button" onClick={() => onRestore(transaction.id)}>
                  Restore
                </button>
                <button
                  className="icon-button delete-button"
                  type="button"
                  onClick={() => onRemove(transaction.id)}
                  aria-label={`Permanently delete ${transaction.category} transaction`}
                  title="Delete permanently"
                >
                  ×
                </button>
              </div>
            )}
          />
        ))}
      </ul>
    </details>
  );
});
