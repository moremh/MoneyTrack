import { useState } from "react";

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import styles from "./Auth.module.css";

const INITIAL_FORM = {
  email: "",
  password: "",
};

function Login() {
  const [formData, setFormData] =
    useState(INITIAL_FORM);

  const [showPassword, setShowPassword] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const {
    login,
    isAuthenticated,
    isAdmin,
    loading,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.formSection}>
          <div className={styles.card}>
            <div className={styles.header}>
              <span className={styles.eyebrow}>
                MoneyTrack
              </span>

              <h2>Cargando sesión</h2>

              <p>
                Estamos verificando tu cuenta.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to={isAdmin ? "/admin" : "/"}
        replace
      />
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));

    setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !formData.email.trim() ||
      !formData.password
    ) {
      setErrorMessage(
        "Ingresá tu correo electrónico y contraseña."
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await login(formData);

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      const previousRoute =
        location.state?.from;

      const destination =
        result.user?.role === "admin"
          ? "/admin"
          : previousRoute || "/";

      navigate(destination, {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Error al iniciar sesión:",
        error
      );

      setErrorMessage(
        "No se pudo iniciar sesión. Volvé a intentarlo."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <section className={styles.presentation}>
        <div
          className={styles.presentationContent}
        >
          <div className={styles.logo}>
            <i className="bi bi-wallet2"></i>
            <span>MoneyTrack</span>
          </div>

          <h1>
            Organizá tus finanzas de una manera
            simple.
          </h1>

          <p>
            Registrá tus ingresos, controlá tus
            gastos y cumplí tus objetivos desde
            un solo lugar.
          </p>

          <div className={styles.featureList}>
            <div>
              <i className="bi bi-check-circle-fill"></i>
              <span>
                Control de ingresos y gastos
              </span>
            </div>

            <div>
              <i className="bi bi-check-circle-fill"></i>
              <span>
                Reportes y estadísticas
              </span>
            </div>

            <div>
              <i className="bi bi-check-circle-fill"></i>
              <span>
                Objetivos de ahorro
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.formSection}>
        <div className={styles.card}>
          <div className={styles.mobileLogo}>
            <i className="bi bi-wallet2"></i>
            <span>MoneyTrack</span>
          </div>

          <div className={styles.header}>
            <span className={styles.eyebrow}>
              Bienvenido nuevamente
            </span>

            <h2>Iniciar sesión</h2>

            <p>
              Ingresá tus datos para acceder a tu
              cuenta.
            </p>
          </div>

          <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className={styles.field}>
              <label htmlFor="login-email">
                Correo electrónico
              </label>

              <div
                className={styles.inputWrapper}
              >
                <i className="bi bi-envelope"></i>

                <input
                  id="login-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="login-password">
                Contraseña
              </label>

              <div
                className={styles.inputWrapper}
              >
                <i className="bi bi-lock"></i>

                <input
                  id="login-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Ingresá tu contraseña"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />

                <button
                  type="button"
                  className={
                    styles.passwordButton
                  }
                  onClick={() =>
                    setShowPassword(
                      (currentValue) =>
                        !currentValue
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                  disabled={isSubmitting}
                >
                  <i
                    className={
                      showPassword
                        ? "bi bi-eye-slash"
                        : "bi bi-eye"
                    }
                  ></i>
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                className={
                  styles.errorMessage
                }
              >
                <i className="bi bi-exclamation-circle"></i>
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              className={
                styles.primaryButton
              }
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Iniciando sesión..."
                : "Iniciar sesión"}
            </button>
          </form>

          <p className={styles.footerText}>
            ¿Todavía no tenés una cuenta?{" "}
            <Link to="/register">
              Registrate gratis
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Login;