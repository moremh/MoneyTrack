import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { recoveryLinkError, recoveryLinkOpened } from "../../lib/recoveryIntent";
import styles from "./Auth.module.css";

function ResetPassword() {
  const [status, setStatus] = useState("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let mounted = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY" && session) {
          // Evitar operaciones de Supabase sincrónicas en el callback.
          setTimeout(() => { if (mounted) setStatus("ready"); }, 0);
        }
      }
    );
    const validateLink = async () => {
      if (recoveryLinkError) {
        if (mounted) setStatus("invalid");
        return;
      }
      if (!recoveryLinkOpened) {
        if (mounted) setStatus((s) => s === "ready" ? s : "invalid");
        return;
      }
      const { data, error } = await supabase.auth.getUser();
      if (mounted) setStatus((s) =>
        s === "ready" ? s : (!error && data?.user ? "ready" : "invalid")
      );
    };
    void validateLink();
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

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
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMessage("No se pudo actualizar la contraseña. Verificá los requisitos o pedí otro enlace.");
        return;
      }
      setPassword("");
      setConfirmation("");
      // No dejar la sesión del enlace de recuperación abierta en el navegador.
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        setErrorMessage("Contraseña actualizada. Por seguridad, cerrá sesión antes de iniciar con la nueva.");
      }
      setStatus("success");
    } catch {
      setErrorMessage("Ocurrió un error al actualizar la contraseña. Volvé a intentarlo.");
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
          {status === "checking" && <p role="status" className={styles.passwordHint}>Verificando el enlace...</p>}
          {status === "invalid" && (
            <div role="alert" className={styles.errorMessage}>
              El enlace es inválido o venció. Solicitá uno nuevo desde la pantalla de recuperación.
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
          {status !== "ready" && errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
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
