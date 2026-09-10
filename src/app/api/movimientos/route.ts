import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarIngreso, registrarSalida, StockError } from "@/lib/movimientos";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const usuarioId = searchParams.get("usuarioId") ?? undefined;
  const premioId = searchParams.get("premioId") ?? undefined;
  const tipo = searchParams.get("tipo") ?? undefined;
  const desde = searchParams.get("desde") ?? undefined;
  const hasta = searchParams.get("hasta") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const pageSize = Math.min(parseInt(searchParams.get("pageSize") ?? "50", 10), 200);

  const where: Prisma.MovimientoWhereInput = {};
  if (usuarioId) where.usuarioId = usuarioId;
  if (premioId) where.premioId = premioId;
  if (tipo) where.tipo = tipo as Prisma.EnumTipoMovimientoFilter["equals"];
  if (desde || hasta) {
    where.creadoEn = {};
    if (desde) where.creadoEn.gte = new Date(desde);
    if (hasta) where.creadoEn.lte = new Date(hasta);
  }
  if (q) {
    where.OR = [
      { premio: { nombre: { contains: q, mode: "insensitive" } } },
      { usuario: { nombre: { contains: q, mode: "insensitive" } } },
      { observacion: { contains: q, mode: "insensitive" } },
    ];
  }

  // Los usuarios no-admin solo ven sus propios movimientos en su historial personal,
  // salvo cuando consultan el historial general (permitido a todos para trazabilidad de premios).

  const [movimientos, total] = await Promise.all([
    prisma.movimiento.findMany({
      where,
      include: {
        premio: { select: { nombre: true, codigo: true, imagenUrl: true } },
        usuario: { select: { nombre: true, username: true } },
        ajuste: true,
      },
      orderBy: { creadoEn: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.movimiento.count({ where }),
  ]);

  return NextResponse.json({ movimientos, total, page, pageSize });
}

const movSchema = z.object({
  tipo: z.enum(["INGRESO", "SALIDA"]),
  premioId: z.string(),
  cantidad: z.coerce.number().int().positive(),
  observacion: z.string().optional(),
  motivo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = movSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { tipo, premioId, cantidad, observacion, motivo } = parsed.data;

  if (tipo === "INGRESO" && session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo un administrador puede registrar ingresos de stock" },
      { status: 403 }
    );
  }

  try {
    const movimiento =
      tipo === "INGRESO"
        ? await registrarIngreso({
            premioId,
            usuarioId: session.user.id,
            cantidad,
            observacion,
          })
        : await registrarSalida({
            premioId,
            usuarioId: session.user.id,
            cantidad,
            observacion,
            motivo,
          });

    return NextResponse.json(movimiento, { status: 201 });
  } catch (err) {
    if (err instanceof StockError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
