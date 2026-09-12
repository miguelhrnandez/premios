export type Role = "ADMIN" | "USUARIO";
export type TipoMovimiento = "INGRESO" | "SALIDA" | "AJUSTE";
export type EstadoStock = "OK" | "BAJO" | "AGOTADO";

export interface Categoria {
  id: string;
  nombre: string;
}

export interface Premio {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  categoriaId: string | null;
  categoria: Categoria | null;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  rol: Role;
  activo: boolean;
  creadoEn: string;
  _count?: { movimientos: number };
}

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  premioId: string;
  premio: { nombre: string; codigo?: string; imagenUrl: string | null };
  usuarioId: string;
  usuario: { nombre: string; username: string };
  cantidad: number;
  stockAnterior: number;
  stockActual: number;
  motivo: string | null;
  observacion: string | null;
  anulado: boolean;
  creadoEn: string;
}
