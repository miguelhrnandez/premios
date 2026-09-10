"use client";

import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { useEffect } from "react";
import type { EstadoStock } from "@/lib/types";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-surface border border-border rounded-xl p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone?: "default" | "warning" | "danger" | "success" | "brand";
}) {
  const tones: Record<string, string> = {
    default: "bg-background text-foreground",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    brand: "bg-brand/10 text-brand",
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={cn("rounded-xl p-3", tones[tone])}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </Card>
  );
}

export function EstadoBadge({ estado }: { estado: EstadoStock }) {
  const map: Record<EstadoStock, { label: string; cls: string; dot: string }> = {
    OK: { label: "Stock correcto", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" },
    BAJO: { label: "Stock bajo", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
    AGOTADO: { label: "Sin stock", cls: "bg-red-500/10 text-red-600 dark:text-red-400", dot: "bg-red-500" },
  };
  const m = map[estado];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", m.cls)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    INGRESO: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    SALIDA: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    AJUSTE: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  };
  const label: Record<string, string> = {
    INGRESO: "Ingreso",
    SALIDA: "Salida",
    AJUSTE: "Ajuste",
  };
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium", map[tipo])}>
      {label[tipo] ?? tipo}
    </span>
  );
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const variants = {
    primary: "bg-brand text-brand-foreground hover:opacity-90",
    secondary: "bg-background border border-border text-foreground hover:bg-border/40",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-foreground hover:bg-background",
  };
  return (
    <button
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-brand text-sm",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-brand text-sm",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-brand text-sm",
        props.className
      )}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-foreground mb-1 block">{children}</label>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className={cn(
          "bg-surface border border-border rounded-xl shadow-2xl w-full max-h-[90vh] overflow-y-auto",
          wide ? "max-w-2xl" : "max-w-md"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={20} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-foreground/80 mb-5">{message}</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={loading}>
          Confirmar
        </Button>
      </div>
    </Modal>
  );
}
