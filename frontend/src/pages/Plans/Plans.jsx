import {
  useContext,
  useMemo,
} from "react";

import {
  FinanceContext,
} from "../../context/FinanceContext";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  useCommercialCatalog,
} from "../../hooks/useCommercialCatalog";

import {
  buildWhatsAppPremiumRequest,
  formatCurrency,
  isPromotionCurrentlyActive,
} from "../../config/premiumConfig";

import styles from "./Plans.module.css";

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "Sin vencimiento";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(new Date(dateValue));
};

function Plans() {
  const {
    currentUser,
  } = useAuth();

  const {
    movementUsage,
  } = useContext(FinanceContext);

  const {
    settings,
    planMap,
    premiumPlans,
    promotions,
    loading,
    error,
  } = useCommercialCatalog();

  const isAdmin =
    currentUser?.role === "admin";

  const isPremium =
    currentUser?.plan === "premium";

  const freePlan = planMap.free;

  const currentPlanName = isAdmin
    ? "Cuenta administradora"
    : isPremium
      ? planMap?.[
          currentUser.billingCycle
        ]?.name || "Premium"
      : freePlan?.name ||
        "Plan gratuito";

  const visiblePromotions =
    useMemo(
      () =>
        promotions.filter(
          (promotion) =>
            promotion.showOnPlans &&
            isPromotionCurrentlyActive(
              promotion
            )
        ),
      [promotions]
    );

  const createRequest = (
    plan,
    promotion = null
  ) =>
    buildWhatsAppPremiumRequest({
      user: currentUser,
      plan,
      promotion,
      settings,
    });

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span
            className={styles.eyebrow}
          >
            {settings.plansEyebrow}
          </span>

          <h1>{settings.plansTitle}</h1>

          <p>
            {settings.plansDescription}
          </p>
        </div>

        <div
          className={styles.currentPlan}
        >
          <span>Tu plan actual</span>

          <strong>
            {currentPlanName}
          </strong>

          {isPremium &&
            currentUser
              ?.premiumExpiresAt && (
              <small>
                Vence el{" "}
                {formatDate(
                  currentUser
                    .premiumExpiresAt
                )}
              </small>
            )}
        </div>
      </header>

      {loading && (
        <p
          className={
            styles.catalogNotice
          }
        >
          Cargando planes...
        </p>
      )}

      {error && (
        <p
          className={
            styles.catalogNotice
          }
        >
          Se están mostrando los
          valores de respaldo.
        </p>
      )}

      <div
        className={styles.plansGrid}
      >
        {freePlan?.isVisible && (
          <article
            className={`${styles.planCard} ${
              !isPremium && !isAdmin
                ? styles.currentCard
                : ""
            }`}
          >
            {!isPremium &&
              !isAdmin && (
                <span
                  className={
                    styles.currentBadge
                  }
                >
                  Plan actual
                </span>
              )}

            <div
              className={styles.planIcon}
            >
              <i className="bi bi-person"></i>
            </div>

            <div
              className={styles.planHeader}
            >
              <span>
                {freePlan.subtitle}
              </span>

              <h2>{freePlan.name}</h2>
            </div>

            <div
              className={styles.price}
            >
              <strong>
                {formatCurrency(
                  freePlan.price
                )}
              </strong>

              <span>
                {freePlan.priceSuffix}
              </span>
            </div>

            {freePlan.description && (
              <p
                className={
                  styles.planDescription
                }
              >
                {freePlan.description}
              </p>
            )}

            <ul
              className={styles.features}
            >
              {freePlan.features.map(
                (feature) => (
                  <li key={feature}>
                    <i className="bi bi-check-circle-fill"></i>
                    {feature}
                  </li>
                )
              )}
            </ul>

            <div
              className={styles.usage}
            >
              <div>
                <span>Uso mensual</span>

                <strong>
                  {movementUsage?.used ||
                    0}{" "}
                  de{" "}
                  {movementUsage?.limit ||
                    100}
                </strong>
              </div>

              <div
                className={
                  styles.progressTrack
                }
              >
                <div
                  className={
                    styles.progressBar
                  }
                  style={{
                    width: `${
                      movementUsage?.percentage ||
                      0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </article>
        )}

        {premiumPlans.map((plan) => {
          const request =
            createRequest(plan);

          const isCurrentPlan =
            isPremium &&
            currentUser?.billingCycle ===
              plan.id;

          return (
            <article
              key={plan.id}
              className={`${styles.planCard} ${styles.premiumCard} ${
                isCurrentPlan
                  ? styles.currentPremiumCard
                  : ""
              }`}
            >
              {isCurrentPlan && (
                <span
                  className={
                    styles.premiumCurrentBadge
                  }
                >
                  Plan actual
                </span>
              )}

              {plan.badge && (
                <span
                  className={
                    styles.offerBadge
                  }
                >
                  {plan.badge}
                </span>
              )}

              <div
                className={`${styles.planIcon} ${styles.premiumIcon}`}
              >
                <i className="bi bi-gem"></i>
              </div>

              <div
                className={
                  styles.planHeader
                }
              >
                <span>
                  {plan.subtitle}
                </span>

                <h2>{plan.name}</h2>
              </div>

              <div
                className={styles.price}
              >
                <strong>
                  {formatCurrency(
                    plan.price
                  )}
                </strong>

                <span>
                  {plan.priceSuffix}
                </span>
              </div>

              {plan.description && (
                <p
                  className={
                    styles.planDescription
                  }
                >
                  {plan.description}
                </p>
              )}

              <ul
                className={styles.features}
              >
                {plan.features.map(
                  (feature) => (
                    <li key={feature}>
                      <i className="bi bi-check-circle-fill"></i>
                      {feature}
                    </li>
                  )
                )}
              </ul>

              {!isAdmin &&
                (request.isConfigured ? (
                  <a
                    href={request.url}
                    target="_blank"
                    rel="noreferrer"
                    className={
                      styles.whatsappButton
                    }
                  >
                    <i className="bi bi-whatsapp"></i>

                    {isCurrentPlan
                      ? "Renovar por WhatsApp"
                      : plan.buttonText ||
                        `Solicitar ${plan.name}`}
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
                    WhatsApp no configurado
                  </button>
                ))}
            </article>
          );
        })}
      </div>

      {visiblePromotions.length > 0 && (
        <section
          className={
            styles.promotionsSection
          }
        >
          <header
            className={
              styles.promotionsHeader
            }
          >
            <span>Promociones</span>

            <h2>Ofertas disponibles</h2>

            <p>
              Aprovechá las promociones
              vigentes de MoneyTrack.
            </p>
          </header>

          <div
            className={
              styles.promotionsGrid
            }
          >
            {visiblePromotions.map(
              (promotion) => {
                const plan =
                  planMap[
                    promotion.planId
                  ];

                if (!plan) {
                  return null;
                }

                const request =
                  createRequest(
                    plan,
                    promotion
                  );

                return (
                  <article
                    key={promotion.id}
                    className={
                      styles.promotionCard
                    }
                  >
                    {promotion.badge && (
                      <span
                        className={
                          styles.promotionBadge
                        }
                      >
                        {promotion.badge}
                      </span>
                    )}

                    <span
                      className={
                        styles.promotionPlan
                      }
                    >
                      {plan.name}
                    </span>

                    <h3>
                      {promotion.title}
                    </h3>

                    <div
                      className={
                        styles.promotionPrice
                      }
                    >
                      {promotion.previousPrice !==
                        null && (
                        <del>
                          {formatCurrency(
                            promotion.previousPrice
                          )}
                        </del>
                      )}

                      <strong>
                        {formatCurrency(
                          promotion.promotionalPrice
                        )}
                      </strong>
                    </div>

                    <p>
                      {promotion.description}
                    </p>

                    {promotion.details
                      .length > 0 && (
                      <ul
                        className={
                          styles.features
                        }
                      >
                        {promotion.details.map(
                          (detail) => (
                            <li key={detail}>
                              <i className="bi bi-check-circle-fill"></i>
                              {detail}
                            </li>
                          )
                        )}
                      </ul>
                    )}

                    {!isAdmin &&
                      (request.isConfigured ? (
                        <a
                          href={request.url}
                          target="_blank"
                          rel="noreferrer"
                          className={
                            styles.whatsappButton
                          }
                        >
                          <i className="bi bi-whatsapp"></i>

                          {promotion.buttonText}
                        </a>
                      ) : (
                        <button
                          type="button"
                          className={
                            styles.whatsappButton
                          }
                          disabled
                        >
                          WhatsApp no configurado
                        </button>
                      ))}
                  </article>
                );
              }
            )}
          </div>
        </section>
      )}

      <article
        className={styles.information}
      >
        <div
          className={
            styles.informationIcon
          }
        >
          <i className="bi bi-info-circle"></i>
        </div>

        <div>
          <h2>
            {settings.activationTitle}
          </h2>

          <p>
            {
              settings.activationDescription
            }
          </p>
        </div>
      </article>
    </section>
  );
}

export default Plans;
