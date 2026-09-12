import { prisma } from "@/lib/prisma";

export async function registrarAuditoria(params: {
  entidad: string;
  entidadId: string;
  accion: string;
  usuarioId: string;
  datosAntes?: unknown;
  datosDespues?: unknown;
  motivo?: string;
  movimientoId?: string;
}) {
  await prisma.auditoria.create({
    data: {
      entidad: params.entidad,
      entidadId: params.entidadId,
      accion: params.accion,
      usuarioId: params.usuarioId,
      datosAntes: params.datosAntes ? JSON.stringify(params.datosAntes) : null,
      datosDespues: params.datosDespues ? JSON.stringify(params.datosDespues) : null,
      motivo: params.motivo,
      movimientoId: params.movimientoId,
    },
  });
}
