import { useContext } from "react";
import { NavLink } from "react-router-dom";

import { FinanceContext } from "../../context/FinanceContext";
import { useAuth } from "../../context/AuthContext";

import sidebarMenu from "../../data/sidebarMenu";
import styles from "./Sidebar.module.css";

function Sidebar({ isOpen }) {
  const { settings } = useContext(FinanceContext);
  const { currentUser, isAdmin } = useAuth();

  const displayName =
    currentUser?.name ||
    settings.userName ||
    "Usuario";

  const roleLabel =
    currentUser?.role === "admin"
      ? "Administradora"
      : currentUser?.plan === "premium"
        ? currentUser.billingCycle === "annual"
          ? "Premium anual"
          : "Premium mensual"
        : "Plan gratuito";

  const visibleMenu = sidebarMenu.filter((item) => {
    if (item.adminOnly && !isAdmin) {
      return false;
    }

    if (item.clientOnly && isAdmin) {
      return false;
    }

    return true;
  });

  return (
    <aside
      className={`${styles.sidebar} ${
        !isOpen ? styles.sidebarCollapsed : ""
      }`}
    >
      <div>
        <div className={styles.logo}>
          <i className="bi bi-wallet2 fs-3"></i>

          {isOpen && <h2>MoneyTrack</h2>}
        </div>

        <nav className={styles.nav}>
          {visibleMenu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              className={({ isActive }) =>
                `${styles.link} ${
                  isActive ? styles.active : ""
                }`
              }
              title={!isOpen ? item.title : undefined}
            >
              <i className={item.icon}></i>

              {isOpen && <span>{item.title}</span>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className={styles.footer}>
        <div className={styles.user}>
          <div className={styles.avatar}>
            {displayName.charAt(0).toUpperCase()}
          </div>

          {isOpen && (
            <div className={styles.userInfo}>
              <strong>{displayName}</strong>
              <span>{currentUser?.email}</span>
            </div>
          )}
        </div>

        {isOpen && (
          <div
            className={`${styles.role} ${
              currentUser?.plan === "premium" ||
              currentUser?.role === "admin"
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