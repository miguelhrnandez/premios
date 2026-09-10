import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash("admin123", 10);
  const userPass = await bcrypt.hash("usuario123", 10);

  const admin = await prisma.usuario.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPass,
      nombre: "Administrador General",
      rol: "ADMIN",
    },
  });

  const juan = await prisma.usuario.upsert({
    where: { username: "jperez" },
    update: {},
    create: {
      username: "jperez",
      password: userPass,
      nombre: "Juan Pérez",
      rol: "USUARIO",
    },
  });

  const categorias = await Promise.all(
    ["Tecnología", "Indumentaria", "Vajilla", "Gift Cards"].map((nombre) =>
      prisma.categoria.upsert({ where: { nombre }, update: {}, create: { nombre } })
    )
  );

  const [tecno, indumentaria, vajilla, giftcards] = categorias;

  const premiosData = [
    { codigo: "AUR-001", nombre: "Auriculares", categoriaId: tecno.id, stockActual: 70, stockMinimo: 10 },
    { codigo: "PAR-001", nombre: "Parlantes", categoriaId: tecno.id, stockActual: 30, stockMinimo: 5 },
    { codigo: "VAS-001", nombre: "Vasos", categoriaId: vajilla.id, stockActual: 100, stockMinimo: 20 },
    { codigo: "REM-001", nombre: "Remeras", categoriaId: indumentaria.id, stockActual: 8, stockMinimo: 10 },
    { codigo: "GFT-001", nombre: "Gift Cards", categoriaId: giftcards.id, stockActual: 0, stockMinimo: 5 },
  ];

  for (const p of premiosData) {
    await prisma.premio.upsert({
      where: { codigo: p.codigo },
      update: {},
      create: p,
    });
  }

  const auriculares = await prisma.premio.findUnique({ where: { codigo: "AUR-001" } });
  if (auriculares) {
    const existente = await prisma.movimiento.findFirst({ where: { premioId: auriculares.id } });
    if (!existente) {
      await prisma.movimiento.create({
        data: {
          tipo: "INGRESO",
          premioId: auriculares.id,
          usuarioId: admin.id,
          cantidad: 70,
          stockAnterior: 0,
          stockActual: 70,
          observacion: "Carga inicial de stock",
        },
      });
      await prisma.movimiento.create({
        data: {
          tipo: "SALIDA",
          premioId: auriculares.id,
          usuarioId: juan.id,
          cantidad: 3,
          stockAnterior: 70,
          stockActual: 67,
          motivo: "Premios entregados",
        },
      });
      await prisma.premio.update({ where: { id: auriculares.id }, data: { stockActual: 67 } });
    }
  }

  console.log("Seed completado. Usuarios: admin/admin123 (ADMIN), jperez/usuario123 (USUARIO)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
