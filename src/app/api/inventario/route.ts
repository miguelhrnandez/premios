import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { registrarAjuste, StockError } from "@/lib/movimientos";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const premioId = searchParams.get("premioId") ?? undefined;

  const inventarios = await prisma.inventario.findMany({
    where: premioId ? { premioId } : undefined,
    include: {
      premio: { select: { nombre: true, codigo: true } },
      usuario: { select: { nombre: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 100,
  });
  return NextResponse.json(inventarios);
}

const schema = z.object({
  premioId: z.string(),
  stockFisico: z.coerce.number().int().min(0),
  motivo: z.string().optional(),
  confirmarAjuste: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { premioId, stockFisico, motivo, confirmarAjuste } = parsed.data;

  const premio = await prisma.premio.findUnique({ where: { id: premioId } });
  if (!premio) return NextResponse.json({ error: "Premio no encontrado" }, { status: 404 });

  const stockSistema = premio.stockActual;
  const diferencia = stockFisico - stockSistema;

  const inventario = await prisma.inventario.create({
    data: {
      premioId,
      usuarioId: session.user.id,
      stockSistema,
      stockFisico,
      diferencia,
      motivo,
      ajustado: confirmarAjuste && diferencia !== 0,
    },
  });

  if (confirmarAjuste && diferencia !== 0) {
    if (!motivo) {
      return NextResponse.json({ error: "El motivo es obligatorio para confirmar el ajuste" }, { status: 400 });
    }
    try {
      await registrarAjuste({ premioId, usuarioId: session.user.id, stockFisico, motivo });
    } catch (err) {
      if (err instanceof StockError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  return NextResponse.json(inventario, { status: 201 });
}
