export type EstadoStock = "OK" | "BAJO" | "AGOTADO";

export function calcularEstado(stockActual: number, stockMinimo: number): EstadoStock {
  if (stockActual <= 0) return "AGOTADO";
  if (stockActual <= stockMinimo) return "BAJO";
  return "OK";
}
