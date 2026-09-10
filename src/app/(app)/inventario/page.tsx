"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Card, Button, Input, Select, Label, Textarea } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Premio } from "@/lib/types";
import { format } from "date-fns";

interface InventarioRow {
  id: string;
  premio: { nombre: string; codigo: string };
  usuario: { nombre: string };
  stockSistema: number;
  stockFisico: number;
  diferencia: number;
  motivo: string | null;
  ajustado: boolean;
  creadoEn: string;
}

export default function InventarioPage() {
  const { push } = useToast();
  const [premios, setPremios] = useState<Premio[]>([]);
  const [historial, setHistorial] = useState<InventarioRow[]>([]);
  const [premioId, setPremioId] = useState("");
  const [stockFisico, setStockFisico] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  function loadHistorial() {
    fetch("/api/inventario")
      .then((r) => r.json())
      .then(setHistorial);
  }

  useEffect(() => {
    fetch("/api/premios")
      .then((r) => r.json())
      .then((data: Premio[]) => setPremios(data.filter((p) => p.activo)));
    loadHistorial();
  }, []);

  const seleccionado = premios.find((p) => p.id === premioId) ?? null;
  const diferencia = seleccionado && stockFisico !== "" ? Number(stockFisico) - seleccionado.stockActual : 0;

  async function registrarConteo(confirmarAjuste: boolean) {
    if (!seleccionado || stockFisico === "") return;
    if (confirmarAjuste && diferencia !== 0 && !motivo.trim()) {
      push({ type: "error", title: "El motivo es obligatorio para confirmar el ajuste" });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/inventario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        premioId,
        stockFisico: Number(stockFisico),
        motivo,
        confirmarAjuste,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      push({ type: "error", title: "Error", message: data.error });
      return;
    }
    push({
      type: "success",
      title: confirmarAjuste && diferencia !== 0 ? "Ajuste confirmado" : "Conteo registrado",
    });
    setPremios((prev) =>
      prev.map((p) =>
        p.id === premioId && confirmarAjuste && diferencia !== 0
          ? { ...p, stockActual: Number(stockFisico) }
          : p
      )
    );
    setPremioId("");
    setStockFisico("");
    setMotivo("");
    loadHistorial();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">Inventario Físico</h1>
        <p className="text-sm text-muted">Contá el stock físico y compará contra el sistema</p>
      </div>

      <Card className="max-w-2xl">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label>Premio</Label>
            <Select value={premioId} onChange={(e) => setPremioId(e.target.value)}>
              <option value="">Seleccioná un premio</option>
              {premios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </Select>
          </div>

          {seleccionado && (
            <>
              <div>
                <Label>Stock del sistema</Label>
                <Input value={seleccionado.stockActual} disabled />
              </div>
              <div>
                <Label>Stock físico contado</Label>
                <Input
                  type="number"
                  min={0}
                  value={stockFisico}
                  onChange={(e) => setStockFisico(e.target.value === "" ? "" : Number(e.target.value))}
                />
              </div>

              {stockFisico !== "" && (
                <div className="sm:col-span-2 flex items-center justify-between bg-background rounded-lg p-3 text-sm">
                  <span className="text-foreground">Diferencia detectada</span>
                  <span
                    className={`font-bold ${diferencia === 0 ? "text-emerald-500" : diferencia > 0 ? "text-blue-500" : "text-red-500"}`}
                  >
                    {diferencia > 0 ? "+" : ""}
                    {diferencia}
                  </span>
                </div>
              )}

              {stockFisico !== "" && diferencia !== 0 && (
                <div className="sm:col-span-2">
                  <Label>Motivo de la diferencia (obligatorio para ajustar)</Label>
                  <Textarea
                    rows={2}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ej: 2 premios fueron entregados sin registrar"
                  />
                </div>
              )}

              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button variant="secondary" disabled={loading} onClick={() => registrarConteo(false)}>
                  Solo registrar conteo
                </Button>
                <Button disabled={loading || stockFisico === ""} onClick={() => registrarConteo(true)}>
                  <ClipboardCheck size={16} />
                  Confirmar ajuste
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <h2 className="font-semibold text-foreground px-4 pt-4 pb-2">Historial de inventarios</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="p-3 font-medium">Fecha</th>
              <th className="p-3 font-medium">Premio</th>
              <th className="p-3 font-medium">Usuario</th>
              <th className="p-3 font-medium">Stock sistema</th>
              <th className="p-3 font-medium">Stock físico</th>
              <th className="p-3 font-medium">Diferencia</th>
              <th className="p-3 font-medium">Motivo</th>
              <th className="p-3 font-medium">Ajustado</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((h) => (
              <tr key={h.id} className="border-b border-border last:border-0">
                <td className="p-3 text-foreground/80">{format(new Date(h.creadoEn), "dd/MM/yyyy HH:mm")}</td>
                <td className="p-3 text-foreground">{h.premio.nombre}</td>
                <td className="p-3 text-foreground/80">{h.usuario.nombre}</td>
                <td className="p-3 text-foreground/80">{h.stockSistema}</td>
                <td className="p-3 text-foreground/80">{h.stockFisico}</td>
                <td className={`p-3 font-semibold ${h.diferencia === 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {h.diferencia > 0 ? "+" : ""}
                  {h.diferencia}
                </td>
                <td className="p-3 text-foreground/70">{h.motivo || "—"}</td>
                <td className="p-3">{h.ajustado ? "Sí" : "No"}</td>
              </tr>
            ))}
            {historial.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted">
                  Todavía no se registraron inventarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
