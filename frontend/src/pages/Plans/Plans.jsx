import { useContext, useMemo } from "react";

import { FinanceContext } from "../../context/FinanceContext";
import { useAuth } from "../../context/AuthContext";

import {
  PREMIUM_PLANS,
  buildWhatsAppPremiumRequest,
  formatCurrency,
} from "../../config/premiumConfig";

import styles from "./Plans.module.css";

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "Sin vencimiento";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(dateValue));
};

function Plans() {
  const { currentUser } = useAuth();
  const { movementUsage } = useContext(FinanceContext);

  const premiumPlans = useMemo(
    () => Object.values(PREMIUM_PLANS),
    []
  );

  const isAdmin = currentUser?.role === "admin";
  const isPremium = currentUser?.plan === "premium";

  const currentPlanName = isAdmin
    ? "Cuenta administradora"
    : isPremium
      ? currentUser.billingCycle === "annual"
        ? "Premium anual"
        : "Premium mensual"
      : "Plan gratuito";

  const createWhatsAppRequest = (plan) =>
    buildWhatsAppPremiumRequest({
      user: currentUser,
      plan,
    });

  return (
    <section className={styles.page}>
      <header className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            Planes MoneyTrack
          </span>

          <h1>Elegí el plan que mejor se adapte a vos</h1>

          <p>
            Todos los planes tienen las mismas herramientas.
            La diferencia está en la cantidad de movimientos
            que podés registrar.
          </p>
        </div>

        <div className={styles.currentPlan}>
          <span>Tu plan actual</span>
          <strong>{currentPlanName}</strong>

          {isPremium && currentUser?.premiumExpiresAt && (
            <small>
              Vence el{" "}
              {formatDate(currentUser.premiumExpiresAt)}
            </small>
          )}
        </div>
      </header>

      <div className={styles.plansGrid}>
        <article
          className={`${styles.planCard} ${
            !isPremium && !isAdmin
              ? styles.currentCard
              : ""
          }`}
        >
          {!isPremium && !isAdmin && (
            <span className={styles.currentBadge}>
              Plan actual
            </span>
          )}

          <div className={styles.planIcon}>
            <i className="bi bi-person"></i>
          </div>

          <div className={styles.planHeader}>
            <span>Para comenzar</span>
            <h2>Gratuito</h2>
          </div>

          <div className={styles.price}>
            <strong>$0</strong>
            <span>sin vencimiento</span>
          </div>

          <ul className={styles.features}>
            <li>
              <i className="bi bi-check-circle-fill"></i>
              100 movimientos por mes
            </li>

            <li>
              <i className="bi bi-check-circle-fill"></i>
              Ingresos y gastos
            </li>

            <li>
              <i className="bi bi-check-circle-fill"></i>
              Reportes PDF y Excel
            </li>

            <li>
              <i className="bi bi-check-circle-fill"></i>
              Objetivos y categorías
            </li>

            <li>
              <i className="bi bi-check-circle-fill"></i>
              Todos los gráficos y filtros
            </li>
          </ul>

          <div className={styles.usage}>
            <div>
              <span>Uso mensual</span>
              <strong>
                {movementUsage?.used || 0} de{" "}
                {movementUsage?.limit || 100}
              </strong>
            </div>

            <div className={styles.progressTrack}>
              <div
                className={styles.progressBar}
                style={{
                  width: `${
                    movementUsage?.percentage || 0
                  }%`,
                }}
              ></div>
            </div>
          </div>
        </article>

        {premiumPlans.map((plan) => {
          const request = createWhatsAppRequest(plan);

          const isCurrentPlan =
            isPremium &&
            currentUser?.billingCycle === plan.id;

          return (
            <article
              key={plan.id}
              className={`${styles.planCard} ${
                styles.premiumCard
              } ${
                isCurrentPlan
                  ? styles.currentPremiumCard
                  : ""
              }`}
            >
              {isCurrentPlan && (
                <span className={styles.premiumCurrentBadge}>
                  Plan actual
                </span>
              )}

              {plan.badge && (
                <span className={styles.offerBadge}>
                  {plan.badge}
                </span>
              )}

              <div
                className={`${styles.planIcon} ${styles.premiumIcon}`}
              >
                <i className="bi bi-gem"></i>
              </div>

              <div className={styles.planHeader}>
                <span>Movimientos ilimitados</span>
                <h2>{plan.name}</h2>
              </div>

              <div className={styles.price}>
                <strong>
                  {formatCurrency(plan.price)}
                </strong>

                <span>
                  {plan.id === "annual"
                    ? "por año"
                    : "por mes"}
                </span>
              </div>

              <ul className={styles.features}>
                <li>
                  <i className="bi bi-check-circle-fill"></i>
                  Movimientos ilimitados
                </li>

                <li>
                  <i className="bi bi-check-circle-fill"></i>
                  Todas las funciones del plan gratuito
                </li>

                <li>
                  <i className="bi bi-check-circle-fill"></i>
                  Reportes PDF y Excel
                </li>

                <li>
                  <i className="bi bi-check-circle-fill"></i>
                  Filtros y estadísticas completas
                </li>

                <li>
                  <i className="bi bi-check-circle-fill"></i>
                  Activación manual por WhatsApp
                </li>
              </ul>

              {!isAdmin &&
                (request.isConfigured ? (
                  <a
                    href={request.url}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.whatsappButton}
                  >
                    <i className="bi bi-whatsapp"></i>

                    {isCurrentPlan
                      ? "Renovar por WhatsApp"
                      : `Solicitar ${plan.name}`}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={styles.whatsappButton}
                    disabled
                  >
                    <i className="bi bi-whatsapp"></i>
                    Configurar WhatsApp
                  </button>
                ))}
            </article>
          );
        })}
      </div>

      <article className={styles.information}>
        <div className={styles.informationIcon}>
          <i className="bi bi-info-circle"></i>
        </div>

        <div>
          <h2>¿Cómo se activa Premium?</h2>

          <p>
            Elegís el plan, enviás el mensaje por WhatsApp y
            recibís los datos para realizar la transferencia.
            Después de verificar el comprobante, tu cuenta se
            activa desde el panel administrativo.
          </p>
        </div>
      </article>
    </section>
  );
}

export default Plans;