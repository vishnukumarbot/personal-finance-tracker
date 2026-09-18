import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { clearSession, getSession, requestOtp, verifyOtp } from "../auth";
import {
  hasCloudMigration,
  loadCustomExpenseCategories,
  loadDeletedTransactions,
  loadTransactions,
  markCloudMigration,
  saveCustomExpenseCategories,
  saveDeletedTransactions,
  saveTransactions,
} from "../storage";
import { changeCloudState, CloudState, getCloudState, Transaction } from "../sync";

type TransactionType = "income" | "expense";
type FilterType = "all" | TransactionType;
type FilterDateTarget = "from" | "to" | null;
type Session = { email: string; token: string };

const EXPENSE_CATEGORIES = ["Food", "Fuel", "Transport", "Bills", "Shopping", "Health", "Entertainment", "Travel", "Education", "Other"];
const INCOME_CATEGORIES = ["Salary", "Freelance", "Investment", "Gift", "Refund", "Other"];
const DEMO_PASSWORD = "Cursor@123";

function uniqueCategories(...groups: string[][]) {
  const categories: string[] = [];
  const seen = new Set<string>();
  for (const category of groups.flat()) {
    const normalized = String(category || "").trim();
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    categories.push(normalized);
  }
  return categories;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromStored(value: string) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const legacyMatch = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  const year = Number(isoMatch?.[1] || legacyMatch?.[3]);
  const month = Number(isoMatch?.[2] || legacyMatch?.[2]);
  const day = Number(isoMatch?.[3] || legacyMatch?.[1]);
  const parsed = new Date(year, month - 1, day);
  return day && month && year && parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day
    ? parsed
    : new Date();
}

function displayDate(value: string) {
  const date = dateFromStored(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getFullYear()}`;
}

function dateTimestamp(value: string) {
  if (!value) return null;
  const date = dateFromStored(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function LoginScreen({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    if (password !== DEMO_PASSWORD) {
      setError("Incorrect password.");
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
        <Text style={styles.authSubtitle}>Password and email OTP login</Text>
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
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter password"
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
            <Pressable style={styles.linkButton} onPress={() => { setSent(false); setCode(""); setPassword(""); setError(""); }}>
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
  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>([]);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [showDate, setShowDate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterDateTarget, setFilterDateTarget] = useState<FilterDateTarget>(null);
  const [showFilterCategories, setShowFilterCategories] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "offline">("idle");
  const [syncError, setSyncError] = useState("");
  const revisionRef = useRef(-1);
  const mutationRef = useRef(false);

  useEffect(() => {
    getSession().then((storedSession) => {
      setSession(storedSession);
      setReady(true);
    });
  }, []);

  const applyCloudState = useCallback((cloud: CloudState) => {
    if (!Array.isArray(cloud?.transactions) || !Array.isArray(cloud?.deletedTransactions)) return;
    const revision = Number(cloud.revision) || 0;
    if (revision < revisionRef.current) return;
    revisionRef.current = revision;
    setTransactions(cloud.transactions);
    setDeletedTransactions(cloud.deletedTransactions);
    const cloudCategories = Array.isArray(cloud.customExpenseCategories) ? cloud.customExpenseCategories : [];
    setCustomExpenseCategories(cloudCategories);
    if (session?.email) {
      Promise.all([
        saveTransactions(session.email, cloud.transactions),
        saveDeletedTransactions(session.email, cloud.deletedTransactions),
        saveCustomExpenseCategories(session.email, cloudCategories),
      ]).catch(() => setSyncError("Cloud data is safe, but this device could not update its offline cache."));
    }
  }, [session?.email]);

  const synchronize = useCallback(async (showProgress = true) => {
    if (!session?.email || !session.token || mutationRef.current) return;
    mutationRef.current = true;
    if (showProgress) setSyncStatus("syncing");
    try {
      let cloud = await getCloudState(session.token);
      const migrated = await hasCloudMigration(session.email);
      if (!migrated || !cloud.initialized) {
        const [localTransactions, localDeleted, localCategories] = await Promise.all([
          loadTransactions(session.email),
          loadDeletedTransactions(session.email),
          loadCustomExpenseCategories(session.email),
        ]);
        cloud = await changeCloudState(session.token, "migrate", {
          transactions: localTransactions,
          deletedTransactions: localDeleted,
          customExpenseCategories: localCategories,
        });
        await markCloudMigration(session.email);
      }
      applyCloudState(cloud);
      setSyncError("");
      setSyncStatus("synced");
    } catch (error: any) {
      setSyncError(error.message || "Could not synchronize your transactions.");
      setSyncStatus("offline");
    } finally {
      mutationRef.current = false;
    }
  }, [applyCloudState, session]);

  useEffect(() => {
    if (!session?.email) return;
    let active = true;
    Promise.all([
      loadTransactions(session.email),
      loadDeletedTransactions(session.email),
      loadCustomExpenseCategories(session.email),
    ]).then(async ([saved, deleted, categories]) => {
      if (!active) return;
      setTransactions(saved);
      setDeletedTransactions(deleted);
      setCustomExpenseCategories(categories);
      await synchronize();
    });
    return () => { active = false; };
  }, [session?.email, synchronize]);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => synchronize(false), 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") synchronize(false);
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [session, synchronize]);

  const expenseCategories = useMemo(
    () => uniqueCategories(EXPENSE_CATEGORIES, customExpenseCategories),
    [customExpenseCategories],
  );
  const categoryOptions = type === "expense" ? expenseCategories : INCOME_CATEGORIES;
  const filterCategories = useMemo(
    () => uniqueCategories(
      EXPENSE_CATEGORIES,
      INCOME_CATEGORIES,
      customExpenseCategories,
      transactions.map((transaction) => transaction.category),
    ).sort((a, b) => a.localeCompare(b)),
    [customExpenseCategories, transactions],
  );
  const categoryBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== "expense") continue;
      totals.set(transaction.category, (totals.get(transaction.category) || 0) + transaction.amount);
    }
    return [...totals.entries()]
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [transactions]);

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

  async function runCloudAction(action: string, payload: object, successMessage?: string) {
    if (!session?.token) return false;
    if (mutationRef.current) {
      Alert.alert("Please wait", "The current change is still syncing.");
      return false;
    }
    mutationRef.current = true;
    setSyncStatus("syncing");
    try {
      const cloud = await changeCloudState(session.token, action, payload);
      applyCloudState(cloud);
      setSyncError("");
      setSyncStatus("synced");
      if (successMessage) Alert.alert("Success", successMessage);
      return cloud;
    } catch (error: any) {
      const message = error.message || "Could not save your change.";
      setSyncError(message);
      setSyncStatus("offline");
      Alert.alert("Could not sync", message);
      return false;
    } finally {
      mutationRef.current = false;
    }
  }

  function changeTransactionType(nextType: TransactionType) {
    setType(nextType);
    setCategory(nextType === "expense" ? expenseCategories[0] : INCOME_CATEGORIES[0]);
  }

  async function addCustomExpenseCategory() {
    const normalized = customCategoryName.trim().replace(/\s+/g, " ");
    if (!normalized) {
      Alert.alert("Category required", "Enter a category name.");
      return;
    }
    if (normalized.length > 40) {
      Alert.alert("Category too long", "Category names can contain up to 40 characters.");
      return;
    }

    const existing = expenseCategories.find(
      (item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    );
    if (existing) {
      setCategory(existing);
      setCustomCategoryName("");
      setShowCategories(false);
      return;
    }

    const cloud = await runCloudAction(
      "addExpenseCategory",
      { category: normalized },
      "Expense category added and synced.",
    );
    if (!cloud) return;
    const savedCategory = uniqueCategories(EXPENSE_CATEGORIES, cloud.customExpenseCategories).find(
      (item) => item.toLocaleLowerCase() === normalized.toLocaleLowerCase(),
    ) || normalized;
    setCategory(savedCategory);
    setCustomCategoryName("");
    setShowCategories(false);
  }

  async function removeCustomExpenseCategory(value: string) {
    const cloud = await runCloudAction(
      "removeExpenseCategory",
      { category: value },
      "Expense category removed from every device.",
    );
    if (cloud && category.toLocaleLowerCase() === value.toLocaleLowerCase()) {
      setCategory(EXPENSE_CATEGORIES[0]);
    }
  }

  function confirmRemoveCustomExpenseCategory(value: string) {
    Alert.alert(
      "Remove custom category?",
      `Remove "${value}" from every device? Existing transactions will stay unchanged.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => { void removeCustomExpenseCategory(value); } },
      ],
    );
  }

  async function addTransaction() {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return Alert.alert("Invalid amount", "Please enter a positive amount.");
    }
    if (type === "expense" && numericAmount > balance) {
      return Alert.alert("Insufficient balance", "This expense cannot be greater than your current balance.");
    }
    const saved = await runCloudAction("add", {
      transaction: {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        amount: Math.round(numericAmount * 100) / 100,
        category,
        date,
        createdAt: Date.now(),
      },
    }, "Transaction added and synced.");
    if (saved) setAmount("");
  }

  async function logout() {
    await clearSession();
    revisionRef.current = -1;
    setTransactions([]);
    setDeletedTransactions([]);
    setCustomExpenseCategories([]);
    setSyncError("");
    setSyncStatus("idle");
    setSession(null);
  }

  async function deleteTransaction(id: string) {
    await runCloudAction("delete", { id });
  }

  async function restoreTransaction(id: string) {
    await runCloudAction("restore", { id }, "Transaction restored and synced.");
  }

  async function permanentlyDelete(id: string) {
    await runCloudAction("permanentDelete", { id });
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
          <Text style={syncStatus === "offline" ? styles.syncError : styles.syncStatus}>
            {syncStatus === "syncing" ? "Syncing..." : syncStatus === "offline" ? "Offline cache" : "Synced across devices"}
          </Text>
        </View>
        <Pressable onPress={logout}><Text style={styles.logout}>Log out</Text></Pressable>
      </View>

      {!!syncError && <Text style={styles.syncNotice}>Cloud sync: {syncError}</Text>}

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
          <Pressable style={[styles.typeButton, type === "income" && styles.selectedButton]} onPress={() => changeTransactionType("income")}>
            <Text style={type === "income" ? styles.selectedButtonText : styles.typeButtonText}>Income</Text>
          </Pressable>
          <Pressable style={[styles.typeButton, type === "expense" && styles.selectedButton]} onPress={() => changeTransactionType("expense")}>
            <Text style={type === "expense" ? styles.selectedButtonText : styles.typeButtonText}>Expense</Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Amount</Text>
        <TextInput style={styles.input} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} placeholder="Enter amount" />
        <Text style={styles.label}>Category</Text>
        <Pressable style={styles.input} onPress={() => setShowCategories(true)}><Text>{category}</Text></Pressable>
        <Text style={styles.label}>Date</Text>
        <Pressable style={styles.input} onPress={() => setShowDate(true)}><Text>{displayDate(date)}</Text></Pressable>
        <Pressable style={styles.addButton} onPress={addTransaction} disabled={syncStatus === "syncing"}>
          <Text style={styles.addButtonText}>{syncStatus === "syncing" ? "Syncing..." : "Add Transaction"}</Text>
        </Pressable>
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
              <Text>{filterFrom ? displayDate(filterFrom) : "Any date"}</Text>
            </Pressable>
          </View>
          <View style={styles.dateFilterColumn}>
            <Text style={styles.dateFilterLabel}>To</Text>
            <Pressable style={styles.dateFilterButton} onPress={() => setFilterDateTarget("to")}>
              <Text>{filterTo ? displayDate(filterTo) : "Any date"}</Text>
            </Pressable>
          </View>
        </View>
        {invalidDateRange && <Text style={styles.filterError}>The From date must be before or equal to the To date.</Text>}
        <Text style={styles.resultCount}>{filteredTransactions.length} of {transactions.length} transactions shown</Text>
      </View>

      <View style={styles.transactionsCard}>
        <Text style={styles.sectionTitle}>Expense by Category</Text>
        {categoryBreakdown.length === 0 ? (
          <Text style={styles.emptyText}>Expense categories will appear here.</Text>
        ) : categoryBreakdown.map((item) => (
          <View key={item.name} style={styles.breakdownRow}>
            <Text style={styles.transactionCategory}>{item.name}</Text>
            <Text style={styles.breakdownAmount}>${item.total.toFixed(2)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.transactionsCard}>
        <Text style={styles.sectionTitle}>Transactions</Text>
        {filteredTransactions.length === 0 ? (
          <Text style={styles.emptyText}>{transactions.length === 0 ? "No transactions yet." : "No transactions match these filters."}</Text>
        ) : filteredTransactions.map((transaction) => (
          <View key={transaction.id} style={styles.transaction}>
            <View>
              <Text style={styles.transactionCategory}>{transaction.category}</Text>
              <Text style={styles.transactionDate}>{displayDate(transaction.date)} | {transaction.type}</Text>
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
              <Text style={styles.transactionDate}>{displayDate(transaction.date)} | {transaction.type}</Text>
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
            <ScrollView keyboardShouldPersistTaps="handled">
              {categoryOptions.map((value) => {
                const custom = customExpenseCategories.some(
                  (item) => item.toLocaleLowerCase() === value.toLocaleLowerCase(),
                );
                if (!custom) {
                  return (
                    <Pressable key={value} style={styles.option} onPress={() => { setCategory(value); setShowCategories(false); }}>
                      <Text style={styles.optionText}>{value}</Text>
                    </Pressable>
                  );
                }
                return (
                  <View key={value} style={styles.categoryOptionRow}>
                    <Pressable style={styles.categoryOptionSelect} onPress={() => { setCategory(value); setShowCategories(false); }}>
                      <Text style={styles.optionText}>{value}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.categoryRemoveButton}
                      onPress={() => confirmRemoveCustomExpenseCategory(value)}
                      disabled={syncStatus === "syncing"}
                    >
                      <Text style={styles.categoryRemoveButtonText}>Remove</Text>
                    </Pressable>
                  </View>
                );
              })}
              {type === "expense" && (
                <View style={styles.customCategoryEditor}>
                  <Text style={styles.label}>Add a custom expense category</Text>
                  <View style={styles.customCategoryRow}>
                    <TextInput
                      style={styles.customCategoryInput}
                      value={customCategoryName}
                      onChangeText={setCustomCategoryName}
                      placeholder="Example: Pet care"
                      maxLength={40}
                      returnKeyType="done"
                      onSubmitEditing={addCustomExpenseCategory}
                    />
                    <Pressable style={styles.customCategoryButton} onPress={addCustomExpenseCategory} disabled={syncStatus === "syncing"}>
                      <Text style={styles.customCategoryButtonText}>{syncStatus === "syncing" ? "Saving..." : "Add"}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.categoryHint}>Saved to this account and available on all signed-in devices.</Text>
                </View>
              )}
            </ScrollView>
            <Pressable style={styles.secondaryButton} onPress={() => setShowCategories(false)}><Text>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showFilterCategories} animationType="slide" onRequestClose={() => setShowFilterCategories(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.sectionTitle}>Filter by Category</Text>
            <ScrollView>
              {["all", ...filterCategories].map((value) => (
                <Pressable key={value} style={styles.option} onPress={() => { setFilterCategory(value); setShowFilterCategories(false); }}>
                  <Text style={styles.optionText}>{value === "all" ? "All categories" : value}</Text>
                </Pressable>
              ))}
            </ScrollView>
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
            if (selected) setDate(toIsoDate(selected));
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
            if (target === "from") setFilterFrom(toIsoDate(selected));
            if (target === "to") setFilterTo(toIsoDate(selected));
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
  syncStatus: { fontSize: 12, color: "#138a52", marginTop: 4 },
  syncError: { fontSize: 12, color: "#b33d3d", marginTop: 4 },
  syncNotice: { color: "#8a3333", backgroundColor: "#fff0f0", padding: 12, borderRadius: 8, marginBottom: 12 },
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
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  breakdownAmount: { color: "#d44747", fontSize: 16, fontWeight: "700" },
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
  categoryOptionRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#eee" },
  categoryOptionSelect: { flex: 1, paddingVertical: 15 },
  categoryRemoveButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 7, backgroundColor: "#ffecec" },
  categoryRemoveButtonText: { color: "#b33d3d", fontSize: 12, fontWeight: "700" },
  customCategoryEditor: { paddingTop: 18 },
  customCategoryRow: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  customCategoryInput: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: "#fff" },
  customCategoryButton: { minWidth: 72, justifyContent: "center", alignItems: "center", borderRadius: 8, paddingHorizontal: 12, backgroundColor: "#222" },
  customCategoryButtonText: { color: "#fff", fontWeight: "700" },
  categoryHint: { color: "#666", fontSize: 12, lineHeight: 17, marginTop: 8 },
  secondaryButton: { padding: 15, alignItems: "center", marginTop: 8, backgroundColor: "#eef1f6", borderRadius: 8 },
});
