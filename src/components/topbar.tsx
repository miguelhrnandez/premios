"use client";

import { Menu, Moon, Sun, LogOut, User as UserIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export function Topbar({
  nombre,
  rol,
  onMenu,
}: {
  nombre: string;
  rol: string;
  onMenu: () => void;
}) {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 h-16 bg-surface border-b border-border flex items-center justify-between px-4 lg:px-6">
      <button className="lg:hidden text-foreground" onClick={onMenu}>
        <Menu size={22} />
      </button>
      <div className="hidden lg:block" />
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="p-2 rounded-lg hover:bg-background text-foreground"
          title="Modo oscuro"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-background"
          >
            <div className="w-8 h-8 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-sm font-semibold">
              {nombre.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-medium text-foreground leading-tight">{nombre}</p>
              <p className="text-xs text-muted leading-tight">
                {rol === "ADMIN" ? "Administrador" : "Usuario"}
              </p>
            </div>
          </button>
          <div
            className={cn(
              "absolute right-0 mt-2 w-44 bg-surface border border-border rounded-lg shadow-lg py-1 transition-all",
              open ? "opacity-100 visible" : "opacity-0 invisible"
            )}
          >
            <a
              href="/perfil"
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background"
            >
              <UserIcon size={16} /> Mi perfil
            </a>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-background"
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
