import { useState } from "react";

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

import styles from "../Login/Auth.module.css";

const INITIAL_FORM = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function Register() {
  const [formData, setFormData] =
    useState(INITIAL_FORM);

  const [showPassword, setShowPassword] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const {
    register,
    isAuthenticated,
    isAdmin,
    loading,
  } = useAuth();

  const navigate = useNavigate();

  if (loading) {
    return (
      <main className={styles.page}>
        <section className={styles.formSection}>
          <div className={styles.card}>
            <div className={styles.header}>
              <span className={styles.eyebrow}>
                MoneyTrack
              </span>

              <h2>Cargando</h2>

              <p>
                Estamos verificando la sesión.
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

  const validateForm = () => {
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      return "Todos los campos son obligatorios.";
    }

    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        formData.email.trim()
      );

    if (!validEmail) {
      return "Ingresá un correo electrónico válido.";
    }

    if (formData.password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres.";
    }

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      return "Las contraseñas no coinciden.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationMessage =
      validateForm();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
      });

      if (!result.success) {
        setErrorMessage(result.message);
        return;
      }

      if (
        result.requiresEmailConfirmation
      ) {
        window.alert(result.message);

        navigate("/login", {
          replace: true,
        });

        return;
      }

      navigate("/", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Error al crear la cuenta:",
        error
      );

      setErrorMessage(
        "No se pudo crear la cuenta. Volvé a intentarlo."
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
            Empezá a tomar el control de tu
            dinero.
          </h1>

          <p>
            Creá tu cuenta gratuita y administrá
            tus finanzas personales desde
            cualquier lugar.
          </p>

          <div className={styles.featureList}>
            <div>
              <i className="bi bi-check-circle-fill"></i>

              <span>
                Hasta 100 movimientos mensuales
              </span>
            </div>

            <div>
              <i className="bi bi-check-circle-fill"></i>

              <span>
                Reportes en Excel y PDF
              </span>
            </div>

            <div>
              <i className="bi bi-check-circle-fill"></i>

              <span>
                Sin necesidad de tarjeta
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
              Cuenta gratuita
            </span>

            <h2>Crear una cuenta</h2>

            <p>
              Completá tus datos para comenzar.
            </p>
          </div>

          <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
          >
            <div className={styles.field}>
              <label htmlFor="register-name">
                Nombre
              </label>

              <div
                className={styles.inputWrapper}
              >
                <i className="bi bi-person"></i>

                <input
                  id="register-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  autoComplete="name"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="register-email">
                Correo electrónico
              </label>

              <div
                className={styles.inputWrapper}
              >
                <i className="bi bi-envelope"></i>

                <input
                  id="register-email"
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
              <label htmlFor="register-password">
                Contraseña
              </label>

              <div
                className={styles.inputWrapper}
              >
                <i className="bi bi-lock"></i>

                <input
                  id="register-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
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

            <div className={styles.field}>
              <label
                htmlFor="register-confirm-password"
              >
                Confirmar contraseña
              </label>

              <div
                className={styles.inputWrapper}
              >
                <i className="bi bi-shield-lock"></i>

                <input
                  id="register-confirm-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  value={
                    formData.confirmPassword
                  }
                  onChange={handleChange}
                  placeholder="Repetí tu contraseña"
                  autoComplete="new-password"
                  disabled={isSubmitting}
                />
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
                ? "Creando cuenta..."
                : "Crear cuenta gratuita"}
            </button>
          </form>

          <p className={styles.footerText}>
            ¿Ya tenés una cuenta?{" "}
            <Link to="/login">
              Iniciar sesión
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;