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
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    register,
    isAuthenticated,
    isAdmin,
  } = useAuth();

  const navigate = useNavigate();

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

    if (!formData.email.includes("@")) {
      return "Ingresá un correo electrónico válido.";
    }

    if (formData.password.length < 8) {
      return "La contraseña debe tener al menos 8 caracteres.";
    }

    if (formData.password !== formData.confirmPassword) {
      return "Las contraseñas no coinciden.";
    }

    return "";
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const validationMessage = validateForm();

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    const result = register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
    });

    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }

    navigate("/", {
      replace: true,
    });
  };

  return (
    <main className={styles.page}>
      <section className={styles.presentation}>
        <div className={styles.presentationContent}>
          <div className={styles.logo}>
            <i className="bi bi-wallet2"></i>
            <span>MoneyTrack</span>
          </div>

          <h1>
            Empezá a tomar el control de tu dinero.
          </h1>

          <p>
            Creá tu cuenta gratuita y administrá tus
            finanzas personales desde cualquier lugar.
          </p>

          <div className={styles.featureList}>
            <div>
              <i className="bi bi-check-circle-fill"></i>
              <span>Hasta 100 movimientos mensuales</span>
            </div>

            <div>
              <i className="bi bi-check-circle-fill"></i>
              <span>Reportes en Excel y PDF</span>
            </div>

            <div>
              <i className="bi bi-check-circle-fill"></i>
              <span>Sin necesidad de tarjeta</span>
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

              <div className={styles.inputWrapper}>
                <i className="bi bi-person"></i>

                <input
                  id="register-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Tu nombre"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="register-email">
                Correo electrónico
              </label>

              <div className={styles.inputWrapper}>
                <i className="bi bi-envelope"></i>

                <input
                  id="register-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className={styles.field}>
              <label htmlFor="register-password">
                Contraseña
              </label>

              <div className={styles.inputWrapper}>
                <i className="bi bi-lock"></i>

                <input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className={styles.passwordButton}
                  onClick={() =>
                    setShowPassword((currentValue) => !currentValue)
                  }
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
              <label htmlFor="register-confirm-password">
                Confirmar contraseña
              </label>

              <div className={styles.inputWrapper}>
                <i className="bi bi-shield-lock"></i>

                <input
                  id="register-confirm-password"
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repetí tu contraseña"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {errorMessage && (
              <div className={styles.errorMessage}>
                <i className="bi bi-exclamation-circle"></i>
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              className={styles.primaryButton}
            >
              Crear cuenta gratuita
            </button>
          </form>

          <p className={styles.footerText}>
            ¿Ya tenés una cuenta?{" "}
            <Link to="/login">Iniciar sesión</Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default Register;