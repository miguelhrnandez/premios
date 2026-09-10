import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfMonth, subDays, format } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = startOfDay(new Date());
  const inicioMes = startOfMonth(new Date());
  const hace14dias = startOfDay(subDays(new Date(), 13));

  const premios = await prisma.premio.findMany({ where: { activo: true } });
  const totalTipos = premios.length;
  const totalUnidades = premios.reduce((acc, p) => acc + p.stockActual, 0);
  const stockBajo = premios.filter((p) => p.stockActual > 0 && p.stockActual <= p.stockMinimo).length;
  const agotados = premios.filter((p) => p.stockActual <= 0).length;

  const [salidasHoy, salidasMes, ultimosMovimientos, movimientosRango] = await Promise.all([
    prisma.movimiento.aggregate({
      where: { tipo: "SALIDA", anulado: false, creadoEn: { gte: hoy } },
      _sum: { cantidad: true },
    }),
    prisma.movimiento.aggregate({
      where: { tipo: "SALIDA", anulado: false, creadoEn: { gte: inicioMes } },
      _sum: { cantidad: true },
    }),
    prisma.movimiento.findMany({
      where: { anulado: false },
      orderBy: { creadoEn: "desc" },
      take: 10,
      include: {
        premio: { select: { nombre: true, imagenUrl: true } },
        usuario: { select: { nombre: true } },
      },
    }),
    prisma.movimiento.findMany({
      where: { anulado: false, creadoEn: { gte: hace14dias }, tipo: { in: ["INGRESO", "SALIDA"] } },
      select: { tipo: true, cantidad: true, creadoEn: true },
    }),
  ]);

  const porDia = new Map<string, { ingresos: number; salidas: number }>();
  for (let i = 0; i < 14; i++) {
    const d = format(subDays(new Date(), 13 - i), "dd/MM");
    porDia.set(d, { ingresos: 0, salidas: 0 });
  }
  for (const m of movimientosRango) {
    const key = format(m.creadoEn, "dd/MM");
    const entry = porDia.get(key);
    if (!entry) continue;
    if (m.tipo === "INGRESO") entry.ingresos += m.cantidad;
    else entry.salidas += m.cantidad;
  }
  const grafico = Array.from(porDia.entries()).map(([fecha, v]) => ({ fecha, ...v }));

  const masRetirados = await prisma.movimiento.groupBy({
    by: ["premioId"],
    where: { tipo: "SALIDA", anulado: false },
    _sum: { cantidad: true },
    orderBy: { _sum: { cantidad: "desc" } },
    take: 5,
  });
  const premiosMasRetirados = await Promise.all(
    masRetirados.map(async (m) => {
      const premio = await prisma.premio.findUnique({ where: { id: m.premioId } });
      return { premio: premio?.nombre ?? "—", cantidad: m._sum.cantidad ?? 0 };
    })
  );

  const ultimosRetiros = await prisma.movimiento.findMany({
    where: { tipo: "SALIDA", anulado: false },
    orderBy: { creadoEn: "desc" },
    take: 5,
    include: {
      usuario: { select: { nombre: true } },
      premio: { select: { nombre: true } },
    },
  });

  return NextResponse.json({
    totalTipos,
    totalUnidades,
    stockBajo,
    agotados,
    salidasHoy: salidasHoy._sum.cantidad ?? 0,
    salidasMes: salidasMes._sum.cantidad ?? 0,
    ultimosMovimientos,
    premiosMasRetirados,
    ultimosRetiros,
    grafico,
    premiosAlerta: premios.filter((p) => p.stockActual <= p.stockMinimo),
  });
}
