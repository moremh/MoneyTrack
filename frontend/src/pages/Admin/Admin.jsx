import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

import {
  formatCurrency,
} from "../../config/premiumConfig";

import {
  useCommercialCatalog,
} from "../../hooks/useCommercialCatalog";

import CommercialCatalogAdmin from "../../components/admin/CommercialCatalogAdmin/CommercialCatalogAdmin";

import styles from "./Admin.module.css";

const DEFAULT_MONTHLY_LIMIT = 100;

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "No corresponde";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const getRemainingDays = (expirationDate) => {
  if (!expirationDate) {
    return null;
  }

  const expirationTime = new Date(
    expirationDate
  ).getTime();

  if (Number.isNaN(expirationTime)) {
    return null;
  }

  return Math.ceil(
    (expirationTime - Date.now()) /
      (1000 * 60 * 60 * 24)
  );
};

const getUserStatus = (user) => {
  if (user.accountStatus === "blocked") {
    return "blocked";
  }

  if (user.premiumStatus === "expired") {
    return "expired";
  }

  if (
    user.plan === "premium" &&
    user.premiumExpiresAt
  ) {
    const remainingDays = getRemainingDays(
      user.premiumExpiresAt
    );

    if (
      remainingDays !== null &&
      remainingDays >= 0 &&
      remainingDays <= 7
    ) {
      return "expiring";
    }
  }

  return "active";
};

const getStatusLabel = (status) => {
  const labels = {
    active: "Activa",
    blocked: "Bloqueada",
    expired: "Premium vencido",
    expiring: "Próximo a vencer",
  };

  return labels[status] || "Activa";
};

const getPlanLabel = (
  user,
  planMap
) => {
  if (user.plan !== "premium") {
    return (
      planMap?.free?.name ||
      "Gratuito"
    );
  }

  return (
    planMap?.[
      user.billingCycle
    ]?.name ||
    (user.billingCycle === "annual"
      ? "Premium anual"
      : "Premium mensual")
  );
};

function Admin() {
  const {
    users,
    usersLoading,
    refreshUsers,
    activatePremium,
    removePremium,
    toggleAccountStatus,
    changeMonthlyLimit,
    updateAdminNote,
  } = useAuth();

  const {
    planMap,
  } = useCommercialCatalog();

  const [search, setSearch] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("all");

  const [
    selectedUserId,
    setSelectedUserId,
  ] = useState(null);

  const [
    selectedCycle,
    setSelectedCycle,
  ] = useState("monthly");

  const [
    paymentAmount,
    setPaymentAmount,
  ] = useState(0);

  const [
    monthlyLimit,
    setMonthlyLimit,
  ] = useState(
    DEFAULT_MONTHLY_LIMIT
  );

  const [
    adminNote,
    setAdminNote,
  ] = useState("");

  const [
    feedbackMessage,
    setFeedbackMessage,
  ] = useState("");

  const [
    feedbackType,
    setFeedbackType,
  ] = useState("success");

  const [
    activeAction,
    setActiveAction,
  ] = useState("");

  const [
    usageByUser,
    setUsageByUser,
  ] = useState({});

  const [
    usageLoading,
    setUsageLoading,
  ] = useState(true);

  const [
    pageError,
    setPageError,
  ] = useState("");

  const isBusy =
    Boolean(activeAction);

  const clientUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.role === "user"
      ),
    [users]
  );

  const selectedUser =
    clientUsers.find(
      (user) =>
        user.id === selectedUserId
    ) || null;

  const loadMonthlyUsage =
    useCallback(async () => {
      setUsageLoading(true);
      setPageError("");

      try {
        const {
          data,
          error,
        } = await supabase.rpc(
          "admin_get_monthly_movement_usage"
        );

        if (error) {
          throw error;
        }

        const nextUsage =
          (data || []).reduce(
            (result, row) => {
              result[row.user_id] =
                Number(row.used) || 0;

              return result;
            },
            {}
          );

        setUsageByUser(nextUsage);

        return {
          success: true,
          usage: nextUsage,
        };
      } catch (error) {
        console.error(
          "No se pudo cargar el uso mensual:",
          error
        );

        setUsageByUser({});

        setPageError(
          "No se pudo cargar el uso mensual de los usuarios."
        );

        return {
          success: false,
          message:
            "No se pudo cargar el uso mensual.",
        };
      } finally {
        setUsageLoading(false);
      }
    }, []);

  useEffect(() => {
    const loadAdminData = async () => {
      await Promise.all([
        refreshUsers(),
        loadMonthlyUsage(),
      ]);
    };

    void loadAdminData();
  }, [
    loadMonthlyUsage,
    refreshUsers,
  ]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch =
      search
        .trim()
        .toLowerCase();

    return clientUsers.filter(
      (user) => {
        const status =
          getUserStatus(user);

        const userName =
          String(
            user.name || ""
          ).toLowerCase();

        const userEmail =
          String(
            user.email || ""
          ).toLowerCase();

        const matchesSearch =
          !normalizedSearch ||
          userName.includes(
            normalizedSearch
          ) ||
          userEmail.includes(
            normalizedSearch
          );

        let matchesStatus = true;

        if (
          statusFilter === "free"
        ) {
          matchesStatus =
            user.plan === "free" &&
            user.premiumStatus !==
              "expired";
        }

        if (
          statusFilter === "premium"
        ) {
          matchesStatus =
            user.plan === "premium";
        }

        if (
          statusFilter === "expired"
        ) {
          matchesStatus =
            user.premiumStatus ===
            "expired";
        }

        if (
          statusFilter === "expiring"
        ) {
          matchesStatus =
            status === "expiring";
        }

        if (
          statusFilter === "blocked"
        ) {
          matchesStatus =
            user.accountStatus ===
            "blocked";
        }

        return (
          matchesSearch &&
          matchesStatus
        );
      }
    );
  }, [
    clientUsers,
    search,
    statusFilter,
  ]);

  const freeUsers =
    clientUsers.filter(
      (user) =>
        user.plan === "free"
    ).length;

  const premiumUsers =
    clientUsers.filter(
      (user) =>
        user.plan === "premium"
    ).length;

  const blockedUsers =
    clientUsers.filter(
      (user) =>
        user.accountStatus ===
        "blocked"
    ).length;

  const expiringUsers =
    clientUsers.filter(
      (user) =>
        getUserStatus(user) ===
        "expiring"
    ).length;

  const openUserManagement = (
    user
  ) => {
    const initialCycle =
      user.billingCycle === "annual"
        ? "annual"
        : "monthly";

    setSelectedUserId(user.id);

    setSelectedCycle(
      initialCycle
    );

    setPaymentAmount(
      Number(
        planMap?.[
          initialCycle
        ]?.price
      ) || 0
    );

    setMonthlyLimit(
      Number(user.monthlyLimit) ||
        DEFAULT_MONTHLY_LIMIT
    );

    setAdminNote(
      user.adminNote || ""
    );

    setFeedbackMessage("");
    setActiveAction("");
  };

  const closeUserManagement =
    () => {
      if (isBusy) {
        return;
      }

      setSelectedUserId(null);
      setFeedbackMessage("");
      setActiveAction("");
    };

  const showFeedback = (
    message,
    type = "success"
  ) => {
    setFeedbackMessage(
      message ||
        "Operación completada."
    );

    setFeedbackType(type);
  };

  const handleCycleChange = (
    event
  ) => {
    const cycle =
      event.target.value;

    setSelectedCycle(cycle);

    setPaymentAmount(
      Number(
        planMap?.[cycle]?.price
      ) || 0
    );

    setFeedbackMessage("");
  };

  const handleActivatePremium =
    async () => {
      if (
        !selectedUser ||
        isBusy
      ) {
        return;
      }

      const numericAmount =
        Number(paymentAmount);

      if (
        !Number.isFinite(
          numericAmount
        ) ||
        numericAmount < 0
      ) {
        showFeedback(
          "El monto recibido no es válido.",
          "error"
        );

        return;
      }

      const confirmed =
        window.confirm(
          selectedUser.plan ===
            "premium"
            ? `¿Renovar el plan de ${selectedUser.name}?`
            : `¿Activar Premium para ${selectedUser.name}?`
        );

      if (!confirmed) {
        return;
      }

      setActiveAction(
        "activate-premium"
      );

      setFeedbackMessage("");

      try {
        const result =
          await activatePremium(
            selectedUser.id,
            selectedCycle,
            numericAmount,
            adminNote
          );

        showFeedback(
          result?.message,
          result?.success
            ? "success"
            : "error"
        );
      } catch (error) {
        console.error(
          "No se pudo activar Premium:",
          error
        );

        showFeedback(
          "No se pudo activar o renovar Premium.",
          "error"
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleUpdateLimit =
    async () => {
      if (
        !selectedUser ||
        isBusy
      ) {
        return;
      }

      const numericLimit =
        Number(monthlyLimit);

      if (
        !Number.isInteger(
          numericLimit
        ) ||
        numericLimit < 1
      ) {
        showFeedback(
          "El límite debe ser un número entero mayor a 0.",
          "error"
        );

        return;
      }

      setActiveAction(
        "update-limit"
      );

      setFeedbackMessage("");

      try {
        const result =
          await changeMonthlyLimit(
            selectedUser.id,
            numericLimit
          );

        showFeedback(
          result?.message,
          result?.success
            ? "success"
            : "error"
        );
      } catch (error) {
        console.error(
          "No se pudo actualizar el límite:",
          error
        );

        showFeedback(
          "No se pudo actualizar el límite mensual.",
          "error"
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleSaveNote =
    async () => {
      if (
        !selectedUser ||
        isBusy
      ) {
        return;
      }

      const cleanNote =
        adminNote.trim();

      if (!cleanNote) {
        showFeedback(
          "La nota administrativa no puede estar vacía.",
          "error"
        );

        return;
      }

      setActiveAction(
        "save-note"
      );

      setFeedbackMessage("");

      try {
        const result =
          await updateAdminNote(
            selectedUser.id,
            cleanNote
          );

        showFeedback(
          result?.message,
          result?.success
            ? "success"
            : "error"
        );
      } catch (error) {
        console.error(
          "No se pudo guardar la nota:",
          error
        );

        showFeedback(
          "No se pudo guardar la nota administrativa.",
          "error"
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleRemovePremium =
    async () => {
      if (
        !selectedUser ||
        isBusy
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `¿Quitar el plan Premium de ${selectedUser.name}?`
        );

      if (!confirmed) {
        return;
      }

      setActiveAction(
        "remove-premium"
      );

      setFeedbackMessage("");

      try {
        const result =
          await removePremium(
            selectedUser.id
          );

        showFeedback(
          result?.message,
          result?.success
            ? "success"
            : "error"
        );
      } catch (error) {
        console.error(
          "No se pudo quitar Premium:",
          error
        );

        showFeedback(
          "No se pudo quitar el plan Premium.",
          "error"
        );
      } finally {
        setActiveAction("");
      }
    };

  const handleToggleAccount =
    async () => {
      if (
        !selectedUser ||
        isBusy
      ) {
        return;
      }

      const action =
        selectedUser.accountStatus ===
        "blocked"
          ? "habilitar"
          : "bloquear";

      const confirmed =
        window.confirm(
          `¿${action} la cuenta de ${selectedUser.name}?`
        );

      if (!confirmed) {
        return;
      }

      setActiveAction(
        "toggle-account"
      );

      setFeedbackMessage("");

      try {
        const result =
          await toggleAccountStatus(
            selectedUser.id
          );

        showFeedback(
          result?.message,
          result?.success
            ? "success"
            : "error"
        );
      } catch (error) {
        console.error(
          "No se pudo cambiar el estado de la cuenta:",
          error
        );

        showFeedback(
          "No se pudo cambiar el estado de la cuenta.",
          "error"
        );
      } finally {
        setActiveAction("");
      }
    };

  return (
    <section className={styles.page}>
      <header
        className={styles.pageHeader}
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            MoneyTrack
          </span>

          <h1>
            Panel administrativo
          </h1>

          <p>
            Administrá usuarios,
            suscripciones y pagos.
          </p>
        </div>

        <div
          className={
            styles.adminBadge
          }
        >
          <i className="bi bi-shield-check"></i>
          Administradora
        </div>
      </header>

      {pageError && (
        <div
          className={
            styles.errorMessage
          }
          role="alert"
        >
          <i className="bi bi-exclamation-circle"></i>
          {pageError}
        </div>
      )}

      <div
        className={
          styles.statsGrid
        }
      >
        <article
          className={
            styles.statCard
          }
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-people"></i>
          </div>

          <div>
            <span>
              Usuarios registrados
            </span>

            <strong>
              {clientUsers.length}
            </strong>
          </div>
        </article>

        <article
          className={
            styles.statCard
          }
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-person"></i>
          </div>

          <div>
            <span>
              Plan gratuito
            </span>

            <strong>
              {freeUsers}
            </strong>
          </div>
        </article>

        <article
          className={
            styles.statCard
          }
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-gem"></i>
          </div>

          <div>
            <span>Premium</span>

            <strong>
              {premiumUsers}
            </strong>
          </div>
        </article>

        <article
          className={
            styles.statCard
          }
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-clock-history"></i>
          </div>

          <div>
            <span>
              Próximos a vencer
            </span>

            <strong>
              {expiringUsers}
            </strong>
          </div>
        </article>

        <article
          className={
            styles.statCard
          }
        >
          <div
            className={
              styles.statIcon
            }
          >
            <i className="bi bi-person-lock"></i>
          </div>

          <div>
            <span>Bloqueados</span>

            <strong>
              {blockedUsers}
            </strong>
          </div>
        </article>
      </div>

      <CommercialCatalogAdmin />

      <article className={styles.panel}>
        <div
          className={
            styles.panelHeader
          }
        >
          <div>
            <h2>Usuarios</h2>

            <p>
              Consultá y administrá cada
              cuenta registrada.
            </p>
          </div>

          <div
            className={
              styles.filters
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
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Buscar usuario..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
            >
              <option value="all">
                Todos
              </option>

              <option value="free">
                Gratuitos
              </option>

              <option value="premium">
                Premium
              </option>

              <option value="expiring">
                Próximos a vencer
              </option>

              <option value="expired">
                Premium vencidos
              </option>

              <option value="blocked">
                Bloqueados
              </option>
            </select>
          </div>
        </div>

        <div
          className={
            styles.tableContainer
          }
        >
          <table
            className={styles.table}
          >
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Plan</th>
                <th>Uso mensual</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usersLoading &&
              clientUsers.length ===
                0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className={
                      styles.emptyState
                    }
                  >
                    Cargando usuarios...
                  </td>
                </tr>
              ) : (
                filteredUsers.map(
                  (user) => {
                    const status =
                      getUserStatus(
                        user
                      );

                    const monthlyUsage =
                      Number(
                        usageByUser[
                          user.id
                        ]
                      ) || 0;

                    const monthlyLimitValue =
                      Number(
                        user.monthlyLimit
                      ) ||
                      DEFAULT_MONTHLY_LIMIT;

                    const usagePercentage =
                      Math.min(
                        Math.round(
                          (
                            monthlyUsage /
                            monthlyLimitValue
                          ) * 100
                        ),
                        100
                      );

                    const userInitial =
                      String(
                        user.name ||
                          "U"
                      )
                        .charAt(0)
                        .toUpperCase();

                    return (
                      <tr key={user.id}>
                        <td>
                          <div
                            className={
                              styles.userCell
                            }
                          >
                            <div
                              className={
                                styles.avatar
                              }
                            >
                              {
                                userInitial
                              }
                            </div>

                            <div>
                              <strong>
                                {user.name}
                              </strong>

                              <span>
                                {user.email}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`${styles.planBadge} ${
                              user.plan ===
                              "premium"
                                ? styles.premiumBadge
                                : styles.freeBadge
                            }`}
                          >
                            {getPlanLabel(
                              user,
                              planMap
                            )}
                          </span>
                        </td>

                        <td>
                          <div
                            className={
                              styles.usageCell
                            }
                          >
                            <strong>
                              {usageLoading
                                ? "Cargando..."
                                : user.plan ===
                                    "premium"
                                  ? `${monthlyUsage} · Ilimitado`
                                  : `${monthlyUsage}/${monthlyLimitValue}`}
                            </strong>

                            {!usageLoading &&
                              user.plan !==
                                "premium" && (
                                <div
                                  className={
                                    styles.usageTrack
                                  }
                                >
                                  <div
                                    className={
                                      styles.usageBar
                                    }
                                    style={{
                                      width: `${usagePercentage}%`,
                                    }}
                                  ></div>
                                </div>
                              )}
                          </div>
                        </td>

                        <td>
                          {user.plan ===
                          "premium"
                            ? formatDate(
                                user.premiumExpiresAt
                              )
                            : "No corresponde"}
                        </td>

                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              status ===
                              "blocked"
                                ? styles.blockedStatus
                                : status ===
                                    "expired"
                                  ? styles.expiredStatus
                                  : status ===
                                      "expiring"
                                    ? styles.expiringStatus
                                    : styles.activeStatus
                            }`}
                          >
                            {getStatusLabel(
                              status
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            type="button"
                            className={
                              styles.manageButton
                            }
                            onClick={() =>
                              openUserManagement(
                                user
                              )
                            }
                          >
                            <i className="bi bi-sliders"></i>
                            Gestionar
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )
              )}

              {!usersLoading &&
                filteredUsers.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className={
                        styles.emptyState
                      }
                    >
                      No se encontraron
                      usuarios.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </article>

      {selectedUser && (
        <div
          className={styles.overlay}
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !isBusy
            ) {
              closeUserManagement();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-busy={isBusy}
          >
            <button
              type="button"
              className={
                styles.closeButton
              }
              onClick={
                closeUserManagement
              }
              aria-label="Cerrar"
              disabled={isBusy}
            >
              <i className="bi bi-x-lg"></i>
            </button>

            <header
              className={
                styles.modalHeader
              }
            >
              <span
                className={
                  styles.eyebrow
                }
              >
                Gestión de usuario
              </span>

              <h2>
                {selectedUser.name}
              </h2>

              <p>
                {selectedUser.email}
              </p>
            </header>

            <div
              className={
                styles.userSummary
              }
            >
              <div>
                <span>Plan actual</span>

                <strong>
                  {getPlanLabel(
                    selectedUser,
                    planMap
                  )}
                </strong>
              </div>

              <div>
                <span>Uso del mes</span>

                <strong>
                  {usageLoading
                    ? "Cargando..."
                    : `${
                        usageByUser[
                          selectedUser.id
                        ] || 0
                      }${
                        selectedUser.plan !==
                        "premium"
                          ? `/${
                              selectedUser.monthlyLimit ||
                              DEFAULT_MONTHLY_LIMIT
                            }`
                          : " · Ilimitado"
                      }`}
                </strong>
              </div>

              <div>
                <span>Vencimiento</span>

                <strong>
                  {selectedUser.plan ===
                  "premium"
                    ? formatDate(
                        selectedUser.premiumExpiresAt
                      )
                    : "No corresponde"}
                </strong>
              </div>

              <div>
                <span>
                  Último pago
                </span>

                <strong>
                  {selectedUser.lastPaymentAt
                    ? formatCurrency(
                        selectedUser.lastPaymentAmount
                      )
                    : "Sin pagos"}
                </strong>
              </div>
            </div>

            <div
              className={
                styles.modalGrid
              }
            >
              <div
                className={
                  styles.field
                }
              >
                <label htmlFor="admin-plan">
                  Plan a activar
                </label>

                <select
                  id="admin-plan"
                  value={selectedCycle}
                  onChange={
                    handleCycleChange
                  }
                  disabled={isBusy}
                >
                  <option value="monthly">
                    {planMap?.monthly?.name ||
                      "Premium mensual"}
                  </option>

                  <option value="annual">
                    {planMap?.annual?.name ||
                      "Premium anual"}
                  </option>
                </select>
              </div>

              <div
                className={
                  styles.field
                }
              >
                <label htmlFor="admin-amount">
                  Monto recibido
                </label>

                <input
                  id="admin-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(
                      event.target.value
                    )
                  }
                  disabled={isBusy}
                />
              </div>

              <div
                className={
                  styles.field
                }
              >
                <label htmlFor="admin-limit">
                  Límite gratuito
                </label>

                <input
                  id="admin-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={monthlyLimit}
                  onChange={(event) =>
                    setMonthlyLimit(
                      event.target.value
                    )
                  }
                  disabled={isBusy}
                />

                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={() =>
                    void handleUpdateLimit()
                  }
                  disabled={isBusy}
                >
                  {activeAction ===
                  "update-limit"
                    ? "Guardando..."
                    : "Guardar límite"}
                </button>
              </div>

              <div
                className={`${styles.field} ${styles.fieldFull}`}
              >
                <label htmlFor="admin-note">
                  Nota administrativa
                </label>

                <textarea
                  id="admin-note"
                  rows="3"
                  value={adminNote}
                  onChange={(event) =>
                    setAdminNote(
                      event.target.value
                    )
                  }
                  placeholder="Ej: Comprobante recibido por WhatsApp."
                  disabled={isBusy}
                ></textarea>

                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={() =>
                    void handleSaveNote()
                  }
                  disabled={isBusy}
                >
                  {activeAction ===
                  "save-note"
                    ? "Guardando..."
                    : "Guardar nota"}
                </button>
              </div>
            </div>

            {feedbackMessage && (
              <div
                className={
                  feedbackType ===
                  "success"
                    ? styles.successMessage
                    : styles.errorMessage
                }
                role={
                  feedbackType ===
                  "success"
                    ? "status"
                    : "alert"
                }
              >
                <i
                  className={
                    feedbackType ===
                    "success"
                      ? "bi bi-check-circle"
                      : "bi bi-exclamation-circle"
                  }
                ></i>

                {feedbackMessage}
              </div>
            )}

            <div
              className={
                styles.mainActions
              }
            >
              <button
                type="button"
                className={
                  styles.primaryButton
                }
                onClick={() =>
                  void handleActivatePremium()
                }
                disabled={isBusy}
              >
                <i className="bi bi-gem"></i>

                {activeAction ===
                "activate-premium"
                  ? "Procesando..."
                  : selectedUser.plan ===
                      "premium"
                    ? "Renovar Premium"
                    : "Activar Premium"}
              </button>

              {selectedUser.plan ===
                "premium" && (
                <button
                  type="button"
                  className={
                    styles.dangerButton
                  }
                  onClick={() =>
                    void handleRemovePremium()
                  }
                  disabled={isBusy}
                >
                  {activeAction ===
                  "remove-premium"
                    ? "Quitando..."
                    : "Quitar Premium"}
                </button>
              )}

              <button
                type="button"
                className={
                  selectedUser.accountStatus ===
                  "blocked"
                    ? styles.secondaryButton
                    : styles.warningButton
                }
                onClick={() =>
                  void handleToggleAccount()
                }
                disabled={isBusy}
              >
                {activeAction ===
                "toggle-account"
                  ? "Procesando..."
                  : selectedUser.accountStatus ===
                      "blocked"
                    ? "Habilitar cuenta"
                    : "Bloquear cuenta"}
              </button>
            </div>

            <div
              className={
                styles.history
              }
            >
              <h3>
                Historial de pagos
              </h3>

              {selectedUser
                .paymentHistory
                ?.length > 0 ? (
                selectedUser.paymentHistory
                  .slice(0, 5)
                  .map((payment) => (
                    <article
                      key={payment.id}
                      className={
                        styles.historyItem
                      }
                    >
                      <div>
                        <strong>
                          {planMap?.[
                            payment.planType
                          ]?.name ||
                            (payment.planType ===
                            "annual"
                              ? "Premium anual"
                              : "Premium mensual")}
                        </strong>

                        <span>
                          Pagado el{" "}
                          {formatDate(
                            payment.paymentDate
                          )}
                        </span>
                      </div>

                      <div>
                        <strong>
                          {formatCurrency(
                            payment.amount
                          )}
                        </strong>

                        <span>
                          Vence el{" "}
                          {formatDate(
                            payment.periodEndAt
                          )}
                        </span>
                      </div>
                    </article>
                  ))
              ) : (
                <p
                  className={
                    styles.noHistory
                  }
                >
                  Todavía no hay pagos
                  registrados.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default Admin;