"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Ban } from "lucide-react";
import { Card, Input, Select, Button, Modal, TipoBadge } from "@/components/ui";
import { useSocketEvent } from "@/components/socket-provider";
import { useToast } from "@/components/toast";
import type { Movimiento, Premio, Usuario } from "@/lib/types";
import { format } from "date-fns";

export default function HistorialPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const { push } = useToast();

  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [premios, setPremios] = useState<Premio[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [q, setQ] = useState("");
  const [premioId, setPremioId] = useState("");
  const [usuarioId, setUsuarioId] = useState("");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [anular, setAnular] = useState<Movimiento | null>(null);
  const [motivoAnular, setMotivoAnular] = useState("");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (premioId) params.set("premioId", premioId);
    if (usuarioId) params.set("usuarioId", usuarioId);
    if (tipo) params.set("tipo", tipo);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    fetch(`/api/movimientos?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => setMovimientos(data.movimientos));
  }, [q, premioId, usuarioId, tipo, desde, hasta]);

  useEffect(() => {
    fetch("/api/premios").then((r) => r.json()).then(setPremios);
    if (isAdmin) fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios);
  }, [isAdmin]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useSocketEvent("movimiento:nuevo", () => load());
  useSocketEvent("movimiento:anulado", () => load());

  async function confirmarAnular() {
    if (!anular) return;
    const res = await fetch(`/api/movimientos/${anular.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: motivoAnular }),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ type: "error", title: "No se pudo anular", message: data.error });
    } else {
      push({ type: "success", title: "Movimiento anulado" });
      load();
    }
    setAnular(null);
    setMotivoAnular("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Historial de Movimientos</h1>
        <p className="text-sm text-muted">Trazabilidad completa de ingresos, salidas y ajustes</p>
      </div>

      <Card className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Buscar…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={premioId} onChange={(e) => setPremioId(e.target.value)} className="max-w-[180px]">
          <option value="">Todos los premios</option>
          {premios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        {isAdmin && (
          <Select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="max-w-[170px]">
            <option value="">Todos los usuarios</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </Select>
        )}
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="max-w-[150px]">
          <option value="">Todos los tipos</option>
          <option value="INGRESO">Ingreso</option>
          <option value="SALIDA">Salida</option>
          <option value="AJUSTE">Ajuste</option>
        </Select>
        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="max-w-[150px]" />
        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="max-w-[150px]" />
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Hora</th>
              <th className="p-3 font-medium">Usuario</th>
              <th className="p-3 font-medium">Tipo</th>
              <th className="p-3 font-medium">Premio</th>
              <th className="p-3 font-medium">Cantidad</th>
              <th className="p-3 font-medium">Stock ant.</th>
              <th className="p-3 font-medium">Stock act.</th>
              <th className="p-3 font-medium">Observación</th>
              {isAdmin && <th className="p-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr
                key={m.id}
                className={`border-b border-border last:border-0 hover:bg-background/60 ${m.anulado ? "opacity-50" : ""}`}
              >
                <td className="p-3 text-foreground/80">{format(new Date(m.creadoEn), "dd/MM/yyyy")}</td>
                <td className="p-3 text-foreground/80">{format(new Date(m.creadoEn), "HH:mm")}</td>
                <td className="p-3 text-foreground">{m.usuario.nombre}</td>
                <td className="p-3">
                  <TipoBadge tipo={m.tipo} />
                  {m.anulado && <span className="ml-2 text-xs text-red-500">Anulado</span>}
                </td>
                <td className="p-3 text-foreground">{m.premio.nombre}</td>
                <td className="p-3 font-semibold text-foreground">{m.cantidad}</td>
                <td className="p-3 text-foreground/80">{m.stockAnterior}</td>
                <td className="p-3 text-foreground/80">{m.stockActual}</td>
                <td className="p-3 text-foreground/70 max-w-[220px] truncate" title={m.observacion ?? m.motivo ?? ""}>
                  {m.observacion || m.motivo || "—"}
                </td>
                {isAdmin && (
                  <td className="p-3">
                    {!m.anulado && (
                      <button
                        className="p-2 rounded-lg hover:bg-background text-red-500"
                        title="Anular movimiento"
                        onClick={() => setAnular(m)}
                      >
                        <Ban size={16} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-muted">
                  No hay movimientos con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Modal
        open={!!anular}
        onClose={() => {
          setAnular(null);
          setMotivoAnular("");
        }}
        title="Anular movimiento"
      >
        <p className="text-sm text-foreground/80 mb-4">
          Esta acción revertirá el efecto sobre el stock y quedará registrada en la auditoría.
        </p>
        <label className="text-sm font-medium text-foreground mb-1 block">Motivo de la anulación</label>
        <Input
          autoFocus
          value={motivoAnular}
          onChange={(e) => setMotivoAnular(e.target.value)}
          placeholder="Obligatorio"
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="secondary"
            onClick={() => {
              setAnular(null);
              setMotivoAnular("");
            }}
          >
            Cancelar
          </Button>
          <Button variant="danger" disabled={!motivoAnular.trim()} onClick={confirmarAnular}>
            Confirmar anulación
          </Button>
        </div>
      </Modal>
    </div>
  );
}
