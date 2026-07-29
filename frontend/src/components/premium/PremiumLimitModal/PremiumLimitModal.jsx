import { useMemo, useState } from "react";

import { useAuth } from "../../../context/AuthContext";

import {
  PREMIUM_PLANS,
  buildWhatsAppPremiumRequest,
  formatCurrency,
} from "../../../config/premiumConfig";

import styles from "./PremiumLimitModal.module.css";

function PremiumLimitModal({ usage, onClose }) {
  const { currentUser } = useAuth();

  const [selectedPlanId, setSelectedPlanId] =
    useState("monthly");

  const selectedPlan = PREMIUM_PLANS[selectedPlanId];

  const whatsappRequest = useMemo(() => {
    if (!selectedPlan) {
      return {
        message: "",
        url: "",
        isConfigured: false,
      };
    }

    return buildWhatsAppPremiumRequest({
      user: currentUser,
      plan: selectedPlan,
    });
  }, [currentUser, selectedPlan]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!selectedPlan) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={handleOverlayClick}
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-title"
      >
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        <header className={styles.header}>
          <div className={styles.headerIcon}>
            <i className="bi bi-gem"></i>
          </div>

          <span className={styles.eyebrow}>
            MoneyTrack Premium
          </span>

          <h2 id="premium-modal-title">
            {usage?.hasReachedLimit
              ? "Llegaste al límite mensual"
              : "Conocé los planes Premium"}
          </h2>

          <p>
            {usage?.hasReachedLimit ? (
              <>
                Ya utilizaste los{" "}
                <strong>{usage?.limit || 100}</strong>{" "}
                movimientos disponibles en el plan gratuito.
                Elegí un plan para continuar registrando
                movimientos sin límites.
              </>
            ) : (
              <>
                Elegí un plan Premium para registrar movimientos
                sin límites.
              </>
            )}
          </p>
        </header>

        <div className={styles.plans}>
          {Object.values(PREMIUM_PLANS).map((plan) => {
            const isSelected = plan.id === selectedPlanId;

            return (
              <button
                key={plan.id}
                type="button"
                className={`${styles.planCard} ${
                  isSelected ? styles.selectedPlan : ""
                }`}
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <div className={styles.planHeader}>
                  <div>
                    <strong>{plan.name}</strong>
                    <span>{plan.duration}</span>
                  </div>

                  <div
                    className={styles.radio}
                    aria-hidden="true"
                  >
                    {isSelected && <span></span>}
                  </div>
                </div>

                <div className={styles.price}>
                  {formatCurrency(plan.price)}
                </div>

                <p>{plan.description}</p>

                {plan.badge && (
                  <span className={styles.planBadge}>
                    {plan.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className={styles.summary}>
          <div>
            <span>Plan seleccionado</span>
            <strong>{selectedPlan.name}</strong>
          </div>

          <div>
            <span>Total</span>

            <strong>
              {formatCurrency(selectedPlan.price)}
            </strong>
          </div>
        </div>

        {!whatsappRequest.isConfigured && (
          <div className={styles.configurationWarning}>
            <i className="bi bi-exclamation-triangle"></i>

            <span>
              Configurá tu número de WhatsApp en{" "}
              <strong>
                src/config/premiumConfig.js
              </strong>
              .
            </span>
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onClose}
          >
            Seguir en el plan gratuito
          </button>

          {whatsappRequest.isConfigured ? (
            <a
              className={styles.whatsappButton}
              href={whatsappRequest.url}
              target="_blank"
              rel="noreferrer"
            >
              <i className="bi bi-whatsapp"></i>
              Solicitar por WhatsApp
            </a>
          ) : (
            <button
              type="button"
              className={styles.whatsappButton}
              disabled
            >
              <i className="bi bi-whatsapp"></i>
              Solicitar por WhatsApp
            </button>
          )}
        </div>

        <p className={styles.disclaimer}>
          El plan se activará después de verificar el
          comprobante de pago.
        </p>
      </section>
    </div>
  );
}

export default PremiumLimitModal;