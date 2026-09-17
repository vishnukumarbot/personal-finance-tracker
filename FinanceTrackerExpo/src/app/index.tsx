import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { clearSession, getSession, requestOtp, verifyOtp } from "../auth";
import { loadDeletedTransactions, loadTransactions, saveDeletedTransactions, saveTransactions } from "../storage";

type TransactionType = "income" | "expense";
type FilterType = "all" | TransactionType;
type FilterDateTarget = "from" | "to" | null;
type Session = { email: string };
type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string;
  deletedAt?: number;
};

const CATEGORIES = ["Food", "Fuel", "Income", "Travel", "Bills", "Shopping", "Health", "Entertainment", "Salary", "Other"];

function formatDate(date: Date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function dateFromStored(value: string) {
  const [day, month, year] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return day && month && year && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
}

function dateTimestamp(value: string) {
  if (!value) return null;
  const date = dateFromStored(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await requestOtp(email);
      setSent(true);
    } catch (requestError: any) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError("");
    setBusy(true);
    try {
      onLogin(await verifyOtp(email, code));
    } catch (verificationError: any) {
      setError(verificationError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.authPage}>
      <View style={styles.authCard}>
        <Text style={styles.eyebrow}>PERSONAL FINANCE</Text>
        <Text style={styles.authTitle}>Finance Tracker</Text>
        <Text style={styles.authSubtitle}>Secure email OTP login</Text>
        {!sent ? (
          <>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
            />
            <Pressable style={styles.addButton} onPress={send} disabled={busy}>
              <Text style={styles.addButtonText}>{busy ? "Sending..." : "Send Email Code"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>OTP</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
              placeholder="Enter OTP"
              maxLength={10}
            />
            <Text style={styles.authHint}>Code sent to {email}</Text>
            <Pressable style={styles.addButton} onPress={verify} disabled={busy}>
              <Text style={styles.addButtonText}>{busy ? "Verifying..." : "Verify & Login"}</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => { setSent(false); setCode(""); setError(""); }}>
              <Text>Use a different email</Text>
            </Pressable>
          </>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [deletedTransactions, setDeletedTransactions] = useState<Transaction[]>([]);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(formatDate(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterDateTarget, setFilterDateTarget] = useState<FilterDateTarget>(null);
  const [showFilterCategories, setShowFilterCategories] = useState(false);

  useEffect(() => {
    getSession().then((storedSession) => {
      setSession(storedSession);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (session?.email) {
      loadTransactions(session.email).then(setTransactions);
      loadDeletedTransactions(session.email).then(setDeletedTransactions);
    }
  }, [session?.email]);

  useEffect(() => {
    if (session?.email) {
      saveTransactions(session.email, transactions).catch(() => Alert.alert("Storage error", "Could not save transactions on this device."));
    }
  }, [transactions, session?.email]);

  useEffect(() => {
    if (session?.email) {
      saveDeletedTransactions(session.email, deletedTransactions).catch(() => Alert.alert("Storage error", "Could not save recently deleted transactions."));
    }
  }, [deletedTransactions, session?.email]);

  const totalIncome = useMemo(
    () => transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions],
  );
  const totalExpenses = useMemo(
    () => transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + transaction.amount, 0),
    [transactions],
  );
  const balance = totalIncome - totalExpenses;
  const fromTimestamp = dateTimestamp(filterFrom);
  const toTimestamp = dateTimestamp(filterTo);
  const invalidDateRange = fromTimestamp !== null && toTimestamp !== null && fromTimestamp > toTimestamp;
  const filteredTransactions = useMemo(() => {
    if (invalidDateRange) return [];
    return transactions.filter((transaction) => {
      if (filterType !== "all" && transaction.type !== filterType) return false;
      if (filterCategory !== "all" && transaction.category !== filterCategory) return false;
      const transactionTimestamp = dateTimestamp(transaction.date);
      if (fromTimestamp !== null && (transactionTimestamp === null || transactionTimestamp < fromTimestamp)) return false;
      if (toTimestamp !== null && (transactionTimestamp === null || transactionTimestamp > toTimestamp)) return false;
      return true;
    });
  }, [filterCategory, filterType, fromTimestamp, invalidDateRange, toTimestamp, transactions]);

  if (!ready) return <View style={styles.authPage}><Text>Loading...</Text></View>;
  if (!session) return <LoginScreen onLogin={setSession} />;

  function addTransaction() {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return Alert.alert("Invalid amount", "Please enter a positive amount.");
    }
    if (type === "expense" && numericAmount > balance) {
      return Alert.alert("Insufficient balance", "This expense cannot be greater than your current balance.");
    }
    setTransactions((current) => [
      { id: Date.now().toString(), type, amount: numericAmount, category, date },
      ...current,
    ]);
    setAmount("");
    Alert.alert("Success", "Transaction added successfully.");
  }

  async function logout() {
    await clearSession();
    setSession(null);
  }

  function deleteTransaction(id: string) {
    const transaction = transactions.find((item) => item.id === id);
    if (!transaction) return;
    setTransactions((current) => current.filter((item) => item.id !== id));
    setDeletedTransactions((current) => [
      { ...transaction, deletedAt: Date.now() },
      ...current.filter((item) => item.id !== id),
    ]);
  }

  function restoreTransaction(id: string) {
    const transaction = deletedTransactions.find((item) => item.id === id);
    if (!transaction) return;
    const { deletedAt: _deletedAt, ...restored } = transaction;
    setTransactions((current) => [restored, ...current]);
    setDeletedTransactions((current) => current.filter((item) => item.id !== id));
  }

  function permanentlyDelete(id: string) {
    setDeletedTransactions((current) => current.filter((item) => item.id !== id));
  }

  function clearFilters() {
    setFilterType("all");
    setFilterCategory("all");
    setFilterFrom("");
    setFilterTo("");
  }

  const filterPickerValue = filterDateTarget === "from" && filterFrom
    ? dateFromStored(filterFrom)
    : filterDateTarget === "to" && filterTo
      ? dateFromStored(filterTo)
      : new Date();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Personal Finance Tracker</Text>
          <Text style={styles.subtitle}>{session.email}</Text>
        </View>
        <Pressable onPress={logout}><Text style={styles.logout}>Log out</Text></Pressable>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.cardTitle}>Remaining Balance</Text>
        <Text style={styles.balance}>${balance.toFixed(2)}</Text>
      </View>
      <View style={styles.row}>
        <View style={styles.smallCard}>
          <Text style={styles.cardTitle}>Total Income</Text>
          <Text style={styles.income}>${totalIncome.toFixed(2)}</Text>
        </View>
        <View style={styles.smallCard}>
          <Text style={styles.cardTitle}>Total Expenses</Text>
          <Text style={styles.expense}>${totalExpenses.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Add Transaction</Text>
        <Text style={styles.label}>Transaction Type</Text>
        <View style={styles.typeRow}>
          <Pressable style={[styles.typeButton, type === "income" && styles.selectedButton]} onPress={() => setType("income")}>
            <Text style={type === "income" ? styles.selectedButtonText : styles.typeButtonText}>Income</Text>
          </Pressable>
          <Pressable style={[styles.typeButton, type === "expense" && styles.selectedButton]} onPress={() => setType("expense")}>
            <Text style={type === "expense" ? styles.selectedButtonText : styles.typeButtonText}>Expense</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="Enter amount" />
        <Text style={styles.label}>Category</Text>
        <Pressable style={styles.input} onPress={() => setShowCategories(true)}><Text>{category}</Text></Pressable>
        <Text style={styles.label}>Date</Text>
        <Pressable style={styles.input} onPress={() => setShowDate(true)}><Text>{date}</Text></Pressable>
        <Pressable style={styles.addButton} onPress={addTransaction}><Text style={styles.addButtonText}>Add Transaction</Text></Pressable>
      </View>

      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <Pressable onPress={clearFilters}><Text style={styles.clearFilters}>Clear</Text></Pressable>
        </View>
        <Text style={styles.label}>Type</Text>
        <View style={styles.filterTypeRow}>
          {(["all", "income", "expense"] as FilterType[]).map((value) => (
            <Pressable
              key={value}
              style={[styles.typeButton, filterType === value && styles.selectedButton]}
              onPress={() => setFilterType(value)}
            >
              <Text style={filterType === value ? styles.selectedButtonText : styles.typeButtonText}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Category</Text>
        <Pressable style={styles.input} onPress={() => setShowFilterCategories(true)}>
          <Text>{filterCategory === "all" ? "All categories" : filterCategory}</Text>
        </Pressable>
        <Text style={styles.label}>Date range</Text>
        <View style={styles.dateFilterRow}>
          <View style={styles.dateFilterColumn}>
            <Text style={styles.dateFilterLabel}>From</Text>
            <Pressable style={styles.dateFilterButton} onPress={() => setFilterDateTarget("from")}>
              <Text>{filterFrom || "Any date"}</Text>
            </Pressable>
          </View>
          <View style={styles.dateFilterColumn}>
            <Text style={styles.dateFilterLabel}>To</Text>
            <Pressable style={styles.dateFilterButton} onPress={() => setFilterDateTarget("to")}>
              <Text>{filterTo || "Any date"}</Text>
            </Pressable>
          </View>
        </View>
        {invalidDateRange && <Text style={styles.filterError}>The From date must be before or equal to the To date.</Text>}
        <Text style={styles.resultCount}>{filteredTransactions.length} of {transactions.length} transactions shown</Text>
      </View>

      <View style={styles.transactionsCard}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        {filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>{transactions.length === 0 ? "No transactions yet." : "No transactions match these filters."}</Text>
        ) : filteredTransactions.map((transaction) => (
          <View key={transaction.id} style={styles.transaction}>
            <View>
              <Text style={styles.transactionCategory}>{transaction.category}</Text>
              <Text style={styles.transactionDate}>{transaction.date} | {transaction.type}</Text>
            </View>
            <View style={styles.transactionRight}>
              <Text style={transaction.type === "income" ? styles.transactionIncome : styles.transactionExpense}>
                {transaction.type === "income" ? "+" : "-"}${transaction.amount.toFixed(2)}
              </Text>
              <Pressable style={styles.deleteButton} onPress={() => deleteTransaction(transaction.id)}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.transactionsCard}>
        <Text style={styles.sectionTitle}>Recently Deleted</Text>
        <Text style={styles.emptyText}>Deleted transactions are kept for 30 days.</Text>
        {deletedTransactions.length === 0 ? (
          <Text style={styles.emptyText}>No recently deleted transactions.</Text>
        ) : deletedTransactions.map((transaction) => (
          <View key={transaction.id} style={styles.transaction}>
            <View>
              <Text style={styles.transactionCategory}>{transaction.category}</Text>
              <Text style={styles.transactionDate}>{transaction.date} | {transaction.type}</Text>
            </View>
            <View style={styles.transactionRight}>
              <Text style={transaction.type === "income" ? styles.transactionIncome : styles.transactionExpense}>
                {transaction.type === "income" ? "+" : "-"}${transaction.amount.toFixed(2)}
              </Text>
              <Pressable style={styles.restoreButton} onPress={() => restoreTransaction(transaction.id)}>
                <Text style={styles.restoreButtonText}>Restore</Text>
              </Pressable>
              <Pressable style={styles.deleteButton} onPress={() => permanentlyDelete(transaction.id)}>
                <Text style={styles.deleteButtonText}>Delete permanently</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Modal transparent visible={showCategories} animationType="slide" onRequestClose={() => setShowCategories(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Select Category</Text>
            {CATEGORIES.map((value) => (
              <Pressable key={value} style={styles.option} onPress={() => { setCategory(value); setShowCategories(false); }}>
                <Text style={styles.optionText}>{value}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.secondaryButton} onPress={() => setShowCategories(false)}><Text>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showFilterCategories} animationType="slide" onRequestClose={() => setShowFilterCategories(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Filter by Category</Text>
            {["all", ...CATEGORIES].map((value) => (
              <Pressable key={value} style={styles.option} onPress={() => { setFilterCategory(value); setShowFilterCategories(false); }}>
                <Text style={styles.optionText}>{value === "all" ? "All categories" : value}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.secondaryButton} onPress={() => setShowFilterCategories(false)}><Text>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      {showDate && (
        <DateTimePicker
          value={dateFromStored(date)}
          mode="date"
          display="calendar"
          onChange={(_, selected) => {
            setShowDate(false);
            if (selected) setDate(formatDate(selected));
          }}
        />
      )}
      {filterDateTarget && (
        <DateTimePicker
          value={filterPickerValue}
          mode="date"
          display="calendar"
          onChange={(_, selected) => {
            const target = filterDateTarget;
            setFilterDateTarget(null);
            if (!selected) return;
            if (target === "from") setFilterFrom(formatDate(selected));
            if (target === "to") setFilterTo(formatDate(selected));
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 55, backgroundColor: "#f5f5f5" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 27, fontWeight: "bold", marginBottom: 6 },
  subtitle: { fontSize: 12, color: "#666" },
  logout: { fontWeight: "700", padding: 8 },
  balanceCard: { backgroundColor: "#fff", padding: 24, borderRadius: 12, marginBottom: 12 },
  smallCard: { flex: 1, backgroundColor: "#fff", padding: 18, borderRadius: 12 },
  row: { flexDirection: "row", gap: 12, marginBottom: 16 },
  cardTitle: { fontSize: 14, color: "#666", marginBottom: 8 },
  balance: { fontSize: 32, fontWeight: "bold" },
  income: { fontSize: 21, fontWeight: "bold", color: "#138a52" },
  expense: { fontSize: 21, fontWeight: "bold", color: "#d44747" },
  formCard: { backgroundColor: "#fff", padding: 20, borderRadius: 12, marginBottom: 16 },
  filterCard: { backgroundColor: "#fff", padding: 20, borderRadius: 12, marginBottom: 16 },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  clearFilters: { color: "#174f38", fontWeight: "700", paddingVertical: 4 },
  sectionTitle: { fontSize: 21, fontWeight: "bold", marginBottom: 18 },
  label: { fontSize: 15, fontWeight: "600", marginBottom: 7 },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 18 },
  filterTypeRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  typeButton: { flex: 1, padding: 12, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, alignItems: "center" },
  selectedButton: { backgroundColor: "#222" },
  typeButtonText: { fontWeight: "600" },
  selectedButtonText: { fontWeight: "600", color: "#fff" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 16, backgroundColor: "#fff" },
  addButton: { backgroundColor: "#222", padding: 15, borderRadius: 8, alignItems: "center", marginTop: 4 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  dateFilterRow: { flexDirection: "row", gap: 10 },
  dateFilterColumn: { flex: 1 },
  dateFilterLabel: { color: "#666", fontSize: 12, marginBottom: 5 },
  dateFilterButton: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, backgroundColor: "#fff" },
  filterError: { color: "#b33d3d", backgroundColor: "#fff0f0", padding: 10, borderRadius: 8, marginTop: 10 },
  resultCount: { color: "#666", fontSize: 12, marginTop: 12 },
  transactionsCard: { backgroundColor: "#fff", padding: 20, borderRadius: 12, marginBottom: 30 },
  emptyText: { color: "#777" },
  transaction: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  transactionCategory: { fontSize: 16, fontWeight: "600" },
  transactionDate: { color: "#777", marginTop: 4 },
  transactionIncome: { fontWeight: "bold", fontSize: 16, color: "#138a52" },
  transactionExpense: { fontWeight: "bold", fontSize: 16, color: "#d44747" },
  transactionRight: { alignItems: "flex-end", gap: 6 },
  deleteButton: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: "#ffecec" },
  deleteButtonText: { fontSize: 12, fontWeight: "700", color: "#b33d3d" },
  restoreButton: { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, backgroundColor: "#eaf7ef" },
  restoreButtonText: { fontSize: 12, fontWeight: "700", color: "#138a52" },
  authPage: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#f5f5f5" },
  authCard: { backgroundColor: "#fff", padding: 24, borderRadius: 16 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2 },
  authTitle: { fontSize: 30, fontWeight: "bold", marginTop: 8 },
  authSubtitle: { color: "#666", marginBottom: 22 },
  authHint: { color: "#666", marginBottom: 12 },
  error: { color: "#b33d3d", backgroundColor: "#fff0f0", padding: 10, borderRadius: 8, marginTop: 12 },
  linkButton: { alignItems: "center", padding: 14 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.35)" },
  modalCard: { backgroundColor: "#fff", padding: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85%" },
  option: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#eee" },
  optionText: { fontSize: 17 },
  secondaryButton: { padding: 15, alignItems: "center", marginTop: 8, backgroundColor: "#eef1f6", borderRadius: 8 },
});
