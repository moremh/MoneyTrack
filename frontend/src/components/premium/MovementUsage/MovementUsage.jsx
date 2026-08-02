import { useAuth } from "../../../context/AuthContext";
import { useCommercialCatalog } from "../../../hooks/useCommercialCatalog";
import styles from "./MovementUsage.module.css";

function MovementUsage({ usage, onPremiumClick }) {
  const { currentUser } = useAuth();
  const { planMap } = useCommercialCatalog();

  if (!usage) {
    return null;
  }

  const planName =
    currentUser?.role === "admin"
      ? "Cuenta administradora"
      : currentUser?.plan === "premium"
        ? planMap?.[currentUser.billingCycle]?.name ||
          "Premium"
        : planMap?.free?.name ||
          "Plan gratuito";

  if (usage.isPremium) {
    return (
      <section className={`${styles.card} ${styles.premiumCard}`}>
        <div className={styles.icon}>
          <i className="bi bi-gem"></i>
        </div>

        <div className={styles.content}>
          <div className={styles.header}>
            <div>
              <span className={styles.label}>{planName}</span>
              <h2>Movimientos ilimitados</h2>
            </div>

            <span className={styles.premiumBadge}>
              {currentUser?.role === "admin"
                ? "Administrador"
                : "Premium"}
            </span>
          </div>

          <p>
            Durante este mes calendario registraste{" "}
            <strong>{usage.used}</strong>{" "}
            {usage.used === 1
              ? "movimiento"
              : "movimientos"}.
          </p>
        </div>
      </section>
    );
  }

  const percentage = Math.min(
    Math.max(Number(usage.percentage) || 0, 0),
    100
  );

  const statusClass =
    percentage >= 100
      ? styles.dangerProgress
      : percentage >= 80
        ? styles.warningProgress
        : styles.normalProgress;

  return (
    <section
      className={`${styles.card} ${
        usage.hasReachedLimit ? styles.limitReachedCard : ""
      }`}
    >
      <div className={styles.icon}>
        <i className="bi bi-list-check"></i>
      </div>

      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <span className={styles.label}>
              {planMap?.free?.name || "Plan gratuito"}
            </span>

            <h2>
              {usage.used} de {usage.limit} movimientos este mes
            </h2>
          </div>

          <span className={styles.freeBadge}>
            {usage.remaining} disponibles
          </span>
        </div>

        <div className={styles.progressTrack}>
          <div
            className={`${styles.progressBar} ${statusClass}`}
            style={{
              width: `${percentage}%`,
            }}
          ></div>
        </div>

        <div className={styles.footer}>
          <p>
            {usage.hasReachedLimit
              ? "Llegaste al límite mensual del plan gratuito."
              : `Utilizaste el ${percentage}% de tus movimientos mensuales.`}
          </p>

          {(percentage >= 80 || usage.hasReachedLimit) && (
            <button
              type="button"
              className={styles.premiumButton}
              onClick={onPremiumClick}
            >
              <i className="bi bi-gem"></i>

              {usage.hasReachedLimit
                ? "Activar Premium"
                : "Ver Premium"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default MovementUsage;