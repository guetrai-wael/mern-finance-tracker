// Single source of truth for subscription status on the frontend.
//
// Why this exists: the same isActive/expiresAt logic was inlined in
// App.tsx, AdminPage.tsx, TrialBanner.tsx, and SubscriptionPage.tsx —
// each with subtle variations. The admin "Active" pill once said
// "Active" for an expired user because the pill checked only `isActive`
// while the backend checkSubscription middleware also enforces expiry.
// Centralize the rule here; never re-implement it.
//
// Backend ground truth (backend/src/middlewares/checkSubscription.js):
//   blocked iff !user.isActive OR (user.expiresAt && user.expiresAt < now)

import type { User } from "../types";

export type SubscriptionStatus = "active" | "expired" | "deactivated" | "unknown";

export interface SubscriptionInfo {
  status: SubscriptionStatus;
  daysRemaining: number | null;
  isEffectivelyActive: boolean;
  isExpired: boolean;
  isDeactivated: boolean;
}

/**
 * Returns the canonical subscription state for a user. Admin role does
 * NOT bypass here — callers that want admin to skip subscription gates
 * should check `user.role === 'admin'` separately and explicitly.
 */
export function getSubscriptionInfo(user: User | null | undefined): SubscriptionInfo {
  if (!user) {
    return {
      status: "unknown",
      daysRemaining: null,
      isEffectivelyActive: false,
      isExpired: false,
      isDeactivated: false,
    };
  }

  const isDeactivated = user.isActive === false;
  const daysRemaining = user.expiresAt ? daysUntil(user.expiresAt) : null;
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  let status: SubscriptionStatus;
  if (isDeactivated) status = "deactivated";
  else if (isExpired) status = "expired";
  else status = "active";

  return {
    status,
    daysRemaining,
    isEffectivelyActive: !isDeactivated && !isExpired,
    isExpired,
    isDeactivated,
  };
}

/** Whole-day delta from now to `dateStr`. Negative when in the past. */
export function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** True iff the user is in the "warn before expiry" window (1..7 days). */
export function isInWarnWindow(user: User | null | undefined, windowDays = 7): boolean {
  const info = getSubscriptionInfo(user);
  return (
    info.isEffectivelyActive &&
    info.daysRemaining !== null &&
    info.daysRemaining >= 0 &&
    info.daysRemaining <= windowDays
  );
}
