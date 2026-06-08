// Reports page: date-range driven charts + top-N table + PDF export.
//
// All computation is client-side from a single date-ranged transactions fetch,
// reusing the existing /transactions API. No new backend.

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { FiDownload, FiCalendar } from "react-icons/fi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { getTransactions } from "../services/transactions";
import { useCurrency } from "../hooks/useCurrency";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { useToast } from "../hooks/useToast";
import type { Transaction } from "../types";

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1"];

function defaultStart(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function defaultEnd(): string {
  return new Date().toISOString().slice(0, 10);
}
function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}
function fmtMonth(key: string): string {
  return new Date(key + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const ReportsPage: React.FC = () => {
  const { formatCurrency } = useCurrency();
  const { showSuccess, showError } = useToast();
  const [start, setStart] = React.useState<string>(defaultStart());
  const [end, setEnd] = React.useState<string>(defaultEnd());
  const [isExporting, setIsExporting] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["reports", "transactions", start, end],
    queryFn: () =>
      getTransactions({
        start: new Date(start).toISOString(),
        end: new Date(new Date(end).setHours(23, 59, 59, 999)).toISOString(),
      }),
  });

  const transactions: Transaction[] = data?.items || [];

  // --- Aggregations ---

  // monthlyData: ordered list of { monthKey, label, income, expenses } across the range.
  const monthlyData = React.useMemo(() => {
    const buckets: Record<string, { income: number; expenses: number }> = {};
    const startD = new Date(start + "-01");
    const endD = new Date(end);
    const cursor = new Date(startD.getFullYear(), startD.getMonth(), 1);
    while (cursor <= endD) {
      buckets[monthKey(cursor)] = { income: 0, expenses: 0 };
      cursor.setMonth(cursor.getMonth() + 1);
    }
    transactions.forEach((t) => {
      const key = monthKey(new Date(t.date));
      if (!buckets[key]) buckets[key] = { income: 0, expenses: 0 };
      if (t.type === "income") buckets[key].income += t.amount;
      else buckets[key].expenses += t.amount;
    });
    return Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({ monthKey: key, label: fmtMonth(key), ...v }));
  }, [transactions, start, end]);

  // categoryTotals: for the whole range, expense by category, sorted descending.
  const categoryTotals = React.useMemo(() => {
    const byCat: Record<string, number> = {};
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const name = t.category?.name || "Uncategorized";
        byCat[name] = (byCat[name] || 0) + t.amount;
      });
    return Object.entries(byCat)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // categoryTrend: monthly time series for the top 3 categories.
  const topCategoryNames = categoryTotals.slice(0, 3).map((c) => c.name);
  const categoryTrendData = React.useMemo(() => {
    const result: Record<string, any> = {};
    monthlyData.forEach(({ monthKey: k, label }) => {
      result[k] = { label };
      topCategoryNames.forEach((c) => (result[k][c] = 0));
    });
    transactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const k = monthKey(new Date(t.date));
        const cat = t.category?.name || "Uncategorized";
        if (result[k] && topCategoryNames.includes(cat)) {
          result[k][cat] = (result[k][cat] || 0) + t.amount;
        }
      });
    return Object.values(result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, monthlyData, topCategoryNames.join(",")]);

  // top 10 individual expenses by absolute amount
  const topExpenses = React.useMemo(() => {
    return [...transactions]
      .filter((t) => t.type === "expense")
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [transactions]);

  // top-of-page summary
  const totals = React.useMemo(() => {
    const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    return { income, expenses, net: income - expenses, count: transactions.length };
  }, [transactions]);

  // --- PDF export ---

  const handleExportPDF = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const margin = 14;
      let y = 20;

      doc.setFontSize(18);
      doc.text("Chahrity — Report", margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Period: ${start} to ${end}`, margin, y);
      y += 5;
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
      y += 8;

      // Summary block
      doc.setFontSize(11);
      doc.setTextColor(20);
      autoTable(doc, {
        startY: y,
        head: [["Summary", "Value"]],
        body: [
          ["Total income", formatCurrency(totals.income)],
          ["Total expenses", formatCurrency(totals.expenses)],
          ["Net", formatCurrency(totals.net)],
          ["Transactions", String(totals.count)],
        ],
        styles: { fontSize: 10 },
        headStyles: { fillColor: [16, 185, 129] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Monthly breakdown
      autoTable(doc, {
        startY: y,
        head: [["Month", "Income", "Expenses", "Net"]],
        body: monthlyData.map((m) => [
          m.label,
          formatCurrency(m.income),
          formatCurrency(m.expenses),
          formatCurrency(m.income - m.expenses),
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      // Top categories
      if (categoryTotals.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Top categories (expense)", "Amount"]],
          body: categoryTotals.slice(0, 10).map((c) => [c.name, formatCurrency(c.value)]),
          styles: { fontSize: 10 },
          headStyles: { fillColor: [245, 158, 11] },
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }

      // Top individual expenses
      if (topExpenses.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Date", "Description", "Category", "Amount"]],
          body: topExpenses.map((t) => [
            new Date(t.date).toLocaleDateString(),
            t.description || "—",
            t.category?.name || "Uncategorized",
            formatCurrency(t.amount),
          ]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: [239, 68, 68] },
          margin: { left: margin, right: margin },
        });
      }

      doc.save(`chahrity-report-${start}_to_${end}.pdf`);
      showSuccess("PDF report downloaded");
    } catch (err: any) {
      showError(err?.message || "PDF export failed");
    } finally {
      setIsExporting(false);
    }
  };

  // --- Render ---

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick a date range to analyze your spending and income.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={handleExportPDF}
          isLoading={isExporting}
          disabled={transactions.length === 0 || isExporting}
          icon={<FiDownload className="w-4 h-4" />}
          title={transactions.length === 0 ? "No data in this range" : "Download PDF report"}
        >
          Export PDF
        </Button>
      </div>

      {/* Date range */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={start}
                max={end}
                onChange={(e) => setStart(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={end}
                min={start}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-primary-500 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const e = new Date();
                const s = new Date(e.getFullYear(), e.getMonth(), 1);
                setStart(s.toISOString().slice(0, 10));
                setEnd(e.toISOString().slice(0, 10));
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              This month
            </button>
            <button
              type="button"
              onClick={() => {
                const e = new Date();
                const s = new Date(e.getFullYear(), e.getMonth() - 2, 1);
                setStart(s.toISOString().slice(0, 10));
                setEnd(e.toISOString().slice(0, 10));
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              Last 3 months
            </button>
            <button
              type="button"
              onClick={() => {
                const e = new Date();
                const s = new Date(e.getFullYear(), 0, 1);
                setStart(s.toISOString().slice(0, 10));
                setEnd(e.toISOString().slice(0, 10));
              }}
              className="px-3 py-2 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              YTD
            </button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <LoadingSpinner />
        </div>
      ) : transactions.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-slate-700 font-medium">No transactions in this range</p>
          <p className="text-sm text-slate-500 mt-1">Try a different period, or log a transaction first.</p>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 border-l-4 border-l-emerald-500">
              <p className="text-xs text-slate-500">Income</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totals.income)}</h3>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <p className="text-xs text-slate-500">Expenses</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(totals.expenses)}</h3>
            </Card>
            <Card className="p-4 border-l-4 border-l-blue-500">
              <p className="text-xs text-slate-500">Net</p>
              <h3 className={`text-xl font-bold mt-1 ${totals.net >= 0 ? "text-slate-900" : "text-red-600"}`}>
                {formatCurrency(totals.net)}
              </h3>
            </Card>
            <Card className="p-4 border-l-4 border-l-slate-400">
              <p className="text-xs text-slate-500">Transactions</p>
              <h3 className="text-xl font-bold text-slate-900 mt-1">{totals.count}</h3>
            </Card>
          </div>

          {/* Income vs Expenses per month */}
          <Card className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Income vs Expenses</h3>
            <div className="w-full h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    formatter={(value) => formatCurrency(value as number)}
                  />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="Income" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Category trend (top 3 expense categories) */}
          {topCategoryNames.length > 0 && (
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Top categories over time</h3>
              <p className="text-xs text-slate-500 mb-4">Spending trend for your three biggest expense categories.</p>
              <div className="w-full h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={categoryTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#64748b", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      formatter={(value) => formatCurrency(value as number)}
                    />
                    <Legend />
                    {topCategoryNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Top expenses table */}
          {topExpenses.length > 0 && (
            <Card className="overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Biggest expenses</h3>
                <p className="text-xs text-slate-500 mt-1">Top 10 individual transactions in this range.</p>
              </div>
              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {topExpenses.map((t) => (
                      <tr key={t._id} className="hover:bg-slate-50">
                        <td className="px-6 py-3 text-sm text-slate-700">{new Date(t.date).toLocaleDateString()}</td>
                        <td className="px-6 py-3 text-sm text-slate-900 font-medium">{t.description || "—"}</td>
                        <td className="px-6 py-3 text-sm text-slate-500">{t.category?.name || "Uncategorized"}</td>
                        <td className="px-6 py-3 text-sm text-slate-900 font-semibold text-right">{formatCurrency(t.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: ranked card list */}
              <div className="sm:hidden divide-y divide-slate-100">
                {topExpenses.map((t, i) => (
                  <div key={t._id} className="p-4 flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 truncate">{t.description || "—"}</p>
                      <p className="text-xs text-slate-500">
                        {t.category?.name || "Uncategorized"} • {new Date(t.date).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="flex-shrink-0 font-semibold text-slate-900">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ReportsPage;
