"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Card, Button, Input, Label, StatCard } from "@/components/ui";
import { TrendingDown, CalendarDays, CalendarRange } from "lucide-react";

interface ReportData {
  masEntregados: Array<{ premio: string; cantidad: number }>;
  menosUtilizados: Array<{ premio: string; totalSalidas: number }>;
  usuariosTop: Array<{ usuario: string; cantidad: number; movimientos: number }>;
  salidasHoy: number;
  salidasSemana: number;
  salidasMes: number;
}

export default function ReportesPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function load() {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    fetch(`/api/reportes?${params.toString()}`)
      .then((r) => r.json())
      .then(setData);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportar(formato: "csv" | "xlsx") {
    const params = new URLSearchParams({ formato });
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    const a = document.createElement("a");
    a.href = `/api/reportes/export?${params.toString()}`;
    a.click();
  }

  if (!data) return <div className="text-muted text-sm">Cargando reportes…</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reportes</h1>
          <p className="text-sm text-muted">Estadísticas y exportación de datos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => exportar("csv")}>
            <Download size={16} /> CSV
          </Button>
          <Button variant="secondary" onClick={() => exportar("xlsx")}>
            <FileSpreadsheet size={16} /> Excel
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer size={16} /> PDF
          </Button>
        </div>
      </div>

      <Card className="flex flex-wrap items-end gap-3 no-print">
        <div>
          <Label>Desde</Label>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div>
          <Label>Hasta</Label>
          <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <Button onClick={load}>
          <FileText size={16} /> Aplicar
        </Button>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Salidas hoy" value={data.salidasHoy} icon={TrendingDown} tone="brand" />
        <StatCard label="Salidas esta semana" value={data.salidasSemana} icon={CalendarDays} tone="success" />
        <StatCard label="Salidas este mes" value={data.salidasMes} icon={CalendarRange} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold text-foreground mb-3">Premios más entregados</h2>
          <ListaSimple items={data.masEntregados.map((p) => ({ label: p.premio, value: p.cantidad }))} />
        </Card>
        <Card>
          <h2 className="font-semibold text-foreground mb-3">Premios menos utilizados</h2>
          <ListaSimple items={data.menosUtilizados.map((p) => ({ label: p.premio, value: p.totalSalidas }))} />
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold text-foreground mb-3">Usuarios que más premios retiraron</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="p-2 font-medium">Usuario</th>
              <th className="p-2 font-medium">Unidades retiradas</th>
              <th className="p-2 font-medium">Movimientos</th>
            </tr>
          </thead>
          <tbody>
            {data.usuariosTop.map((u) => (
              <tr key={u.usuario} className="border-b border-border last:border-0">
                <td className="p-2 text-foreground">{u.usuario}</td>
                <td className="p-2 font-semibold text-foreground">{u.cantidad}</td>
                <td className="p-2 text-foreground/80">{u.movimientos}</td>
              </tr>
            ))}
            {data.usuariosTop.length === 0 && (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted">
                  Sin datos aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ListaSimple({ items }: { items: Array<{ label: string; value: number }> }) {
  if (items.length === 0) return <p className="text-sm text-muted">Sin datos aún.</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-sm">
          <span className="w-32 truncate text-foreground">{i.label}</span>
          <div className="flex-1 bg-background rounded-full h-2 overflow-hidden">
            <div className="h-full bg-brand rounded-full" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="w-8 text-right font-semibold text-foreground">{i.value}</span>
        </div>
      ))}
    </div>
  );
}
