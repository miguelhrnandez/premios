/* =============================================================
   STOCK DE PREMIOS · aplicación
   Frontend sin build: HTML + JS + Supabase (auth, base, realtime)
   ============================================================= */
'use strict';
(function () {

const CFG = window.APP_CONFIG || {};

/* ---------------- utilidades ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n, c = '') => `<i data-lucide="${n}" class="ic ${c}"></i>`;
const icons = () => { try { window.lucide && window.lucide.createIcons(); } catch (e) { /* sin íconos */ } };
const pad = (n, l = 2) => String(n).padStart(l, '0');
const ymd = d => { d = new Date(d); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parseYmd = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fFecha = d => d ? new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
const fHora = d => d ? new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
const fFH = d => d ? `${fFecha(d)} ${fHora(d)}` : '—';
const fNum = n => Number(n || 0).toLocaleString('es-AR');
const signo = n => n > 0 ? `+${fNum(n)}` : n < 0 ? `−${fNum(Math.abs(n))}` : '0';
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const iniciales = n => (n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);
const trunc = (s, n) => (s && s.length > n) ? s.slice(0, n - 1) + '…' : (s || '');
const lunes = d => { d = new Date(d); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; };
const rel = d => {
  if (!d) return '—';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'hace un momento';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (ymd(d) === ymd(new Date())) return `hoy ${fHora(d)}`;
  const ay = new Date(); ay.setDate(ay.getDate() - 1);
  if (ymd(d) === ymd(ay)) return `ayer ${fHora(d)}`;
  return fFH(d);
};

/* ---------------- constantes de dominio ---------------- */
const TIPOS = {
  ingreso:    { t: 'Ingreso',    i: 'package-plus' },
  salida:     { t: 'Salida',     i: 'package-minus' },
  ajuste:     { t: 'Ajuste',     i: 'scale' },
  correccion: { t: 'Corrección', i: 'pencil-line' },
  anulacion:  { t: 'Anulación',  i: 'undo-2' }
};
const ESTADOS = {
  ok:      { t: 'Stock correcto', c: 'ok' },
  bajo:    { t: 'Stock bajo',     c: 'low' },
  agotado: { t: 'Sin stock',      c: 'out' },
  marca:   { t: 'Sin esta marca', c: 'mute' }
};
const ALERTAS = {
  stock_bajo:            { t: 'Stock bajo',               i: 'triangle-alert', c: 'warn' },
  sin_stock:             { t: 'Sin stock',                i: 'octagon-alert',  c: 'bad' },
  ajuste_importante:     { t: 'Ajuste importante',        i: 'scale',          c: 'warn' },
  diferencia_inventario: { t: 'Diferencia de inventario', i: 'clipboard-list', c: 'warn' }
};
const TODOS = ['admin', 'usuario', 'supervisor'];
const NAV = [
  { id: 'dashboard',     t: 'Dashboard',            i: 'layout-dashboard', roles: ['admin'] },
  { id: 'rapido',        t: 'Retiro rápido',        i: 'zap',              roles: ['admin', 'usuario', 'supervisor'] },
  { id: 'consumo',       t: 'Consumo por sector',   i: 'chart-pie',        roles: ['admin', 'supervisor'] },
  { id: 'cargar',        t: 'Cargar stock',         i: 'package-plus',     roles: ['supervisor'] },
  { id: 'equipo',        t: 'Mi equipo',            i: 'users-round',      roles: ['admin', 'supervisor'] },
  { id: 'stock',         t: 'Stock de Premios',     i: 'boxes',            roles: TODOS },
  { id: 'movimiento',    t: 'Registrar Movimiento', i: 'arrow-left-right', roles: ['admin'] },
  { id: 'historial',     t: 'Historial',            i: 'history',          roles: ['admin'] },
  { id: 'inventario',    t: 'Inventario',           i: 'clipboard-check',  roles: ['admin'] },
  { id: 'reportes',      t: 'Reportes',             i: 'chart-column',     roles: ['admin'] },
  { id: 'pronostico',    t: 'Pronóstico y compras', i: 'sparkles',         roles: ['admin'] },
  { id: 'usuarios',      t: 'Usuarios',             i: 'users',            roles: ['admin'] },
  { id: 'auditoria',     t: 'Auditoría',            i: 'shield-check',     roles: ['admin'] },
  { sep: 'Cuenta' },
  { id: 'perfil',        t: 'Mi perfil',            i: 'circle-user-round', roles: ['admin', 'usuario'] },
  { id: 'ayuda',         t: 'Cómo funciona',        i: 'circle-help',      roles: TODOS },
  { id: 'configuracion', t: 'Configuración',        i: 'settings',         roles: TODOS }
];
const ROLES = {
  admin:      { t: 'Administrador',     s: 'Ve y hace todo',                              i: 'shield-check', c: 't-correccion' },
  usuario:    { t: 'Retiro de premios', s: 'Solo retira premios y ve el stock',           i: 'zap',          c: 't-salida' },
  supervisor: { t: 'Jefe de sector',    s: 'Retira y carga stock de su equipo; consulta lo retirado', i: 'eye', c: 't-ajuste' }
};
const rolBadge = r => { const x = ROLES[r] || ROLES.usuario; return `<span class="badge ${x.c}">${ic(x.i)}${x.t}</span>`; };
const inicioDe = r => r === 'admin' ? 'dashboard' : r === 'supervisor' ? 'consumo' : 'rapido';


/* ---------------- estado ---------------- */
let API = null;
const S = {
  user: null, perfil: null,
  premios: [], categorias: [], perfiles: [], movs: [], alertas: [], config: {}, sectores: [],
  rap: { sector: null, cart: {}, obs: '', q: '', nota: false },
  view: 'dashboard', params: {}, charts: [], flashes: {},
  live: 'off', unsub: null, lastSync: 0, wasOff: false,
  f: null, invCounts: {}
};
const rolActual = () => (S.perfil ? S.perfil.rol : '');
const isAdmin = () => rolActual() === 'admin';
const isJefe = () => rolActual() === 'supervisor';
const puedeRetirar = () => ['admin', 'usuario', 'supervisor'].includes(rolActual());
const PRON_DEF = { per: 7, entrega: 3, margen: 'alto', gr: 'dia', soloComprar: false, todas: false };
function defaultsF() {
  const hoy = ymd(new Date());
  return {
    stock: { q: '', cat: '', est: '', sort: 'nombre', inact: false },
    mov:   { tipo: 'salida', premioId: null, q: '' },
    hist:  { q: '', usuario: '', premio: '', tipo: '', sector: '', desde: '', hasta: '', page: 0 },
    rep:   { desde: hoy.slice(0, 8) + '01', hasta: hoy, agrupar: 'dia', premio: '', usuario: '' },
    usr:   { q: '', rol: '' },
    aud:   { q: '', tabla: '', desde: '', hasta: '' },
    perf:  { q: '', tipo: '', page: 0 },
    cons:  { sector: '', per: 'hoy', n: 30 },
    inv:   { q: '', cat: '' },
    pron:  { ...PRON_DEF }
  };
}
S.f = defaultsF();

/* ---------------- helpers de dominio ---------------- */
const premio = id => S.premios.find(p => p.id === Number(id));
const pNombre = m => (premio(m.premio_id) || {}).nombre || m.premio_nombre;
const catName = id => (S.categorias.find(c => c.id === id) || {}).nombre || 'Sin categoría';
const perfilDe = id => S.perfiles.find(p => p.id === id);
// Grupos de marcas que se reemplazan (migración 09): lo que importa es el total del grupo
const grupoDe = p => p && p.grupo_id ? (S.grupos || []).find(g => g.id === p.grupo_id) || null : null;
const miembrosDe = g => S.premios.filter(p => p.grupo_id === g.id && p.activo).sort(byName);
const stockGrupo = g => miembrosDe(g).reduce((s, p) => s + Math.max(0, p.stock_actual), 0);
const estadoGrupo = g => { const t = stockGrupo(g); return t <= 0 ? 'agotado' : t <= (g.stock_minimo || 0) ? 'bajo' : 'ok'; };
const estadoPropio = p => p.stock_actual <= 0 ? 'agotado' : (p.stock_actual <= p.stock_minimo ? 'bajo' : 'ok');
// 'marca' = esta marca no tiene, pero el grupo sí: no es alerta
const estadoDe = p => { const g = grupoDe(p); if (!g) return estadoPropio(p); const e = estadoGrupo(g); return e !== 'ok' ? e : (p.stock_actual <= 0 ? 'marca' : 'ok'); };
const enAlerta = p => ['bajo', 'agotado'].includes(estadoDe(p));
// Unidades de control: cada grupo cuenta una vez; cada premio suelto, una vez
function unidadesStock() {
  const out = [], vistos = new Set();
  S.premios.filter(p => p.activo).forEach(p => {
    const g = grupoDe(p);
    if (!g) { out.push({ p, nombre: p.nombre, stock: p.stock_actual, minimo: p.stock_minimo, estado: estadoPropio(p) }); return; }
    if (vistos.has(g.id)) return; vistos.add(g.id);
    const ms = miembrosDe(g), pref = ms.find(x => x.id === g.preferido_id) || ms[0];
    out.push({ g, p: pref, nombre: g.nombre, stock: stockGrupo(g), minimo: g.stock_minimo || 0, estado: estadoGrupo(g), n: ms.length });
  });
  return out;
}
const qtyEf = m => m.estado === 'anulado' ? 0 : (m.cantidad_corregida ?? m.cantidad);
const salidasVig = (arr = S.movs) => arr.filter(m => m.tipo === 'salida' && m.estado !== 'anulado');
// faltantes: ajustes (inventario o manuales) que bajaron stock → salidas "sin identificar"
const faltantes = (arr = S.movs) => arr.filter(m => m.tipo === 'ajuste' && m.estado !== 'anulado' && m.delta < 0);
const uFalt = m => -m.delta;
const SIN_ID = 'Sin identificar';
const ingresosVig = (arr = S.movs) => arr.filter(m => m.tipo === 'ingreso' && m.estado !== 'anulado');
const inRange = (m, desde, hasta) => { const d = ymd(m.creado_en); return (!desde || d >= desde) && (!hasta || d <= hasta); };
const byName = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
const sectorDe = id => S.sectores.find(x => x.id === Number(id));
const sectorLabel = x => x ? (x.grupo ? `${x.grupo} · ${x.nombre}` : x.nombre) : '';
const sectoresActivos = () => S.sectores.filter(x => x.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
const sectoresRetiro = () => {
  const ids = (S.perfil && ['usuario', 'supervisor'].includes(S.perfil.rol) && S.perfil.sector_ids) || [];
  return ids.length ? sectoresActivos().filter(x => ids.includes(x.id)) : sectoresActivos();
};
const sectoresConsulta = () => {
  const ids = (S.perfil && S.perfil.rol === 'supervisor' && S.perfil.sector_ids) || [];
  const all = S.sectores.slice().sort((a, b) => a.orden - b.orden);
  return ids.length ? all.filter(x => ids.includes(x.id)) : all;
};
const lsSector = () => `sp_sector_${S.perfil ? S.perfil.id : ''}`;
const optSectores = (sel, todos) => (todos ? S.sectores.slice().sort((a, b) => a.orden - b.orden) : sectoresActivos())
  .map(x => `<option value="${x.id}" ${String(sel) === String(x.id) ? 'selected' : ''}>${esc(sectorLabel(x))}${x.activo ? '' : ' (inactivo)'}</option>`).join('');

const badgeEstado = p => {
  if (!p.activo) return '<span class="badge mute"><span class="d"></span>Desactivado</span>';
  const k = estadoDe(p), e = ESTADOS[k], g = grupoDe(p);
  const t = g && k === 'bajo' ? `Stock bajo en ${esc(g.nombre)}` : g && k === 'agotado' ? `Sin ${esc(g.nombre)}` : e.t;
  return `<span class="badge ${e.c}" ${k === 'marca' ? `title="Hay otras marcas de ${esc(g.nombre)}"` : ''}><span class="d"></span>${t}</span>`;
};
const badgeTipo = t => `<span class="badge t-${t}">${ic(TIPOS[t].i)}${TIPOS[t].t}</span>`;
// Logo Más Dueños: isotipo (si se subió icons/isotipo.png) + "MásDueños"
const ISOTIPO = ''; // p. ej. 'icons/isotipo.png' cuando se suba el isotipo oficial
const marca = (sub, cls = '') => `<div class="marca ${cls}">${ISOTIPO ? `<img class="marca-iso" src="${ISOTIPO}" alt="">` : ''}<div style="min-width:0"><div class="marca-w" role="img" aria-label="Más Dueños"><span>Más</span><b>Dueños</b></div>${sub != null ? `<div class="marca-s">${sub}</div>` : ''}</div></div>`;
const thumb = (p, lg) => `<div class="thumb ${lg ? 'lg' : ''}">${p && p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" loading="lazy">` : ic('gift', lg ? 'l' : '')}</div>`;
const stockSpan = p => `<span data-stock="${p.id}">${fNum(p.stock_actual)}</span>`;
const grupoTag = p => { const g = grupoDe(p); return g ? `<span class="gtag" title="Marcas que se reemplazan entre sí">${ic('layers', 's')}${esc(g.nombre)}: ${fNum(stockGrupo(g))} en total</span>` : ''; };
function lvl(p) {
  const e = estadoDe(p);
  const cap = p.stock_minimo > 0 ? p.stock_minimo * 3 : Math.max(p.stock_actual, 1);
  const w = Math.min(p.stock_actual / cap, 1) * 100;
  const mk = p.stock_minimo > 0 ? `<b style="left:calc(${(100 / 3).toFixed(2)}% - 1px)" title="Mínimo: ${p.stock_minimo}"></b>` : '';
  return `<div class="lvl"><span class="lvl-n">${stockSpan(p)}</span><div class="lvl-bar ${e === 'bajo' ? 'low' : e === 'agotado' ? 'out' : ''}" title="Stock ${p.stock_actual} · mínimo ${p.stock_minimo}"><i style="width:${w}%"></i>${mk}</div></div>`;
}
function estadoMovTxt(m) {
  if (m.estado === 'anulado') return 'Anulado';
  if (m.estado === 'corregido') return `Corregido a ${m.cantidad_corregida}`;
  return 'Vigente';
}
function fraseMov(m) {
  const u = `<b>${esc(m.usuario_nombre)}</b>`, p = esc(pNombre(m)), n = fNum(m.cantidad);
  switch (m.tipo) {
    case 'ingreso': return `${u} ingresó ${n} ${p}`;
    case 'salida': return `${u} retiró ${fNum(qtyEf(m))} ${p}${m.estado === 'anulado' ? ' (anulado)' : ''}`;
    case 'ajuste': return `${u} ajustó el stock de ${p}`;
    case 'correccion': return `${u} corrigió un movimiento de ${p}`;
    default: return `${u} anuló un movimiento de ${p}`;
  }
}
function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e);
  if (/LINK_INVALIDO/.test(m)) return 'El link de retiros ya no es válido. Pide el nuevo a tu jefe.';
  if (/Invalid login credentials/i.test(m)) return 'Usuario o contraseña incorrectos.';
  if (/Email not confirmed/i.test(m)) return 'El usuario todavía no está confirmado. Un administrador debe activarlo.';
  if (/already registered|already been registered|User already/i.test(m)) return 'Ese nombre de usuario ya existe.';
  if (/premios_codigo_key/i.test(m)) return 'Ya existe un premio con ese código.';
  if (/categorias_nombre_key/i.test(m)) return 'Ya existe una categoría con ese nombre.';
  if (/perfiles_usuario_key/i.test(m)) return 'Ese nombre de usuario ya existe.';
  if (/foreign key/i.test(m)) return 'No se puede eliminar porque tiene movimientos u otros registros asociados. Puedes desactivarlo en su lugar.';
  if (/Failed to fetch|NetworkError|network request/i.test(m)) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  if (/Password should be at least|weak password/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if (/rate limit/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos e inténtalo de nuevo.';
  if (/row-level security|permission denied/i.test(m)) return 'No tienes permisos para realizar esta acción.';
  return m;
}

/* =============================================================
   CAPA DE DATOS (Supabase)
   ============================================================= */
function createAPI(sb) {
  const T = r => { if (r.error) throw r.error; return r.data; };
  const all = async build => {
    let out = [], from = 0; const step = 1000;
    for (;;) {
      const d = T(await build().range(from, from + step - 1));
      out = out.concat(d);
      if (d.length < step) break;
      from += step;
    }
    return out;
  };
  const email = u => `${String(u).trim().toLowerCase()}@${CFG.EMAIL_DOMINIO || 'premios.app'}`;
  return {
    async getSession() { const { data } = await sb.auth.getSession(); return data.session; },
    async signIn(u, p) { return T(await sb.auth.signInWithPassword({ email: email(u), password: p })).session; },
    async signOut() { try { await sb.auth.signOut(); } catch (e) { /* ignorar */ } },
    async hayUsuarios() { return T(await sb.rpc('hay_usuarios')); },
    async signUpFirst(u, p, n) {
      return T(await sb.auth.signUp({ email: email(u), password: p, options: { data: { usuario: u.toLowerCase(), nombre_completo: n } } }));
    },
    async miPerfil(id) { return T(await sb.from('perfiles').select('*').eq('id', id).maybeSingle()); },
    premios: () => all(() => sb.from('premios').select('*').order('nombre')),
    async categorias() { return T(await sb.from('categorias').select('*').order('nombre')); },
    async sectores() { return T(await sb.from('sectores').select('*').order('orden')); },
    async integrantes() { return T(await sb.from('integrantes').select('*').order('nombre')); },
    async crearIntegrante(d) { return T(await sb.from('integrantes').insert(d).select().single()); },
    async editarIntegrante(id, d) { return T(await sb.from('integrantes').update(d).eq('id', id).select().single()); },
    async crearSector(d) { return T(await sb.from('sectores').insert(d).select().single()); },
    async editarSector(id, d) { return T(await sb.from('sectores').update(d).eq('id', id).select().single()); },
    async perfiles() { return T(await sb.from('perfiles').select('*').order('nombre_completo')); },
    async config() { const d = T(await sb.from('configuracion').select('*')); return Object.fromEntries(d.map(r => [r.clave, r.valor])); },
    movimientos: () => all(() => sb.from('movimientos').select('*').order('id', { ascending: false })),
    async alertas() { return T(await sb.from('alertas').select('*').order('id', { ascending: false }).limit(100)); },
    async inventarios() { return T(await sb.from('inventarios').select('*').order('id', { ascending: false }).limit(300)); },
    async inventarioDetalle(id) { return T(await sb.from('inventario_detalle').select('*').eq('inventario_id', id).order('premio_nombre')); },
    async auditoria() { return T(await sb.from('auditoria').select('*').order('id', { ascending: false }).limit(2000)); },
    async rpc(fn, args) { return T(await sb.rpc(fn, args)); },
    async grupos() { return T(await sb.from('grupos_premio').select('*').order('nombre')); },
    async crearGrupo(d) { return T(await sb.from('grupos_premio').insert(d).select().single()); },
    async editarGrupo(id, d) { return T(await sb.from('grupos_premio').update(d).eq('id', id).select().single()); },
    async borrarGrupo(id) { T(await sb.from('grupos_premio').delete().eq('id', id)); },
    async fechasEspeciales() { return T(await sb.from('fechas_especiales').select('*').order('fecha')); },
    async crearFecha(d) { return T(await sb.from('fechas_especiales').insert(d).select().single()); },
    async editarFecha(id, d) { return T(await sb.from('fechas_especiales').update(d).eq('id', id).select().single()); },
    async borrarFecha(id) { T(await sb.from('fechas_especiales').delete().eq('id', id)); },
    async crearPremio(d) { return T(await sb.from('premios').insert(d).select().single()); },
    async editarPremio(id, d) { return T(await sb.from('premios').update(d).eq('id', id).select().single()); },
    async eliminarPremio(id) { T(await sb.from('premios').delete().eq('id', id)); },
    async subirImagen(blob) {
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      T(await sb.storage.from('premios').upload(name, blob, { contentType: 'image/jpeg', upsert: false }));
      return sb.storage.from('premios').getPublicUrl(name).data.publicUrl;
    },
    async crearCategoria(nombre) { return T(await sb.from('categorias').insert({ nombre }).select().single()); },
    async editarCategoria(id, nombre) { return T(await sb.from('categorias').update({ nombre }).eq('id', id).select().single()); },
    async eliminarCategoria(id) { T(await sb.from('categorias').delete().eq('id', id)); },
    async guardarConfig(clave, valor) { T(await sb.from('configuracion').upsert({ clave, valor, actualizado_en: new Date().toISOString() })); },
    async crearUsuario({ usuario, password, nombre, rol, sectorIds }) {
      // Cliente temporal: el alta no cierra la sesión del administrador
      const tmp = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'sp-alta-tmp' }
      });
      const data = T(await tmp.auth.signUp({ email: email(usuario), password, options: { data: { usuario, nombre_completo: nombre } } }));
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('Ese nombre de usuario ya existe.');
      try { await tmp.auth.signOut(); } catch (e) { /* ignorar */ }
      return guardarUsuario({ p_id: data.user.id, p_nombre: nombre, p_rol: rol, p_activo: true, p_sector_ids: sectorIds || [] });
    },
    async cambiarMiPassword(p) { T(await sb.auth.updateUser({ password: p })); },
    subscribe(h) {
      const ch = sb.channel('stock-premios-rt');
      ['premios', 'movimientos', 'alertas', 'categorias', 'configuracion', 'sectores', 'integrantes', ...(h.extra || [])].forEach(t =>
        ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => h.change(t, p)));
      ch.subscribe(st => h.status(st));
      return () => { try { sb.removeChannel(ch); } catch (e) { /* ignorar */ } };
    }
  };
}

/* =============================================================
   ARRANQUE Y SESIÓN
   ============================================================= */
const app = () => $('#app');

async function boot() {
  try {
    if (!localStorage.getItem('sp_tema') && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.dataset.theme = 'dark';
    }
  } catch (e) { /* ignorar */ }

  leerCodigoDeURL();
  if (window.__API_MOCK__) {
    API = window.__API_MOCK__;
  } else {
    if (!window.supabase || !CFG.SUPABASE_URL || /SU-PROYECTO/.test(CFG.SUPABASE_URL) || /PEGAR/.test(CFG.SUPABASE_ANON_KEY || '')) {
      return renderSetup();
    }
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);
    API = createAPI(sb);
  }
  let session = null;
  try { session = await API.getSession(); } catch (e) { /* sin sesión */ }
  if (session) await enter(session.user); else await inicioSinSesion();
}

async function enter(user) {
  S.user = user;
  S.publico = false; pararPublico(); document.body.classList.remove('modo-pub');
  let perfil = null;
  try { perfil = await API.miPerfil(user.id); } catch (e) { /* ignorar */ }
  if (!perfil || !perfil.activo) {
    await API.signOut();
    return renderLogin(perfil ? 'Tu usuario está desactivado o pendiente de activación. Consulta con un administrador.' : 'No se encontró el perfil de este usuario.');
  }
  S.perfil = perfil;
  recordarUsuario(perfil.usuario, perfil.nombre_completo);
  document.onkeydown = null;
  S.f = defaultsF();
  try { await loadAll(); } catch (e) { return renderLogin('No se pudieron cargar los datos: ' + errMsg(e)); }
  renderShell();
  route();
  startRealtime();
}

async function loadAll() {
  const [premios, categorias, perfiles, config, movs, alertas, sectores, integrantes] = await Promise.all([
    API.premios(), API.categorias(), API.perfiles(), API.config(), API.movimientos(), API.alertas(),
    API.sectores ? API.sectores().catch(() => []) : Promise.resolve([]),
    API.integrantes ? API.integrantes().catch(() => []) : Promise.resolve([])
  ]);
  Object.assign(S, { premios, categorias, perfiles, config, movs, alertas, sectores, integrantes, lastSync: Date.now() });
  // Fechas especiales (migración 08): si la tabla todavía no existe, la app sigue funcionando
  S.especialesErr = false;
  try { S.especiales = API.fechasEspeciales ? await API.fechasEspeciales() : []; } catch (e) { S.especiales = []; S.especialesErr = true; }
  // Grupos de marcas (migración 09)
  S.gruposErr = false;
  try { S.grupos = API.grupos ? await API.grupos() : []; } catch (e) { S.grupos = []; S.gruposErr = true; }
  const me = perfiles.find(p => p.id === S.perfil.id);
  if (me) S.perfil = me;
}

async function logout() {
  if (S.unsub) S.unsub();
  S.unsub = null;
  await API.signOut();
  Object.assign(S, { user: null, perfil: null, premios: [], movs: [], alertas: [], perfiles: [], invCounts: {} });
  destroyCharts();
  history.replaceState(null, '', location.pathname + location.search);
  await inicioSinSesion();
}


/* =============================================================
   MODO EQUIPO (sin sesión): link de retiros + "¿Eres jefe?"
   ============================================================= */
const LS_COD = 'sp_codigo';
const codigo = () => { try { return localStorage.getItem(LS_COD) || ''; } catch (e) { return ''; } };
// El código queda en la dirección: así, al "Agregar a pantalla de inicio" (sobre todo en iPhone,
// donde el ícono no comparte datos con Safari) el acceso directo guarda el link completo.
function leerCodigoDeURL() {
  try {
    const u = new URL(location.href), c = u.searchParams.get('c');
    if (c) { localStorage.setItem(LS_COD, c.trim()); return; }
    const guardado = localStorage.getItem(LS_COD);
    if (guardado) { u.searchParams.set('c', guardado); history.replaceState(null, '', u.pathname + u.search + u.hash); }
  } catch (e) { /* ignorar */ }
}
function dispositivo() {
  try {
    let d = localStorage.getItem('sp_dispositivo');
    if (!d) { d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; localStorage.setItem('sp_dispositivo', d); }
    return d;
  } catch (e) { return ''; }
}
const nombreEquipo = () => { try { return localStorage.getItem('sp_nombre') || ''; } catch (e) { return ''; } };
const linkRetiros = c => `${location.origin}${location.pathname}?c=${encodeURIComponent(c)}`;

async function inicioSinSesion(msg) {
  S.publico = false;
  let hay = true;
  try { hay = await API.hayUsuarios(); } catch (e) { /* asumir que hay */ }
  if (hay && codigo()) return renderPublico(msg);
  return renderLogin(msg);
}

async function cargarCatalogo() {
  const c = await API.rpc('retiro_catalogo', { p_codigo: codigo() });
  const antes = new Map(S.premios.map(p => [p.id, p.stock_actual]));
  S.premios = (c.premios || []).map(p => ({ ...p, activo: true, codigo: '', categoria_id: null }));
  S.premios.forEach(p => { if (antes.has(p.id) && antes.get(p.id) !== p.stock_actual) flash(p.id, p.stock_actual - antes.get(p.id)); });
  S.sectores = (c.sectores || []).map(x => ({ ...x, activo: true }));
  S.frecuentes = c.frecuentes || [];
  S.integrantes = c.integrantes || [];
  S.config.nombre_sucursal = c.sucursal || '';
  const cart = S.rap.cart;
  S.premios.forEach(p => { if (cart[p.id] > p.stock_actual) { if (p.stock_actual > 0) cart[p.id] = p.stock_actual; else delete cart[p.id]; } });
  S.lastSync = Date.now();
}
function linkInvalido() {
  try {
    localStorage.removeItem(LS_COD);
    const u = new URL(location.href); u.searchParams.delete('c'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch (e) { /* ignorar */ }
  pararPublico();
  app().innerHTML = `
    <div class="setup">
      <div class="brand-mark" style="margin-bottom:18px">${ic('link-2-off')}</div>
      <h1>Este link ya no funciona</h1>
      <p>Pídele a tu jefe el link de retiros nuevo y ábrelo en este teléfono.</p>
      <button class="btn" id="li-jefe">${ic('key-round', 's')}Soy jefe o administrador</button>
    </div>`;
  icons();
  $('#li-jefe').onclick = () => renderLogin();
}
function pararPublico() { if (S.pubTimer) clearInterval(S.pubTimer); S.pubTimer = null; }

async function renderPublico(msg) {
  S.publico = true; S.perfil = null; S.movs = []; S.alertas = [];
  S.premios = []; S.view = 'rapido';
  pararPublico();
  try { await cargarCatalogo(); }
  catch (e) { if (/LINK_INVALIDO/.test(e.message || '')) return linkInvalido(); return renderLogin(errMsg(e)); }
  app().innerHTML = `
    <div class="pub">
      <header class="pub-top">
        ${marca('Retiro de premios' + (S.config.nombre_sucursal ? ' · ' + esc(S.config.nombre_sucursal) : ''), 'sm')}
        <span class="sp"></span>
        <button class="btn sm icon" id="pub-ayuda" title="Cómo retirar premios" aria-label="Cómo retirar premios">${ic('circle-help', 's')}</button>
        <button class="btn sm pub-jefe" id="pub-jefe">${ic('key-round', 's')}¿Eres jefe?</button>
      </header>
      <main class="content pub-main" id="view"></main>
    </div>`;
  document.body.classList.add('modo-pub');
  $('#pub-jefe').onclick = () => modalJefe();
  $('#pub-ayuda').onclick = () => modalGuiaEquipo();
  VIEWS.rapido.mount($('#view'));
  icons();
  if (msg) toast(esc(msg), 'warn', 6000);
  S.pubTimer = setInterval(async () => {
    if (document.visibilityState !== 'visible' || !S.publico) return;
    try { await cargarCatalogo(); VIEWS.rapido.paintGrid(); VIEWS.rapido.paintBar(); icons(); applyFlashes(); }
    catch (e) { if (/LINK_INVALIDO/.test(e.message || '')) linkInvalido(); }
  }, 15000);
}

async function modalJefe() {
  let lista = [];
  try { lista = await API.rpc('retiro_jefes', { p_codigo: codigo() }); } catch (e) { /* sin lista */ }
  if (!lista || !lista.length) { pararPublico(); return renderLogin(); }
  const md = modal({ title: '¿Quién eres?', body: '', foot: '' });
  const body = md.$('.modal-b');
  const elegir = () => {
    body.innerHTML = `<p class="muted" style="margin:0 0 10px">Elige tu nombre y luego pon tu PIN.</p>
      <ul class="list jefes">${lista.map((j, i) => `<li><button class="jefe-b" data-i="${i}">
        <span class="avatar">${esc(iniciales(j.nombre))}</span>
        <span class="grow"><span class="t1" style="display:block">${esc(j.nombre)}</span>
        <span class="t2">${j.rol === 'admin' ? 'Administrador' : `Jefe de ${esc(j.sectores || 'todos los sectores')}`}</span></span>${ic('chevron-right', 's')}</button></li>`).join('')}</ul>`;
    icons();
    body.onclick = e => { const b = e.target.closest('[data-i]'); if (b) pedirPin(lista[+b.dataset.i]); };
  };
  const pedirPin = j => {
    let pin = '';
    body.onclick = null;
    body.innerHTML = `
      <div class="hola"><span class="avatar" style="width:48px;height:48px;font-size:17px">${esc(iniciales(j.nombre))}</span><div><b style="font-size:18px">${esc(j.nombre)}</b><div class="muted">Ingresa tu PIN</div></div></div>
      <div class="form-err" id="mj-e" style="margin-bottom:10px"></div>
      <div class="pin-dots" id="mj-d"></div>
      <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}
        <button type="button" data-k="del" aria-label="Borrar">${ic('delete')}</button><button type="button" data-k="0">0</button>
        <button type="button" class="ok" data-k="ok" id="mj-ok" aria-label="Entrar">${ic('arrow-right')}</button></div>
      <div class="login-links"><button type="button" class="btn ghost sm" id="mj-back">${ic('chevron-left', 's')}Volver</button>
        <button type="button" class="btn ghost sm" id="mj-pass">Usar contraseña</button></div>`;
    icons();
    const dots = () => { $('#mj-d').innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join(''); };
    dots();
    const entrar = async () => {
      if (pin.length < 4) return showErr($('#mj-e'), 'El PIN tiene al menos 4 números.');
      await busy($('#mj-ok'), async () => {
        try {
          const s = await ingresar(j.usuario, pin);
          md.close(); pararPublico(); document.body.classList.remove('modo-pub');
          recordarUsuario(j.usuario, j.nombre);
          await enter(s.user);
        } catch (e) { pin = ''; dots(); showErr($('#mj-e'), /Invalid login/i.test(e.message || '') ? 'PIN incorrecto.' : errMsg(e)); }
      });
    };
    body.querySelector('.keypad').onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      const k = b.dataset.k;
      if (k === 'del') pin = pin.slice(0, -1); else if (k === 'ok') return entrar(); else if (pin.length < 6) pin += k;
      showErr($('#mj-e'), ''); dots();
    };
    $('#mj-back').onclick = elegir;
    $('#mj-pass').onclick = () => { md.close(); pararPublico(); recordarUsuario(j.usuario, j.nombre); renderLogin(); };
  };
  elegir();
}

function integranteRecordado() {
  const R = S.rap;
  const lista = integrantesDe(R.sector).filter(x => x.activo !== false);
  if (R.integrante && lista.some(x => x.id === R.integrante)) return;
  let id = null;
  try { id = Number(localStorage.getItem(`sp_integrante_${R.sector}`)) || null; } catch (e) { /* ignorar */ }
  R.integrante = lista.some(x => x.id === id) ? id : null;
}
function selectorQuien() {
  const R = S.rap;
  const lista = integrantesDe(R.sector).filter(x => x.activo !== false).sort(porNombre);
  if (!lista.length) return `<div class="callout warn" style="margin-bottom:12px">${ic('triangle-alert', 's')}<span>Todavía no hay nadie cargado en este equipo. Pide a tu jefe que te agregue en <b>Mi equipo</b>.</span></div>`;
  return `<div class="quien"><label for="rp-quien-sel">¿Quién eres?</label>
    <select class="in quien-sel ${R.integrante ? '' : 'falta'}" id="rp-quien-sel">
      <option value="">Elige tu nombre</option>${lista.map(x => `<option value="${x.id}" ${x.id === R.integrante ? 'selected' : ''}>${esc(x.nombre)}${x.jefe || x.perfil_id ? ' (jefe)' : ''}</option>`).join('')}
    </select></div>`;
}
async function modalNombre() {
  const md = modal({
    title: '¿Cómo te llamas?',
    body: `<div class="stack"><p class="muted" style="margin:0">Es opcional. Si lo pones, tu jefe ve quién retiró. Se guarda en este teléfono.</p>
      <input class="in" id="nm-in" maxlength="40" value="${esc(nombreEquipo())}" placeholder="Ej.: Lucas" autocomplete="given-name"></div>`,
    foot: `<button class="btn" id="nm-del">Quitar nombre</button><button class="btn pri" id="nm-ok">Guardar</button>`
  });
  const guardar = v => { try { v ? localStorage.setItem('sp_nombre', v) : localStorage.removeItem('sp_nombre'); } catch (e) { /* ignorar */ } md.close(); VIEWS.rapido.paintSec(); icons(); };
  md.$('#nm-ok').onclick = () => guardar(md.$('#nm-in').value.trim());
  md.$('#nm-del').onclick = () => guardar('');
  md.$('#nm-in').onkeydown = e => { if (e.key === 'Enter') guardar(md.$('#nm-in').value.trim()); };
}

function renderSetup() {
  app().innerHTML = `
  <div class="setup">
    <div class="brand-mark" style="margin-bottom:18px">${ic('gift')}</div>
    <h1>Falta conectar la base de datos</h1>
    <p>Abre el archivo <code>config.js</code> y completa <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> con los datos de tu proyecto (Supabase › Project Settings › API). Luego recarga esta página.</p>
    <p class="muted">Los pasos completos están en el archivo README.md.</p>
  </div>`;
  icons();
}

async function renderLogin(msg) {
  let hay = true;
  try { hay = await API.hayUsuarios(); } catch (e) { /* asumir que hay */ }
  const sucursal = esc(S.config.nombre_sucursal || 'Sucursal');
  app().innerHTML = `
  <div class="login">
    <div class="login-art">
      ${marca('Premios · ' + sucursal, 'on-red')}
      <div>
        <h2>Cada premio, con nombre y hora.</h2>
        <p>El stock se actualiza al instante para todo el equipo y cada movimiento queda guardado en el historial.</p>
      </div>
      <div class="ledger" aria-hidden="true">
        <div>${ic('package-plus', 's')} Ingreso de auriculares<b class="pos">+50</b></div>
        <div>${ic('package-minus', 's')} Retiro de vasos<b class="neg">−3</b></div>
        <div>${ic('scale', 's')} Ajuste por inventario<b class="neg">−2</b></div>
      </div>
    </div>
    <div class="login-form"><div class="login-card"><div class="login-top">${marca('Premios · ' + sucursal)}</div><div id="lc"></div></div></div>
  </div>`;
  const lc = $('#lc');
  if (hay) loginPin(lc, msg);
  else {
    lc.innerHTML = `
      <h1>Crear el administrador</h1>
      <p>Todavía no hay usuarios. La primera cuenta que crees será la del administrador de ${sucursal}.</p>
      <form id="sf" class="stack">
        <div class="form-err" id="se"></div>
        <div class="field"><label for="sn">Nombre completo</label><input class="in" id="sn" required></div>
        <div class="field"><label for="su">Usuario</label><input class="in" id="su" autocapitalize="none" spellcheck="false" required>
          <span class="hint">Solo letras minúsculas, números, punto, guion o guion bajo.</span></div>
        <div class="grid2">
          <div class="field"><label for="sp">PIN (4 a 6 números)</label><input class="in pin-in" id="sp" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></div>
          <div class="field"><label for="sp2">Repetir PIN</label><input class="in pin-in" id="sp2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required></div>
        </div>
        <span class="hint muted small">Para el administrador conviene un PIN de 6 números.</span>
        <button class="btn pri lg" id="sb">Crear administrador</button>
      </form>`;
    icons();
    $('#sf').onsubmit = async e => {
      e.preventDefault();
      const n = $('#sn').value.trim(), u = $('#su').value.trim().toLowerCase(), p = $('#sp').value.trim(), p2 = $('#sp2').value.trim();
      const v = validarUsuario(n, u, p, p2);
      if (v) return showErr($('#se'), v);
      await busy($('#sb'), async () => {
        try {
          const r = await API.signUpFirst(u, pinPass(p), n);
          recordarUsuario(u, n);
          if (r.session) await enter(r.user);
          else showErr($('#se'), 'La cuenta se creó, pero Supabase pide confirmar el email. Desactiva "Confirm email" en Authentication › Sign In / Providers › Email (ver README) e inicia sesión.');
        } catch (err) { showErr($('#se'), errMsg(err)); }
      });
    };
  }
}

/* ---------- ingreso con PIN ---------- */
const pinPass = pin => `sp-${pin}`;               // Supabase pide mínimo 6 caracteres: el PIN se guarda con prefijo
const esPin = v => /^\d{4,6}$/.test(v);
function recordarUsuario(usuario, nombre) { try { localStorage.setItem('sp_ultimo', JSON.stringify({ usuario, nombre })); } catch (e) { /* ignorar */ } }
function usuarioRecordado() { try { return JSON.parse(localStorage.getItem('sp_ultimo') || 'null'); } catch (e) { return null; } }
async function ingresar(usuario, secreto) {
  if (esPin(secreto)) {
    try { return await API.signIn(usuario, pinPass(secreto)); }
    catch (e) { if (secreto.length < 6 || !/Invalid login/i.test(e.message || '')) throw e; }
  }
  return API.signIn(usuario, secreto);               // cuentas con contraseña común
}
function loginPin(lc, msg) {
  const rec = usuarioRecordado();
  let pin = '', modoPass = false, usuario = rec ? rec.usuario : '';
  const render = () => {
    lc.innerHTML = `
      ${rec && usuario === rec.usuario
        ? `<div class="hola"><span class="avatar" style="width:52px;height:52px;font-size:18px">${esc(iniciales(rec.nombre))}</span><div><h1>Hola, ${esc((rec.nombre || '').split(' ')[0])}</h1><p class="muted" style="margin:0">${modoPass ? 'Ingresa tu contraseña' : 'Ingresa tu PIN'}</p></div></div>`
        : `<h1>Ingresar</h1><p>Escribe tu usuario y tu PIN.</p>
           <div class="field" style="margin-bottom:14px"><label for="lu">Usuario</label>
           <div class="in-ic">${ic('user-round')}<input class="in" id="lu" value="${esc(usuario)}" autocomplete="username" autocapitalize="none" spellcheck="false"></div></div>`}
      <div class="form-err ${msg ? 'show' : ''}" id="le" style="margin-bottom:12px">${esc(msg || '')}</div>
      ${modoPass
        ? `<form id="lf" class="stack"><div class="field"><label for="lp">Contraseña</label><input class="in" id="lp" type="password" autocomplete="current-password"></div><button class="btn pri lg" id="lb">Ingresar</button></form>`
        : `<div class="pin-dots" aria-label="PIN">${Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('')}</div>
           <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button type="button" data-k="${n}">${n}</button>`).join('')}
             <button type="button" data-k="del" aria-label="Borrar">${ic('delete')}</button><button type="button" data-k="0">0</button>
             <button type="button" class="ok" data-k="ok" id="lb" aria-label="Entrar">${ic('arrow-right')}</button></div>`}
      ${codigo() ? '' : `<div class="callout info" style="margin-top:16px">${ic('info', 's')}<span>¿Eres del equipo y vienes a retirar premios? No necesitas usuario: abre el <b>link de retiros</b> que te pasó tu jefe.</span></div>`}
      <div class="login-links">
        ${codigo() ? `<button type="button" class="btn ghost sm" id="volver-ret">${ic('chevron-left', 's')}Volver a retiros</button>` : ''}
        ${rec && usuario === rec.usuario ? `<button type="button" class="btn ghost sm" id="otro">No soy ${esc((rec.nombre || '').split(' ')[0])}</button>` : ''}
        <button type="button" class="btn ghost sm" id="modo">${modoPass ? 'Usar PIN' : 'Usar contraseña'}</button>
      </div>`;
    icons();
    const lu = $('#lu');
    if (lu) { lu.oninput = () => { usuario = lu.value.trim().toLowerCase(); }; if (!usuario) setTimeout(() => lu.focus(), 50); }
    $('#modo').onclick = () => { modoPass = !modoPass; pin = ''; msg = ''; render(); };
    if ($('#volver-ret')) $('#volver-ret').onclick = () => { document.onkeydown = null; renderPublico(); };
    if ($('#otro')) $('#otro').onclick = () => { usuario = ''; pin = ''; msg = ''; try { localStorage.removeItem('sp_ultimo'); } catch (e) { /* ignorar */ } render(); };
    if (modoPass) {
      $('#lf').onsubmit = e => { e.preventDefault(); entrar($('#lp').value); };
      setTimeout(() => (usuario ? $('#lp') : $('#lu')).focus(), 50);
    } else {
      lc.querySelector('.keypad').onclick = e => {
        const b = e.target.closest('[data-k]'); if (!b) return;
        const k = b.dataset.k;
        if (k === 'del') pin = pin.slice(0, -1);
        else if (k === 'ok') return entrar(pin);
        else if (pin.length < 6) pin += k;
        msg = ''; paintDots();
      };
    }
  };
  const paintDots = () => {
    const d = lc.querySelector('.pin-dots'); if (!d) return;
    d.innerHTML = Array.from({ length: Math.max(4, pin.length) }, (_, i) => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
    showErr($('#le'), msg || '');
  };
  const entrar = async secreto => {
    usuario = (usuario || '').trim().toLowerCase();
    if (!usuario) return showErr($('#le'), 'Escribe tu usuario.');
    if (!secreto) return showErr($('#le'), modoPass ? 'Escribe tu contraseña.' : 'Escribe tu PIN.');
    if (!modoPass && secreto.length < 4) return showErr($('#le'), 'El PIN tiene al menos 4 números.');
    await busy($('#lb'), async () => {
      try {
        const s = await ingresar(usuario, secreto);
        await enter(s.user);
      } catch (err) {
        pin = ''; msg = /Invalid login/i.test(err.message || '') ? (modoPass ? 'Usuario o contraseña incorrectos.' : 'Usuario o PIN incorrectos.') : errMsg(err);
        if (modoPass) showErr($('#le'), msg); else paintDots();
      }
    });
  };
  // teclado físico
  document.onkeydown = e => {
    if (!lc.isConnected) { document.onkeydown = null; return; }
    if (modoPass || (document.activeElement && document.activeElement.id === 'lu')) { if (e.key === 'Enter' && !modoPass && pin) entrar(pin); return; }
    if (/^\d$/.test(e.key) && pin.length < 6) { pin += e.key; msg = ''; paintDots(); }
    else if (e.key === 'Backspace') { pin = pin.slice(0, -1); paintDots(); }
    else if (e.key === 'Enter') entrar(pin);
  };
  render();
}

function validarUsuario(nombre, usuario, pin, pin2, conPin = true) {
  if (!nombre) return 'Completa el nombre completo.';
  if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) return 'El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo (sin espacios ni tildes).';
  if (conPin) {
    if (!esPin(pin || '')) return 'El PIN debe tener entre 4 y 6 números.';
    if (pin !== pin2) return 'Los PIN no coinciden.';
  }
  return '';
}

/* =============================================================
   ESTRUCTURA: menú lateral, barra superior, navegación
   ============================================================= */
function renderShell() {
  app().innerHTML = `
  <div class="layout" id="layout">
    <aside class="side" aria-label="Menú principal">
      <div class="brand">${marca('<span id="brand-s"></span>', 'on-red')}</div>
      <nav class="nav" id="nav"></nav>
      <div class="side-foot rel">
        <button class="me" id="me" aria-haspopup="menu"></button>
      </div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main">
      <header class="top">
        <button class="btn icon burger" id="burger" aria-label="Abrir menú">${ic('menu')}</button>
        <h1 id="ttl"></h1>
        <div class="top-r">
          <span class="live" id="live" title="Estado de la conexión en tiempo real"><i></i><span>Conectando…</span></span>
          <button class="btn icon" id="theme" aria-label="Cambiar modo claro u oscuro"></button>
          <div class="rel">
            <button class="btn icon bell" id="bell" aria-label="Notificaciones">${ic('bell')}<span class="dot hide" id="bell-dot"></span></button>
            <div class="pop hide" id="bell-pop"></div>
          </div>
        </div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
  $('#nav').innerHTML = NAV.filter(n => n.sep || n.roles.includes(rolActual())).map(n => n.sep
    ? `<div class="nav-sep">${n.sep}</div>`
    : `<a href="#/${n.id}" data-nav="${n.id}">${ic(n.i)}<span>${n.t}</span>${n.id === 'stock' ? '<span class="cnt hide" id="nav-cnt"></span>' : ''}</a>`).join('');
  $('#me').innerHTML = `<span class="avatar">${esc(iniciales(S.perfil.nombre_completo))}</span>
    <span style="min-width:0"><span class="me-n" style="display:block">${esc(S.perfil.nombre_completo)}</span><span class="me-r">${(ROLES[rolActual()] || {}).t || ''}</span></span>
    ${ic('chevrons-up-down', 's')}`;
  $('#burger').onclick = () => $('#layout').classList.add('nav-open');
  $('#scrim').onclick = closeNav;
  $('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#me').onclick = e => { e.stopPropagation(); toggleUserMenu(); };
  $('#bell').onclick = e => { e.stopPropagation(); toggleBell(); };
  document.addEventListener('click', closePops);
  paintThemeBtn();
  paintBrand();
  updateBell();
  updateNavBadge();
  setLive(S.live);
  icons();
}
function popMenu(anchor, items) {
  const old = $('#pmenu'); if (old) old.remove();
  const m = document.createElement('div');
  m.className = 'menu'; m.id = 'pmenu'; m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => `<button data-i="${i}" role="menuitem" ${it.danger ? 'style="color:var(--out)"' : ''}>${ic(it.i, 's')}${esc(it.t)}</button>`).join('');
  document.body.append(m); icons();
  const r = anchor.getBoundingClientRect();
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.position = 'fixed';
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  m.style.top = (r.bottom + h + 8 > innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
  m.style.right = 'auto';
  const close = () => { m.remove(); document.removeEventListener('click', out, true); window.removeEventListener('scroll', close, true); };
  const out = e => { if (!m.contains(e.target)) close(); };
  setTimeout(() => { document.addEventListener('click', out, true); window.addEventListener('scroll', close, true); }, 0);
  m.onclick = e => { const b = e.target.closest('[data-i]'); if (!b) return; close(); items[+b.dataset.i].f(); };
  const first = m.querySelector('button'); first && first.focus();
}
function closeNav() { const l = $('#layout'); l && l.classList.remove('nav-open'); }
function closePops(e) {
  const bp = $('#bell-pop');
  if (bp && !bp.classList.contains('hide') && !bp.contains(e.target)) bp.classList.add('hide');
  const um = $('#umenu');
  if (um && !um.contains(e.target)) um.remove();
}
function paintBrand() { const b = $('#brand-s'); if (b) b.textContent = 'Premios · ' + (S.config.nombre_sucursal || 'Sucursal'); }
function paintThemeBtn() {
  const b = $('#theme'); if (!b) return;
  b.innerHTML = ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
  icons();
}
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('sp_tema', t); } catch (e) { /* ignorar */ }
  paintThemeBtn();
  if (S.perfil) route();
}
function toggleUserMenu() {
  const old = $('#umenu'); if (old) return old.remove();
  const m = document.createElement('div');
  m.className = 'menu'; m.id = 'umenu'; m.setAttribute('role', 'menu');
  m.style.cssText = 'top:auto;bottom:calc(100% + 6px);left:0;right:0';
  m.innerHTML = `
    ${isJefe() ? '' : `<button data-go="perfil">${ic('circle-user-round')}Mi perfil</button>`}
    <button data-go="configuracion">${ic('settings')}Configuración</button>
    <button id="lo">${ic('log-out')}Cerrar sesión</button>`;
  $('.side-foot').append(m); icons();
  m.onclick = e => {
    e.stopPropagation();
    const b = e.target.closest('button'); if (!b) return;
    m.remove();
    if (b.id === 'lo') logout(); else go(b.dataset.go);
  };
}

const VIEWS = {};
function go(view, params) {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const h = `#/${view}${qs}`;
  if (location.hash === h) route(); else location.hash = h;
}
window.addEventListener('hashchange', () => { if (S.perfil) route(); });

function route() {
  const raw = location.hash.replace(/^#\/?/, '') || inicioDe(rolActual());
  const [path, qs] = raw.split('?');
  let id = VIEWS[path] ? path : inicioDe(rolActual());
  const nav = NAV.find(n => n.id === id);
  if (!nav || !nav.roles.includes(rolActual())) id = inicioDe(rolActual());
  S.view = id;
  S.params = Object.fromEntries(new URLSearchParams(qs || ''));
  destroyCharts();
  document.body.classList.remove('has-bar');
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === id));
  $('#ttl').textContent = VIEWS[id].title();
  closeNav();
  const el = $('#view');
  el.innerHTML = '';
  VIEWS[id].mount(el);
  icons();
  applyFlashes();
  window.scrollTo(0, 0);
}

const paintCurrent = debounce(() => {
  const v = VIEWS[S.view];
  if (v && v.paint && $('#view')) { v.paint(); icons(); }
  updateStockSpans();
  applyFlashes();
  updateNavBadge();
}, 120);

function updateStockSpans() {
  $$('[data-stock]').forEach(el => {
    const p = premio(el.dataset.stock);
    if (p) el.textContent = fNum(p.stock_actual);
  });
}
function flash(id, delta) { S.flashes[id] = { delta, t: Date.now() }; }
function applyFlashes() {
  const now = Date.now();
  Object.entries(S.flashes).forEach(([id, f]) => {
    if (now - f.t > 2200) { delete S.flashes[id]; return; }
    $$(`[data-stock="${id}"]`).forEach(el => {
      if (el.dataset.fl === String(f.t)) return;
      el.dataset.fl = String(f.t);
      el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      const nx = el.nextElementSibling;
      if (nx && nx.classList.contains('dchip')) nx.remove();
      el.insertAdjacentHTML('afterend', `<span class="dchip ${f.delta > 0 ? 'up' : 'down'}">${signo(f.delta)}</span>`);
      const chip = el.nextElementSibling;
      setTimeout(() => chip && chip.remove(), 2500);
    });
  });
}
function updateNavBadge() {
  const c = $('#nav-cnt'); if (!c) return;
  const n = unidadesStock().filter(u => u.estado !== 'ok').length;
  c.textContent = n; c.classList.toggle('hide', n === 0);
  c.title = `${n} premio(s) o grupo(s) con stock bajo o sin stock`;
}

/* ---------------- gráficos ---------------- */
function destroyCharts() { S.charts.forEach(c => { try { c.destroy(); } catch (e) { /* ignorar */ } }); S.charts = []; }
function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = v => cs.getPropertyValue(v).trim();
  return { s1: g('--series-1'), s2: g('--series-2'), s3: g('--series-3'), grid: g('--line'), text: g('--muted'), ink: g('--ink-2'), tipBg: g('--surface'), tipInk: g('--ink') };
}
function chartOpts(c, legend) {
  const FAM = "Alexandria, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
  const font = { family: FAM, size: 12 };
  return {
    responsive: true, maintainAspectRatio: false, animation: { duration: 250 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: legend, position: 'top', align: 'start', labels: { color: c.ink, boxWidth: 10, boxHeight: 10, font } },
      tooltip: { backgroundColor: c.tipBg, titleColor: c.tipInk, bodyColor: c.tipInk, borderColor: c.grid, borderWidth: 1, padding: 10, titleFont: font, bodyFont: font, boxPadding: 4 }
    },
    scales: {
      x: { grid: { display: false }, border: { color: c.grid }, ticks: { color: c.text, font: { family: FAM, size: 11 }, maxRotation: 0, autoSkip: true } },
      y: { beginAtZero: true, grid: { color: c.grid }, border: { display: false }, ticks: { color: c.text, precision: 0, font: { family: FAM, size: 11 } } }
    }
  };
}
function makeChart(canvas, cfg) {
  if (!window.Chart || !canvas) return null;
  const ch = new window.Chart(canvas, cfg);
  S.charts.push(ch);
  return ch;
}

/* =============================================================
   MODALES, TOASTS, FORMULARIOS
   ============================================================= */
function modal({ title, body, size = '', foot = '', onClose }) {
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h3>${title}</h3><span class="sp"></span><button class="btn ghost icon sm" data-close aria-label="Cerrar">${ic('x')}</button></div>
    <div class="modal-b">${body}</div>
    ${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  $('#modals').append(bg);
  icons();
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    bg.remove(); document.removeEventListener('keydown', onKey);
    onClose && onClose();
  };
  const onKey = e => { if (e.key === 'Escape' && $('#modals').lastElementChild === bg) close(); };
  document.addEventListener('keydown', onKey);
  bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach(b => { b.onclick = close; });
  setTimeout(() => { const f = bg.querySelector('.modal-b input:not([type=hidden]):not([type=checkbox]):not([disabled]):not([type=file]), .modal-b select, .modal-b textarea'); f && f.focus(); }, 40);
  return { el: bg, close, $: s => bg.querySelector(s) };
}
function confirmar({ title, body, ok = 'Confirmar', danger = false }) {
  return new Promise(res => {
    let val = false;
    const m = modal({ title, body, foot: `<button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'pri'}" id="m-ok">${ok}</button>`, onClose: () => res(val) });
    m.$('#m-ok').onclick = () => { val = true; m.close(); };
    setTimeout(() => m.$('#m-ok') && m.$('#m-ok').focus(), 50);
  });
}
function toast(html, type = 'info', ms = 5000, action) {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const i = { ok: 'circle-check', bad: 'circle-x', warn: 'triangle-alert', info: 'info' }[type] || 'info';
  el.innerHTML = `${ic(i)}<div style="flex:1">${html}</div>${action ? `<button class="btn sm" data-ta>${esc(action.label)}</button>` : ''}<button class="x" aria-label="Cerrar">${ic('x', 's')}</button>`;
  $('#toasts').append(el); icons();
  el.querySelector('.x').onclick = () => el.remove();
  if (action) el.querySelector('[data-ta]').onclick = async e => { await busy(e.currentTarget, action.onClick); el.remove(); };
  setTimeout(() => el.remove(), ms);
  return el;
}
function showErr(el, msg) { if (!el) return; el.textContent = msg; el.classList.toggle('show', !!msg); }
async function busy(btn, fn) {
  if (!btn) return fn();
  btn.classList.add('busy'); btn.disabled = true;
  try { return await fn(); } finally { btn.classList.remove('busy'); btn.disabled = false; }
}
const optCats = sel => S.categorias.map(c => `<option value="${c.id}" ${String(sel) === String(c.id) ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('');
const optPremios = (sel, soloActivos) => S.premios.filter(p => !soloActivos || p.activo).slice().sort(byName)
  .map(p => `<option value="${p.id}" ${String(sel) === String(p.id) ? 'selected' : ''}>${esc(p.nombre)}${p.activo ? '' : ' (desactivado)'}</option>`).join('');
const optUsuarios = sel => S.perfiles.slice().sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
  .map(u => `<option value="${u.id}" ${sel === u.id ? 'selected' : ''}>${esc(u.nombre_completo)}</option>`).join('');
const emptyRow = (cols, t, s, i = 'inbox') => `<tr><td colspan="${cols}" class="keep"><div class="empty">${ic(i)}<b>${t}</b>${s || ''}</div></td></tr>`;

/* =============================================================
   EXPORTACIÓN (Excel, CSV, PDF)
   ============================================================= */
const pdfSafe = s => String(s ?? '').replace(/→/g, '->').replace(/[−–—]/g, '-').replace(/[^\x00-\xFF]/g, '');
const sheetName = s => String(s).replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31);
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function tabla(cols, rows) {
  return { head: cols.map(c => c.h), body: rows.map(r => cols.map(c => { const v = c.v(r); return v == null ? '' : v; })) };
}
function exportar(fmt, base, title, cols, rows) {
  try {
    const { head, body } = tabla(cols, rows);
    const fname = `${base}_${ymd(new Date())}`;
    if (fmt === 'csv') {
      const q = v => { v = String(v); return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
      const csv = '﻿' + [head, ...body].map(r => r.map(q).join(';')).join('\r\n');
      download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fname + '.csv');
    } else if (fmt === 'xlsx') {
      exportarLibro(base, [{ title, cols, rows }]);
      return;
    } else {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: cols.length > 6 ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
      doc.setFontSize(15); doc.text(pdfSafe(title), 40, 42);
      doc.setFontSize(9); doc.setTextColor(110);
      doc.text(pdfSafe(`${S.config.nombre_sucursal || ''}  |  Generado el ${fFH(new Date())} por ${S.perfil.nombre_completo}  |  ${rows.length} registro(s)`), 40, 58);
      doc.autoTable({
        head: [head.map(pdfSafe)], body: body.map(r => r.map(pdfSafe)), startY: 70,
        styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [229, 44, 40] },
        alternateRowStyles: { fillColor: [245, 247, 250] }, margin: { left: 40, right: 40 }
      });
      doc.save(fname + '.pdf');
    }
    toast(`Archivo ${fmt.toUpperCase()} descargado.`, 'ok', 2500);
  } catch (e) { toast('No se pudo exportar: ' + esc(errMsg(e)), 'bad'); }
}
function exportarLibro(base, sheets) {
  try {
    const wb = window.XLSX.utils.book_new();
    sheets.forEach(sh => {
      const { head, body } = tabla(sh.cols, sh.rows);
      const ws = window.XLSX.utils.aoa_to_sheet([head, ...body]);
      ws['!cols'] = head.map((h, i) => ({ wch: Math.min(50, Math.max(String(h).length, ...body.map(r => String(r[i]).length), 4) + 2) }));
      window.XLSX.utils.book_append_sheet(wb, ws, sheetName(sh.title));
    });
    window.XLSX.writeFile(wb, `${base}_${ymd(new Date())}.xlsx`);
    toast('Archivo Excel descargado.', 'ok', 2500);
  } catch (e) { toast('No se pudo exportar: ' + esc(errMsg(e)), 'bad'); }
}
const expBtns = key => `<div class="row" style="gap:6px" data-exp-group="${key}">
  <button class="btn sm" data-exp="xlsx">${ic('file-spreadsheet', 's')}Excel</button>
  <button class="btn sm" data-exp="csv">${ic('file-text', 's')}CSV</button>
  <button class="btn sm" data-exp="pdf">${ic('file-down', 's')}PDF</button></div>`;
function bindExp(root, key, getter) {
  const g = $(`[data-exp-group="${key}"]`, root); if (!g) return;
  g.onclick = e => {
    const b = e.target.closest('[data-exp]'); if (!b) return;
    const { base, title, cols, rows } = getter();
    exportar(b.dataset.exp, base, title, cols, rows);
  };
}
const MOV_COLS = [
  { h: 'Fecha', v: m => fFecha(m.creado_en) },
  { h: 'Hora', v: m => fHora(m.creado_en) },
  { h: 'Usuario', v: m => m.usuario_nombre },
  { h: 'Sector', v: m => m.sector_nombre || '' },
  { h: 'Tipo', v: m => TIPOS[m.tipo].t },
  { h: 'Premio', v: m => pNombre(m) },
  { h: 'Cantidad', v: m => m.delta },
  { h: 'Stock anterior', v: m => m.stock_anterior },
  { h: 'Stock actual', v: m => m.stock_nuevo },
  { h: 'Estado', v: m => estadoMovTxt(m) },
  { h: 'Observación', v: m => m.observacion || '' }
];

/* =============================================================
   PRONÓSTICO: aprende del historial y proyecta el consumo
   -------------------------------------------------------------
   Modelo (explicable, sin cajas negras):
   · Consumo base por premio: promedio ponderado de los días con datos
     (los días recientes pesan más; vida media de 14 días), quitando antes
     el efecto del día de la semana.
   · Día de la semana: cuánto se retira cada día respecto de un día
     promedio, con todos los premios juntos. Con pocos datos se acerca a 1.
   · Tendencia: compara las últimas 2 semanas con las 2 anteriores (amortiguada).
   · Faltantes de inventario: se suman como un % extra por premio.
   · Fechas especiales: cerrado = 0; con factor = ese factor; feriados sin
     factor = lo que se aprendió en feriados anteriores.
   · Margen: rango del 80 % y pedido con 90 % de probabilidad de alcanzar.
   ============================================================= */
const DIA_MS = 864e5;
const inicioDia = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); x.setHours(0, 0, 0, 0); return x; };
const DOW_PL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados'];
const DOW_SG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DOW_C = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const fDiaC = d => `${DOW_C[new Date(d).getDay()]} ${new Date(d).getDate()}/${new Date(d).getMonth() + 1}`;
const Z80 = 1.2816; // rango que se muestra: 80 % de los escenarios
const MARGENES = {
  normal: { z: 1.2816, t: 'Normal', s: 'Alcanza en 9 de cada 10 escenarios' },
  alto:   { z: 1.6449, t: 'Alto', s: 'Alcanza en 19 de cada 20 escenarios (recomendado)' },
  maximo: { z: 2.3263, t: 'Máximo', s: 'Alcanza en 99 de cada 100 escenarios' }
};
const esCerrado = e => !!e && (e.tipo === 'cerrado' || (e.factor != null && Number(e.factor) === 0));
const esFeriado = e => !!e && (e.tipo === 'feriado' || e.tipo === 'no_laborable');

// ---- Fechas especiales y temporadas ----
// Una fecha especial es de un día (fecha_fin vacía) o una temporada (rango fecha → fecha_fin).
const esRango = e => !!e && !!e.fecha_fin && e.fecha_fin > e.fecha;
const nombreBase = s => norm(s).replace(/\d+/g, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim(); // "Vacaciones de verano 2027" = "vacaciones de verano"
function calendario(especiales) {
  const dia = new Map(), temps = [];
  especiales.forEach(e => { if (esRango(e)) temps.push(e); else dia.set(e.fecha, e); });
  temps.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const temporadaDe = k => { let t = null; for (const x of temps) if (x.fecha <= k && k <= x.fecha_fin) t = x; return t; };
  return { dia, temps, temporadaDe };
}

// Clave de pronóstico: las marcas de un mismo grupo se cuentan juntas ('g12'); el resto, por premio ('p5')
const clavePron = pid => { const p = (S.premios || []).find(x => x.id === pid); const g = p && p.grupo_id && (S.grupos || []).some(x => x.id === p.grupo_id); return g ? 'g' + p.grupo_id : 'p' + pid; };

function modeloPronostico({ hasta = inicioDia(new Date()), movs = S.movs, especiales = S.especiales || [], ventana = 84, clave = clavePron } = {}) {
  const fin = inicioDia(hasta);
  const cal = calendario(especiales), esp = cal.dia;
  const regDia = new Map();            // 'yyyy-mm-dd' -> Map(premio_id -> unidades registradas)
  const regTot = new Map();            // premio_id -> unidades registradas en la ventana
  const falTot = new Map();            // premio_id -> faltantes en la ventana
  const totAll = new Map();            // todo el historial: 'yyyy-mm-dd' -> unidades (para aprender temporadas de años anteriores)
  let primero = null, primeroAll = null;
  const desdeMin = addDias(fin, -ventana);
  for (const m of movs) {
    if (m.estado === 'anulado') continue;
    const esSal = m.tipo === 'salida', esFal = m.tipo === 'ajuste' && m.delta < 0;
    if (!esSal && !esFal) continue;
    const d = new Date(m.creado_en);
    if (d >= fin) continue;
    if (esSal) { const k0 = ymd(d); totAll.set(k0, (totAll.get(k0) || 0) + qtyEf(m)); if (!primeroAll || d < primeroAll) primeroAll = d; }
    if (d < desdeMin) continue;
    if (esSal && (!primero || d < primero)) primero = d;
    const ck = clave(m.premio_id);
    if (esFal) { falTot.set(ck, (falTot.get(ck) || 0) + uFalt(m)); continue; }
    const k = ymd(d), q = qtyEf(m);
    if (!regDia.has(k)) regDia.set(k, new Map());
    const mp = regDia.get(k); mp.set(ck, (mp.get(ck) || 0) + q);
    regTot.set(ck, (regTot.get(ck) || 0) + q);
  }
  const vacio = { vacio: true, n: 0, idx: [1, 1, 1, 1, 1, 1, 1], nW: [0, 0, 0, 0, 0, 0, 0], tr: 1, ratio: null, F: 1, nFer: 0, R: 0, tasas: new Map(), merma: 0, fin, esp, cal, FT: new Map(), totDia: new Map() };
  if (!primero) return vacio;

  // Días de entrenamiento: desde el primer retiro hasta ayer; los cerrados no cuentan
  const dias = [];
  for (let d = inicioDia(primero); d < fin; d = addDias(d, 1)) {
    const k = ymd(d), e = esp.get(k);
    if (esCerrado(e)) continue;
    const mp = regDia.get(k) || new Map();
    dias.push({ d, k, dow: d.getDay(), esp: e || null, temp: cal.temporadaDe(k), mp, tot: sum([...mp.values()]) });
  }
  const normales = dias.filter(x => !x.esp);
  const n = normales.length;
  if (!n) return Object.assign(vacio, { vacio: false, n: 0 });

  // 0. Días sin stock: ese día se retiró poco porque no había, no porque se pidiera menos.
  //    Se excluyen al calcular el consumo (si no, el pedido saldría corto). En un grupo de marcas
  //    solo cuenta como "sin stock" cuando no quedaba ninguna marca.
  const sinStock = new Map(); // clave -> Set('yyyy-mm-dd')
  {
    const porK = new Map();
    movs.forEach(m => { if (m.stock_nuevo == null) return; const d = new Date(m.creado_en); if (d >= fin) return; const ck = clave(m.premio_id); if (!porK.has(ck)) porK.set(ck, []); porK.get(ck).push(m); });
    const ini0 = dias[0].d;
    porK.forEach((arr, ck) => {
      arr.sort((a, b) => a.id - b.id);
      const set = new Set(), st = new Map(); let i = 0, tot = 0;
      const aplicar = m => { tot += m.stock_nuevo - (st.get(m.premio_id) || 0); st.set(m.premio_id, m.stock_nuevo); };
      while (i < arr.length && new Date(arr[i].creado_en) < ini0) aplicar(arr[i++]);
      for (let d = ini0; d < fin; d = addDias(d, 1)) {
        const fd = addDias(d, 1); let min = st.size ? tot : 0;
        while (i < arr.length && new Date(arr[i].creado_en) < fd) { aplicar(arr[i++]); min = Math.min(min, tot); }
        if (min <= 0) set.add(ymd(d));
      }
      sinStock.set(ck, set);
    });
  }

  // 1. Día de la semana (todos los premios juntos), con encogimiento hacia 1.
  //    Si hay suficientes días fuera de temporadas, se usan solo esos.
  const fueraTemp = normales.filter(x => !x.temp);
  const baseIdx = fueraTemp.length >= 14 ? fueraTemp : normales;
  const sW = [0, 0, 0, 0, 0, 0, 0], nW = [0, 0, 0, 0, 0, 0, 0];
  baseIdx.forEach(x => { sW[x.dow] += x.tot; nW[x.dow]++; });
  const medias = sW.map((s, i) => nW[i] ? s / nW[i] : null);
  const conDatos = medias.filter(v => v != null);
  const prom = conDatos.length ? sum(conDatos) / conDatos.length : 0;
  const K = 2;
  let idx = medias.map((v, i) => (v == null || prom <= 0) ? 1 : (nW[i] * (v / prom) + K) / (nW[i] + K));
  const pIdx = sum(idx) / 7; idx = idx.map(v => v / pIdx);

  // 2. Temporadas con efecto automático: se compara el consumo durante la temporada con las 4 semanas
  //    anteriores a que empiece (en este año y en años anteriores con el mismo nombre).
  const FT = new Map(); // nombreBase -> { f, dias }
  const desest = k => (totAll.get(k) || 0) / idx[parseYmd(k).getDay()];
  const abierto = k => !esCerrado(esp.get(k)) && !esp.get(k);
  cal.temps.filter(t => t.factor == null && t.fecha < ymd(fin)).forEach(t => {
    const ini = parseYmd(t.fecha), base = [];
    for (let i = 1; i <= 28; i++) { const k = ymd(addDias(ini, -i)); if (primeroAll && parseYmd(k) >= inicioDia(primeroAll) && abierto(k) && !cal.temporadaDe(k)) base.push(desest(k)); }
    const durante = [];
    for (let d = ini; ymd(d) <= t.fecha_fin && d < fin; d = addDias(d, 1)) { const k = ymd(d); if (abierto(k)) durante.push(desest(k)); }
    if (base.length < 7 || !durante.length) return;
    const b = sum(base) / base.length; if (b <= 0) return;
    const r = (sum(durante) / durante.length) / b, nb = nombreBase(t.nombre);
    const acc = FT.get(nb) || { sr: 0, w: 0 };
    acc.sr += r * durante.length; acc.w += durante.length; FT.set(nb, acc);
  });
  FT.forEach((a, k) => FT.set(k, { f: (a.sr + 4) / (a.w + 4), dias: a.w })); // con pocos días se acerca a 1
  const fTemp = t => !t ? 1 : t.factor != null ? Number(t.factor) : ((FT.get(nombreBase(t.nombre)) || {}).f || 1);

  // 3. Consumo base por premio (sin efecto de día de semana ni de temporada, ponderado por antigüedad)
  const peso = x => Math.pow(0.5, (fin - x.d) / DIA_MS / 14);
  const sumW = sum(normales, peso), sumW2 = sum(normales, x => peso(x) ** 2);
  const nEff = sumW * sumW / sumW2;                       // cuántos días "valen" los datos ponderados
  const edadMedia = sum(normales, x => peso(x) * (fin - x.d) / DIA_MS) / sumW;
  normales.forEach(x => { x.div = idx[x.dow] * (fTemp(x.temp) || 1); });
  const pids = new Set([...regTot.keys(), ...falTot.keys()]);
  const tasas = new Map();
  pids.forEach(pid => {
    const fuera = sinStock.get(pid) || new Set();
    let s = 0, s2 = 0, sw = 0, sw2 = 0, nOk = 0;
    normales.forEach(x => { if (fuera.has(x.k)) return; const v = (x.mp.get(pid) || 0) / x.div; const w = peso(x); s += w * v; s2 += w * v * v; sw += w; sw2 += w * w; nOk++; });
    if (!sw) { sw = sumW; sw2 = sumW2; }                  // nunca tuvo stock en la ventana: se usa lo que haya
    let r = s / sw;
    let v = Math.max(s2 / sw - r * r, 0);
    const nEffP = sw * sw / sw2;
    const reg = regTot.get(pid) || 0, fal = falTot.get(pid) || 0;
    let m = 0;
    if (reg > 0) m = Math.min(fal / reg, 1);
    else if (fal > 0) { r = fal / dias.length; v = r; }   // solo hubo faltantes: se reparten por día
    v = Math.max(v, r);                                   // piso tipo Poisson para conteos chicos
    // incertidumbre de estimar el nivel + un 7 % de error de modelo, porque la realidad nunca es exactamente como el patrón aprendido
    const relVar = r > 0 ? (v / nEffP) / (r * r) + 0.07 ** 2 : 0;
    tasas.set(pid, { r, v, m, reg, fal, relVar, diasSinStock: fuera.size, diasOk: nOk });
  });
  const R = sum([...tasas.values()], t => t.reg > 0 ? t.r : 0);

  // 4. Tendencia: recta sobre el consumo diario (sin día de semana ni temporada) de las últimas 8 semanas.
  //    Solo se aplica si es clara (no ruido) y con tope de ±25 %.
  let tr = 1, ratio = null, trRelVar = 0, pend = 0;
  if (n >= 28 && R > 0) {
    const pts = normales.slice(-56).map(x => ({ t: -(fin - x.d) / DIA_MS, y: x.tot / x.div }));
    const N = pts.length, mt = sum(pts, p => p.t) / N, my = sum(pts, p => p.y) / N;
    const sxx = sum(pts, p => (p.t - mt) ** 2), b = sum(pts, p => (p.t - mt) * (p.y - my)) / sxx;
    const res = sum(pts, p => (p.y - my - b * (p.t - mt)) ** 2) / Math.max(N - 2, 1);
    const seB = Math.sqrt(res / sxx);
    ratio = 1 + b * 14 / R;                                // cambio cada 2 semanas
    if (Math.abs(b) > 2 * seB) {
      pend = b / R;                                        // cambio relativo por día
      tr = Math.min(1.25, Math.max(0.8, 1 + pend * edadMedia));
      trRelVar = (seB * (edadMedia + 7) / R) ** 2;
    }
  }

  // 5. Efecto de los feriados en que se abrió (aprende de los anteriores)
  let act = 0, exp = 0, nFer = 0;
  dias.filter(x => esFeriado(x.esp) && x.esp.factor == null).forEach(x => { act += x.tot; exp += R * idx[x.dow] * fTemp(x.temp); nFer++; });
  const unDia = R; // un día "promedio" de pseudo-dato para no exagerar con 1 feriado
  const F = nFer && exp > 0 ? (act + unDia) / (exp + unDia) : 1;

  // 6. Ritmo dentro del día: qué parte del total diario suele estar retirada a cada hora
  const porHora = new Array(24).fill(0);
  const normK = new Set(normales.map(x => x.k));
  movs.forEach(m => {
    if (m.tipo !== 'salida' || m.estado === 'anulado') return;
    const d = new Date(m.creado_en); if (d >= fin || d < desdeMin || !normK.has(ymd(d))) return;
    porHora[d.getHours()] += qtyEf(m);
  });
  const diasHora = normales.filter(x => x.tot > 0).length;
  const totH = sum(porHora); let ac = 0;
  const curva = totH > 0 && diasHora >= 5 ? porHora.map(v => (ac += v) / totH) : null; // acumulado al final de cada hora

  const regSum = sum([...regTot.values()]), falSum = sum([...falTot.values()]);
  const totDia = new Map(dias.map(x => [x.k, x.tot]));
  return { vacio: false, n, nEff, edadMedia, pend, dias: dias.length, inicio: inicioDia(primero), fin, idx, nW, tr, trRelVar, ratio, F, nFer, R, tasas, esp, cal, FT, fTemp, merma: regSum ? falSum / regSum : 0, totDia, curva };
}

// Cuánto cambia el consumo en una fecha respecto de un día base (fecha especial × temporada)
function factorFecha(M, d) {
  const k = ymd(d), e = M.esp.get(k), t = M.cal ? M.cal.temporadaDe(k) : null;
  const ft = t ? (M.fTemp ? M.fTemp(t) : (t.factor != null ? Number(t.factor) : 1)) : 1;
  const tTxt = !t ? '' : t.factor != null ? efectoTxt(ft) : (M.FT && M.FT.get(nombreBase(t.nombre))) ? `Automático: ${efectoTxt(ft)}` : 'Automático: todavía sin datos';
  if (esCerrado(e)) return { f: 0, e, t, txt: 'Cerrado' };
  let fd = 1, dTxt = '';
  if (e && e.factor != null) { fd = Number(e.factor); dTxt = efectoTxt(fd); }
  else if (esFeriado(e)) { fd = M.F; dTxt = M.nFer ? `Automático: ${efectoTxt(M.F)}` : 'Automático: como un día normal'; }
  return { f: fd * ft, e: e || null, t, txt: e ? dTxt : tTxt, tTxt };
}
const efectoTxt = f => f === 0 ? 'Cerrado' : Math.abs(f - 1) < 0.03 ? 'Normal' : f > 1 ? `+${Math.round((f - 1) * 100)}%` : `−${Math.round((1 - f) * 100)}%`;
// Tendencia a una fecha: el nivel de hoy más lo que siga cambiando hasta ese día (con tope de ±25 %)
const trendFecha = (M, d) => !M.pend ? M.tr : Math.min(1.25, Math.max(0.8, 1 + M.pend * (M.edadMedia + Math.max(0, (inicioDia(d) - M.fin) / DIA_MS))));
const multFecha = (M, d) => M.idx[new Date(d).getDay()] * trendFecha(M, d) * factorFecha(M, d).f;

// Parte del día ya transcurrida según el ritmo habitual (0 a 1)
function avanceDia(M, ahora = new Date()) {
  if (!M.curva) return null;
  const h = ahora.getHours(), fr = ahora.getMinutes() / 60;
  const antes = h > 0 ? M.curva[h - 1] : 0;
  return antes + (M.curva[h] - antes) * fr;
}
// ¿Hoy viene más o menos movido que lo normal? (solo cuando ya pasó al menos 15 % del día habitual)
function ritmoHoy(M, hoyReg, ahora = new Date()) {
  const av = avanceDia(M, ahora);
  const esperadoTotal = M.R * multFecha(M, ahora);
  const ya = sum([...hoyReg.values()]);
  if (av == null || av < 0.15 || esperadoTotal <= 0) return { av, ya, esperadoTotal, ratio: null, factor: 1 };
  const ratio = ya / (esperadoTotal * av);
  // se confía más en el ritmo a medida que avanza el día
  const factor = Math.min(2, Math.max(0.5, 1 + (ratio - 1) * Math.min(1, av / 0.5)));
  return { av, ya, esperadoTotal, ratio, factor };
}

// Proyección día por día. Hoy cuenta solo lo que falta, ajustado por el ritmo del día.
function proyectar(M, desde, nDias, hoyReg = new Map()) {
  const out = new Map(); // pid -> { e:[], v:[] }
  const hoyK = ymd(new Date());
  const rit = ritmoHoy(M, hoyReg), av = rit.av;
  M.tasas.forEach((t, pid) => {
    const e = [], v = [];
    for (let i = 0; i < nDias; i++) {
      const d = addDias(desde, i), mu = multFecha(M, d), k = 1 + t.m;
      let ei = t.r * k * mu, vi = t.v * k * k * mu * mu;
      if (ymd(d) === hoyK) {
        const ya = hoyReg.get(pid) || 0;
        // con ritmo conocido: lo que falta del día, escalado por cómo viene hoy; si no, lo esperado menos lo ya retirado
        const rest = av != null ? Math.max(ei * (1 - av) * rit.factor, 0) : Math.max(ei - ya, 0);
        vi = ei > 0 ? vi * Math.min(1, rest / ei) : 0; ei = rest;
      }
      e.push(ei); v.push(vi);
    }
    out.set(pid, { e, v });
  });
  return out;
}

// ¿Qué tan bien habría acertado? Pronostica cada uno de los últimos 7 días con lo que se sabía el día anterior.
function backtest(movs = S.movs, especiales = S.especiales || []) {
  const hoy = inicioDia(new Date());
  const M0 = modeloPronostico({ hasta: hoy, movs, especiales });
  if (M0.vacio || M0.n < 21) return null;
  let sp = 0, sa = 0, sabs = 0, dias = 0;
  const filas = [];
  for (let k = 7; k >= 1; k--) {
    const d = addDias(hoy, -k);
    const e = M0.esp.get(ymd(d));
    if (esCerrado(e)) continue;
    const Mk = modeloPronostico({ hasta: d, movs, especiales });
    if (Mk.vacio || Mk.n < 14) continue;
    const pred = Mk.R * multFecha(Mk, d), act = M0.totDia.get(ymd(d)) || 0;
    sp += pred; sa += act; sabs += Math.abs(pred - act); dias++;
    filas.push({ d, pred, act });
  }
  if (!dias || sa <= 0) return null;
  return { semana: Math.abs(sp - sa) / sa, diario: sabs / sa, pred: sp, act: sa, dias, filas };
}

// Cuántas unidades se retiraron hoy (por premio)
function retiradoHoy(movs = S.movs, clave = clavePron) {
  const k = ymd(new Date()), mp = new Map();
  movs.forEach(m => { if (m.tipo === 'salida' && m.estado !== 'anulado' && ymd(m.creado_en) === k) { const ck = clave(m.premio_id); mp.set(ck, (mp.get(ck) || 0) + qtyEf(m)); } });
  return mp;
}

// Plan completo para la vista: una fila por grupo de marcas o por premio suelto
function planCompras({ per = 7, entrega = 3, margen = 'alto' } = {}) {
  const z = (MARGENES[margen] || MARGENES.alto).z;
  const hoy = inicioDia(new Date());
  const M = modeloPronostico({ hasta: hoy });
  const hoyReg = retiradoHoy();
  const largo = Math.max(per, 120);
  const P = proyectar(M, hoy, largo, hoyReg);
  const filas = unidadesStock().map(u => {
    const key = u.g ? 'g' + u.g.id : 'p' + u.p.id;
    const p = u.p, g = u.g || null, ms = g ? miembrosDe(g) : [p];
    const pref = g ? (ms.find(x => x.id === g.preferido_id) || null) : p;
    const base = { key, p, g, ms, pref, nombre: u.nombre, stock: u.stock, minimo: u.minimo };
    const t = M.tasas.get(key), pr = P.get(key);
    if (!t || !pr || (t.reg === 0 && t.fal === 0)) return { ...base, sinDatos: true, necesita: 0, pedido: 0, estado: 'sin', porDia: 0, lo: 0, hi: 0, agota: null };
    const e = pr.e.slice(0, per), v = pr.v.slice(0, per);
    const necesita = sum(e);
    // variación día a día + error de estimar el nivel y la tendencia (afecta a todo el período junto)
    const sd = Math.sqrt(sum(v) + necesita * necesita * (t.relVar + (M.trRelVar || 0)));
    const lo = Math.max(0, necesita - Z80 * sd), hi = necesita + Z80 * sd;
    // ¿cuándo se acaba? (en un grupo: cuando no queda ninguna marca)
    let acum = 0, agota = null;
    if (u.stock <= 0) agota = hoy;
    else for (let i = 0; i < largo; i++) { acum += pr.e[i]; if (acum > u.stock) { agota = addDias(hoy, i); break; } }
    let pedido = Math.ceil(necesita + z * sd + (u.minimo || 0) - u.stock);
    if (necesita <= 0.05) pedido = 0;
    pedido = Math.max(0, pedido);
    const pk = Number((pref || p).unidades_por_paquete) || 0;
    const paquetes = pk > 1 && pedido > 0 ? Math.ceil(pedido / pk) : 0;
    if (paquetes) pedido = paquetes * pk;
    const llega = addDias(hoy, entrega);
    const estado = (u.stock <= 0 || (agota && agota < llega)) ? 'urgente' : pedido > 0 ? 'comprar' : 'ok';
    return { ...base, t, necesita, lo, hi, cubre: necesita + z * sd, agota, pedido, paquetes, pk, estado, porDia: t.r * (1 + t.m) * M.tr };
  });
  const orden = { urgente: 0, comprar: 1, ok: 2, sin: 3 };
  filas.sort((a, b) => orden[a.estado] - orden[b.estado] || (a.agota && b.agota ? a.agota - b.agota : a.agota ? -1 : b.agota ? 1 : 0) || b.necesita - a.necesita || a.nombre.localeCompare(b.nombre, 'es'));
  return { M, P, hoy, hoyReg, filas, rit: ritmoHoy(M, hoyReg), z };
}

/* =============================================================
   VISTA: PRONÓSTICO Y COMPRAS
   ============================================================= */
const prF = () => { const f = S.f.pron; try { const g = JSON.parse(localStorage.getItem('sp_pron') || '{}'); ['per', 'entrega', 'margen'].forEach(k => { if (g[k] != null && f._init !== true) f[k] = g[k]; }); } catch (e) { /* ignorar */ } f._init = true; return f; };
const prGuardar = f => { try { localStorage.setItem('sp_pron', JSON.stringify({ per: f.per, entrega: f.entrega, margen: f.margen })); } catch (e) { /* ignorar */ } };
const fU = n => fNum(Math.round(n));
const pct = r => `${r >= 0 ? '+' : '−'}${Math.round(Math.abs(r) * 100)}%`;
const fechaCorta = d => { const x = new Date(d); return `${DOW_SG[x.getDay()]} ${x.getDate()}/${x.getMonth() + 1}`; };
const EFECTOS = [
  { v: '', t: 'Automático (la app lo aprende de feriados anteriores)' },
  { v: '0', t: 'Cerrado: no se retira nada' },
  { v: '0.5', t: 'Mucho menos movimiento (−50%)' },
  { v: '0.75', t: 'Menos movimiento (−25%)' },
  { v: '1', t: 'Normal' },
  { v: '1.25', t: 'Más movimiento (+25%)' },
  { v: '1.5', t: 'Mucho más movimiento (+50%)' },
  { v: '2', t: 'El doble' }
];
const ESTADO_PR = {
  urgente: { t: 'Urgente', c: 'out', i: 'siren' },
  comprar: { t: 'Comprar', c: 'low', i: 'shopping-cart' },
  ok: { t: 'Alcanza', c: 'ok', i: 'circle-check' },
  sin: { t: 'Sin retiros', c: 'mute', i: 'minus' }
};

VIEWS.pronostico = {
  title: () => 'Pronóstico y compras',
  mount(el) {
    const f = prF();
    el.innerHTML = `
      <div class="page-head"><p>Aprende de cada retiro: qué días se retira más, hacia dónde va el consumo y cuánto vas a necesitar. Se recalcula solo con cada movimiento.</p></div>
      <div class="panel"><div class="panel-b pron-ctl">
        <div class="pc-g"><span class="lbl">Período a cubrir</span>
          <div class="chips" id="pr-per">${[7, 14, 30].map(n => `<button class="chip" data-per="${n}">${n} días</button>`).join('')}</div></div>
        <div class="pc-g"><span class="lbl" id="pr-ent-l">La mercadería tarda en llegar</span>
          <div class="stepper sm" role="group" aria-labelledby="pr-ent-l"><button type="button" data-ent="-1" aria-label="Un día menos">${ic('minus', 's')}</button><span class="stv"><b id="pr-ent">${f.entrega}</b> días</span><button type="button" data-ent="1" aria-label="Un día más">${ic('plus', 's')}</button></div></div>
        <div class="pc-g"><span class="lbl">Margen de seguridad</span>
          <div class="chips" id="pr-mg">${Object.entries(MARGENES).map(([k, m]) => `<button class="chip" data-mg="${k}" title="${m.s}">${m.t}</button>`).join('')}</div>
          <span class="hint" id="pr-mg-s"></span></div>
      </div></div>
      <div id="pr-aviso"></div>
      <div class="kpis k4 mt" id="pr-kpis"></div>
      <div class="panel">
        <div class="panel-h"><h2>Consumo real y pronóstico</h2><span class="sub" id="pr-ch-sub"></span><span class="sp"></span>
          <div class="chips" id="pr-gr"><button class="chip" data-gr="dia">Por día</button><button class="chip" data-gr="semana">Por semana</button></div></div>
        <div class="chart-box"><canvas id="pr-chart" aria-label="Gráfico de consumo real y pronóstico"></canvas></div>
      </div>
      <div class="cols-2e mt">
        <div class="panel"><div class="panel-h"><h2>Qué días se retira más</h2><span class="sub">Comparado con un día promedio</span></div><div class="panel-b flush" id="pr-dow"></div></div>
        <div class="panel"><div class="panel-h"><h2>Lo que detectó</h2></div><ul class="ins" id="pr-ins"></ul></div>
      </div>
      <div class="panel mt">
        <div class="panel-h"><h2>Qué comprar</h2><span class="sub" id="pr-t-sub"></span><span class="sp"></span>
          <label class="check"><input type="checkbox" id="pr-solo" ${f.soloComprar ? 'checked' : ''}> Solo lo que hay que comprar</label>${expBtns('pr')}</div>
        <div class="tbl-wrap" style="margin-top:8px"><table class="rt resp pr-t">
          <thead><tr><th>Premio</th><th class="n">Stock</th><th class="n">Por día</th><th class="n">Necesitas</th><th>Alcanza hasta</th><th class="n">Comprar</th><th>Estado</th></tr></thead>
          <tbody id="pr-tb"></tbody></table></div>
      </div>
      <div class="panel mt">
        <div class="panel-h"><h2>Fechas especiales y temporadas</h2><span class="sub">Feriados, cierres, eventos, vacaciones y vuelta a clases</span><span class="sp"></span>
          <button class="btn sm pri" id="pr-addf">${ic('calendar-plus', 's')}Agregar fecha</button></div>
        <ul class="list fe-list" id="pr-fechas" style="margin-top:8px"></ul>
        <div class="panel-b" style="padding-top:6px"><button class="btn sm ghost" id="pr-todas"></button></div>
      </div>
      <p class="muted pr-pie">Cómo calcula: toma lo retirado en las últimas 12 semanas (lo reciente pesa más), el efecto de cada día de la semana, la tendencia, los faltantes de inventario, los feriados y las temporadas (vacaciones, vuelta a clases, fiestas), que aprende comparando con las semanas anteriores y con el año pasado. Los días cerrados no se cuentan. El pedido sugerido cubre el período con el margen elegido y deja al menos el stock mínimo de cada premio.</p>`;

    const c = chartColors();
    const alfa = (hex, a) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
    const o = chartOpts(c, true); o.scales.x.stacked = true; o.scales.y.stacked = true;
    o.plugins.tooltip.callbacks = {
      label: ctx => {
        const v = ctx.parsed.y; if (!v) return null;
        const extra = ctx.dataset._rango && ctx.dataset._rango[ctx.dataIndex];
        return `${ctx.dataset.label}: ${fU(v)}${extra ? ` (entre ${fU(extra[0])} y ${fU(extra[1])})` : ''}`;
      }
    };
    this.chart = makeChart($('#pr-chart'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Retirado', data: [], backgroundColor: c.s2, borderRadius: 4, maxBarThickness: 22, categoryPercentage: .8, barPercentage: .9, stack: 's' },
        { label: 'Faltantes sin identificar', data: [], backgroundColor: c.s3, borderRadius: 4, maxBarThickness: 22, categoryPercentage: .8, barPercentage: .9, stack: 's' },
        { label: 'Pronóstico', data: [], backgroundColor: alfa(c.s2, .22), borderColor: c.s2, borderWidth: { top: 2, left: 0, right: 0, bottom: 0 }, borderSkipped: false, borderRadius: 4, maxBarThickness: 22, categoryPercentage: .8, barPercentage: .9, stack: 's', _rango: [] }
      ] },
      options: o
    });

    const re = () => { prGuardar(f); this.paint(); icons(); };
    $('#pr-per').onclick = e => { const b = e.target.closest('[data-per]'); if (!b) return; f.per = +b.dataset.per; re(); };
    $('#pr-mg').onclick = e => { const b = e.target.closest('[data-mg]'); if (!b) return; f.margen = b.dataset.mg; re(); };
    $('#pr-gr').onclick = e => { const b = e.target.closest('[data-gr]'); if (!b) return; f.gr = b.dataset.gr; re(); };
    el.querySelector('.stepper').onclick = e => { const b = e.target.closest('[data-ent]'); if (!b) return; f.entrega = Math.min(30, Math.max(0, f.entrega + +b.dataset.ent)); $('#pr-ent').textContent = f.entrega; re(); };
    $('#pr-solo').onchange = e => { f.soloComprar = e.target.checked; re(); };
    $('#pr-todas').onclick = () => { f.todas = !f.todas; this.paintFechas(); icons(); };
    $('#pr-addf').onclick = () => modalFecha();
    $('#pr-fechas').onclick = e => { const b = e.target.closest('[data-fe]'); if (b) modalFecha((S.especiales || []).find(x => x.id === +b.dataset.fe)); };
    $('#pr-tb').onclick = e => { const r = e.target.closest('[data-pp]'); if (r) modalPronPremio(r.dataset.pp); };
    bindExp(el, 'pr', () => ({
      base: 'lista_de_compras',
      title: `Qué comprar: próximos ${f.per} días (margen ${MARGENES[f.margen].t.toLowerCase()}, la mercadería tarda ${f.entrega} días)`,
      cols: [
        { h: 'Premio o grupo', v: r => r.nombre },
        { h: 'Marcas', v: r => r.g ? r.ms.map(p => `${p.nombre} (${p.stock_actual})`).join(', ') : '' },
        { h: 'Stock actual', v: r => r.stock },
        { h: 'Consumo por día', v: r => r.sinDatos ? 0 : Math.round(r.porDia * 10) / 10 },
        { h: `Necesario ${f.per} días`, v: r => Math.round(r.necesita) },
        { h: 'Rango probable', v: r => r.sinDatos ? '' : `${Math.round(r.lo)} a ${Math.round(r.hi)}` },
        { h: 'Alcanza hasta', v: r => r.sinDatos ? 'Sin retiros' : !r.agota ? 'Más de 4 meses' : r.agota <= this.plan.hoy ? 'Agotado' : fFecha(r.agota) },
        { h: 'Comprar (unidades)', v: r => r.pedido },
        { h: 'Marca a comprar', v: r => r.pedido > 0 ? (r.pref ? r.pref.nombre : 'Cualquiera') : '' },
        { h: 'Paquetes', v: r => r.paquetes ? `${r.paquetes} x ${r.pk}` : '' },
        { h: 'Estado', v: r => ESTADO_PR[r.estado].t }
      ],
      rows: this.filasVisibles()
    }));
    this.paint();
    if (S.especialesErr) $('#pr-aviso').innerHTML = `<div class="callout warn mt">${ic('database', 's')}<span>Para guardar fechas especiales y cajas por premio falta ejecutar en Supabase el archivo <b>migracion_08_pronostico.sql</b>. El pronóstico funciona igual.</span></div>`;
  },

  filasVisibles() { const f = S.f.pron; return (this.plan ? this.plan.filas : []).filter(r => !f.soloComprar || r.pedido > 0 || r.estado === 'urgente'); },

  paint() {
    if (!$('#pr-tb')) return;
    const f = S.f.pron;
    $$('#pr-per .chip').forEach(b => b.classList.toggle('on', +b.dataset.per === f.per));
    $$('#pr-mg .chip').forEach(b => b.classList.toggle('on', b.dataset.mg === f.margen));
    $$('#pr-gr .chip').forEach(b => b.classList.toggle('on', b.dataset.gr === f.gr));
    $('#pr-mg-s').textContent = MARGENES[f.margen].s;
    const plan = this.plan = planCompras({ per: f.per, entrega: f.entrega, margen: f.margen });
    const { M, hoy, hoyReg, rit } = plan;

    if (M.vacio) {
      $('#pr-kpis').innerHTML = '';
      $('#pr-aviso').innerHTML = `<div class="callout info mt">${ic('sparkles', 's')}<span>Todavía no hay retiros registrados. Con los primeros días de uso la app empieza a detectar el consumo, y a partir de las 2 semanas ya reconoce los días más movidos.</span></div>`;
    } else if (!S.especialesErr) $('#pr-aviso').innerHTML = '';

    // ---- KPIs
    const ya = sum([...hoyReg.values()]);
    const hoyF = factorFecha(M, hoy);
    const espHoy = M.R * multFecha(M, hoy);
    const lunesH = lunes(hoy);
    const regEn = (a, b) => sum(salidasVig().filter(m => { const d = new Date(m.creado_en); return d >= a && d < b; }), qtyEf);
    const ahora = new Date();
    const semAct = regEn(lunesH, ahora), semAnt = regEn(addDias(lunesH, -7), new Date(ahora - 7 * DIA_MS));
    const conDatos = plan.filas.filter(r => !r.sinDatos);
    const nec = sum(conDatos, r => r.necesita), lo = sum(conDatos, r => r.lo), hi = sum(conDatos, r => r.hi);
    const nComprar = plan.filas.filter(r => r.pedido > 0).length, nUrg = plan.filas.filter(r => r.estado === 'urgente').length;
    const bt = backtest();
    const conf = M.vacio || M.n < 14 ? { t: 'Baja', c: 'warn', s: `Lleva ${M.n || 0} día(s) de datos; mejora a partir de las 2 semanas` }
      : (M.n < 42 || (bt && bt.semana > 0.25)) ? { t: 'Media', c: 'low', s: bt ? `La semana pasada se desvió ${Math.round(bt.semana * 100)}%` : `${M.n} días de datos` }
      : { t: 'Alta', c: 'ok', s: bt ? `La semana pasada se desvió ${Math.round(bt.semana * 100)}%` : `${M.n} días de datos` };
    let ritTxt = '';
    if (hoyF.f === 0) ritTxt = 'Hoy está cerrado';
    else if (rit.ratio != null) ritTxt = Math.abs(rit.ratio - 1) < 0.1 ? 'Viene al ritmo normal' : `Viene un ${Math.round(Math.abs(rit.ratio - 1) * 100)}% ${rit.ratio > 1 ? 'más movido' : 'más tranquilo'} que lo normal`;
    else ritTxt = `Lo normal para un ${DOW_SG[hoy.getDay()]}: ~${fU(espHoy)}`;
    $('#pr-kpis').innerHTML = M.vacio ? '' : `
      <div class="kpi ${rit.ratio != null && rit.ratio > 1.15 ? 'warn' : ''}"><span class="kpi-l">${ic('sun', 's')}Hoy</span><span class="kpi-v">${fNum(ya)}</span><span class="kpi-s">${ritTxt}</span></div>
      <div class="kpi"><span class="kpi-l">${ic('calendar-range', 's')}Esta semana</span><span class="kpi-v">${fNum(semAct)}</span><span class="kpi-s">${semAnt > 0 ? `${pct(semAct / semAnt - 1)} que la semana pasada a esta altura` : `De lunes a ${DOW_SG[hoy.getDay()]}`}</span></div>
      <div class="kpi"><span class="kpi-l">${ic('package-search', 's')}Necesitas en ${f.per} días</span><span class="kpi-v">~${fU(nec)}</span><span class="kpi-s">Entre ${fU(lo)} y ${fU(hi)} unidades${nComprar ? ` · ${nComprar} premio(s) para comprar` : ''}</span></div>
      <div class="kpi ${nUrg ? 'bad' : ''}"><span class="kpi-l">${ic('gauge', 's')}Confianza: ${conf.t}</span><span class="kpi-v">${nUrg ? `${nUrg} urgente${nUrg > 1 ? 's' : ''}` : 'Al día'}</span><span class="kpi-s">${conf.s}</span></div>`;

    this.paintChart(plan);
    this.paintDow(M);
    this.paintIns(plan, bt, semAct, semAnt);
    this.paintTabla(plan);
    this.paintFechas();
  },

  paintChart({ P, hoy }) {
    const f = S.f.pron, ch = this.chart; if (!ch) return;
    const regPorDia = new Map(), falPorDia = new Map();
    salidasVig().forEach(m => { const k = ymd(m.creado_en); regPorDia.set(k, (regPorDia.get(k) || 0) + qtyEf(m)); });
    faltantes().forEach(m => { const k = ymd(m.creado_en); falPorDia.set(k, (falPorDia.get(k) || 0) + uFalt(m)); });
    const pronDia = i => { let e = 0, v = 0; P.forEach(x => { e += x.e[i] || 0; v += x.v[i] || 0; }); return { e, v }; };
    const L = [], R1 = [], R2 = [], PR = [], RG = [];
    if (f.gr === 'dia') {
      for (let i = -27; i < f.per; i++) {
        const d = addDias(hoy, i), k = ymd(d);
        L.push(i === 0 ? 'Hoy' : fDiaC(d));
        if (i <= 0) { R1.push(regPorDia.get(k) || 0); R2.push(falPorDia.get(k) || 0); } else { R1.push(0); R2.push(0); }
        if (i >= 0) { const p = pronDia(i); PR.push(p.e); RG.push([Math.max(0, p.e - Z80 * Math.sqrt(p.v)), p.e + Z80 * Math.sqrt(p.v)]); } else { PR.push(0); RG.push(null); }
      }
      $('#pr-ch-sub').textContent = `Últimas 4 semanas y próximos ${f.per} días`;
    } else {
      const l0 = lunes(hoy);
      const semanas = Math.ceil((f.per + (hoy - l0) / DIA_MS) / 7);
      for (let w = -7; w < semanas; w++) {
        const a = addDias(l0, w * 7);
        let r = 0, fa = 0, e = 0, v = 0;
        for (let j = 0; j < 7; j++) {
          const d = addDias(a, j), k = ymd(d), i = Math.round((d - hoy) / DIA_MS);
          if (i <= 0) { r += regPorDia.get(k) || 0; fa += falPorDia.get(k) || 0; }
          if (i >= 0 && i < f.per) { const p = pronDia(i); e += p.e; v += p.v; }
        }
        L.push(w === 0 ? 'Esta semana' : `Sem. ${a.getDate()}/${a.getMonth() + 1}`);
        R1.push(r); R2.push(fa); PR.push(e); RG.push(e ? [Math.max(0, e - Z80 * Math.sqrt(v)), e + Z80 * Math.sqrt(v)] : null);
      }
      $('#pr-ch-sub').textContent = 'Semanas de lunes a domingo';
    }
    ch.data.labels = L;
    ch.data.datasets[0].data = R1; ch.data.datasets[1].data = R2; ch.data.datasets[2].data = PR.map(x => Math.round(x * 10) / 10); ch.data.datasets[2]._rango = RG;
    ch.data.datasets[1].hidden = !R2.some(Boolean);
    ch.update();
  },

  paintDow(M) {
    const box = $('#pr-dow');
    if (M.vacio || M.n < 7) { box.innerHTML = `<div class="empty">${ic('calendar-days')}<b>Hace falta al menos una semana de datos</b>Lleva ${M.n || 0} día(s).</div>`; return; }
    const orden = [1, 2, 3, 4, 5, 6, 0], max = Math.max(...M.idx);
    box.innerHTML = orden.map(d => {
      const v = M.idx[d], dif = v - 1;
      return `<div class="hbar dow ${dif > 0.08 ? 'up' : dif < -0.08 ? 'down' : ''}"><span class="nm">${DOW_SG[d][0].toUpperCase() + DOW_SG[d].slice(1)}</span><span class="tr"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><span class="num strong">${Math.abs(dif) < 0.03 ? 'Normal' : pct(dif)}</span></div>`;
    }).join('') + `<p class="muted dow-n">Basado en ${M.n} días. ${M.n < 21 ? 'Con 3 semanas o más el patrón es más preciso.' : ''}</p>`;
  },

  paintIns({ M, filas, hoy }, bt, semAct, semAnt) {
    const f = S.f.pron, out = [];
    const add = (i, html, cls = '') => out.push(`<li class="${cls}">${ic(i, 's')}<span>${html}</span></li>`);
    if (M.vacio) { $('#pr-ins').innerHTML = `<li>${ic('hourglass', 's')}<span>Esperando los primeros retiros.</span></li>`; return; }
    const urg = filas.filter(r => r.estado === 'urgente');
    if (urg.length) add('siren', `<b>${urg.length === 1 ? esc(urg[0].nombre) + ' se acaba' : urg.length + ' premios se acaban'}</b> antes de que llegue la mercadería (${f.entrega} días): ${urg.slice(0, 4).map(r => `${esc(r.nombre)} ${r.agota <= hoy ? '(ya agotado)' : `(${fechaCorta(r.agota)})`}`).join(', ')}.`, 'bad');
    if (M.n >= 7) {
      const ds = [0, 1, 2, 3, 4, 5, 6].filter(d => M.nW[d] > 0);
      const top = ds.reduce((a, b) => M.idx[b] > M.idx[a] ? b : a, ds[0]), low = ds.reduce((a, b) => M.idx[b] < M.idx[a] ? b : a, ds[0]);
      if (M.idx[top] > 1.1) add('trending-up', `Los <b>${DOW_PL[top]}</b> se retira un <b>${Math.round((M.idx[top] - 1) * 100)}% más</b> que un día promedio.`);
      if (M.idx[low] < 0.9) add('trending-down', `Los <b>${DOW_PL[low]}</b> son los más tranquilos: un ${Math.round((1 - M.idx[low]) * 100)}% menos.`);
    }
    if (M.pend && M.ratio) add(M.ratio > 1 ? 'arrow-up-right' : 'arrow-down-right', `El consumo viene <b>${M.ratio > 1 ? 'subiendo' : 'bajando'}</b>: ${pct(M.ratio - 1)} cada 2 semanas. Ya está incluido en el cálculo.`);
    else if (semAnt > 0 && Math.abs(semAct / semAnt - 1) >= 0.2 && new Date().getDay() !== 1) add('activity', `Esta semana va ${pct(semAct / semAnt - 1)} contra la semana pasada a esta altura.`);
    const tot = sum(filas.filter(r => !r.sinDatos), r => r.necesita);
    const big = filas.filter(r => !r.sinDatos).sort((a, b) => b.necesita - a.necesita)[0];
    if (big && tot > 0 && big.necesita / tot > 0.25) add('crown', `<b>${esc(big.nombre)}</b> es el ${Math.round(big.necesita / tot * 100)}% de todo lo que se va a retirar.`);
    if (M.merma > 0.02) add('scale', `Los faltantes de inventario suman un <b>${Math.round(M.merma * 100)}% extra</b> sobre lo registrado; el pedido ya los contempla.`);
    const tHoy = M.cal ? M.cal.temporadaDe(ymd(hoy)) : null;
    const tTxt = t => t.factor != null ? efectoTxt(Number(t.factor)).toLowerCase() : (M.FT && M.FT.get(nombreBase(t.nombre))) ? `automático, ${efectoTxt(M.fTemp(t)).toLowerCase()}` : 'automático: se ajusta con los primeros días';
    if (tHoy) add('calendar-range', `Estás en <b>${esc(tHoy.nombre)}</b> (hasta el ${fechaCorta(parseYmd(tHoy.fecha_fin))}): ${tTxt(tHoy)}.`);
    const prox = M.cal ? M.cal.temps.find(t => t.fecha > ymd(hoy) && t.fecha < ymd(addDias(hoy, f.per + f.entrega))) : null;
    if (prox) add('calendar-range', `El ${fechaCorta(parseYmd(prox.fecha))} empieza <b>${esc(prox.nombre)}</b>: ${tTxt(prox)}. Ya está en el cálculo.`);
    for (let i = 0; i < f.per; i++) {
      const d = addDias(hoy, i), ff = factorFecha(M, d);
      if (!ff.e) continue;
      add(ff.f === 0 ? 'store' : 'calendar-heart', `${i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `El ${fechaCorta(d)}`}: <b>${esc(ff.e.nombre)}</b> · ${ff.f === 0 ? 'cerrado, no se cuenta' : ff.txt.toLowerCase()}.`);
    }
    const sin = filas.filter(r => r.sinDatos);
    if (sin.length) add('circle-dashed', `${sin.length} premio(s) sin retiros en las últimas 12 semanas: ${sin.slice(0, 4).map(r => esc(r.nombre)).join(', ')}${sin.length > 4 ? '…' : ''}.`);
    if (bt) add('target', `Precisión: la semana pasada pronosticó ${fU(bt.pred)} y se retiraron ${fU(bt.act)} (${Math.round(bt.semana * 100)}% de diferencia).`);
    $('#pr-ins').innerHTML = out.join('') || `<li>${ic('circle-check', 's')}<span>Todo en orden: nada se acaba en el período.</span></li>`;
  },

  paintTabla(plan) {
    const f = S.f.pron, filas = this.filasVisibles();
    $('#pr-t-sub').textContent = `Para ${f.per} días · margen ${MARGENES[f.margen].t.toLowerCase()} · llega en ${f.entrega} día(s)`;
    const alc = r => r.sinDatos ? '<span class="muted">Sin retiros</span>' : !r.agota ? '<span class="muted">Más de 4 meses</span>' : r.agota <= plan.hoy ? '<b class="t-out">Agotado</b>' : `${fechaCorta(r.agota)} <span class="muted">(${Math.round((r.agota - plan.hoy) / DIA_MS)} d)</span>`;
    const comp = r => r.pedido > 0 ? `<b>${fNum(r.pedido)}</b>${r.paquetes ? `<div class="t2">${r.paquetes} ${r.paquetes > 1 ? 'paquetes' : 'paquete'} de ${r.pk}</div>` : ''}` : '<span class="muted">—</span>';
    const est = r => { const e = ESTADO_PR[r.estado]; return `<span class="badge ${e.c}">${ic(e.i, 's')}${e.t}</span>`; };
    const nombreCell = r => r.g
      ? `<div class="pname">${esc(r.nombre)} <span class="gtag">${ic('layers', 's')}${r.ms.length} marcas</span></div><div class="pcode">${r.ms.map(p => `${esc(p.nombre)} ${fNum(p.stock_actual)}`).join(' · ')}</div>`
      : `<div class="pname">${esc(r.nombre)}</div><div class="pcode">${esc(catName(r.p.categoria_id))}</div>`;
    const deQue = r => r.pedido > 0 && r.g ? `<div class="t2">${r.pref ? `de ${esc(r.pref.nombre)}` : 'de cualquier marca'}</div>` : '';
    const pDia = r => r.porDia < 10 ? r.porDia.toFixed(1).replace('.', ',') : fU(r.porDia);
    $('#pr-tb').innerHTML = filas.length ? filas.map(r => `
      <tr data-pp="${r.key}" class="clk" title="Ver el detalle de ${esc(r.nombre)}">
        <td><div class="pcell">${thumb(r.p)}<div style="min-width:0">${nombreCell(r)}</div></div></td>
        <td class="n num">${fNum(r.stock)}</td>
        <td class="n num">${r.sinDatos ? '—' : pDia(r)}</td>
        <td class="n num">${r.sinDatos ? '—' : `~${fU(r.necesita)}<div class="t2">${fU(r.lo)} a ${fU(r.hi)}</div>`}</td>
        <td>${alc(r)}</td>
        <td class="n num">${comp(r)}${deQue(r)}</td>
        <td>${est(r)}</td>
        <td class="mob"><div class="mrow">${thumb(r.p)}<div class="grow"><div class="t1">${esc(r.nombre)}${r.g ? ` <span class="gtag">${ic('layers', 's')}${r.ms.length} marcas</span>` : ''}</div>
          <div class="t2">Stock ${fNum(r.stock)}${r.sinDatos ? '' : ` · ~${pDia(r)} por día`}</div>
          <div class="t3">Alcanza hasta: ${alc(r)}</div><div style="margin-top:6px">${est(r)}</div></div>
          <div class="mr"><span class="t2">Comprar</span><span class="big">${r.pedido > 0 ? fNum(r.pedido) : '—'}</span>${r.paquetes ? `<span class="t2">${r.paquetes} × ${r.pk}</span>` : ''}${r.pedido > 0 && r.g && r.pref ? `<span class="t2">${esc(r.pref.nombre)}</span>` : ''}</div></div></td>
      </tr>`).join('') : emptyRow(7, f.soloComprar ? 'No hace falta comprar nada' : 'No hay premios activos', f.soloComprar ? 'Con el stock actual alcanza para todo el período.' : '', 'circle-check');
  },

  paintFechas() {
    const f = S.f.pron, box = $('#pr-fechas'); if (!box) return;
    const hoyK = ymd(new Date()), lim = ymd(addDias(new Date(), 60));
    const todas = (S.especiales || []).filter(e => (e.fecha_fin || e.fecha) >= hoyK).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const lista = f.todas ? todas : todas.filter(e => e.fecha <= lim);
    const M = this.plan ? this.plan.M : modeloPronostico({});
    const admin = rolActual() === 'admin';
    const mes = d => d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    box.innerHTML = lista.length ? lista.map(e => {
      const d = parseYmd(e.fecha), rango = esRango(e);
      let f1, txt;
      if (rango) { f1 = M.fTemp ? M.fTemp(e) : (e.factor != null ? Number(e.factor) : 1); txt = e.factor != null ? efectoTxt(f1) : (M.FT && M.FT.get(nombreBase(e.nombre))) ? `Automático: ${efectoTxt(f1)}` : 'Automático: aprende al empezar'; }
      else if (esCerrado(e)) { f1 = 0; txt = 'Cerrado'; }
      else if (e.factor != null) { f1 = Number(e.factor); txt = efectoTxt(f1); }
      else if (esFeriado(e)) { f1 = M.F || 1; txt = M.nFer ? `Automático: ${efectoTxt(f1)}` : 'Automático: como un día normal'; }
      else { f1 = 1; txt = 'Normal'; }
      const cls = (f1 === 0 || /aprende|normal/i.test(txt)) ? 'mute' : f1 > 1.03 ? 'low' : f1 < 0.97 ? 't-salida' : 'ok';
      const d2 = rango ? parseYmd(e.fecha_fin) : null;
      const sub = rango ? `Del ${d.getDate()} ${mes(d)} al ${d2.getDate()} ${mes(d2)} · ${Math.round((d2 - d) / DIA_MS) + 1} días` : `${DOW_SG[d.getDay()][0].toUpperCase() + DOW_SG[d.getDay()].slice(1)} · ${{ feriado: 'Feriado', no_laborable: 'No laborable', evento: 'Evento', cerrado: 'Cierre' }[e.tipo] || ''}`;
      return `<li class="${rango ? 'temp' : ''}"><div class="fe-d">${rango ? ic('calendar-range', 's') : `<b>${d.getDate()}</b>`}<span>${rango ? mes(d) : mes(d)}</span></div>
        <div class="grow"><div class="t1">${esc(e.nombre)}</div><div class="t2">${sub}</div></div>
        <span class="badge ${cls}">${txt}</span>
        ${admin ? `<button class="btn sm icon ghost" data-fe="${e.id}" title="Editar" aria-label="Editar ${esc(e.nombre)}">${ic('pencil', 's')}</button>` : ''}</li>`;
    }).join('') : `<li class="keep"><div class="grow"><div class="t2">${S.especialesErr ? 'Falta ejecutar la migración 08 para guardar fechas especiales.' : 'No hay fechas especiales ni temporadas en los próximos 60 días.'}</div></div></li>`;
    const resto = todas.length - lista.length;
    const bt = $('#pr-todas');
    bt.textContent = f.todas ? 'Ver solo los próximos 60 días' : resto > 0 ? `Ver todas (${resto} más)` : '';
    bt.style.display = (f.todas || resto > 0) ? '' : 'none';
  }
};

function modalFecha(e) {
  if (S.especialesErr) { toast('Primero hay que ejecutar en Supabase el archivo migracion_08_pronostico.sql.', 'warn'); return; }
  const nuevo = !e;
  const efActual = e ? (e.factor == null ? '' : String(Number(e.factor))) : '1';
  const m = modal({
    title: nuevo ? 'Agregar fecha especial' : 'Editar fecha especial',
    body: `<form id="fe-f" class="stack">
      <div class="form-err" id="fe-err"></div>
      <div class="grid2">
        <div class="field"><label for="fe-d">Fecha</label><input class="in" type="date" id="fe-d" value="${e ? e.fecha : ymd(addDias(new Date(), 1))}" required></div>
        <div class="field"><label for="fe-h">Hasta <span class="muted">(solo temporadas)</span></label><input class="in" type="date" id="fe-h" value="${e && e.fecha_fin ? e.fecha_fin : ''}"></div>
      </div>
      <div class="field"><label for="fe-n">Nombre</label><input class="in" id="fe-n" maxlength="80" placeholder="Ej.: Vacaciones del equipo, acción especial en el shopping" value="${e ? esc(e.nombre) : ''}" required></div>
      <div class="field"><label for="fe-t">Tipo</label><select class="in" id="fe-t">
        ${[['temporada', 'Temporada (varios días: vacaciones, vuelta a clases, fiestas)'], ['evento', 'Evento (acción, promoción, día movido)'], ['feriado', 'Feriado (se abre)'], ['no_laborable', 'Día no laborable (se abre)'], ['cerrado', 'Cierre (no se abre)']].map(([v, t]) => `<option value="${v}" ${(e ? e.tipo === v : v === 'evento') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="fe-x">¿Cómo cambia el consumo ese día?</label><select class="in" id="fe-x">
        ${EFECTOS.map(x => `<option value="${x.v}" ${x.v === efActual ? 'selected' : ''}>${x.t}</option>`).join('')}</select>
        <span class="hint">Si no sabes cuánto cambia, deja "Automático": en feriados lo calcula con feriados anteriores, y en temporadas compara con las semanas previas y con la misma temporada del año anterior.</span></div>
    </form>`,
    foot: `${nuevo ? '' : '<button class="btn danger" id="fe-del" type="button">Eliminar</button><span class="sp"></span>'}<button class="btn" data-close>Cancelar</button><button class="btn pri" id="fe-ok">${nuevo ? 'Agregar' : 'Guardar'}</button>`
  });
  const tipo = m.$('#fe-t'), ef = m.$('#fe-x'), hasta = m.$('#fe-h');
  tipo.onchange = () => { if (tipo.value === 'cerrado') ef.value = '0'; else if (ef.value === '0') ef.value = tipo.value === 'evento' ? '1' : ''; if (tipo.value === 'temporada' && !hasta.value) hasta.focus(); };
  hasta.onchange = () => { if (hasta.value && hasta.value > m.$('#fe-d').value) { tipo.value = 'temporada'; if (ef.value === '0') ef.value = ''; } };
  ef.onchange = () => { if (ef.value === '0') tipo.value = 'cerrado'; else if (tipo.value === 'cerrado') tipo.value = 'evento'; };
  const guardar = async () => {
    const fecha = m.$('#fe-d').value, nombre = m.$('#fe-n').value.trim();
    let fecha_fin = tipo.value === 'temporada' ? (hasta.value || null) : null;
    if (!fecha || !nombre) return showErr(m.$('#fe-err'), 'Completa la fecha y el nombre.');
    if (tipo.value === 'temporada' && !fecha_fin) return showErr(m.$('#fe-err'), 'Una temporada necesita la fecha de inicio y la fecha "Hasta".');
    if (fecha_fin && fecha_fin <= fecha) return showErr(m.$('#fe-err'), 'La fecha "Hasta" tiene que ser posterior a la de inicio.');
    let factor = ef.value === '' ? null : Number(ef.value);
    if (factor == null && tipo.value === 'evento') factor = 1;
    const datos = { fecha, fecha_fin, nombre, tipo: tipo.value, factor };
    await busy(m.$('#fe-ok'), async () => {
      try {
        const row = nuevo ? await API.crearFecha({ ...datos, creado_por: S.perfil.id }) : await API.editarFecha(e.id, datos);
        S.especiales = (S.especiales || []).filter(x => x.id !== row.id).concat(row);
        m.close(); toast(nuevo ? 'Fecha agregada. El pronóstico ya la tiene en cuenta.' : 'Fecha actualizada.', 'ok', 3000); paintCurrent();
      } catch (er) { showErr(m.$('#fe-err'), /duplicate|unique/i.test(errMsg(er)) ? 'Ya hay una fecha especial ese día: edítala desde la lista.' : errMsg(er)); }
    });
  };
  m.$('#fe-ok').onclick = guardar;
  m.$('#fe-f').onsubmit = ev => { ev.preventDefault(); guardar(); };
  if (!nuevo) m.$('#fe-del').onclick = async () => {
    m.close();
    if (!await confirmar({ title: 'Eliminar fecha especial', body: `<p>Se elimina <b>${esc(e.nombre)}</b> (${fFecha(parseYmd(e.fecha))}${esRango(e) ? ` al ${fFecha(parseYmd(e.fecha_fin))}` : ''}) y ${esRango(e) ? 'esos días pasan' : 'ese día pasa'} a calcularse como normales.</p>`, ok: 'Eliminar', danger: true })) return;
    try { await API.borrarFecha(e.id); S.especiales = S.especiales.filter(x => x.id !== e.id); toast('Fecha eliminada.', 'ok', 2500); paintCurrent(); }
    catch (er) { toast('No se pudo eliminar: ' + esc(errMsg(er)), 'bad'); }
  };
}

function modalPronPremio(key) {
  const v = VIEWS.pronostico, plan = v.plan; if (!plan) return;
  const r = plan.filas.find(x => x.key === key); if (!r) return;
  const f = S.f.pron, hoy = plan.hoy, pr = plan.P.get(key);
  const ids = new Set(r.ms.map(p => p.id));
  const regPorDia = new Map();
  salidasVig().filter(m => ids.has(m.premio_id)).forEach(m => { const k = ymd(m.creado_en); regPorDia.set(k, (regPorDia.get(k) || 0) + qtyEf(m)); });
  const edit = rolActual() === 'admin';
  const md = modal({
    title: esc(r.nombre), size: 'lg',
    body: `<div class="kpis k3" style="margin-bottom:12px">
        <div class="kpi"><span class="kpi-l">Stock${r.g ? ' del grupo' : ''}</span><span class="kpi-v">${fNum(r.stock)}</span><span class="kpi-s">Mínimo ${fNum(r.minimo)}</span></div>
        <div class="kpi"><span class="kpi-l">Por día</span><span class="kpi-v">${r.sinDatos ? '—' : r.porDia.toFixed(1).replace('.', ',')}</span><span class="kpi-s">${r.t && r.t.fal ? `Incluye ${Math.round(r.t.m * 100)}% de faltantes` : r.g ? 'Todas las marcas juntas' : 'Promedio reciente'}</span></div>
        <div class="kpi"><span class="kpi-l">Comprar</span><span class="kpi-v">${r.pedido ? fNum(r.pedido) : '—'}</span><span class="kpi-s">${r.pedido && r.g ? (r.pref ? `De ${esc(r.pref.nombre)}` : 'De cualquier marca') : ''}${r.paquetes ? `${r.pedido && r.g ? ' · ' : ''}${r.paquetes} paquete(s) de ${r.pk}` : r.sinDatos ? 'Sin retiros recientes' : r.pedido && r.g ? '' : `Cubre ~${fU(r.cubre || 0)} en ${f.per} días`}</span></div>
      </div>
      ${r.g ? `<ul class="list" style="margin:0 0 12px">${r.ms.map(p => `<li>${thumb(p)}<div class="grow"><div class="t1">${esc(p.nombre)}${r.pref && r.pref.id === p.id ? ' <span class="badge ok">Se compra esta</span>' : ''}</div><div class="t2">${p.stock_actual > 0 ? `${fNum(p.stock_actual)} en stock` : 'Sin stock de esta marca'}</div></div></li>`).join('')}</ul>` : ''}
      <div class="chart-box" style="height:240px;padding:0"><canvas id="pp-ch" aria-label="Consumo de ${esc(r.nombre)}"></canvas></div>
      <p class="muted" style="margin:10px 0 0">${r.sinDatos ? 'Sin retiros en las últimas 12 semanas.' : !r.agota ? 'Con el consumo actual alcanza por más de 4 meses.' : r.agota <= hoy ? (r.g ? 'No queda ninguna marca.' : 'Está agotado.') : `Al ritmo actual ${r.g ? 'el grupo' : ''} se acaba el <b>${fechaCorta(r.agota)}</b>.`}
      ${r.g && !r.pref ? ' Elige en "Grupos de marcas" cuál conviene comprar.' : ''}
      ${!r.g && !(Number(r.p.unidades_por_paquete) > 1) ? ' Si viene en cajas o bolsas, carga cuántas unidades trae cada una en "Editar premio" y el pedido se redondea solo.' : ''}</p>`,
    foot: `${edit ? (r.g ? '<button class="btn" id="pp-ed">Editar grupo</button>' : '<button class="btn" id="pp-ed">Editar premio</button>') : ''}<span class="sp"></span><button class="btn pri" data-close>Listo</button>`
  });
  const ed = md.$('#pp-ed'); if (ed) ed.onclick = () => { md.close(); r.g ? modalGrupo(r.g) : modalPremio(r.p); };
  const c = chartColors(), L = [], A = [], F = [];
  for (let i = -20; i < f.per; i++) {
    const d = addDias(hoy, i);
    L.push(i === 0 ? 'Hoy' : fDiaC(d));
    A.push(i <= 0 ? (regPorDia.get(ymd(d)) || 0) : 0);
    F.push(i >= 0 && pr ? Math.round(pr.e[i] * 10) / 10 : 0);
  }
  const o = chartOpts(c, true); o.scales.x.stacked = true; o.scales.y.stacked = true;
  const ch = new window.Chart(md.$('#pp-ch'), { type: 'bar', data: { labels: L, datasets: [
    { label: 'Retirado', data: A, backgroundColor: c.s2, borderRadius: 3, stack: 's', maxBarThickness: 18 },
    { label: 'Pronóstico', data: F, backgroundColor: c.s2 + '38', borderColor: c.s2, borderWidth: { top: 2, left: 0, right: 0, bottom: 0 }, borderSkipped: false, borderRadius: 3, stack: 's', maxBarThickness: 18 }] }, options: o });
  const obs = new MutationObserver(() => { if (!document.body.contains(md.el)) { ch.destroy(); obs.disconnect(); } });
  obs.observe($('#modals'), { childList: true });
}

/* =============================================================
   VISTA: DASHBOARD
   ============================================================= */
VIEWS.dashboard = {
  title: () => 'Dashboard',
  mount(el) {
    const admin = isAdmin();
    el.innerHTML = `
      <div class="kpis" id="d-kpis"></div>
      ${admin ? `
      <div class="cols-2">
        <div class="panel">
          <div class="panel-h"><h2>Ingresos y salidas</h2><span class="sub">Unidades por día, últimos 14 días</span></div>
          <div class="chart-box"><canvas id="d-chart" aria-label="Gráfico de ingresos y salidas por día"></canvas></div>
        </div>
        <div class="gap" style="align-content:start">
          <div class="panel">
            <div class="panel-h"><h2>¿Quién sacó un premio?</h2></div>
            <div class="panel-b"><select class="in" id="d-quien"><option value="">Elige un premio para ver quién lo retiró</option>${optPremios('', false)}</select></div>
          </div>
          <div class="panel"><div class="panel-h"><h2>Alertas de stock</h2><span class="sp"></span><a class="btn ghost sm" href="#/stock?est=alerta">Ver en stock</a></div><div class="panel-b flush"><ul class="list" id="d-alertas"></ul></div></div>
        </div>
      </div>
      <div class="cols-2e mt">
        <div class="panel"><div class="panel-h"><h2>Últimos movimientos</h2><span class="sp"></span><a class="btn ghost sm" href="#/historial">Ver historial</a></div><div class="panel-b flush"><ul class="list" id="d-movs"></ul></div></div>
        <div class="gap" style="align-content:start">
          <div class="panel"><div class="panel-h"><h2>Retirado hoy por sector</h2><span class="sub">Unidades</span></div><div class="panel-b flush" id="d-sec"></div></div>
          <div class="panel"><div class="panel-h"><h2>Últimas personas que retiraron</h2></div><div class="panel-b flush"><ul class="list" id="d-personas"></ul></div></div>
          <div class="panel"><div class="panel-h"><h2>Premios más retirados</h2><span class="sub">Este mes</span></div><div class="panel-b flush" id="d-top"></div></div>
        </div>
      </div>` : `
      <div class="cols-2">
        <div class="panel">
          <div class="panel-h"><h2>Registrar un retiro</h2></div>
          <div class="panel-b stack">
            <p class="muted" style="margin:0">Elige el premio y la cantidad que retiras. Tu nombre, la fecha y la hora se guardan solos.</p>
            <div><a class="btn pri lg" href="#/rapido">${ic('zap')}Retiro rápido</a></div>
          </div>
        </div>
        <div class="panel"><div class="panel-h"><h2>Alertas de stock</h2></div><div class="panel-b flush"><ul class="list" id="d-alertas"></ul></div></div>
      </div>
      <div class="panel mt"><div class="panel-h"><h2>Mis últimos movimientos</h2><span class="sp"></span><a class="btn ghost sm" href="#/perfil">Ver mi historial</a></div><div class="panel-b flush"><ul class="list" id="d-movs"></ul></div></div>`}`;
    if (admin) {
      const c = chartColors();
      this.chart = makeChart($('#d-chart'), {
        type: 'bar',
        data: { labels: [], datasets: [
          { label: 'Ingresos', data: [], backgroundColor: c.s1, borderRadius: 4, maxBarThickness: 16, categoryPercentage: .72, barPercentage: .86 },
          { label: 'Salidas', data: [], backgroundColor: c.s2, borderRadius: 4, maxBarThickness: 16, categoryPercentage: .72, barPercentage: .86 },
          { label: 'Faltantes sin identificar', data: [], backgroundColor: c.s3, borderRadius: 4, maxBarThickness: 16, categoryPercentage: .72, barPercentage: .86 }
        ] },
        options: chartOpts(c, true)
      });
      $('#d-quien').onchange = e => { if (e.target.value) { modalQuien(+e.target.value); e.target.value = ''; } };
    }
    el.addEventListener('click', e => {
      const k = e.target.closest('[data-kpi]');
      if (k) go('stock', { est: k.dataset.kpi });
    });
    this.paint();
  },
  paint() {
    if (!$('#d-kpis')) return;
    const admin = isAdmin();
    const act = S.premios.filter(p => p.activo);
    const uds = unidadesStock();
    const bajo = uds.filter(u => u.estado === 'bajo');
    const agot = uds.filter(u => u.estado === 'agotado');
    const hoy = ymd(new Date()), mes = hoy.slice(0, 7);
    const sal = salidasVig();
    const sHoy = sum(sal.filter(m => ymd(m.creado_en) === hoy), qtyEf);
    const sMes = sum(sal.filter(m => ymd(m.creado_en).startsWith(mes)), qtyEf);
    const fal = admin ? faltantes() : [];
    const fHoy = sum(fal.filter(m => ymd(m.creado_en) === hoy), uFalt);
    const fMes = sum(fal.filter(m => ymd(m.creado_en).startsWith(mes)), uFalt);
    const inact = S.premios.length - act.length;
    const quien = admin ? 'por todo el equipo' : 'por ti';
    const detalle = (r, f) => f ? `${fNum(r)} registrados + ${fNum(f)} sin identificar` : `Unidades ${quien}`;
    $('#d-kpis').innerHTML = `
      <div class="kpi"><span class="kpi-l">${ic('gift', 's')}Tipos de premios</span><span class="kpi-v">${fNum(act.length)}</span><span class="kpi-s">${inact ? `${inact} desactivado(s)` : 'Activos'}</span></div>
      <div class="kpi"><span class="kpi-l">${ic('boxes', 's')}Unidades en stock</span><span class="kpi-v">${fNum(sum(act, p => p.stock_actual))}</span><span class="kpi-s">Total disponible</span></div>
      <button class="kpi ${bajo.length ? 'warn' : ''}" data-kpi="bajo"><span class="kpi-l">${ic('triangle-alert', 's')}Stock bajo</span><span class="kpi-v">${fNum(bajo.length)}</span><span class="kpi-s">En el mínimo o por debajo</span></button>
      <button class="kpi ${agot.length ? 'bad' : ''}" data-kpi="agotado"><span class="kpi-l">${ic('octagon-alert', 's')}Agotados</span><span class="kpi-v">${fNum(agot.length)}</span><span class="kpi-s">Sin unidades</span></button>
      <div class="kpi"><span class="kpi-l">${ic('package-minus', 's')}Retirados hoy</span><span class="kpi-v">${fNum(sHoy + fHoy)}</span><span class="kpi-s">${detalle(sHoy, fHoy)}</span></div>
      <div class="kpi"><span class="kpi-l">${ic('calendar', 's')}Retirados este mes</span><span class="kpi-v">${fNum(sMes + fMes)}</span><span class="kpi-s">${detalle(sMes, fMes)}</span></div>`;

    // alertas de stock (estado actual)
    const alertas = [...agot, ...bajo.sort((a, b) => a.stock - b.stock)];
    $('#d-alertas').innerHTML = alertas.length ? alertas.slice(0, 8).map(u => `
      <li>${thumb(u.p)}<div class="grow"><div class="t1">${esc(u.nombre)}${u.g ? ` <span class="muted small">(${u.n} marca${u.n === 1 ? '' : 's'})</span>` : ''}</div><div class="t2">${u.estado === 'agotado' ? (u.g ? 'No queda ninguna marca' : 'No quedan unidades') : `Quedan ${fNum(u.stock)}${u.g ? ' entre todas las marcas' : ''} · mínimo ${fNum(u.minimo)}`}</div></div><span class="badge ${ESTADOS[u.estado].c}"><span class="d"></span>${ESTADOS[u.estado].t}</span></li>`).join('')
      + (alertas.length > 8 ? `<li class="muted small">Y ${alertas.length - 8} más.</li>` : '')
      : `<li><div class="empty" style="width:100%">${ic('circle-check')}<b>Todo el stock está en orden</b>Ningún premio activo está en el mínimo.</div></li>`;

    // últimos movimientos
    const movs = S.movs.slice(0, 8);
    $('#d-movs').innerHTML = movs.length ? movs.map(m => `
      <li><span class="mv-ic t-${m.tipo}">${ic(TIPOS[m.tipo].i, 's')}</span>
      <div class="grow"><div class="t1">${fraseMov(m)}</div><div class="t2">${rel(m.creado_en)}${m.sector_nombre ? ` · ${esc(m.sector_nombre)}` : ''}${m.observacion ? ` · ${esc(trunc(m.observacion, 60))}` : ''}</div></div>
      <span class="v ${m.delta > 0 ? 'diff-pos' : 'diff-neg'}">${signo(m.delta)}</span></li>`).join('')
      : `<li><div class="empty" style="width:100%">${ic('inbox')}<b>Todavía no hay movimientos</b>${admin ? 'Carga premios y registra el primer ingreso.' : 'Cuando registres un retiro aparecerá aquí.'}</div></li>`;

    if (!admin) return;

    // personas que retiraron
    const vistos = new Set(), personas = [];
    for (const m of sal) { const k = m.usuario_id || m.usuario_nombre; if (!vistos.has(k)) { vistos.add(k); personas.push(m); } if (personas.length >= 6) break; }
    $('#d-personas').innerHTML = personas.length ? personas.map(m => `
      <li><span class="avatar">${esc(iniciales(m.usuario_nombre))}</span><div class="grow"><div class="t1">${esc(m.usuario_nombre)}</div><div class="t2">${fNum(qtyEf(m))} × ${esc(pNombre(m))}</div></div><span class="muted small">${rel(m.creado_en)}</span></li>`).join('')
      : `<li><div class="empty" style="width:100%">${ic('users')}<b>Sin retiros todavía</b></div></li>`;

    // hoy por sector
    const ps = {};
    sal.filter(m => ymd(m.creado_en) === hoy).forEach(m => { const k = m.sector_nombre || 'Sin sector'; ps[k] = (ps[k] || 0) + qtyEf(m); });
    if (fHoy) ps[SIN_ID] = (ps[SIN_ID] || 0) + fHoy;
    const psl = Object.entries(ps).sort((a, b) => b[1] - a[1]);
    const psm = psl.length ? psl[0][1] : 1;
    $('#d-sec').innerHTML = psl.length ? psl.map(([k, n]) => `<div class="hbar"><span class="nm">${esc(k)}</span><span class="tr"><i style="width:${(n / psm * 100).toFixed(1)}%"></i></span><span class="num strong">${fNum(n)}</span></div>`).join('')
      : `<div class="empty">${ic('zap')}<b>Hoy todavía no hubo retiros</b></div>`;

    // top del mes
    const tot = {};
    sal.filter(m => ymd(m.creado_en).startsWith(mes)).forEach(m => { tot[m.premio_id] = (tot[m.premio_id] || 0) + qtyEf(m); });
    const top = Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const max = top.length ? top[0][1] : 1;
    $('#d-top').innerHTML = top.length ? top.map(([id, n]) => `
      <div class="hbar"><span class="nm">${esc((premio(id) || {}).nombre || '—')}</span><span class="tr"><i style="width:${(n / max * 100).toFixed(1)}%"></i></span><span class="num strong">${fNum(n)}</span></div>`).join('')
      : `<div class="empty">${ic('chart-column')}<b>Sin retiros este mes</b></div>`;

    // gráfico 14 días
    if (this.chart) {
      const labels = [], ing = [], sa = [], fa = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = ymd(d);
        labels.push(d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }));
        ing.push(sum(ingresosVig().filter(m => ymd(m.creado_en) === k), qtyEf));
        sa.push(sum(sal.filter(m => ymd(m.creado_en) === k), qtyEf));
        fa.push(sum(fal.filter(m => ymd(m.creado_en) === k), uFalt));
      }
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = ing;
      this.chart.data.datasets[1].data = sa;
      this.chart.data.datasets[2].data = fa;
      this.chart.data.datasets[2].hidden = !fa.some(Boolean);
      this.chart.update('none');
    }
  }
};

/* =============================================================
   VISTA: STOCK DE PREMIOS
   ============================================================= */
VIEWS.stock = {
  title: () => 'Stock de Premios',
  mount(el) {
    const f = S.f.stock, admin = isAdmin();
    if (S.params.est) f.est = S.params.est;
    el.innerHTML = `
      <div class="page-head">
        <p>Stock actual de cada premio. Los números cambian solos cuando alguien registra un movimiento.</p>
        <span class="sp"></span>
        ${admin && !S.gruposErr ? `<button class="btn" id="s-grp">${ic('layers')}Grupos de marcas</button>` : ''}
        ${admin ? `<button class="btn pri" id="s-new">${ic('plus')}Nuevo premio</button>` : ''}
      </div>
      <div class="panel">
        <div class="panel-b" style="padding-bottom:6px">
          <div class="toolbar">
            <div class="in-ic">${ic('search')}<input class="in" id="s-q" placeholder="Buscar por nombre, código o descripción" value="${esc(f.q)}"></div>
            <select class="in" id="s-cat" aria-label="Categoría"><option value="">Todas las categorías</option>${optCats(f.cat)}</select>
            <select class="in" id="s-sort" aria-label="Orden">
              <option value="nombre">Ordenar por nombre</option>
              <option value="stock_asc">Menor stock primero</option>
              <option value="stock_desc">Mayor stock primero</option>
              <option value="reciente">Movimiento más reciente</option>
            </select>
          </div>
          <div class="row" style="margin-bottom:8px">
            <div class="chips" id="s-est">
              <button class="chip" data-est="">Todos</button>
              <button class="chip" data-est="ok"><span class="d" style="background:var(--ok)"></span>Stock correcto</button>
              <button class="chip" data-est="bajo"><span class="d" style="background:var(--low-dot)"></span>Stock bajo</button>
              <button class="chip" data-est="agotado"><span class="d" style="background:var(--out)"></span>Sin stock</button>
            </div>
            <span class="sp"></span>
            ${admin ? `<label class="check"><input type="checkbox" id="s-inact" ${f.inact ? 'checked' : ''}>Mostrar desactivados</label>` : ''}
            <span class="muted small" id="s-cnt"></span>
          </div>
        </div>
        <div class="tbl-wrap"><table class="rt resp">
          <thead><tr><th>Premio</th><th>Categoría</th><th class="n">Stock actual</th><th class="n">Stock mínimo</th><th>Estado</th><th>Último movimiento</th><th class="n">Acciones</th></tr></thead>
          <tbody id="s-tb"></tbody>
        </table></div>
      </div>`;
    $('#s-sort').value = f.sort;
    $('#s-q').oninput = debounce(e => { f.q = e.target.value; this.paint(); icons(); applyFlashes(); }, 120);
    $('#s-cat').onchange = e => { f.cat = e.target.value; this.paint(); icons(); };
    $('#s-sort').onchange = e => { f.sort = e.target.value; this.paint(); icons(); };
    $('#s-est').onclick = e => { const b = e.target.closest('[data-est]'); if (!b) return; f.est = b.dataset.est; this.paint(); icons(); };
    if ($('#s-inact')) $('#s-inact').onchange = e => { f.inact = e.target.checked; this.paint(); icons(); };
    if ($('#s-new')) $('#s-new').onclick = () => modalPremio();
    if ($('#s-grp')) $('#s-grp').onclick = () => modalGrupos();
    $('#s-tb').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = +b.dataset.id, p = premio(id);
      switch (b.dataset.act) {
        case 'retirar':
          if (isAdmin()) go('movimiento', { premio: id, tipo: 'salida' });
          else { S.rap.cart[id] = Math.min((S.rap.cart[id] || 0) + 1, p.stock_actual); go('rapido'); }
          break;
        case 'ingresar': go('movimiento', { premio: id, tipo: 'ingreso' }); break;
        case 'cargar': go('cargar', { premio: id }); break;
        case 'quien': modalQuien(id); break;
        case 'hist': go('historial', { premio: id }); break;
        case 'editar': modalPremio(p); break;
        case 'toggle': togglePremio(p); break;
        case 'borrar': borrarPremio(p); break;
        case 'mas': popMenu(b, [
          { t: 'Historial del premio', i: 'history', f: () => go('historial', { premio: id }) },
          { t: 'Editar', i: 'pencil', f: () => modalPremio(p) },
          { t: p.activo ? 'Desactivar' : 'Activar', i: p.activo ? 'eye-off' : 'eye', f: () => togglePremio(p) },
          { t: 'Eliminar', i: 'trash-2', f: () => borrarPremio(p), danger: true }
        ]); break;
      }
    };
    this.paint();
  },
  paint() {
    const tb = $('#s-tb'); if (!tb) return;
    const f = S.f.stock, admin = isAdmin(), q = norm(f.q);
    $$('#s-est .chip').forEach(c => c.classList.toggle('on', c.dataset.est === (f.est === 'alerta' ? '' : f.est)));
    let rows = S.premios.filter(p => (f.inact && admin) || p.activo);
    if (q) rows = rows.filter(p => norm(`${p.nombre} ${p.codigo} ${p.descripcion || ''}`).includes(q));
    if (f.cat) rows = rows.filter(p => String(p.categoria_id) === f.cat);
    if (f.est === 'alerta') rows = rows.filter(enAlerta);
    else if (f.est === 'ok') rows = rows.filter(p => ['ok', 'marca'].includes(estadoDe(p)));
    else if (f.est) rows = rows.filter(p => estadoDe(p) === f.est);
    const sorters = {
      nombre: byName,
      stock_asc: (a, b) => a.stock_actual - b.stock_actual || byName(a, b),
      stock_desc: (a, b) => b.stock_actual - a.stock_actual || byName(a, b),
      reciente: (a, b) => new Date(b.ultimo_movimiento_en || 0) - new Date(a.ultimo_movimiento_en || 0)
    };
    rows = rows.slice().sort(sorters[f.sort] || byName);
    $('#s-cnt').textContent = `${rows.length} premio(s)${f.est === 'alerta' ? ' con alerta' : ''}`;
    if (!rows.length) {
      tb.innerHTML = emptyRow(7, S.premios.length ? 'No hay premios con estos filtros' : 'Todavía no hay premios cargados',
        S.premios.length ? 'Prueba con otra búsqueda o categoría.' : (admin ? 'Crea el primero con el botón "Nuevo premio".' : 'Un administrador debe cargarlos.'), 'gift');
      return;
    }
    tb.innerHTML = rows.map(p => {
      const acts = `${p.activo && isJefe() ? `<button class="btn go" data-act="cargar" data-id="${p.id}" title="Cargar stock que llegó">Cargar</button>` : ''}${p.activo && p.stock_actual > 0 && puedeRetirar() ? `<button class="btn go" data-act="retirar" data-id="${p.id}" title="Registrar un retiro">Retirar</button>` : ''}
          ${admin ? `
            ${p.activo ? `<button class="btn" data-act="ingresar" data-id="${p.id}" title="Registrar ingreso" aria-label="Registrar ingreso">${ic('package-plus', 's')}</button>` : ''}
            <button class="btn" data-act="quien" data-id="${p.id}" title="¿Quién lo sacó?" aria-label="¿Quién lo sacó?">${ic('user-search', 's')}</button>
            <button class="btn" data-act="mas" data-id="${p.id}" title="Más opciones" aria-label="Más opciones" aria-haspopup="menu">${ic('ellipsis-vertical', 's')}</button>` : ''}`;
      return `
      <tr class="${p.activo ? '' : 'void'}">
        <td class="main-cell" data-label="Premio"><div class="pcell">${thumb(p)}<div style="min-width:0"><div class="pname">${esc(p.nombre)}</div><div class="pcode">${esc(p.codigo)}${grupoTag(p) ? ` · ${grupoTag(p)}` : ''}</div></div></div></td>
        <td data-label="Categoría">${esc(catName(p.categoria_id))}</td>
        <td data-label="Stock actual" class="n">${lvl(p)}</td>
        <td data-label="Stock mínimo" class="n num">${grupoDe(p) ? `${fNum(grupoDe(p).stock_minimo || 0)}<div class="muted small">del grupo</div>` : fNum(p.stock_minimo)}</td>
        <td data-label="Estado">${badgeEstado(p)}</td>
        <td data-label="Último movimiento"><span class="muted">${p.ultimo_movimiento_en ? rel(p.ultimo_movimiento_en) : 'Sin movimientos'}</span></td>
        <td data-label="" class="n"><div class="acts">${acts}</div></td>
        <td class="mob"><div class="mrow">${thumb(p)}<div class="grow"><div class="t1">${esc(p.nombre)}</div><div class="t2">${esc(catName(p.categoria_id))}</div>${grupoTag(p) ? `<div class="t2">${grupoTag(p)}</div>` : ''}<div style="margin-top:6px">${badgeEstado(p)}</div></div>
          <div class="mr"><span class="big">${stockSpan(p)}</span><span class="t2">${grupoDe(p) ? `mínimo ${fNum(grupoDe(p).stock_minimo || 0)} del grupo` : `mínimo ${fNum(p.stock_minimo)}`}</span></div></div>
          ${acts.trim() ? `<div class="acts" style="margin-top:6px">${acts}</div>` : ''}</td>
      </tr>`; }).join('');
  }
};

/* =============================================================
   GRUPOS DE MARCAS QUE SE REEMPLAZAN
   ============================================================= */
function modalGrupos() {
  const lista = () => {
    const gs = (S.grupos || []).slice().sort(byName);
    return gs.length ? `<ul class="list grp-list">${gs.map(g => {
      const ms = miembrosDe(g), pref = ms.find(x => x.id === g.preferido_id), e = estadoGrupo(g);
      return `<li><span class="grp-ic">${ic('layers', 's')}</span><div class="grow"><div class="t1">${esc(g.nombre)} <span class="badge ${ESTADOS[e].c}"><span class="d"></span>${fNum(stockGrupo(g))} en total</span></div>
        <div class="t2">${ms.length ? ms.map(p => `${esc(p.nombre)} (${fNum(p.stock_actual)})`).join(' · ') : 'Sin marcas todavía'}</div>
        <div class="t3">Mínimo del grupo: ${fNum(g.stock_minimo || 0)}${pref ? ` · Se compra: <b>${esc(pref.nombre)}</b>` : ''}</div></div>
        <button class="btn sm" data-g="${g.id}">${ic('pencil', 's')}Editar</button></li>`;
    }).join('')}</ul>` : `<div class="empty">${ic('layers')}<b>Todavía no hay grupos</b>Crea uno para cada producto que tenga varias marcas, por ejemplo "Turrones" o "Alfajores".</div>`;
  };
  const m = modal({
    title: 'Grupos de marcas', size: 'lg',
    body: `<p class="muted" style="margin:0 0 12px">Junta las marcas que se reemplazan entre sí. La app controla el <b>total del grupo</b>: si falta una marca pero hay otra, no avisa. El pronóstico calcula el grupo completo y sugiere comprar la marca que elijas (la más barata).</p><div id="grp-box">${lista()}</div>`,
    foot: `<button class="btn" data-close>Cerrar</button><span class="sp"></span><button class="btn pri" id="grp-new">${ic('plus', 's')}Nuevo grupo</button>`
  });
  const refrescar = () => { const b = m.$('#grp-box'); if (b) { b.innerHTML = lista(); icons(); } };
  m.$('#grp-new').onclick = () => modalGrupo(null, refrescar);
  m.$('#grp-box').onclick = e => { const b = e.target.closest('[data-g]'); if (b) modalGrupo((S.grupos || []).find(g => g.id === +b.dataset.g), refrescar); };
}

function modalGrupo(g, alGuardar) {
  const nuevo = !g;
  const sel = new Set(g ? miembrosDe(g).map(p => p.id) : []);
  let pref = g ? g.preferido_id : null;
  const act = S.premios.filter(p => p.activo).sort(byName);
  const fila = p => {
    const otro = p.grupo_id && (!g || p.grupo_id !== g.id) ? grupoDe(p) : null;
    return `<label class="grp-m ${sel.has(p.id) ? 'on' : ''}" data-pid="${p.id}">
      <input type="checkbox" value="${p.id}" ${sel.has(p.id) ? 'checked' : ''}>
      ${thumb(p)}<span class="grow"><span class="t1">${esc(p.nombre)}</span><span class="t2">Stock ${fNum(p.stock_actual)}${otro ? ` · ahora en ${esc(otro.nombre)}` : ''}</span></span>
      ${sel.has(p.id) ? `<button type="button" class="btn sm pref ${pref === p.id ? 'on' : ''}" data-pref="${p.id}" title="Esta es la que conviene comprar">${ic(pref === p.id ? 'badge-check' : 'shopping-cart', 's')}${pref === p.id ? 'Se compra esta' : 'Comprar esta'}</button>` : ''}
    </label>`;
  };
  const m = modal({
    title: nuevo ? 'Nuevo grupo de marcas' : `Editar grupo: ${esc(g.nombre)}`, size: 'lg',
    body: `<form id="gf" class="stack">
      <div class="form-err" id="ge"></div>
      <div class="grid2">
        <div class="field"><label for="gn">Nombre del grupo</label><input class="in" id="gn" maxlength="60" placeholder="Ej.: Turrones" value="${g ? esc(g.nombre) : ''}" required></div>
        <div class="field"><label for="gmin">Mínimo del grupo</label><input class="in num" id="gmin" type="number" min="0" step="1" value="${g ? g.stock_minimo || 0 : 0}"><span class="hint">Avisa cuando el total de todas las marcas llega a este número.</span></div>
      </div>
      <div class="field"><label>Marcas del grupo</label>
        <div class="in-ic" style="margin-bottom:8px">${ic('search')}<input class="in" id="gq" placeholder="Buscar premio"></div>
        <div class="grp-ms" id="gms">${act.map(fila).join('')}</div>
        <span class="hint" id="gsum"></span></div>
    </form>`,
    foot: `${nuevo ? '' : '<button class="btn danger" type="button" id="gdel">Eliminar grupo</button><span class="sp"></span>'}<button class="btn" data-close>Cancelar</button><button class="btn pri" id="gok">${nuevo ? 'Crear grupo' : 'Guardar'}</button>`
  });
  const resumen = () => {
    const ms = act.filter(p => sel.has(p.id));
    m.$('#gsum').innerHTML = ms.length ? `${ms.length} marca(s) · ${fNum(sum(ms, p => Math.max(0, p.stock_actual)))} unidades en total${pref && sel.has(pref) ? ` · se compra ${esc((premio(pref) || {}).nombre || '')}` : ' · elige con "Comprar esta" la que conviene'}` : 'Marca las que se reemplazan entre sí.';
  };
  const repintar = () => { m.$('#gms').innerHTML = act.filter(p => !m.$('#gq').value || norm(p.nombre).includes(norm(m.$('#gq').value))).map(fila).join(''); icons(); resumen(); };
  m.$('#gq').oninput = repintar;
  m.$('#gms').onclick = e => {
    const b = e.target.closest('[data-pref]');
    if (b) { e.preventDefault(); pref = +b.dataset.pref; repintar(); return; }
  };
  m.$('#gms').onchange = e => {
    const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
    const id = +cb.value; if (cb.checked) sel.add(id); else { sel.delete(id); if (pref === id) pref = null; }
    if (!pref && sel.size === 1) pref = id;
    showErr(m.$('#ge'), ''); repintar();
  };
  resumen();
  const guardar = async () => {
    const nombre = m.$('#gn').value.trim(), min = parseInt(m.$('#gmin').value, 10);
    if (!nombre) return showErr(m.$('#ge'), 'Ponle un nombre al grupo.');
    if (isNaN(min) || min < 0) return showErr(m.$('#ge'), 'El mínimo debe ser 0 o mayor.');
    if (sel.size < 2) return showErr(m.$('#ge'), 'Un grupo necesita al menos 2 marcas.');
    if ((S.grupos || []).some(x => (!g || x.id !== g.id) && norm(x.nombre) === norm(nombre))) return showErr(m.$('#ge'), 'Ya existe un grupo con ese nombre.');
    const enOtro = act.filter(p => sel.has(p.id) && p.grupo_id && (!g || p.grupo_id !== g.id));
    if (enOtro.length && !await confirmar({ title: 'Mover marcas de grupo', body: `<p>${enOtro.map(p => `<b>${esc(p.nombre)}</b> está en ${esc(grupoDe(p).nombre)}`).join('<br>')}.</p><p>Se pasan a <b>${esc(nombre)}</b>.</p>`, ok: 'Mover' })) return;
    await busy(m.$('#gok'), async () => {
      try {
        const datos = { nombre, stock_minimo: min, preferido_id: pref && sel.has(pref) ? pref : null };
        const row = nuevo ? await API.crearGrupo(datos) : await API.editarGrupo(g.id, datos);
        S.grupos = (S.grupos || []).filter(x => x.id !== row.id).concat(row);
        const cambios = S.premios.filter(p => (sel.has(p.id) && p.grupo_id !== row.id) || (!sel.has(p.id) && p.grupo_id === row.id));
        for (const p of cambios) upsertPremioLocal(await API.editarPremio(p.id, { grupo_id: sel.has(p.id) ? row.id : null }));
        m.close(); toast(nuevo ? `Grupo "${esc(nombre)}" creado.` : 'Grupo actualizado.', 'ok', 2800);
        updateNavBadge(); paintCurrent(); if (alGuardar) alGuardar();
      } catch (er) { showErr(m.$('#ge'), /duplicate|unique/i.test(errMsg(er)) ? 'Ya existe un grupo con ese nombre.' : errMsg(er)); }
    });
  };
  m.$('#gok').onclick = guardar;
  m.$('#gf').onsubmit = ev => { ev.preventDefault(); guardar(); };
  if (!nuevo) m.$('#gdel').onclick = async () => {
    m.close();
    if (!await confirmar({ title: 'Eliminar grupo', body: `<p>Se elimina el grupo <b>${esc(g.nombre)}</b>. Las marcas no se borran: vuelven a controlarse cada una por su cuenta, con su propio mínimo.</p>`, ok: 'Eliminar', danger: true })) return;
    try {
      for (const p of miembrosDe(g)) upsertPremioLocal(await API.editarPremio(p.id, { grupo_id: null }));
      await API.borrarGrupo(g.id); S.grupos = S.grupos.filter(x => x.id !== g.id);
      toast('Grupo eliminado.', 'ok', 2500); updateNavBadge(); paintCurrent(); if (alGuardar) alGuardar();
    } catch (er) { toast('No se pudo eliminar: ' + esc(errMsg(er)), 'bad'); }
  };
}

function upsertPremioLocal(row) {
  const i = S.premios.findIndex(p => p.id === row.id);
  if (i >= 0) {
    if (S.premios[i].stock_actual !== row.stock_actual) flash(row.id, row.stock_actual - S.premios[i].stock_actual);
    S.premios[i] = row;
  } else S.premios.push(row);
  S.premios.sort(byName);
}
function siguienteCodigo() {
  const n = S.premios.map(p => parseInt(String(p.codigo).replace(/\D/g, ''), 10)).filter(x => !isNaN(x));
  return `PRM-${pad((n.length ? Math.max(...n) : 0) + 1, 4)}`;
}
async function resizeImage(file, max = 640) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  } finally { URL.revokeObjectURL(url); }
}

function modalPremio(p) {
  const nuevo = !p;
  let blob = null, quitar = false;
  const m = modal({
    title: nuevo ? 'Nuevo premio' : 'Editar premio', size: 'lg',
    body: `
      <form id="pf" class="stack">
        <div class="form-err" id="pe"></div>
        <div class="img-drop">
          <div id="pimg">${thumb(p, true)}</div>
          <div class="stack" style="gap:6px">
            <div class="row">
              <label class="btn sm">${ic('image-up', 's')}Subir imagen<input type="file" id="pfile" accept="image/*" hidden></label>
              <button type="button" class="btn sm ghost" id="pquitar">Quitar imagen</button>
            </div>
            <span class="hint muted small">Opcional. JPG o PNG; se reduce automáticamente.</span>
          </div>
        </div>
        <div class="grid2">
          <div class="field"><label for="pn">Nombre del premio *</label><input class="in" id="pn" value="${esc(p ? p.nombre : '')}" placeholder="Ej.: Auriculares inalámbricos" required></div>
          <div class="field"><label for="pc">Código *</label><input class="in" id="pc" value="${esc(p ? p.codigo : siguienteCodigo())}" required></div>
        </div>
        <div class="field"><label for="pd">Descripción</label><textarea class="in" id="pd" rows="2" placeholder="Modelo, color, talle u otros detalles">${esc(p ? p.descripcion : '')}</textarea></div>
        <div class="${nuevo ? 'grid3' : 'grid2'}">
          <div class="field"><label for="pcat">Categoría</label><select class="in" id="pcat"><option value="">Sin categoría</option>${optCats(p ? p.categoria_id : '')}</select></div>
          <div class="field"><label for="pmin">Stock mínimo</label><input class="in num" id="pmin" type="number" min="0" step="1" value="${p ? p.stock_minimo : 5}"><span class="hint">${grupoDe(p) ? `Está en el grupo ${esc(grupoDe(p).nombre)}: se usa el mínimo del grupo.` : 'Avisa cuando el stock llega a este número.'}</span></div>
          ${nuevo ? `<div class="field"><label for="pini">Stock inicial</label><input class="in num" id="pini" type="number" min="0" step="1" value="0"><span class="hint">Se registra como ingreso.</span></div>` : ''}
        </div>
        ${!S.gruposErr ? `<div class="field"><label for="pgrp">Grupo de marcas</label><select class="in" id="pgrp"><option value="">Ninguno (se controla solo)</option>${(S.grupos || []).map(g => `<option value="${g.id}" ${p && p.grupo_id === g.id ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select><span class="hint">Si es una marca de algo que se reemplaza (por ejemplo, un turrón), elige el grupo: se controla el total y no avisa si falta solo esta marca. Los grupos se crean desde Stock › Grupos de marcas.</span></div>` : ''}
        ${!S.especialesErr ? `<div class="field"><label for="ppaq">Viene en cajas o bolsas de</label><input class="in num" id="ppaq" type="number" min="1" step="1" placeholder="Opcional" value="${p && p.unidades_por_paquete ? p.unidades_por_paquete : ''}"><span class="hint">Unidades por caja, bolsa o paquete. El pedido sugerido se redondea a paquetes completos.</span></div>` : ''}
        ${!nuevo ? `<div class="callout info">${ic('info', 's')}<span>El stock no se edita aquí. Usa <b>Registrar Movimiento</b> (ingreso o ajuste) para que quede en el historial.</span></div>` : ''}
      </form>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="psave">${nuevo ? 'Crear premio' : 'Guardar cambios'}</button>`
  });
  m.$('#pfile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      blob = await resizeImage(f); quitar = false;
      m.$('#pimg').innerHTML = `<div class="thumb lg"><img src="${URL.createObjectURL(blob)}" alt=""></div>`;
    } catch (err) { showErr(m.$('#pe'), 'No se pudo leer la imagen. Prueba con otro archivo.'); }
  };
  m.$('#pquitar').onclick = () => { blob = null; quitar = true; m.$('#pimg').innerHTML = thumb(null, true); icons(); };
  m.$('#pf').onsubmit = e => { e.preventDefault(); m.$('#psave').click(); };
  m.$('#psave').onclick = () => busy(m.$('#psave'), async () => {
    const nombre = m.$('#pn').value.trim(), codigo = m.$('#pc').value.trim();
    const min = parseInt(m.$('#pmin').value, 10), ini = nuevo ? parseInt(m.$('#pini').value || '0', 10) : 0;
    if (!nombre) return showErr(m.$('#pe'), 'Completa el nombre del premio.');
    if (!codigo) return showErr(m.$('#pe'), 'Completa el código.');
    if (isNaN(min) || min < 0) return showErr(m.$('#pe'), 'El stock mínimo debe ser 0 o mayor.');
    if (isNaN(ini) || ini < 0) return showErr(m.$('#pe'), 'El stock inicial debe ser 0 o mayor.');
    const paqIn = m.$('#ppaq'), paq = paqIn && paqIn.value.trim() ? parseInt(paqIn.value, 10) : null;
    if (paq != null && (isNaN(paq) || paq < 1)) return showErr(m.$('#pe'), 'Las unidades por caja deben ser 1 o más (o dejar vacío).');
    try {
      let imagen_url = p ? p.imagen_url : null;
      if (blob) imagen_url = await API.subirImagen(blob);
      else if (quitar) imagen_url = null;
      const datos = { nombre, codigo, descripcion: m.$('#pd').value.trim() || null, categoria_id: m.$('#pcat').value ? +m.$('#pcat').value : null, stock_minimo: min, imagen_url };
      if (paqIn) datos.unidades_por_paquete = paq;
      const grpIn = m.$('#pgrp'); if (grpIn) datos.grupo_id = grpIn.value ? +grpIn.value : null;
      let row;
      if (nuevo) {
        row = await API.crearPremio({ ...datos, creado_por: S.perfil.id });
        upsertPremioLocal(row);
        if (ini > 0) {
          const mov = await API.rpc('registrar_movimiento', { p_premio_id: row.id, p_tipo: 'ingreso', p_cantidad: ini, p_observacion: 'Stock inicial' });
          aplicarMovLocal(mov);
        }
      } else {
        row = await API.editarPremio(p.id, datos);
        upsertPremioLocal(row);
      }
      m.close();
      toast(nuevo ? `Premio creado: <b>${esc(nombre)}</b>.` : `Cambios guardados en <b>${esc(nombre)}</b>.`, 'ok');
      paintCurrent();
    } catch (err) { showErr(m.$('#pe'), errMsg(err)); }
  });
}
async function togglePremio(p) {
  if (p.activo) {
    const ok = await confirmar({ title: 'Desactivar premio', ok: 'Desactivar',
      body: `<p><b>${esc(p.nombre)}</b> dejará de aparecer para retirar. Su historial se conserva y puedes volver a activarlo cuando quieras.</p>` });
    if (!ok) return;
  }
  try { upsertPremioLocal(await API.editarPremio(p.id, { activo: !p.activo })); toast(p.activo ? 'Premio desactivado.' : 'Premio activado.', 'ok'); paintCurrent(); }
  catch (e) { toast(esc(errMsg(e)), 'bad'); }
}
async function borrarPremio(p) {
  const tiene = S.movs.some(m => m.premio_id === p.id);
  if (tiene) {
    const ok = await confirmar({ title: 'Este premio tiene historial', ok: 'Desactivar en su lugar',
      body: `<div class="callout warn">${ic('triangle-alert', 's')}<span><b>${esc(p.nombre)}</b> tiene movimientos registrados y no se puede eliminar sin perder trazabilidad.</span></div><p>Puedes desactivarlo: deja de aparecer para retirar y su historial queda intacto.</p>` });
    if (ok && p.activo) {
      try { upsertPremioLocal(await API.editarPremio(p.id, { activo: false })); toast('Premio desactivado.', 'ok'); paintCurrent(); }
      catch (e) { toast(esc(errMsg(e)), 'bad'); }
    }
    return;
  }
  const ok = await confirmar({ title: 'Eliminar premio', ok: 'Eliminar', danger: true, body: `<p>Se eliminará <b>${esc(p.nombre)}</b>. La acción queda registrada en la auditoría.</p>` });
  if (!ok) return;
  try { await API.eliminarPremio(p.id); S.premios = S.premios.filter(x => x.id !== p.id); toast('Premio eliminado.', 'ok'); paintCurrent(); }
  catch (e) { toast(esc(errMsg(e)), 'bad'); }
}
function modalQuien(id) {
  const p = premio(id); if (!p) return;
  const sal = S.movs.filter(m => m.premio_id === id && m.tipo === 'salida');
  const vig = sal.filter(m => m.estado !== 'anulado');
  const personas = new Set(vig.map(m => m.usuario_id || m.usuario_nombre)).size;
  const m = modal({
    title: `¿Quién sacó ${esc(p.nombre)}?`, size: 'lg',
    body: `
      <div class="row" style="margin-bottom:14px">
        ${thumb(p)}<div><div class="pname">${esc(p.nombre)}</div><div class="muted small">${fNum(sum(vig, qtyEf))} unidades retiradas en ${vig.length} retiro(s) por ${personas} persona(s). Stock actual: ${stockSpan(p)}</div></div>
        <span class="sp"></span>${expBtns('quien')}
      </div>
      <div class="tbl-wrap"><table class="rt cards">
        <thead><tr><th>Usuario</th><th class="n">Cantidad</th><th>Fecha</th><th>Hora</th><th>Observación</th></tr></thead>
        <tbody>${sal.length ? sal.map(x => `
          <tr class="${x.estado === 'anulado' ? 'void' : ''}">
            <td class="main-cell" data-label="Usuario"><div class="pcell"><span class="avatar">${esc(iniciales(x.usuario_nombre))}</span><b>${esc(x.usuario_nombre)}</b></div></td>
            <td data-label="Cantidad" class="n strong">${fNum(qtyEf(x))}${x.estado === 'corregido' ? ` <span class="muted small">(antes ${x.cantidad})</span>` : ''}${x.estado === 'anulado' ? ' <span class="badge mute">Anulado</span>' : ''}</td>
            <td data-label="Fecha">${fFecha(x.creado_en)}</td><td data-label="Hora">${fHora(x.creado_en)}</td>
            <td data-label="Observación">${esc(x.observacion || '—')}</td></tr>`).join('') : emptyRow(5, 'Nadie retiró este premio todavía', '', 'user-search')}</tbody>
      </table></div>`,
    foot: `<a class="btn" href="#/historial?premio=${id}" data-close>Ver historial completo</a><button class="btn pri" data-close>Cerrar</button>`
  });
  bindExp(m.el, 'quien', () => ({
    base: `retiros_${norm(p.nombre).replace(/\W+/g, '_')}`, title: `Retiros de ${p.nombre}`,
    cols: [{ h: 'Usuario', v: x => x.usuario_nombre }, { h: 'Cantidad', v: x => qtyEf(x) }, { h: 'Fecha', v: x => fFecha(x.creado_en) }, { h: 'Hora', v: x => fHora(x.creado_en) }, { h: 'Estado', v: estadoMovTxt }, { h: 'Observación', v: x => x.observacion || '' }],
    rows: sal
  }));
}

/* =============================================================
   VISTA: REGISTRAR MOVIMIENTO
   ============================================================= */
function aplicarMovLocal(mov) {
  if (!mov || !mov.id) return;
  if (!S.movs.some(m => m.id === mov.id)) { S.movs.unshift(mov); S.movs.sort((a, b) => b.id - a.id); }
  const p = premio(mov.premio_id);
  if (p && p.stock_actual !== mov.stock_nuevo) {
    flash(p.id, mov.stock_nuevo - p.stock_actual);
    p.stock_actual = mov.stock_nuevo; p.ultimo_movimiento_en = mov.creado_en;
  }
}
VIEWS.movimiento = {
  title: () => 'Registrar Movimiento',
  mount(el) {
    const f = S.f.mov, admin = isAdmin();
    if (S.params.tipo && (admin || S.params.tipo === 'salida')) f.tipo = S.params.tipo;
    if (isJefe()) f.tipo = 'ingreso';
    else if (!admin) f.tipo = 'salida';
    if (S.params.premio) f.premioId = +S.params.premio;
    if (f.premioId && !(premio(f.premioId) || {}).activo) f.premioId = null;
    el.innerHTML = `
      <div class="mv-layout">
        <div class="panel">
          <div class="panel-h"><h2>1. Elige el premio</h2></div>
          <div class="panel-b">
            <div class="in-ic">${ic('search')}<input class="in" id="m-q" placeholder="Buscar premio" value="${esc(f.q)}"></div>
            <div class="picker" id="m-pick" style="margin-top:12px" role="listbox" aria-label="Premios"></div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-h"><h2>2. Completa el movimiento</h2></div>
          <div class="panel-b stack">
            ${admin ? `<div class="types" id="m-types">
              <button class="type" data-t="salida">${ic('package-minus', 'l')}<span><span class="t">Salida</span><br><span class="s">Retiro de premios</span></span></button>
              <button class="type" data-t="ingreso">${ic('package-plus', 'l')}<span><span class="t">Ingreso</span><br><span class="s">Llegó mercadería</span></span></button>
              <button class="type" data-t="ajuste">${ic('scale', 'l')}<span><span class="t">Ajuste</span><br><span class="s">Corregir con el conteo real</span></span></button>
            </div>` : ''}
            <div id="m-sel"></div>
            <div id="m-qty"></div>
            <div id="m-prev"></div>
            <div class="field"><label for="m-obs" id="m-obs-l"></label><textarea class="in" id="m-obs" rows="2"></textarea></div>
            <div class="form-err" id="m-err"></div>
            <button class="btn pri lg" id="m-go"></button>
            <p class="muted small" style="margin:0">${ic('clock', 's')} Se guardan automáticamente tu nombre (${esc(S.perfil.nombre_completo)}), la fecha y la hora.</p>
          </div>
        </div>
      </div>`;
    $('#m-q').oninput = debounce(e => { f.q = e.target.value; this.paintPicker(); icons(); }, 100);
    $('#m-pick').onclick = e => {
      const b = e.target.closest('[data-pid]'); if (!b || b.classList.contains('dis')) return;
      f.premioId = +b.dataset.pid; this.paint(); icons();
      if (window.innerWidth < 1000) $('#m-sel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if ($('#m-types')) $('#m-types').onclick = e => {
      const b = e.target.closest('[data-t]'); if (!b) return;
      f.tipo = b.dataset.t; this.renderTipo(); this.paint(); icons();
    };
    $('#m-go').onclick = () => this.submit();
    this.renderTipo();
    this.paint();
  },
  renderTipo() {
    const f = S.f.mov;
    $$('#m-types .type').forEach(b => b.classList.toggle('on', b.dataset.t === f.tipo));
    const aj = f.tipo === 'ajuste';
    $('#m-qty').innerHTML = `
      <div class="field"><label for="m-n">${aj ? 'Stock físico contado' : f.tipo === 'ingreso' ? 'Cantidad que ingresa' : 'Cantidad que retiras'}</label>
        <div class="stepper"><button type="button" data-st="-1" aria-label="Restar uno">${ic('minus')}</button>
        <input id="m-n" type="number" inputmode="numeric" min="${aj ? 0 : 1}" step="1" value="${aj ? '' : 1}">
        <button type="button" data-st="1" aria-label="Sumar uno">${ic('plus')}</button></div>
        ${aj ? '<span class="hint">Escribe cuántas unidades hay realmente. El sistema calcula la diferencia.</span>' : ''}</div>
      ${f.tipo === 'salida' && S.sectores.length ? `<div class="field"><label for="m-sec">Sector</label><select class="in" id="m-sec"><option value="">Sin sector</option>${optSectores(S.rap.sector || '')}</select></div>` : ''}`;
    $('#m-obs-l').textContent = aj ? 'Motivo del ajuste (obligatorio)' : 'Observación (opcional)';
    $('#m-obs').placeholder = aj ? 'Ej.: Diferencia detectada durante el inventario' : f.tipo === 'ingreso' ? 'Ej.: Remito 0001-2345 del proveedor' : 'Ej.: Premios entregados en la acción de vereda';
    $('#m-go').textContent = aj ? 'Registrar ajuste' : f.tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar retiro';
    const n = $('#m-n');
    n.oninput = () => this.paintPreview();
    $('#m-qty').onclick = e => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      const v = (parseInt(n.value, 10) || 0) + Number(b.dataset.st);
      n.value = Math.max(aj ? 0 : 1, v); this.paintPreview();
    };
    $('#m-obs').oninput = () => this.paintPreview();
  },
  paintPicker() {
    const f = S.f.mov, q = norm(f.q);
    let list = S.premios.filter(p => p.activo);
    if (q) list = list.filter(p => norm(`${p.nombre} ${p.codigo}`).includes(q));
    $('#m-pick').innerHTML = list.length ? list.map(p => {
      const dis = f.tipo === 'salida' && p.stock_actual <= 0;
      return `<button class="pick ${f.premioId === p.id ? 'on' : ''} ${dis ? 'dis' : ''}" data-pid="${p.id}" role="option" aria-selected="${f.premioId === p.id}" ${dis ? 'aria-disabled="true"' : ''}>
        ${thumb(p)}<span class="grow"><span class="pname" style="display:block">${esc(p.nombre)}</span><span class="pcode">${esc(catName(p.categoria_id))}</span></span>
        <span style="text-align:right"><span class="strong num" style="font-size:17px">${stockSpan(p)}</span><br>${estadoDe(p) === 'ok' ? '<span class="muted small">disponibles</span>' : badgeEstado(p)}</span></button>`;
    }).join('') : `<div class="empty">${ic('search')}<b>No se encontraron premios</b></div>`;
  },
  paint() {
    if (!$('#m-pick')) return;
    this.paintPicker();
    const p = premio(S.f.mov.premioId);
    $('#m-sel').innerHTML = p
      ? `<div class="sel-card">${thumb(p, true)}<div style="min-width:0"><div class="pname" style="font-size:17px">${esc(p.nombre)}</div><div class="muted small">${esc(p.codigo)} · ${esc(catName(p.categoria_id))}</div><div style="margin-top:4px">${badgeEstado(p)}</div></div><span class="sp"></span><div style="text-align:right"><div class="big">${stockSpan(p)}</div><div class="muted small">en stock</div></div></div>`
      : `<div class="callout info">${ic('mouse-pointer-click', 's')}<span>Elige un premio de la lista.</span></div>`;
    this.paintPreview();
  },
  calc() {
    const f = S.f.mov, p = premio(f.premioId);
    const raw = $('#m-n') ? $('#m-n').value : '';
    const n = raw === '' ? NaN : Number(raw);
    const obs = ($('#m-obs') ? $('#m-obs').value : '').trim();
    let err = '', nuevo = null, delta = 0;
    if (!p) err = 'Elige un premio.';
    else if (!Number.isInteger(n)) err = f.tipo === 'ajuste' ? 'Escribe el stock físico contado.' : 'Escribe una cantidad válida.';
    else if (f.tipo === 'ajuste') {
      if (n < 0) err = 'El stock físico no puede ser negativo.';
      else { delta = n - p.stock_actual; nuevo = n; if (delta === 0) err = 'El conteo coincide con el sistema: no hace falta ajustar.'; else if (!obs) err = 'Escribe el motivo del ajuste.'; }
    } else {
      if (n <= 0) err = 'La cantidad debe ser mayor a cero.';
      else if (f.tipo === 'salida' && n > p.stock_actual) err = p.stock_actual === 0 ? `No quedan unidades de ${p.nombre}.` : `Solo hay ${fNum(p.stock_actual)} unidad(es) disponibles de ${p.nombre}.`;
      delta = f.tipo === 'salida' ? -n : n;
      nuevo = p.stock_actual + delta;
    }
    return { p, n, obs, err, delta, nuevo };
  },
  paintPreview() {
    const box = $('#m-prev'); if (!box) return;
    const f = S.f.mov, c = this.calc();
    if (!c.p) { box.innerHTML = ''; $('#m-go').disabled = true; return; }
    const aj = f.tipo === 'ajuste';
    const okN = Number.isInteger(c.n) && c.nuevo !== null && c.nuevo >= 0;
    box.innerHTML = `
      <div class="preview">
        <div><div class="pl">${aj ? 'Stock del sistema' : 'Stock actual'}</div><div class="pv">${fNum(c.p.stock_actual)}</div></div>
        <div class="op">${ic(aj ? 'arrow-right' : f.tipo === 'salida' ? 'minus' : 'plus')}</div>
        <div><div class="pl">${aj ? 'Diferencia' : f.tipo === 'salida' ? 'Retiras' : 'Ingresa'}</div><div class="pv ${aj ? (c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : '') : f.tipo === 'salida' ? 'down' : 'up'}">${okN ? (aj ? signo(c.delta) : fNum(c.n)) : '—'}</div></div>
        <div class="op">${ic('equal')}</div>
        <div><div class="pl">Stock resultante</div><div class="pv">${okN ? fNum(c.nuevo) : '—'}</div></div>
      </div>
      ${c.err && (Number.isInteger(c.n) || aj) && !/^Elige|^Escribe una/.test(c.err) ? `<div class="callout ${/Solo hay|No quedan/.test(c.err) ? 'bad' : 'warn'}" style="margin-top:10px">${ic('triangle-alert', 's')}<span>${esc(c.err)}</span></div>` : ''}
      ${!c.err && okN && c.nuevo > 0 && c.nuevo <= c.p.stock_minimo ? `<div class="callout warn" style="margin-top:10px">${ic('triangle-alert', 's')}<span>Después de este movimiento ${esc(c.p.nombre)} quedará con stock bajo (mínimo ${c.p.stock_minimo}).</span></div>` : ''}
      ${!c.err && okN && c.nuevo === 0 ? `<div class="callout bad" style="margin-top:10px">${ic('octagon-alert', 's')}<span>Con este movimiento ${esc(c.p.nombre)} se queda sin stock.</span></div>` : ''}`;
    icons();
    $('#m-go').disabled = !!c.err;
    showErr($('#m-err'), '');
  },
  async submit() {
    const f = S.f.mov, c = this.calc();
    if (c.err) return showErr($('#m-err'), c.err);
    const nombres = { salida: 'retiro', ingreso: 'ingreso', ajuste: 'ajuste' };
    const ok = await confirmar({
      title: `Confirmar ${nombres[f.tipo]}`, ok: $('#m-go').textContent,
      body: `<dl class="kv">
        <dt>Premio</dt><dd>${esc(c.p.nombre)}</dd>
        <dt>${f.tipo === 'ajuste' ? 'Stock físico' : 'Cantidad'}</dt><dd>${fNum(c.n)}${f.tipo === 'ajuste' ? ` (diferencia ${signo(c.delta)})` : ''}</dd>
        <dt>Stock</dt><dd>${fNum(c.p.stock_actual)} → ${fNum(c.nuevo)}</dd>
        <dt>${f.tipo === 'ajuste' ? 'Motivo' : 'Observación'}</dt><dd>${esc(c.obs || '—')}</dd>
        <dt>Registrado por</dt><dd>${esc(S.perfil.nombre_completo)}</dd></dl>`
    });
    if (!ok) return;
    await busy($('#m-go'), async () => {
      try {
        const mov = f.tipo === 'ajuste'
          ? await API.rpc('registrar_ajuste', { p_premio_id: c.p.id, p_stock_fisico: c.n, p_motivo: c.obs })
          : await API.rpc('registrar_movimiento', Object.assign({ p_premio_id: c.p.id, p_tipo: f.tipo, p_cantidad: c.n, p_observacion: c.obs || null },
              S.sectores.length ? { p_sector_id: f.tipo === 'salida' && $('#m-sec') && $('#m-sec').value ? +$('#m-sec').value : null } : {}));
        aplicarMovLocal(mov);
        const verbo = { salida: 'Retiro registrado', ingreso: 'Ingreso registrado', ajuste: 'Ajuste registrado' }[f.tipo];
        const deshacer = f.tipo === 'ingreso' ? {
          label: 'Deshacer',
          onClick: async () => {
            try {
              const an = await API.rpc('deshacer_ingreso', { p_id: mov.id });
              const o = S.movs.find(x => x.id === mov.id); if (o) o.estado = 'anulado';
              aplicarMovLocal(an);
              toast('Carga deshecha. El stock volvió a como estaba.', 'info', 4000);
              paintCurrent();
            } catch (er) { toast(esc(errMsg(er)), 'bad', 7000); }
          }
        } : null;
        toast(`<b>${f.tipo === 'ingreso' && isJefe() ? 'Stock cargado' : verbo}.</b> ${esc(c.p.nombre)}: ${fNum(mov.stock_anterior)} → ${fNum(mov.stock_nuevo)} unidades.`, 'ok', deshacer ? 10000 : 5000, deshacer);
        $('#m-obs').value = '';
        $('#m-n').value = f.tipo === 'ajuste' ? '' : 1;
        this.paint(); icons(); applyFlashes();
        updateNavBadge();
      } catch (e) { showErr($('#m-err'), errMsg(e)); }
    });
  }
};

/* =============================================================
   VISTA: RETIRO RÁPIDO  (sector → tocar premios → registrar)
   ============================================================= */
VIEWS.rapido = {
  title: () => 'Retiro rápido',
  mount(el) {
    const R = S.rap;
    if (R.sector == null) { try { R.sector = Number(localStorage.getItem(lsSector())) || null; } catch (e) { /* ignorar */ } }
    const permitidos = sectoresRetiro();
    if (R.sector && !permitidos.some(x => x.id === R.sector)) R.sector = null;
    if (!R.sector && permitidos.length === 1) R.sector = permitidos[0].id;
    document.body.classList.add('has-bar');
    this.ord = null;
    el.innerHTML = `
      <div class="rap">
        <div id="rp-sec"></div>
        <div id="rp-tools"></div>
        <div id="rp-grid"></div>
      </div>
      <div class="rap-bar" id="rp-bar"></div>`;
    el.onclick = e => this.click(e);
    el.oninput = e => {
      if (e.target.id === 'rp-q') { R.q = e.target.value; this.paintGrid(); icons(); }
      if (e.target.id === 'rp-obs') R.obs = e.target.value;
    };
    el.onchange = e => {
      if (e.target.id !== 'rp-quien-sel') return;
      R.integrante = e.target.value ? +e.target.value : null;
      try { localStorage.setItem(`sp_integrante_${R.sector}`, e.target.value); } catch (er) { /* ignorar */ }
      e.target.classList.toggle('falta', !R.integrante);
      this.paintBar(); icons();
    };
    this.paint();
  },
  click(e) {
    const R = S.rap, t = e.target;
    const sec = t.closest('[data-sec]');
    if (sec) {
      R.sector = +sec.dataset.sec; R.integrante = null;
      try { localStorage.setItem(lsSector(), String(R.sector)); } catch (er) { /* ignorar */ }
      this.paint(); icons(); return;
    }
    const sub = t.closest('[data-sub]');
    if (sub) { const id = sub.dataset.sub; R.cart[id] = (R.cart[id] || 0) - 1; if (R.cart[id] <= 0) delete R.cart[id]; this.paintGrid(); this.paintBar(); icons(); return; }
    const add = t.closest('[data-add]');
    if (add) {
      if (!R.sector) { toast('Primero elige tu sector.', 'warn', 2500); return; }
      const p = premio(add.dataset.add); if (!p || p.stock_actual <= 0) return;
      const n = (R.cart[p.id] || 0) + 1;
      if (n > p.stock_actual) { toast(`Solo quedan ${fNum(p.stock_actual)} de ${esc(p.nombre)}.`, 'warn', 2500); return; }
      R.cart[p.id] = n;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (er) { /* ignorar */ } }
      this.paintGrid(); this.paintBar(); icons(); return;
    }
    const rm = t.closest('[data-rm]');
    if (rm) { delete R.cart[rm.dataset.rm]; this.paintGrid(); this.paintBar(); icons(); return; }
    if (t.closest('#rp-quien-sel')) return;
    if (t.closest('#rp-clear')) {
      const antes = { cart: { ...R.cart }, obs: R.obs, nota: R.nota };
      R.cart = {}; R.obs = ''; R.nota = false; this.paintGrid(); this.paintBar(); icons();
      toast('Se vació la selección.', 'info', 6000, { label: 'Deshacer', onClick: async () => { Object.assign(R, antes); this.paintGrid(); this.paintBar(); icons(); } });
      return;
    }
    if (t.closest('#rp-nota')) { R.nota = !R.nota; this.paintBar(); icons(); if (R.nota) setTimeout(() => $('#rp-obs') && $('#rp-obs').focus(), 30); return; }
    if (t.closest('#rp-go-falta')) { const s = $('#rp-quien-sel'); if (s) { s.classList.add('falta'); s.scrollIntoView({ behavior: 'smooth', block: 'center' }); s.focus(); } toast('Elige tu nombre en "¿Quién eres?".', 'warn', 3000); return; }
    if (t.closest('#rp-go')) this.submit();
  },
  paint() {
    if (!$('#rp-sec')) return;
    this.paintSec(); this.paintGrid(); this.paintBar();
  },
  paintSec() {
    const R = S.rap, secs = sectoresRetiro();
    if (S.publico) integranteRecordado();
    if (!S.sectores.length) {
      $('#rp-sec').innerHTML = `<div class="callout warn">${ic('triangle-alert', 's')}<span>Faltan los sectores en la base de datos. ${isAdmin() ? 'Ejecuta el archivo <b>migracion_02_retiro_rapido.sql</b> en Supabase (ver README).' : 'Avisa a un administrador.'}</span></div>`;
      return;
    }
    if (!R.sector) {
      $('#rp-sec').innerHTML = `<h2 class="rap-q">${S.publico ? '¿De qué equipo eres?' : '¿Para qué sector retiras?'}</h2>
        <div class="sec-grid">${secs.map(x => `<button class="sec-big" data-sec="${x.id}">${x.grupo ? `<small>${esc(x.grupo)}</small>` : ''}${esc(x.nombre)}</button>`).join('')}</div>`;
      return;
    }
    const quien = S.publico ? selectorQuien() : '';
    if (secs.length === 1) { $('#rp-sec').innerHTML = `<div class="sec-fijo">${ic('map-pin', 's')}Retiras para <b>${esc(sectorLabel(secs[0]))}</b></div>${quien}`; return; }
    $('#rp-sec').innerHTML = `<div class="sec-row" role="radiogroup" aria-label="Sector">${secs.map(x => `
      <button class="sec-chip ${x.id === R.sector ? 'on' : ''}" data-sec="${x.id}" role="radio" aria-checked="${x.id === R.sector}">${x.grupo ? `<small>${esc(x.grupo)}</small>` : ''}${esc(x.nombre)}</button>`).join('')}</div>${quien}`;
  },
  orden() {
    const R = S.rap, desde = Date.now() - 30 * 864e5;
    const fs = {}, fg = {};
    if (S.publico) (S.frecuentes || []).forEach(x => { fg[x.premio_id] = (fg[x.premio_id] || 0) + x.unidades; if (x.sector_id === R.sector) fs[x.premio_id] = (fs[x.premio_id] || 0) + x.unidades; });
    salidasVig().forEach(m => {
      if (new Date(m.creado_en) < desde) return;
      fg[m.premio_id] = (fg[m.premio_id] || 0) + qtyEf(m);
      if (m.sector_id === R.sector) fs[m.premio_id] = (fs[m.premio_id] || 0) + qtyEf(m);
    });
    return S.premios.filter(p => p.activo).sort((a, b) =>
      (b.stock_actual > 0) - (a.stock_actual > 0) || (fs[b.id] || 0) - (fs[a.id] || 0) || (fg[b.id] || 0) - (fg[a.id] || 0) || byName(a, b));
  },
  paintGrid() {
    const R = S.rap, box = $('#rp-grid'); if (!box) return;
    if (!R.sector || !S.sectores.length) { box.innerHTML = ''; $('#rp-tools').innerHTML = ''; return; }
    // el orden se calcula al entrar o al cambiar de sector y queda fijo: los botones no cambian de lugar
    if (!this.ord || this.ord.sector !== R.sector) this.ord = { sector: R.sector, ids: this.orden().map(p => p.id) };
    const pos = new Map(this.ord.ids.map((id, i) => [id, i]));
    let list = S.premios.filter(p => p.activo).sort((a, b) => (pos.has(a.id) ? pos.get(a.id) : 1e6) - (pos.has(b.id) ? pos.get(b.id) : 1e6) || byName(a, b));
    if (!$('#rp-q')) {
      $('#rp-tools').innerHTML = list.length > 12
        ? `<div class="in-ic rap-search">${ic('search')}<input class="in" id="rp-q" placeholder="Buscar premio" value="${esc(R.q)}" autocomplete="off"></div>` : '';
    }
    const q = norm(R.q);
    if (q) list = list.filter(p => norm(p.nombre + ' ' + p.codigo).includes(q));
    box.innerHTML = list.length ? `<div class="tiles">${list.map(p => {
      const n = R.cart[p.id] || 0, dis = p.stock_actual <= 0;
      return `<div class="tile-w">
        <button class="tile ${n ? 'on' : ''} ${dis ? 'dis' : ''}" data-add="${p.id}" ${dis ? 'aria-disabled="true"' : ''} aria-label="Sumar ${esc(p.nombre)}">
          ${p.imagen_url ? `<img class="tile-img" src="${esc(p.imagen_url)}" alt="" loading="lazy">` : ''}
          <span class="tile-n">${esc(p.nombre)}</span>
          <span class="tile-s">${dis ? 'Sin stock' : `Quedan <span data-stock="${p.id}">${fNum(p.stock_actual)}</span>`}</span>
        </button>
        ${n ? `<span class="tile-c">${n}</span><button class="tile-minus" data-sub="${p.id}" aria-label="Restar ${esc(p.nombre)}">${ic('minus', 's')}</button>` : ''}
      </div>`;
    }).join('')}</div>` : `<div class="empty">${ic('search')}<b>No se encontraron premios</b></div>`;
  },
  paintBar() {
    const R = S.rap, bar = $('#rp-bar'); if (!bar) return;
    const items = Object.entries(R.cart).map(([id, n]) => ({ p: premio(id), n })).filter(i => i.p);
    const tot = sum(items, i => i.n);
    if (!R.sector || !S.sectores.length) { bar.innerHTML = `<span class="muted">${S.publico ? 'Elige tu equipo para empezar.' : 'Elige tu sector para empezar.'}</span>`; return; }
    bar.innerHTML = `
      ${R.nota ? `<input class="in rap-obs" id="rp-obs" placeholder="Nota opcional (ej.: acción en vereda)" value="${esc(R.obs)}" maxlength="200">` : ''}
      <div class="cart-row">
        ${tot ? `<button class="btn ghost sm rap-clear" id="rp-clear" title="Vaciar la selección">${ic('trash-2', 's')}Vaciar</button>` : ''}
        <div class="cart">${tot ? items.map(i => `<button class="cart-i" data-rm="${i.p.id}" title="Quitar">${i.n} × ${esc(i.p.nombre)} ${ic('x', 's')}</button>`).join('')
          : `<span class="muted small" style="align-self:center">Toca los premios que retiras: cada toque suma 1.</span>`}</div>
      </div>
      <div class="rap-acts">
        <button class="btn icon ${R.nota || R.obs ? 'on-note' : ''}" id="rp-nota" title="Agregar nota" aria-label="Agregar nota">${ic('message-square-text')}</button>
        ${S.publico && !R.integrante && tot
          ? `<button class="btn pri lg rap-go" id="rp-go-falta">${ic('user-round', 's')}Elige tu nombre</button>`
          : `<button class="btn pri lg rap-go" id="rp-go" ${tot ? '' : 'disabled'}>${tot ? `Registrar ${tot}` : 'Registrar'}</button>`}
      </div>`;
  },
  async submit() {
    const R = S.rap;
    const items = Object.entries(R.cart).map(([id, n]) => ({ premio_id: +id, cantidad: n })).filter(i => i.cantidad > 0);
    if (!items.length || !R.sector) return;
    const sector = sectorDe(R.sector);
    await busy($('#rp-go'), async () => {
      try {
        const movs = S.publico
          ? await API.rpc('retiro_publico', { p_codigo: codigo(), p_sector_id: R.sector, p_items: items, p_integrante_id: R.integrante, p_observacion: (R.obs || '').trim() || null, p_dispositivo: dispositivo() })
          : await API.rpc('registrar_retiro_rapido', { p_sector_id: R.sector, p_items: items, p_observacion: (R.obs || '').trim() || null });
        const lista = Array.isArray(movs) ? movs : [movs];
        lista.forEach(aplicarMovLocal);
        const tot = sum(items, i => i.cantidad);
        const detalle = items.map(i => `${i.cantidad} ${esc((premio(i.premio_id) || {}).nombre || '')}`).join(', ');
        R.cart = {}; R.obs = ''; R.nota = false;
        this.paintGrid(); this.paintBar(); icons(); applyFlashes(); updateNavBadge();
        const ids = lista.map(m => m.id);
        const quienTxt = S.publico ? ((S.integrantes || []).find(x => x.id === R.integrante) || {}).nombre : '';
        toast(`<b>Listo${quienTxt ? `, ${esc(quienTxt.split(' ')[0])}` : ''}: ${tot} premio(s) para ${esc(sectorLabel(sector))}.</b><br>${detalle}`, 'ok', 10000, {
          label: 'Deshacer',
          onClick: async () => {
            try {
              if (S.publico) await API.rpc('deshacer_publico', { p_codigo: codigo(), p_ids: ids, p_dispositivo: dispositivo() });
              else await API.rpc('deshacer_retiro', { p_ids: ids });
              lista.forEach(m => {
                const mm = S.movs.find(x => x.id === m.id); if (mm) mm.estado = 'anulado';
                const p = premio(m.premio_id); if (p) { flash(p.id, m.cantidad); p.stock_actual += m.cantidad; }
              });
              toast('Retiro deshecho. El stock volvió a como estaba.', 'info', 4000);
              paintCurrent();
            } catch (er) { toast(esc(errMsg(er)), 'bad', 7000); }
          }
        });
      } catch (e) {
        if (/LINK_INVALIDO/.test(e.message || '')) return linkInvalido();
        toast(esc(errMsg(e)), 'bad', 7000);
        if (S.publico) { try { await cargarCatalogo(); } catch (er) { /* ignorar */ } }
        this.paint(); icons();
      }
    });
  }
};

/* =============================================================
   VISTA: CONSUMO POR SECTOR (jefes de sector: solo consulta)
   ============================================================= */
function rangoPer(k) {
  const h = ymd(new Date());
  if (k === 'hoy') return [h, h];
  if (k === 'semana') return [ymd(lunes(new Date())), h];
  if (k === 'mes') return [h.slice(0, 8) + '01', h];
  if (k === 'mesant') return rangoRapido('mesant');
  return ['', ''];
}
VIEWS.consumo = {
  title: () => 'Consumo',
  mount(el) {
    const f = S.f.cons, secs = sectoresConsulta();
    if (f.sector && !secs.some(x => String(x.id) === String(f.sector))) f.sector = '';
    if (secs.length === 1) f.sector = String(secs[0].id);
    let guiaVista = true;
    try { guiaVista = !!localStorage.getItem(`sp_guia_vista_${S.perfil.id}`); } catch (er) { /* ignorar */ }
    el.innerHTML = `
      ${isJefe() && !guiaVista ? `<div class="callout info g-aviso" style="margin-bottom:14px">${ic('book-open', 's')}<span>¿Primera vez? Mira en 2 minutos todo lo que puedes hacer.</span><a class="btn sm pri" href="#/ayuda">Ver guía</a></div>` : ''}
      ${!S.sectores.length ? `<div class="callout warn">${ic('triangle-alert', 's')}<span>Todavía no hay sectores configurados.</span></div>` : ''}
      ${secs.length > 1 ? `<div class="sec-row" id="cs-sec">
          <button class="sec-chip" data-s="">Todos</button>
          ${secs.map(x => `<button class="sec-chip" data-s="${x.id}">${x.grupo ? `<small>${esc(x.grupo)}</small>` : ''}${esc(x.nombre)}</button>`).join('')}</div>`
        : secs.length === 1 ? `<div class="sec-fijo">${ic('map-pin', 's')}Sector <b>${esc(sectorLabel(secs[0]))}</b></div>` : ''}
      <div class="chips" id="cs-per" style="margin-bottom:14px">
        <button class="chip" data-p="hoy">Hoy</button><button class="chip" data-p="semana">Esta semana</button>
        <button class="chip" data-p="mes">Este mes</button><button class="chip" data-p="mesant">Mes anterior</button>
      </div>
      <div class="kpis k3" id="cs-k"></div>
      <div class="cols-2e">
        <div class="panel"><div class="panel-h"><h2>Qué se retiró</h2><span class="sub">Unidades por premio</span></div><div class="panel-b flush" id="cs-top"></div></div>
        <div class="panel"><div class="panel-h"><h2>Quién retiró</h2><span class="sub">Unidades por persona</span></div><div class="panel-b flush" id="cs-users"></div></div>
      </div>
      <div class="panel mt"><div class="panel-h"><h2>Detalle de retiros</h2><span class="sp"></span>${expBtns('cons')}</div>
        <div class="panel-b flush"><ul class="list" id="cs-list"></ul></div><div class="pager" id="cs-more"></div></div>`;
    el.onclick = e => {
      const s = e.target.closest('[data-s]'); if (s) { f.sector = s.dataset.s; f.n = 30; this.paint(); icons(); return; }
      const p = e.target.closest('[data-p]'); if (p) { f.per = p.dataset.p; f.n = 30; this.paint(); icons(); return; }
      if (e.target.closest('#cs-mas')) { f.n += 30; this.paint(); icons(); }
    };
    bindExp(el, 'cons', () => {
      const etiqueta = f.sector ? sectorLabel(sectorDe(f.sector)) : 'todos los sectores';
      const perTxt = { hoy: 'hoy', semana: 'esta semana', mes: 'este mes', mesant: 'mes anterior' }[f.per];
      return { base: 'consumo_sector', title: `Retiros de ${etiqueta} (${perTxt})`, rows: this.rows(), cols: [
        { h: 'Fecha', v: m => fFecha(m.creado_en) }, { h: 'Hora', v: m => fHora(m.creado_en) }, { h: 'Sector', v: m => m.sector_nombre || '' },
        { h: 'Usuario', v: m => m.usuario_nombre }, { h: 'Premio', v: m => pNombre(m) }, { h: 'Cantidad', v: m => qtyEf(m) },
        { h: 'Estado', v: estadoMovTxt }, { h: 'Observación', v: m => m.observacion || '' }] };
    });
    this.paint();
  },
  rows() {
    const f = S.f.cons, [d, h] = rangoPer(f.per);
    const ok = new Set(sectoresConsulta().map(x => x.id));
    return S.movs.filter(m => m.tipo === 'salida' && m.sector_id && ok.has(m.sector_id) &&
      (!f.sector || String(m.sector_id) === String(f.sector)) && inRange(m, d, h));
  },
  paint() {
    if (!$('#cs-k')) return;
    const f = S.f.cons;
    $$('#cs-sec [data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === String(f.sector)));
    $$('#cs-per [data-p]').forEach(b => b.classList.toggle('on', b.dataset.p === f.per));
    const rows = this.rows(), vig = rows.filter(m => m.estado !== 'anulado');
    const tot = sum(vig, qtyEf);
    $('#cs-k').innerHTML = `
      <div class="kpi"><span class="kpi-l">${ic('package-minus', 's')}Unidades</span><span class="kpi-v">${fNum(tot)}</span><span class="kpi-s">retiradas</span></div>
      <div class="kpi"><span class="kpi-l">${ic('zap', 's')}Retiros</span><span class="kpi-v">${fNum(new Set(vig.map(m => (m.usuario_id || m.usuario_nombre) + '|' + m.creado_en.slice(0, 16))).size)}</span><span class="kpi-s">registrados</span></div>
      <div class="kpi"><span class="kpi-l">${ic('users', 's')}Personas</span><span class="kpi-v">${fNum(new Set(vig.map(m => m.usuario_id || m.usuario_nombre)).size)}</span><span class="kpi-s">retiraron</span></div>`;
    const barras = (map, box, vacio) => {
      const arr = Object.entries(map).sort((a, b) => b[1] - a[1]);
      const max = arr.length ? arr[0][1] : 1;
      $(box).innerHTML = arr.length ? arr.map(([k, n]) => `<div class="hbar"><span class="nm">${esc(k)}</span><span class="tr"><i style="width:${(n / max * 100).toFixed(1)}%"></i></span><span class="num strong">${fNum(n)}</span></div>`).join('')
        : `<div class="empty">${ic('inbox')}<b>${vacio}</b></div>`;
    };
    const pp = {}, pu = {};
    vig.forEach(m => { const k = pNombre(m); pp[k] = (pp[k] || 0) + qtyEf(m); pu[m.usuario_nombre] = (pu[m.usuario_nombre] || 0) + qtyEf(m); });
    barras(pp, '#cs-top', 'Sin retiros en este período');
    barras(pu, '#cs-users', 'Nadie retiró en este período');
    const vis = rows.slice(0, f.n);
    let dia = '';
    $('#cs-list').innerHTML = vis.length ? vis.map(m => {
      const d = ymd(m.creado_en);
      const cab = d !== dia ? `<li class="dia">${new Date(m.creado_en).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</li>` : '';
      dia = d;
      return `${cab}<li class="${m.estado === 'anulado' ? 'void' : ''}"><span class="hora">${fHora(m.creado_en)}</span>
        <div class="grow"><div class="t1"><b>${esc(m.usuario_nombre)}</b> retiró ${fNum(qtyEf(m))} ${esc(pNombre(m))}</div>
        <div class="t2">${fFecha(m.creado_en)} ${fHora(m.creado_en)} · ${esc(m.sector_nombre || '')}${m.estado === 'anulado' ? ' · anulado' : m.estado === 'corregido' ? ` · corregido (antes ${m.cantidad})` : ''}${m.observacion ? ` · ${esc(trunc(m.observacion, 50))}` : ''}</div></div>
        <span class="v diff-neg">${m.estado === 'anulado' ? '0' : '−' + fNum(qtyEf(m))}</span></li>`;
    }).join('')
      : `<li><div class="empty" style="width:100%">${ic('inbox')}<b>No hubo retiros en este período</b>Prueba con otro período o sector.</div></li>`;
    $('#cs-more').innerHTML = rows.length > f.n ? `<span>${vis.length} de ${fNum(rows.length)}</span><span class="sp"></span><button class="btn sm" id="cs-mas">Ver más</button>` : `<span>${fNum(rows.length)} retiro(s)</span>`;
  }
};

/* =============================================================
   VISTA: MI EQUIPO (jefes cargan a las personas de su sector)
   ============================================================= */
const integrantesDe = sid => (S.integrantes || []).filter(x => String(x.sector_id) === String(sid));
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
VIEWS.equipo = {
  title: () => 'Mi equipo',
  secs() { return (isAdmin() ? S.sectores.slice().sort((a, b) => a.orden - b.orden) : sectoresConsulta()).filter(x => x.activo); },
  mount(el) {
    const f = S.f.eq || (S.f.eq = { sector: '' });
    const secs = this.secs();
    if (!secs.some(x => String(x.id) === String(f.sector))) f.sector = secs.length ? String(secs[0].id) : '';
    el.innerHTML = `
      <div class="page-head"><p>Las personas de cada equipo. Aparecen en orden alfabético en <b>"¿Quién eres?"</b> cuando retiran premios con el link.</p></div>
      ${!secs.length ? `<div class="callout warn">${ic('triangle-alert', 's')}<span>No tienes sectores asignados. Pide a un administrador que te asigne uno.</span></div>`
        : secs.length > 1 ? `<div class="sec-row" id="eq-sec">${secs.map(x => `<button class="sec-chip" data-s="${x.id}">${x.grupo ? `<small>${esc(x.grupo)}</small>` : ''}${esc(x.nombre)}</button>`).join('')}</div>`
        : `<div class="sec-fijo">${ic('map-pin', 's')}Equipo <b>${esc(sectorLabel(secs[0]))}</b></div>`}
      ${secs.length ? `<div class="panel">
        <div class="panel-h"><h2 id="eq-t"></h2><span class="sp"></span><button class="btn sm" id="eq-varios">${ic('list-plus', 's')}Agregar varios</button></div>
        <div class="panel-b"><form id="eq-f" class="row" style="flex-wrap:nowrap">
          <input class="in" id="eq-n" placeholder="Nombre y apellido" maxlength="60" autocomplete="off" autocapitalize="words">
          <button class="btn pri" id="eq-add">${ic('plus', 's')}Agregar</button></form></div>
        <ul class="list" id="eq-list"></ul></div>` : ''}`;
    if (!secs.length) return;
    el.onclick = e => {
      const s = e.target.closest('[data-s]'); if (s) { f.sector = s.dataset.s; this.paint(); icons(); return; }
      const b = e.target.closest('[data-int]'); if (!b) return;
      const x = (S.integrantes || []).find(y => y.id === +b.dataset.int); if (!x) return;
      if (b.dataset.a === 'tog') this.toggle(x); else this.renombrar(x);
    };
    $('#eq-f').onsubmit = e => { e.preventDefault(); this.agregar([$('#eq-n').value]); };
    $('#eq-varios').onclick = () => {
      const md = modal({ title: 'Agregar varias personas', body: `<div class="stack"><p class="muted" style="margin:0">Escribe un nombre por línea. Se agregan a <b>${esc(sectorLabel(sectorDe(f.sector)))}</b>.</p>
        <textarea class="in" id="eq-ta" rows="8" placeholder="Lucas Díaz&#10;Ana Torres&#10;Martín Gómez"></textarea></div>`,
        foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="eq-ok">Agregar</button>` });
      md.$('#eq-ok').onclick = () => busy(md.$('#eq-ok'), async () => { await this.agregar(md.$('#eq-ta').value.split(/\n|,/)); md.close(); });
    };
    this.paint();
  },
  async agregar(nombres) {
    const f = S.f.eq;
    const existentes = new Set(integrantesDe(f.sector).map(x => norm(x.nombre)));
    const limpios = [...new Set(nombres.map(n => n.trim().replace(/\s+/g, ' ')).filter(n => n.length >= 2))];
    const nuevos = limpios.filter(n => !existentes.has(norm(n)));
    if (!limpios.length) return toast('Escribe un nombre.', 'warn', 2500);
    if (!nuevos.length) return toast('Esa persona ya está en el equipo.', 'warn', 3000);
    let ok = 0, err = '';
    await busy($('#eq-add'), async () => {
      for (const nombre of nuevos) {
        try { S.integrantes.push(await API.crearIntegrante({ sector_id: +f.sector, nombre: nombre.slice(0, 60), creado_por: S.perfil.id })); ok++; }
        catch (e) { err = /integrantes_sector_id_nombre_key/.test(e.message || '') ? `${nombre} ya existe.` : errMsg(e); }
      }
    });
    if ($('#eq-n')) { $('#eq-n').value = ''; $('#eq-n').focus(); }
    this.paint(); icons();
    if (ok) toast(ok === 1 ? `Agregaste a <b>${esc(nuevos[0])}</b>.` : `Agregaste ${ok} personas.`, 'ok', 3000);
    if (err) toast(esc(err), 'bad', 5000);
  },
  async toggle(x) {
    if (x.activo && !(await confirmar({ title: 'Dar de baja', ok: 'Dar de baja',
      body: `<p><b>${esc(x.nombre)}</b> ya no aparecerá en "¿Quién eres?". Sus retiros quedan en el historial y puedes volver a activarla cuando quieras.</p>` }))) return;
    try { Object.assign(x, await API.editarIntegrante(x.id, { activo: !x.activo })); this.paint(); icons(); toast(x.activo ? `${esc(x.nombre)} está activa de nuevo.` : `${esc(x.nombre)} fue dada de baja.`, 'ok', 3000); }
    catch (e) { toast(esc(errMsg(e)), 'bad'); }
  },
  renombrar(x) {
    const md = modal({ title: 'Corregir nombre', body: `<div class="field"><label for="rn-i">Nombre y apellido</label><input class="in" id="rn-i" maxlength="60" value="${esc(x.nombre)}"></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="rn-ok">Guardar</button>` });
    md.$('#rn-ok').onclick = () => busy(md.$('#rn-ok'), async () => {
      const n = md.$('#rn-i').value.trim().replace(/\s+/g, ' ');
      if (n.length < 2) return;
      try { Object.assign(x, await API.editarIntegrante(x.id, { nombre: n })); md.close(); this.paint(); icons(); toast('Nombre actualizado.', 'ok', 2500); }
      catch (e) { toast(esc(/integrantes_sector_id_nombre_key/.test(e.message || '') ? 'Ya hay alguien con ese nombre en el equipo.' : errMsg(e)), 'bad'); }
    });
  },
  paint() {
    const box = $('#eq-list'); if (!box) return;
    const f = S.f.eq;
    $$('#eq-sec [data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === String(f.sector)));
    const lista = integrantesDe(f.sector);
    const act = lista.filter(x => x.activo).sort(porNombre), inact = lista.filter(x => !x.activo).sort(porNombre);
    $('#eq-t').textContent = `${act.length} persona(s) en ${sectorLabel(sectorDe(f.sector))}`;
    act.sort((a, b) => (!!b.perfil_id - !!a.perfil_id) || porNombre(a, b));   // el jefe primero
    const mes = ymd(new Date()).slice(0, 7);
    const uds = {};
    salidasVig().filter(m => m.integrante_id && ymd(m.creado_en).startsWith(mes)).forEach(m => { uds[m.integrante_id] = (uds[m.integrante_id] || 0) + qtyEf(m); });
    const fila = x => x.perfil_id ? `<li class="${x.activo ? '' : 'void'}"><span class="avatar">${esc(iniciales(x.nombre))}</span>
      <div class="grow"><div class="t1">${esc(x.nombre)} <span class="tag">Jefe</span></div><div class="t2">${x.activo ? `${fNum(uds[x.id] || 0)} premio(s) retirados este mes · se gestiona desde Usuarios` : 'Dado de baja'}</div></div></li>`
      : `<li class="${x.activo ? '' : 'void'}"><span class="avatar">${esc(iniciales(x.nombre))}</span>
      <div class="grow"><div class="t1">${esc(x.nombre)}</div><div class="t2">${x.activo ? `${fNum(uds[x.id] || 0)} premio(s) retirados este mes` : 'Dada de baja'}</div></div>
      <div class="acts"><button class="btn" data-int="${x.id}" data-a="ren" title="Corregir nombre" aria-label="Corregir nombre">${ic('pencil', 's')}</button>
      <button class="btn" data-int="${x.id}" data-a="tog" title="${x.activo ? 'Dar de baja' : 'Activar'}" aria-label="${x.activo ? 'Dar de baja' : 'Activar'}">${ic(x.activo ? 'user-x' : 'user-check', 's')}</button></div></li>`;
    box.innerHTML = act.length || inact.length ? act.map(fila).join('') + inact.map(fila).join('')
      : `<li><div class="empty" style="width:100%">${ic('users')}<b>Todavía no hay nadie en este equipo</b>Agrega a las personas para que aparezcan en "¿Quién eres?".</div></li>`;
  }
};

/* =============================================================
   VISTA: CARGAR STOCK (jefes: solo ingresos)
   ============================================================= */
VIEWS.cargar = {
  title: () => 'Cargar stock',
  mount(el) {
    S.f.mov.tipo = 'ingreso';
    el.innerHTML = `<div class="callout info" style="margin-bottom:14px">${ic('package-plus', 's')}<span>Cuando llega mercadería: elige el premio, escribe cuántas unidades llegaron y toca <b>Registrar ingreso</b>. Si te equivocas, tienes <b>Deshacer</b> durante 10 minutos.</span></div>
      <div id="cg-form"></div>
      <div class="panel mt"><div class="panel-h"><h2>Tus últimas cargas</h2></div><div class="panel-b flush"><ul class="list" id="cg-list"></ul></div></div>`;
    VIEWS.movimiento.mount.call(VIEWS.movimiento, $('#cg-form'));
    this.paintList();
  },
  paint() { VIEWS.movimiento.paint.call(VIEWS.movimiento); this.paintList(); },
  paintList() {
    const box = $('#cg-list'); if (!box) return;
    const mias = S.movs.filter(m => m.usuario_id === S.perfil.id && m.tipo === 'ingreso').slice(0, 15);
    box.innerHTML = mias.length ? mias.map(m => `<li class="${m.estado === 'anulado' ? 'void' : ''}"><span class="mv-ic t-ingreso">${ic('package-plus', 's')}</span>
      <div class="grow"><div class="t1">${esc(pNombre(m))}</div><div class="t2">${fFecha(m.creado_en)} ${fHora(m.creado_en)}${m.estado === 'anulado' ? ' · deshecha' : ''}${m.observacion ? ` · ${esc(trunc(m.observacion, 50))}` : ''}</div></div>
      <span class="v diff-pos">+${fNum(m.cantidad)}</span></li>`).join('')
      : `<li><div class="empty" style="width:100%">${ic('package-plus')}<b>Todavía no cargaste stock</b>Cuando registres un ingreso aparecerá aquí.</div></li>`;
  }
};

/* =============================================================
   VISTA: CÓMO FUNCIONA (guías dentro de la app)
   ============================================================= */
const gPaso = arr => `<ol class="g-pasos">${arr.map(t => `<li>${t}</li>`).join('')}</ol>`;
const gIr = (vista, txt) => `<button class="btn sm g-ir" data-ir="${vista}">${txt}${ic('arrow-right', 's')}</button>`;
const gSec = (icono, titulo, cuerpo, abierta) => `<details class="gsec" ${abierta ? 'open' : ''}><summary><span class="g-ic">${ic(icono, 's')}</span><span class="g-t">${titulo}</span>${ic('chevron-down', 's g-chev')}</summary><div class="g-b">${cuerpo}</div></details>`;
const gNota = (t, tipo = 'info') => `<div class="callout ${tipo}" style="margin-top:10px">${ic(tipo === 'warn' ? 'triangle-alert' : 'lightbulb', 's')}<span>${t}</span></div>`;

function guiaEquipo() {
  return gSec('link', 'Abrir la app', gPaso([
      'Abre el <b>link de retiros</b> que te pasó tu jefe por WhatsApp.',
      'Guárdalo como app: en iPhone toca <b>Compartir</b> › <b>Agregar a inicio</b>; en Android, menú (⋮) › <b>Agregar a la pantalla principal</b>. Aparece el ícono <b>Premios</b>.',
      'No necesitas usuario ni contraseña.'
    ]), true)
    + gSec('users', 'Elegir tu equipo y tu nombre', gPaso([
      'La primera vez toca tu equipo: <b>Promoción</b>, <b>Recepción</b>, <b>Pretest</b>, <b>Full test</b>, <b>Host</b> o <b>Ventas</b>.',
      'En <b>¿Quién eres?</b> elige tu nombre de la lista.',
      'El celular lo recuerda: la próxima vez ya aparece elegido.'
    ]) + gNota('Si tu nombre no está en la lista, pídele a tu jefe que te agregue.'))
    + gSec('zap', 'Retirar premios', gPaso([
      'Toca el premio que sacas. <b>Cada toque suma 1</b> (el número azul muestra cuántos llevas).',
      'Si te pasaste, toca el botón <b>–</b> de ese premio.',
      'Abajo vas a ver lo que elegiste. Toca <b>Registrar</b>.'
    ]) + gNota('Se guardan solos tu nombre, la fecha y la hora.'))
    + gSec('undo-2', 'Me equivoqué', gPaso([
      'Después de registrar aparece un aviso con el botón <b>Deshacer</b>: tócalo y el retiro se cancela.',
      'Tienes hasta <b>10 minutos</b> y solo funciona desde el mismo celular.',
      'Si pasó más tiempo, avísale a tu jefe o al administrador.'
    ]) + gNota('<b>Vaciar</b> borra lo que elegiste antes de registrar (no toca el stock). Si lo tocas sin querer, toca <b>Deshacer</b>.'));
}

function guiaJefes() {
  return gSec('log-in', 'Entrar y salir', gPaso([
      'Abre el link de retiros en tu celular.',
      'Arriba a la derecha toca <b>¿Eres jefe?</b>',
      'Toca tu nombre y escribe tu <b>PIN</b>.',
      'Para salir: menú (☰) › tu nombre abajo › <b>Cerrar sesión</b>.'
    ]) + gNota('La sesión queda abierta en tu teléfono: no tienes que poner el PIN cada vez.'), true)
    + gSec('zap', 'Retirar premios', gPaso([
      'Entra a <b>Retiro rápido</b>. Tu equipo ya viene elegido.',
      'Toca cada premio que sacas (cada toque suma 1). Con <b>–</b> restas.',
      'Toca <b>Registrar</b>.'
    ]) + gNota('Queda registrado con tu nombre, la fecha y la hora. Tienes <b>Deshacer</b> durante 10 minutos.') + gIr('rapido', 'Ir a Retiro rápido'))
    + gSec('package-plus', 'Cargar stock cuando llega mercadería', gPaso([
      'Entra a <b>Cargar stock</b> (o toca <b>Cargar</b> en el premio, dentro de Stock de Premios).',
      'Elige el premio y escribe <b>cuántas unidades llegaron</b>.',
      'Si quieres, anota el remito o el proveedor en <b>Observación</b>.',
      'Toca <b>Registrar ingreso</b> y confirma.'
    ]) + gNota('Revisa bien el premio antes de confirmar: hay cajas con nombres parecidos (por ejemplo, turrones Fulbito y turrones Misky). Si te equivocas, toca <b>Deshacer</b> dentro de los 10 minutos.', 'warn') + gIr('cargar', 'Ir a Cargar stock'))
    + gSec('users-round', 'Mi equipo: tu lista de personas', `
      <p>Son las personas que aparecen en <b>¿Quién eres?</b> cuando tu equipo retira premios.</p>
      <ul class="g-lista">
        <li>${ic('plus', 's')}<span><b>Agregar</b>: escribe nombre y apellido y toca Agregar.</span></li>
        <li>${ic('list-plus', 's')}<span><b>Agregar varios</b>: pega la lista entera, un nombre por línea.</span></li>
        <li>${ic('pencil', 's')}<span><b>Lápiz</b>: corregir un nombre.</span></li>
        <li>${ic('user-x', 's')}<span><b>Dar de baja</b>: para quien ya no está. Sus retiros quedan guardados.</span></li>
      </ul>` + gNota('Tú apareces solo en la lista, marcado como "(jefe)".') + gIr('equipo', 'Ir a Mi equipo'))
    + gSec('chart-pie', 'Consumo: qué se retiró y quién', gPaso([
      'Entra a <b>Consumo por sector</b>.',
      'Elige el período: <b>Hoy</b>, <b>Esta semana</b>, <b>Este mes</b> o <b>Mes anterior</b>.',
      'Arriba ves el total de unidades, la cantidad de retiros y cuántas personas retiraron.',
      '<b>Qué se retiró</b> y <b>Quién retiró</b> muestran los totales por premio y por persona.',
      'En <b>Detalle de retiros</b> está cada retiro con <b>fecha y hora</b>, ordenado por día.',
      'Con <b>Excel</b> o <b>PDF</b> descargas el listado.'
    ]) + gIr('consumo', 'Ir a Consumo'))
    + gSec('boxes', 'Stock de premios', `
      <p>Muestra cuánto queda de cada premio:</p>
      <ul class="g-lista">
        <li><span class="badge ok"><span class="d"></span>Stock correcto</span><span>hay suficiente.</span></li>
        <li><span class="badge low"><span class="d"></span>Stock bajo</span><span>llegó al mínimo: hay que reponer.</span></li>
        <li><span class="badge out"><span class="d"></span>Sin stock</span><span>no queda nada.</span></li>
      </ul>` + gIr('stock', 'Ir a Stock de Premios'))
    + gSec('key-round', 'Cambiar tu PIN', gPaso([
      'Entra a <b>Configuración</b>.',
      'En <b>Mi PIN</b> escribe el nuevo (4 a 6 números) dos veces.',
      'Toca <b>Cambiar mi PIN</b>.'
    ]) + gNota('Si olvidaste tu PIN, pídele uno nuevo al administrador.') + gIr('configuracion', 'Ir a Configuración'))
    + gSec('shield-alert', 'Lo que no puedes hacer', `
      <p>Para que el stock sea confiable, el stock solo baja con un retiro registrado. Por eso los jefes <b>no pueden</b>:</p>
      <ul class="g-lista">
        <li>${ic('x', 's')}<span>Bajar o ajustar el stock a mano.</span></li>
        <li>${ic('x', 's')}<span>Corregir o anular retiros de otras personas.</span></li>
        <li>${ic('x', 's')}<span>Deshacer algo pasados los 10 minutos.</span></li>
      </ul>` + gNota('Para cualquiera de estas cosas, avísale al administrador: lo corrige desde el Historial y queda registrado.'))
    + gSec('circle-help', 'Problemas comunes', `
      <dl class="g-faq">
        <dt>Alguien de mi equipo no aparece en "¿Quién eres?"</dt><dd>Agrégalo en <b>Mi equipo</b>. Aparece al instante.</dd>
        <dt>Dice "Stock insuficiente"</dt><dd>Quedan menos unidades de las que se quieren sacar. Si llegó mercadería, primero cárgala en <b>Cargar stock</b>.</dd>
        <dt>Registré un retiro o una carga de más</dt><dd>Toca <b>Deshacer</b> en el aviso (10 minutos). Después, avísale al administrador.</dd>
        <dt>Dice "Este link ya no funciona"</dt><dd>El administrador generó un link nuevo. Pídeselo.</dd>
        <dt>No veo los cambios nuevos de la app</dt><dd>Cierra la pestaña del navegador y ábrela de nuevo.</dd>
      </dl>`)
    + gSec('send', 'Cómo explicarle al equipo', `
      <p>Tu equipo no necesita usuario ni PIN. Pásales esto:</p>
      <div class="g-copy" id="g-copy">1) Abran el link de retiros que está en el grupo.
2) Elijan su equipo y su nombre en "¿Quién eres?" (solo la primera vez).
3) Toquen los premios que sacan (cada toque suma 1).
4) Toquen Registrar.
Si se equivocan, toquen Deshacer (tienen 10 minutos).</div>
      <button class="btn sm" id="g-copiar">${ic('copy', 's')}Copiar instrucciones</button>`);
}

VIEWS.ayuda = {
  title: () => 'Cómo funciona',
  mount(el) {
    const f = S.f.ayuda || (S.f.ayuda = { cual: isAdmin() ? 'jefes' : isJefe() ? 'jefes' : 'equipo' });
    const opciones = isAdmin() ? [['jefes', 'Guía para jefes'], ['equipo', 'Guía para el equipo']] : null;
    el.innerHTML = `
      <div class="guia">
        <div class="g-hero">
          <span class="g-hero-ic">${ic('book-open', 'l')}</span>
          <div><h2>${isJefe() ? `Hola, ${esc((S.perfil.nombre_completo || '').split(' ')[0])}` : 'Cómo funciona la app'}</h2>
          <p id="g-sub"></p></div>
        </div>
        ${opciones ? `<div class="chips" id="g-cual" style="margin-bottom:14px">${opciones.map(([k, t]) => `<button class="chip" data-g="${k}">${t}</button>`).join('')}</div>` : ''}
        <div id="g-body"></div>
      </div>`;
    el.onclick = e => {
      const g = e.target.closest('[data-g]'); if (g) { f.cual = g.dataset.g; this.paint(); icons(); return; }
      const ir = e.target.closest('[data-ir]'); if (ir) { go(ir.dataset.ir); return; }
      if (e.target.closest('#g-copiar')) {
        const t = $('#g-copy').innerText;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Instrucciones copiadas. Pégalas en el grupo.', 'ok', 3000))
          .catch(() => { const r = document.createRange(); r.selectNodeContents($('#g-copy')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); toast('Texto seleccionado: cópialo.', 'info', 3000); });
      }
    };
    try { localStorage.setItem(`sp_guia_vista_${S.perfil.id}`, '1'); } catch (er) { /* ignorar */ }
    this.paint();
  },
  paint() {
    const f = S.f.ayuda, body = $('#g-body'); if (!body) return;
    $$('#g-cual [data-g]').forEach(b => b.classList.toggle('on', b.dataset.g === f.cual));
    const jefes = f.cual === 'jefes';
    $('#g-sub').textContent = jefes ? 'Todo lo que puedes hacer como jefe de sector. Toca cada tema para ver los pasos.' : 'Así retira premios el equipo con el link, sin usuario ni PIN.';
    body.innerHTML = jefes ? guiaJefes() : guiaEquipo();
  }
};
function modalGuiaEquipo() {
  modal({ title: 'Cómo retirar premios', size: 'lg', body: `<div class="guia">${guiaEquipo()}</div>`, foot: `<button class="btn pri" data-close>Entendido</button>` });
}

/* =============================================================
   VISTA: HISTORIAL
   ============================================================= */
const PAGE = 50;
function filtrarHist() {
  const f = S.f.hist, q = norm(f.q);
  return S.movs.filter(m =>
    (!f.usuario || m.usuario_id === f.usuario) &&
    (!f.premio || String(m.premio_id) === String(f.premio)) &&
    (!f.tipo || m.tipo === f.tipo) &&
    (!f.sector || String(m.sector_id) === String(f.sector)) &&
    inRange(m, f.desde, f.hasta) &&
    (!q || norm(`${m.usuario_nombre} ${pNombre(m)} ${m.observacion || ''} ${m.sector_nombre || ''} ${TIPOS[m.tipo].t} #${m.id}`).includes(q)));
}
function rangoRapido(k) {
  const hoy = new Date(), h = ymd(hoy);
  if (k === 'hoy') return [h, h];
  if (k === '7') { const d = new Date(); d.setDate(d.getDate() - 6); return [ymd(d), h]; }
  if (k === '30') { const d = new Date(); d.setDate(d.getDate() - 29); return [ymd(d), h]; }
  if (k === 'mes') return [h.slice(0, 8) + '01', h];
  if (k === 'mesant') { const a = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), b = new Date(hoy.getFullYear(), hoy.getMonth(), 0); return [ymd(a), ymd(b)]; }
  if (k === 'anio') return [`${hoy.getFullYear()}-01-01`, h];
  return ['', ''];
}
VIEWS.historial = {
  title: () => 'Historial',
  mount(el) {
    const f = S.f.hist;
    if (S.params.premio) { Object.assign(f, defaultsF().hist); f.premio = S.params.premio; }
    if (S.params.usuario) { Object.assign(f, defaultsF().hist); f.usuario = S.params.usuario; }
    el.innerHTML = `
      <div class="panel">
        <div class="panel-b" style="padding-bottom:4px">
          <div class="toolbar">
            <div class="in-ic">${ic('search')}<input class="in" id="h-q" placeholder="Buscar usuario, premio, observación o N° de movimiento" value="${esc(f.q)}"></div>
            <select class="in" id="h-u" aria-label="Usuario"><option value="">Todos los usuarios</option>${optUsuarios(f.usuario)}</select>
            <select class="in" id="h-p" aria-label="Premio"><option value="">Todos los premios</option>${optPremios(f.premio)}</select>
            ${S.sectores.length ? `<select class="in" id="h-s" aria-label="Sector"><option value="">Todos los sectores</option>${optSectores(f.sector, true)}</select>` : ''}
            <select class="in" id="h-t" aria-label="Tipo de movimiento"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${v.t}</option>`).join('')}</select>
          </div>
          <div class="toolbar">
            <label class="lbl" for="h-d">Desde</label><input class="in" type="date" id="h-d" value="${f.desde}">
            <label class="lbl" for="h-h">Hasta</label><input class="in" type="date" id="h-h" value="${f.hasta}">
            <div class="chips" id="h-r">
              <button class="chip" data-r="hoy">Hoy</button><button class="chip" data-r="7">Últimos 7 días</button>
              <button class="chip" data-r="mes">Este mes</button><button class="chip" data-r="todo">Todo</button>
            </div>
            <button class="btn ghost sm" id="h-clear">${ic('x', 's')}Limpiar filtros</button>
            <span class="sp"></span>${expBtns('hist')}
          </div>
        </div>
        <div class="tbl-wrap"><table class="rt resp">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Usuario</th><th>Sector</th><th>Tipo</th><th>Premio</th><th class="n">Cantidad</th><th class="n">Stock anterior</th><th class="n">Stock actual</th><th>Observación</th><th class="n">Acciones</th></tr></thead>
          <tbody id="h-tb"></tbody>
        </table></div>
        <div class="pager" id="h-pg"></div>
      </div>`;
    const set = (k, v) => { f[k] = v; f.page = 0; this.paint(); icons(); };
    $('#h-q').oninput = debounce(e => set('q', e.target.value), 150);
    $('#h-u').onchange = e => set('usuario', e.target.value);
    $('#h-p').onchange = e => set('premio', e.target.value);
    $('#h-t').onchange = e => set('tipo', e.target.value);
    if ($('#h-s')) $('#h-s').onchange = e => set('sector', e.target.value);
    $('#h-d').onchange = e => set('desde', e.target.value);
    $('#h-h').onchange = e => set('hasta', e.target.value);
    $('#h-r').onclick = e => {
      const b = e.target.closest('[data-r]'); if (!b) return;
      [f.desde, f.hasta] = rangoRapido(b.dataset.r);
      $('#h-d').value = f.desde; $('#h-h').value = f.hasta; f.page = 0; this.paint(); icons();
    };
    $('#h-clear').onclick = () => { S.f.hist = defaultsF().hist; history.replaceState(null, '', '#/historial'); route(); };
    $('#h-pg').onclick = e => { const b = e.target.closest('[data-pg]'); if (!b) return; f.page += Number(b.dataset.pg); this.paint(); icons(); };
    $('#h-tb').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const mv = S.movs.find(m => m.id === +b.dataset.id); if (!mv) return;
      if (b.dataset.act === 'corregir') modalCorregir(mv);
      else if (b.dataset.act === 'anular') modalAnular(mv);
      else modalDetalleMov(mv);
    };
    bindExp(el, 'hist', () => ({ base: 'historial_movimientos', title: 'Historial de movimientos', cols: MOV_COLS, rows: filtrarHist() }));
    this.paint();
  },
  paint() {
    const tb = $('#h-tb'); if (!tb) return;
    const f = S.f.hist, rows = filtrarHist();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    f.page = Math.min(Math.max(0, f.page), pages - 1);
    const vis = rows.slice(f.page * PAGE, f.page * PAGE + PAGE);
    tb.innerHTML = vis.length ? vis.map(m => `
      <tr class="${m.estado === 'anulado' ? 'void' : ''}">
        <td data-label="Fecha" class="tab">${fFecha(m.creado_en)}</td>
        <td data-label="Hora" class="tab">${fHora(m.creado_en)}</td>
        <td data-label="Usuario" class="nw">${esc(m.usuario_nombre)}</td>
        <td data-label="Sector" class="nw">${m.sector_nombre ? esc(m.sector_nombre) : '<span class="muted">—</span>'}</td>
        <td data-label="Tipo">${badgeTipo(m.tipo)}</td>
        <td data-label="Premio"><span class="pname">${esc(pNombre(m))}</span></td>
        <td data-label="Cantidad" class="n"><span class="${m.delta > 0 ? 'diff-pos' : 'diff-neg'}">${signo(m.delta)}</span>
          ${m.estado === 'corregido' ? `<div class="small" style="color:var(--violet)">Corregido a ${m.cantidad_corregida}</div>` : ''}
          ${m.estado === 'anulado' ? '<div><span class="badge mute">Anulado</span></div>' : ''}</td>
        <td data-label="Stock anterior" class="n num">${fNum(m.stock_anterior)}</td>
        <td data-label="Stock actual" class="n num strong">${fNum(m.stock_nuevo)}</td>
        <td data-label="Observación" style="max-width:280px"><span class="muted">${esc(m.observacion || '—')}</span></td>
        <td data-label="" class="n"><div class="acts">${histActs(m)}</div></td>
        ${mobMov(m, histActs(m))}
      </tr>`).join('') : emptyRow(11, 'No hay movimientos con estos filtros', 'Prueba ampliando el rango de fechas o limpiando los filtros.', 'history');
    $('#h-pg').innerHTML = `<span>${rows.length ? `Mostrando ${f.page * PAGE + 1}–${f.page * PAGE + vis.length} de ${fNum(rows.length)} movimientos` : 'Sin resultados'}</span><span class="sp"></span>
      <button class="btn sm" data-pg="-1" ${f.page === 0 ? 'disabled' : ''}>${ic('chevron-left', 's')}Anterior</button>
      <span>Página ${f.page + 1} de ${pages}</span>
      <button class="btn sm" data-pg="1" ${f.page >= pages - 1 ? 'disabled' : ''}>Siguiente${ic('chevron-right', 's')}</button>`;
  }
};

function histActs(m) {
  return `<button class="btn" data-act="ver" data-id="${m.id}" title="Ver detalle" aria-label="Ver detalle">${ic('eye', 's')}</button>
    ${['ingreso', 'salida'].includes(m.tipo) && m.estado !== 'anulado' ? `<button class="btn" data-act="corregir" data-id="${m.id}" title="Corregir cantidad" aria-label="Corregir cantidad">${ic('pencil-line', 's')}</button>` : ''}
    ${['ingreso', 'salida', 'ajuste'].includes(m.tipo) && m.estado !== 'anulado' ? `<button class="btn" data-act="anular" data-id="${m.id}" title="Anular" aria-label="Anular">${ic('ban', 's')}</button>` : ''}`;
}
// fila compacta para celular (historial, perfil)
function mobMov(m, acts) {
  return `<td class="mob"><div class="mrow ${m.estado === 'anulado' ? 'void' : ''}">
    <span class="mv-ic t-${m.tipo}">${ic(TIPOS[m.tipo].i, 's')}</span>
    <div class="grow"><div class="t1">${esc(pNombre(m))}</div>
      <div class="t2">${esc(m.usuario_nombre)}${m.sector_nombre ? ` · ${esc(m.sector_nombre)}` : ''}</div>
      <div class="t2">${fFecha(m.creado_en)} ${fHora(m.creado_en)} · stock ${fNum(m.stock_anterior)} → ${fNum(m.stock_nuevo)}</div>
      ${m.observacion ? `<div class="t3">${esc(m.observacion)}</div>` : ''}</div>
    <div class="mr"><span class="big ${m.delta > 0 ? 'diff-pos' : 'diff-neg'}">${signo(m.delta)}</span>
      ${m.estado === 'anulado' ? '<span class="badge mute">Anulado</span>' : m.estado === 'corregido' ? `<span class="badge t-correccion">Corregido a ${m.cantidad_corregida}</span>` : `<span class="t2">${TIPOS[m.tipo].t}</span>`}</div></div>
    ${acts ? `<div class="acts" style="margin-top:4px">${acts}</div>` : ''}</td>`;
}
function modalDetalleMov(m) {
  const ref = m.movimiento_ref ? S.movs.find(x => x.id === m.movimiento_ref) : null;
  const hijos = S.movs.filter(x => x.movimiento_ref === m.id);
  modal({
    title: `Movimiento #${m.id}`,
    body: `<dl class="kv">
      <dt>Tipo</dt><dd>${badgeTipo(m.tipo)}</dd>
      <dt>Premio</dt><dd>${esc(pNombre(m))}</dd>
      <dt>Cantidad</dt><dd>${signo(m.delta)}</dd>
      <dt>Stock</dt><dd>${fNum(m.stock_anterior)} → ${fNum(m.stock_nuevo)}</dd>
      <dt>Usuario</dt><dd>${esc(m.usuario_nombre)}</dd>
      ${m.sector_nombre ? `<dt>Sector</dt><dd>${esc(m.sector_nombre)}</dd>` : ''}
      <dt>Fecha y hora</dt><dd>${fFH(m.creado_en)}</dd>
      <dt>Observación</dt><dd>${esc(m.observacion || '—')}</dd>
      <dt>Estado</dt><dd>${estadoMovTxt(m)}</dd>
      ${m.modificado_en ? `<dt>Modificado por</dt><dd>${esc(m.modificado_por_nombre)} el ${fFH(m.modificado_en)}</dd><dt>Motivo</dt><dd>${esc(m.motivo_modificacion)}</dd>` : ''}
      ${ref ? `<dt>Movimiento original</dt><dd>#${ref.id} · ${TIPOS[ref.tipo].t} de ${fNum(ref.cantidad)} del ${fFH(ref.creado_en)}</dd>` : ''}
      ${hijos.length ? `<dt>Generó</dt><dd>${hijos.map(h => `#${h.id} (${TIPOS[h.tipo].t}, ${signo(h.delta)})`).join(', ')}</dd>` : ''}
    </dl>`,
    foot: `<button class="btn pri" data-close>Cerrar</button>`
  });
}
function modalCorregir(m) {
  const ef = m.cantidad_corregida ?? m.cantidad, p = premio(m.premio_id);
  const signoT = m.tipo === 'ingreso' ? 1 : -1;
  const md = modal({
    title: `Corregir movimiento #${m.id}`,
    body: `<div class="stack">
      <div class="callout info">${ic('info', 's')}<span>El movimiento original no se borra: se registra una <b>corrección</b> que ajusta el stock por la diferencia, y queda en la auditoría.</span></div>
      <dl class="kv"><dt>Movimiento</dt><dd>${TIPOS[m.tipo].t} de ${esc(pNombre(m))}</dd><dt>Registrado por</dt><dd>${esc(m.usuario_nombre)}, ${fFH(m.creado_en)}</dd><dt>Cantidad vigente</dt><dd>${fNum(ef)}</dd><dt>Stock actual</dt><dd>${p ? stockSpan(p) : '—'}</dd></dl>
      <div class="field"><label for="c-n">Cantidad correcta</label><input class="in num" id="c-n" type="number" min="1" step="1" value="${ef}"></div>
      <div id="c-prev" class="small muted"></div>
      <div class="field"><label for="c-m">Motivo de la corrección (obligatorio)</label><textarea class="in" id="c-m" rows="2" placeholder="Ej.: Se cargaron 3 en lugar de 1"></textarea></div>
      <div class="form-err" id="c-e"></div></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="c-ok">Guardar corrección</button>`
  });
  const prev = () => {
    const n = parseInt(md.$('#c-n').value, 10);
    if (!p || isNaN(n)) return;
    const d = signoT * (n - ef);
    md.$('#c-prev').innerHTML = d === 0 ? 'La cantidad es igual a la actual.' : `El stock de ${esc(p.nombre)} pasará de ${fNum(p.stock_actual)} a <b>${fNum(p.stock_actual + d)}</b> (${signo(d)}).`;
  };
  md.$('#c-n').oninput = prev; prev();
  md.$('#c-ok').onclick = () => busy(md.$('#c-ok'), async () => {
    const n = parseInt(md.$('#c-n').value, 10), mot = md.$('#c-m').value.trim();
    if (isNaN(n) || n <= 0) return showErr(md.$('#c-e'), 'La cantidad debe ser mayor a cero. Para dejarlo sin efecto usa "Anular".');
    if (n === ef) return showErr(md.$('#c-e'), 'La cantidad es igual a la actual.');
    if (!mot) return showErr(md.$('#c-e'), 'Escribe el motivo de la corrección.');
    try {
      const mov = await API.rpc('corregir_movimiento', { p_movimiento_id: m.id, p_nueva_cantidad: n, p_motivo: mot });
      Object.assign(m, { estado: 'corregido', cantidad_corregida: n, modificado_por: S.perfil.id, modificado_por_nombre: S.perfil.nombre_completo, modificado_en: new Date().toISOString(), motivo_modificacion: mot });
      aplicarMovLocal(mov);
      md.close(); toast(`Movimiento #${m.id} corregido.`, 'ok'); paintCurrent();
    } catch (e) { showErr(md.$('#c-e'), errMsg(e)); }
  });
}
function modalAnular(m) {
  const ef = m.tipo === 'ajuste' ? m.delta : (m.tipo === 'ingreso' ? 1 : -1) * (m.cantidad_corregida ?? m.cantidad);
  const p = premio(m.premio_id);
  const md = modal({
    title: `Anular movimiento #${m.id}`,
    body: `<div class="stack">
      <div class="callout warn">${ic('triangle-alert', 's')}<span>Se revierte el efecto en el stock: ${ef < 0 ? `se devuelven <b>${fNum(-ef)}</b> unidades` : `se descuentan <b>${fNum(ef)}</b> unidades`} de ${esc(pNombre(m))}${p ? ` (de ${fNum(p.stock_actual)} a ${fNum(p.stock_actual - ef)})` : ''}. El movimiento queda visible como anulado.</span></div>
      <dl class="kv"><dt>Movimiento</dt><dd>${TIPOS[m.tipo].t} · ${signo(m.delta)}</dd><dt>Registrado por</dt><dd>${esc(m.usuario_nombre)}, ${fFH(m.creado_en)}</dd><dt>Observación</dt><dd>${esc(m.observacion || '—')}</dd></dl>
      <div class="field"><label for="a-m">Motivo de la anulación (obligatorio)</label><textarea class="in" id="a-m" rows="2" placeholder="Ej.: Se registró dos veces"></textarea></div>
      <div class="form-err" id="a-e"></div></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn danger" id="a-ok">Anular movimiento</button>`
  });
  md.$('#a-ok').onclick = () => busy(md.$('#a-ok'), async () => {
    const mot = md.$('#a-m').value.trim();
    if (!mot) return showErr(md.$('#a-e'), 'Escribe el motivo de la anulación.');
    try {
      const mov = await API.rpc('anular_movimiento', { p_movimiento_id: m.id, p_motivo: mot });
      Object.assign(m, { estado: 'anulado', modificado_por: S.perfil.id, modificado_por_nombre: S.perfil.nombre_completo, modificado_en: new Date().toISOString(), motivo_modificacion: mot });
      aplicarMovLocal(mov);
      md.close(); toast(`Movimiento #${m.id} anulado.`, 'ok'); paintCurrent();
    } catch (e) { showErr(md.$('#a-e'), errMsg(e)); }
  });
}

/* =============================================================
   VISTA: INVENTARIO
   ============================================================= */
VIEWS.inventario = {
  title: () => 'Inventario',
  mount(el) {
    const f = S.f.inv;
    el.innerHTML = `
      <div class="page-head"><p>Cuenta físicamente los premios y escribe la cantidad real. La diferencia se calcula sola. Solo se incluyen los premios que cuentes.</p></div>
      <div class="panel">
        <div class="panel-b" style="padding-bottom:4px">
          <div class="toolbar">
            <div class="in-ic">${ic('search')}<input class="in" id="i-q" placeholder="Buscar premio" value="${esc(f.q)}"></div>
            <select class="in" id="i-cat" aria-label="Categoría"><option value="">Todas las categorías</option>${optCats(f.cat)}</select>
            <span class="sp"></span>
            <button class="btn sm" id="i-reset">${ic('rotate-ccw', 's')}Vaciar conteo</button>
          </div>
        </div>
        <div class="tbl-wrap"><table class="rt cards">
          <thead><tr><th>Premio</th><th class="n">Stock del sistema</th><th class="n">Stock físico</th><th class="n">Diferencia</th><th>Motivo de la diferencia</th><th>Ajustar</th></tr></thead>
          <tbody id="i-tb"></tbody>
        </table></div>
        <div class="pager" style="flex-wrap:wrap;gap:12px">
          <span id="i-sum" class="strong" style="color:var(--ink)"></span><span class="sp"></span>
          <input class="in" id="i-obs" placeholder="Observación general (opcional)" style="max-width:320px">
          <button class="btn pri" id="i-ok">${ic('clipboard-check', 's')}Confirmar inventario</button>
        </div>
      </div>
      <div class="panel mt">
        <div class="panel-h"><h2>Inventarios anteriores</h2></div>
        <div class="tbl-wrap" style="margin-top:8px"><table class="rt cards">
          <thead><tr><th>Fecha</th><th>Realizado por</th><th class="n">Premios contados</th><th class="n">Con diferencia</th><th class="n">Diferencia total</th><th>Observación</th><th class="n"></th></tr></thead>
          <tbody id="i-prev"><tr><td colspan="7"><div class="empty"><div class="spinner" style="margin:auto"></div></div></td></tr></tbody>
        </table></div>
      </div>`;
    const tb = $('#i-tb');
    const activos = S.premios.filter(p => p.activo);
    tb.innerHTML = activos.length ? activos.map(p => {
      const c = S.invCounts[p.id] || {};
      return `<tr data-row="${p.id}" data-cat="${p.categoria_id || ''}" data-name="${esc(norm(p.nombre + ' ' + p.codigo))}">
        <td class="main-cell" data-label="Premio"><div class="pcell">${thumb(p)}<div><div class="pname">${esc(p.nombre)}</div><div class="pcode">${esc(p.codigo)}</div></div></div></td>
        <td data-label="Stock del sistema" class="n"><span class="strong num" style="font-size:16px">${stockSpan(p)}</span></td>
        <td data-label="Stock físico" class="n"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap;gap:4px">
          <button class="btn sm ghost icon" data-igual="${p.id}" title="Coincide con el sistema" aria-label="Coincide con el sistema">${ic('equal', 's')}</button>
          <input class="in inv-in" type="number" min="0" step="1" inputmode="numeric" data-fis="${p.id}" value="${c.fisico ?? ''}" aria-label="Stock físico de ${esc(p.nombre)}"></div></td>
        <td data-label="Diferencia" class="n" data-dif="${p.id}"></td>
        <td data-label="Motivo" class="inv-opt"><input class="in" data-mot="${p.id}" value="${esc(c.motivo || '')}" placeholder="Solo si hay diferencia"></td>
        <td data-label="Ajustar" class="inv-opt"><label class="check"><input type="checkbox" data-aj="${p.id}" ${c.ajustar === false ? '' : 'checked'}>Ajustar stock</label></td>
      </tr>`;
    }).join('') : emptyRow(6, 'No hay premios activos para contar', '', 'clipboard-list');
    const get = id => (S.invCounts[id] = S.invCounts[id] || { fisico: '', motivo: '', ajustar: true });
    tb.oninput = e => {
      const t = e.target;
      if (t.dataset.fis) { get(t.dataset.fis).fisico = t.value; this.paintRow(t.dataset.fis); this.paintSum(); }
      if (t.dataset.mot) { get(t.dataset.mot).motivo = t.value; t.classList.remove('err'); }
    };
    tb.onchange = e => { if (e.target.dataset.aj) { get(e.target.dataset.aj).ajustar = e.target.checked; this.paintSum(); } };
    tb.onclick = e => {
      const b = e.target.closest('[data-igual]'); if (!b) return;
      const id = b.dataset.igual, p = premio(id);
      get(id).fisico = String(p.stock_actual);
      $(`[data-fis="${id}"]`).value = p.stock_actual;
      this.paintRow(id); this.paintSum();
    };
    const filtrar = () => {
      const q = norm(f.q);
      $$('#i-tb tr[data-row]').forEach(r => { r.style.display = (!q || r.dataset.name.includes(q)) && (!f.cat || r.dataset.cat === f.cat) ? '' : 'none'; });
    };
    $('#i-q').oninput = e => { f.q = e.target.value; filtrar(); };
    $('#i-cat').onchange = e => { f.cat = e.target.value; filtrar(); };
    $('#i-reset').onclick = async () => {
      if (!Object.keys(S.invCounts).length) return;
      if (await confirmar({ title: 'Vaciar conteo', body: '<p>Se borran las cantidades y motivos escritos en esta pantalla. No afecta el stock.</p>', ok: 'Vaciar' })) { S.invCounts = {}; route(); }
    };
    $('#i-ok').onclick = () => this.confirm();
    $('#i-prev').onclick = e => { const b = e.target.closest('[data-inv]'); if (b) modalInventario(this.prev.find(x => x.id === +b.dataset.inv)); };
    filtrar();
    this.paint();
    this.loadPrev();
  },
  async loadPrev() {
    try { this.prev = await API.inventarios(); } catch (e) { this.prev = []; }
    const tb = $('#i-prev'); if (!tb) return;
    tb.innerHTML = this.prev.length ? this.prev.map(v => `
      <tr><td data-label="Fecha">${fFH(v.creado_en)}</td><td data-label="Realizado por">${esc(v.usuario_nombre)}</td>
      <td data-label="Premios contados" class="n num">${v.total_items}</td><td data-label="Con diferencia" class="n num">${v.items_con_diferencia}</td>
      <td data-label="Diferencia total" class="n"><span class="${v.diferencia_total > 0 ? 'diff-pos' : v.diferencia_total < 0 ? 'diff-neg' : 'diff-zero'}">${signo(v.diferencia_total)}</span></td>
      <td data-label="Observación"><span class="muted">${esc(v.observacion || '—')}</span></td>
      <td class="n" data-label=""><button class="btn sm" data-inv="${v.id}">Ver detalle</button></td></tr>`).join('')
      : emptyRow(7, 'Todavía no se hizo ningún inventario', '', 'clipboard-list');
    icons();
  },
  paintRow(id) {
    const cell = $(`[data-dif="${id}"]`), p = premio(id); if (!cell || !p) return;
    const c = S.invCounts[id];
    const tr = cell.closest('tr');
    if (!c || c.fisico === '' || c.fisico == null) { cell.innerHTML = '<span class="muted">—</span>'; tr && tr.classList.remove('hasdif'); return; }
    const d = Number(c.fisico) - p.stock_actual;
    tr && tr.classList.toggle('hasdif', d !== 0);
    cell.innerHTML = `<span class="${d > 0 ? 'diff-pos' : d < 0 ? 'diff-neg' : 'diff-zero'}" style="font-size:16px">${d === 0 ? 'Sin diferencia' : signo(d)}</span>`;
  },
  paintSum() {
    const items = this.items();
    const dif = items.filter(i => i.dif !== 0);
    $('#i-sum').textContent = items.length ? `${items.length} premio(s) contados · ${dif.length} con diferencia` : 'Ningún premio contado todavía';
    $('#i-ok').disabled = !items.length;
  },
  paint() {
    if (!$('#i-tb')) return;
    S.premios.forEach(p => this.paintRow(p.id));
    this.paintSum();
  },
  items() {
    return Object.entries(S.invCounts).filter(([, c]) => c.fisico !== '' && c.fisico != null).map(([id, c]) => {
      const p = premio(id);
      return p ? { id: p.id, p, fisico: Number(c.fisico), motivo: (c.motivo || '').trim(), ajustar: c.ajustar !== false, dif: Number(c.fisico) - p.stock_actual } : null;
    }).filter(Boolean);
  },
  async confirm() {
    const items = this.items();
    if (!items.length) return;
    const malos = items.filter(i => !Number.isInteger(i.fisico) || i.fisico < 0);
    if (malos.length) return toast(`Revisa el conteo de <b>${esc(malos[0].p.nombre)}</b>: debe ser un número entero de 0 o más.`, 'bad');
    const sinMot = items.filter(i => i.dif !== 0 && i.ajustar && !i.motivo);
    if (sinMot.length) {
      sinMot.forEach(i => $(`[data-mot="${i.id}"]`) && $(`[data-mot="${i.id}"]`).classList.add('err'));
      return toast(`Falta el motivo de la diferencia en <b>${esc(sinMot[0].p.nombre)}</b>${sinMot.length > 1 ? ` y ${sinMot.length - 1} más` : ''}.`, 'bad');
    }
    const dif = items.filter(i => i.dif !== 0);
    const ok = await confirmar({
      title: 'Confirmar inventario', ok: 'Confirmar inventario',
      body: `<p>${items.length} premio(s) contados. ${dif.length ? `${dif.length} con diferencia:` : 'Ninguno tiene diferencias con el sistema.'}</p>
        ${dif.length ? `<div class="tbl-wrap"><table class="diff-tbl"><thead><tr><th>Premio</th><th>Sistema</th><th>Físico</th><th>Diferencia</th><th>Acción</th></tr></thead><tbody>
        ${dif.map(i => `<tr><td>${esc(i.p.nombre)}</td><td>${i.p.stock_actual}</td><td>${i.fisico}</td><td class="${i.dif > 0 ? 'diff-pos' : 'diff-neg'}">${signo(i.dif)}</td><td>${i.ajustar ? 'Se ajusta el stock' : 'Solo se registra'}</td></tr>`).join('')}
        </tbody></table></div>` : ''}`
    });
    if (!ok) return;
    await busy($('#i-ok'), async () => {
      try {
        const inv = await API.rpc('confirmar_inventario', {
          p_observacion: $('#i-obs').value.trim() || null,
          p_items: items.map(i => ({ premio_id: i.id, stock_fisico: i.fisico, motivo: i.motivo || null, ajustar: i.ajustar }))
        });
        S.invCounts = {};
        await loadAll();
        toast(`<b>Inventario #${inv.id} confirmado.</b> ${inv.items_con_diferencia} diferencia(s) registradas.`, 'ok');
        route();
      } catch (e) { toast(esc(errMsg(e)), 'bad', 8000); }
    });
  }
};
async function modalInventario(v) {
  if (!v) return;
  const md = modal({ title: `Inventario #${v.id}`, size: 'lg', body: `<div class="empty"><div class="spinner" style="margin:auto"></div></div>`, foot: `<button class="btn pri" data-close>Cerrar</button>` });
  let det = [];
  try { det = await API.inventarioDetalle(v.id); } catch (e) { md.$('.modal-b').innerHTML = `<div class="callout bad">${esc(errMsg(e))}</div>`; return; }
  md.$('.modal-b').innerHTML = `
    <div class="row" style="margin-bottom:12px"><div><b>${fFH(v.creado_en)}</b> · ${esc(v.usuario_nombre)}<div class="muted small">${esc(v.observacion || 'Sin observación')}</div></div><span class="sp"></span>${expBtns('inv')}</div>
    <div class="tbl-wrap"><table class="rt cards"><thead><tr><th>Premio</th><th class="n">Sistema</th><th class="n">Físico</th><th class="n">Diferencia</th><th>Motivo</th><th>Ajustado</th></tr></thead><tbody>
    ${det.map(d => `<tr><td class="main-cell" data-label="Premio"><b>${esc(d.premio_nombre)}</b></td><td data-label="Sistema" class="n num">${d.stock_sistema}</td><td data-label="Físico" class="n num">${d.stock_fisico}</td>
      <td data-label="Diferencia" class="n"><span class="${d.diferencia > 0 ? 'diff-pos' : d.diferencia < 0 ? 'diff-neg' : 'diff-zero'}">${signo(d.diferencia)}</span></td>
      <td data-label="Motivo">${esc(d.motivo || '—')}</td><td data-label="Ajustado">${d.diferencia === 0 ? '—' : d.ajustado ? 'Sí' : 'No'}</td></tr>`).join('')}
    </tbody></table></div>`;
  icons();
  bindExp(md.el, 'inv', () => ({
    base: `inventario_${v.id}`, title: `Inventario #${v.id} del ${fFecha(v.creado_en)}`,
    cols: [{ h: 'Premio', v: d => d.premio_nombre }, { h: 'Stock sistema', v: d => d.stock_sistema }, { h: 'Stock físico', v: d => d.stock_fisico }, { h: 'Diferencia', v: d => d.diferencia }, { h: 'Motivo', v: d => d.motivo || '' }, { h: 'Ajustado', v: d => d.diferencia === 0 ? '' : d.ajustado ? 'Sí' : 'No' }],
    rows: det
  }));
}

/* =============================================================
   VISTA: REPORTES
   ============================================================= */
VIEWS.reportes = {
  title: () => 'Reportes',
  mount(el) {
    const f = S.f.rep;
    el.innerHTML = `
      <div class="panel"><div class="panel-b">
        <div class="toolbar" style="margin:0">
          <label class="lbl" for="r-d">Desde</label><input class="in" type="date" id="r-d" value="${f.desde}">
          <label class="lbl" for="r-h">Hasta</label><input class="in" type="date" id="r-h" value="${f.hasta}">
          <div class="chips" id="r-r"><button class="chip" data-r="mes">Este mes</button><button class="chip" data-r="mesant">Mes anterior</button><button class="chip" data-r="30">Últimos 30 días</button><button class="chip" data-r="anio">Este año</button></div>
          <span class="sp"></span>
          <button class="btn pri" id="r-all">${ic('file-spreadsheet', 's')}Exportar todo a Excel</button>
        </div>
      </div></div>
      <div class="kpis k4 mt" id="r-kpis"></div>
      <div class="panel">
        <div class="panel-h"><h2>Salidas por período</h2><span class="sub">Unidades retiradas</span><span class="sp"></span>
          <div class="chips" id="r-g"><button class="chip" data-g="dia">Por día</button><button class="chip" data-g="semana">Por semana</button><button class="chip" data-g="mes">Por mes</button></div>
          ${expBtns('per')}</div>
        <div class="chart-box"><canvas id="r-chart" aria-label="Gráfico de salidas por período"></canvas></div>
      </div>
      <div class="cols-2e mt">
        <div class="panel"><div class="panel-h"><h2>Premios más entregados</h2><span class="sp"></span>${expBtns('top')}</div>
          <div class="tbl-wrap" style="margin-top:8px"><table class="rt"><thead><tr><th>#</th><th>Premio</th><th class="n">Unidades</th><th class="n">Retiros</th><th class="n">% del total</th></tr></thead><tbody id="r-top"></tbody></table></div></div>
        <div class="panel"><div class="panel-h"><h2>Premios menos utilizados</h2><span class="sp"></span>${expBtns('low')}</div>
          <div class="tbl-wrap" style="margin-top:8px"><table class="rt"><thead><tr><th>Premio</th><th class="n">Unidades</th><th class="n">Stock actual</th><th>Último retiro</th></tr></thead><tbody id="r-low"></tbody></table></div></div>
      </div>
      <div class="panel mt"><div class="panel-h"><h2>Salidas por sector</h2><span class="sp"></span>${expBtns('sec')}</div>
        <div class="tbl-wrap" style="margin-top:8px"><table class="rt cards"><thead><tr><th>Sector</th><th class="n">Retiros</th><th class="n">Unidades</th><th class="n">% del total</th><th>Premio que más retiró</th><th>Personas</th></tr></thead><tbody id="r-sec"></tbody></table></div></div>
      <div class="panel mt"><div class="panel-h"><h2>Usuarios que más premios retiraron</h2><span class="sp"></span>${expBtns('usr')}</div>
        <div class="tbl-wrap" style="margin-top:8px"><table class="rt cards"><thead><tr><th>Usuario</th><th class="n">Retiros</th><th class="n">Unidades</th><th>Premio que más retiró</th><th>Último retiro</th></tr></thead><tbody id="r-usr"></tbody></table></div></div>
      <div class="cols-2e mt">
        <div class="panel"><div class="panel-h"><h2>Historial por premio</h2><span class="sp"></span>${expBtns('hp')}</div>
          <div class="panel-b" style="padding-bottom:0"><select class="in" id="r-p"><option value="">Elige un premio</option>${optPremios(f.premio)}</select></div>
          <div class="tbl-wrap" style="margin-top:8px;max-height:420px;overflow:auto"><table class="rt"><thead><tr><th>Fecha</th><th>Tipo</th><th>Usuario</th><th class="n">Cant.</th><th class="n">Stock</th></tr></thead><tbody id="r-hp"></tbody></table></div></div>
        <div class="panel"><div class="panel-h"><h2>Historial por usuario</h2><span class="sp"></span>${expBtns('hu')}</div>
          <div class="panel-b" style="padding-bottom:0"><select class="in" id="r-u"><option value="">Elige un usuario</option>${optUsuarios(f.usuario)}</select></div>
          <div class="tbl-wrap" style="margin-top:8px;max-height:420px;overflow:auto"><table class="rt"><thead><tr><th>Fecha</th><th>Tipo</th><th>Premio</th><th class="n">Cant.</th><th class="n">Stock</th></tr></thead><tbody id="r-hu"></tbody></table></div></div>
      </div>`;
    const c = chartColors();
    this.chart = makeChart($('#r-chart'), {
      type: 'bar',
      data: { labels: [], datasets: [
        { label: 'Retiros registrados', data: [], backgroundColor: c.s2, borderRadius: 4, maxBarThickness: 28, categoryPercentage: .8, barPercentage: .9, stack: 's' },
        { label: 'Faltantes sin identificar', data: [], backgroundColor: c.s3, borderRadius: 4, maxBarThickness: 28, categoryPercentage: .8, barPercentage: .9, stack: 's' }
      ] },
      options: (() => { const o = chartOpts(c, false); o.scales.x.stacked = true; o.scales.y.stacked = true; return o; })()
    });
    const rp = () => { this.paint(); icons(); };
    $('#r-d').onchange = e => { f.desde = e.target.value; rp(); };
    $('#r-h').onchange = e => { f.hasta = e.target.value; rp(); };
    $('#r-r').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; [f.desde, f.hasta] = rangoRapido(b.dataset.r); $('#r-d').value = f.desde; $('#r-h').value = f.hasta; rp(); };
    $('#r-g').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; f.agrupar = b.dataset.g; rp(); };
    $('#r-p').onchange = e => { f.premio = e.target.value; rp(); };
    $('#r-u').onchange = e => { f.usuario = e.target.value; rp(); };
    const rango = () => `${f.desde ? fFecha(parseYmd(f.desde)) : 'inicio'} al ${f.hasta ? fFecha(parseYmd(f.hasta)) : 'hoy'}`;
    bindExp(el, 'per', () => ({ base: 'salidas_por_periodo', title: `Salidas por ${f.agrupar} (${rango()})`, cols: [{ h: 'Período', v: r => r.label }, { h: 'Registradas', v: r => r.registradas }, { h: 'Sin identificar', v: r => r.sinId }, { h: 'Total unidades', v: r => r.unidades }, { h: 'Retiros', v: r => r.retiros }], rows: this.data.periodos }));
    bindExp(el, 'top', () => ({ base: 'premios_mas_entregados', title: `Premios más entregados (${rango()})`, cols: this.colsPremio(), rows: this.data.top }));
    bindExp(el, 'low', () => ({ base: 'premios_menos_utilizados', title: `Premios menos utilizados (${rango()})`, cols: this.colsPremio(), rows: this.data.low }));
    bindExp(el, 'sec', () => ({ base: 'salidas_por_sector', title: `Salidas por sector (${rango()})`, cols: this.colsSec(), rows: this.data.sec }));
    bindExp(el, 'usr', () => ({ base: 'retiros_por_usuario', title: `Retiros por usuario (${rango()})`, cols: this.colsUsr(), rows: this.data.usr }));
    bindExp(el, 'hp', () => ({ base: 'historial_premio', title: `Historial de ${(premio(f.premio) || {}).nombre || 'premio'} (${rango()})`, cols: MOV_COLS, rows: this.data.hp }));
    bindExp(el, 'hu', () => ({ base: 'historial_usuario', title: `Historial de ${(perfilDe(f.usuario) || {}).nombre_completo || 'usuario'} (${rango()})`, cols: MOV_COLS, rows: this.data.hu }));
    $('#r-all').onclick = () => exportarLibro('reporte_premios', [
      { title: 'Salidas por período', cols: [{ h: 'Período', v: r => r.label }, { h: 'Registradas', v: r => r.registradas }, { h: 'Sin identificar', v: r => r.sinId }, { h: 'Total unidades', v: r => r.unidades }, { h: 'Retiros', v: r => r.retiros }], rows: this.data.periodos },
      { title: 'Más entregados', cols: this.colsPremio(), rows: this.data.top },
      { title: 'Menos utilizados', cols: this.colsPremio(), rows: this.data.low },
      { title: 'Por sector', cols: this.colsSec(), rows: this.data.sec },
      { title: 'Por usuario', cols: this.colsUsr(), rows: this.data.usr },
      { title: 'Stock actual', cols: [{ h: 'Código', v: p => p.codigo }, { h: 'Premio', v: p => p.nombre }, { h: 'Categoría', v: p => catName(p.categoria_id) }, { h: 'Stock actual', v: p => p.stock_actual }, { h: 'Stock mínimo', v: p => p.stock_minimo }, { h: 'Estado', v: p => p.activo ? ESTADOS[estadoDe(p)].t : 'Desactivado' }], rows: S.premios },
      { title: 'Movimientos del período', cols: MOV_COLS, rows: S.movs.filter(m => inRange(m, f.desde, f.hasta)) }
    ]);
    this.paint();
  },
  colsPremio: () => [{ h: 'Premio', v: r => r.p.nombre }, { h: 'Categoría', v: r => catName(r.p.categoria_id) }, { h: 'Unidades', v: r => r.unidades }, { h: 'Retiros', v: r => r.retiros }, { h: 'Stock actual', v: r => r.p.stock_actual }, { h: 'Último retiro', v: r => r.ultimo ? fFH(r.ultimo) : 'Nunca' }],
  colsSec: () => [{ h: 'Sector', v: r => r.nombre }, { h: 'Retiros', v: r => r.retiros }, { h: 'Unidades', v: r => r.unidades }, { h: '% del total', v: r => r.pct }, { h: 'Premio que más retiró', v: r => r.fav }, { h: 'Personas', v: r => r.personas }],
  colsUsr: () => [{ h: 'Usuario', v: r => r.nombre }, { h: 'Retiros', v: r => r.retiros }, { h: 'Unidades', v: r => r.unidades }, { h: 'Premio que más retiró', v: r => r.fav }, { h: 'Último retiro', v: r => fFH(r.ultimo) }],
  paint() {
    if (!$('#r-top')) return;
    const f = S.f.rep;
    $$('#r-g .chip').forEach(c => c.classList.toggle('on', c.dataset.g === f.agrupar));
    const enR = S.movs.filter(m => inRange(m, f.desde, f.hasta));
    const sal = salidasVig(enR), ing = ingresosVig(enR), fal = faltantes(enR);
    const totR = sum(sal, qtyEf), totF = sum(fal, uFalt), totU = totR + totF;

    // KPIs del período
    $('#r-kpis').innerHTML = `
      <div class="kpi"><span class="kpi-l">Salidas totales</span><span class="kpi-v">${fNum(totU)}</span><span class="kpi-s">${fNum(totR)} registradas (${fNum(sal.length)} retiros)${totF ? ` + ${fNum(totF)} sin identificar` : ''}</span></div>
      <div class="kpi"><span class="kpi-l">Unidades ingresadas</span><span class="kpi-v">${fNum(sum(ing, qtyEf))}</span><span class="kpi-s">${fNum(ing.length)} ingresos</span></div>
      <div class="kpi"><span class="kpi-l">Ajustes</span><span class="kpi-v">${fNum(enR.filter(m => m.tipo === 'ajuste' && m.estado !== 'anulado').length)}</span><span class="kpi-s">Diferencia neta ${signo(sum(enR.filter(m => m.tipo === 'ajuste' && m.estado !== 'anulado'), m => m.delta))}</span></div>
      <div class="kpi"><span class="kpi-l">Personas que retiraron</span><span class="kpi-v">${fNum(new Set(sal.map(m => m.usuario_id || m.usuario_nombre)).size)}</span><span class="kpi-s">En el período</span></div>`;

    // períodos (rellenando huecos)
    const key = d => f.agrupar === 'mes' ? ymd(d).slice(0, 7) : f.agrupar === 'semana' ? ymd(lunes(d)) : ymd(d);
    const lab = k => f.agrupar === 'mes' ? new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })
      : f.agrupar === 'semana' ? `Sem. ${parseYmd(k).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`
      : parseYmd(k).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    const mapa = new Map();
    const ini = f.desde ? parseYmd(f.desde) : (sal.length ? new Date(sal[sal.length - 1].creado_en) : new Date());
    const fin = f.hasta ? parseYmd(f.hasta) : new Date();
    const nuevo = k => ({ label: lab(k), registradas: 0, sinId: 0, unidades: 0, retiros: 0 });
    for (let d = new Date(ini), i = 0; d <= fin && i < 1500; d.setDate(d.getDate() + 1), i++) { const k = key(d); if (!mapa.has(k)) mapa.set(k, nuevo(k)); }
    sal.forEach(m => { const k = key(new Date(m.creado_en)); if (!mapa.has(k)) mapa.set(k, nuevo(k)); const r = mapa.get(k); r.registradas += qtyEf(m); r.unidades += qtyEf(m); r.retiros++; });
    fal.forEach(m => { const k = key(new Date(m.creado_en)); if (!mapa.has(k)) mapa.set(k, nuevo(k)); const r = mapa.get(k); r.sinId += uFalt(m); r.unidades += uFalt(m); });
    const periodos = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
    if (this.chart) {
      this.chart.data.labels = periodos.map(p => p.label);
      this.chart.data.datasets[0].data = periodos.map(p => p.registradas);
      this.chart.data.datasets[1].data = periodos.map(p => p.sinId);
      this.chart.data.datasets[1].hidden = !totF;
      this.chart.options.plugins.legend.display = !!totF;
      this.chart.update('none');
    }

    // por premio
    const porP = new Map(S.premios.map(p => [p.id, { p, unidades: 0, retiros: 0, ultimo: null }]));
    sal.forEach(m => { const r = porP.get(m.premio_id); if (!r) return; r.unidades += qtyEf(m); r.retiros++; if (!r.ultimo || m.creado_en > r.ultimo) r.ultimo = m.creado_en; });
    const lista = [...porP.values()];
    const top = lista.filter(r => r.unidades > 0).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
    const low = lista.filter(r => r.p.activo).sort((a, b) => a.unidades - b.unidades || byName(a.p, b.p)).slice(0, 10);
    $('#r-top').innerHTML = top.length ? top.map((r, i) => `<tr><td class="muted">${i + 1}</td><td><span class="pname">${esc(r.p.nombre)}</span><div class="pcode">${esc(catName(r.p.categoria_id))}</div></td><td class="n strong num">${fNum(r.unidades)}</td><td class="n num">${fNum(r.retiros)}</td><td class="n num">${totR ? (r.unidades / totR * 100).toFixed(1).replace('.', ',') : 0}%</td></tr>`).join('')
      : emptyRow(5, 'Sin retiros en el período', '', 'chart-column');
    $('#r-low').innerHTML = low.length ? low.map(r => `<tr><td><span class="pname">${esc(r.p.nombre)}</span></td><td class="n strong num">${fNum(r.unidades)}</td><td class="n num">${fNum(r.p.stock_actual)}</td><td class="muted">${r.ultimo ? rel(r.ultimo) : 'Nunca en el período'}</td></tr>`).join('')
      : emptyRow(4, 'No hay premios activos', '', 'gift');

    // por sector
    const porS = new Map();
    sal.forEach(m => {
      const k = m.sector_id || 0;
      const r = porS.get(k) || { nombre: m.sector_nombre || 'Sin sector', retiros: 0, unidades: 0, pp: {}, us: new Set() };
      r.retiros++; r.unidades += qtyEf(m); r.pp[m.premio_id] = (r.pp[m.premio_id] || 0) + qtyEf(m); r.us.add(m.usuario_nombre);
      porS.set(k, r);
    });
    if (fal.length) {
      const r = { nombre: SIN_ID, retiros: 0, unidades: 0, pp: {}, us: new Set(['Faltantes de inventario']) };
      fal.forEach(m => { r.retiros++; r.unidades += uFalt(m); r.pp[m.premio_id] = (r.pp[m.premio_id] || 0) + uFalt(m); });
      porS.set('sin-id', r);
    }
    const sec = [...porS.values()].map(r => {
      const fav = Object.entries(r.pp).sort((a, b) => b[1] - a[1])[0];
      return { ...r, pct: totU ? Math.round(r.unidades / totU * 1000) / 10 : 0, fav: fav ? `${(premio(fav[0]) || {}).nombre || '—'} (${fav[1]})` : '—', personas: [...r.us].join(', ') };
    }).sort((a, b) => b.unidades - a.unidades);
    $('#r-sec').innerHTML = sec.length ? sec.map(r => `<tr><td class="main-cell" data-label="Sector"><b>${esc(r.nombre)}</b></td><td data-label="Retiros" class="n num">${fNum(r.retiros)}</td><td data-label="Unidades" class="n strong num">${fNum(r.unidades)}</td><td data-label="% del total" class="n num">${String(r.pct).replace('.', ',')}%</td><td data-label="Premio que más retiró">${esc(r.fav)}</td><td data-label="Personas" class="muted">${esc(trunc(r.personas, 60))}</td></tr>`).join('')
      : emptyRow(6, 'Sin retiros en el período', '', 'zap');

    // por usuario
    const porU = new Map();
    sal.forEach(m => {
      const r = porU.get(m.usuario_id || m.usuario_nombre) || { nombre: m.usuario_nombre, retiros: 0, unidades: 0, ultimo: m.creado_en, pp: {} };
      r.retiros++; r.unidades += qtyEf(m); if (m.creado_en > r.ultimo) r.ultimo = m.creado_en;
      r.pp[m.premio_id] = (r.pp[m.premio_id] || 0) + qtyEf(m);
      porU.set(m.usuario_id || m.usuario_nombre, r);
    });
    const usr = [...porU.values()].map(r => { const fav = Object.entries(r.pp).sort((a, b) => b[1] - a[1])[0]; return { ...r, fav: fav ? `${(premio(fav[0]) || {}).nombre || '—'} (${fav[1]})` : '—' }; }).sort((a, b) => b.unidades - a.unidades);
    $('#r-usr').innerHTML = usr.length ? usr.map(r => `<tr><td class="main-cell" data-label="Usuario"><div class="pcell"><span class="avatar">${esc(iniciales(r.nombre))}</span><b>${esc(r.nombre)}</b></div></td><td data-label="Retiros" class="n num">${fNum(r.retiros)}</td><td data-label="Unidades" class="n strong num">${fNum(r.unidades)}</td><td data-label="Premio que más retiró">${esc(r.fav)}</td><td data-label="Último retiro" class="muted">${rel(r.ultimo)}</td></tr>`).join('')
      : emptyRow(5, 'Sin retiros en el período', '', 'users');

    // historiales
    const fila = (m, col) => `<tr class="${m.estado === 'anulado' ? 'void' : ''}"><td class="tab">${fFH(m.creado_en)}</td><td>${badgeTipo(m.tipo)}</td><td>${esc(col === 'u' ? m.usuario_nombre : pNombre(m))}</td><td class="n"><span class="${m.delta > 0 ? 'diff-pos' : 'diff-neg'}">${signo(m.delta)}</span></td><td class="n num">${fNum(m.stock_nuevo)}</td></tr>`;
    const hp = f.premio ? enR.filter(m => String(m.premio_id) === String(f.premio)) : [];
    const hu = f.usuario ? enR.filter(m => m.usuario_id === f.usuario) : [];
    $('#r-hp').innerHTML = !f.premio ? emptyRow(5, 'Elige un premio', '', 'gift') : hp.length ? hp.map(m => fila(m, 'u')).join('') : emptyRow(5, 'Sin movimientos en el período', '', 'history');
    $('#r-hu').innerHTML = !f.usuario ? emptyRow(5, 'Elige un usuario', '', 'user-round') : hu.length ? hu.map(m => fila(m, 'p')).join('') : emptyRow(5, 'Sin movimientos en el período', '', 'history');

    this.data = { periodos, top, low: low, usr, hp, hu, sec };
  }
};

/* =============================================================
   VISTA: USUARIOS
   ============================================================= */
async function guardarUsuario(args) {
  try { return await API.rpc('admin_guardar_usuario', args); }
  catch (e) {
    // base sin la migración 03: reintentar sin sectores
    if ('p_sector_ids' in args && /admin_guardar_usuario|schema cache|function/i.test(e.message || '')) {
      const { p_sector_ids, ...rest } = args;
      if (args.p_rol === 'supervisor') throw new Error('Para crear jefes de sector ejecuta migracion_03_roles.sql en Supabase.');
      return API.rpc('admin_guardar_usuario', rest);
    }
    throw e;
  }
}
const nombresSectores = ids => (ids && ids.length) ? ids.map(id => (sectorDe(id) || {}).nombre).filter(Boolean).join(', ') : 'Todos los sectores';
VIEWS.usuarios = {
  title: () => 'Usuarios',
  mount(el) {
    const f = S.f.usr;
    el.innerHTML = `
      <div class="callout info" style="margin-bottom:14px">${ic('info', 's')}<span>El equipo (promotores, salón, ventas) <b>no necesita usuario</b>: retira con el link de retiros y elige su nombre. Las personas de cada equipo se cargan en <a href="#/equipo">Mi equipo</a>.</span></div>
      <div class="page-head"><p>Aquí van los jefes de sector y los administradores, que entran con su PIN desde "¿Eres jefe?". Los usuarios con historial no se eliminan: se desactivan para conservar la trazabilidad.</p><span class="sp"></span>
        <button class="btn pri" id="u-new">${ic('user-plus')}Nuevo usuario</button></div>
      <div class="panel">
        <div class="panel-b" style="padding-bottom:4px"><div class="toolbar">
          <div class="in-ic">${ic('search')}<input class="in" id="u-q" placeholder="Buscar por nombre o usuario" value="${esc(f.q)}"></div>
          <select class="in" id="u-r" aria-label="Rol"><option value="">Todos los roles</option>${Object.entries(ROLES).map(([k, v]) => `<option value="${k}">${v.t}</option>`).join('')}</select>
        </div></div>
        <div class="tbl-wrap"><table class="rt resp">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Sectores</th><th>Estado</th><th class="n">Retirados</th><th class="n">Acciones</th></tr></thead>
          <tbody id="u-tb"></tbody></table></div>
      </div>`;
    $('#u-r').value = f.rol;
    $('#u-q').oninput = debounce(e => { f.q = e.target.value; this.paint(); icons(); }, 120);
    $('#u-r').onchange = e => { f.rol = e.target.value; this.paint(); icons(); };
    $('#u-new').onclick = () => modalUsuario();
    $('#u-tb').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const u = perfilDe(b.dataset.id);
      ({ ver: () => go('perfil', { id: u.id }), editar: () => modalUsuario(u), pass: () => modalPassword(u), toggle: () => toggleUsuario(u), borrar: () => borrarUsuario(u) })[b.dataset.act]();
    };
    this.paint();
    API.perfiles().then(p => { S.perfiles = p; this.paint(); icons(); }).catch(() => {});
  },
  paint() {
    const tb = $('#u-tb'); if (!tb) return;
    const f = S.f.usr, q = norm(f.q);
    const rows = S.perfiles.filter(u => (!f.rol || u.rol === f.rol) && (!q || norm(`${u.nombre_completo} ${u.usuario}`).includes(q)));
    tb.innerHTML = rows.length ? rows.map(u => {
      const mv = S.movs.filter(m => m.usuario_id === u.id);
      const yo = u.id === S.perfil.id;
      const sects = u.rol === 'admin' ? 'Todos' : nombresSectores(u.sector_ids);
      const acts = `
          <button class="btn" data-act="ver" data-id="${u.id}" title="Ver perfil" aria-label="Ver perfil">${ic('circle-user-round', 's')}</button>
          <button class="btn" data-act="editar" data-id="${u.id}" title="Editar" aria-label="Editar">${ic('pencil', 's')}</button>
          <button class="btn" data-act="pass" data-id="${u.id}" title="Cambiar PIN" aria-label="Cambiar PIN">${ic('key-round', 's')}</button>
          ${yo ? '' : `<button class="btn" data-act="toggle" data-id="${u.id}" title="${u.activo ? 'Desactivar' : 'Activar'}" aria-label="${u.activo ? 'Desactivar' : 'Activar'}">${ic(u.activo ? 'user-x' : 'user-check', 's')}</button>
          <button class="btn" data-act="borrar" data-id="${u.id}" title="Eliminar" aria-label="Eliminar">${ic('trash-2', 's')}</button>`}`;
      const estado = u.activo ? '<span class="badge ok"><span class="d"></span>Activo</span>' : '<span class="badge mute"><span class="d"></span>Inactivo</span>';
      return `<tr class="${u.activo ? '' : 'void'}">
        <td data-label="Nombre"><div class="pcell"><span class="avatar">${esc(iniciales(u.nombre_completo))}</span><div><div class="pname">${esc(u.nombre_completo)}${yo ? ' <span class="tag">Tú</span>' : ''}</div><div class="pcode">Alta: ${fFecha(u.creado_en)}</div></div></div></td>
        <td data-label="Usuario"><span class="tab">${esc(u.usuario)}</span></td>
        <td data-label="Rol">${rolBadge(u.rol)}</td>
        <td data-label="Sectores" class="muted small">${esc(sects)}</td>
        <td data-label="Estado">${estado}</td>
        <td data-label="Retirados" class="n strong num">${fNum(sum(salidasVig(mv), qtyEf))}</td>
        <td data-label="" class="n"><div class="acts">${acts}</div></td>
        <td class="mob"><div class="mrow"><span class="avatar">${esc(iniciales(u.nombre_completo))}</span><div class="grow">
          <div class="t1">${esc(u.nombre_completo)}${yo ? ' <span class="tag">Tú</span>' : ''}</div><div class="t2">Usuario: ${esc(u.usuario)} · ${esc(sects)}</div>
          <div class="row" style="gap:6px;margin-top:6px">${rolBadge(u.rol)}${estado}</div></div></div>
          <div class="acts" style="margin-top:8px">${acts}</div></td></tr>`;
    }).join('') : emptyRow(7, 'No hay usuarios con estos filtros', '', 'users');
  }
};
function modalUsuario(u) {
  const nuevo = !u;
  let rol = u ? u.rol : 'supervisor';
  const sel = new Set((u && u.sector_ids) || []);
  const md = modal({
    title: nuevo ? 'Nuevo usuario' : `Editar a ${esc(u.nombre_completo)}`, size: 'lg',
    body: `<form id="uf" class="stack">
      <div class="form-err" id="ue"></div>
      <div class="grid2">
        <div class="field"><label for="un">Nombre completo *</label><input class="in" id="un" value="${esc(u ? u.nombre_completo : '')}" placeholder="Ej.: Juan Pérez"></div>
        <div class="field"><label for="uu">Usuario ${nuevo ? '*' : ''}</label><input class="in" id="uu" value="${esc(u ? u.usuario : '')}" ${nuevo ? '' : 'disabled'} autocapitalize="none" spellcheck="false" placeholder="Ej.: jperez">
          <span class="hint">${nuevo ? 'Minúsculas, sin espacios. Con esto inicia sesión.' : 'El nombre de usuario no se puede cambiar.'}</span></div>
      </div>
      ${nuevo ? `<div class="grid2"><div class="field"><label for="up">PIN (4 a 6 números) *</label><input class="in pin-in" id="up" type="tel" inputmode="numeric" maxlength="6" autocomplete="off"></div>
        <div class="field"><label for="up2">Repetir PIN *</label><input class="in pin-in" id="up2" type="tel" inputmode="numeric" maxlength="6" autocomplete="off"></div></div>` : ''}
      <div class="field"><span class="lbl">¿Qué puede hacer?</span>
        <div class="roles" id="urol">${Object.entries(ROLES).filter(([k]) => k !== 'usuario' || (u && u.rol === 'usuario')).map(([k, v]) => `
          <button type="button" class="type" data-rol="${k}">${ic(v.i, 'l')}<span><span class="t">${v.t}</span><br><span class="s">${v.s}</span></span></button>`).join('')}</div></div>
      <div class="field" id="usec-w"><span class="lbl" id="usec-l"></span>
        <div class="chips" id="usec">${sectoresActivos().map(x => `<button type="button" class="chip" data-sid="${x.id}">${esc(sectorLabel(x))}</button>`).join('') || '<span class="muted small">No hay sectores (ejecuta la migración 02).</span>'}</div>
        <span class="hint" id="usec-h"></span></div>
      ${!nuevo && u.id !== S.perfil.id ? `<label class="check"><input type="checkbox" id="uact" ${u.activo ? 'checked' : ''}>Usuario activo (puede iniciar sesión)</label>` : ''}
    </form>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="us">${nuevo ? 'Crear usuario' : 'Guardar cambios'}</button>`
  });
  const pr = () => {
    $$('#urol .type', md.el).forEach(b => b.classList.toggle('on', b.dataset.rol === rol));
    $$('#usec .chip', md.el).forEach(b => b.classList.toggle('on', sel.has(+b.dataset.sid)));
    md.$('#usec-w').classList.toggle('hide', rol === 'admin');
    md.$('#usec-l').textContent = rol === 'supervisor' ? '¿Qué sectores puede consultar?' : '¿Para qué sectores puede retirar?';
    md.$('#usec-h').textContent = sel.size ? (rol === 'usuario' && sel.size === 1 ? 'Con un solo sector, el retiro rápido lo elige solo.' : '') : 'Si no marcas ninguno, son todos los sectores.';
  };
  md.$('#urol').onclick = e => { const b = e.target.closest('[data-rol]'); if (b) { rol = b.dataset.rol; pr(); } };
  md.$('#usec').onclick = e => { const b = e.target.closest('[data-sid]'); if (!b) return; const id = +b.dataset.sid; sel.has(id) ? sel.delete(id) : sel.add(id); pr(); };
  pr();
  md.$('#uf').onsubmit = e => { e.preventDefault(); md.$('#us').click(); };
  md.$('#us').onclick = () => busy(md.$('#us'), async () => {
    const nombre = md.$('#un').value.trim();
    const sectorIds = rol === 'admin' ? [] : [...sel];
    try {
      if (nuevo) {
        const usuario = md.$('#uu').value.trim().toLowerCase(), pin = md.$('#up').value.trim();
        const v = validarUsuario(nombre, usuario, pin, md.$('#up2').value.trim());
        if (v) return showErr(md.$('#ue'), v);
        if (S.perfiles.some(x => x.usuario === usuario)) return showErr(md.$('#ue'), 'Ese nombre de usuario ya existe.');
        await API.crearUsuario({ usuario, password: pinPass(pin), nombre, rol, sectorIds });
        toast(`Usuario creado. Pásale estos datos a ${esc(nombre)}:<br>Usuario: <b>${esc(usuario)}</b> · PIN: <b>${esc(pin)}</b>`, 'ok', 15000);
      } else {
        if (!nombre) return showErr(md.$('#ue'), 'Completa el nombre completo.');
        const activo = md.$('#uact') ? md.$('#uact').checked : u.activo;
        await guardarUsuario({ p_id: u.id, p_nombre: nombre, p_rol: rol, p_activo: activo, p_sector_ids: sectorIds });
        if (u.id === S.perfil.id) S.perfil.nombre_completo = nombre;
        toast('Cambios guardados.', 'ok');
      }
      S.perfiles = await API.perfiles();
      md.close(); paintCurrent();
    } catch (err) { showErr(md.$('#ue'), errMsg(err)); }
  });
}
function modalPassword(u) {
  const md = modal({
    title: `Nuevo PIN para ${esc(u.nombre_completo)}`,
    body: `<div class="stack"><div class="form-err" id="pwe"></div>
      <div class="grid2"><div class="field"><label for="pw1">Nuevo PIN (4 a 6 números)</label><input class="in pin-in" id="pw1" type="tel" inputmode="numeric" maxlength="6" autocomplete="off"></div>
      <div class="field"><label for="pw2">Repetir PIN</label><input class="in pin-in" id="pw2" type="tel" inputmode="numeric" maxlength="6" autocomplete="off"></div></div>
      <p class="muted small" style="margin:0">Pásale el nuevo PIN a la persona. El cambio queda registrado en la auditoría.</p></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="pws">Guardar PIN</button>`
  });
  md.$('#pws').onclick = () => busy(md.$('#pws'), async () => {
    const a = md.$('#pw1').value.trim(), b = md.$('#pw2').value.trim();
    if (!esPin(a)) return showErr(md.$('#pwe'), 'El PIN debe tener entre 4 y 6 números.');
    if (a !== b) return showErr(md.$('#pwe'), 'Los PIN no coinciden.');
    try { await API.rpc('admin_cambiar_password', { p_id: u.id, p_password: pinPass(a) }); md.close(); toast(`PIN actualizado para ${esc(u.nombre_completo)}.`, 'ok'); }
    catch (e) { showErr(md.$('#pwe'), errMsg(e)); }
  });
}
async function toggleUsuario(u) {
  const ok = await confirmar({ title: u.activo ? 'Desactivar usuario' : 'Activar usuario', ok: u.activo ? 'Desactivar' : 'Activar',
    body: u.activo ? `<p><b>${esc(u.nombre_completo)}</b> no podrá iniciar sesión. Sus movimientos quedan en el historial.</p>` : `<p><b>${esc(u.nombre_completo)}</b> podrá volver a iniciar sesión.</p>` });
  if (!ok) return;
  try { await guardarUsuario({ p_id: u.id, p_nombre: u.nombre_completo, p_rol: u.rol, p_activo: !u.activo }); S.perfiles = await API.perfiles(); paintCurrent(); toast(u.activo ? 'Usuario desactivado.' : 'Usuario activado.', 'ok'); }
  catch (e) { toast(esc(errMsg(e)), 'bad'); }
}
async function borrarUsuario(u) {
  if (S.movs.some(m => m.usuario_id === u.id)) {
    const ok = await confirmar({ title: 'Este usuario tiene historial', ok: u.activo ? 'Desactivar en su lugar' : 'Entendido',
      body: `<div class="callout warn">${ic('triangle-alert', 's')}<span><b>${esc(u.nombre_completo)}</b> registró movimientos. Para no perder la trazabilidad no se puede eliminar.</span></div>${u.activo ? '<p>Puedes desactivarlo: no podrá entrar y su historial se conserva.</p>' : ''}` });
    if (ok && u.activo) { try { await guardarUsuario({ p_id: u.id, p_nombre: u.nombre_completo, p_rol: u.rol, p_activo: false }); S.perfiles = await API.perfiles(); paintCurrent(); toast('Usuario desactivado.', 'ok'); } catch (e) { toast(esc(errMsg(e)), 'bad'); } }
    return;
  }
  const ok = await confirmar({ title: 'Eliminar usuario', ok: 'Eliminar', danger: true, body: `<p>Se eliminará la cuenta de <b>${esc(u.nombre_completo)}</b> (${esc(u.usuario)}). Queda registrado en la auditoría.</p>` });
  if (!ok) return;
  try { await API.rpc('admin_eliminar_usuario', { p_id: u.id }); S.perfiles = S.perfiles.filter(x => x.id !== u.id); paintCurrent(); toast('Usuario eliminado.', 'ok'); }
  catch (e) { toast(esc(errMsg(e)), 'bad'); }
}

/* =============================================================
   VISTA: AUDITORÍA
   ============================================================= */
const TABLAS_AUD = { premios: 'Premios', movimientos: 'Movimientos', perfiles: 'Usuarios', categorias: 'Categorías', configuracion: 'Configuración', sectores: 'Sectores', integrantes: 'Equipo', fechas_especiales: 'Fechas especiales', grupos_premio: 'Grupos de marcas' };
const CAMPOS = {
  nombre: 'Nombre', codigo: 'Código', descripcion: 'Descripción', categoria_id: 'Categoría', imagen_url: 'Imagen', stock_minimo: 'Stock mínimo', unidades_por_paquete: 'Unidades por paquete', grupo_id: 'Grupo de marcas', preferido_id: 'Marca que se compra', fecha: 'Fecha', factor: 'Efecto',
  activo: 'Activo', usuario: 'Usuario', sector_ids: 'Sectores', sector_nombre: 'Sector', grupo: 'Grupo', orden: 'Orden', nombre_completo: 'Nombre completo', rol: 'Rol', valor: 'Valor', clave: 'Clave',
  estado: 'Estado', cantidad: 'Cantidad', cantidad_corregida: 'Cantidad corregida', motivo_modificacion: 'Motivo', modificado_por_nombre: 'Modificado por',
  stock_actual: 'Stock actual', premio_nombre: 'Premio', tipo: 'Tipo', delta: 'Efecto en stock', observacion: 'Observación', usuario_nombre: 'Registrado por',
  stock_anterior: 'Stock anterior', stock_nuevo: 'Stock resultante', creado_en: 'Fecha de creación', movimiento_correccion_id: 'Movimiento de corrección', movimiento_anulacion_id: 'Movimiento de anulación'
};
const OCULTOS = ['actualizado_en', 'modificado_en', 'modificado_por', 'usuario_id', 'creado_por', 'id', 'premio_id', 'movimiento_ref', 'inventario_id', 'ultimo_movimiento_en'];
function audNombre(a) {
  const d = a.datos_despues || a.datos_antes || {};
  if (a.tabla === 'movimientos') return `Movimiento #${a.registro_id} · ${d.premio_nombre || ''}`;
  if (a.tabla === 'perfiles') return d.nombre_completo || (perfilDe(a.registro_id) || {}).nombre_completo || a.registro_id;
  if (a.tabla === 'configuracion') return d.clave || a.registro_id;
  return d.nombre || `#${a.registro_id}`;
}
function audValor(k, v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (k === 'categoria_id') return catName(v);
  if (k === 'imagen_url') return 'Imagen cargada';
  if (/_en$/.test(k)) return fFH(v);
  if (k === 'rol') return (ROLES[v] || {}).t || v;
  if (k === 'sector_ids') return Array.isArray(v) ? nombresSectores(v) : String(v);
  return String(v);
}
function filtrarAud(rows) {
  const f = S.f.aud, q = norm(f.q);
  return rows.filter(a => (!f.tabla || a.tabla === f.tabla) && inRange(a, f.desde, f.hasta) &&
    (!q || norm(`${a.usuario_nombre} ${a.accion} ${a.motivo || ''} ${audNombre(a)}`).includes(q)));
}
VIEWS.auditoria = {
  title: () => 'Auditoría',
  mount(el) {
    const f = S.f.aud;
    el.innerHTML = `
      <div class="page-head"><p>Registro permanente de cada alta, edición, corrección, anulación o eliminación: quién lo hizo, cuándo, qué había antes y qué hay ahora. No se puede modificar ni borrar.</p></div>
      <div class="panel">
        <div class="panel-b" style="padding-bottom:4px"><div class="toolbar">
          <div class="in-ic">${ic('search')}<input class="in" id="a-q" placeholder="Buscar por usuario, registro o motivo" value="${esc(f.q)}"></div>
          <select class="in" id="a-t" aria-label="Sección"><option value="">Todas las secciones</option>${Object.entries(TABLAS_AUD).map(([k, v]) => `<option value="${k}" ${f.tabla === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
          <label class="lbl" for="a-d">Desde</label><input class="in" type="date" id="a-d" value="${f.desde}">
          <label class="lbl" for="a-h">Hasta</label><input class="in" type="date" id="a-h" value="${f.hasta}">
          <button class="btn sm" id="a-r">${ic('refresh-cw', 's')}Actualizar</button>
          <span class="sp"></span>${expBtns('aud')}
        </div></div>
        <div class="tbl-wrap"><table class="rt cards">
          <thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Sección</th><th>Acción</th><th>Registro</th><th>Motivo</th><th class="n"></th></tr></thead>
          <tbody id="a-tb"><tr><td colspan="7"><div class="empty"><div class="spinner" style="margin:auto"></div></div></td></tr></tbody></table></div>
      </div>`;
    const rp = () => { this.paint(); icons(); };
    $('#a-q').oninput = debounce(e => { f.q = e.target.value; rp(); }, 150);
    $('#a-t').onchange = e => { f.tabla = e.target.value; rp(); };
    $('#a-d').onchange = e => { f.desde = e.target.value; rp(); };
    $('#a-h').onchange = e => { f.hasta = e.target.value; rp(); };
    $('#a-r').onclick = () => this.load();
    $('#a-tb').onclick = e => { const b = e.target.closest('[data-aud]'); if (b) modalAud(this.rows.find(a => a.id === +b.dataset.aud)); };
    bindExp(el, 'aud', () => ({ base: 'auditoria', title: 'Auditoría', rows: filtrarAud(this.rows || []), cols: [
      { h: 'Fecha', v: a => fFecha(a.creado_en) }, { h: 'Hora', v: a => fHora(a.creado_en) }, { h: 'Usuario', v: a => a.usuario_nombre },
      { h: 'Sección', v: a => TABLAS_AUD[a.tabla] || a.tabla }, { h: 'Acción', v: a => a.accion }, { h: 'Registro', v: audNombre }, { h: 'Motivo', v: a => a.motivo || '' },
      { h: 'Cambios', v: a => cambiosAud(a).map(c => `${c.campo}: ${c.antes} -> ${c.despues}`).join(' | ') }] }));
    this.rows = [];
    this.load();
  },
  async load() {
    try { this.rows = await API.auditoria(); } catch (e) { this.rows = []; toast(esc(errMsg(e)), 'bad'); }
    this.paint(); icons();
  },
  paint() {
    const tb = $('#a-tb'); if (!tb || !this.rows) return;
    const rows = filtrarAud(this.rows).slice(0, 500);
    const cls = { 'creación': 't-ingreso', 'edición': 't-salida', 'eliminación': 't-anulacion', 'corrección': 't-correccion', 'anulación': 't-anulacion', 'cambio de contraseña': 't-ajuste' };
    tb.innerHTML = rows.length ? rows.map(a => `
      <tr><td data-label="Fecha y hora" class="tab nw">${fFH(a.creado_en)}</td><td data-label="Usuario">${esc(a.usuario_nombre || 'Sistema')}</td>
      <td data-label="Sección">${TABLAS_AUD[a.tabla] || esc(a.tabla)}</td>
      <td data-label="Acción"><span class="badge ${cls[a.accion] || 'mute'}">${esc(a.accion)}</span></td>
      <td data-label="Registro"><b>${esc(audNombre(a))}</b></td>
      <td data-label="Motivo"><span class="muted">${esc(a.motivo || '—')}</span></td>
      <td class="n" data-label=""><button class="btn sm" data-aud="${a.id}">Ver cambios</button></td></tr>`).join('')
      : emptyRow(7, 'Sin registros de auditoría', 'Aquí aparecerá cada cambio que se haga en el sistema.', 'shield-check');
  }
};
function cambiosAud(a) {
  const A = a.datos_antes || {}, D = a.datos_despues || {};
  const keys = [...new Set([...Object.keys(A), ...Object.keys(D)])].filter(k => !OCULTOS.includes(k));
  return keys.filter(k => JSON.stringify(A[k]) !== JSON.stringify(D[k]) || !a.datos_antes || !a.datos_despues)
    .map(k => ({ campo: CAMPOS[k] || k, antes: a.datos_antes ? audValor(k, A[k]) : '', despues: a.datos_despues ? audValor(k, D[k]) : '' }));
}
function modalAud(a) {
  if (!a) return;
  const ch = cambiosAud(a);
  modal({
    title: `${a.accion.charAt(0).toUpperCase() + a.accion.slice(1)} · ${esc(TABLAS_AUD[a.tabla] || a.tabla)}`, size: 'lg',
    body: `<dl class="kv" style="margin-bottom:14px"><dt>Registro</dt><dd>${esc(audNombre(a))}</dd><dt>Realizado por</dt><dd>${esc(a.usuario_nombre || 'Sistema')}</dd><dt>Fecha y hora</dt><dd>${fFH(a.creado_en)}</dd><dt>Motivo</dt><dd>${esc(a.motivo || '—')}</dd></dl>
      ${ch.length ? `<table class="diff-tbl"><thead><tr><th>Campo</th>${a.datos_antes ? '<th>Antes</th>' : ''}${a.datos_despues ? '<th>Ahora</th>' : ''}</tr></thead><tbody>
      ${ch.map(c => `<tr><td>${esc(c.campo)}</td>${a.datos_antes ? `<td class="${a.datos_despues ? 'old' : ''}">${esc(c.antes)}</td>` : ''}${a.datos_despues ? `<td class="${a.datos_antes ? 'new' : ''}">${esc(c.despues)}</td>` : ''}</tr>`).join('')}</tbody></table>`
      : '<p class="muted">Sin datos de detalle.</p>'}`,
    foot: `<button class="btn pri" data-close>Cerrar</button>`
  });
}

/* =============================================================
   VISTA: PERFIL
   ============================================================= */
VIEWS.perfil = {
  title: () => (S.params.id && S.params.id !== S.perfil.id && isAdmin()) ? 'Perfil de usuario' : (isAdmin() ? 'Mi perfil' : 'Mis retiros'),
  mount(el) {
    this.uid = (isAdmin() && S.params.id) ? S.params.id : S.perfil.id;
    if (this.uid !== this.lastUid) { S.f.perf = defaultsF().perf; this.lastUid = this.uid; }
    const u = perfilDe(this.uid) || S.perfil, f = S.f.perf;
    el.innerHTML = `
      <div class="panel"><div class="panel-b"><div class="row" style="gap:16px">
        <span class="avatar" style="width:64px;height:64px;font-size:22px">${esc(iniciales(u.nombre_completo))}</span>
        <div><div style="font-size:20px;font-weight:600">${esc(u.nombre_completo)}</div>
          <div class="muted">Usuario: <span class="tab">${esc(u.usuario)}</span></div>
          <div class="row" style="margin-top:6px;gap:6px">${rolBadge(u.rol)}
          ${u.activo ? '<span class="badge ok"><span class="d"></span>Activo</span>' : '<span class="badge mute"><span class="d"></span>Inactivo</span>'}</div></div>
        <span class="sp"></span>
        ${isAdmin() && u.id !== S.perfil.id ? `<a class="btn" href="#/historial?usuario=${u.id}">${ic('history', 's')}Ver en historial</a>` : ''}
      </div></div></div>
      <div class="kpis k4 mt" id="pf-k"></div>
      <div class="panel">
        <div class="panel-h"><h2>Historial personal</h2><span class="sp"></span>${expBtns('perf')}</div>
        <div class="panel-b" style="padding-bottom:4px"><div class="toolbar">
          <div class="in-ic">${ic('search')}<input class="in" id="pf-q" placeholder="Buscar premio u observación" value="${esc(f.q)}"></div>
          <select class="in" id="pf-t" aria-label="Tipo"><option value="">Todos los tipos</option>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}" ${f.tipo === k ? 'selected' : ''}>${v.t}</option>`).join('')}</select>
        </div></div>
        <div class="tbl-wrap"><table class="rt resp">
          <thead><tr><th>Fecha</th><th>Hora</th><th>Tipo</th><th>Premio</th><th class="n">Cantidad</th><th class="n">Stock anterior</th><th class="n">Stock actual</th><th>Observación</th></tr></thead>
          <tbody id="pf-tb"></tbody></table></div>
        <div class="pager" id="pf-pg"></div>
      </div>`;
    $('#pf-q').oninput = debounce(e => { f.q = e.target.value; f.page = 0; this.paint(); icons(); }, 150);
    $('#pf-t').onchange = e => { f.tipo = e.target.value; f.page = 0; this.paint(); icons(); };
    $('#pf-pg').onclick = e => { const b = e.target.closest('[data-pg]'); if (!b) return; f.page += Number(b.dataset.pg); this.paint(); icons(); };
    bindExp(el, 'perf', () => ({ base: `historial_${u.usuario}`, title: `Historial de ${u.nombre_completo}`, cols: MOV_COLS, rows: this.rows() }));
    this.paint();
  },
  rows() {
    const f = S.f.perf, q = norm(f.q);
    return S.movs.filter(m => m.usuario_id === this.uid && (!f.tipo || m.tipo === f.tipo) && (!q || norm(`${pNombre(m)} ${m.observacion || ''}`).includes(q)));
  },
  paint() {
    const tb = $('#pf-tb'); if (!tb) return;
    const mine = S.movs.filter(m => m.usuario_id === this.uid);
    const sal = salidasVig(mine);
    const mes = ymd(new Date()).slice(0, 7);
    $('#pf-k').innerHTML = `
      <div class="kpi"><span class="kpi-l">Premios retirados</span><span class="kpi-v">${fNum(sum(sal, qtyEf))}</span><span class="kpi-s">Unidades en total</span></div>
      <div class="kpi"><span class="kpi-l">Este mes</span><span class="kpi-v">${fNum(sum(sal.filter(m => ymd(m.creado_en).startsWith(mes)), qtyEf))}</span><span class="kpi-s">Unidades retiradas</span></div>
      <div class="kpi"><span class="kpi-l">Movimientos</span><span class="kpi-v">${fNum(mine.length)}</span><span class="kpi-s">Registrados en total</span></div>
      <div class="kpi"><span class="kpi-l">Último movimiento</span><span class="kpi-v" style="font-size:18px;padding:7px 0">${mine.length ? rel(mine[0].creado_en) : '—'}</span><span class="kpi-s">${mine.length ? esc(pNombre(mine[0])) : 'Sin movimientos'}</span></div>`;
    const f = S.f.perf, rows = this.rows(), P = 25;
    const pages = Math.max(1, Math.ceil(rows.length / P));
    f.page = Math.min(Math.max(0, f.page), pages - 1);
    const vis = rows.slice(f.page * P, f.page * P + P);
    tb.innerHTML = vis.length ? vis.map(m => `
      <tr class="${m.estado === 'anulado' ? 'void' : ''}"><td data-label="Fecha" class="tab">${fFecha(m.creado_en)}</td><td data-label="Hora" class="tab">${fHora(m.creado_en)}</td>
      <td data-label="Tipo">${badgeTipo(m.tipo)}</td><td data-label="Premio"><span class="pname">${esc(pNombre(m))}</span></td>
      <td data-label="Cantidad" class="n"><span class="${m.delta > 0 ? 'diff-pos' : 'diff-neg'}">${signo(m.delta)}</span>${m.estado !== 'vigente' ? `<div class="small muted">${estadoMovTxt(m)}</div>` : ''}</td>
      <td data-label="Stock anterior" class="n num">${fNum(m.stock_anterior)}</td><td data-label="Stock actual" class="n num strong">${fNum(m.stock_nuevo)}</td>
      <td data-label="Observación"><span class="muted">${esc(m.observacion || '—')}</span></td>${mobMov(m, '')}</tr>`).join('')
      : emptyRow(8, 'Sin movimientos', this.uid === S.perfil.id ? 'Cuando registres un retiro aparecerá aquí.' : '', 'history');
    $('#pf-pg').innerHTML = `<span>${rows.length ? `${f.page * P + 1}–${f.page * P + vis.length} de ${fNum(rows.length)}` : ''}</span><span class="sp"></span>
      <button class="btn sm" data-pg="-1" ${f.page === 0 ? 'disabled' : ''}>${ic('chevron-left', 's')}Anterior</button>
      <button class="btn sm" data-pg="1" ${f.page >= pages - 1 ? 'disabled' : ''}>Siguiente${ic('chevron-right', 's')}</button>`;
  }
};

/* =============================================================
   VISTA: CONFIGURACIÓN
   ============================================================= */
VIEWS.configuracion = {
  title: () => 'Configuración',
  mount(el) {
    const admin = isAdmin(), dark = document.documentElement.dataset.theme === 'dark';
    el.innerHTML = `
      ${admin ? '<div class="panel" id="c-link" style="margin-bottom:18px"></div>' : ''}
      <div class="cols-2e">
        <div class="gap" style="align-content:start">
          <div class="panel"><div class="panel-h"><h2>Apariencia</h2></div><div class="panel-b">
            <label class="check"><input type="checkbox" id="c-dark" ${dark ? 'checked' : ''}>Usar modo oscuro</label>
            <p class="muted small" style="margin:8px 0 0">Se guarda en este dispositivo.</p></div></div>
          <div class="panel"><div class="panel-h"><h2>Mi PIN</h2></div><div class="panel-b stack">
            <div class="form-err" id="c-pe"></div>
            <div class="grid2"><div class="field"><label for="c-p1">Nuevo PIN (4 a 6 números)</label><input class="in pin-in" id="c-p1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div>
            <div class="field"><label for="c-p2">Repetir PIN</label><input class="in pin-in" id="c-p2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></div></div>
            <div><button class="btn pri" id="c-ps">Cambiar mi PIN</button></div></div></div>
          ${admin ? `<div class="panel"><div class="panel-h"><h2>Sucursal y alertas</h2></div><div class="panel-b stack">
            <div class="field"><label for="c-suc">Nombre de la sucursal</label><input class="in" id="c-suc" value="${esc(S.config.nombre_sucursal || '')}"><span class="hint">Aparece en el menú y en los reportes PDF.</span></div>
            <div class="field"><label for="c-umb">Umbral de ajuste importante</label><input class="in num" id="c-umb" type="number" min="1" value="${esc(S.config.umbral_ajuste_importante || '10')}" style="max-width:160px"><span class="hint">Un ajuste de esta cantidad de unidades o más genera una alerta.</span></div>
            <div><button class="btn pri" id="c-save">Guardar</button></div></div></div>` : ''}
        </div>
        ${admin ? `<div class="gap" style="align-content:start">
          <div class="panel" style="align-self:start"><div class="panel-h"><h2>Categorías de premios</h2></div><div class="panel-b">
          <form class="row" id="c-catf" style="flex-wrap:nowrap;margin-bottom:8px"><input class="in" id="c-catn" placeholder="Nueva categoría"><button class="btn pri">${ic('plus', 's')}Agregar</button></form>
          <div id="c-cats"></div></div>
          <div class="panel-h" style="border-top:1px solid var(--line);padding-top:16px"><h2>Sectores</h2><span class="sub">Para el retiro rápido</span></div><div class="panel-b">
          <form class="row" id="c-secf" style="flex-wrap:nowrap;margin-bottom:8px"><input class="in" id="c-secn" placeholder="Nuevo sector"><input class="in" id="c-secg" placeholder="Grupo (opcional)" style="max-width:150px"><button class="btn pri">${ic('plus', 's')}Agregar</button></form>
          <div id="c-secs"></div></div></div></div>` : `<div class="panel" style="align-self:start"><div class="panel-h"><h2>Tu cuenta</h2></div><div class="panel-b">
          <dl class="kv"><dt>Nombre</dt><dd>${esc(S.perfil.nombre_completo)}</dd><dt>Usuario</dt><dd>${esc(S.perfil.usuario)}</dd><dt>Rol</dt><dd>${(ROLES[rolActual()] || {}).t || ''}</dd>
          ${S.sectores.length ? `<dt>Sectores</dt><dd>${esc(nombresSectores(S.perfil.sector_ids))}</dd>` : ''}</dl>
          <p class="muted small">Para cambiar tu nombre o rol, consulta con un administrador.</p></div></div>`}
      </div>`;
    $('#c-dark').onchange = e => setTheme(e.target.checked ? 'dark' : 'light');
    $('#c-ps').onclick = () => busy($('#c-ps'), async () => {
      const a = $('#c-p1').value.trim(), b = $('#c-p2').value.trim();
      if (!esPin(a)) return showErr($('#c-pe'), 'El PIN debe tener entre 4 y 6 números.');
      if (a !== b) return showErr($('#c-pe'), 'Los PIN no coinciden.');
      try { await API.cambiarMiPassword(pinPass(a)); $('#c-p1').value = $('#c-p2').value = ''; showErr($('#c-pe'), ''); toast('Tu PIN se cambió.', 'ok'); }
      catch (e) { showErr($('#c-pe'), errMsg(e)); }
    });
    if (!admin) return;
    $('#c-save').onclick = () => busy($('#c-save'), async () => {
      const suc = $('#c-suc').value.trim(), umb = parseInt($('#c-umb').value, 10);
      if (!suc) return toast('Completa el nombre de la sucursal.', 'bad');
      if (isNaN(umb) || umb < 1) return toast('El umbral debe ser un número mayor a cero.', 'bad');
      try {
        await API.guardarConfig('nombre_sucursal', suc); await API.guardarConfig('umbral_ajuste_importante', String(umb));
        S.config.nombre_sucursal = suc; S.config.umbral_ajuste_importante = String(umb); paintBrand(); toast('Configuración guardada.', 'ok');
      } catch (e) { toast(esc(errMsg(e)), 'bad'); }
    });
    $('#c-catf').onsubmit = async e => {
      e.preventDefault();
      const n = $('#c-catn').value.trim(); if (!n) return;
      try { S.categorias.push(await API.crearCategoria(n)); S.categorias.sort(byName); $('#c-catn').value = ''; this.paint(); icons(); toast('Categoría agregada.', 'ok'); }
      catch (err) { toast(esc(errMsg(err)), 'bad'); }
    };
    $('#c-cats').onclick = async e => {
      const b = e.target.closest('[data-cat]'); if (!b) return;
      const c = S.categorias.find(x => x.id === +b.dataset.cat);
      if (b.dataset.a === 'ren') {
        const md = modal({ title: 'Renombrar categoría', body: `<div class="field"><label for="rn">Nombre</label><input class="in" id="rn" value="${esc(c.nombre)}"></div>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="rs">Guardar</button>` });
        md.$('#rs').onclick = () => busy(md.$('#rs'), async () => {
          const n = md.$('#rn').value.trim(); if (!n) return;
          try { Object.assign(c, await API.editarCategoria(c.id, n)); S.categorias.sort(byName); md.close(); this.paint(); icons(); toast('Categoría renombrada.', 'ok'); }
          catch (err) { toast(esc(errMsg(err)), 'bad'); }
        });
      } else {
        const usos = S.premios.filter(p => p.categoria_id === c.id).length;
        if (!(await confirmar({ title: 'Eliminar categoría', ok: 'Eliminar', danger: true, body: `<p>Se eliminará <b>${esc(c.nombre)}</b>.${usos ? ` ${usos} premio(s) quedarán como "Sin categoría".` : ''}</p>` }))) return;
        try { await API.eliminarCategoria(c.id); S.categorias = S.categorias.filter(x => x.id !== c.id); S.premios.forEach(p => { if (p.categoria_id === c.id) p.categoria_id = null; }); this.paint(); icons(); toast('Categoría eliminada.', 'ok'); }
        catch (err) { toast(esc(errMsg(err)), 'bad'); }
      }
    };
    if ($('#c-link')) this.paintLink();
    if ($('#c-secf')) {
      $('#c-secf').onsubmit = async e => {
        e.preventDefault();
        const n = $('#c-secn').value.trim(), g = $('#c-secg').value.trim(); if (!n) return;
        try { S.sectores.push(await API.crearSector({ nombre: n, grupo: g || null, orden: S.sectores.length + 1 })); $('#c-secn').value = ''; $('#c-secg').value = ''; this.paint(); icons(); toast('Sector agregado.', 'ok'); }
        catch (err) { toast(esc(/sectores_nombre_key/.test(err.message || '') ? 'Ya existe un sector con ese nombre.' : errMsg(err)), 'bad'); }
      };
      $('#c-secs').onclick = async e => {
        const b = e.target.closest('[data-sec-id]'); if (!b) return;
        const x = S.sectores.find(y => y.id === +b.dataset.secId);
        if (b.dataset.a === 'tog') {
          try { Object.assign(x, await API.editarSector(x.id, { activo: !x.activo })); this.paint(); icons(); toast(x.activo ? 'Sector activado.' : 'Sector desactivado. Su historial se conserva.', 'ok'); }
          catch (err) { toast(esc(errMsg(err)), 'bad'); }
        } else {
          const md = modal({ title: 'Editar sector', body: `<div class="stack"><div class="field"><label for="sx-n">Nombre</label><input class="in" id="sx-n" value="${esc(x.nombre)}"></div><div class="field"><label for="sx-g">Grupo (opcional)</label><input class="in" id="sx-g" value="${esc(x.grupo || '')}"><span class="hint">Ej.: "Salón" para agrupar Recepción, Pretest y Full test.</span></div><div class="field"><label for="sx-o">Orden en pantalla</label><input class="in num" id="sx-o" type="number" value="${x.orden}" style="max-width:120px"></div></div>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" id="sx-s">Guardar</button>` });
          md.$('#sx-s').onclick = () => busy(md.$('#sx-s'), async () => {
            const n = md.$('#sx-n').value.trim(); if (!n) return;
            try { Object.assign(x, await API.editarSector(x.id, { nombre: n, grupo: md.$('#sx-g').value.trim() || null, orden: parseInt(md.$('#sx-o').value, 10) || 0 })); md.close(); this.paint(); icons(); toast('Sector actualizado.', 'ok'); }
            catch (err) { toast(esc(errMsg(err)), 'bad'); }
          });
        }
      };
    }
    this.paint();
  },
  paintLink() {
    const box = $('#c-link'); if (!box) return;
    const c = S.config.codigo_retiro;
    if (!c) {
      box.innerHTML = `<div class="panel-h"><h2>Link de retiros del equipo</h2></div><div class="panel-b"><div class="callout warn">${ic('triangle-alert', 's')}<span>Ejecuta <b>migracion_04_retiro_sin_login.sql</b> en Supabase para habilitar el link.</span></div></div>`;
      icons(); return;
    }
    const link = linkRetiros(c);
    const msj = `Link para registrar los retiros de premios de ${S.config.nombre_sucursal || 'la sucursal'}. Ábrelo una vez en tu teléfono y guárdalo: ${link}`;
    box.innerHTML = `<div class="panel-h"><h2>Link de retiros del equipo</h2></div><div class="panel-b stack">
      <p class="muted" style="margin:0">El equipo no necesita usuario ni PIN: abre este link una vez en su teléfono, elige su equipo y retira. Mándalo al grupo de WhatsApp.</p>
      <input class="in" id="c-lk" value="${esc(link)}" readonly>
      <div class="row">
        <button class="btn pri" id="c-wa">${ic('send', 's')}Compartir por WhatsApp</button>
        <button class="btn" id="c-cp">${ic('copy', 's')}Copiar link</button>
        <button class="btn ghost" id="c-new">${ic('refresh-cw', 's')}Generar link nuevo</button>
      </div>
      <span class="hint muted small">Si el link llega a alguien que no debería tenerlo, genera uno nuevo: el anterior deja de funcionar en todos los teléfonos.</span></div>`;
    icons();
    $('#c-wa').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(msj)}`, '_blank', 'noopener');
    $('#c-cp').onclick = async () => {
      try { await navigator.clipboard.writeText(link); toast('Link copiado.', 'ok', 2500); }
      catch (e) { $('#c-lk').select(); document.execCommand && document.execCommand('copy'); toast('Link copiado.', 'ok', 2500); }
    };
    $('#c-new').onclick = async () => {
      if (!(await confirmar({ title: 'Generar link nuevo', ok: 'Generar link nuevo', danger: true,
        body: '<p>El link actual deja de funcionar en <b>todos</b> los teléfonos. Vas a tener que mandar el nuevo al equipo.</p>' }))) return;
      try { S.config.codigo_retiro = await API.rpc('admin_regenerar_codigo', {}); this.paintLink(); toast('Link nuevo generado. Compártelo con el equipo.', 'ok'); }
      catch (e) { toast(esc(errMsg(e)), 'bad'); }
    };
  },
  paint() {
    const sb = $('#c-secs');
    if (sb) sb.innerHTML = S.sectores.length ? S.sectores.slice().sort((a, b) => a.orden - b.orden).map(x => `<div class="cat-row" style="${x.activo ? '' : 'opacity:.55'}"><span style="flex:1">${esc(sectorLabel(x))}</span>${x.activo ? '' : '<span class="badge mute">Inactivo</span>'}
      <button class="btn sm ghost icon" data-sec-id="${x.id}" data-a="ed" title="Editar" aria-label="Editar">${ic('pencil', 's')}</button>
      <button class="btn sm ghost icon" data-sec-id="${x.id}" data-a="tog" title="${x.activo ? 'Desactivar' : 'Activar'}" aria-label="${x.activo ? 'Desactivar' : 'Activar'}">${ic(x.activo ? 'eye-off' : 'eye', 's')}</button></div>`).join('')
      : `<div class="callout warn">${ic('triangle-alert', 's')}<span>Ejecuta <b>migracion_02_retiro_rapido.sql</b> en Supabase para habilitar los sectores.</span></div>`;
    const box = $('#c-cats'); if (!box) return;
    box.innerHTML = S.categorias.length ? S.categorias.map(c => `<div class="cat-row"><span class="grow" style="flex:1">${esc(c.nombre)}</span><span class="muted small">${S.premios.filter(p => p.categoria_id === c.id).length} premio(s)</span>
      <button class="btn sm ghost icon" data-cat="${c.id}" data-a="ren" title="Renombrar" aria-label="Renombrar">${ic('pencil', 's')}</button>
      <button class="btn sm ghost icon" data-cat="${c.id}" data-a="del" title="Eliminar" aria-label="Eliminar">${ic('trash-2', 's')}</button></div>`).join('')
      : `<div class="empty">${ic('tags')}<b>Sin categorías</b></div>`;
  }
};

/* =============================================================
   NOTIFICACIONES
   ============================================================= */
const lsKey = () => `sp_alertas_vistas_${S.perfil ? S.perfil.id : ''}`;
const ultimaVista = () => { try { return Number(localStorage.getItem(lsKey()) || 0); } catch (e) { return 0; } };
function updateBell() {
  const dot = $('#bell-dot'); if (!dot) return;
  const n = S.alertas.filter(a => a.id > ultimaVista()).length;
  dot.textContent = n > 9 ? '9+' : n; dot.classList.toggle('hide', n === 0);
}
function toggleBell() {
  const pop = $('#bell-pop');
  if (!pop.classList.contains('hide')) return pop.classList.add('hide');
  const vista = ultimaVista();
  pop.innerHTML = `<div class="pop-h">Notificaciones<span class="sp"></span><span class="muted small">${S.alertas.length ? 'Últimas ' + Math.min(S.alertas.length, 50) : ''}</span></div>
    <div class="pop-b">${S.alertas.length ? S.alertas.slice(0, 50).map(a => `
      <div class="al ${a.id > vista ? 'new' : ''}"><span class="ai ${a.tipo}">${ic(ALERTAS[a.tipo].i, 's')}</span><div><div>${esc(a.mensaje)}</div><div class="tm">${rel(a.creado_en)}</div></div></div>`).join('')
      : `<div class="empty">${ic('bell-off')}<b>No hay notificaciones</b>Aquí verás avisos de stock bajo, premios agotados y diferencias de inventario.</div>`}</div>`;
  pop.classList.remove('hide'); icons();
  try { if (S.alertas.length) localStorage.setItem(lsKey(), String(S.alertas[0].id)); } catch (e) { /* ignorar */ }
  updateBell();
}
function toastAlerta(a) {
  const meta = ALERTAS[a.tipo]; if (!meta) return;
  const emoji = { stock_bajo: '⚠️', sin_stock: '🚨', ajuste_importante: '⚖️', diferencia_inventario: '📋' }[a.tipo];
  toast(`<b>${emoji} ${meta.t}</b><br>${esc(a.mensaje)}`, meta.c, 8000);
}

/* =============================================================
   TIEMPO REAL
   ============================================================= */
function setLive(st) {
  S.live = st;
  const el = $('#live'); if (!el) return;
  el.className = 'live ' + (st === 'on' ? 'on' : st === 'off' ? 'off' : '');
  el.querySelector('span').textContent = st === 'on' ? 'En vivo' : st === 'off' ? 'Sin conexión' : 'Conectando…';
  el.title = st === 'on' ? 'Los cambios de otros usuarios aparecen al instante.' : 'Reconectando para recibir cambios en tiempo real…';
}
function startRealtime() {
  if (S.unsub) S.unsub();
  setLive('wait');
  S.unsub = API.subscribe({
    status: st => {
      if (st === 'SUBSCRIBED') {
        if (S.wasOff) { S.wasOff = false; loadAll().then(() => paintCurrent()).catch(() => {}); }
        setLive('on');
      } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(st)) { S.wasOff = true; setLive('off'); }
    },
    change: onChange,
    extra: [...(S.especialesErr ? [] : ['fechas_especiales']), ...(S.gruposErr ? [] : ['grupos_premio'])]
  });
}
function onChange(table, p) {
  const ev = p.eventType, n = p.new || {}, o = p.old || {};
  if (ev !== 'DELETE' && n.id == null && n.clave == null) return;
  if (table === 'movimientos' && n.tipo && !TIPOS[n.tipo]) return;
  if (table === 'premios') {
    if (ev === 'DELETE') S.premios = S.premios.filter(x => x.id !== o.id);
    else upsertPremioLocal(n);
    const c = S.rap.cart;
    S.premios.forEach(p => { if (c[p.id] > p.stock_actual) { if (p.stock_actual > 0) c[p.id] = p.stock_actual; else delete c[p.id]; } });
  } else if (table === 'movimientos') {
    const i = S.movs.findIndex(m => m.id === n.id);
    if (ev === 'INSERT' && i < 0) { S.movs.unshift(n); S.movs.sort((a, b) => b.id - a.id); }
    else if (ev === 'UPDATE' && i >= 0) S.movs[i] = n;
  } else if (table === 'alertas' && ev === 'INSERT') {
    if (!S.alertas.some(a => a.id === n.id)) { S.alertas.unshift(n); toastAlerta(n); updateBell(); }
  } else if (table === 'integrantes') {
    API.integrantes().then(x => { S.integrantes = x; paintCurrent(); }).catch(() => {});
  } else if (table === 'sectores') {
    API.sectores().then(x => { S.sectores = x; paintCurrent(); }).catch(() => {});
  } else if (table === 'categorias') {
    API.categorias().then(c => { S.categorias = c; paintCurrent(); }).catch(() => {});
  } else if (table === 'grupos_premio') {
    API.grupos().then(x => { S.grupos = x; updateNavBadge(); paintCurrent(); }).catch(() => {});
  } else if (table === 'fechas_especiales') {
    API.fechasEspeciales().then(x => { S.especiales = x; paintCurrent(); }).catch(() => {});
  } else if (table === 'configuracion' && n && n.clave) {
    S.config[n.clave] = n.valor; paintBrand();
  }
  paintCurrent();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.perfil && Date.now() - S.lastSync > 60000) {
    loadAll().then(() => paintCurrent()).catch(() => {});
  }
});

/* expuesto para pruebas */
window.__APP__ = { S, VIEWS, go, onChange, createAPI };

boot();
})();
