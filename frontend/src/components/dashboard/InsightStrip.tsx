// Narrative "what's happening" cards above the dashboard KPI grid.
//
// Mounted on DashboardPage. The whole point of this strip is to interpret
// the user's data in plain language ("Groceries up 23%") instead of forcing
// the user to do the math themselves. Addresses the #1 user complaint: "not clear."

import React from "react";
import { Link } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
import type { Insight, InsightTone } from "../../utils/insights";

const TONE_STYLES: Record<InsightTone, { bg: string; border: string; text: string }> = {
  positive: {
    bg: "bg-emerald-50",
    border: "border-l-emerald-500",
    text: "text-emerald-900",
  },
  warning: {
    bg: "bg-amber-50",
    border: "border-l-amber-500",
    text: "text-amber-900",
  },
  critical: {
    bg: "bg-red-50",
    border: "border-l-red-500",
    text: "text-red-900",
  },
  neutral: {
    bg: "bg-slate-50",
    border: "border-l-slate-400",
    text: "text-slate-900",
  },
};

const InsightCard: React.FC<{ insight: Insight }> = ({ insight }) => {
  const tone = TONE_STYLES[insight.tone];

  const body = (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border-l-4 ${tone.bg} ${tone.border} h-full transition-shadow ${
        insight.href ? "hover:shadow-md cursor-pointer" : ""
      }`}
    >
      <span className="text-2xl leading-none" aria-hidden="true">
        {insight.icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${tone.text} leading-snug`}>
          {insight.message}
        </p>
      </div>
      {insight.href && (
        <FiArrowRight className={`mt-1 w-4 h-4 ${tone.text} opacity-60`} />
      )}
    </div>
  );

  if (insight.href) {
    return (
      <Link to={insight.href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
};

interface InsightStripProps {
  insights: Insight[];
}

export const InsightStrip: React.FC<InsightStripProps> = ({ insights }) => {
  if (insights.length === 0) return null;

  // Responsive grid: 1 col on mobile, 2 on sm, up to 4 on lg.
  // We never show more than 4 — already capped in computeInsights.
  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
      aria-label="Financial insights"
    >
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
};

export default InsightStrip;
