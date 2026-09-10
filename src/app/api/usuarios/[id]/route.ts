import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";

const schema = z.object({
  nombre: z.string().min(1).optional(),
  rol: z.enum(["ADMIN", "USUARIO"]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const antes = await prisma.usuario.findUnique({ where: { id } });
  if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const data: { nombre?: string; rol?: "ADMIN" | "USUARIO"; activo?: boolean; password?: string } = {
    ...parsed.data,
  };
  if (parsed.data.password) {
    data.password = await bcrypt.hash(parsed.data.password, 10);
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data,
    select: { id: true, username: true, nombre: true, rol: true, activo: true, creadoEn: true },
  });

  await registrarAuditoria({
    entidad: "Usuario",
    entidadId: id,
    accion: "EDITAR",
    usuarioId: session.user.id,
    datosAntes: { ...antes, password: undefined },
    datosDespues: usuario,
  });

  return NextResponse.json(usuario);
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
  if (id === session.user.id) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }

  const antes = await prisma.usuario.findUnique({ where: { id } });
  if (!antes) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const usuario = await prisma.usuario.update({ where: { id }, data: { activo: false } });

  await registrarAuditoria({
    entidad: "Usuario",
    entidadId: id,
    accion: "DESACTIVAR",
    usuarioId: session.user.id,
    datosAntes: antes,
    datosDespues: usuario,
  });

  return NextResponse.json({ ok: true });
}
