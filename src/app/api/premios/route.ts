import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket-emit";
import { registrarAuditoria } from "@/lib/auditoria";
import { z } from "zod";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const premios = await prisma.premio.findMany({
    include: { categoria: true },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json(premios);
}

const premioSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().optional(),
  imagenUrl: z.string().optional(),
  categoriaId: z.string().optional().nullable(),
  categoriaNombre: z.string().optional(),
  stockMinimo: z.coerce.number().int().min(0).default(0),
  stockInicial: z.coerce.number().int().min(0).default(0),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = premioSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  let categoriaId = data.categoriaId ?? null;
  if (!categoriaId && data.categoriaNombre) {
    const categoria = await prisma.categoria.upsert({
      where: { nombre: data.categoriaNombre },
      update: {},
      create: { nombre: data.categoriaNombre },
    });
    categoriaId = categoria.id;
  }

  const existente = await prisma.premio.findUnique({ where: { codigo: data.codigo } });
  if (existente) {
    return NextResponse.json({ error: "Ya existe un premio con ese código" }, { status: 409 });
  }

  const premio = await prisma.premio.create({
    data: {
      codigo: data.codigo,
      nombre: data.nombre,
      descripcion: data.descripcion,
      imagenUrl: data.imagenUrl,
      categoriaId,
      stockMinimo: data.stockMinimo,
      stockActual: data.stockInicial,
    },
    include: { categoria: true },
  });

  await registrarAuditoria({
    entidad: "Premio",
    entidadId: premio.id,
    accion: "CREAR",
    usuarioId: session.user.id,
    datosDespues: premio,
  });

  emitEvent("premio:nuevo", premio);

  return NextResponse.json(premio, { status: 201 });
}
