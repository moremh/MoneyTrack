import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { recoveryIntent } from "../../lib/recoveryIntent";
import styles from "./Auth.module.css";

const EXPIRATION_CODES = new Set([
  "otp_expired",
  "expired_token",
  "token_expired",
]);

const getLinkError = (error) => {
  const code = String(error?.code || error?.error_code || "").toLowerCase();
  if (EXPIRATION_CODES.has(code)) {
    return "El enlace venció o ya fue utilizado. Solicitá uno nuevo.";
  }
  return "No pudimos verificar el enlace. Probá otra vez desde el correo más reciente.";
};

function ResetPassword() {
  const [status, setStatus] = useState("checking");
  const [linkMessage, setLinkMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const acceptSession = useCallback(async (session) => {
    // No permitir que una sesión anterior, de otra cuenta, valide el enlace.
    if (!session?.access_token || !session?.user) return false;
    if (
      recoveryIntent.kind === "implicit" &&
      session.access_token !== recoveryIntent.implicitToken
    ) {
      return false;
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user || data.user.id !== session.user.id) {
      return false;
    }
    setStatus("ready");
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    let timer;

    if (recoveryIntent.hasAuthError) {
      setLinkMessage(
        EXPIRATION_CODES.has(recoveryIntent.errorCode.toLowerCase())
          ? "Supabase rechazó el enlace porque venció o ya fue utilizado."
          : "Supabase rechazó el enlace de recuperación. Solicitá uno nuevo."
      );
      setStatus("invalid");
      return undefined;
    }

    if (!recoveryIntent.kind) {
      setLinkMessage(
        "No encontramos los datos de recuperación en el enlace. Abrí el correo más reciente y utilizá su botón de recuperación."
      );
      setStatus("invalid");
      return undefined;
    }

    if (recoveryIntent.kind === "token_hash") {
      // Verificación manual: una vista previa del correo no consume el código.
      setStatus("confirm");
      return undefined;
    }

    let resolved = false;
    const verifySession = async (session) => {
      if (!active || resolved) return;
      try {
        const ok = await acceptSession(session);
        if (ok && active) {
          resolved = true;
          clearTimeout(timer);
        }
      } catch {
        // La inicialización o la conexión pueden tardar: dejamos que
        // el evento PASSWORD_RECOVERY también intente validar.
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "PASSWORD_RECOVERY" ||
          (event === "SIGNED_IN" && recoveryIntent.kind === "pkce")
        ) {
          window.setTimeout(() => { void verifySession(session); }, 0);
        }
      }
    );

    // getSession espera la inicialización del cliente; no declarar
    // un enlace vencido antes de que Supabase procese la URL.
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!error) void verifySession(data.session);
    }).catch(() => {});

    timer = window.setTimeout(() => {
      if (!active || resolved) return;
      setLinkMessage(
        "No se pudo validar este enlace. Puede ser un problema de sesión, un enlace utilizado o una falla de conexión."
      );
      setStatus("invalid");
    }, 12000);

    return () => {
      active = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [acceptSession]);

  const confirmTokenHash = async () => {
    if (saving || !recoveryIntent.tokenHash) return;
    setSaving(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: recoveryIntent.tokenHash,
        type: "recovery",
      });
      if (error || !data?.session) {
        setLinkMessage(getLinkError(error));
        setStatus("invalid");
        return;
      }
      const ok = await acceptSession(data.session);
      if (!ok) {
        setLinkMessage("No pudimos comprobar la sesión de recuperación. Solicitá otro enlace.");
        setStatus("invalid");
      }
    } catch {
      setErrorMessage("No pudimos verificar el enlace por un problema de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    if (saving || status !== "ready") return;
    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }
    setSaving(true);
    setErrorMessage("");
    try {
      // Comprobar otra vez la sesión inmediatamente antes del cambio.
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        setLinkMessage("La sesión de recuperación dejó de estar disponible. Solicitá otro enlace.");
        setStatus("invalid");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage("No se pudo actualizar la contraseña. Verificá los requisitos o solicitá otro enlace.");
        return;
      }
      setPassword("");
      setConfirmation("");
      const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
      if (logoutError) {
        setErrorMessage("Contraseña actualizada. Por seguridad, cerrá sesión antes de ingresar con la nueva.");
      }
      setStatus("success");
    } catch {
      setErrorMessage("Ocurrió un error al actualizar la contraseña. Volvé a intentar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.presentation}>
        <div className={styles.presentationContent}>
          <div className={styles.logo}><i className="bi bi-wallet2" /> MoneyTrack</div>
          <h1>Una nueva contraseña, la misma tranquilidad.</h1>
          <p>Elegí una contraseña segura para volver a ingresar a tu cuenta.</p>
        </div>
      </section>
      <section className={styles.formSection}>
        <div className={styles.card}>
          <div className={styles.mobileLogo}><i className="bi bi-wallet2" /> MoneyTrack</div>
          <header className={styles.header}>
            <span className={styles.eyebrow}>Seguridad de la cuenta</span>
            <h2>Restablecer contraseña</h2>
            <p>El enlace es personal y tiene un tiempo de validez limitado.</p>
          </header>
          {status === "checking" && (
            <p role="status" className={styles.passwordHint}>Verificando el enlace de recuperación...</p>
          )}
          {status === "invalid" && (
            <div role="alert" className={styles.errorMessage}>{linkMessage}</div>
          )}
          {status === "confirm" && (
            <div className={styles.form}>
              <p className={styles.passwordHint}>
                Recibimos el enlace. Confirmá que querés restablecer tu contraseña para continuar.
              </p>
              {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
              <button type="button" className={styles.primaryButton} disabled={saving}
                onClick={() => void confirmTokenHash()}>
                {saving ? "Verificando..." : "Continuar con la recuperación"}
              </button>
            </div>
          )}
          {status === "success" && (
            <div role="status" className={styles.successMessage}>
              Contraseña actualizada correctamente. Ya podés iniciar sesión con la nueva.
            </div>
          )}
          {status === "ready" && (
            <form className={styles.form} onSubmit={updatePassword}>
              <div className={styles.field}>
                <label htmlFor="new-password">Nueva contraseña</label>
                <div className={styles.inputWrapper}>
                  <i className="bi bi-lock" aria-hidden="true" />
                  <input id="new-password" type={showPassword ? "text" : "password"}
                    autoComplete="new-password" minLength={8} required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    disabled={saving} />
                  <button className={styles.passwordButton} type="button"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    onClick={() => setShowPassword((value) => !value)}>
                    <i className={showPassword ? "bi bi-eye-slash" : "bi bi-eye"} />
                  </button>
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="confirm-password">Confirmar contraseña</label>
                <div className={styles.inputWrapper}>
                  <i className="bi bi-shield-lock" aria-hidden="true" />
                  <input id="confirm-password" type={showPassword ? "text" : "password"}
                    autoComplete="new-password" minLength={8} required value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)} disabled={saving} />
                </div>
              </div>
              <p className={styles.passwordHint}>Usá al menos 8 caracteres y no compartas tu contraseña.</p>
              {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
              <button type="submit" className={styles.primaryButton} disabled={saving}>
                {saving ? "Actualizando..." : "Guardar nueva contraseña"}
              </button>
            </form>
          )}
          <p className={styles.actionsBottom}>
            <Link className={styles.secondaryLink} to={status === "invalid" ? "/forgot-password" : "/login"}>
              {status === "invalid" ? "Solicitar otro enlace" : "Volver a iniciar sesión"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default ResetPassword;
