import { useMemo } from "react";
import { createPortal } from "react-dom";
import { AccountContext } from "../../context/AccountContext";
import useTransactionAnnotations from "../../hooks/useTransactionAnnotations";
import { matchesMovement } from "../../utils/movementFilters";
import Modal from "../common/Modal/Modal";
import SubscriptionGlobalSearch from "../subscriptions/SubscriptionGlobalSearch";
import { formatRegionalCurrency, formatRegionalDate } from "../../utils/regionalSettings";
import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  FinanceContext,
} from "../../context/FinanceContext";

import {
  useAuth,
} from "../../context/AuthContext";

import {
  useReminders,
} from "../../context/ReminderContext";

import {
  useCommercialCatalog,
} from "../../hooks/useCommercialCatalog";

import styles from "./Navbar.module.css";

const REMINDER_TYPE_LABELS = {
  general: "General",
  payment: "Pago",
  goal: "Objetivo",
  debt: "Cobro / pago",
  custom: "Personalizado",
};

const formatReminderDate = (
  date
) => {
  if (!date) {
    return "";
  }

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
    }
  ).format(
    new Date(
      year,
      month - 1,
      day
    )
  );
};

const formatReminderTime = (
  time
) => {
  if (!time) {
    return "";
  }

  return String(time)
    .slice(0, 5);
};

function Navbar({
  toggleSidebar,
  onOpenSyncConflicts,
}) {
  const {
    settings,
    incomes = [],
    expenses = [],
    syncStatus,
    pendingSyncCount,
    syncConflictCount,
  } = useContext(
    FinanceContext
  );

  const {
    currentUser,
    logout,
  } = useAuth();

  const {
    overdueReminders,
    dueTodayReminders,
    upcomingReminders,
    unreadCount,
    markReminderRead,
    markAllRemindersRead,
  } = useReminders();

  const {
    planMap,
  } = useCommercialCatalog();

  const navigate =
    useNavigate();
  const {accounts=[]} = useContext(AccountContext) || {};
  const {annotations} = useTransactionAnnotations();
  const [searchOpen,setSearchOpen] = useState(false);
  const [searchQuery,setSearchQuery] = useState("");
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const names = new Map(accounts.map(account=>[account.id,account.name]));
    return [...incomes,...expenses].filter(item=>matchesMovement(
      item,{query:searchQuery},annotations,names.get(item.accountId)||""
    )).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)))
      .slice(0,30);
  },[searchQuery,incomes,expenses,accounts,annotations]);


  // Modal de búsqueda a nivel del documento y sin desplazamiento de fondo.
  useEffect(() => {
    if (!searchOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [searchOpen]);

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false);

  const notificationsRef =
    useRef(null);

  const displayName =
    currentUser?.name ||
    settings.userName ||
    "Usuario";

  const planLabel =
    currentUser?.role === "admin"
      ? "Administradora"
      : currentUser?.plan ===
          "premium"
        ? planMap?.[
            currentUser.billingCycle
          ]?.name ||
          "Premium"
        : planMap?.free?.name ||
          "Plan gratuito";

  useEffect(() => {
    if (!notificationsOpen) {
      return undefined;
    }

    const handlePointerDown = (
      event
    ) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(
          event.target
        )
      ) {
        setNotificationsOpen(
          false
        );
      }
    };

    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape"
      ) {
        setNotificationsOpen(
          false
        );
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown
    );

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown
      );

      document.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    notificationsOpen,
  ]);

  const handleLogout = () => {
    logout();

    navigate(
      "/login",
      {
        replace: true,
      }
    );
  };

  const handleMarkRead =
    async (reminderId) => {
      await markReminderRead(
        reminderId
      );
    };

  const handleMarkAllRead =
    async () => {
      await markAllRemindersRead();
    };

  const renderReminderSection = (
    title,
    reminders,
    sectionType
  ) => {
    if (
      reminders.length === 0
    ) {
      return null;
    }

    return (
      <section
        className={
          styles.notificationSection
        }
      >
        <div
          className={
            styles.notificationSectionHeader
          }
        >
          <span>
            {title}
          </span>

          <span
            className={
              styles.notificationSectionCount
            }
          >
            {reminders.length}
          </span>
        </div>

        <div
          className={
            styles.notificationList
          }
        >
          {reminders.map(
            (reminder) => (
              <div
                key={
                  reminder.id
                }
                className={`${styles.notificationItem} ${
                  !reminder.isRead
                    ? styles.notificationUnread
                    : ""
                }`}
              >
                <div
                  className={`${styles.notificationItemIcon} ${
                    sectionType ===
                    "overdue"
                      ? styles.notificationItemIconDanger
                      : sectionType ===
                          "today"
                        ? styles.notificationItemIconToday
                        : styles.notificationItemIconUpcoming
                  }`}
                  aria-hidden="true"
                >
                  <i
                    className={`bi ${
                      sectionType ===
                      "overdue"
                        ? "bi-exclamation-circle"
                        : sectionType ===
                            "today"
                          ? "bi-clock"
                          : "bi-calendar-event"
                    }`}
                  ></i>
                </div>

                <div
                  className={
                    styles.notificationItemContent
                  }
                >
                  <div
                    className={
                      styles.notificationItemTop
                    }
                  >
                    <strong>
                      {
                        reminder.title
                      }
                    </strong>

                    {!reminder.isRead && (
                      <span
                        className={
                          styles.notificationUnreadDot
                        }
                        title="Sin leer"
                        aria-label="Sin leer"
                      ></span>
                    )}
                  </div>

                  {reminder.description && (
                    <p
                      className={
                        styles.notificationDescription
                      }
                    >
                      {
                        reminder.description
                      }
                    </p>
                  )}

                  <div
                    className={
                      styles.notificationMeta
                    }
                  >
                    <span>
                      {
                        REMINDER_TYPE_LABELS[
                          reminder.type
                        ] ||
                        "Recordatorio"
                      }
                    </span>

                    <span
                      aria-hidden="true"
                    >
                      ·
                    </span>

                    <span>
                      {formatReminderDate(
                        reminder.reminderDate
                      )}
                    </span>

                    <span>
                      {formatReminderTime(
                        reminder.reminderTime
                      )}
                    </span>
                  </div>
                </div>

                {!reminder.isRead && (
                  <button
                    type="button"
                    className={
                      styles.notificationReadButton
                    }
                    onClick={() =>
                      void handleMarkRead(
                        reminder.id
                      )
                    }
                    title="Marcar como leído"
                    aria-label={`Marcar "${reminder.title}" como leído`}
                  >
                    <i className="bi bi-check2"></i>
                  </button>
                )}
              </div>
            )
          )}
        </div>
      </section>
    );
  };

  const hasNotifications =
    overdueReminders.length >
      0 ||
    dueTodayReminders.length >
      0 ||
    upcomingReminders.length >
      0;

  let syncLabel =
    "En línea";

  let syncIcon =
    "bi-cloud-check";

  let syncClass =
    styles.syncOnline;

  if (
    syncStatus ===
    "offline"
  ) {
    syncLabel =
      "Sin conexión";

    syncIcon =
      "bi-wifi-off";

    syncClass =
      styles.syncOffline;
  } else if (
    syncStatus ===
    "syncing"
  ) {
    syncLabel =
      "Sincronizando...";

    syncIcon =
      "bi-arrow-repeat";

    syncClass =
      styles.syncing;
  } else if (
    syncStatus ===
    "conflict"
  ) {
    syncLabel =
      "Requiere atención";

    syncIcon =
      "bi-exclamation-triangle";

    syncClass =
      styles.syncConflict;
  } else if (
    syncStatus ===
    "pending"
  ) {
    syncLabel =
      "Pendiente";

    syncIcon =
      "bi-cloud-arrow-up";

    syncClass =
      styles.syncPending;
  }

  const displayCount =
    syncStatus === "conflict"
      ? syncConflictCount
      : pendingSyncCount;

  const displayCountText =
    syncStatus === "conflict"
      ? syncConflictCount === 1
        ? "1 conflicto pendiente"
        : `${syncConflictCount} conflictos pendientes`
      : pendingSyncCount === 1
        ? "1 cambio pendiente"
        : `${pendingSyncCount} cambios pendientes`;

  const syncTitle =
    displayCount > 0
      ? `${syncLabel}. ${displayCountText}.`
      : syncLabel;

  const syncBadgeContent = (
    <>
      <i
        className={`bi ${syncIcon} ${
          syncStatus ===
          "syncing"
            ? styles.syncIconSpinning
            : ""
        }`}
      ></i>

      <span
        className={
          styles.syncText
        }
      >
        {syncLabel}
      </span>

      {displayCount > 0 && (
        <span
          className={
            styles.syncCount
          }
          aria-label={
            displayCountText
          }
        >
          {displayCount}
        </span>
      )}
    </>
  );

  return (
    <header
      className={
        styles.navbar
      }
    >
      <div
        className={
          styles.left
        }
      >
        <button
          className={
            styles.menuButton
          }
          onClick={
            toggleSidebar
          }
          type="button"
          aria-label="Abrir o cerrar menú"
        >
          <i className="bi bi-list"></i>
        </button>

        <Link
          to="/"
          className={
            styles.brand
          }
        >
          MoneyTrack
        </Link>
      </div>

      <div
        className={
          styles.right
        }
      >
        {syncStatus ===
        "conflict" ? (
          <button
            type="button"
            className={`${styles.syncBadge} ${styles.syncBadgeButton} ${syncClass}`}
            onClick={
              onOpenSyncConflicts
            }
            title={`${syncTitle} Abrir resolución de conflictos.`}
            aria-label={`${syncTitle} Abrir resolución de conflictos.`}
          >
            {syncBadgeContent}
          </button>
        ) : (
          <div
            className={`${styles.syncBadge} ${syncClass}`}
            role="status"
            aria-live="polite"
            title={syncTitle}
          >
            {syncBadgeContent}
          </div>
        )}

        <button
          type="button"
          className={`${styles.iconButton} ${styles.searchButton}`}
          aria-label="Búsqueda global"
          title="Buscar movimientos"
          onClick={() => setSearchOpen(true)}
        >
          <i className="bi bi-search"></i>
        </button>

        <div
          ref={
            notificationsRef
          }
          className={
            styles.notificationWrapper
          }
        >
          <button
            type="button"
            className={`${styles.iconButton} ${styles.notificationButton} ${
              notificationsOpen
                ? styles.notificationButtonActive
                : ""
            }`}
            aria-label={
              unreadCount > 0
                ? `Notificaciones. ${unreadCount} sin leer.`
                : "Notificaciones"
            }
            aria-expanded={
              notificationsOpen
            }
            aria-haspopup="dialog"
            aria-controls="moneytrack-notifications-panel"
            onClick={() =>
              setNotificationsOpen(
                (current) =>
                  !current
              )
            }
          >
            <i className="bi bi-bell"></i>

            {unreadCount > 0 && (
              <span
                className={
                  styles.notificationBadge
                }
                aria-hidden="true"
              >
                {unreadCount > 99
                  ? "99+"
                  : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div
              id="moneytrack-notifications-panel"
              className={
                styles.notificationPanel
              }
              role="dialog"
              aria-label="Centro de notificaciones"
            >
              <div
                className={
                  styles.notificationPanelHeader
                }
              >
                <div>
                  <strong>
                    Notificaciones
                  </strong>

                  <span>
                    {unreadCount ===
                    1
                      ? "1 sin leer"
                      : `${unreadCount} sin leer`}
                  </span>
                </div>

                {unreadCount >
                  0 && (
                  <button
                    type="button"
                    className={
                      styles.markAllReadButton
                    }
                    onClick={() =>
                      void handleMarkAllRead()
                    }
                  >
                    Marcar todas
                  </button>
                )}
              </div>

              <div
                className={
                  styles.notificationPanelBody
                }
              >
                {!hasNotifications ? (
                  <div
                    className={
                      styles.notificationEmpty
                    }
                  >
                    <i className="bi bi-bell-slash"></i>

                    <strong>
                      No hay recordatorios pendientes
                    </strong>

                    <span>
                      Cuando crees uno, aparecerá acá.
                    </span>
                  </div>
                ) : (
                  <>
                    {renderReminderSection(
                      "Vencidos",
                      overdueReminders,
                      "overdue"
                    )}

                    {renderReminderSection(
                      "Hoy",
                      dueTodayReminders,
                      "today"
                    )}

                    {renderReminderSection(
                      "Próximos",
                      upcomingReminders,
                      "upcoming"
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className={`${styles.planBadge} ${
            currentUser?.plan ===
              "premium" ||
            currentUser?.role ===
              "admin"
              ? styles.premiumPlan
              : styles.freePlan
          }`}
        >
          {planLabel}
        </div>

        <div
          className={
            styles.user
          }
        >
          <span>
            {displayName}
          </span>
        </div>

        <button
          type="button"
          className={
            styles.logoutButton
          }
          onClick={
            handleLogout
          }
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <i className="bi bi-box-arrow-right"></i>
        </button>
      </div>
      {searchOpen && createPortal(
        <Modal onClose={() => setSearchOpen(false)}>
        <h2>Búsqueda global</h2>
        <label htmlFor="global-movement-search">Buscar ingresos y gastos</label>
        <input id="global-movement-search" autoFocus type="search" value={searchQuery}
          onChange={event=>setSearchQuery(event.target.value)}
          placeholder="Nike, supermercado, 25.000, Facultad..."
          className={styles.globalSearchInput} />
        <div className={styles.globalSearchResults}>
          {!searchQuery.trim() && <p>Buscá por nombre, descripción, categoría, importe, nota o etiqueta.</p>}
          {searchQuery.trim() && searchResults.length === 0 && <p>No encontramos movimientos que coincidan.</p>}
          {searchResults.map(item=><button type="button" key={item.id}
            onClick={() => {
              navigate(`${item.type === "expense" ? "/expenses" : "/income"}?q=${encodeURIComponent(searchQuery)}`);
              setSearchOpen(false);
            }}>
            <span>{item.description} <small>{formatRegionalDate(item.date,settings)} · {item.type === "expense" ? "Gasto" : "Ingreso"}</small></span>
            <strong>{formatRegionalCurrency(item.amount,settings)}</strong>
          </button>)}
          {searchQuery.trim() && <SubscriptionGlobalSearch query={searchQuery} onSelect={() => setSearchOpen(false)} />}
          {searchResults.length===30 && <p>Se muestran los primeros 30 resultados. Refiná la búsqueda.</p>}
        </div>
        </Modal>,
        document.body,
      )}
    </header>
  );
}

export default Navbar;
