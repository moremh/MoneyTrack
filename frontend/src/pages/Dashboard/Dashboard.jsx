import {
  useContext,
  useMemo,
  useState,
} from "react";

import {
  FinanceContext,
} from "../../context/FinanceContext";

import styles from "./Dashboard.module.css";

import StatCard from "../../components/dashboard/StatCard/StatCard";
import BalanceChart from "../../components/dashboard/BalanceChart/BalanceChart";
import ExpenseCategoriesChart from "../../components/dashboard/ExpenseCategoriesChart/ExpenseCategoriesChart";
import SavingsGoals from "../../components/dashboard/SavingsGoals/SavingsGoals";

import IncomeForm from "../../components/income/IncomeForm/IncomeForm";
import Modal from "../../components/common/Modal/Modal";

import PremiumLimitModal from "../../components/premium/PremiumLimitModal/PremiumLimitModal";

function formatLocalDate(date) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(
  dateString
) {
  return dateString
    .split("-")
    .reverse()
    .join("/");
}

function getToday() {
  return formatLocalDate(
    new Date()
  );
}

function getMonthStart() {
  const date = new Date();

  date.setDate(1);

  return formatLocalDate(date);
}

function getMonthsAgoStart(
  monthsAgo
) {
  const date = new Date();

  date.setDate(1);

  date.setMonth(
    date.getMonth() -
      monthsAgo
  );

  return formatLocalDate(date);
}

function getYearStart() {
  const date = new Date();

  date.setMonth(0);
  date.setDate(1);

  return formatLocalDate(date);
}

function formatAmountInput(value) {
  const cleaned = String(
    value || ""
  ).replace(/[^0-9.,]/g, "");

  if (!cleaned) {
    return "";
  }

  const lastComma =
    cleaned.lastIndexOf(",");
  const lastDot =
    cleaned.lastIndexOf(".");

  let decimalIndex = -1;

  if (lastComma >= 0) {
    decimalIndex = lastComma;
  } else if (lastDot >= 0) {
    const digitsAfterDot =
      cleaned.length -
      lastDot -
      1;

    if (digitsAfterDot <= 2) {
      decimalIndex = lastDot;
    }
  }

  const integerSource =
    decimalIndex >= 0
      ? cleaned.slice(
          0,
          decimalIndex
        )
      : cleaned;

  const integerDigits =
    integerSource.replace(
      /[.,]/g,
      ""
    );

  const formattedInteger =
    (integerDigits || "0").replace(
      /\B(?=(\d{3})+(?!\d))/g,
      "."
    );

  if (decimalIndex < 0) {
    return formattedInteger;
  }

  const decimalDigits =
    cleaned
      .slice(decimalIndex + 1)
      .replace(/[.,]/g, "")
      .slice(0, 2);

  return `${formattedInteger},${decimalDigits}`;
}

function parseAmountInput(value) {
  const normalized = String(
    value || ""
  )
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized);
}

function Dashboard() {
  const {
    incomes,
    expenses,
    goals,
    goalMovements = [],
    settings,
    addIncome,
    addExpense,
    recordGoalMovement,
    movementUsage,
  } = useContext(
    FinanceContext
  );

  const [
    fromDate,
    setFromDate,
  ] = useState("");

  const [
    toDate,
    setToDate,
  ] = useState("");

  const [
    activePreset,
    setActivePreset,
  ] = useState("all");

  const [
    quickMovementType,
    setQuickMovementType,
  ] = useState(null);

  const [
    showSavingsModal,
    setShowSavingsModal,
  ] = useState(false);

  const [
    savingsGoalId,
    setSavingsGoalId,
  ] = useState("");

  const [
    savingsMovementType,
    setSavingsMovementType,
  ] = useState("deposit");

  const [
    savingsAmount,
    setSavingsAmount,
  ] = useState("");

  const [
    savingsDescription,
    setSavingsDescription,
  ] = useState("");

  const [
    savingsDate,
    setSavingsDate,
  ] = useState(() => getToday());

  const [
    savingsError,
    setSavingsError,
  ] = useState("");

  const [
    isSavingMovement,
    setIsSavingMovement,
  ] = useState(false);

  const [
    showPremiumModal,
    setShowPremiumModal,
  ] = useState(false);

  const filteredIncomes =
    useMemo(() => {
      return incomes.filter(
        (item) => {
          if (
            fromDate &&
            item.date < fromDate
          ) {
            return false;
          }

          if (
            toDate &&
            item.date > toDate
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      incomes,
      fromDate,
      toDate,
    ]);

  const filteredExpenses =
    useMemo(() => {
      return expenses.filter(
        (item) => {
          if (
            fromDate &&
            item.date < fromDate
          ) {
            return false;
          }

          if (
            toDate &&
            item.date > toDate
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      expenses,
      fromDate,
      toDate,
    ]);

  const filteredGoalMovements =
    useMemo(() => {
      return goalMovements.filter(
        (item) => {
          if (
            fromDate &&
            item.date < fromDate
          ) {
            return false;
          }

          if (
            toDate &&
            item.date > toDate
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      goalMovements,
      fromDate,
      toDate,
    ]);

  const totalIncome =
    filteredIncomes.reduce(
      (accumulator, item) =>
        accumulator +
        Number(item.amount),
      0
    );

  const totalExpenses =
    filteredExpenses.reduce(
      (accumulator, item) =>
        accumulator +
        Number(item.amount),
      0
    );

  const totalGoalSavings =
    goals.reduce(
      (accumulator, goal) =>
        accumulator +
        Number(
          goal.currentAmount ||
            0
        ),
      0
    );

  const netSavingsMovement =
    filteredGoalMovements.reduce(
      (accumulator, movement) => {
        const amount = Number(
          movement.amount || 0
        );

        return movement.type ===
          "withdrawal"
          ? accumulator - amount
          : accumulator + amount;
      },
      0
    );

  const savingsImpactOnBalance =
    fromDate || toDate
      ? netSavingsMovement
      : totalGoalSavings;

  const balance =
    totalIncome -
    totalExpenses -
    savingsImpactOnBalance;

  const totalMovements =
    filteredIncomes.length +
    filteredExpenses.length +
    filteredGoalMovements.length;

  const movementsLabel =
    fromDate || toDate
      ? "Movimientos del período"
      : "Movimientos totales registrados";

  const periodText =
    useMemo(() => {
      if (
        fromDate &&
        toDate
      ) {
        return `Período seleccionado: ${formatDisplayDate(
          fromDate
        )} - ${formatDisplayDate(
          toDate
        )}`;
      }

      if (fromDate) {
        return `Período desde: ${formatDisplayDate(
          fromDate
        )}`;
      }

      if (toDate) {
        return `Período hasta: ${formatDisplayDate(
          toDate
        )}`;
      }

      return "Mostrando todos los movimientos cargados.";
    }, [
      fromDate,
      toDate,
    ]);

  const applyPreset = (
    preset
  ) => {
    const today =
      getToday();

    if (
      preset === "month"
    ) {
      setFromDate(
        getMonthStart()
      );

      setToDate(today);

      setActivePreset(
        "month"
      );

      return;
    }

    if (
      preset === "quarter"
    ) {
      setFromDate(
        getMonthsAgoStart(2)
      );

      setToDate(today);

      setActivePreset(
        "quarter"
      );

      return;
    }

    if (
      preset === "year"
    ) {
      setFromDate(
        getYearStart()
      );

      setToDate(today);

      setActivePreset(
        "year"
      );

      return;
    }

    setFromDate("");
    setToDate("");

    setActivePreset("all");
  };

  const handleFromDateChange = (
    value
  ) => {
    setFromDate(value);

    setActivePreset(
      "custom"
    );
  };

  const handleToDateChange = (
    value
  ) => {
    setToDate(value);

    setActivePreset(
      "custom"
    );
  };

  const openIncomeForm = () => {
    setQuickMovementType(
      "income"
    );
  };

  const openExpenseForm = () => {
    setQuickMovementType(
      "expense"
    );
  };

  const openSavingsForm = () => {
    setSavingsGoalId(
      goals[0]?.id || ""
    );
    setSavingsMovementType(
      "deposit"
    );
    setSavingsAmount("");
    setSavingsDescription("");
    setSavingsDate(getToday());
    setSavingsError("");
    setIsSavingMovement(false);
    setShowSavingsModal(true);
  };

  const closeSavingsForm = () => {
    if (isSavingMovement) {
      return;
    }

    setShowSavingsModal(false);
    setSavingsError("");
  };

  const closeQuickForm = () => {
    setQuickMovementType(
      null
    );
  };

  const handleQuickAddIncome =
    async (incomeData) => {
      const result =
        await addIncome(
          incomeData
        );

      if (result?.success) {
        closeQuickForm();
      }

      return result;
    };

  const handleQuickAddExpense =
    async (expenseData) => {
      const result =
        await addExpense(
          expenseData
        );

      if (result?.success) {
        closeQuickForm();
      }

      return result;
    };

  const handleSavingsAmountChange =
    (value) => {
      setSavingsAmount(
        formatAmountInput(value)
      );
    };

  const handleSavingsSubmit =
    async (event) => {
      event.preventDefault();

      if (isSavingMovement) {
        return;
      }

      setSavingsError("");

      const numericAmount =
        parseAmountInput(
          savingsAmount
        );

      if (!savingsGoalId) {
        setSavingsError(
          "Seleccionár un objetivo de ahorro."
        );
        return;
      }

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        setSavingsError(
          "El monto debe ser mayor a 0."
        );
        return;
      }

      if (!savingsDate) {
        setSavingsError(
          "Seleccioná una fecha."
        );
        return;
      }

      setIsSavingMovement(true);

      try {
        const result =
          await recordGoalMovement({
            goalId:
              savingsGoalId,
            type:
              savingsMovementType,
            amount:
              numericAmount,
            description:
              savingsDescription,
            date: savingsDate,
          });

        if (!result?.success) {
          setSavingsError(
            result?.message ||
              "No se pudo registrar el movimiento de ahorro."
          );
          return;
        }

        setShowSavingsModal(
          false
        );
        setSavingsError("");
      } finally {
        setIsSavingMovement(
          false
        );
      }
    };

  const selectedSavingsGoal =
    goals.find(
      (goal) =>
        goal.id ===
        savingsGoalId
    ) || null;

  const handleLimitReached =
    () => {
      closeQuickForm();

      setShowPremiumModal(
        true
      );
    };

  const quickFormTitle =
    quickMovementType ===
    "expense"
      ? "Agregar gasto"
      : "Agregar ingreso";

  return (
    <div
      className={
        styles.dashboard
      }
    >
      <div
        className={
          styles.header
        }
      >
        <h1
          className={
            styles.title
          }
        >
          Bienvenido,{" "}
          {settings.userName} 👋
        </h1>

        <p
          className={
            styles.subtitle
          }
        >
          Aquí tienes un resumen
          actualizado de tu
          actividad financiera.
        </p>
      </div>

      <section
        className={
          styles.quickActions
        }
        aria-label="Acciones rápidas"
      >
        <button
          type="button"
          className={`${styles.quickActionButton} ${styles.incomeAction}`}
          onClick={
            openIncomeForm
          }
        >
          <i className="bi bi-plus-circle"></i>

          <span>
            Agregar ingreso
          </span>
        </button>

        <button
          type="button"
          className={`${styles.quickActionButton} ${styles.expenseAction}`}
          onClick={
            openExpenseForm
          }
        >
          <i className="bi bi-plus-circle"></i>

          <span>
            Agregar gasto
          </span>
        </button>

        <button
          type="button"
          className={`${styles.quickActionButton} ${styles.savingsAction}`}
          onClick={
            openSavingsForm
          }
        >
          <i className="bi bi-piggy-bank"></i>

          <span>
            Ahorro
          </span>
        </button>
      </section>

      <section
        className={
          styles.filtersCard
        }
      >
        <div
          className={
            styles.filtersTop
          }
        >
          <div
            className={
              styles.quickFilters
            }
          >
            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset ===
                "all"
                  ? styles.activeFilter
                  : ""
              }`}
              onClick={() =>
                applyPreset(
                  "all"
                )
              }
            >
              Todo
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset ===
                "month"
                  ? styles.activeFilter
                  : ""
              }`}
              onClick={() =>
                applyPreset(
                  "month"
                )
              }
            >
              Este mes
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset ===
                "quarter"
                  ? styles.activeFilter
                  : ""
              }`}
              onClick={() =>
                applyPreset(
                  "quarter"
                )
              }
            >
              Últimos 3 meses
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset ===
                "year"
                  ? styles.activeFilter
                  : ""
              }`}
              onClick={() =>
                applyPreset(
                  "year"
                )
              }
            >
              Este año
            </button>
          </div>

          <div
            className={
              styles.dateFilters
            }
          >
            <div
              className={
                styles.filterGroup
              }
            >
              <label htmlFor="dashboard-from-date">
                Desde
              </label>

              <div
                className={
                  styles.dateControl
                }
              >
                <input
                  id="dashboard-from-date"
                  className={
                    styles.filterInput
                  }
                  type="date"
                  value={
                    fromDate
                  }
                  onChange={(
                    event
                  ) =>
                    handleFromDateChange(
                      event
                        .target
                        .value
                    )
                  }
                />
              </div>
            </div>

            <div
              className={
                styles.filterGroup
              }
            >
              <label htmlFor="dashboard-to-date">
                Hasta
              </label>

              <div
                className={
                  styles.dateControl
                }
              >
                <input
                  id="dashboard-to-date"
                  className={
                    styles.filterInput
                  }
                  type="date"
                  value={toDate}
                  onChange={(
                    event
                  ) =>
                    handleToDateChange(
                      event
                        .target
                        .value
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <p
          className={
            styles.periodText
          }
        >
          {periodText}
        </p>

        <p
          className={
            styles.movementsText
          }
        >
          {movementsLabel}:{" "}
          {totalMovements}
        </p>
      </section>

      <div
        className={
          styles.cardsGrid
        }
      >
        <StatCard
          title="Saldo Total"
          value={`$ ${balance.toLocaleString(
            "es-AR"
          )}`}
          icon="bi bi-wallet2"
          color="#2563eb"
        />

        <StatCard
          title="Ingresos"
          value={`$ ${totalIncome.toLocaleString(
            "es-AR"
          )}`}
          icon="bi bi-arrow-down-circle"
          color="#22c55e"
        />

        <StatCard
          title="Gastos"
          value={`$ ${totalExpenses.toLocaleString(
            "es-AR"
          )}`}
          icon="bi bi-arrow-up-circle"
          color="#ef4444"
        />

        <StatCard
          title="Ahorros"
          value={`$ ${totalGoalSavings.toLocaleString(
            "es-AR"
          )}`}
          icon="bi bi-piggy-bank"
          color="#f59e0b"
        />
      </div>

      <section
        className={
          styles.chartSection
        }
      >
        <h2
          className={
            styles.chartTitle
          }
        >
          Balance mensual
        </h2>

        <BalanceChart
          incomes={
            filteredIncomes
          }
          expenses={
            filteredExpenses
          }
        />
      </section>

      <section
        className={
          styles.chartSection
        }
      >
        <h2
          className={
            styles.chartTitle
          }
        >
          Gastos por categoría
        </h2>

        <ExpenseCategoriesChart
          expenses={
            filteredExpenses
          }
        />
      </section>

      <section
        className={
          styles.chartSection
        }
      >
        <h2
          className={
            styles.chartTitle
          }
        >
          Objetivos de ahorro
        </h2>

        <SavingsGoals
          goals={goals}
        />
      </section>

      {quickMovementType && (
        <Modal
          onClose={
            closeQuickForm
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            {quickFormTitle}
          </h2>

          <IncomeForm
            type={
              quickMovementType
            }
            onAdd={
              quickMovementType ===
              "expense"
                ? handleQuickAddExpense
                : handleQuickAddIncome
            }
            onLimitReached={
              handleLimitReached
            }
          />
        </Modal>
      )}

      {showSavingsModal && (
        <Modal
          onClose={
            closeSavingsForm
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            Registrar ahorro
          </h2>

          {goals.length === 0 ? (
            <div
              className={
                styles.savingsEmptyState
              }
            >
              <i className="bi bi-piggy-bank"></i>

              <p>
                Primero tenés que crear
                un objetivo de ahorro.
              </p>
            </div>
          ) : (
            <form
              className={
                styles.savingsForm
              }
              onSubmit={
                handleSavingsSubmit
              }
            >
              {savingsError && (
                <div
                  className={
                    styles.savingsError
                  }
                  role="alert"
                >
                  <i className="bi bi-exclamation-circle"></i>
                  <span>
                    {savingsError}
                  </span>
                </div>
              )}

              <div
                className={
                  styles.savingsField
                }
              >
                <label htmlFor="dashboard-savings-goal">
                  Objetivo de ahorro
                </label>

                <select
                  id="dashboard-savings-goal"
                  className={
                    styles.savingsInput
                  }
                  value={
                    savingsGoalId
                  }
                  onChange={(event) =>
                    setSavingsGoalId(
                      event.target.value
                    )
                  }
                  disabled={
                    isSavingMovement
                  }
                >
                  <option value="">
                    Seleccioná un objetivo
                  </option>

                  {goals.map(
                    (goal) => (
                      <option
                        key={goal.id}
                        value={goal.id}
                      >
                        {goal.name ||
                          goal.title}
                      </option>
                    )
                  )}
                </select>
              </div>

              {selectedSavingsGoal && (
                <div
                  className={
                    styles.savingsGoalInfo
                  }
                >
                  <span>
                    Ahorrado actualmente
                  </span>
                  <strong>
                    $ {Number(
                      selectedSavingsGoal.currentAmount ||
                        0
                    ).toLocaleString(
                      "es-AR"
                    )}
                  </strong>
                </div>
              )}

              <div
                className={
                  styles.savingsField
                }
              >
                <label htmlFor="dashboard-savings-type">
                  Tipo de movimiento
                </label>

                <select
                  id="dashboard-savings-type"
                  className={
                    styles.savingsInput
                  }
                  value={
                    savingsMovementType
                  }
                  onChange={(event) =>
                    setSavingsMovementType(
                      event.target.value
                    )
                  }
                  disabled={
                    isSavingMovement
                  }
                >
                  <option value="deposit">
                    Agregar ahorro
                  </option>
                  <option value="withdrawal">
                    Retirar ahorro
                  </option>
                </select>
              </div>

              <div
                className={
                  styles.savingsField
                }
              >
                <label htmlFor="dashboard-savings-amount">
                  Monto
                </label>

                <input
                  id="dashboard-savings-amount"
                  className={
                    styles.savingsInput
                  }
                  type="text"
                  inputMode="decimal"
                  value={
                    savingsAmount
                  }
                  onChange={(event) =>
                    handleSavingsAmountChange(
                      event.target.value
                    )
                  }
                  placeholder="Ej: 25.000,00"
                  disabled={
                    isSavingMovement
                  }
                  autoComplete="off"
                />
              </div>

              <div
                className={
                  styles.savingsField
                }
              >
                <label htmlFor="dashboard-savings-description">
                  Descripción
                  <span
                    className={
                      styles.optionalText
                    }
                  >
                    (opcional)
                  </span>
                </label>

                <textarea
                  id="dashboard-savings-description"
                  className={`${styles.savingsInput} ${styles.savingsTextarea}`}
                  rows="3"
                  value={
                    savingsDescription
                  }
                  onChange={(event) =>
                    setSavingsDescription(
                      event.target.value
                    )
                  }
                  placeholder="Ej: Aporte del sueldo"
                  disabled={
                    isSavingMovement
                  }
                ></textarea>
              </div>

              <div
                className={
                  styles.savingsField
                }
              >
                <label htmlFor="dashboard-savings-date">
                  Fecha
                </label>

                <input
                  id="dashboard-savings-date"
                  className={
                    styles.savingsInput
                  }
                  type="date"
                  value={
                    savingsDate
                  }
                  max={getToday()}
                  onChange={(event) =>
                    setSavingsDate(
                      event.target.value
                    )
                  }
                  disabled={
                    isSavingMovement
                  }
                />
              </div>

              <div
                className={
                  styles.savingsActions
                }
              >
                <button
                  type="submit"
                  className={
                    styles.savingsSubmitButton
                  }
                  disabled={
                    isSavingMovement
                  }
                >
                  {isSavingMovement
                    ? "Guardando..."
                    : savingsMovementType ===
                        "withdrawal"
                      ? "Registrar retiro"
                      : "Registrar ahorro"}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {showPremiumModal && (
        <PremiumLimitModal
          usage={
            movementUsage
          }
          onClose={() =>
            setShowPremiumModal(
              false
            )
          }
        />
      )}
    </div>
  );
}

export default Dashboard;