"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Search, Plus, Pencil, Trash2, ImageOff } from "lucide-react";
import { Card, Button, Input, Select, Label, Textarea, Modal, ConfirmModal, EstadoBadge } from "@/components/ui";
import { useSocketEvent } from "@/components/socket-provider";
import { useToast } from "@/components/toast";
import { calcularEstado } from "@/lib/estado";
import type { Premio, Categoria } from "@/lib/types";

export default function PremiosPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user.role === "ADMIN";
  const { push } = useToast();

  const [premios, setPremios] = useState<Premio[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [q, setQ] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"" | "BAJO" | "AGOTADO">("");
  const [orden, setOrden] = useState<"nombre" | "stockAsc" | "stockDesc">("nombre");

  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Premio | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Premio | null>(null);

  const load = useCallback(() => {
    fetch("/api/premios").then((r) => r.json()).then(setPremios);
    fetch("/api/categorias").then((r) => r.json()).then(setCategorias);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent("stock:cambio", (payload: { premioId: string; stockActual: number }) => {
    setPremios((prev) =>
      prev.map((p) => (p.id === payload.premioId ? { ...p, stockActual: payload.stockActual } : p))
    );
  });
  useSocketEvent("premio:nuevo", () => load());
  useSocketEvent("premio:actualizado", (p: Premio) => {
    setPremios((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  });

  const filtrados = useMemo(() => {
    let list = premios.filter((p) => p.activo);
    if (q) list = list.filter((p) => p.nombre.toLowerCase().includes(q.toLowerCase()) || p.codigo.toLowerCase().includes(q.toLowerCase()));
    if (categoriaFiltro) list = list.filter((p) => p.categoriaId === categoriaFiltro);
    if (filtroEstado)
      list = list.filter((p) => calcularEstado(p.stockActual, p.stockMinimo) === filtroEstado);
    if (orden === "nombre") list = [...list].sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (orden === "stockAsc") list = [...list].sort((a, b) => a.stockActual - b.stockActual);
    if (orden === "stockDesc") list = [...list].sort((a, b) => b.stockActual - a.stockActual);
    return list;
  }, [premios, q, categoriaFiltro, filtroEstado, orden]);

  async function handleDelete() {
    if (!confirmDelete) return;
    const res = await fetch(`/api/premios/${confirmDelete.id}`, { method: "DELETE" });
    if (res.ok) {
      push({ type: "success", title: "Premio desactivado" });
      setPremios((prev) => prev.filter((p) => p.id !== confirmDelete.id));
    } else {
      push({ type: "error", title: "Error al desactivar" });
    }
    setConfirmDelete(null);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Stock de Premios</h1>
          <p className="text-sm text-muted">Control de inventario de premios de la sucursal</p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => {
              setEditando(null);
              setModalOpen(true);
            }}
          >
            <Plus size={16} /> Nuevo premio
          </Button>
        )}
      </div>

      <Card className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            placeholder="Buscar por nombre o código…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)} className="max-w-[180px]">
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as "" | "BAJO" | "AGOTADO")}
          className="max-w-[170px]"
        >
          <option value="">Todos los estados</option>
          <option value="BAJO">Solo stock bajo</option>
          <option value="AGOTADO">Solo agotados</option>
        </Select>
        <Select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="max-w-[190px]">
          <option value="nombre">Ordenar: Nombre</option>
          <option value="stockAsc">Ordenar: Stock ascendente</option>
          <option value="stockDesc">Ordenar: Stock descendente</option>
        </Select>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="p-3 font-medium">Imagen</th>
              <th className="p-3 font-medium">Premio</th>
              <th className="p-3 font-medium">Categoría</th>
              <th className="p-3 font-medium">Stock actual</th>
              <th className="p-3 font-medium">Stock mínimo</th>
              <th className="p-3 font-medium">Estado</th>
              {isAdmin && <th className="p-3 font-medium">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background/60">
                <td className="p-3">
                  {p.imagenUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagenUrl} alt={p.nombre} className="w-10 h-10 rounded-lg object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center text-muted">
                      <ImageOff size={16} />
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <p className="font-medium text-foreground">{p.nombre}</p>
                  <p className="text-xs text-muted">{p.codigo}</p>
                </td>
                <td className="p-3 text-foreground/80">{p.categoria?.nombre ?? "—"}</td>
                <td className="p-3 font-semibold text-foreground">{p.stockActual}</td>
                <td className="p-3 text-foreground/80">{p.stockMinimo}</td>
                <td className="p-3">
                  <EstadoBadge estado={calcularEstado(p.stockActual, p.stockMinimo)} />
                </td>
                {isAdmin && (
                  <td className="p-3">
                    <div className="flex items-center gap-1">
                      <button
                        className="p-2 rounded-lg hover:bg-background text-foreground"
                        onClick={() => {
                          setEditando(p);
                          setModalOpen(true);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="p-2 rounded-lg hover:bg-background text-red-500"
                        onClick={() => setConfirmDelete(p)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted">
                  No se encontraron premios con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <PremioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        premio={editando}
        categorias={categorias}
        onSaved={(p) => {
          setModalOpen(false);
          if (editando) {
            setPremios((prev) => prev.map((x) => (x.id === p.id ? p : x)));
          } else {
            setPremios((prev) => [...prev, p]);
          }
          load();
        }}
      />

      <ConfirmModal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Desactivar premio"
        message={`¿Confirmás desactivar "${confirmDelete?.nombre}"? Ya no aparecerá disponible para nuevos movimientos, pero se conserva su historial.`}
        danger
      />
    </div>
  );
}

function PremioModal({
  open,
  onClose,
  premio,
  categorias,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  premio: Premio | null;
  categorias: Categoria[];
  onSaved: (p: Premio) => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    imagenUrl: "",
    categoriaId: "",
    categoriaNombre: "",
    stockMinimo: 0,
    stockInicial: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (premio) {
      setForm({
        codigo: premio.codigo,
        nombre: premio.nombre,
        descripcion: premio.descripcion ?? "",
        imagenUrl: premio.imagenUrl ?? "",
        categoriaId: premio.categoriaId ?? "",
        categoriaNombre: "",
        stockMinimo: premio.stockMinimo,
        stockInicial: premio.stockActual,
      });
    } else {
      setForm({
        codigo: "",
        nombre: "",
        descripcion: "",
        imagenUrl: "",
        categoriaId: "",
        categoriaNombre: "",
        stockMinimo: 0,
        stockInicial: 0,
      });
    }
    setError("");
  }, [premio, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (premio) {
      const res = await fetch(`/api/premios/${premio.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          imagenUrl: form.imagenUrl || null,
          categoriaId: form.categoriaId || null,
          stockMinimo: Number(form.stockMinimo),
        }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(data.error?.formErrors?.[0] ?? "Error al guardar");
        return;
      }
      push({ type: "success", title: "Premio actualizado" });
      onSaved(data);
    } else {
      const res = await fetch("/api/premios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Error al crear el premio");
        return;
      }
      push({ type: "success", title: "Premio creado" });
      onSaved(data);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={premio ? "Editar premio" : "Nuevo premio"} wide>
      <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Código</Label>
          <Input
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            required
            disabled={!!premio}
          />
        </div>
        <div>
          <Label>Nombre</Label>
          <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </div>
        <div className="sm:col-span-2">
          <Label>Descripción</Label>
          <Textarea
            rows={2}
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Imagen (URL opcional)</Label>
          <Input value={form.imagenUrl} onChange={(e) => setForm({ ...form, imagenUrl: e.target.value })} />
        </div>
        <div>
          <Label>Categoría existente</Label>
          <Select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
            <option value="">Sin categoría</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
        </div>
        {!premio && (
          <div>
            <Label>O nueva categoría</Label>
            <Input
              placeholder="Ej: Electrónica"
              value={form.categoriaNombre}
              onChange={(e) => setForm({ ...form, categoriaNombre: e.target.value })}
            />
          </div>
        )}
        <div>
          <Label>Stock mínimo</Label>
          <Input
            type="number"
            min={0}
            value={form.stockMinimo}
            onChange={(e) => setForm({ ...form, stockMinimo: Number(e.target.value) })}
          />
        </div>
        {!premio && (
          <div>
            <Label>Stock inicial</Label>
            <Input
              type="number"
              min={0}
              value={form.stockInicial}
              onChange={(e) => setForm({ ...form, stockInicial: Number(e.target.value) })}
            />
          </div>
        )}

        {error && <p className="sm:col-span-2 text-sm text-red-500">{error}</p>}

        <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            Guardar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
