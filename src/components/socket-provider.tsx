"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@/components/toast";

const SocketContext = createContext<Socket | null>(null);

export function useSocket() {
  return useContext(SocketContext);
}

export function useSocketEvent<T = unknown>(event: string, handler: (payload: T) => void) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, event]);
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { push } = useToast();
  const pushRef = useRef(push);
  pushRef.current = push;

  useEffect(() => {
    const s = io({ path: "/api/socket" });
    setSocket(s);

    s.on(
      "alerta",
      (payload: { tipo: string; premio: string; mensaje: string }) => {
        pushRef.current({
          type: payload.tipo === "SIN_STOCK" ? "error" : "warning",
          title:
            payload.tipo === "SIN_STOCK"
              ? "🚨 Sin stock"
              : payload.tipo === "AJUSTE"
                ? "🛠️ Ajuste de inventario"
                : "⚠️ Stock bajo",
          message: payload.mensaje,
        });
      }
    );

    return () => {
      s.disconnect();
    };
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}
