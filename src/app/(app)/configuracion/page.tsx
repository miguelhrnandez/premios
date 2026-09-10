"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Moon, Sun, Plus, Tag } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Card, Button, Input } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Categoria } from "@/lib/types";

export default function ConfiguracionPage() {
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const { push } = useToast();
  const isAdmin = session?.user.role === "ADMIN";
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    fetch("/api/categorias").then((r) => r.json()).then(setCategorias);
  }, []);

  async function agregarCategoria(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const res = await fetch("/api/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (res.ok) {
      const data = await res.json();
      setCategorias((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data]));
      setNombre("");
      push({ type: "success", title: "Categoría agregada" });
    }
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted">Preferencias de la aplicación</p>
      </div>

      <Card className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Modo oscuro</p>
          <p className="text-sm text-muted">Cambiá la apariencia de la aplicación</p>
        </div>
        <Button variant="secondary" onClick={toggle}>
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Modo claro" : "Modo oscuro"}
        </Button>
      </Card>

      {isAdmin && (
        <Card>
          <h2 className="font-semibold text-foreground mb-3 flex items-center gap-2">
            <Tag size={18} /> Categorías de premios
          </h2>
          <form onSubmit={agregarCategoria} className="flex gap-2 mb-4">
            <Input
              placeholder="Nueva categoría"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Button type="submit">
              <Plus size={16} /> Agregar
            </Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {categorias.map((c) => (
              <span
                key={c.id}
                className="px-3 py-1.5 rounded-full bg-background border border-border text-sm text-foreground"
              >
                {c.nombre}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
