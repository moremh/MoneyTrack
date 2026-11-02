// Evaluado antes de crear el cliente de Supabase.
// No se guardan tokens ni contraseñas; solo la intención de recuperación.
const url = new URL(window.location.href);
const hashParams = new URLSearchParams(url.hash.slice(1));
export const recoveryLinkOpened =
  (hashParams.get("type") === "recovery" && Boolean(hashParams.get("access_token"))) ||
  (url.searchParams.get("type") === "recovery" && Boolean(url.searchParams.get("token_hash")));
export const recoveryLinkError =
  hashParams.get("error_description") ||
  url.searchParams.get("error_description") ||
  "";
