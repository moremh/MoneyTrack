import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import styles from "./Auth.module.css";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const sendRecovery = async (event) => {
    event.preventDefault();
    if (sending) return;

    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setErrorMessage("Ingresá un correo electrónico válido.");
      return;
    }

    setSending(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalized,
        { redirectTo: `${window.location.origin}/reset-password` }
      );
      if (error) {
        const message = String(error.message || "").toLowerCase();
        setErrorMessage(
          message.includes("rate") || message.includes("limit")
            ? "Se enviaron demasiadas solicitudes. Esperá unos minutos y volvé a intentar."
            : "No pudimos procesar la solicitud. Probá nuevamente en unos minutos."
        );
        return;
      }
      // Respuesta genérica para no revelar qué correos están registrados.
      setSent(true);
    } catch {
      setErrorMessage("No pudimos comunicarnos con el servidor. Verificá tu conexión.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.presentation}>
        <div className={styles.presentationContent}>
          <div className={styles.logo}><i className="bi bi-wallet2" /> MoneyTrack</div>
          <h1>Recuperá el acceso a tus finanzas.</h1>
          <p>Tu información continúa protegida. Te ayudamos a crear una contraseña nueva.</p>
        </div>
      </section>
      <section className={styles.formSection}>
        <div className={styles.card}>
          <div className={styles.mobileLogo}><i className="bi bi-wallet2" /> MoneyTrack</div>
          <header className={styles.header}>
            <span className={styles.eyebrow}>Seguridad de la cuenta</span>
            <h2>Olvidé mi contraseña</h2>
            <p>Ingresá el correo con el que te registraste en MoneyTrack.</p>
          </header>
          {sent ? (
            <div role="status" className={styles.successMessage}>
              <i className="bi bi-envelope-check" aria-hidden="true" />
              <span>Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña. Revisá también Spam o Correo no deseado.</span>
            </div>
          ) : (
            <form className={styles.form} onSubmit={sendRecovery}>
              <div className={styles.field}>
                <label htmlFor="recovery-email">Correo electrónico</label>
                <div className={styles.inputWrapper}>
                  <i className="bi bi-envelope" aria-hidden="true" />
                  <input id="recovery-email" name="email" type="email"
                    autoComplete="email" value={email} required
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@correo.com" disabled={sending} />
                </div>
              </div>
              {errorMessage && <div role="alert" className={styles.errorMessage}>{errorMessage}</div>}
              <button className={styles.primaryButton} type="submit" disabled={sending}>
                {sending ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>
            </form>
          )}
          <p className={styles.actionsBottom}><Link className={styles.secondaryLink} to="/login">Volver a iniciar sesión</Link></p>
        </div>
      </section>
    </main>
  );
}

export default ForgotPassword;
