import type { Server as IOServer } from "socket.io";

type GlobalWithIO = typeof globalThis & { __io?: IOServer };

export function emitEvent(event: string, payload: unknown) {
  const g = globalThis as GlobalWithIO;
  if (g.__io) {
    g.__io.emit(event, payload);
  }
}
