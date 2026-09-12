"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { PackagePlus, PackageMinus, Search } from "lucide-react";
import { Card, Button, Input, Label, Textarea, EstadoBadge } from "@/components/ui";
import { useToast } from "@/components/toast";
import { calcularEstado } from "@/lib/estado";
import type { Premio } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function NuevoMovimientoPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const { push } = useToast();

  const [premios, setPremios] = useState<Premio[]>([]);
  const [tipo, setTipo] = useState<"SALIDA" | "INGRESO">("SALIDA");
  const [q, setQ] = useState("");
  const [premioId, setPremioId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [observacion, setObservacion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/premios")
      .then((r) => r.json())
      .then((data: Premio[]) => setPremios(data.filter((p) => p.activo)));
  }, []);

  const filtrados = useMemo(
    () => premios.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase())),
    [premios, q]
  );
  const seleccionado = premios.find((p) => p.id === premioId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!premioId) {
      setError("Seleccioná un premio");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/movimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, premioId, cantidad, motivo, observacion }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Error al registrar el movimiento");
      return;
    }
    push({
      type: "success",
      title: tipo === "INGRESO" ? "Ingreso registrado" : "Salida registrada",
      message: `${seleccionado?.nombre}: stock actual ${data.stockActual} unidades.`,
    });
    setPremioId("");
    setCantidad(1);
    setMotivo("");
    setObservacion("");
    setPremios((prev) =>
      prev.map((p) => (p.id === data.premioId ? { ...p, stockActual: data.stockActual } : p))
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Registrar Movimiento</h1>
        <p className="text-sm text-muted">Registrá un ingreso o una salida de stock</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTipo("SALIDA")}
          className={cn(
            "flex-1 rounded-xl border p-4 flex items-center gap-3 transition",
            tipo === "SALIDA"
              ? "border-brand bg-brand/10"
              : "border-border bg-surface hover:bg-background"
          )}
        >
          <PackageMinus className="text-blue-500" />
          <div className="text-left">
            <p className="font-semibold text-foreground">Salida de stock</p>
            <p className="text-xs text-muted">Retirar premios del inventario</p>
          </div>
        </button>
        {isAdmin && (
          <button
            onClick={() => setTipo("INGRESO")}
            className={cn(
              "flex-1 rounded-xl border p-4 flex items-center gap-3 transition",
              tipo === "INGRESO"
                ? "border-brand bg-brand/10"
                : "border-border bg-surface hover:bg-background"
            )}
          >
            <PackagePlus className="text-emerald-500" />
            <div className="text-left">
              <p className="font-semibold text-foreground">Ingreso de stock</p>
              <p className="text-xs text-muted">Registrar llegada de nuevos premios</p>
            </div>
          </button>
        )}
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Premio</Label>
            <div className="relative mb-2">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Buscar premio…"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="max-h-56 overflow-y-auto flex flex-col gap-1 border border-border rounded-lg p-1">
              {filtrados.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setPremioId(p.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm text-left",
                    premioId === p.id ? "bg-brand text-brand-foreground" : "hover:bg-background text-foreground"
                  )}
                >
                  <span>{p.nombre}</span>
                  <span
                    className={cn(
                      "text-xs",
                      premioId === p.id ? "text-brand-foreground/80" : "text-muted"
                    )}
                  >
                    Stock: {p.stockActual}
                  </span>
                </button>
              ))}
              {filtrados.length === 0 && (
                <p className="text-sm text-muted p-2">No se encontraron premios.</p>
              )}
            </div>
          </div>

          {seleccionado && (
            <div className="flex items-center justify-between bg-background rounded-lg p-3 text-sm">
              <span className="text-foreground">
                Stock disponible de <b>{seleccionado.nombre}</b>: {seleccionado.stockActual} unidades
              </span>
              <EstadoBadge estado={calcularEstado(seleccionado.stockActual, seleccionado.stockMinimo)} />
            </div>
          )}

          <div>
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={1}
              max={tipo === "SALIDA" ? seleccionado?.stockActual : undefined}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              required
            />
          </div>

          {tipo === "SALIDA" && (
            <div>
              <Label>Motivo (opcional)</Label>
              <Input
                placeholder="Ej: Premios entregados"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
          )}

          <div>
            <Label>Observación (opcional)</Label>
            <Textarea rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>}

          <Button type="submit" disabled={loading || !premioId}>
            {tipo === "SALIDA" ? "Registrar salida" : "Registrar ingreso"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
