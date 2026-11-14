// =============================================================
//  CONFIGURACIÓN · completar con los datos de su proyecto Supabase
//  Supabase > Project Settings > API
// =============================================================
window.APP_CONFIG = {
  // "Project URL"
  SUPABASE_URL: 'https://finojfdsqhblpjinpwco.supabase.co',

  // "Publishable key" (sb_publishable_...) o la "anon public" key antigua.
  // Es pública por diseño; la seguridad la dan las reglas RLS de la base.
  // NUNCA poner aquí la "secret key" ni la "service_role".
  SUPABASE_ANON_KEY: 'sb_publishable_yXXubcGxGNDJ0iGRCskI6A_QMeCqewI',

  // Dominio interno para convertir "usuario" en un email de Supabase Auth.
  // No se envían correos. No lo cambie después de crear usuarios.
  EMAIL_DOMINIO: 'premios.app'
};
