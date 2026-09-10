"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, TipoBadge } from "@/components/ui";
import { User, ShieldCheck, PackageMinus } from "lucide-react";
import type { Movimiento } from "@/lib/types";
import { format } from "date-fns";

export default function PerfilPage() {
  const { data: session } = useSession();
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/movimientos?usuarioId=${session.user.id}&pageSize=100`)
      .then((r) => r.json())
      .then((data) => setMovimientos(data.movimientos));
  }, [session]);

  if (!session) return null;

  const totalRetirado = movimientos
    .filter((m) => m.tipo === "SALIDA" && !m.anulado)
    .reduce((acc, m) => acc + m.cantidad, 0);

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Mi Perfil</h1>
        <p className="text-sm text-muted">Información de tu cuenta y actividad</p>
      </div>

      <Card className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-brand text-brand-foreground flex items-center justify-center text-2xl font-bold">
          {session.user.name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{session.user.name}</p>
          <p className="text-sm text-muted">@{session.user.username}</p>
          <span className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-brand">
            <ShieldCheck size={14} />
            {session.user.role === "ADMIN" ? "Administrador" : "Usuario"}
          </span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="flex items-center gap-3">
          <div className="bg-brand/10 text-brand rounded-xl p-3">
            <PackageMinus size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalRetirado}</p>
            <p className="text-xs text-muted">Premios retirados en total</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl p-3">
            <User size={20} />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{movimientos.length}</p>
            <p className="text-xs text-muted">Movimientos registrados</p>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-foreground mb-3">Mi historial reciente</h2>
        <div className="flex flex-col divide-y divide-border">
          {movimientos.slice(0, 20).map((m) => (
            <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <TipoBadge tipo={m.tipo} />
                <div>
                  <p className="text-foreground font-medium">{m.premio.nombre}</p>
                  <p className="text-xs text-muted">{format(new Date(m.creadoEn), "dd/MM/yyyy HH:mm")}</p>
                </div>
              </div>
              <span className="font-semibold text-foreground">{m.cantidad} u.</span>
            </div>
          ))}
          {movimientos.length === 0 && <p className="text-sm text-muted py-4">Todavía no hay movimientos.</p>}
        </div>
      </Card>
    </div>
  );
}
