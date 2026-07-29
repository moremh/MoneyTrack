import {
  useContext,
} from "react";

import {
  NavLink,
} from "react-router-dom";

import { FinanceContext } from "../../context/FinanceContext";
import { useAuth } from "../../context/AuthContext";

import sidebarMenu from "../../data/sidebarMenu";

import styles from "./Sidebar.module.css";

function Sidebar({
  isOpen,
  isMobile = false,
  onClose,
}) {
  const {
    settings,
  } = useContext(
    FinanceContext
  );

  const {
    currentUser,
    isAdmin,
  } = useAuth();

  const displayName =
    currentUser?.name ||
    settings.userName ||
    "Usuario";

  const roleLabel =
    currentUser?.role ===
    "admin"
      ? "Administradora"
      : currentUser?.plan ===
          "premium"
        ? currentUser
              .billingCycle ===
            "annual"
          ? "Premium anual"
          : "Premium mensual"
        : "Plan gratuito";

  const visibleMenu =
    sidebarMenu.filter(
      (item) => {
        if (
          item.adminOnly &&
          !isAdmin
        ) {
          return false;
        }

        if (
          item.clientOnly &&
          isAdmin
        ) {
          return false;
        }

        return true;
      }
    );

  /*
   * En móvil, cuando el sidebar está visible,
   * siempre mostramos texto e información.
   *
   * En escritorio, depende de si está
   * expandido o contraído.
   */
  const showDetails =
    isMobile || isOpen;

  const handleNavigation =
    () => {
      if (isMobile) {
        onClose?.();
      }
    };

  const sidebarClasses = [
    styles.sidebar,

    !isMobile &&
    !isOpen
      ? styles.sidebarCollapsed
      : "",

    isMobile
      ? styles.mobileSidebar
      : "",

    isMobile &&
    isOpen
      ? styles.mobileSidebarOpen
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      id="moneytrack-sidebar"
      className={
        sidebarClasses
      }
      aria-hidden={
        isMobile
          ? !isOpen
          : undefined
      }
    >
      <div>
        <div
          className={
            styles.logo
          }
        >
          <i className="bi bi-wallet2 fs-3"></i>

          {showDetails && (
            <h2>
              MoneyTrack
            </h2>
          )}

          {isMobile && (
            <button
              type="button"
              className={
                styles.mobileCloseButton
              }
              onClick={onClose}
              aria-label="Cerrar menú lateral"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          )}
        </div>

        <nav
          className={
            styles.nav
          }
          aria-label="Navegación principal"
        >
          {visibleMenu.map(
            (item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={
                  item.path === "/"
                }
                className={({
                  isActive,
                }) =>
                  `${styles.link} ${
                    isActive
                      ? styles.active
                      : ""
                  }`
                }
                title={
                  !showDetails
                    ? item.title
                    : undefined
                }
                onClick={
                  handleNavigation
                }
              >
                <i
                  className={
                    item.icon
                  }
                ></i>

                {showDetails && (
                  <span>
                    {item.title}
                  </span>
                )}
              </NavLink>
            )
          )}
        </nav>
      </div>

      <div
        className={
          styles.footer
        }
      >
        <div
          className={
            styles.user
          }
        >
          <div
            className={
              styles.avatar
            }
          >
            {displayName
              .charAt(0)
              .toUpperCase()}
          </div>

          {showDetails && (
            <div
              className={
                styles.userInfo
              }
            >
              <strong>
                {displayName}
              </strong>

              <span>
                {currentUser?.email}
              </span>
            </div>
          )}
        </div>

        {showDetails && (
          <div
            className={`${styles.role} ${
              currentUser?.plan ===
                "premium" ||
              currentUser?.role ===
                "admin"
                ? styles.premiumRole
                : ""
            }`}
          >
            {roleLabel}
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;