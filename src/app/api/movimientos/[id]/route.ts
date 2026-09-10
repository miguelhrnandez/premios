import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket-emit";
import { registrarAuditoria } from "@/lib/auditoria";
import { calcularEstado } from "@/lib/estado";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;
  const { motivo } = await req.json();
  if (!motivo || motivo.trim().length === 0) {
    return NextResponse.json({ error: "El motivo es obligatorio para anular un movimiento" }, { status: 400 });
  }

  const resultado = await prisma.$transaction(async (tx) => {
    const movimiento = await tx.movimiento.findUnique({ where: { id }, include: { premio: true } });
    if (!movimiento) throw new Error("NOT_FOUND");
    if (movimiento.anulado) throw new Error("ALREADY_ANULADO");

    const premio = movimiento.premio;
    // Revertir el efecto del movimiento sobre el stock actual del premio.
    let nuevoStock = premio.stockActual;
    if (movimiento.tipo === "INGRESO") {
      nuevoStock -= movimiento.cantidad;
    } else if (movimiento.tipo === "SALIDA") {
      nuevoStock += movimiento.cantidad;
    } else if (movimiento.tipo === "AJUSTE") {
      nuevoStock = movimiento.stockAnterior;
    }
    if (nuevoStock < 0) throw new Error("STOCK_NEGATIVO");

    await tx.premio.update({ where: { id: premio.id }, data: { stockActual: nuevoStock } });

    const actualizado = await tx.movimiento.update({
      where: { id },
      data: { anulado: true },
    });

    return { movimiento, actualizado, premio: { ...premio, stockActual: nuevoStock } };
  }).catch((e: Error) => {
    if (e.message === "NOT_FOUND") return { error: 404, message: "No encontrado" } as const;
    if (e.message === "ALREADY_ANULADO")
      return { error: 400, message: "El movimiento ya fue anulado" } as const;
    if (e.message === "STOCK_NEGATIVO")
      return { error: 400, message: "No se puede anular: dejaría el stock en negativo" } as const;
    throw e;
  });

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.message }, { status: resultado.error });
  }

  await registrarAuditoria({
    entidad: "Movimiento",
    entidadId: id,
    accion: "ANULAR",
    usuarioId: session.user.id,
    datosAntes: resultado.movimiento,
    datosDespues: resultado.actualizado,
    motivo,
    movimientoId: id,
  });

  emitEvent("stock:cambio", {
    premioId: resultado.premio.id,
    stockActual: resultado.premio.stockActual,
    estado: calcularEstado(resultado.premio.stockActual, resultado.premio.stockMinimo),
  });
  emitEvent("movimiento:anulado", resultado.actualizado);

  return NextResponse.json(resultado.actualizado);
}
