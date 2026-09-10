import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket-emit";
import { registrarAuditoria } from "@/lib/auditoria";
import { z } from "zod";

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional().nullable(),
  imagenUrl: z.string().optional().nullable(),
  categoriaId: z.string().optional().nullable(),
  stockMinimo: z.coerce.number().int().min(0).optional(),
  activo: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;

  const premio = await prisma.premio.findUnique({
    where: { id },
    include: {
      categoria: true,
      movimientos: {
        orderBy: { creadoEn: "desc" },
        take: 50,
        include: { usuario: { select: { nombre: true, username: true } } },
      },
    },
  });
  if (!premio) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(premio);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const antes = await prisma.premio.findUnique({ where: { id } });
  if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const premio = await prisma.premio.update({
    where: { id },
    data: parsed.data,
    include: { categoria: true },
  });

  await registrarAuditoria({
    entidad: "Premio",
    entidadId: id,
    accion: "EDITAR",
    usuarioId: session.user.id,
    datosAntes: antes,
    datosDespues: premio,
  });

  emitEvent("premio:actualizado", premio);

  return NextResponse.json(premio);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { id } = await params;

  const antes = await prisma.premio.findUnique({ where: { id } });
  if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const premio = await prisma.premio.update({
    where: { id },
    data: { activo: false },
  });

  await registrarAuditoria({
    entidad: "Premio",
    entidadId: id,
    accion: "DESACTIVAR",
    usuarioId: session.user.id,
    datosAntes: antes,
    datosDespues: premio,
  });

  emitEvent("premio:actualizado", premio);

  return NextResponse.json(premio);
}
