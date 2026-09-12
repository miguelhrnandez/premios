import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { format as fmtDate } from "date-fns";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const formato = searchParams.get("formato") ?? "csv";
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;

  const where: Prisma.MovimientoWhereInput = {};
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }

  const movimientos = await prisma.movimiento.findMany({
    where,
    include: { premio: true, usuario: true },
    orderBy: { creadoEn: "desc" },
  });

  const filas = movimientos.map((m) => ({
    Fecha: fmtDate(m.creadoEn, "dd/MM/yyyy"),
    Hora: fmtDate(m.creadoEn, "HH:mm"),
    Usuario: m.usuario.nombre,
    Tipo: m.tipo,
    Premio: m.premio.nombre,
    Cantidad: m.cantidad,
    "Stock anterior": m.stockAnterior,
    "Stock actual": m.stockActual,
    Motivo: m.motivo ?? "",
    Observación: m.observacion ?? "",
    Anulado: m.anulado ? "Sí" : "No",
  }));

  if (formato === "xlsx") {
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="historial.xlsx"`,
      },
    });
  }

  const headers = Object.keys(filas[0] ?? { Fecha: "" });
  const csv = [
    headers.join(","),
    ...filas.map((f) =>
      headers.map((h) => `"${String(f[h as keyof typeof f]).replace(/"/g, '""')}"`).join(",")
    ),
  ].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="historial.csv"`,
    },
  });
}
