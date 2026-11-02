import {
  formatRegionalCurrency,
  formatRegionalDate,
  getLocale,
} from "../../../utils/regionalSettings";

import { calculateGoalMonthlySavings, calculateGoalCompletionDate } from "../../../utils/goalMonthlySavings";

import styles from "./GoalList.module.css";

function GoalList({
  goals = [],
  onEdit,
  onDelete,
  loading = false,
  deletingGoalId = null,
  settings = {},
}) {
  if (loading) {
    return (
      <div className={styles.emptyState} role="status">
        Cargando objetivos...
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className={styles.emptyState}>
        Todavía no agregaste objetivos.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {goals.map((goal) => {
        const targetAmount = Number(goal.targetAmount) || 0;
        const currentAmount = Number(goal.currentAmount) || 0;

        const rawPercentage =
          targetAmount > 0
            ? (currentAmount / targetAmount) * 100
            : 0;

        const percentage = Math.min(
          100,
          Math.max(0, rawPercentage)
        );

        const percentageLabel =
  percentage <= 0
    ? "0"
    : percentage < 10
      ? new Intl.NumberFormat(
          getLocale(
            settings.language,
            settings.region
          ),
          {
            maximumFractionDigits:
              1,
          }
        ).format(
          percentage
        )
      : String(
          Math.round(
            percentage
          )
        );

        const hasProgress =
          currentAmount > 0 && percentage > 0;

        const isDeleting =
          deletingGoalId === goal.id;

        const goalTitle =
          goal.title || goal.name || "Objetivo";

        const formattedDeadline = goal.deadline
          ? formatRegionalDate(goal.deadline, settings)
          : null;

        const hasMonthlyPlan = Number(goal.monthlyContribution) > 0;
        const plan = hasMonthlyPlan
          ? calculateGoalCompletionDate({
              targetAmount,
              currentAmount,
              monthlyAmount: goal.monthlyContribution,
            })
          : calculateGoalMonthlySavings({
              targetAmount,
              currentAmount,
              deadline: goal.deadline,
            });

        return (
          <div
            key={goal.id}
            className={styles.card}
            aria-busy={isDeleting}
          >
            <div className={styles.top}>
              <div>
                <h3 className={styles.title}>
                  {goalTitle}
                </h3>

                {formattedDeadline && (
                  <p className={styles.deadline}>
                    Fecha límite: {formattedDeadline}
                  </p>
                )}

                {goal.linkedAccountName && (
                  <p
                    className={
                      styles.linkedAccount
                    }
                  >
                    <i className="bi bi-wallet2"></i>
                    Cuenta vinculada:{" "}
                    <strong>
                      {
                        goal.linkedAccountName
                      }
                    </strong>
                  </p>
                )}
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={() => onEdit(goal)}
                  disabled={isDeleting}
                  title="Editar objetivo"
                  aria-label={`Editar objetivo ${goalTitle}`}
                >
                  <i className="bi bi-pencil"></i>
                </button>

                <button
                  type="button"
                  onClick={() => void onDelete(goal.id)}
                  disabled={isDeleting}
                  title="Eliminar objetivo"
                  aria-label={`Eliminar objetivo ${goalTitle}`}
                >
                  <i
                    className={
                      isDeleting
                        ? "bi bi-hourglass-split"
                        : "bi bi-trash"
                    }
                  ></i>
                </button>
              </div>
            </div>

            <div className={styles.values}>
              <span>
                Ahorrado:{" "}
                {formatRegionalCurrency(
                  currentAmount,
                  settings
                )}
              </span>

              <span>
                Objetivo:{" "}
                {formatRegionalCurrency(
                  targetAmount,
                  settings
                )}
              </span>
            </div>

            <div
              className={styles.progressBar}
              role="progressbar"
              aria-label={`Progreso de ${goalTitle}`}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-valuenow={Number(
                percentage.toFixed(2)
              )}
            >
              <div
                className={styles.progress}
                style={{
                  width: `${percentage}%`,
                  minWidth: hasProgress ? "4px" : "0",
                }}
              ></div>
            </div>

            <p className={styles.percent}>
              {percentageLabel}% completado
            </p>

            {plan && (
              <div className={styles.monthlyInfo}>
                {plan.status === "completed" ? (
                  <span>¡Objetivo alcanzado!</span>
                ) : plan.status === "expired" ? (
                  <span>Fecha límite vencida. Podés actualizarla.</span>
                ) : plan.status === "too_long" ? (
                  <span>El aporte mensual es muy bajo para estimar una fecha cercana.</span>
                ) : hasMonthlyPlan ? (
                  <>
                    <span className={styles.monthlyLabel}>Aporte mensual planeado</span>
                    <strong className={styles.monthlyAmount}>
                      {formatRegionalCurrency(plan.monthlyAmount, settings)}
                    </strong>
                    <small>Fecha estimada: {formatRegionalDate(plan.completionDate, settings)} · {plan.months} {plan.months === 1 ? "aporte" : "aportes"} desde este mes.</small>
                  </>
                ) : (
                  <>
                    <span className={styles.monthlyLabel}>Necesitás ahorrar por mes</span>
                    <strong className={styles.monthlyAmount}>
                      {formatRegionalCurrency(plan.monthlyAmount, settings)}
                    </strong>
                    <small>
                      {plan.months === 1
                        ? "1 aporte mensual estimado"
                        : `${plan.months} aportes mensuales estimados`}
                    </small>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default GoalList;