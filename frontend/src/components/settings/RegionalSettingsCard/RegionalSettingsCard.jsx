import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  LANGUAGE_OPTIONS,
  detectRegionalPreferences,
  formatRegionalCurrency,
  formatRegionalDateTime,
  getCountryOptions,
  getCurrencyOptions,
  getTimeZoneOptions,
} from "../../../utils/regionalSettings";

import styles from "./RegionalSettingsCard.module.css";

function RegionalSettingsCard({
  settings,
  updateRegionalSettings,
  disabled = false,
}) {
  const [language, setLanguage] = useState(settings?.language || "es");
  const [region, setRegion] = useState(settings?.region || "AR");
  const [currency, setCurrency] = useState(settings?.currency || "ARS");
  const [timezone, setTimezone] = useState(
    settings?.timezone || "America/Argentina/Buenos_Aires"
  );
  const [timeFormat, setTimeFormat] = useState(settings?.timeFormat || "24h");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    setLanguage(settings?.language || "es");
    setRegion(settings?.region || "AR");
    setCurrency(settings?.currency || "ARS");
    setTimezone(settings?.timezone || "America/Argentina/Buenos_Aires");
    setTimeFormat(settings?.timeFormat || "24h");
  }, [
    settings?.currency,
    settings?.language,
    settings?.region,
    settings?.timeFormat,
    settings?.timezone,
  ]);

  const countryOptions = useMemo(() => getCountryOptions(language), [language]);
  const currencyOptions = useMemo(() => getCurrencyOptions(language), [language]);
  const timezoneOptions = useMemo(() => getTimeZoneOptions(), []);

  const preview = useMemo(() => ({
    money: formatRegionalCurrency(125430.5, {
      language,
      region,
      currency,
      timezone,
      timeFormat,
    }),
    dateTime: formatRegionalDateTime(new Date(), {
      language,
      region,
      currency,
      timezone,
      timeFormat,
    }),
  }), [currency, language, region, timeFormat, timezone]);

  const handleDetect = () => {
    const detected = detectRegionalPreferences({
      language,
      region,
      currency,
      timezone,
      timeFormat,
    });

    setLanguage(detected.language);
    setRegion(detected.region);
    setTimezone(detected.timezone);
    setTimeFormat(detected.timeFormat);
    setFeedback({
      type: "info",
      message:
        "Detectamos idioma, región, zona horaria y formato horario del dispositivo. Revisá la moneda antes de guardar.",
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving || disabled) return;

    setSaving(true);
    setFeedback(null);

    try {
      const result =
        await updateRegionalSettings({
          language,
          region,
          currency,
          timezone,
          timeFormat,
        });

      setFeedback({
        type: result?.success ? "success" : "error",
        message:
          result?.message ||
          (result?.success
            ? "Configuración regional guardada correctamente."
            : "No se pudo guardar la configuración regional."),
      });
    } catch (error) {
      console.error("No se pudo guardar la configuración regional:", error);
      setFeedback({
        type: "error",
        message: "No se pudo guardar la configuración regional. Volvé a intentarlo.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.titleRow}>
        <div>
          <h2>Región e idioma</h2>
          <p>
            Estos ajustes pertenecen a tu cuenta y se mantienen cuando iniciás
            sesión desde otro dispositivo.
          </p>
        </div>

        <button
          type="button"
          className={styles.detectButton}
          onClick={handleDetect}
          disabled={disabled || saving}
        >
          <i className="bi bi-geo-alt" aria-hidden="true"></i>
          Detectar automáticamente
        </button>
      </div>

      {feedback && (
        <div
          className={`${styles.feedback} ${
            feedback.type === "error"
              ? styles.feedbackError
              : feedback.type === "success"
                ? styles.feedbackSuccess
                : styles.feedbackInfo
          }`}
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </div>
      )}

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.grid}>
          <label>
            <span>Idioma</span>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              disabled={disabled || saving}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>
              Idiomas adicionales: Próximamente. La configuración regional, moneda, zona horaria y formato de hora ya están disponibles.
            </small>
            <small>
              Idiomas adicionales: Próximamente. La configuración regional, moneda, zona horaria y formato de hora ya están disponibles.
            </small>
          </label>

          <label>
            <span>País / región</span>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              disabled={disabled || saving}
            >
              {countryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Moneda principal</span>
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              disabled={disabled || saving}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>
              Cambiar la moneda no convierte importes históricos. Define cómo se
              muestran e interpretan los montos financieros de la cuenta.
            </small>
          </label>

          <label>
            <span>Zona horaria</span>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              disabled={disabled || saving}
            >
              {timezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>Los recordatorios nuevos usarán esta zona horaria.</small>
          </label>

          <label>
            <span>Formato de hora</span>
            <select
              value={timeFormat}
              onChange={(event) => setTimeFormat(event.target.value)}
              disabled={disabled || saving}
            >
              <option value="24h">24 horas</option>
              <option value="12h">12 horas (AM/PM)</option>
            </select>
          </label>
        </div>

        <div className={styles.preview}>
          <div>
            <span>Vista previa de moneda</span>
            <strong>{preview.money}</strong>
          </div>
          <div>
            <span>Fecha y hora en tu zona</span>
            <strong>{preview.dateTime}</strong>
          </div>
        </div>

        <button
          type="submit"
          className={styles.saveButton}
          disabled={disabled || saving}
        >
          {saving ? "Guardando..." : "Guardar región e idioma"}
        </button>
      </form>
    </section>
  );
}

export default RegionalSettingsCard;
