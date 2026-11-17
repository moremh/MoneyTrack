import { useId, useMemo, useState } from "react";
import styles from "./MovementTags.module.css";

const normalizeTag = (value) =>
  String(value ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");

const tagKey = (value) => normalizeTag(value).toLocaleLowerCase("es-AR");

/**
 * Selector reutilizable de etiquetas para ingresos y gastos.
 * No consulta ni guarda datos por su cuenta: el formulario recibe los cambios
 * mediante onChange y su capa de datos se encarga de persistirlos.
 */
function MovementTags({
  value = [],
  onChange,
  suggestions = [],
  disabled = false,
  maxTags = 12,
}) {
  const inputId = useId();
  const helpId = useId();
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  const tags = useMemo(() =>
    Array.isArray(value) ? value.map(normalizeTag).filter(Boolean) : [],
  [value]);
  const selectedKeys = useMemo(() => new Set(tags.map(tagKey)), [tags]);

  const options = useMemo(() => {
    const existing = new Set();
    return (Array.isArray(suggestions) ? suggestions : [])
      .map(normalizeTag)
      .filter((tag) => {
        const key = tagKey(tag);
        if (!tag || selectedKeys.has(key) || existing.has(key)) return false;
        existing.add(key);
        return !draft.trim() || key.includes(tagKey(draft));
      })
      .slice(0, 6);
  }, [suggestions, selectedKeys, draft]);

  const addTag = (raw) => {
    if (disabled) return;
    const next = normalizeTag(raw);
    if (!next) return;
    if (next.length > 40) {
      setMessage("Cada etiqueta puede tener hasta 40 caracteres.");
      return;
    }
    if (selectedKeys.has(tagKey(next))) {
      setDraft("");
      setMessage("");
      return;
    }
    if (tags.length >= maxTags) {
      setMessage(`Podés agregar hasta ${maxTags} etiquetas por movimiento.`);
      return;
    }
    onChange?.([...tags, next]);
    setDraft("");
    setMessage("");
  };

  const removeTag = (tag) => {
    if (disabled) return;
    onChange?.(tags.filter((item) => tagKey(item) !== tagKey(tag)));
    setMessage("");
  };

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor={inputId}>
        Etiquetas <span className={styles.optional}>(opcional)</span>
      </label>

      {tags.length > 0 && (
        <div className={styles.selected} aria-label="Etiquetas seleccionadas">
          {tags.map((tag) => (
            <span className={styles.chip} key={tagKey(tag)}>
              <span>{tag}</span>
              <button
                type="button"
                className={styles.remove}
                onClick={() => removeTag(tag)}
                disabled={disabled}
                aria-label={`Quitar etiqueta ${tag}`}
              >
                <i className="bi bi-x" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          id={inputId}
          type="text"
          className={styles.input}
          value={draft}
          onChange={(event) => { setDraft(event.target.value); setMessage(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(draft);
            }
          }}
          placeholder="Ej.: Viaje, trabajo, vacaciones"
          aria-describedby={helpId}
          maxLength={41}
          autoComplete="off"
          disabled={disabled || tags.length >= maxTags}
        />
        <button
          type="button"
          className={styles.add}
          onClick={() => addTag(draft)}
          disabled={disabled || !draft.trim() || tags.length >= maxTags}
        >
          Agregar
        </button>
      </div>

      {options.length > 0 && tags.length < maxTags && (
        <div className={styles.suggestions}>
          <span className={styles.suggestionsTitle}>Ya utilizadas:</span>
          {options.map((tag) => (
            <button
              type="button"
              className={styles.suggestion}
              key={tagKey(tag)}
              onClick={() => addTag(tag)}
              disabled={disabled}
            >
              <i className="bi bi-plus" aria-hidden="true" /> {tag}
            </button>
          ))}
        </div>
      )}

      <small id={helpId} className={styles.help}>
        Presioná Enter o Agregar. Máximo {maxTags} etiquetas. No son obligatorias.
      </small>
      {message && <span className={styles.error} role="alert">{message}</span>}
    </div>
  );
}

export default MovementTags;
