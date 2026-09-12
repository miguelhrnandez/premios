import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { registrarAuditoria } from "@/lib/auditoria";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      username: true,
      nombre: true,
      rol: true,
      activo: true,
      creadoEn: true,
      _count: { select: { movimientos: true } },
    },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(usuarios);
}

const schema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  nombre: z.string().min(1),
  rol: z.enum(["ADMIN", "USUARIO"]).default("USUARIO"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existente = await prisma.usuario.findUnique({ where: { username: parsed.data.username } });
  if (existente) return NextResponse.json({ error: "El usuario ya existe" }, { status: 409 });

  const hash = await bcrypt.hash(parsed.data.password, 10);
  const usuario = await prisma.usuario.create({
    data: {
      username: parsed.data.username,
      password: hash,
      nombre: parsed.data.nombre,
      rol: parsed.data.rol,
    },
    select: { id: true, username: true, nombre: true, rol: true, activo: true, creadoEn: true },
  });

  await registrarAuditoria({
    entidad: "Usuario",
    entidadId: usuario.id,
    accion: "CREAR",
    usuarioId: session.user.id,
    datosDespues: usuario,
  });

  return NextResponse.json(usuario, { status: 201 });
}
