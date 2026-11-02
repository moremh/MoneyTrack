// Capturamos únicamente la información del enlace al iniciar la aplicación,
// antes de que Supabase procese y retire parámetros de la URL.
// Los tokens no se guardan en localStorage ni se envían a un servidor propio.
const url = new URL(window.location.href);
const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
const query = url.searchParams;

const tokenHash =
  query.get("token_hash") && query.get("type") === "recovery"
    ? query.get("token_hash")
    : null;

const implicitToken =
  hash.get("type") === "recovery" && hash.get("access_token")
    ? hash.get("access_token")
    : null;

export const recoveryIntent = Object.freeze({
  kind: tokenHash
    ? "token_hash"
    : implicitToken
      ? "implicit"
      : query.get("code")
        ? "pkce"
        : null,
  tokenHash,
  implicitToken,
  errorCode: hash.get("error_code") || query.get("error_code") || "",
  hasAuthError: Boolean(
    hash.get("error") ||
    query.get("error") ||
    hash.get("error_description") ||
    query.get("error_description")
  ),
});
