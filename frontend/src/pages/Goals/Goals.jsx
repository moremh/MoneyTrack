import {
  useContext,
  useMemo,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";
import { getLocalToday } from "../../utils/dateUtils";

import Card from "../../components/common/Card/Card";
import Modal from "../../components/common/Modal/Modal";
import GoalForm from "../../components/goals/GoalForm/GoalForm";
import GoalList from "../../components/goals/GoalList/GoalList";

import styles from "./Goals.module.css";

function formatMovementDate(dateValue) {
  const value = String(dateValue || "");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value || "Sin fecha";
  }

  const [year, month, day] =
    value.split("-");

  return `${day}/${month}/${year}`;
}

function formatAmount(amount) {
  const numericAmount =
    Number(amount) || 0;

  const hasDecimals =
    !Number.isInteger(numericAmount);

  return `$ ${numericAmount.toLocaleString(
    "es-AR",
    {
      minimumFractionDigits:
        hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }
  )}`;
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

function Goals() {
  const {
    goals,
    goalMovements = [],
    addGoal,
    deleteGoal,
    updateGoal,
    updateGoalMovement,
    deleteGoalMovement,
    loading,
  } = useContext(FinanceContext);

  const [
    editingGoal,
    setEditingGoal,
  ] = useState(null);

  const [
    deletingGoalId,
    setDeletingGoalId,
  ] = useState(null);

  const [
    goalFilter,
    setGoalFilter,
  ] = useState("");

  const [
    fromDate,
    setFromDate,
  ] = useState("");

  const [
    toDate,
    setToDate,
  ] = useState("");

  const [
    editingGoalMovement,
    setEditingGoalMovement,
  ] = useState(null);

  const [
    editGoalId,
    setEditGoalId,
  ] = useState("");

  const [
    editMovementType,
    setEditMovementType,
  ] = useState("deposit");

  const [
    editAmount,
    setEditAmount,
  ] = useState("");

  const [
    editDescription,
    setEditDescription,
  ] = useState("");

  const [
    editDate,
    setEditDate,
  ] = useState("");

  const [
    editError,
    setEditError,
  ] = useState("");

  const [
    isSavingGoalMovement,
    setIsSavingGoalMovement,
  ] = useState(false);

  const [
    deletingGoalMovementId,
    setDeletingGoalMovementId,
  ] = useState(null);

  const goalNames =
    useMemo(() => {
      return new Map(
        goals.map((goal) => [
          goal.id,
          goal.title ||
            goal.name ||
            "Objetivo",
        ])
      );
    }, [goals]);

  const filteredGoalMovements =
    useMemo(() => {
      return goalMovements
        .filter((movement) => {
          if (
            goalFilter &&
            movement.goalId !==
              goalFilter
          ) {
            return false;
          }

          if (
            fromDate &&
            movement.date < fromDate
          ) {
            return false;
          }

          if (
            toDate &&
            movement.date > toDate
          ) {
            return false;
          }

          return true;
        })
        .slice()
        .sort((a, b) => {
          const dateComparison =
            String(
              b.date || ""
            ).localeCompare(
              String(
                a.date || ""
              )
            );

          if (dateComparison !== 0) {
            return dateComparison;
          }

          return String(
            b.createdAt || ""
          ).localeCompare(
            String(
              a.createdAt || ""
            )
          );
        });
    }, [
      goalMovements,
      goalFilter,
      fromDate,
      toDate,
    ]);

  const handleCreateGoal = async (
    newGoal
  ) => {
    try {
      const result =
        await addGoal(newGoal);

      return (
        result || {
          success: false,
          message:
            "No se pudo crear el objetivo.",
        }
      );
    } catch (error) {
      console.error(
        "No se pudo crear el objetivo:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo crear el objetivo. Volvé a intentarlo.",
      };
    }
  };

  const handleUpdateGoal = async (
    updatedGoal
  ) => {
    if (!editingGoal) {
      return {
        success: false,
        message:
          "No se encontró el objetivo que deseas editar.",
      };
    }

    try {
      const result =
        await updateGoal({
          ...updatedGoal,
          id: editingGoal.id,
        });

      if (!result?.success) {
        return (
          result || {
            success: false,
            message:
              "No se pudo actualizar el objetivo.",
          }
        );
      }

      setEditingGoal(null);

      return result;
    } catch (error) {
      console.error(
        "No se pudo actualizar el objetivo:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo actualizar el objetivo. Volvé a intentarlo.",
      };
    }
  };

  const handleDeleteGoal = async (
    goalId
  ) => {
    const selectedGoal =
      goals.find(
        (goal) =>
          goal.id === goalId
      );

    const goalName =
      selectedGoal?.title ||
      selectedGoal?.name ||
      "este objetivo";

    const confirmed =
      window.confirm(
        `¿Seguro que deseas eliminar "${goalName}"? Esta acción no se puede deshacer.`
      );

    if (!confirmed) {
      return {
        success: false,
        cancelled: true,
      };
    }

    setDeletingGoalId(goalId);

    try {
      const result =
        await deleteGoal(goalId);

      if (!result?.success) {
        window.alert(
          result?.message ||
            "No se pudo eliminar el objetivo."
        );

        return (
          result || {
            success: false,
          }
        );
      }

      if (
        editingGoal?.id === goalId
      ) {
        setEditingGoal(null);
      }

      if (goalFilter === goalId) {
        setGoalFilter("");
      }

      return result;
    } catch (error) {
      console.error(
        "No se pudo eliminar el objetivo:",
        error
      );

      window.alert(
        "No se pudo eliminar el objetivo. Volvé a intentarlo."
      );

      return {
        success: false,
        message:
          "No se pudo eliminar el objetivo.",
      };
    } finally {
      setDeletingGoalId(null);
    }
  };

  const clearHistoryFilters = () => {
    setGoalFilter("");
    setFromDate("");
    setToDate("");
  };

  const openGoalMovementEdit = (
    movement
  ) => {
    setEditingGoalMovement(
      movement
    );

    setEditGoalId(
      movement.goalId || ""
    );

    setEditMovementType(
      movement.type === "withdrawal"
        ? "withdrawal"
        : "deposit"
    );

    setEditAmount(
      formatAmountInput(
        movement.amount
      )
    );

    setEditDescription(
      movement.description || ""
    );

    setEditDate(
      movement.date || ""
    );

    setEditError("");
    setIsSavingGoalMovement(false);
  };

  const closeGoalMovementEdit =
    () => {
      if (isSavingGoalMovement) {
        return;
      }

      setEditingGoalMovement(null);
      setEditError("");
    };

  const handleEditAmountChange = (
    value
  ) => {
    setEditAmount(
      formatAmountInput(value)
    );

    setEditError("");
  };

  const handleUpdateGoalMovement =
    async (event) => {
      event.preventDefault();

      if (
        !editingGoalMovement ||
        isSavingGoalMovement
      ) {
        return;
      }

      setEditError("");

      const numericAmount =
        parseAmountInput(
          editAmount
        );

      if (!editGoalId) {
        setEditError(
          "Seleccioná un objetivo de ahorro."
        );
        return;
      }

      if (
        editMovementType !== "deposit" &&
        editMovementType !==
          "withdrawal"
      ) {
        setEditError(
          "Seleccioná si es un aporte o un retiro."
        );
        return;
      }

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount <= 0
      ) {
        setEditError(
          "El monto debe ser mayor a 0."
        );
        return;
      }

      if (!editDate) {
        setEditError(
          "Seleccioná una fecha."
        );
        return;
      }

      if (
        editDate >
        getLocalToday()
      ) {
        setEditError(
          "La fecha del movimiento no puede ser posterior a hoy."
        );
        return;
      }

      setIsSavingGoalMovement(true);

      try {
        const result =
          await updateGoalMovement({
            id:
              editingGoalMovement.id,
            goalId: editGoalId,
            type:
              editMovementType,
            amount:
              numericAmount,
            description:
              editDescription,
            date: editDate,
          });

        if (!result?.success) {
          setEditError(
            result?.message ||
              "No se pudo actualizar el movimiento de ahorro."
          );
          return;
        }

        setEditingGoalMovement(
          null
        );

        setEditError("");
      } catch (error) {
        console.error(
          "No se pudo actualizar el movimiento de ahorro:",
          error
        );

        setEditError(
          "No se pudo actualizar el movimiento de ahorro. Volvé a intentarlo."
        );
      } finally {
        setIsSavingGoalMovement(
          false
        );
      }
    };

  const handleDeleteGoalMovement =
    async (movement) => {
      if (
        !movement?.id ||
        deletingGoalMovementId
      ) {
        return;
      }

      const movementLabel =
        movement.type ===
        "withdrawal"
          ? "retiro"
          : "aporte";

      const goalName =
        goalNames.get(
          movement.goalId
        ) || "Objetivo";

      const confirmed =
        window.confirm(
          `¿Seguro que deseas eliminar este ${movementLabel} de ${formatAmount(
            movement.amount
          )} del objetivo "${goalName}"? El saldo del objetivo se recalculará automáticamente.`
        );

      if (!confirmed) {
        return;
      }

      setDeletingGoalMovementId(
        movement.id
      );

      try {
        const result =
          await deleteGoalMovement(
            movement.id
          );

        if (!result?.success) {
          window.alert(
            result?.message ||
              "No se pudo eliminar el movimiento de ahorro."
          );

          return;
        }

        if (
          editingGoalMovement?.id ===
          movement.id
        ) {
          setEditingGoalMovement(
            null
          );
        }
      } catch (error) {
        console.error(
          "No se pudo eliminar el movimiento de ahorro:",
          error
        );

        window.alert(
          "No se pudo eliminar el movimiento de ahorro. Volvé a intentarlo."
        );
      } finally {
        setDeletingGoalMovementId(
          null
        );
      }
    };

  const selectedEditGoal =
    goals.find(
      (goal) =>
        goal.id === editGoalId
    ) || null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Objetivos
        </h1>

        <p className={styles.subtitle}>
          Define metas de ahorro y seguí tu
          progreso.
        </p>
      </div>

      <Card title="Nuevo objetivo">
        <GoalForm
          onSubmit={handleCreateGoal}
        />
      </Card>

      <Card title="Lista de objetivos">
        <GoalList
          goals={goals}
          loading={loading}
          deletingGoalId={
            deletingGoalId
          }
          onEdit={setEditingGoal}
          onDelete={
            handleDeleteGoal
          }
        />
      </Card>

      <Card title="Historial de ahorro">
        <div
          className={
            styles.historyFilters
          }
        >
          <div
            className={`${styles.filterGroup} ${styles.goalFilterGroup}`}
          >
            <label htmlFor="goal-history-goal">
              Objetivo
            </label>

            <select
              id="goal-history-goal"
              className={
                styles.filterInput
              }
              value={goalFilter}
              onChange={(event) =>
                setGoalFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Todos los objetivos
              </option>

              {goals.map((goal) => (
                <option
                  key={goal.id}
                  value={goal.id}
                >
                  {goal.title ||
                    goal.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className={
              styles.filterGroup
            }
          >
            <label htmlFor="goal-history-from">
              Desde
            </label>

            <input
              id="goal-history-from"
              className={
                styles.filterInput
              }
              type="date"
              value={fromDate}
              onChange={(event) =>
                setFromDate(
                  event.target.value
                )
              }
            />
          </div>

          <div
            className={
              styles.filterGroup
            }
          >
            <label htmlFor="goal-history-to">
              Hasta
            </label>

            <input
              id="goal-history-to"
              className={
                styles.filterInput
              }
              type="date"
              value={toDate}
              onChange={(event) =>
                setToDate(
                  event.target.value
                )
              }
            />
          </div>

          <button
            type="button"
            className={
              styles.clearFilterButton
            }
            onClick={
              clearHistoryFilters
            }
          >
            Limpiar filtros
          </button>
        </div>

        <p
          className={
            styles.historyResults
          }
        >
          Mostrando{" "}
          {filteredGoalMovements.length}{" "}
          de {goalMovements.length}{" "}
          movimientos de ahorro.
        </p>

        {loading ? (
          <div
            className={
              styles.emptyHistory
            }
          >
            Cargando historial...
          </div>
        ) : filteredGoalMovements.length ===
          0 ? (
          <div
            className={
              styles.emptyHistory
            }
          >
            Todavía no hay movimientos de
            ahorro para mostrar.
          </div>
        ) : (
          <div
            className={
              styles.tableWrapper
            }
          >
            <table
              className={
                styles.historyTable
              }
            >
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Objetivo</th>
                  <th>Movimiento</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                  <th className={styles.actionsHeader}>
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredGoalMovements.map(
                  (movement) => {
                    const isWithdrawal =
                      movement.type ===
                      "withdrawal";

                    const isDeleting =
                      deletingGoalMovementId ===
                      movement.id;

                    return (
                      <tr
                        key={
                          movement.id
                        }
                      >
                        <td>
                          {formatMovementDate(
                            movement.date
                          )}
                        </td>

                        <td>
                          <strong>
                            {goalNames.get(
                              movement.goalId
                            ) ||
                              "Objetivo"}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`${styles.typeBadge} ${
                              isWithdrawal
                                ? styles.withdrawalBadge
                                : styles.depositBadge
                            }`}
                          >
                            <i
                              className={
                                isWithdrawal
                                  ? "bi bi-arrow-up-circle"
                                  : "bi bi-arrow-down-circle"
                              }
                            ></i>

                            {isWithdrawal
                              ? "Retiro"
                              : "Aporte"}
                          </span>
                        </td>

                        <td
                          className={
                            styles.descriptionCell
                          }
                        >
                          {movement.description ||
                            "Sin descripción"}
                        </td>

                        <td
                          className={`${styles.amountCell} ${
                            isWithdrawal
                              ? styles.withdrawalAmount
                              : styles.depositAmount
                          }`}
                        >
                          {isWithdrawal
                            ? "- "
                            : "+ "}
                          {formatAmount(
                            movement.amount
                          )}
                        </td>

                        <td
                          className={
                            styles.actionsCell
                          }
                        >
                          <div
                            className={
                              styles.movementActions
                            }
                          >
                            <button
                              type="button"
                              className={
                                styles.iconButton
                              }
                              onClick={() =>
                                openGoalMovementEdit(
                                  movement
                                )
                              }
                              disabled={
                                isDeleting
                              }
                              title="Editar movimiento"
                              aria-label="Editar movimiento"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>

                            <button
                              type="button"
                              className={`${styles.iconButton} ${styles.deleteMovementButton}`}
                              onClick={() =>
                                handleDeleteGoalMovement(
                                  movement
                                )
                              }
                              disabled={
                                isDeleting
                              }
                              title="Eliminar movimiento"
                              aria-label="Eliminar movimiento"
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
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingGoal && (
        <Modal
          onClose={() =>
            setEditingGoal(null)
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            Editar objetivo
          </h2>

          <GoalForm
            initialData={editingGoal}
            onSubmit={
              handleUpdateGoal
            }
          />
        </Modal>
      )}

      {editingGoalMovement && (
        <Modal
          onClose={
            closeGoalMovementEdit
          }
        >
          <h2
            className={
              styles.modalTitle
            }
          >
            Editar movimiento de ahorro
          </h2>

          <form
            className={
              styles.movementEditForm
            }
            onSubmit={
              handleUpdateGoalMovement
            }
          >
            {editError && (
              <div
                className={
                  styles.editError
                }
                role="alert"
              >
                <i className="bi bi-exclamation-circle"></i>

                <span>
                  {editError}
                </span>
              </div>
            )}

            <div
              className={
                styles.editField
              }
            >
              <label htmlFor="goal-movement-edit-goal">
                Objetivo de ahorro
              </label>

              <select
                id="goal-movement-edit-goal"
                className={
                  styles.editInput
                }
                value={
                  editGoalId
                }
                onChange={(event) => {
                  setEditGoalId(
                    event.target.value
                  );
                  setEditError("");
                }}
                disabled={
                  isSavingGoalMovement
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
                      {goal.title ||
                        goal.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {selectedEditGoal && (
              <div
                className={
                  styles.editGoalInfo
                }
              >
                <span>
                  Ahorrado actualmente
                </span>

                <strong>
                  {formatAmount(
                    selectedEditGoal.currentAmount
                  )}
                </strong>
              </div>
            )}

            <div
              className={
                styles.editField
              }
            >
              <label htmlFor="goal-movement-edit-type">
                Tipo de movimiento
              </label>

              <select
                id="goal-movement-edit-type"
                className={
                  styles.editInput
                }
                value={
                  editMovementType
                }
                onChange={(event) => {
                  setEditMovementType(
                    event.target.value
                  );
                  setEditError("");
                }}
                disabled={
                  isSavingGoalMovement
                }
              >
                <option value="deposit">
                  Aporte
                </option>

                <option value="withdrawal">
                  Retiro
                </option>
              </select>
            </div>

            <div
              className={
                styles.editField
              }
            >
              <label htmlFor="goal-movement-edit-amount">
                Monto
              </label>

              <input
                id="goal-movement-edit-amount"
                className={
                  styles.editInput
                }
                type="text"
                inputMode="decimal"
                value={editAmount}
                onChange={(event) =>
                  handleEditAmountChange(
                    event.target.value
                  )
                }
                placeholder="Ej: 25.000,00"
                disabled={
                  isSavingGoalMovement
                }
                autoComplete="off"
              />
            </div>

            <div
              className={
                styles.editField
              }
            >
              <label htmlFor="goal-movement-edit-description">
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
                id="goal-movement-edit-description"
                className={`${styles.editInput} ${styles.editTextarea}`}
                rows="3"
                value={
                  editDescription
                }
                onChange={(event) => {
                  setEditDescription(
                    event.target.value
                  );
                  setEditError("");
                }}
                placeholder="Ej: Aporte del sueldo"
                disabled={
                  isSavingGoalMovement
                }
              ></textarea>
            </div>

            <div
              className={
                styles.editField
              }
            >
              <label htmlFor="goal-movement-edit-date">
                Fecha
              </label>

              <input
                id="goal-movement-edit-date"
                className={
                  styles.editInput
                }
                type="date"
                value={editDate}
                max={getLocalToday()}
                onChange={(event) => {
                  setEditDate(
                    event.target.value
                  );
                  setEditError("");
                }}
                disabled={
                  isSavingGoalMovement
                }
              />
            </div>

            <div
              className={
                styles.editActions
              }
            >
              <button
                type="button"
                className={
                  styles.cancelEditButton
                }
                onClick={
                  closeGoalMovementEdit
                }
                disabled={
                  isSavingGoalMovement
                }
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={
                  styles.saveEditButton
                }
                disabled={
                  isSavingGoalMovement
                }
              >
                {isSavingGoalMovement
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default Goals;
