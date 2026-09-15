export const CATEGORIES = [
  "Food",
  "Fuel",
  "Income",
  "Travel",
  "Bills",
  "Shopping",
  "Health",
  "Entertainment",
  "Salary",
  "Other",
];

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export function todayString() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function calculateSummary(transactions) {
  return transactions.reduce(
    (summary, tx) => {
      if (tx.type === "income") summary.income += tx.amount;
      else summary.expenses += tx.amount;
      summary.balance = summary.income - summary.expenses;
      return summary;
    },
    { income: 0, expenses: 0, balance: 0 }
  );
}

export function categoryBreakdown(transactions) {
  const totals = {};

  for (const tx of transactions) {
    if (tx.type !== "expense") continue;
    totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
  }

  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
