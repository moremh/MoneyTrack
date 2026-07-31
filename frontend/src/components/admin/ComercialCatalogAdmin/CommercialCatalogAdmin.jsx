import {
  useEffect,
  useState,
} from "react";

import { supabase } from "../../../lib/supabase";

import {
  notifyCommercialCatalogUpdated,
  useCommercialCatalog,
} from "../../../hooks/useCommercialCatalog";

import styles from "./CommercialCatalogAdmin.module.css";

const linesToArray = (value) =>
  String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

const arrayToLines = (value) =>
  Array.isArray(value)
    ? value.join("\n")
    : "";

const EMPTY_PROMOTION = {
  planId: "monthly",
  title: "",
  description: "",
  badge: "",
  promotionalPrice: "",
  previousPrice: "",
  buttonText: "Solicitar promoción",
  detailsText: "",
  startsOn: "",
  endsOn: "",
  isActive: true,
  showOnPlans: true,
  showOnModal: true,
  sortOrder: 0,
};

function Feedback({ value }) {
  if (!value?.message) {
    return null;
  }

  return (
    <div
      className={
        value.type === "error"
          ? styles.errorMessage
          : styles.successMessage
      }
      role={
        value.type === "error"
          ? "alert"
          : "status"
      }
    >
      <i
        className={
          value.type === "error"
            ? "bi bi-exclamation-circle"
            : "bi bi-check-circle"
        }
      ></i>

      {value.message}
    </div>
  );
}

function SettingsEditor({
  settings,
  onSaved,
}) {
  const [draft, setDraft] =
    useState(settings);

  const [saving, setSaving] =
    useState(false);

  const [feedback, setFeedback] =
    useState(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateField = (
    field,
    value
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));

    setFeedback(null);
  };

  const handleSave = async (
    event
  ) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("commercial_settings")
      .update({
        whatsapp_number:
          draft.whatsappNumber.trim(),
        plans_eyebrow:
          draft.plansEyebrow.trim(),
        plans_title:
          draft.plansTitle.trim(),
        plans_description:
          draft.plansDescription.trim(),
        activation_title:
          draft.activationTitle.trim(),
        activation_description:
          draft.activationDescription.trim(),
        modal_eyebrow:
          draft.modalEyebrow.trim(),
        modal_title:
          draft.modalTitle.trim(),
        modal_limit_title:
          draft.modalLimitTitle.trim(),
        modal_description:
          draft.modalDescription.trim(),
        modal_limit_description:
          draft.modalLimitDescription.trim(),
        payment_disclaimer:
          draft.paymentDisclaimer.trim(),
      })
      .eq("id", "main");

    if (error) {
      console.error(
        "No se pudo guardar la configuración:",
        error
      );

      setFeedback({
        type: "error",
        message:
          "No se pudo guardar la configuración general.",
      });

      setSaving(false);
      return;
    }

    notifyCommercialCatalogUpdated();
    await onSaved();

    setFeedback({
      type: "success",
      message:
        "Configuración general actualizada.",
    });

    setSaving(false);
  };

  return (
    <form
      className={styles.editorCard}
      onSubmit={handleSave}
    >
      <div
        className={styles.editorHeader}
      >
        <div>
          <span>Configuración</span>
          <h3>
            Textos generales y WhatsApp
          </h3>
        </div>

        <i className="bi bi-gear"></i>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Número de WhatsApp</span>

          <input
            type="text"
            value={draft.whatsappNumber}
            onChange={(event) =>
              updateField(
                "whatsappNumber",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Texto superior de Planes
          </span>

          <input
            type="text"
            value={draft.plansEyebrow}
            onChange={(event) =>
              updateField(
                "plansEyebrow",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>Título de Planes</span>

          <input
            type="text"
            value={draft.plansTitle}
            onChange={(event) =>
              updateField(
                "plansTitle",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>
            Descripción de Planes
          </span>

          <textarea
            rows="3"
            value={
              draft.plansDescription
            }
            onChange={(event) =>
              updateField(
                "plansDescription",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Título de activación
          </span>

          <input
            type="text"
            value={draft.activationTitle}
            onChange={(event) =>
              updateField(
                "activationTitle",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Texto superior del modal
          </span>

          <input
            type="text"
            value={draft.modalEyebrow}
            onChange={(event) =>
              updateField(
                "modalEyebrow",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>
            Descripción de activación
          </span>

          <textarea
            rows="3"
            value={
              draft.activationDescription
            }
            onChange={(event) =>
              updateField(
                "activationDescription",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Título normal del modal
          </span>

          <input
            type="text"
            value={draft.modalTitle}
            onChange={(event) =>
              updateField(
                "modalTitle",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Título al alcanzar el límite
          </span>

          <input
            type="text"
            value={draft.modalLimitTitle}
            onChange={(event) =>
              updateField(
                "modalLimitTitle",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>
            Descripción normal del modal
          </span>

          <textarea
            rows="3"
            value={draft.modalDescription}
            onChange={(event) =>
              updateField(
                "modalDescription",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>
            Descripción al alcanzar el límite
          </span>

          <textarea
            rows="3"
            value={
              draft.modalLimitDescription
            }
            onChange={(event) =>
              updateField(
                "modalLimitDescription",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>Aviso sobre el pago</span>

          <textarea
            rows="2"
            value={draft.paymentDisclaimer}
            onChange={(event) =>
              updateField(
                "paymentDisclaimer",
                event.target.value
              )
            }
          />
        </label>
      </div>

      <Feedback value={feedback} />

      <button
        type="submit"
        className={styles.saveButton}
        disabled={saving}
      >
        <i className="bi bi-check2-circle"></i>

        {saving
          ? "Guardando..."
          : "Guardar configuración"}
      </button>
    </form>
  );
}

function PlanEditor({
  plan,
  onSaved,
}) {
  const [draft, setDraft] =
    useState({
      ...plan,
      featuresText:
        arrayToLines(plan.features),
    });

  const [saving, setSaving] =
    useState(false);

  const [feedback, setFeedback] =
    useState(null);

  useEffect(() => {
    setDraft({
      ...plan,
      featuresText:
        arrayToLines(plan.features),
    });
  }, [plan]);

  const updateField = (
    field,
    value
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));

    setFeedback(null);
  };

  const handleSave = async (
    event
  ) => {
    event.preventDefault();

    const numericPrice =
      Number(draft.price);

    if (
      !draft.name.trim() ||
      !Number.isFinite(numericPrice) ||
      numericPrice < 0
    ) {
      setFeedback({
        type: "error",
        message:
          "Ingresá un título y un precio válido.",
      });

      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("commercial_plans")
      .update({
        title: draft.name.trim(),
        subtitle: draft.subtitle.trim(),
        duration: draft.duration.trim(),
        price: numericPrice,
        price_suffix:
          draft.priceSuffix.trim(),
        description:
          draft.description.trim(),
        badge:
          draft.badge.trim() || null,
        button_text:
          draft.buttonText.trim(),
        features: linesToArray(
          draft.featuresText
        ),
        is_visible:
          Boolean(draft.isVisible),
        sort_order:
          Number(draft.sortOrder) || 0,
      })
      .eq("id", plan.id);

    if (error) {
      console.error(
        "No se pudo actualizar el plan:",
        error
      );

      setFeedback({
        type: "error",
        message:
          "No se pudo actualizar el plan.",
      });

      setSaving(false);
      return;
    }

    notifyCommercialCatalogUpdated();
    await onSaved();

    setFeedback({
      type: "success",
      message: "Plan actualizado.",
    });

    setSaving(false);
  };

  return (
    <form
      className={styles.editorCard}
      onSubmit={handleSave}
    >
      <div
        className={styles.editorHeader}
      >
        <div>
          <span>Plan {plan.id}</span>
          <h3>{plan.name}</h3>
        </div>

        <i
          className={
            plan.id === "free"
              ? "bi bi-person"
              : "bi bi-gem"
          }
        ></i>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Título</span>

          <input
            type="text"
            value={draft.name}
            onChange={(event) =>
              updateField(
                "name",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Subtítulo</span>

          <input
            type="text"
            value={draft.subtitle}
            onChange={(event) =>
              updateField(
                "subtitle",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Duración</span>

          <input
            type="text"
            value={draft.duration}
            onChange={(event) =>
              updateField(
                "duration",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Precio</span>

          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.price}
            onChange={(event) =>
              updateField(
                "price",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Texto junto al precio
          </span>

          <input
            type="text"
            value={draft.priceSuffix}
            onChange={(event) =>
              updateField(
                "priceSuffix",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Insignia</span>

          <input
            type="text"
            value={draft.badge}
            onChange={(event) =>
              updateField(
                "badge",
                event.target.value
              )
            }
            placeholder="Ej: Más elegido"
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>Descripción</span>

          <textarea
            rows="3"
            value={draft.description}
            onChange={(event) =>
              updateField(
                "description",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>Texto del botón</span>

          <input
            type="text"
            value={draft.buttonText}
            onChange={(event) =>
              updateField(
                "buttonText",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>
            Beneficios, uno por línea
          </span>

          <textarea
            rows="6"
            value={draft.featuresText}
            onChange={(event) =>
              updateField(
                "featuresText",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Orden</span>

          <input
            type="number"
            step="1"
            value={draft.sortOrder}
            onChange={(event) =>
              updateField(
                "sortOrder",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={styles.checkboxField}
        >
          <input
            type="checkbox"
            checked={draft.isVisible}
            onChange={(event) =>
              updateField(
                "isVisible",
                event.target.checked
              )
            }
          />

          <span>
            Visible para clientes
          </span>
        </label>
      </div>

      <Feedback value={feedback} />

      <button
        type="submit"
        className={styles.saveButton}
        disabled={saving}
      >
        <i className="bi bi-check2-circle"></i>

        {saving
          ? "Guardando..."
          : "Guardar plan"}
      </button>
    </form>
  );
}

function PromotionEditor({
  promotion = EMPTY_PROMOTION,
  isNew = false,
  onSaved,
  planMap,
}) {
  const [draft, setDraft] =
    useState({
      ...EMPTY_PROMOTION,
      ...promotion,
      detailsText:
        promotion.detailsText ??
        arrayToLines(
          promotion.details
        ),
    });

  const [saving, setSaving] =
    useState(false);

  const [feedback, setFeedback] =
    useState(null);

  useEffect(() => {
    setDraft({
      ...EMPTY_PROMOTION,
      ...promotion,
      detailsText:
        promotion.detailsText ??
        arrayToLines(
          promotion.details
        ),
    });
  }, [promotion]);

  const updateField = (
    field,
    value
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));

    setFeedback(null);
  };

  const handleSave = async (
    event
  ) => {
    event.preventDefault();

    const promotionalPrice =
      Number(
        draft.promotionalPrice
      );

    if (
      !draft.title.trim() ||
      !Number.isFinite(
        promotionalPrice
      ) ||
      promotionalPrice < 0
    ) {
      setFeedback({
        type: "error",
        message:
          "Ingresá un título y un precio promocional válido.",
      });

      return;
    }

    const previousPrice =
      draft.previousPrice === ""
        ? null
        : Number(
            draft.previousPrice
          );

    if (
      previousPrice !== null &&
      (!Number.isFinite(
        previousPrice
      ) ||
        previousPrice < 0)
    ) {
      setFeedback({
        type: "error",
        message:
          "El precio anterior no es válido.",
      });

      return;
    }

    if (
      draft.startsOn &&
      draft.endsOn &&
      draft.startsOn > draft.endsOn
    ) {
      setFeedback({
        type: "error",
        message:
          "La fecha de inicio no puede ser posterior a la fecha final.",
      });

      return;
    }

    setSaving(true);
    setFeedback(null);

    const payload = {
      plan_id: draft.planId,
      title: draft.title.trim(),
      description:
        draft.description.trim(),
      badge:
        draft.badge.trim() || null,
      promotional_price:
        promotionalPrice,
      previous_price:
        previousPrice,
      button_text:
        draft.buttonText.trim() ||
        "Solicitar promoción",
      details: linesToArray(
        draft.detailsText
      ),
      starts_on:
        draft.startsOn || null,
      ends_on:
        draft.endsOn || null,
      is_active:
        Boolean(draft.isActive),
      show_on_plans:
        Boolean(draft.showOnPlans),
      show_on_modal:
        Boolean(draft.showOnModal),
      sort_order:
        Number(draft.sortOrder) || 0,
    };

    const query = isNew
      ? supabase
          .from(
            "commercial_promotions"
          )
          .insert(payload)
      : supabase
          .from(
            "commercial_promotions"
          )
          .update(payload)
          .eq("id", promotion.id);

    const { error } = await query;

    if (error) {
      console.error(
        "No se pudo guardar la promoción:",
        error
      );

      setFeedback({
        type: "error",
        message:
          "No se pudo guardar la promoción.",
      });

      setSaving(false);
      return;
    }

    notifyCommercialCatalogUpdated();
    await onSaved();

    if (isNew) {
      setDraft({
        ...EMPTY_PROMOTION,
      });
    }

    setFeedback({
      type: "success",
      message: isNew
        ? "Promoción creada."
        : "Promoción actualizada.",
    });

    setSaving(false);
  };

  const handleDelete = async () => {
    if (
      isNew ||
      saving ||
      !promotion.id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `¿Eliminar la promoción "${promotion.title}"?`
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    const { error } = await supabase
      .from("commercial_promotions")
      .delete()
      .eq("id", promotion.id);

    if (error) {
      console.error(
        "No se pudo eliminar la promoción:",
        error
      );

      setFeedback({
        type: "error",
        message:
          "No se pudo eliminar la promoción.",
      });

      setSaving(false);
      return;
    }

    notifyCommercialCatalogUpdated();
    await onSaved();

    setSaving(false);
  };

  return (
    <form
      className={styles.editorCard}
      onSubmit={handleSave}
    >
      <div
        className={styles.editorHeader}
      >
        <div>
          <span>
            {isNew
              ? "Nueva promoción"
              : "Promoción"}
          </span>

          <h3>
            {draft.title ||
              "Crear promoción"}
          </h3>
        </div>

        <i className="bi bi-tags"></i>
      </div>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Plan asociado</span>

          <select
            value={draft.planId}
            onChange={(event) =>
              updateField(
                "planId",
                event.target.value
              )
            }
          >
            <option value="monthly">
              {planMap?.monthly?.name ||
                "Premium mensual"}
            </option>

            <option value="annual">
              {planMap?.annual?.name ||
                "Premium anual"}
            </option>
          </select>
        </label>

        <label className={styles.field}>
          <span>Título</span>

          <input
            type="text"
            value={draft.title}
            onChange={(event) =>
              updateField(
                "title",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Precio promocional
          </span>

          <input
            type="number"
            min="0"
            step="0.01"
            value={
              draft.promotionalPrice
            }
            onChange={(event) =>
              updateField(
                "promotionalPrice",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Precio anterior</span>

          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.previousPrice}
            onChange={(event) =>
              updateField(
                "previousPrice",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Insignia</span>

          <input
            type="text"
            value={draft.badge}
            onChange={(event) =>
              updateField(
                "badge",
                event.target.value
              )
            }
            placeholder="Ej: 20% OFF"
          />
        </label>

        <label className={styles.field}>
          <span>Texto del botón</span>

          <input
            type="text"
            value={draft.buttonText}
            onChange={(event) =>
              updateField(
                "buttonText",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>Descripción</span>

          <textarea
            rows="3"
            value={draft.description}
            onChange={(event) =>
              updateField(
                "description",
                event.target.value
              )
            }
          />
        </label>

        <label
          className={`${styles.field} ${styles.fullField}`}
        >
          <span>
            Información adicional, una línea por elemento
          </span>

          <textarea
            rows="5"
            value={draft.detailsText}
            onChange={(event) =>
              updateField(
                "detailsText",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Fecha de inicio</span>

          <input
            type="date"
            value={draft.startsOn}
            onChange={(event) =>
              updateField(
                "startsOn",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>
            Fecha de finalización
          </span>

          <input
            type="date"
            value={draft.endsOn}
            onChange={(event) =>
              updateField(
                "endsOn",
                event.target.value
              )
            }
          />
        </label>

        <label className={styles.field}>
          <span>Orden</span>

          <input
            type="number"
            step="1"
            value={draft.sortOrder}
            onChange={(event) =>
              updateField(
                "sortOrder",
                event.target.value
              )
            }
          />
        </label>

        <div
          className={styles.checkboxGroup}
        >
          <label
            className={
              styles.checkboxField
            }
          >
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                updateField(
                  "isActive",
                  event.target.checked
                )
              }
            />

            <span>Promoción activa</span>
          </label>

          <label
            className={
              styles.checkboxField
            }
          >
            <input
              type="checkbox"
              checked={draft.showOnPlans}
              onChange={(event) =>
                updateField(
                  "showOnPlans",
                  event.target.checked
                )
              }
            />

            <span>Mostrar en Planes</span>
          </label>

          <label
            className={
              styles.checkboxField
            }
          >
            <input
              type="checkbox"
              checked={draft.showOnModal}
              onChange={(event) =>
                updateField(
                  "showOnModal",
                  event.target.checked
                )
              }
            />

            <span>
              Mostrar en el modal
            </span>
          </label>
        </div>
      </div>

      <Feedback value={feedback} />

      <div className={styles.actions}>
        <button
          type="submit"
          className={styles.saveButton}
          disabled={saving}
        >
          <i className="bi bi-check2-circle"></i>

          {saving
            ? "Guardando..."
            : isNew
              ? "Crear promoción"
              : "Guardar promoción"}
        </button>

        {!isNew && (
          <button
            type="button"
            className={
              styles.deleteButton
            }
            onClick={handleDelete}
            disabled={saving}
          >
            <i className="bi bi-trash"></i>
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}

function CommercialCatalogAdmin() {
  const {
    settings,
    plans,
    planMap,
    promotions,
    loading,
    error,
    refresh,
  } = useCommercialCatalog();

  return (
    <section className={styles.section}>
      <header
        className={styles.sectionHeader}
      >
        <div>
          <span
            className={styles.eyebrow}
          >
            Catálogo comercial
          </span>

          <h2>
            Planes, precios y promociones
          </h2>

          <p>
            Todo lo que guardes aquí se reflejará en las
            pantallas visibles para los clientes.
          </p>
        </div>

        <div
          className={styles.catalogBadge}
        >
          <i className="bi bi-shop"></i>
          Contenido editable
        </div>
      </header>

      {loading && (
        <div className={styles.loading}>
          Cargando catálogo comercial...
        </div>
      )}

      {error && (
        <div
          className={styles.errorMessage}
        >
          <i className="bi bi-exclamation-circle"></i>
          {error}
        </div>
      )}

      {!loading && (
        <div
          className={styles.catalogGrid}
        >
          <SettingsEditor
            settings={settings}
            onSaved={refresh}
          />

          {plans.map((plan) => (
            <PlanEditor
              key={plan.id}
              plan={plan}
              onSaved={refresh}
            />
          ))}

          <PromotionEditor
            isNew
            planMap={planMap}
            onSaved={refresh}
          />

          {promotions.map(
            (promotion) => (
              <PromotionEditor
                key={promotion.id}
                promotion={promotion}
                planMap={planMap}
                onSaved={refresh}
              />
            )
          )}
        </div>
      )}
    </section>
  );
}

export default CommercialCatalogAdmin;