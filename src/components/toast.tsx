"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";
type Toast = { id: number; type: ToastType; title: string; message?: string };

const ToastContext = createContext<{ push: (t: Omit<Toast, "id">) => void }>({
  push: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS: Record<ToastType, string> = {
  success: "border-l-emerald-500 text-emerald-600 dark:text-emerald-400",
  error: "border-l-red-500 text-red-600 dark:text-red-400",
  warning: "border-l-amber-500 text-amber-600 dark:text-amber-400",
  info: "border-l-blue-500 text-blue-600 dark:text-blue-400",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div
              key={t.id}
              className={`bg-surface border border-border border-l-4 ${COLORS[t.type]} rounded-lg shadow-lg p-3 flex gap-3 items-start animate-in slide-in-from-bottom-2`}
            >
              <Icon size={20} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-foreground">{t.title}</p>
                {t.message && <p className="text-xs text-muted mt-0.5">{t.message}</p>}
              </div>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-muted hover:text-foreground"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
