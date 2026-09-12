import {
  useContext,
  useMemo,
  useState,
} from "react";

import {
  FinanceContext,
} from "../../context/FinanceContext";

import {
  useReminders,
} from "../../context/ReminderContext";

import {
  getLocalToday,
} from "../../utils/dateUtils";

import styles from "./Reminders.module.css";

const EMPTY_FORM = {
  title: "",
  description: "",
  type: "general",
  reminderDate: "",
  reminderTime: "09:00",
  recurrence: "none",
  recurrenceEndDate: "",
  relatedGoalId: "",
};

const TYPE_LABELS = {
  general: "General",
  payment: "Pago",
  goal: "Objetivo",
  custom: "Personalizado",
};

const TYPE_ICONS = {
  general: "bi bi-bell",
  payment: "bi bi-credit-card",
  goal: "bi bi-bullseye",
  custom: "bi bi-stars",
};

const RECURRENCE_LABELS = {
  none: "No repetir",
  daily: "Todos los días",
  weekly: "Todas las semanas",
  monthly: "Todos los meses",
  yearly: "Todos los años",
};

const STATUS_LABELS = {
  pending: "Pendiente",
  completed: "Realizado",
  cancelled: "Cancelado",
};

const formatDate = (date) => {
  if (!date) return "";

  const [
    year,
    month,
    day,
  ] = String(date)
    .split("-")
    .map(Number);

  if (
    !year ||
    !month ||
    !day
  ) {
    return date;
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  );
};

const getReminderTiming = (
  reminder,
  today
) => {
  if (
    reminder.status !==
    "pending"
  ) {
    return reminder.status;
  }

  if (
    reminder.reminderDate <
    today
  ) {
    return "overdue";
  }

  if (
    reminder.reminderDate ===
    today
  ) {
    return "today";
  }

  return "upcoming";
};

function Reminders() {
  const {
    goals,
  } = useContext(
    FinanceContext
  );

  const {
    reminders,
    overdueReminders,
    dueTodayReminders,
    upcomingReminders,
    loading,

    addReminder,
    updateReminder,
    deleteReminder,

    completeReminder,
    cancelReminder,
    reopenReminder,

    markReminderRead,
    markReminderUnread,
  } = useReminders();

  const today =
    getLocalToday();

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    searchTerm,
    setSearchTerm,
  ] = useState("");

  const [
    formOpen,
    setFormOpen,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({
    ...EMPTY_FORM,
    reminderDate: today,
  });

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    feedback,
    setFeedback,
  ] = useState(null);

  const [
    deleteTarget,
    setDeleteTarget,
  ] = useState(null);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const activeGoals =
    useMemo(
      () =>
        goals.filter(
          (goal) =>
            goal.status !==
            "completed"
        ),
      [
        goals,
      ]
    );

  const filteredReminders =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return reminders.filter(
        (reminder) => {
          const matchesStatus =
            statusFilter ===
            "all"
              ? true
              : reminder.status ===
                statusFilter;

          if (!matchesStatus) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          return [
            reminder.title,
            reminder.description,
            TYPE_LABELS[
              reminder.type
            ],
          ]
            .filter(Boolean)
            .some(
              (value) =>
                String(value)
                  .toLowerCase()
                  .includes(
                    normalizedSearch
                  )
            );
        }
      );
    }, [
      reminders,
      searchTerm,
      statusFilter,
    ]);

  const sortedReminders =
    useMemo(
      () =>
        [...filteredReminders]
          .sort(
            (
              first,
              second
            ) => {
              const statusOrder = {
                pending: 0,
                completed: 1,
                cancelled: 2,
              };

              const firstStatus =
                statusOrder[
                  first.status
                ] ?? 9;

              const secondStatus =
                statusOrder[
                  second.status
                ] ?? 9;

              if (
                firstStatus !==
                secondStatus
              ) {
                return (
                  firstStatus -
                  secondStatus
                );
              }

              const dateCompare =
                String(
                  first.reminderDate
                ).localeCompare(
                  String(
                    second
                      .reminderDate
                  )
                );

              if (
                dateCompare !== 0
              ) {
                return dateCompare;
              }

              return String(
                first.reminderTime
              ).localeCompare(
                String(
                  second
                    .reminderTime
                )
              );
            }
          ),
      [
        filteredReminders,
      ]
    );

  const showFeedback = (
    type,
    message
  ) => {
    setFeedback({
      type,
      message,
    });
  };

  const closeForm = () => {
    if (submitting) {
      return;
    }

    setFormOpen(false);
    setEditingId(null);
  };

  const openCreateForm = () => {
    setEditingId(null);

    setForm({
      ...EMPTY_FORM,
      reminderDate: today,
    });

    setFeedback(null);
    setFormOpen(true);
  };

  const openEditForm = (
    reminder
  ) => {
    setEditingId(
      reminder.id
    );

    setForm({
      title:
        reminder.title || "",

      description:
        reminder.description ||
        "",

      type:
        reminder.type ||
        "general",

      reminderDate:
        reminder.reminderDate ||
        today,

      reminderTime:
        reminder.reminderTime ||
        "09:00",

      recurrence:
        reminder.recurrence ||
        "none",

      recurrenceEndDate:
        reminder
          .recurrenceEndDate ||
        "",

      relatedGoalId:
        reminder
          .relatedGoalId ||
        "",
    });

    setFeedback(null);
    setFormOpen(true);
  };

  const handleFormChange = (
    event
  ) => {
    const {
      name,
      value,
    } = event.target;

    setForm(
      (current) => ({
        ...current,
        [name]: value,

        ...(name ===
          "recurrence" &&
        value === "none"
          ? {
              recurrenceEndDate:
                "",
            }
          : {}),
      })
    );
  };

  const handleSubmit =
    async (event) => {
      event.preventDefault();

      setSubmitting(true);
      setFeedback(null);

      const result =
        editingId
          ? await updateReminder(
              editingId,
              form
            )
          : await addReminder(
              form
            );

      setSubmitting(false);

      if (!result.success) {
        showFeedback(
          "error",
          result.message
        );

        return;
      }

      showFeedback(
        "success",
        result.message
      );

      setFormOpen(false);
      setEditingId(null);
    };

  const handleComplete =
    async (reminderId) => {
      const result =
        await completeReminder(
          reminderId
        );

      showFeedback(
        result.success
          ? "success"
          : "error",
        result.message
      );
    };

  const handleCancel =
    async (reminderId) => {
      const result =
        await cancelReminder(
          reminderId
        );

      showFeedback(
        result.success
          ? "success"
          : "error",
        result.message
      );
    };

  const handleReopen =
    async (reminderId) => {
      const result =
        await reopenReminder(
          reminderId
        );

      showFeedback(
        result.success
          ? "success"
          : "error",
        result.message
      );
    };

  const handleToggleRead =
    async (reminder) => {
      const result =
        reminder.isRead
          ? await markReminderUnread(
              reminder.id
            )
          : await markReminderRead(
              reminder.id
            );

      showFeedback(
        result.success
          ? "success"
          : "error",
        result.message
      );
    };

  const confirmDelete =
    async () => {
      if (!deleteTarget) {
        return;
      }

      setDeleting(true);

      const result =
        await deleteReminder(
          deleteTarget.id
        );

      setDeleting(false);

      if (!result.success) {
        showFeedback(
          "error",
          result.message
        );

        return;
      }

      showFeedback(
        "success",
        result.message
      );

      setDeleteTarget(null);
    };

  return (
    <div
      className={
        styles.page
      }
    >
      <div
        className={
          styles.header
        }
      >
        <div>
          <p
            className={
              styles.eyebrow
            }
          >
            Organización
          </p>

          <h1>
            Recordatorios
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            Organizá pagos,
            objetivos y tareas
            financieras para no
            olvidarte de nada.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={
            openCreateForm
          }
        >
          <i className="bi bi-plus-lg"></i>
          Nuevo recordatorio
        </button>
      </div>

      {feedback && (
        <div
          className={`${styles.feedback} ${
            feedback.type ===
            "success"
              ? styles.feedbackSuccess
              : styles.feedbackError
          }`}
          role="status"
        >
          <i
            className={`bi ${
              feedback.type ===
              "success"
                ? "bi-check-circle"
                : "bi-exclamation-circle"
            }`}
          ></i>

          <span>
            {feedback.message}
          </span>

          <button
            type="button"
            onClick={() =>
              setFeedback(null)
            }
            aria-label="Cerrar mensaje"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      <div
        className={
          styles.stats
        }
      >
        <div
          className={`${styles.statCard} ${styles.statDanger}`}
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-exclamation-circle"></i>
          </div>

          <div>
            <span>
              Vencidos
            </span>

            <strong>
              {
                overdueReminders
                  .length
              }
            </strong>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${styles.statToday}`}
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-clock"></i>
          </div>

          <div>
            <span>
              Para hoy
            </span>

            <strong>
              {
                dueTodayReminders
                  .length
              }
            </strong>
          </div>
        </div>

        <div
          className={`${styles.statCard} ${styles.statUpcoming}`}
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-calendar-event"></i>
          </div>

          <div>
            <span>
              Próximos
            </span>

            <strong>
              {
                upcomingReminders
                  .length
              }
            </strong>
          </div>
        </div>
      </div>

      <section
        className={
          styles.panel
        }
      >
        <div
          className={
            styles.toolbar
          }
        >
          <div
            className={
              styles.searchBox
            }
          >
            <i className="bi bi-search"></i>

            <input
              type="search"
              placeholder="Buscar recordatorios..."
              value={
                searchTerm
              }
              onChange={(
                event
              ) =>
                setSearchTerm(
                  event.target
                    .value
                )
              }
            />
          </div>

          <div
            className={
              styles.filters
            }
            role="group"
            aria-label="Filtrar recordatorios"
          >
            {[
              [
                "all",
                "Todos",
              ],
              [
                "pending",
                "Pendientes",
              ],
              [
                "completed",
                "Realizados",
              ],
              [
                "cancelled",
                "Cancelados",
              ],
            ].map(
              ([
                value,
                label,
              ]) => (
                <button
                  key={value}
                  type="button"
                  className={
                    statusFilter ===
                    value
                      ? styles.filterActive
                      : ""
                  }
                  onClick={() =>
                    setStatusFilter(
                      value
                    )
                  }
                >
                  {label}
                </button>
              )
            )}
          </div>
        </div>

        {loading ? (
          <div
            className={
              styles.emptyState
            }
          >
            <i className="bi bi-arrow-repeat"></i>
            <strong>
              Cargando recordatorios...
            </strong>
          </div>
        ) : sortedReminders
            .length === 0 ? (
          <div
            className={
              styles.emptyState
            }
          >
            <i className="bi bi-bell"></i>

            <strong>
              No hay recordatorios
            </strong>

            <span>
              Creá uno nuevo o cambiá
              los filtros para ver otros
              resultados.
            </span>

            <button
              type="button"
              onClick={
                openCreateForm
              }
            >
              Crear recordatorio
            </button>
          </div>
        ) : (
          <div
            className={
              styles.reminderGrid
            }
          >
            {sortedReminders.map(
              (reminder) => {
                const timing =
                  getReminderTiming(
                    reminder,
                    today
                  );

                const linkedGoal =
                  goals.find(
                    (goal) =>
                      goal.id ===
                      reminder
                        .relatedGoalId
                  );

                return (
                  <article
                    key={
                      reminder.id
                    }
                    className={`${styles.reminderCard} ${
                      !reminder.isRead
                        ? styles.unreadCard
                        : ""
                    }`}
                  >
                    <div
                      className={
                        styles.cardHeader
                      }
                    >
                      <div
                        className={`${styles.typeIcon} ${styles[`type_${reminder.type}`] || ""}`}
                      >
                        <i
                          className={
                            TYPE_ICONS[
                              reminder
                                .type
                            ] ||
                            TYPE_ICONS
                              .general
                          }
                        ></i>
                      </div>

                      <div
                        className={
                          styles.cardTitle
                        }
                      >
                        <div>
                          <span
                            className={
                              styles.typeLabel
                            }
                          >
                            {
                              TYPE_LABELS[
                                reminder
                                  .type
                              ] ||
                              "Recordatorio"
                            }
                          </span>

                          {!reminder.isRead && (
                            <span
                              className={
                                styles.unreadDot
                              }
                              title="Sin leer"
                            ></span>
                          )}
                        </div>

                        <h2>
                          {
                            reminder.title
                          }
                        </h2>
                      </div>

                      <span
                        className={`${styles.statusBadge} ${styles[`status_${timing}`] || ""}`}
                      >
                        {timing ===
                        "overdue"
                          ? "Vencido"
                          : timing ===
                              "today"
                            ? "Hoy"
                            : timing ===
                                "upcoming"
                              ? "Próximo"
                              : STATUS_LABELS[
                                  reminder
                                    .status
                                ] ||
                                reminder
                                  .status}
                      </span>
                    </div>

                    {reminder.description && (
                      <p
                        className={
                          styles.description
                        }
                      >
                        {
                          reminder.description
                        }
                      </p>
                    )}

                    <div
                      className={
                        styles.details
                      }
                    >
                      <span>
                        <i className="bi bi-calendar3"></i>
                        {formatDate(
                          reminder
                            .reminderDate
                        )}
                      </span>

                      <span>
                        <i className="bi bi-clock"></i>
                        {String(
                          reminder
                            .reminderTime ||
                            ""
                        ).slice(
                          0,
                          5
                        )}
                      </span>

                      {reminder.recurrence !==
                        "none" && (
                        <span>
                          <i className="bi bi-arrow-repeat"></i>
                          {
                            RECURRENCE_LABELS[
                              reminder
                                .recurrence
                            ]
                          }
                        </span>
                      )}

                      {linkedGoal && (
                        <span>
                          <i className="bi bi-bullseye"></i>
                          {
                            linkedGoal.name ||
                            linkedGoal.title
                          }
                        </span>
                      )}
                    </div>

                    <div
                      className={
                        styles.cardActions
                      }
                    >
                      {reminder.status ===
                        "pending" && (
                        <>
                          <button
                            type="button"
                            className={
                              styles.completeButton
                            }
                            onClick={() =>
                              void handleComplete(
                                reminder.id
                              )
                            }
                          >
                            <i className="bi bi-check2-circle"></i>
                            Realizado
                          </button>

                          <button
                            type="button"
                            className={
                              styles.secondaryButton
                            }
                            onClick={() =>
                              openEditForm(
                                reminder
                              )
                            }
                          >
                            <i className="bi bi-pencil"></i>
                            Editar
                          </button>

                          <button
                            type="button"
                            className={
                              styles.iconAction
                            }
                            onClick={() =>
                              void handleCancel(
                                reminder.id
                              )
                            }
                            title="Cancelar recordatorio"
                            aria-label="Cancelar recordatorio"
                          >
                            <i className="bi bi-slash-circle"></i>
                          </button>
                        </>
                      )}

                      {reminder.status !==
                        "pending" && (
                        <button
                          type="button"
                          className={
                            styles.secondaryButton
                          }
                          onClick={() =>
                            void handleReopen(
                              reminder.id
                            )
                          }
                        >
                          <i className="bi bi-arrow-counterclockwise"></i>
                          Reactivar
                        </button>
                      )}

                      <button
                        type="button"
                        className={
                          styles.iconAction
                        }
                        onClick={() =>
                          void handleToggleRead(
                            reminder
                          )
                        }
                        title={
                          reminder.isRead
                            ? "Marcar como no leído"
                            : "Marcar como leído"
                        }
                        aria-label={
                          reminder.isRead
                            ? "Marcar como no leído"
                            : "Marcar como leído"
                        }
                      >
                        <i
                          className={`bi ${
                            reminder.isRead
                              ? "bi-envelope"
                              : "bi-envelope-open"
                          }`}
                        ></i>
                      </button>

                      <button
                        type="button"
                        className={`${styles.iconAction} ${styles.deleteButton}`}
                        onClick={() =>
                          setDeleteTarget(
                            reminder
                          )
                        }
                        title="Eliminar recordatorio"
                        aria-label="Eliminar recordatorio"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </section>

      {formOpen && (
        <div
          className={
            styles.modalBackdrop
          }
          role="presentation"
          onMouseDown={(
            event
          ) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeForm();
            }
          }}
        >
          <div
            className={
              styles.modal
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-form-title"
          >
            <div
              className={
                styles.modalHeader
              }
            >
              <div>
                <span>
                  {
                    editingId
                      ? "Editar"
                      : "Nuevo"
                  }
                </span>

                <h2
                  id="reminder-form-title"
                >
                  {
                    editingId
                      ? "Editar recordatorio"
                      : "Crear recordatorio"
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeForm
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <form
              className={
                styles.form
              }
              onSubmit={
                handleSubmit
              }
            >
              <label
                className={
                  styles.fieldFull
                }
              >
                <span>
                  Título
                </span>

                <input
                  name="title"
                  type="text"
                  maxLength="120"
                  value={
                    form.title
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Ej. Pagar internet"
                  required
                />
              </label>

              <label
                className={
                  styles.fieldFull
                }
              >
                <span>
                  Descripción
                </span>

                <textarea
                  name="description"
                  maxLength="1000"
                  rows="3"
                  value={
                    form.description
                  }
                  onChange={
                    handleFormChange
                  }
                  placeholder="Agregá una nota opcional..."
                ></textarea>
              </label>

              <label>
                <span>
                  Tipo
                </span>

                <select
                  name="type"
                  value={
                    form.type
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  <option value="general">
                    General
                  </option>

                  <option value="payment">
                    Pago
                  </option>

                  <option value="goal">
                    Objetivo
                  </option>

                  <option value="custom">
                    Personalizado
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Objetivo relacionado
                </span>

                <select
                  name="relatedGoalId"
                  value={
                    form.relatedGoalId
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  <option value="">
                    Ninguno
                  </option>

                  {activeGoals.map(
                    (goal) => (
                      <option
                        key={
                          goal.id
                        }
                        value={
                          goal.id
                        }
                      >
                        {
                          goal.name ||
                          goal.title
                        }
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Fecha
                </span>

                <input
                  name="reminderDate"
                  type="date"
                  min={
                    editingId
                      ? undefined
                      : today
                  }
                  value={
                    form.reminderDate
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Hora
                </span>

                <input
                  name="reminderTime"
                  type="time"
                  value={
                    form.reminderTime
                  }
                  onChange={
                    handleFormChange
                  }
                  required
                />
              </label>

              <label>
                <span>
                  Repetición
                </span>

                <select
                  name="recurrence"
                  value={
                    form.recurrence
                  }
                  onChange={
                    handleFormChange
                  }
                >
                  {Object.entries(
                    RECURRENCE_LABELS
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <span>
                  Repetir hasta
                </span>

                <input
                  name="recurrenceEndDate"
                  type="date"
                  min={
                    form.reminderDate ||
                    today
                  }
                  value={
                    form.recurrenceEndDate
                  }
                  onChange={
                    handleFormChange
                  }
                  disabled={
                    form.recurrence ===
                    "none"
                  }
                />
              </label>

              <div
                className={
                  styles.formActions
                }
              >
                <button
                  type="button"
                  className={
                    styles.cancelButton
                  }
                  onClick={
                    closeForm
                  }
                  disabled={
                    submitting
                  }
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className={
                    styles.primaryButton
                  }
                  disabled={
                    submitting
                  }
                >
                  {submitting ? (
                    <>
                      <i className="bi bi-arrow-repeat"></i>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-lg"></i>
                      {
                        editingId
                          ? "Guardar cambios"
                          : "Crear recordatorio"
                      }
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className={
            styles.modalBackdrop
          }
          role="presentation"
        >
          <div
            className={
              styles.confirmModal
            }
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-reminder-title"
          >
            <div
              className={
                styles.confirmIcon
              }
            >
              <i className="bi bi-trash"></i>
            </div>

            <h2
              id="delete-reminder-title"
            >
              Eliminar recordatorio
            </h2>

            <p>
              ¿Querés eliminar
              <strong>
                {" "}
                {
                  deleteTarget.title
                }
              </strong>
              ? Esta acción no se
              puede deshacer.
            </p>

            <div
              className={
                styles.confirmActions
              }
            >
              <button
                type="button"
                className={
                  styles.cancelButton
                }
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
                disabled={
                  deleting
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className={
                  styles.dangerButton
                }
                onClick={() =>
                  void confirmDelete()
                }
                disabled={
                  deleting
                }
              >
                <i className="bi bi-trash"></i>

                {deleting
                  ? "Eliminando..."
                  : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Reminders;
