// Heuristic insight engine for the dashboard.
//
// Pure functions, no React, no API calls. Each rule reads the dashboard state
// the useDashboardData hook already returns and emits zero or more `Insight`
// objects. The dashboard renders the highest-priority ones in an InsightStrip.
//
// Design intent: the dashboard's #1 user complaint is "not clear" — users see
// numbers but don't know if they're good, bad, or normal. These insights say
// it in plain language.

import type {
  DashboardStats,
  CategoryDelta,
  PeriodDeltas,
} from "../hooks/useDashboard";
import type { Budget, Transaction } from "../types";

export type InsightTone = "positive" | "warning" | "critical" | "neutral";

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: string; // emoji — keeps it dependency-free + scannable
  message: string;
  // Used to sort: lower = more important
  priority: number;
  // Optional deep-link, e.g. /transactions, /budgets, /goals
  href?: string;
}

const MATERIAL_CATEGORY_CHANGE_PCT = 15;
const MATERIAL_CATEGORY_MIN_AMOUNT = 30; // ignore noise on tiny categories
const BUDGET_WARNING_PCT = 90;
const SAVINGS_GOOD_PCT = 10;
const QUIET_DAYS = 7;

interface InsightInputs {
  stats: DashboardStats;
  deltas: PeriodDeltas;
  categoryDeltas: CategoryDelta[];
  budget: { budget: Budget | null } | undefined;
  transactions: Transaction[];
}

export function computeInsights(inputs: InsightInputs): Insight[] {
  const { stats, deltas, categoryDeltas, budget, transactions } = inputs;
  const out: Insight[] = [];

  // --- Brand-new user with no data ---
  if ((!transactions || transactions.length === 0) && stats.totalIncome === 0 && stats.totalExpenses === 0) {
    out.push({
      id: "onboard-first-transaction",
      tone: "neutral",
      icon: "👋",
      message:
        "Welcome — log your first transaction to start seeing insights here.",
      priority: 0,
      href: "/transactions",
    });
    return out;
  }

  // --- Material category spend increase vs 3-month avg ---
  categoryDeltas
    .filter(
      (d) =>
        d.percentChange >= MATERIAL_CATEGORY_CHANGE_PCT &&
        d.currentMonth >= MATERIAL_CATEGORY_MIN_AMOUNT &&
        d.threeMonthAvg > 0
    )
    .sort((a, b) => b.percentChange - a.percentChange)
    .slice(0, 2)
    .forEach((d) => {
      out.push({
        id: `cat-up-${d.name}`,
        tone: "warning",
        icon: "🔺",
        message: `${d.name} up ${Math.round(d.percentChange)}% vs your 3-month average`,
        priority: 20,
        href: "/transactions",
      });
    });

  // --- Material category spend decrease ---
  categoryDeltas
    .filter(
      (d) =>
        d.percentChange <= -MATERIAL_CATEGORY_CHANGE_PCT &&
        d.threeMonthAvg >= MATERIAL_CATEGORY_MIN_AMOUNT
    )
    .sort((a, b) => a.percentChange - b.percentChange)
    .slice(0, 1)
    .forEach((d) => {
      out.push({
        id: `cat-down-${d.name}`,
        tone: "positive",
        icon: "✅",
        message: `You spent ${Math.abs(Math.round(d.percentChange))}% less on ${d.name} this month`,
        priority: 30,
      });
    });

  // --- Net balance signals ---
  if (stats.totalIncome > 0 && stats.balance < 0) {
    out.push({
      id: "negative-net",
      tone: "warning",
      icon: "⚠️",
      message: `You're spending more than you earned this month`,
      priority: 10,
      href: "/transactions",
    });
  } else if (
    stats.totalIncome > 0 &&
    stats.balance > 0 &&
    stats.balance / stats.totalIncome >= SAVINGS_GOOD_PCT / 100
  ) {
    const savedPct = Math.round((stats.balance / stats.totalIncome) * 100);
    out.push({
      id: "good-savings",
      tone: "positive",
      icon: "💚",
      message: `You saved ${savedPct}% of your income this month — good month`,
      priority: 25,
    });
  }

  // --- Budget usage warnings ---
  if (stats.budgetUsed >= BUDGET_WARNING_PCT && budget?.budget) {
    const daysLeftThisMonth = (() => {
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Math.max(0, lastDay - now.getDate());
    })();
    out.push({
      id: "budget-critical",
      tone: stats.budgetUsed >= 100 ? "critical" : "warning",
      icon: "🚨",
      message:
        stats.budgetUsed >= 100
          ? `You've blown through your monthly budget`
          : `You've used ${Math.round(stats.budgetUsed)}% of your budget with ${daysLeftThisMonth} days left`,
      priority: 5,
      href: "/budgets",
    });
  }

  // --- Activity drought ---
  if (transactions && transactions.length > 0) {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const last = new Date(sorted[0].date);
    const daysSince = Math.floor(
      (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince >= QUIET_DAYS) {
      out.push({
        id: "quiet",
        tone: "neutral",
        icon: "📝",
        message: `No transactions in ${daysSince} days — log what you spent`,
        priority: 40,
        href: "/transactions",
      });
    }
  }

  // --- Income trend (purely informational, low priority) ---
  if (Math.abs(deltas.income) >= 20 && stats.totalIncome > 0) {
    const up = deltas.income > 0;
    out.push({
      id: "income-trend",
      tone: up ? "positive" : "neutral",
      icon: up ? "📈" : "📉",
      message: `Income ${up ? "up" : "down"} ${Math.abs(Math.round(deltas.income))}% vs last month`,
      priority: 50,
    });
  }

  // Sort by priority (lowest = most important first), take top 4 for the strip.
  return out.sort((a, b) => a.priority - b.priority).slice(0, 4);
}
