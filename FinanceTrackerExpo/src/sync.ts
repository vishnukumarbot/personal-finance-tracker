import { API_BASE_URL } from "./config";

export type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: string;
  createdAt?: number;
  deletedAt?: number;
};

export type CloudState = {
  initialized: boolean;
  transactions: Transaction[];
  deletedTransactions: Transaction[];
  revision: number;
  updatedAt: number;
};

async function callCloud(token: string, method = "GET", body?: object): Promise<CloudState> {
  if (!token) throw new Error("Your session has expired. Please log in again.");
  const response = await fetch(`${API_BASE_URL}/api/transactions`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || "Could not synchronize your transactions.");
  return data as CloudState;
}

export function getCloudState(token: string) {
  return callCloud(token);
}

export function changeCloudState(token: string, action: string, payload: object = {}) {
  return callCloud(token, "POST", { action, ...payload });
}
