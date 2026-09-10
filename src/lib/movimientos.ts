import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket-emit";
import { calcularEstado } from "@/lib/estado";

export class StockError extends Error {}

export async function registrarIngreso(params: {
  premioId: string;
  usuarioId: string;
  cantidad: number;
  observacion?: string;
}) {
  const { premioId, usuarioId, cantidad, observacion } = params;
  if (cantidad <= 0) throw new StockError("La cantidad debe ser mayor a 0");

  const resultado = await prisma.$transaction(async (tx) => {
    const premio = await tx.premio.findUnique({ where: { id: premioId } });
    if (!premio || !premio.activo) throw new StockError("Premio no encontrado");

    const stockAnterior = premio.stockActual;
    const stockActual = stockAnterior + cantidad;

    await tx.premio.update({ where: { id: premioId }, data: { stockActual } });

    const movimiento = await tx.movimiento.create({
      data: {
        tipo: "INGRESO",
        premioId,
        usuarioId,
        cantidad,
        stockAnterior,
        stockActual,
        observacion,
      },
      include: { premio: true, usuario: { select: { id: true, nombre: true, username: true, rol: true } } },
    });

    return { movimiento, premio: { ...premio, stockActual } };
  });

  emitEvent("stock:cambio", {
    premioId,
    stockActual: resultado.movimiento.stockActual,
    estado: calcularEstado(resultado.movimiento.stockActual, resultado.premio.stockMinimo),
  });
  emitEvent("movimiento:nuevo", resultado.movimiento);

  return resultado.movimiento;
}

export async function registrarSalida(params: {
  premioId: string;
  usuarioId: string;
  cantidad: number;
  observacion?: string;
  motivo?: string;
}) {
  const { premioId, usuarioId, cantidad, observacion, motivo } = params;
  if (cantidad <= 0) throw new StockError("La cantidad debe ser mayor a 0");

  const resultado = await prisma.$transaction(async (tx) => {
    const premio = await tx.premio.findUnique({ where: { id: premioId } });
    if (!premio || !premio.activo) throw new StockError("Premio no encontrado");

    const stockAnterior = premio.stockActual;
    if (cantidad > stockAnterior) {
      throw new StockError(
        `No hay suficiente stock disponible. Stock actual: ${stockAnterior}`
      );
    }
    const stockActual = stockAnterior - cantidad;

    await tx.premio.update({ where: { id: premioId }, data: { stockActual } });

    const movimiento = await tx.movimiento.create({
      data: {
        tipo: "SALIDA",
        premioId,
        usuarioId,
        cantidad,
        stockAnterior,
        stockActual,
        observacion,
        motivo,
      },
      include: { premio: true, usuario: { select: { id: true, nombre: true, username: true, rol: true } } },
    });

    return { movimiento, premio: { ...premio, stockActual } };
  });

  const estado = calcularEstado(resultado.movimiento.stockActual, resultado.premio.stockMinimo);

  emitEvent("stock:cambio", {
    premioId,
    stockActual: resultado.movimiento.stockActual,
    estado,
  });
  emitEvent("movimiento:nuevo", resultado.movimiento);

  if (estado === "AGOTADO") {
    emitEvent("alerta", {
      tipo: "SIN_STOCK",
      premio: resultado.premio.nombre,
      mensaje: `No quedan ${resultado.premio.nombre} disponibles.`,
    });
  } else if (estado === "BAJO") {
    emitEvent("alerta", {
      tipo: "STOCK_BAJO",
      premio: resultado.premio.nombre,
      mensaje: `Quedan solamente ${resultado.movimiento.stockActual} ${resultado.premio.nombre}.`,
    });
  }

  return resultado.movimiento;
}

export async function registrarAjuste(params: {
  premioId: string;
  usuarioId: string;
  stockFisico: number;
  motivo: string;
}) {
  const { premioId, usuarioId, stockFisico, motivo } = params;
  if (!motivo || motivo.trim().length === 0) {
    throw new StockError("El motivo del ajuste es obligatorio");
  }
  if (stockFisico < 0) throw new StockError("El stock físico no puede ser negativo");

  const resultado = await prisma.$transaction(async (tx) => {
    const premio = await tx.premio.findUnique({ where: { id: premioId } });
    if (!premio || !premio.activo) throw new StockError("Premio no encontrado");

    const stockSistema = premio.stockActual;
    const diferencia = stockFisico - stockSistema;

    await tx.premio.update({ where: { id: premioId }, data: { stockActual: stockFisico } });

    const movimiento = await tx.movimiento.create({
      data: {
        tipo: "AJUSTE",
        premioId,
        usuarioId,
        cantidad: diferencia,
        stockAnterior: stockSistema,
        stockActual: stockFisico,
        motivo,
      },
      include: { premio: true, usuario: { select: { id: true, nombre: true, username: true, rol: true } } },
    });

    const ajuste = await tx.ajuste.create({
      data: {
        movimientoId: movimiento.id,
        stockSistema,
        stockFisico,
        diferencia,
        motivo,
        usuarioId,
      },
    });

    return { movimiento, ajuste, premio: { ...premio, stockActual: stockFisico } };
  });

  const estado = calcularEstado(resultado.movimiento.stockActual, resultado.premio.stockMinimo);

  emitEvent("stock:cambio", {
    premioId,
    stockActual: resultado.movimiento.stockActual,
    estado,
  });
  emitEvent("movimiento:nuevo", resultado.movimiento);
  emitEvent("alerta", {
    tipo: "AJUSTE",
    premio: resultado.premio.nombre,
    mensaje: `Ajuste de stock en ${resultado.premio.nombre}: diferencia de ${resultado.ajuste.diferencia}.`,
  });

  return resultado.movimiento;
}
