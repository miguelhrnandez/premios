"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  History,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  Gift,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "USUARIO"] },
  { href: "/premios", label: "Stock de Premios", icon: Package, roles: ["ADMIN", "USUARIO"] },
  { href: "/movimientos/nuevo", label: "Registrar Movimiento", icon: PlusCircle, roles: ["ADMIN", "USUARIO"] },
  { href: "/historial", label: "Historial", icon: History, roles: ["ADMIN", "USUARIO"] },
  { href: "/inventario", label: "Inventario", icon: ClipboardList, roles: ["ADMIN"] },
  { href: "/reportes", label: "Reportes", icon: BarChart3, roles: ["ADMIN"] },
  { href: "/usuarios", label: "Usuarios", icon: Users, roles: ["ADMIN"] },
  { href: "/configuracion", label: "Configuración", icon: Settings, roles: ["ADMIN", "USUARIO"] },
];

export function Sidebar({
  role,
  open,
  onClose,
}: {
  role: Role;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-64 bg-surface border-r border-border flex flex-col z-40 transition-transform",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="bg-brand text-brand-foreground rounded-lg p-1.5">
              <Gift size={18} />
            </div>
            <span className="font-bold text-foreground">Premios</span>
          </div>
          <button className="lg:hidden text-muted" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-1">
          {NAV.filter((item) => item.roles.includes(role)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-brand text-brand-foreground"
                    : "text-foreground/80 hover:bg-background"
                )}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-border">
          <Link href="/perfil" className="text-xs text-muted hover:text-foreground">
            Mi perfil
          </Link>
        </div>
      </aside>
    </>
  );
}
