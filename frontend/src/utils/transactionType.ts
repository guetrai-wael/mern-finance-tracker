/* Transaction type helpers.
 *
 * These exist because the codebase was written when there were exactly two
 * types, so several render paths are shaped as `if (income) ... else ...` and
 * silently treat anything that is not income as an expense. Adding transfers
 * makes that wrong: a transfer would show as a red outgoing expense and, in
 * ReportsPage, be summed into the spending total.
 *
 * Route every type decision through here rather than comparing strings inline,
 * so a fourth type later cannot reintroduce the same bug.
 */
import type { Transaction } from "../types";

export type TransactionKind = "income" | "expense" | "transfer";

const kindOf = (t: Pick<Transaction, "type">): TransactionKind =>
  t.type as TransactionKind;

export const isIncome = (t: Pick<Transaction, "type">) => kindOf(t) === "income";
export const isExpense = (t: Pick<Transaction, "type">) => kindOf(t) === "expense";
export const isTransfer = (t: Pick<Transaction, "type">) => kindOf(t) === "transfer";

/** Money the user actually earned. Excludes transfers. */
export const sumIncome = (transactions: Transaction[]) =>
  transactions.filter(isIncome).reduce((sum, t) => sum + t.amount, 0);

/** Money the user actually spent. Excludes transfers between their own accounts. */
export const sumExpenses = (transactions: Transaction[]) =>
  transactions.filter(isExpense).reduce((sum, t) => sum + t.amount, 0);

/** The sign shown next to an amount. A transfer is neither a gain nor a loss. */
export const amountPrefix = (t: Pick<Transaction, "type">): string => {
  if (isIncome(t)) return "+";
  if (isExpense(t)) return "-";
  return "";
};

/** Tailwind text colour for an amount. */
export const amountColor = (t: Pick<Transaction, "type">): string => {
  if (isIncome(t)) return "text-emerald-600";
  if (isTransfer(t)) return "text-blue-600";
  return "text-slate-900";
};

/** Tailwind classes for a type badge or icon chip. */
export const typeChipColor = (t: Pick<Transaction, "type">): string => {
  if (isIncome(t)) return "bg-emerald-100 text-emerald-600";
  if (isTransfer(t)) return "bg-blue-100 text-blue-600";
  return "bg-red-100 text-red-600";
};

export const typeLabel = (t: Pick<Transaction, "type">): string => {
  if (isIncome(t)) return "Income";
  if (isTransfer(t)) return "Transfer";
  return "Expense";
};
