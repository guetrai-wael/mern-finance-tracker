// Persistent banner shown when the user's trial / subscription is about to
// expire. Sits at the top of the authenticated layout. Auto-hides outside
// the warning window (more than 7 days left, or already expired — the
// expired case is handled by the SubscriptionPage hard-block, not here).

import React from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiX } from "react-icons/fi";
import { useAuth } from "../../contexts/AuthContext";
import { isInWarnWindow, getSubscriptionInfo } from "../../lib/subscription";

const DISMISS_KEY_PREFIX = "trial-banner-dismissed-"; // suffix is YYYY-MM-DD of expiry

export const TrialBanner: React.FC = () => {
  const { user } = useAuth();
  const days = getSubscriptionInfo(user).daysRemaining;
  const shouldShow = isInWarnWindow(user);

  // Dismissal sticks to *this* expiry date so it reappears after a renewal cycle.
  const dismissKey = React.useMemo(
    () => (user?.expiresAt ? DISMISS_KEY_PREFIX + user.expiresAt.slice(0, 10) : ""),
    [user?.expiresAt]
  );
  const [dismissed, setDismissed] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return !!(dismissKey && window.localStorage.getItem(dismissKey));
  });

  React.useEffect(() => {
    if (dismissKey) {
      setDismissed(!!window.localStorage.getItem(dismissKey));
    }
  }, [dismissKey]);

  if (!shouldShow || dismissed) return null;

  const handleDismiss = () => {
    if (dismissKey) window.localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  const tone =
    days === 0
      ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", icon: "text-red-600" }
      : days! <= 3
      ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", icon: "text-amber-600" }
      : { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-900", icon: "text-blue-600" };

  const headline =
    days === 0
      ? "Your subscription expires today"
      : days === 1
      ? "Your subscription expires tomorrow"
      : `Your subscription expires in ${days} days`;

  return (
    <div
      className={`${tone.bg} border-b ${tone.border} px-4 py-2.5 flex items-center justify-between gap-3`}
      role="status"
    >
      <div className="flex items-center gap-2 min-w-0">
        <FiAlertCircle className={`flex-shrink-0 w-4 h-4 ${tone.icon}`} aria-hidden="true" />
        <p className={`text-sm font-medium ${tone.text} truncate`}>
          {headline} —{" "}
          <Link to="/subscription" className="underline font-semibold whitespace-nowrap">
            renew it
          </Link>
        </p>
      </div>
      <button
        onClick={handleDismiss}
        className={`flex-shrink-0 p-1 rounded hover:bg-white/50 ${tone.icon}`}
        aria-label="Dismiss banner"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
};

export default TrialBanner;
