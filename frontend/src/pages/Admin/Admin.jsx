import {
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../context/AuthContext";

import {
  PREMIUM_PLANS,
  formatCurrency,
} from "../../config/premiumConfig";

import styles from "./Admin.module.css";

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

const parseStorageArray = (key) => {
  try {
    const value = JSON.parse(
      localStorage.getItem(key) || "[]"
    );

    return Array.isArray(value) ? value : [];
  } catch (error) {
    return [];
  }
};

const getMovementDate = (movement) => {
  const dateValue =
    movement?.createdAt ||
    movement?.date ||
    movement?.movementDate;

  if (!dateValue) {
    return null;
  }

  if (
    typeof dateValue === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
  ) {
    const [year, month, day] = dateValue
      .split("-")
      .map(Number);

    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(dateValue);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate;
};

const isCurrentMonthMovement = (movement) => {
  const movementDate = getMovementDate(movement);

  if (!movementDate) {
    return false;
  }

  const now = new Date();

  return (
    movementDate.getFullYear() === now.getFullYear() &&
    movementDate.getMonth() === now.getMonth()
  );
};

const getMonthlyMovementCount = (userId) => {
  const incomes = parseStorageArray(
    `moneytrack_${userId}_incomes`
  );

  const expenses = parseStorageArray(
    `moneytrack_${userId}_expenses`
  );

  return (
    incomes.filter(isCurrentMonthMovement).length +
    expenses.filter(isCurrentMonthMovement).length
  );
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

function Admin() {
  const {
    users,
    activatePremium,
    removePremium,
    toggleAccountStatus,
    changeMonthlyLimit,
    updateAdminNote,
  } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedCycle, setSelectedCycle] =
    useState("monthly");
  const [paymentAmount, setPaymentAmount] = useState(
    PREMIUM_PLANS.monthly.price
  );
  const [monthlyLimit, setMonthlyLimit] = useState(100);
  const [adminNote, setAdminNote] = useState("");
  const [feedbackMessage, setFeedbackMessage] =
    useState("");
  const [feedbackType, setFeedbackType] =
    useState("success");

  const clientUsers = useMemo(
    () =>
      users.filter(
        (user) => user.role === "user"
      ),
    [users]
  );

  const usageByUser = useMemo(() => {
    return clientUsers.reduce((result, user) => {
      result[user.id] = getMonthlyMovementCount(user.id);
      return result;
    }, {});
  }, [clientUsers]);

  const selectedUser =
    clientUsers.find(
      (user) => user.id === selectedUserId
    ) || null;

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return clientUsers.filter((user) => {
      const status = getUserStatus(user);

      const matchesSearch =
        !normalizedSearch ||
        user.name
          .toLowerCase()
          .includes(normalizedSearch) ||
        user.email
          .toLowerCase()
          .includes(normalizedSearch);

      let matchesStatus = true;

      if (statusFilter === "free") {
        matchesStatus =
          user.plan === "free" &&
          user.premiumStatus !== "expired";
      }

      if (statusFilter === "premium") {
        matchesStatus = user.plan === "premium";
      }

      if (statusFilter === "expired") {
        matchesStatus =
          user.premiumStatus === "expired";
      }

      if (statusFilter === "expiring") {
        matchesStatus = status === "expiring";
      }

      if (statusFilter === "blocked") {
        matchesStatus =
          user.accountStatus === "blocked";
      }

      return matchesSearch && matchesStatus;
    });
  }, [clientUsers, search, statusFilter]);

  const freeUsers = clientUsers.filter(
    (user) => user.plan === "free"
  ).length;

  const premiumUsers = clientUsers.filter(
    (user) => user.plan === "premium"
  ).length;

  const blockedUsers = clientUsers.filter(
    (user) => user.accountStatus === "blocked"
  ).length;

  const expiringUsers = clientUsers.filter(
    (user) => getUserStatus(user) === "expiring"
  ).length;

  const openUserManagement = (user) => {
    const initialCycle =
      user.billingCycle === "annual"
        ? "annual"
        : "monthly";

    setSelectedUserId(user.id);
    setSelectedCycle(initialCycle);
    setPaymentAmount(
      PREMIUM_PLANS[initialCycle].price
    );
    setMonthlyLimit(
      Number(user.monthlyLimit) || 100
    );
    setAdminNote(user.adminNote || "");
    setFeedbackMessage("");
  };

  const closeUserManagement = () => {
    setSelectedUserId(null);
    setFeedbackMessage("");
  };

  const showFeedback = (
    message,
    type = "success"
  ) => {
    setFeedbackMessage(message);
    setFeedbackType(type);
  };

  const handleCycleChange = (event) => {
    const cycle = event.target.value;

    setSelectedCycle(cycle);
    setPaymentAmount(
      PREMIUM_PLANS[cycle].price
    );
    setFeedbackMessage("");
  };

  const handleActivatePremium = () => {
    if (!selectedUser) {
      return;
    }

    const confirmed = window.confirm(
      selectedUser.plan === "premium"
        ? `¿Renovar el plan de ${selectedUser.name}?`
        : `¿Activar Premium para ${selectedUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    const result = activatePremium(
      selectedUser.id,
      selectedCycle,
      paymentAmount,
      adminNote
    );

    showFeedback(
      result.message,
      result.success ? "success" : "error"
    );
  };

  const handleUpdateLimit = () => {
    if (!selectedUser) {
      return;
    }

    const result = changeMonthlyLimit(
      selectedUser.id,
      monthlyLimit
    );

    showFeedback(
      result.message,
      result.success ? "success" : "error"
    );
  };

  const handleSaveNote = () => {
    if (!selectedUser) {
      return;
    }

    const result = updateAdminNote(
      selectedUser.id,
      adminNote
    );

    showFeedback(
      result.message,
      result.success ? "success" : "error"
    );
  };

  const handleRemovePremium = () => {
    if (!selectedUser) {
      return;
    }

    const confirmed = window.confirm(
      `¿Quitar el plan Premium de ${selectedUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    const result = removePremium(selectedUser.id);

    showFeedback(
      result.message,
      result.success ? "success" : "error"
    );
  };

  const handleToggleAccount = () => {
    if (!selectedUser) {
      return;
    }

    const action =
      selectedUser.accountStatus === "blocked"
        ? "habilitar"
        : "bloquear";

    const confirmed = window.confirm(
      `¿${action} la cuenta de ${selectedUser.name}?`
    );

    if (!confirmed) {
      return;
    }

    const result = toggleAccountStatus(
      selectedUser.id
    );

    showFeedback(
      result.message,
      result.success ? "success" : "error"
    );
  };

  return (
    <section className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>
            MoneyTrack
          </span>

          <h1>Panel administrativo</h1>

          <p>
            Administrá usuarios, suscripciones y pagos.
          </p>
        </div>

        <div className={styles.adminBadge}>
          <i className="bi bi-shield-check"></i>
          Administradora
        </div>
      </header>

      <div className={styles.statsGrid}>
        <article className={styles.statCard}>
          <div className={styles.statIcon}>
            <i className="bi bi-people"></i>
          </div>

          <div>
            <span>Usuarios registrados</span>
            <strong>{clientUsers.length}</strong>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statIcon}>
            <i className="bi bi-person"></i>
          </div>

          <div>
            <span>Plan gratuito</span>
            <strong>{freeUsers}</strong>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statIcon}>
            <i className="bi bi-gem"></i>
          </div>

          <div>
            <span>Premium</span>
            <strong>{premiumUsers}</strong>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statIcon}>
            <i className="bi bi-clock-history"></i>
          </div>

          <div>
            <span>Próximos a vencer</span>
            <strong>{expiringUsers}</strong>
          </div>
        </article>

        <article className={styles.statCard}>
          <div className={styles.statIcon}>
            <i className="bi bi-person-lock"></i>
          </div>

          <div>
            <span>Bloqueados</span>
            <strong>{blockedUsers}</strong>
          </div>
        </article>
      </div>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>Usuarios</h2>

            <p>
              Consultá y administrá cada cuenta registrada.
            </p>
          </div>

          <div className={styles.filters}>
            <div className={styles.searchBox}>
              <i className="bi bi-search"></i>

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar usuario..."
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">Todos</option>
              <option value="free">Gratuitos</option>
              <option value="premium">Premium</option>
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

        <div className={styles.tableContainer}>
          <table className={styles.table}>
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
              {filteredUsers.map((user) => {
                const status = getUserStatus(user);
                const monthlyUsage =
                  usageByUser[user.id] || 0;
                const monthlyLimitValue =
                  Number(user.monthlyLimit) || 100;

                const usagePercentage = Math.min(
                  Math.round(
                    (monthlyUsage /
                      monthlyLimitValue) *
                      100
                  ),
                  100
                );

                return (
                  <tr key={user.id}>
                    <td>
                      <div className={styles.userCell}>
                        <div className={styles.avatar}>
                          {user.name
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`${styles.planBadge} ${
                          user.plan === "premium"
                            ? styles.premiumBadge
                            : styles.freeBadge
                        }`}
                      >
                        {user.plan === "premium"
                          ? user.billingCycle === "annual"
                            ? "Premium anual"
                            : "Premium mensual"
                          : "Gratuito"}
                      </span>
                    </td>

                    <td>
                      <div className={styles.usageCell}>
                        <strong>
                          {user.plan === "premium"
                            ? `${monthlyUsage} · Ilimitado`
                            : `${monthlyUsage}/${monthlyLimitValue}`}
                        </strong>

                        {user.plan !== "premium" && (
                          <div className={styles.usageTrack}>
                            <div
                              className={styles.usageBar}
                              style={{
                                width: `${usagePercentage}%`,
                              }}
                            ></div>
                          </div>
                        )}
                      </div>
                    </td>

                    <td>
                      {user.plan === "premium"
                        ? formatDate(
                            user.premiumExpiresAt
                          )
                        : "No corresponde"}
                    </td>

                    <td>
                      <span
                        className={`${styles.statusBadge} ${
                          status === "blocked"
                            ? styles.blockedStatus
                            : status === "expired"
                              ? styles.expiredStatus
                              : status === "expiring"
                                ? styles.expiringStatus
                                : styles.activeStatus
                        }`}
                      >
                        {getStatusLabel(status)}
                      </span>
                    </td>

                    <td>
                      <button
                        type="button"
                        className={styles.manageButton}
                        onClick={() =>
                          openUserManagement(user)
                        }
                      >
                        <i className="bi bi-sliders"></i>
                        Gestionar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan="6"
                    className={styles.emptyState}
                  >
                    No se encontraron usuarios.
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
            if (event.target === event.currentTarget) {
              closeUserManagement();
            }
          }}
        >
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className={styles.closeButton}
              onClick={closeUserManagement}
              aria-label="Cerrar"
            >
              <i className="bi bi-x-lg"></i>
            </button>

            <header className={styles.modalHeader}>
              <span className={styles.eyebrow}>
                Gestión de usuario
              </span>

              <h2>{selectedUser.name}</h2>
              <p>{selectedUser.email}</p>
            </header>

            <div className={styles.userSummary}>
              <div>
                <span>Plan actual</span>

                <strong>
                  {selectedUser.plan === "premium"
                    ? selectedUser.billingCycle === "annual"
                      ? "Premium anual"
                      : "Premium mensual"
                    : "Gratuito"}
                </strong>
              </div>

              <div>
                <span>Uso del mes</span>

                <strong>
                  {usageByUser[selectedUser.id] || 0}
                  {selectedUser.plan !== "premium" &&
                    `/${selectedUser.monthlyLimit || 100}`}
                </strong>
              </div>

              <div>
                <span>Vencimiento</span>

                <strong>
                  {selectedUser.plan === "premium"
                    ? formatDate(
                        selectedUser.premiumExpiresAt
                      )
                    : "No corresponde"}
                </strong>
              </div>

              <div>
                <span>Último pago</span>

                <strong>
                  {selectedUser.lastPaymentAt
                    ? formatCurrency(
                        selectedUser.lastPaymentAmount
                      )
                    : "Sin pagos"}
                </strong>
              </div>
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.field}>
                <label htmlFor="admin-plan">
                  Plan a activar
                </label>

                <select
                  id="admin-plan"
                  value={selectedCycle}
                  onChange={handleCycleChange}
                >
                  <option value="monthly">
                    Premium mensual
                  </option>

                  <option value="annual">
                    Premium anual
                  </option>
                </select>
              </div>

              <div className={styles.field}>
                <label htmlFor="admin-amount">
                  Monto recibido
                </label>

                <input
                  id="admin-amount"
                  type="number"
                  min="0"
                  value={paymentAmount}
                  onChange={(event) =>
                    setPaymentAmount(event.target.value)
                  }
                />
              </div>

              <div className={styles.field}>
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
                    setMonthlyLimit(event.target.value)
                  }
                />

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleUpdateLimit}
                >
                  Guardar límite
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
                    setAdminNote(event.target.value)
                  }
                  placeholder="Ej: Comprobante recibido por WhatsApp."
                ></textarea>

                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleSaveNote}
                >
                  Guardar nota
                </button>
              </div>
            </div>

            {feedbackMessage && (
              <div
                className={
                  feedbackType === "success"
                    ? styles.successMessage
                    : styles.errorMessage
                }
              >
                <i
                  className={
                    feedbackType === "success"
                      ? "bi bi-check-circle"
                      : "bi bi-exclamation-circle"
                  }
                ></i>

                {feedbackMessage}
              </div>
            )}

            <div className={styles.mainActions}>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleActivatePremium}
              >
                <i className="bi bi-gem"></i>

                {selectedUser.plan === "premium"
                  ? "Renovar Premium"
                  : "Activar Premium"}
              </button>

              {selectedUser.plan === "premium" && (
                <button
                  type="button"
                  className={styles.dangerButton}
                  onClick={handleRemovePremium}
                >
                  Quitar Premium
                </button>
              )}

              <button
                type="button"
                className={
                  selectedUser.accountStatus === "blocked"
                    ? styles.secondaryButton
                    : styles.warningButton
                }
                onClick={handleToggleAccount}
              >
                {selectedUser.accountStatus === "blocked"
                  ? "Habilitar cuenta"
                  : "Bloquear cuenta"}
              </button>
            </div>

            <div className={styles.history}>
              <h3>Historial de pagos</h3>

              {selectedUser.paymentHistory?.length > 0 ? (
                selectedUser.paymentHistory
                  .slice(0, 5)
                  .map((payment) => (
                    <article
                      key={payment.id}
                      className={styles.historyItem}
                    >
                      <div>
                        <strong>
                          {payment.planType === "annual"
                            ? "Premium anual"
                            : "Premium mensual"}
                        </strong>

                        <span>
                          Pagado el{" "}
                          {formatDate(payment.paymentDate)}
                        </span>
                      </div>

                      <div>
                        <strong>
                          {formatCurrency(payment.amount)}
                        </strong>

                        <span>
                          Vence el{" "}
                          {formatDate(payment.periodEndAt)}
                        </span>
                      </div>
                    </article>
                  ))
              ) : (
                <p className={styles.noHistory}>
                  Todavía no hay pagos registrados.
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