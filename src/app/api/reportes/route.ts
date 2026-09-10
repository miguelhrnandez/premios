import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde") ? new Date(searchParams.get("desde")!) : undefined;
  const hasta = searchParams.get("hasta") ? new Date(searchParams.get("hasta")!) : undefined;

  const rango = {
    ...(desde || hasta
      ? { creadoEn: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } }
      : {}),
  };

  const [masEntregados, menosUtilizados, usuariosTop, salidasHoy, salidasSemana, salidasMes] =
    await Promise.all([
      prisma.movimiento.groupBy({
        by: ["premioId"],
        where: { tipo: "SALIDA", anulado: false, ...rango },
        _sum: { cantidad: true },
        orderBy: { _sum: { cantidad: "desc" } },
        take: 10,
      }),
      prisma.premio.findMany({
        where: { activo: true },
        include: { movimientos: { where: { tipo: "SALIDA", anulado: false } } },
      }),
      prisma.movimiento.groupBy({
        by: ["usuarioId"],
        where: { tipo: "SALIDA", anulado: false, ...rango },
        _sum: { cantidad: true },
        _count: true,
        orderBy: { _sum: { cantidad: "desc" } },
        take: 10,
      }),
      prisma.movimiento.aggregate({
        where: { tipo: "SALIDA", anulado: false, creadoEn: { gte: startOfDay(new Date()) } },
        _sum: { cantidad: true },
      }),
      prisma.movimiento.aggregate({
        where: {
          tipo: "SALIDA",
          anulado: false,
          creadoEn: { gte: startOfWeek(new Date(), { weekStartsOn: 1 }) },
        },
        _sum: { cantidad: true },
      }),
      prisma.movimiento.aggregate({
        where: { tipo: "SALIDA", anulado: false, creadoEn: { gte: startOfMonth(new Date()) } },
        _sum: { cantidad: true },
      }),
    ]);

  const premiosMap = await prisma.premio.findMany();
  const usuariosMap = await prisma.usuario.findMany();

  const menosUtilizadosOrdenado = menosUtilizados
    .map((p) => ({
      premio: p.nombre,
      totalSalidas: p.movimientos.reduce((a, m) => a + m.cantidad, 0),
    }))
    .sort((a, b) => a.totalSalidas - b.totalSalidas)
    .slice(0, 10);

  return NextResponse.json({
    masEntregados: masEntregados.map((m) => ({
      premio: premiosMap.find((p) => p.id === m.premioId)?.nombre ?? "—",
      cantidad: m._sum.cantidad ?? 0,
    })),
    menosUtilizados: menosUtilizadosOrdenado,
    usuariosTop: usuariosTop.map((u) => ({
      usuario: usuariosMap.find((us) => us.id === u.usuarioId)?.nombre ?? "—",
      cantidad: u._sum.cantidad ?? 0,
      movimientos: u._count,
    })),
    salidasHoy: salidasHoy._sum.cantidad ?? 0,
    salidasSemana: salidasSemana._sum.cantidad ?? 0,
    salidasMes: salidasMes._sum.cantidad ?? 0,
  });
}
