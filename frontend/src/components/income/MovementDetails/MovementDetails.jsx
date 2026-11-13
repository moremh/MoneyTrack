import { useEffect, useState } from "react";
import Modal from "../../common/Modal/Modal";
import { formatRegionalCurrency, formatRegionalDate, formatRegionalDateTime } from "../../../utils/regionalSettings";
import styles from "./MovementDetails.module.css";
const EMPTY_ANNOTATION = Object.freeze({ notes: "", tags: [] });
export default function MovementDetails({ movement, accountName, annotation=EMPTY_ANNOTATION, onSave, onClose, settings={} }) {
  const [notes,setNotes] = useState(annotation.notes || "");
  const [tags,setTags] = useState((annotation.tags || []).join(", "));
  const [message,setMessage] = useState("");
  const [saving,setSaving] = useState(false);
  useEffect(() => {setNotes(annotation.notes || "");setTags((annotation.tags || []).join(", "));},[annotation]);
  async function save() {
    setSaving(true);
    const result = await onSave(movement.id,notes,tags);
    setSaving(false);
    setMessage(result.success ? "Notas y etiquetas guardadas." : result.message);
  }
  const rows = [
    ["Tipo", movement.type === "expense" ? "Gasto" : "Ingreso"],
    ["Descripción", movement.description],
    ["Importe", formatRegionalCurrency(movement.amount,settings)],
    ["Categoría", movement.category || "General"],
    ["Cuenta", accountName || "Saldo general (sin cuenta)"],
    ["Fecha del movimiento", formatRegionalDate(movement.date,settings)],
    ["Registrado el", movement.createdAt ? formatRegionalDateTime(movement.createdAt,settings) : "Pendiente de sincronización"],
    ["Última modificación", movement.updatedAt ? formatRegionalDateTime(movement.updatedAt,settings) : "—"],
  ];
  return <Modal onClose={onClose}>
    <h2>Detalles del movimiento</h2>
    <dl className={styles.details}>{rows.map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <label className={styles.field}>Notas<textarea value={notes} maxLength={2000} rows={3}
      placeholder="Ej: Compra para el viaje..." onChange={event=>setNotes(event.target.value)} /></label>
    <label className={styles.field}>Etiquetas (separadas por coma)<input value={tags}
      placeholder="Facultad, Viaje, Trabajo..." onChange={event=>setTags(event.target.value)} /></label>
    <p className={styles.hint}>Las etiquetas permiten buscar y filtrar tus movimientos y reportes.</p>
    {message && <p role="status">{message}</p>}
    <div className={styles.actions}><button type="button" onClick={onClose}>Cerrar</button>
      <button type="button" disabled={saving} onClick={save}>{saving ? "Guardando..." : "Guardar notas y etiquetas"}</button></div>
  </Modal>;
}
