import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FiBell, FiCheck, FiAlertTriangle, FiTarget, FiFileText, FiInfo } from "react-icons/fi";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../services/notifications";
import type { Notification, NotificationType } from "../../types";

const ICONS: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  budget: FiAlertTriangle,
  goal: FiTarget,
  report: FiFileText,
  system: FiInfo,
};

const TONES: Record<NotificationType, string> = {
  budget: "bg-amber-100 text-amber-600",
  goal: "bg-emerald-100 text-emerald-600",
  report: "bg-blue-100 text-blue-600",
  system: "bg-slate-100 text-slate-600",
};

const relativeTime = (iso: string): string => {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The global default is refetchOnWindowFocus:false with a 5min staleTime,
  // which is wrong for an inbox — poll instead so the badge stays live.
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => getNotifications(),
    refetchInterval: 60000,
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount ?? 0;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["notifications"] });

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });

  // Close on outside click and on Escape.
  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const handleClick = (notification: Notification) => {
    if (!notification.read) readMutation.mutate(notification._id);
    setIsOpen(false);
    if (notification.meta?.href) navigate(notification.meta.href);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"
        }
        className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
      >
        <FiBell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => readAllMutation.mutate()}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1"
              >
                <FiCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <FiBell className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm text-slate-500">You're all caught up</p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = ICONS[notification.type] || FiInfo;
                return (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => handleClick(notification)}
                    className={`w-full text-left px-4 py-3 flex gap-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${
                      notification.read ? "" : "bg-primary-50/40"
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                        TONES[notification.type] || TONES.system
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="block text-sm font-medium text-slate-900 truncate">
                          {notification.title}
                        </span>
                        {!notification.read && (
                          <span className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full" />
                        )}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        {notification.body}
                      </span>
                      <span className="block text-xs text-slate-400 mt-1">
                        {relativeTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
