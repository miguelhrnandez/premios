"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { SocketProvider } from "@/components/socket-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <ToastProvider>
          <SocketProvider>{children}</SocketProvider>
        </ToastProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
