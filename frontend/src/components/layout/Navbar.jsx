import { useContext } from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { FinanceContext } from "../../context/FinanceContext";
import { useAuth } from "../../context/AuthContext";
import { useCommercialCatalog } from "../../hooks/useCommercialCatalog";

import styles from "./Navbar.module.css";

function Navbar({ toggleSidebar }) {
  const { settings } = useContext(FinanceContext);
  const { currentUser, logout } = useAuth();
  const { planMap } = useCommercialCatalog();

  const navigate = useNavigate();

  const displayName =
    currentUser?.name ||
    settings.userName ||
    "Usuario";

  const planLabel =
    currentUser?.role === "admin"
      ? "Administradora"
      : currentUser?.plan === "premium"
        ? planMap?.[currentUser.billingCycle]?.name ||
          "Premium"
        : planMap?.free?.name ||
          "Plan gratuito";

  const handleLogout = () => {
    logout();
    navigate("/login", {
      replace: true,
    });
  };

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button
          className={styles.menuButton}
          onClick={toggleSidebar}
          type="button"
          aria-label="Abrir o cerrar menú"
        >
          <i className="bi bi-list"></i>
        </button>

        <Link
          to="/"
          className={styles.brand}
        >
          MoneyTrack
        </Link>
      </div>

      <div className={styles.right}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Buscar"
        >
          <i className="bi bi-search"></i>
        </button>

        <button
          type="button"
          className={styles.iconButton}
          aria-label="Notificaciones"
        >
          <i className="bi bi-bell"></i>
        </button>

        <div
          className={`${styles.planBadge} ${
            currentUser?.plan === "premium" ||
            currentUser?.role === "admin"
              ? styles.premiumPlan
              : styles.freePlan
          }`}
        >
          {planLabel}
        </div>

        <div className={styles.user}>
          <i className="bi bi-person-circle"></i>

          <span>{displayName}</span>
        </div>

        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <i className="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </header>
  );
}

export default Navbar;