import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NotificationKind = "success" | "error" | "info";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  description?: string;
  at: string;
};

type Ctx = {
  notifications: AppNotification[];
  unreadCount: number;
  push: (n: Omit<AppNotification, "id" | "at"> & { id?: string; at?: string }) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

/** Events are session-scoped (they describe this session's scans); which ones
 * have been read is a per-device preference, so that lives in localStorage. */
const EVENTS_KEY = "secureflow.notifications.v1";
const READ_KEY = "secureflow.notifications.read.v1";
const MAX = 50;

function load<T>(storage: "session" | "local", key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = (storage === "session" ? window.sessionStorage : window.localStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(storage: "session" | "local", key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    (storage === "session" ? window.sessionStorage : window.localStorage).setItem(
      key,
      JSON.stringify(value),
    );
  } catch {
    /* storage unavailable — in-memory state still works this session */
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    load<AppNotification[]>("session", EVENTS_KEY, []),
  );
  const [readIds, setReadIds] = useState<string[]>(() => load<string[]>("local", READ_KEY, []));

  useEffect(() => {
    save("session", EVENTS_KEY, notifications);
  }, [notifications]);
  useEffect(() => {
    save("local", READ_KEY, readIds);
  }, [readIds]);

  const push = useCallback<Ctx["push"]>((n) => {
    const entry: AppNotification = {
      id: n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: n.kind,
      title: n.title,
      description: n.description,
      at: n.at ?? new Date().toISOString(),
    };
    setNotifications((prev) => [entry, ...prev.filter((p) => p.id !== entry.id)].slice(0, MAX));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      setReadIds((r) => Array.from(new Set([...r, ...prev.map((p) => p.id)])).slice(-200));
      return prev;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clear = useCallback(() => setNotifications([]), []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.includes(n.id)).length,
    [notifications, readIds],
  );

  const value = useMemo(
    () => ({ notifications, unreadCount, push, markAllRead, dismiss, clear }),
    [notifications, unreadCount, push, markAllRead, dismiss, clear],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): Ctx {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}
