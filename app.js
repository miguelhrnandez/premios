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
  agotado: { t: 'Sin stock',      c: 'out' }
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
  { id: 'rapido',        t: 'Retiro rápido',        i: 'zap',              roles: ['admin', 'usuario'] },
  { id: 'consumo',       t: 'Consumo por sector',   i: 'chart-pie',        roles: ['admin', 'supervisor'] },
  { id: 'equipo',        t: 'Mi equipo',            i: 'users-round',      roles: ['admin', 'supervisor'] },
  { id: 'stock',         t: 'Stock de Premios',     i: 'boxes',            roles: TODOS },
  { id: 'movimiento',    t: 'Registrar Movimiento', i: 'arrow-left-right', roles: ['admin'] },
  { id: 'historial',     t: 'Historial',            i: 'history',          roles: ['admin'] },
  { id: 'inventario',    t: 'Inventario',           i: 'clipboard-check',  roles: ['admin'] },
  { id: 'reportes',      t: 'Reportes',             i: 'chart-column',     roles: ['admin'] },
  { id: 'usuarios',      t: 'Usuarios',             i: 'users',            roles: ['admin'] },
  { id: 'auditoria',     t: 'Auditoría',            i: 'shield-check',     roles: ['admin'] },
  { sep: 'Cuenta' },
  { id: 'perfil',        t: 'Mi perfil',            i: 'circle-user-round', roles: ['admin', 'usuario'] },
  { id: 'configuracion', t: 'Configuración',        i: 'settings',         roles: TODOS }
];
const ROLES = {
  admin:      { t: 'Administrador',     s: 'Ve y hace todo',                              i: 'shield-check', c: 't-correccion' },
  usuario:    { t: 'Retiro de premios', s: 'Solo retira premios y ve el stock',           i: 'zap',          c: 't-salida' },
  supervisor: { t: 'Jefe de sector',    s: 'Solo consulta lo retirado en sus sectores',   i: 'eye',          c: 't-ajuste' }
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
const puedeRetirar = () => ['admin', 'usuario'].includes(rolActual());
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
    inv:   { q: '', cat: '' }
  };
}
S.f = defaultsF();

/* ---------------- helpers de dominio ---------------- */
const premio = id => S.premios.find(p => p.id === Number(id));
const pNombre = m => (premio(m.premio_id) || {}).nombre || m.premio_nombre;
const catName = id => (S.categorias.find(c => c.id === id) || {}).nombre || 'Sin categoría';
const perfilDe = id => S.perfiles.find(p => p.id === id);
const estadoDe = p => p.stock_actual <= 0 ? 'agotado' : (p.stock_actual <= p.stock_minimo ? 'bajo' : 'ok');
const qtyEf = m => m.estado === 'anulado' ? 0 : (m.cantidad_corregida ?? m.cantidad);
const salidasVig = (arr = S.movs) => arr.filter(m => m.tipo === 'salida' && m.estado !== 'anulado');
const ingresosVig = (arr = S.movs) => arr.filter(m => m.tipo === 'ingreso' && m.estado !== 'anulado');
const inRange = (m, desde, hasta) => { const d = ymd(m.creado_en); return (!desde || d >= desde) && (!hasta || d <= hasta); };
const byName = (a, b) => a.nombre.localeCompare(b.nombre, 'es');
const sectorDe = id => S.sectores.find(x => x.id === Number(id));
const sectorLabel = x => x ? (x.grupo ? `${x.grupo} · ${x.nombre}` : x.nombre) : '';
const sectoresActivos = () => S.sectores.filter(x => x.activo).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));
const sectoresRetiro = () => {
  const ids = (S.perfil && S.perfil.rol === 'usuario' && S.perfil.sector_ids) || [];
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
  const e = ESTADOS[estadoDe(p)];
  return `<span class="badge ${e.c}"><span class="d"></span>${e.t}</span>`;
};
const badgeTipo = t => `<span class="badge t-${t}">${ic(TIPOS[t].i)}${TIPOS[t].t}</span>`;
const thumb = (p, lg) => `<div class="thumb ${lg ? 'lg' : ''}">${p && p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" loading="lazy">` : ic('gift', lg ? 'l' : '')}</div>`;
const stockSpan = p => `<span data-stock="${p.id}">${fNum(p.stock_actual)}</span>`;
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
      ['premios', 'movimientos', 'alertas', 'categorias', 'configuracion', 'sectores', 'integrantes'].forEach(t =>
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
function leerCodigoDeURL() {
  try {
    const u = new URL(location.href), c = u.searchParams.get('c');
    if (c) { localStorage.setItem(LS_COD, c.trim()); u.searchParams.delete('c'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
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
  try { localStorage.removeItem(LS_COD); } catch (e) { /* ignorar */ }
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
        <div class="brand" style="padding:0;min-width:0">
          <div class="brand-mark">${ic('gift')}</div>
          <div style="min-width:0"><div class="pub-t">Retiro de premios</div><div class="pub-s">${esc(S.config.nombre_sucursal || '')}</div></div>
        </div>
        <span class="sp"></span>
        <button class="btn sm" id="pub-jefe">${ic('key-round', 's')}¿Eres jefe?</button>
      </header>
      <main class="content pub-main" id="view"></main>
    </div>`;
  document.body.classList.add('modo-pub');
  $('#pub-jefe').onclick = () => modalJefe();
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
      <option value="">Elige tu nombre</option>${lista.map(x => `<option value="${x.id}" ${x.id === R.integrante ? 'selected' : ''}>${esc(x.nombre)}</option>`).join('')}
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
      <div class="brand" style="padding:0">
        <div class="brand-mark">${ic('gift')}</div>
        <div><div class="brand-t">Stock de Premios</div><div class="brand-s">Control de premios de la sucursal</div></div>
      </div>
      <div>
        <h2>Cada premio que entra o sale, con nombre y hora.</h2>
        <p>El stock se actualiza al instante para todo el equipo y cada movimiento queda guardado en el historial.</p>
      </div>
      <div class="ledger" aria-hidden="true">
        <div>${ic('package-plus', 's')} Ingreso de auriculares<b class="pos">+50</b></div>
        <div>${ic('package-minus', 's')} Retiro de vasos<b class="neg">−3</b></div>
        <div>${ic('scale', 's')} Ajuste por inventario<b class="neg">−2</b></div>
      </div>
    </div>
    <div class="login-form"><div class="login-card" id="lc"></div></div>
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
      <div class="brand">
        <div class="brand-mark">${ic('gift')}</div>
        <div style="min-width:0"><div class="brand-t">Stock de Premios</div><div class="brand-s" id="brand-s"></div></div>
      </div>
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
function paintBrand() { const b = $('#brand-s'); if (b) b.textContent = S.config.nombre_sucursal || 'Sucursal'; }
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
  const n = S.premios.filter(p => p.activo && estadoDe(p) !== 'ok').length;
  c.textContent = n; c.classList.toggle('hide', n === 0);
  c.title = `${n} premio(s) con stock bajo o sin stock`;
}

/* ---------------- gráficos ---------------- */
function destroyCharts() { S.charts.forEach(c => { try { c.destroy(); } catch (e) { /* ignorar */ } }); S.charts = []; }
function chartColors() {
  const cs = getComputedStyle(document.documentElement);
  const g = v => cs.getPropertyValue(v).trim();
  return { s1: g('--series-1'), s2: g('--series-2'), grid: g('--line'), text: g('--muted'), ink: g('--ink-2'), tipBg: g('--surface'), tipInk: g('--ink') };
}
function chartOpts(c, legend) {
  const FAM = "Onest, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
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
        styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [36, 83, 212] },
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
          { label: 'Salidas', data: [], backgroundColor: c.s2, borderRadius: 4, maxBarThickness: 16, categoryPercentage: .72, barPercentage: .86 }
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
    const bajo = act.filter(p => estadoDe(p) === 'bajo');
    const agot = act.filter(p => estadoDe(p) === 'agotado');
    const hoy = ymd(new Date()), mes = hoy.slice(0, 7);
    const sal = salidasVig();
    const sHoy = sum(sal.filter(m => ymd(m.creado_en) === hoy), qtyEf);
    const sMes = sum(sal.filter(m => ymd(m.creado_en).startsWith(mes)), qtyEf);
    const inact = S.premios.length - act.length;
    const quien = admin ? 'por todo el equipo' : 'por ti';
    $('#d-kpis').innerHTML = `
      <div class="kpi"><span class="kpi-l">${ic('gift', 's')}Tipos de premios</span><span class="kpi-v">${fNum(act.length)}</span><span class="kpi-s">${inact ? `${inact} desactivado(s)` : 'Activos'}</span></div>
      <div class="kpi"><span class="kpi-l">${ic('boxes', 's')}Unidades en stock</span><span class="kpi-v">${fNum(sum(act, p => p.stock_actual))}</span><span class="kpi-s">Total disponible</span></div>
      <button class="kpi ${bajo.length ? 'warn' : ''}" data-kpi="bajo"><span class="kpi-l">${ic('triangle-alert', 's')}Stock bajo</span><span class="kpi-v">${fNum(bajo.length)}</span><span class="kpi-s">En el mínimo o por debajo</span></button>
      <button class="kpi ${agot.length ? 'bad' : ''}" data-kpi="agotado"><span class="kpi-l">${ic('octagon-alert', 's')}Agotados</span><span class="kpi-v">${fNum(agot.length)}</span><span class="kpi-s">Sin unidades</span></button>
      <div class="kpi"><span class="kpi-l">${ic('package-minus', 's')}Retirados hoy</span><span class="kpi-v">${fNum(sHoy)}</span><span class="kpi-s">Unidades ${quien}</span></div>
      <div class="kpi"><span class="kpi-l">${ic('calendar', 's')}Retirados este mes</span><span class="kpi-v">${fNum(sMes)}</span><span class="kpi-s">Unidades ${quien}</span></div>`;

    // alertas de stock (estado actual)
    const alertas = [...agot, ...bajo.sort((a, b) => a.stock_actual - b.stock_actual)];
    $('#d-alertas').innerHTML = alertas.length ? alertas.slice(0, 8).map(p => `
      <li>${thumb(p)}<div class="grow"><div class="t1">${esc(p.nombre)}</div><div class="t2">${estadoDe(p) === 'agotado' ? 'No quedan unidades' : `Quedan ${fNum(p.stock_actual)} · mínimo ${fNum(p.stock_minimo)}`}</div></div>${badgeEstado(p)}</li>`).join('')
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
      const labels = [], ing = [], sa = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const k = ymd(d);
        labels.push(d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }));
        ing.push(sum(ingresosVig().filter(m => ymd(m.creado_en) === k), qtyEf));
        sa.push(sum(sal.filter(m => ymd(m.creado_en) === k), qtyEf));
      }
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = ing;
      this.chart.data.datasets[1].data = sa;
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
    $('#s-tb').onclick = e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = +b.dataset.id, p = premio(id);
      switch (b.dataset.act) {
        case 'retirar':
          if (isAdmin()) go('movimiento', { premio: id, tipo: 'salida' });
          else { S.rap.cart[id] = Math.min((S.rap.cart[id] || 0) + 1, p.stock_actual); go('rapido'); }
          break;
        case 'ingresar': go('movimiento', { premio: id, tipo: 'ingreso' }); break;
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
    if (f.est === 'alerta') rows = rows.filter(p => estadoDe(p) !== 'ok');
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
      const acts = `${p.activo && p.stock_actual > 0 && puedeRetirar() ? `<button class="btn go" data-act="retirar" data-id="${p.id}" title="Registrar un retiro">Retirar</button>` : ''}
          ${admin ? `
            ${p.activo ? `<button class="btn" data-act="ingresar" data-id="${p.id}" title="Registrar ingreso" aria-label="Registrar ingreso">${ic('package-plus', 's')}</button>` : ''}
            <button class="btn" data-act="quien" data-id="${p.id}" title="¿Quién lo sacó?" aria-label="¿Quién lo sacó?">${ic('user-search', 's')}</button>
            <button class="btn" data-act="mas" data-id="${p.id}" title="Más opciones" aria-label="Más opciones" aria-haspopup="menu">${ic('ellipsis-vertical', 's')}</button>` : ''}`;
      return `
      <tr class="${p.activo ? '' : 'void'}">
        <td class="main-cell" data-label="Premio"><div class="pcell">${thumb(p)}<div style="min-width:0"><div class="pname">${esc(p.nombre)}</div><div class="pcode">${esc(p.codigo)}</div></div></div></td>
        <td data-label="Categoría">${esc(catName(p.categoria_id))}</td>
        <td data-label="Stock actual" class="n">${lvl(p)}</td>
        <td data-label="Stock mínimo" class="n num">${fNum(p.stock_minimo)}</td>
        <td data-label="Estado">${badgeEstado(p)}</td>
        <td data-label="Último movimiento"><span class="muted">${p.ultimo_movimiento_en ? rel(p.ultimo_movimiento_en) : 'Sin movimientos'}</span></td>
        <td data-label="" class="n"><div class="acts">${acts}</div></td>
        <td class="mob"><div class="mrow">${thumb(p)}<div class="grow"><div class="t1">${esc(p.nombre)}</div><div class="t2">${esc(catName(p.categoria_id))}</div><div style="margin-top:6px">${badgeEstado(p)}</div></div>
          <div class="mr"><span class="big">${stockSpan(p)}</span><span class="t2">mínimo ${fNum(p.stock_minimo)}</span></div></div>
          ${acts.trim() ? `<div class="acts" style="margin-top:6px">${acts}</div>` : ''}</td>
      </tr>`; }).join('');
  }
};

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
          <div class="field"><label for="pmin">Stock mínimo</label><input class="in num" id="pmin" type="number" min="0" step="1" value="${p ? p.stock_minimo : 5}"><span class="hint">Avisa cuando el stock llega a este número.</span></div>
          ${nuevo ? `<div class="field"><label for="pini">Stock inicial</label><input class="in num" id="pini" type="number" min="0" step="1" value="0"><span class="hint">Se registra como ingreso.</span></div>` : ''}
        </div>
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
    try {
      let imagen_url = p ? p.imagen_url : null;
      if (blob) imagen_url = await API.subirImagen(blob);
      else if (quitar) imagen_url = null;
      const datos = { nombre, codigo, descripcion: m.$('#pd').value.trim() || null, categoria_id: m.$('#pcat').value ? +m.$('#pcat').value : null, stock_minimo: min, imagen_url };
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
    if (!admin) f.tipo = 'salida';
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
        toast(`<b>${verbo}.</b> ${esc(c.p.nombre)}: ${fNum(mov.stock_anterior)} → ${fNum(mov.stock_nuevo)} unidades.`, 'ok');
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
    if (t.closest('#rp-clear')) { R.cart = {}; R.obs = ''; R.nota = false; this.paintGrid(); this.paintBar(); icons(); return; }
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
      <div class="cart">${tot ? items.map(i => `<button class="cart-i" data-rm="${i.p.id}" title="Quitar">${i.n} × ${esc(i.p.nombre)} ${ic('x', 's')}</button>`).join('')
        : `<span class="muted small" style="align-self:center">Toca los premios que retiras: cada toque suma 1.</span>`}</div>
      <div class="rap-acts">
        <button class="btn icon ${R.nota || R.obs ? 'on-note' : ''}" id="rp-nota" title="Agregar nota" aria-label="Agregar nota">${ic('message-square-text')}</button>
        ${tot ? `<button class="btn icon" id="rp-clear" title="Vaciar" aria-label="Vaciar">${ic('trash-2')}</button>` : ''}
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
    el.innerHTML = `
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
    const mes = ymd(new Date()).slice(0, 7);
    const uds = {};
    salidasVig().filter(m => m.integrante_id && ymd(m.creado_en).startsWith(mes)).forEach(m => { uds[m.integrante_id] = (uds[m.integrante_id] || 0) + qtyEf(m); });
    const fila = x => `<li class="${x.activo ? '' : 'void'}"><span class="avatar">${esc(iniciales(x.nombre))}</span>
      <div class="grow"><div class="t1">${esc(x.nombre)}</div><div class="t2">${x.activo ? `${fNum(uds[x.id] || 0)} premio(s) retirados este mes` : 'Dada de baja'}</div></div>
      <div class="acts"><button class="btn" data-int="${x.id}" data-a="ren" title="Corregir nombre" aria-label="Corregir nombre">${ic('pencil', 's')}</button>
      <button class="btn" data-int="${x.id}" data-a="tog" title="${x.activo ? 'Dar de baja' : 'Activar'}" aria-label="${x.activo ? 'Dar de baja' : 'Activar'}">${ic(x.activo ? 'user-x' : 'user-check', 's')}</button></div></li>`;
    box.innerHTML = act.length || inact.length ? act.map(fila).join('') + inact.map(fila).join('')
      : `<li><div class="empty" style="width:100%">${ic('users')}<b>Todavía no hay nadie en este equipo</b>Agrega a las personas para que aparezcan en "¿Quién eres?".</div></li>`;
  }
};

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
      data: { labels: [], datasets: [{ label: 'Unidades retiradas', data: [], backgroundColor: c.s2, borderRadius: 4, maxBarThickness: 28, categoryPercentage: .8, barPercentage: .9 }] },
      options: chartOpts(c, false)
    });
    const rp = () => { this.paint(); icons(); };
    $('#r-d').onchange = e => { f.desde = e.target.value; rp(); };
    $('#r-h').onchange = e => { f.hasta = e.target.value; rp(); };
    $('#r-r').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; [f.desde, f.hasta] = rangoRapido(b.dataset.r); $('#r-d').value = f.desde; $('#r-h').value = f.hasta; rp(); };
    $('#r-g').onclick = e => { const b = e.target.closest('[data-g]'); if (!b) return; f.agrupar = b.dataset.g; rp(); };
    $('#r-p').onchange = e => { f.premio = e.target.value; rp(); };
    $('#r-u').onchange = e => { f.usuario = e.target.value; rp(); };
    const rango = () => `${f.desde ? fFecha(parseYmd(f.desde)) : 'inicio'} al ${f.hasta ? fFecha(parseYmd(f.hasta)) : 'hoy'}`;
    bindExp(el, 'per', () => ({ base: 'salidas_por_periodo', title: `Salidas por ${f.agrupar} (${rango()})`, cols: [{ h: 'Período', v: r => r.label }, { h: 'Unidades', v: r => r.unidades }, { h: 'Retiros', v: r => r.retiros }], rows: this.data.periodos }));
    bindExp(el, 'top', () => ({ base: 'premios_mas_entregados', title: `Premios más entregados (${rango()})`, cols: this.colsPremio(), rows: this.data.top }));
    bindExp(el, 'low', () => ({ base: 'premios_menos_utilizados', title: `Premios menos utilizados (${rango()})`, cols: this.colsPremio(), rows: this.data.low }));
    bindExp(el, 'sec', () => ({ base: 'salidas_por_sector', title: `Salidas por sector (${rango()})`, cols: this.colsSec(), rows: this.data.sec }));
    bindExp(el, 'usr', () => ({ base: 'retiros_por_usuario', title: `Retiros por usuario (${rango()})`, cols: this.colsUsr(), rows: this.data.usr }));
    bindExp(el, 'hp', () => ({ base: 'historial_premio', title: `Historial de ${(premio(f.premio) || {}).nombre || 'premio'} (${rango()})`, cols: MOV_COLS, rows: this.data.hp }));
    bindExp(el, 'hu', () => ({ base: 'historial_usuario', title: `Historial de ${(perfilDe(f.usuario) || {}).nombre_completo || 'usuario'} (${rango()})`, cols: MOV_COLS, rows: this.data.hu }));
    $('#r-all').onclick = () => exportarLibro('reporte_premios', [
      { title: 'Salidas por período', cols: [{ h: 'Período', v: r => r.label }, { h: 'Unidades', v: r => r.unidades }, { h: 'Retiros', v: r => r.retiros }], rows: this.data.periodos },
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
    const sal = salidasVig(enR), ing = ingresosVig(enR);
    const totU = sum(sal, qtyEf);

    // KPIs del período
    $('#r-kpis').innerHTML = `
      <div class="kpi"><span class="kpi-l">Unidades entregadas</span><span class="kpi-v">${fNum(totU)}</span><span class="kpi-s">${fNum(sal.length)} retiros</span></div>
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
    for (let d = new Date(ini), i = 0; d <= fin && i < 1500; d.setDate(d.getDate() + 1), i++) { const k = key(d); if (!mapa.has(k)) mapa.set(k, { label: lab(k), unidades: 0, retiros: 0 }); }
    sal.forEach(m => { const k = key(new Date(m.creado_en)); if (!mapa.has(k)) mapa.set(k, { label: lab(k), unidades: 0, retiros: 0 }); const r = mapa.get(k); r.unidades += qtyEf(m); r.retiros++; });
    const periodos = [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(e => e[1]);
    if (this.chart) { this.chart.data.labels = periodos.map(p => p.label); this.chart.data.datasets[0].data = periodos.map(p => p.unidades); this.chart.update('none'); }

    // por premio
    const porP = new Map(S.premios.map(p => [p.id, { p, unidades: 0, retiros: 0, ultimo: null }]));
    sal.forEach(m => { const r = porP.get(m.premio_id); if (!r) return; r.unidades += qtyEf(m); r.retiros++; if (!r.ultimo || m.creado_en > r.ultimo) r.ultimo = m.creado_en; });
    const lista = [...porP.values()];
    const top = lista.filter(r => r.unidades > 0).sort((a, b) => b.unidades - a.unidades).slice(0, 10);
    const low = lista.filter(r => r.p.activo).sort((a, b) => a.unidades - b.unidades || byName(a.p, b.p)).slice(0, 10);
    $('#r-top').innerHTML = top.length ? top.map((r, i) => `<tr><td class="muted">${i + 1}</td><td><span class="pname">${esc(r.p.nombre)}</span><div class="pcode">${esc(catName(r.p.categoria_id))}</div></td><td class="n strong num">${fNum(r.unidades)}</td><td class="n num">${fNum(r.retiros)}</td><td class="n num">${totU ? (r.unidades / totU * 100).toFixed(1).replace('.', ',') : 0}%</td></tr>`).join('')
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
const TABLAS_AUD = { premios: 'Premios', movimientos: 'Movimientos', perfiles: 'Usuarios', categorias: 'Categorías', configuracion: 'Configuración', sectores: 'Sectores' };
const CAMPOS = {
  nombre: 'Nombre', codigo: 'Código', descripcion: 'Descripción', categoria_id: 'Categoría', imagen_url: 'Imagen', stock_minimo: 'Stock mínimo',
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
    change: onChange
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
