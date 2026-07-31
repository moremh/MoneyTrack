import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useAuth,
} from "../../../context/AuthContext";

import {
  useCommercialCatalog,
} from "../../../hooks/useCommercialCatalog";

import {
  buildWhatsAppPremiumRequest,
  formatCurrency,
  isPromotionCurrentlyActive,
} from "../../../config/premiumConfig";

import styles from "./PremiumLimitModal.module.css";

function PremiumLimitModal({
  usage,
  onClose,
}) {
  const {
    currentUser,
  } = useAuth();

  const {
    settings,
    premiumPlans,
    promotions,
  } = useCommercialCatalog();

  const offers = useMemo(() => {
    const baseOffers =
      premiumPlans.map((plan) => ({
        id: `plan-${plan.id}`,
        plan,
        promotion: null,
        title: plan.name,
        description: plan.description,
        price: plan.price,
        previousPrice: null,
        badge: plan.badge,
        details: [],
        buttonText:
          plan.buttonText ||
          "Solicitar por WhatsApp",
      }));

    const promotionalOffers =
      promotions
        .filter(
          (promotion) =>
            promotion.showOnModal &&
            isPromotionCurrentlyActive(
              promotion
            )
        )
        .map((promotion) => {
          const plan =
            premiumPlans.find(
              (item) =>
                item.id ===
                promotion.planId
            );

          if (!plan) {
            return null;
          }

          return {
            id: `promotion-${promotion.id}`,
            plan,
            promotion,
            title: promotion.title,
            description:
              promotion.description,
            price:
              promotion.promotionalPrice,
            previousPrice:
              promotion.previousPrice,
            badge: promotion.badge,
            details: promotion.details,
            buttonText:
              promotion.buttonText ||
              "Solicitar promoción",
          };
        })
        .filter(Boolean);

    return [
      ...baseOffers,
      ...promotionalOffers,
    ];
  }, [
    premiumPlans,
    promotions,
  ]);

  const [
    selectedOfferId,
    setSelectedOfferId,
  ] = useState("");

  useEffect(() => {
    if (
      offers.length > 0 &&
      !offers.some(
        (offer) =>
          offer.id ===
          selectedOfferId
      )
    ) {
      setSelectedOfferId(
        offers[0].id
      );
    }
  }, [
    offers,
    selectedOfferId,
  ]);

  const selectedOffer =
    offers.find(
      (offer) =>
        offer.id ===
        selectedOfferId
    ) || offers[0];

  const whatsappRequest =
    useMemo(() => {
      if (!selectedOffer) {
        return {
          message: "",
          url: "",
          isConfigured: false,
        };
      }

      return buildWhatsAppPremiumRequest({
        user: currentUser,
        plan: selectedOffer.plan,
        promotion:
          selectedOffer.promotion,
        settings,
      });
    }, [
      currentUser,
      selectedOffer,
      settings,
    ]);

  const handleOverlayClick = (
    event
  ) => {
    if (
      event.target ===
      event.currentTarget
    ) {
      onClose();
    }
  };

  if (!selectedOffer) {
    return null;
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={
        handleOverlayClick
      }
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="premium-modal-title"
      >
        <button
          type="button"
          className={
            styles.closeButton
          }
          onClick={onClose}
          aria-label="Cerrar ventana"
        >
          <i className="bi bi-x-lg"></i>
        </button>

        <header
          className={styles.header}
        >
          <div
            className={
              styles.headerIcon
            }
          >
            <i className="bi bi-gem"></i>
          </div>

          <span
            className={styles.eyebrow}
          >
            {settings.modalEyebrow}
          </span>

          <h2 id="premium-modal-title">
            {usage?.hasReachedLimit
              ? settings.modalLimitTitle
              : settings.modalTitle}
          </h2>

          <p>
            {usage?.hasReachedLimit ? (
              <>
                Ya utilizaste los{" "}
                <strong>
                  {usage?.limit || 100}
                </strong>{" "}
                movimientos disponibles
                en el plan gratuito.{" "}
                {
                  settings.modalLimitDescription
                }
              </>
            ) : (
              settings.modalDescription
            )}
          </p>
        </header>

        <div className={styles.plans}>
          {offers.map((offer) => {
            const isSelected =
              offer.id ===
              selectedOffer.id;

            return (
              <button
                key={offer.id}
                type="button"
                className={`${styles.planCard} ${
                  isSelected
                    ? styles.selectedPlan
                    : ""
                }`}
                onClick={() =>
                  setSelectedOfferId(
                    offer.id
                  )
                }
              >
                <div
                  className={
                    styles.planHeader
                  }
                >
                  <div>
                    <strong>
                      {offer.title}
                    </strong>

                    <span>
                      {offer.plan.duration}
                    </span>
                  </div>

                  <div
                    className={styles.radio}
                    aria-hidden="true"
                  >
                    {isSelected && (
                      <span></span>
                    )}
                  </div>
                </div>

                {offer.previousPrice !==
                  null && (
                  <del
                    className={
                      styles.previousPrice
                    }
                  >
                    {formatCurrency(
                      offer.previousPrice
                    )}
                  </del>
                )}

                <div
                  className={styles.price}
                >
                  {formatCurrency(
                    offer.price
                  )}
                </div>

                <p>{offer.description}</p>

                {offer.details.length >
                  0 && (
                  <ul
                    className={
                      styles.offerDetails
                    }
                  >
                    {offer.details.map(
                      (detail) => (
                        <li key={detail}>
                          {detail}
                        </li>
                      )
                    )}
                  </ul>
                )}

                {offer.badge && (
                  <span
                    className={
                      styles.planBadge
                    }
                  >
                    {offer.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div
          className={styles.summary}
        >
          <div>
            <span>
              Plan seleccionado
            </span>

            <strong>
              {selectedOffer.title}
            </strong>
          </div>

          <div>
            <span>Total</span>

            <strong>
              {formatCurrency(
                selectedOffer.price
              )}
            </strong>
          </div>
        </div>

        {!whatsappRequest.isConfigured && (
          <div
            className={
              styles.configurationWarning
            }
          >
            <i className="bi bi-exclamation-triangle"></i>

            <span>
              Configurá el número de
              WhatsApp desde el catálogo
              comercial del panel
              administrativo.
            </span>
          </div>
        )}

        <div
          className={styles.actions}
        >
          <button
            type="button"
            className={
              styles.cancelButton
            }
            onClick={onClose}
          >
            Seguir en el plan gratuito
          </button>

          {whatsappRequest.isConfigured ? (
            <a
              className={
                styles.whatsappButton
              }
              href={whatsappRequest.url}
              target="_blank"
              rel="noreferrer"
            >
              <i className="bi bi-whatsapp"></i>
              {selectedOffer.buttonText}
            </a>
          ) : (
            <button
              type="button"
              className={
                styles.whatsappButton
              }
              disabled
            >
              <i className="bi bi-whatsapp"></i>
              {selectedOffer.buttonText}
            </button>
          )}
        </div>

        <p
          className={styles.disclaimer}
        >
          {settings.paymentDisclaimer}
        </p>
      </section>
    </div>
  );
}

export default PremiumLimitModal;
