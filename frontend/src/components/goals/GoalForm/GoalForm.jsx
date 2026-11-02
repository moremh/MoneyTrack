import {
  useContext,
  useEffect,
  useState,
} from "react";

import {
  FinanceContext,
} from "../../../context/FinanceContext";

import {
  AccountContext,
} from "../../../context/AccountContext";

import {
  formatAmountInput,
  formatStoredAmount,
  normalizeAmountOnBlur,
  parseAmountInput,
} from "../../../utils/amountUtils";

import { calculateGoalMonthlySavings, calculateGoalCompletionDate } from "../../../utils/goalMonthlySavings";
import { formatRegionalCurrency, formatRegionalDate } from "../../../utils/regionalSettings";
import { getLocalToday } from "../../../utils/dateUtils";

import styles from "./GoalForm.module.css";

function GoalForm({
  onSubmit,
  initialData,
  accountBalances,
  originalSavedAmount,
}) {
  const {
    settings,
  } = useContext(
    FinanceContext
  );

  const {
    accounts = [],
  } =
    useContext(
      AccountContext
    ) || {};
  const [title, setTitle] =
    useState("");

  const [
    targetAmount,
    setTargetAmount,
  ] = useState("");

  const [deadline, setDeadline] =
    useState("");

  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [planningMode, setPlanningMode] = useState("none");

  const [
    accountId,
    setAccountId,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(
        initialData.title ||
          initialData.name ||
          ""
      );

      setTargetAmount(
        formatStoredAmount(
          initialData.targetAmount ??
            initialData.target ??
            "",
          settings
        )
      );

      const savedDeadline = initialData.deadline || initialData.date || "";
      const savedMonthly = Number(initialData.monthlyContribution ?? initialData.monthly_contribution) || 0;
      setDeadline(savedDeadline);
      setMonthlyAmount(savedMonthly > 0 ? formatStoredAmount(savedMonthly, settings) : "");
      setPlanningMode(savedMonthly > 0 ? "monthly" : savedDeadline ? "date" : "none");

      setAccountId(
        initialData.accountId ||
          initialData.account_id ||
          ""
      );
    } else {
      setTitle("");
      setTargetAmount("");
      setDeadline("");
      setMonthlyAmount("");
      setPlanningMode("none");
      setAccountId("");
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(false);
  }, [initialData]);

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");

    const cleanTitle =
      title.trim();

    const numericTarget =
      parseAmountInput(
        targetAmount,
        settings
      );

    if (!cleanTitle) {
      setErrorMessage(
        "El nombre del objetivo es obligatorio."
      );

      return;
    }

    if (
      targetAmount === "" ||
      !Number.isFinite(
        numericTarget
      ) ||
      numericTarget <= 0
    ) {
      setErrorMessage(
        "El monto objetivo debe ser mayor a 0."
      );

      return;
    }

    const numericMonthly = planningMode === "monthly"
      ? parseAmountInput(monthlyAmount, settings)
      : null;

    if (planningMode === "date" && !deadline) {
      setErrorMessage("Elegí una fecha límite o seleccioná otra forma de planificación.");
      return;
    }
    if (planningMode === "date" && deadline < getLocalToday()) {
      // El cálculo también avisa fechas vencidas; esta validación evita planes inviables.
      setErrorMessage("La fecha límite no puede estar vencida.");
      return;
    }
    if (planningMode === "monthly" && (
      !monthlyAmount || !Number.isFinite(numericMonthly) || numericMonthly <= 0
    )) {
      setErrorMessage("Ingresá un ahorro mensual mayor a cero.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await onSubmit({
          ...(initialData?.id
            ? {
                id:
                  initialData.id,
              }
            : {}),

          title:
            cleanTitle,

          name:
            cleanTitle,

          targetAmount:
            numericTarget,

          deadline: planningMode === "date" ? deadline : null,

          monthlyContribution: planningMode === "monthly" ? numericMonthly : null,

          accountId:
            accountId || null,
        });

      if (!result?.success) {
        setErrorMessage(
          result?.message ||
            "No se pudo guardar el objetivo."
        );

        return;
      }

      setSuccessMessage(
        initialData
          ? "Objetivo actualizado correctamente."
          : "Objetivo agregado correctamente."
      );

      if (!initialData) {
        setTitle("");
        setTargetAmount("");
        setDeadline("");
        setMonthlyAmount("");
        setPlanningMode("none");
        setAccountId("");
      }
    } catch (error) {
      console.error(
        "No se pudo guardar el objetivo:",
        error
      );

      setErrorMessage(
        "No se pudo guardar el objetivo. Volvé a intentarlo."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const savedAmount =
    accountId && accountBalances?.has(accountId)
      ? Math.max(0, Number(accountBalances.get(accountId)) || 0)
      : Number(
          originalSavedAmount ??
          initialData?.currentAmount ??
          initialData?.savedAmount ??
          initialData?.saved ??
          0
        ) || 0;

  const currentSavedAmount = initialData
    ? formatStoredAmount(savedAmount, settings)
    : "";

  const target = parseAmountInput(targetAmount, settings);
  const plan = planningMode === "date" && deadline
    ? calculateGoalMonthlySavings({ targetAmount: target, currentAmount: savedAmount, deadline })
    : planningMode === "monthly" && monthlyAmount
      ? calculateGoalCompletionDate({
          targetAmount: target,
          currentAmount: savedAmount,
          monthlyAmount: parseAmountInput(monthlyAmount, settings),
        })
      : null;

  return (
    <form
      className={styles.form}
      onSubmit={handleSubmit}
      noValidate
    >
      {errorMessage && (
        <div
          className={`${styles.message} ${styles.errorMessage}`}
          role="alert"
        >
          <i className="bi bi-exclamation-circle"></i>

          <span>
            {errorMessage}
          </span>
        </div>
      )}

      {successMessage && (
        <div
          className={`${styles.message} ${styles.successMessage}`}
          role="status"
        >
          <i className="bi bi-check-circle"></i>

          <span>
            {successMessage}
          </span>
        </div>
      )}

      <div className={styles.group}>
        <label htmlFor="goal-title">
          Nombre del objetivo
        </label>

        <input
          id="goal-title"
          className={styles.input}
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(
              event.target.value
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          placeholder="Ej: Viaje a Bariloche"
          autoComplete="off"
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.group}>
        <label htmlFor="goal-target-amount">
          Monto objetivo
        </label>

        <input
          id="goal-target-amount"
          className={styles.input}
          type="text"
          inputMode="decimal"
          lang={
            settings?.language &&
            settings?.region
              ? `${settings.language}-${settings.region}`
              : "es-AR"
          }
          value={targetAmount}
          onChange={(event) => {
            const nextValue =
              event.target.value;

            setTargetAmount(
              (currentValue) =>
                formatAmountInput(
                  nextValue,
                  currentValue,
                  settings
                )
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          onBlur={() =>
            setTargetAmount(
              (currentValue) =>
                normalizeAmountOnBlur(
                  currentValue,
                  settings
                )
            )
          }
          placeholder="Ej: 500.000,00"
          autoComplete="off"
          disabled={isSubmitting}
        />
      </div>

      {initialData && (
        <div className={styles.group}>
          <label htmlFor="goal-current-amount">
            Monto ahorrado actual
          </label>

          <input
            id="goal-current-amount"
            className={styles.input}
            type="text"
            value={
              currentSavedAmount
            }
            readOnly
            disabled
          />
        </div>
      )}

      <div className={styles.group}>
        <label htmlFor="goal-account">
          Cuenta vinculada{" "}
          <span>(opcional)</span>
        </label>

        <select
          id="goal-account"
          className={styles.input}
          value={accountId}
          onChange={(event) => {
            setAccountId(
              event.target.value
            );

            setErrorMessage("");
            setSuccessMessage("");
          }}
          disabled={isSubmitting}
        >
          <option value="">
            Sin cuenta vinculada
          </option>

          {accounts.map(
            (account) => (
              <option
                key={account.id}
                value={account.id}
              >
                {account.name}
                {account.isActive
                  ? ""
                  : " (inactiva)"}
              </option>
            )
          )}
        </select>

        <small>
          Si vinculás una cuenta,
          el progreso del ahorro se
          calculará automáticamente
          con el saldo de esa cuenta.
        </small>
      </div>

      <fieldset className={styles.planningFieldset} disabled={isSubmitting}>
        <legend>¿Cómo querés planificar el ahorro?</legend>
        <div className={styles.planningOptions}>
          {[
            { value: "none", label: "Sin planificación" },
            { value: "date", label: "Elegir fecha" },
            { value: "monthly", label: "Definir aporte mensual" },
          ].map((option) => (
            <label key={option.value} className={styles.planningOption}>
              <input
                type="radio"
                name="goal-planning"
                value={option.value}
                checked={planningMode === option.value}
                onChange={() => {
                  setPlanningMode(option.value);
                  setDeadline("");
                  setMonthlyAmount("");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {planningMode === "date" && (
        <div className={styles.group}>
          <label htmlFor="goal-deadline">¿Para qué fecha querés alcanzar la meta?</label>
          <input
            id="goal-deadline"
            className={styles.input}
            type="date"
            min={getLocalToday()}
            value={deadline}
            onChange={(event) => {
              setDeadline(event.target.value);
              setErrorMessage("");
            }}
            disabled={isSubmitting}
          />
        </div>
      )}

      {planningMode === "monthly" && (
        <div className={styles.group}>
          <label htmlFor="goal-monthly-amount">¿Cuánto planeás ahorrar por mes?</label>
          <input
            id="goal-monthly-amount"
            className={styles.input}
            type="text"
            inputMode="decimal"
            value={monthlyAmount}
            onChange={(event) => {
              setMonthlyAmount((previous) => formatAmountInput(event.target.value, previous, settings));
              setErrorMessage("");
            }}
            onBlur={() => setMonthlyAmount((previous) => normalizeAmountOnBlur(previous, settings))}
            placeholder="Ej: 5.000,00"
            autoComplete="off"
            disabled={isSubmitting}
          />
        </div>
      )}

      {plan && (
        <div className={styles.monthlyEstimate} role="status" aria-live="polite">
          {plan.status === "completed" ? (
            <span>¡Ya alcanzaste este objetivo!</span>
          ) : plan.status === "expired" ? (
            <span>La fecha límite ya pasó. Elegí otra fecha.</span>
          ) : plan.status === "too_long" ? (
            <span>Con ese aporte mensual el plazo supera los 100 años. Probá con un importe mayor.</span>
          ) : planningMode === "date" ? (
            <>
              <span className={styles.estimateLabel}>Necesitás ahorrar por mes</span>
              <strong>{formatRegionalCurrency(plan.monthlyAmount, settings)}</strong>
              <small>Para completar los {formatRegionalCurrency(plan.remainingAmount, settings)} que faltan en {plan.months} {plan.months === 1 ? "aporte mensual" : "aportes mensuales"}.</small>
            </>
          ) : (
            <>
              <span className={styles.estimateLabel}>Fecha estimada de finalización</span>
              <strong>{formatRegionalDate(plan.completionDate, settings)}</strong>
              <small>Con {formatRegionalCurrency(plan.monthlyAmount, settings)} mensuales durante {plan.months} {plan.months === 1 ? "mes" : "meses"}, comenzando este mes.</small>
            </>
          )}
        </div>
      )}

      <div
        className={styles.actions}
      >
        <button
          className={
            styles.button
          }
          type="submit"
          disabled={
            isSubmitting
          }
        >
          {isSubmitting
            ? initialData
              ? "Guardando cambios..."
              : "Agregando objetivo..."
            : initialData
              ? "Guardar cambios"
              : "Agregar objetivo"}
        </button>
      </div>
    </form>
  );
}

export default GoalForm;