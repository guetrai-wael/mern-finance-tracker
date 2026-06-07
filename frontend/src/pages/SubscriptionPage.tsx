// Subscription / "trial expired" hard-block screen.
//
// Shown when the user is authenticated but checkSubscription middleware
// rejects them (isActive === false OR expiresAt < now). The router routes
// blocked users here instead of showing them broken pages.

import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { FiClock, FiLogOut, FiMail, FiCopy, FiCheck } from "react-icons/fi";
import { Button } from "../components/common/Button";

const SUPPORT_EMAIL = "guetariwael@gmail.com";

function daysRemaining(dateStr?: string): number | null {
  if (!dateStr) return null;
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

const SubscriptionPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [copied, setCopied] = React.useState(false);

  const days = daysRemaining(user?.expiresAt);
  const isExpired = days !== null && days < 0;
  const isDeactivated = user?.isActive === false;

  // Subject line a user can copy into their email client
  const subject = encodeURIComponent(`Chahrity subscription renewal — ${user?.name || ""}`);
  const body = encodeURIComponent(
    `Hi Wael,\n\nI'd like to renew my Chahrity subscription.\n\nAccount email: ${user?.email || ""}\n\nThanks!`
  );
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — ignore
    }
  };

  const status = (() => {
    if (isDeactivated) {
      return {
        title: "Account deactivated",
        sub: "Your account has been deactivated by the administrator.",
        tone: "bg-red-100 text-red-600",
      };
    }
    if (isExpired) {
      return {
        title: "Subscription expired",
        sub: `Your subscription ended ${Math.abs(days!)} ${Math.abs(days!) === 1 ? "day" : "days"} ago.`,
        tone: "bg-amber-100 text-amber-600",
      };
    }
    return {
      title: "Account inactive",
      sub: "Your account is currently inactive.",
      tone: "bg-slate-100 text-slate-600",
    };
  })();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className={`w-16 h-16 ${status.tone} rounded-full flex items-center justify-center mx-auto mb-6`}>
            <FiClock className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-2 text-center">{status.title}</h1>
          <p className="text-slate-600 text-center mb-6">
            Hello <strong>{user?.name}</strong>. {status.sub}
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <FiMail className="w-4 h-4" /> Renew your access
            </h3>
            <p className="text-sm text-blue-800 mb-3">
              Chahrity uses hand-to-hand payment. Email me to arrange — I'll extend your access immediately after.
            </p>
            <div className="bg-white border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <code className="text-sm text-slate-700 truncate">{SUPPORT_EMAIL}</code>
              <button
                onClick={handleCopyEmail}
                className="flex-shrink-0 p-1.5 rounded text-blue-600 hover:bg-blue-50"
                aria-label="Copy email address"
              >
                {copied ? <FiCheck className="w-4 h-4 text-emerald-600" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <a href={mailto} className="block">
              <Button className="w-full justify-center" icon={<FiMail className="w-4 h-4" />}>
                Email Wael
              </Button>
            </a>
            <Button
              onClick={logout}
              variant="secondary"
              className="w-full justify-center"
              icon={<FiLogOut className="w-4 h-4" />}
            >
              Log out
            </Button>
          </div>
        </div>

        <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Chahrity &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
