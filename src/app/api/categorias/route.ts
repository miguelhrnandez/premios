import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const categorias = await prisma.categoria.findMany({ orderBy: { nombre: "asc" } });
  return NextResponse.json(categorias);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  const { nombre } = await req.json();
  if (!nombre) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });

  const categoria = await prisma.categoria.upsert({
    where: { nombre },
    update: {},
    create: { nombre },
  });
  return NextResponse.json(categoria, { status: 201 });
}
