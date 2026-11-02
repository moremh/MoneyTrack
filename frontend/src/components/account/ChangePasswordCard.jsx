import { useState } from "react";
import { supabase } from "../../lib/supabase";
import styles from "./ChangePasswordCard.module.css";

function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (password.length < 8) {
      setFeedback({ ok: false, message: "Usá al menos 8 caracteres." });
      return;
    }
    if (password !== confirmation) {
      setFeedback({ ok: false, message: "Las contraseñas no coinciden." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setFeedback({ ok: false, message: "No se pudo cambiar la contraseña. Es posible que se requiera volver a verificar tu identidad." });
        return;
      }
      setPassword("");
      setConfirmation("");
      setFeedback({ ok: true, message: "Contraseña actualizada correctamente." });
    } catch {
      setFeedback({ ok: false, message: "No se pudo contactar con el servidor." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className={styles.card}>
      <div className={styles.heading}>
        <i className="bi bi-shield-lock" aria-hidden="true" />
        <div><h2>Seguridad de la cuenta</h2><p>Cambiá tu contraseña desde tu perfil.</p></div>
      </div>
      <form onSubmit={save} className={styles.form}>
        <label htmlFor="profile-new-password">Nueva contraseña</label>
        <input id="profile-new-password" type={visible ? "text" : "password"}
          autoComplete="new-password" minLength={8} value={password}
          onChange={(e) => setPassword(e.target.value)} required disabled={saving} />
        <label htmlFor="profile-confirm-password">Confirmar nueva contraseña</label>
        <input id="profile-confirm-password" type={visible ? "text" : "password"}
          autoComplete="new-password" minLength={8} value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)} required disabled={saving} />
        <label className={styles.checkbox}>
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Mostrar contraseñas
        </label>
        {feedback && <p role={feedback.ok ? "status" : "alert"}
          className={feedback.ok ? styles.success : styles.error}>{feedback.message}</p>}
        <button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </article>
  );
}
export default ChangePasswordCard;
