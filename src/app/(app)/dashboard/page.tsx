"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, Boxes, AlertTriangle, XCircle, TrendingDown, CalendarDays } from "lucide-react";
import { Card, StatCard, EstadoBadge } from "@/components/ui";
import { useSocketEvent } from "@/components/socket-provider";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { calcularEstado } from "@/lib/estado";
import { format } from "date-fns";

interface DashboardData {
  totalTipos: number;
  totalUnidades: number;
  stockBajo: number;
  agotados: number;
  salidasHoy: number;
  salidasMes: number;
  ultimosMovimientos: Array<{
    id: string;
    tipo: string;
    cantidad: number;
    creadoEn: string;
    premio: { nombre: string };
    usuario: { nombre: string };
  }>;
  premiosMasRetirados: Array<{ premio: string; cantidad: number }>;
  ultimosRetiros: Array<{
    id: string;
    cantidad: number;
    creadoEn: string;
    premio: { nombre: string };
    usuario: { nombre: string };
  }>;
  grafico: Array<{ fecha: string; ingresos: number; salidas: number }>;
  premiosAlerta: Array<{ id: string; nombre: string; stockActual: number; stockMinimo: number }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  const load = useCallback(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent("stock:cambio", () => load());
  useSocketEvent("movimiento:nuevo", () => load());

  if (!data) {
    return <div className="text-muted text-sm">Cargando dashboard…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted">Resumen general del stock de premios</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Tipos de premios" value={data.totalTipos} icon={Package} tone="brand" />
        <StatCard label="Unidades en stock" value={data.totalUnidades} icon={Boxes} tone="success" />
        <StatCard label="Stock bajo" value={data.stockBajo} icon={AlertTriangle} tone="warning" />
        <StatCard label="Agotados" value={data.agotados} icon={XCircle} tone="danger" />
        <StatCard label="Retirados hoy" value={data.salidasHoy} icon={TrendingDown} tone="default" />
        <StatCard label="Retirados este mes" value={data.salidasMes} icon={CalendarDays} tone="default" />
      </div>

      {data.premiosAlerta.length > 0 && (
        <Card className="border-amber-500/30">
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" /> Alertas de stock
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.premiosAlerta.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">{p.nombre}</span>
                <span className="text-muted">({p.stockActual} u.)</span>
                <EstadoBadge estado={calcularEstado(p.stockActual, p.stockMinimo)} />
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <h2 className="font-semibold text-foreground mb-4">Ingresos y salidas (últimos 14 días)</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.grafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 12 }} stroke="var(--muted)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" />
              <Line type="monotone" dataKey="salidas" stroke="#3b82f6" strokeWidth={2} name="Salidas" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <h2 className="font-semibold text-foreground mb-4">Premios más retirados</h2>
          <div className="flex flex-col gap-3">
            {data.premiosMasRetirados.length === 0 && (
              <p className="text-sm text-muted">Sin datos aún.</p>
            )}
            {data.premiosMasRetirados.map((p, i) => (
              <div key={p.premio} className="flex items-center justify-between text-sm">
                <span className="text-foreground">
                  <span className="text-muted mr-2">#{i + 1}</span>
                  {p.premio}
                </span>
                <span className="font-semibold text-foreground">{p.cantidad}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-semibold text-foreground mb-4">Últimos movimientos</h2>
          <div className="flex flex-col divide-y divide-border">
            {data.ultimosMovimientos.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-foreground font-medium">{m.premio.nombre}</p>
                  <p className="text-muted text-xs">
                    {m.usuario.nombre} · {format(new Date(m.creadoEn), "dd/MM HH:mm")}
                  </p>
                </div>
                <span
                  className={
                    m.tipo === "INGRESO"
                      ? "text-emerald-500 font-semibold"
                      : m.tipo === "SALIDA"
                        ? "text-blue-500 font-semibold"
                        : "text-purple-500 font-semibold"
                  }
                >
                  {m.tipo === "INGRESO" ? "+" : m.tipo === "SALIDA" ? "-" : "±"}
                  {Math.abs(m.cantidad)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-foreground mb-4">Últimos retiros</h2>
          <div className="flex flex-col divide-y divide-border">
            {data.ultimosRetiros.map((m) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="text-foreground font-medium">{m.usuario.nombre}</p>
                  <p className="text-muted text-xs">
                    {m.premio.nombre} · {format(new Date(m.creadoEn), "dd/MM HH:mm")}
                  </p>
                </div>
                <span className="font-semibold text-foreground">{m.cantidad} u.</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
