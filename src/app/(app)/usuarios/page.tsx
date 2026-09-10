"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Plus, Pencil, UserX, UserCheck } from "lucide-react";
import { Card, Button, Input, Select, Label, Modal } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Usuario } from "@/lib/types";
import { format } from "date-fns";

export default function UsuariosPage() {
  const { data: session } = useSession();
  const { push } = useToast();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState<Usuario | null>(null);

  function load() {
    fetch("/api/usuarios").then((r) => r.json()).then(setUsuarios);
  }

  useEffect(load, []);

  async function toggleActivo(u: Usuario) {
    if (u.activo) {
      const res = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
      if (res.ok) {
        push({ type: "success", title: "Usuario desactivado" });
        load();
      } else {
        const data = await res.json();
        push({ type: "error", title: "Error", message: data.error });
      }
    } else {
      await fetch(`/api/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: true }),
      });
      push({ type: "success", title: "Usuario activado" });
      load();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted">Gestión de usuarios y permisos</p>
        </div>
        <Button
          onClick={() => {
            setEditando(null);
            setModalOpen(true);
          }}
        >
          <Plus size={16} /> Nuevo usuario
        </Button>
      </div>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-border">
              <th className="p-3 font-medium">Nombre</th>
              <th className="p-3 font-medium">Usuario</th>
              <th className="p-3 font-medium">Rol</th>
              <th className="p-3 font-medium">Movimientos</th>
              <th className="p-3 font-medium">Estado</th>
              <th className="p-3 font-medium">Creado</th>
              <th className="p-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="p-3 font-medium text-foreground">{u.nombre}</td>
                <td className="p-3 text-foreground/80">{u.username}</td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.rol === "ADMIN" ? "bg-purple-500/10 text-purple-600 dark:text-purple-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}
                  >
                    {u.rol === "ADMIN" ? "Administrador" : "Usuario"}
                  </span>
                </td>
                <td className="p-3 text-foreground/80">{u._count?.movimientos ?? 0}</td>
                <td className="p-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${u.activo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-600 dark:text-red-400"}`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="p-3 text-foreground/70">{format(new Date(u.creadoEn), "dd/MM/yyyy")}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <button
                      className="p-2 rounded-lg hover:bg-background text-foreground"
                      onClick={() => {
                        setEditando(u);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    {u.id !== session?.user.id && (
                      <button
                        className={`p-2 rounded-lg hover:bg-background ${u.activo ? "text-red-500" : "text-emerald-500"}`}
                        onClick={() => toggleActivo(u)}
                      >
                        {u.activo ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <UsuarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        usuario={editando}
        onSaved={() => {
          setModalOpen(false);
          load();
        }}
      />
    </div>
  );
}

function UsuarioModal({
  open,
  onClose,
  usuario,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  usuario: Usuario | null;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState({ username: "", password: "", nombre: "", rol: "USUARIO" as "ADMIN" | "USUARIO" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (usuario) {
      setForm({ username: usuario.username, password: "", nombre: usuario.nombre, rol: usuario.rol });
    } else {
      setForm({ username: "", password: "", nombre: "", rol: "USUARIO" });
    }
    setError("");
  }, [usuario, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (usuario) {
      const body: Record<string, unknown> = { nombre: form.nombre, rol: form.rol };
      if (form.password) body.password = form.password;
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setLoading(false);
      if (!res.ok) {
        setError("Error al guardar");
        return;
      }
      push({ type: "success", title: "Usuario actualizado" });
      onSaved();
    } else {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Error al crear usuario");
        return;
      }
      push({ type: "success", title: "Usuario creado" });
      onSaved();
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={usuario ? "Editar usuario" : "Nuevo usuario"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <Label>Nombre completo</Label>
          <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
        </div>
        <div>
          <Label>Usuario</Label>
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            disabled={!!usuario}
          />
        </div>
        <div>
          <Label>{usuario ? "Nueva contraseña (opcional)" : "Contraseña"}</Label>
          <Input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!usuario}
          />
        </div>
        <div>
          <Label>Rol</Label>
          <Select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value as "ADMIN" | "USUARIO" })}>
            <option value="USUARIO">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </Select>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-2 mt-2">
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
