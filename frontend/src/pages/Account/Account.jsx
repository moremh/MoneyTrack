import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import { FinanceContext } from "../../context/FinanceContext";
import { useAuth } from "../../context/AuthContext";

import MovementUsage from "../../components/premium/MovementUsage/MovementUsage";
import PremiumLimitModal from "../../components/premium/PremiumLimitModal/PremiumLimitModal";

import styles from "./Account.module.css";

const formatDate = (dateValue) => {
  if (!dateValue) {
    return "No disponible";
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Fecha inválida";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }
  ).format(date);
};

const calculateRemainingDays = (
  expirationDate
) => {
  if (!expirationDate) {
    return null;
  }

  const expirationTime =
    new Date(
      expirationDate
    ).getTime();

  if (
    Number.isNaN(
      expirationTime
    )
  ) {
    return null;
  }

  const difference =
    expirationTime -
    Date.now();

  return Math.max(
    Math.ceil(
      difference /
        (1000 * 60 * 60 * 24)
    ),
    0
  );
};

function Account() {
  const {
    currentUser,
    logout,
  } = useAuth();

  const {
    settings,
    updateSettings,
    movementUsage,
  } = useContext(FinanceContext);

  const navigate =
    useNavigate();

  const [name, setName] =
    useState(
      currentUser?.name || ""
    );

  const [message, setMessage] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    isSavingProfile,
    setIsSavingProfile,
  ] = useState(false);

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const [
    showPremiumModal,
    setShowPremiumModal,
  ] = useState(false);

  useEffect(() => {
    setName(
      currentUser?.name || ""
    );
  }, [currentUser?.name]);

  const remainingDays =
    useMemo(
      () =>
        calculateRemainingDays(
          currentUser
            ?.premiumExpiresAt
        ),
      [
        currentUser
          ?.premiumExpiresAt,
      ]
    );

  const isAdmin =
    currentUser?.role ===
    "admin";

  const isPremium =
    currentUser?.plan ===
    "premium";

  const planName = isAdmin
    ? "Cuenta administradora"
    : isPremium
      ? currentUser
          ?.billingCycle ===
        "annual"
        ? "Premium anual"
        : "Premium mensual"
      : "Plan gratuito";

  const handleSaveProfile =
    async (event) => {
      event.preventDefault();

      if (isSavingProfile) {
        return;
      }

      const cleanName =
        name.trim();

      setMessage("");
      setErrorMessage("");

      if (!cleanName) {
        setErrorMessage(
          "El nombre no puede estar vacío."
        );

        return;
      }

      setIsSavingProfile(true);

      try {
        /*
         * updateSettings ya actualiza el
         * perfil en Supabase y refresca
         * currentUser en AuthContext.
         */
        const result =
          await updateSettings({
            ...settings,
            userName: cleanName,
          });

        if (!result?.success) {
          setErrorMessage(
            result?.message ||
              "No se pudieron actualizar los datos de la cuenta."
          );

          return;
        }

        setMessage(
          result?.message ||
            "Los datos de la cuenta se actualizaron correctamente."
        );
      } catch (error) {
        console.error(
          "No se pudo actualizar la cuenta:",
          error
        );

        setErrorMessage(
          "No se pudieron actualizar los datos de la cuenta. Volvé a intentarlo."
        );
      } finally {
        setIsSavingProfile(false);
      }
    };

  const handleLogout =
    async () => {
      if (isLoggingOut) {
        return;
      }

      setMessage("");
      setErrorMessage("");
      setIsLoggingOut(true);

      try {
        const result =
          await logout();

        if (!result?.success) {
          setErrorMessage(
            result?.message ||
              "No se pudo cerrar la sesión."
          );

          return;
        }

        navigate("/login", {
          replace: true,
        });
      } catch (error) {
        console.error(
          "No se pudo cerrar la sesión:",
          error
        );

        setErrorMessage(
          "No se pudo cerrar la sesión. Volvé a intentarlo."
        );
      } finally {
        setIsLoggingOut(false);
      }
    };

  return (
    <section className={styles.page}>
      <header
        className={
          styles.pageHeader
        }
      >
        <div>
          <span
            className={
              styles.eyebrow
            }
          >
            Perfil
          </span>

          <h1>Mi cuenta</h1>

          <p>
            Consultá tus datos
            personales, tu plan y el
            uso mensual de MoneyTrack.
          </p>
        </div>

        <div
          className={`${styles.planBadge} ${
            isPremium || isAdmin
              ? styles.premiumBadge
              : styles.freeBadge
          }`}
        >
          <i
            className={
              isPremium || isAdmin
                ? "bi bi-gem"
                : "bi bi-person"
            }
          ></i>

          {planName}
        </div>
      </header>

      <div
        className={
          styles.accountGrid
        }
      >
        <article
          className={styles.card}
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div
              className={
                styles.cardIcon
              }
            >
              <i className="bi bi-person"></i>
            </div>

            <div>
              <h2>
                Datos personales
              </h2>

              <p>
                Información de tu
                cuenta.
              </p>
            </div>
          </div>

          <form
            className={styles.form}
            onSubmit={
              handleSaveProfile
            }
            noValidate
          >
            <div
              className={
                styles.field
              }
            >
              <label htmlFor="account-name">
                Nombre
              </label>

              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(
                    event.target.value
                  );

                  setMessage("");
                  setErrorMessage("");
                }}
                disabled={
                  isSavingProfile
                }
              />
            </div>

            <div
              className={
                styles.field
              }
            >
              <label htmlFor="account-email">
                Correo electrónico
              </label>

              <input
                id="account-email"
                type="email"
                value={
                  currentUser?.email ||
                  ""
                }
                readOnly
              />

              <small>
                El correo se administra
                mediante Supabase Auth.
              </small>
            </div>

            <div
              className={
                styles.field
              }
            >
              <label>
                ID de usuario
              </label>

              <div
                className={
                  styles.readOnlyValue
                }
              >
                {currentUser?.id}
              </div>
            </div>

            {errorMessage && (
              <div
                className={
                  styles.errorMessage
                }
                role="alert"
              >
                <i className="bi bi-exclamation-circle"></i>
                {errorMessage}
              </div>
            )}

            {message && (
              <div
                className={
                  styles.successMessage
                }
                role="status"
              >
                <i className="bi bi-check-circle"></i>
                {message}
              </div>
            )}

            <button
              type="submit"
              className={
                styles.saveButton
              }
              disabled={
                isSavingProfile ||
                isLoggingOut
              }
            >
              {isSavingProfile
                ? "Guardando..."
                : "Guardar cambios"}
            </button>
          </form>
        </article>

        <article
          className={styles.card}
        >
          <div
            className={
              styles.cardHeader
            }
          >
            <div
              className={`${styles.cardIcon} ${styles.planIcon}`}
            >
              <i className="bi bi-gem"></i>
            </div>

            <div>
              <h2>Suscripción</h2>

              <p>
                Información de tu plan
                actual.
              </p>
            </div>
          </div>

          <div
            className={
              styles.subscription
            }
          >
            <div
              className={
                styles.subscriptionRow
              }
            >
              <span>
                Plan actual
              </span>

              <strong>
                {planName}
              </strong>
            </div>

            {!isAdmin && (
              <>
                <div
                  className={
                    styles.subscriptionRow
                  }
                >
                  <span>Estado</span>

                  <strong>
                    {isPremium
                      ? "Premium activo"
                      : currentUser
                            ?.premiumStatus ===
                          "expired"
                        ? "Premium vencido"
                        : "Plan gratuito activo"}
                  </strong>
                </div>

                <div
                  className={
                    styles.subscriptionRow
                  }
                >
                  <span>
                    Fecha de activación
                  </span>

                  <strong>
                    {isPremium
                      ? formatDate(
                          currentUser
                            ?.premiumActivatedAt
                        )
                      : "No corresponde"}
                  </strong>
                </div>

                <div
                  className={
                    styles.subscriptionRow
                  }
                >
                  <span>
                    Fecha de vencimiento
                  </span>

                  <strong>
                    {isPremium
                      ? formatDate(
                          currentUser
                            ?.premiumExpiresAt
                        )
                      : "No corresponde"}
                  </strong>
                </div>

                {isPremium &&
                  remainingDays !==
                    null && (
                    <div
                      className={
                        styles.remainingDays
                      }
                    >
                      <i className="bi bi-calendar-check"></i>

                      <span>
                        {remainingDays ===
                        0
                          ? "Tu plan vence hoy."
                          : `Quedan ${remainingDays} días de Premium.`}
                      </span>
                    </div>
                  )}
              </>
            )}

            {!isAdmin && (
              <button
                type="button"
                className={
                  styles.premiumButton
                }
                onClick={() =>
                  setShowPremiumModal(
                    true
                  )
                }
              >
                <i className="bi bi-whatsapp"></i>

                {isPremium
                  ? "Renovar Premium"
                  : "Activar Premium"}
              </button>
            )}
          </div>
        </article>
      </div>

      <MovementUsage
        usage={movementUsage}
        onPremiumClick={() =>
          setShowPremiumModal(true)
        }
      />

      <article
        className={
          styles.securityCard
        }
      >
        <div>
          <div
            className={
              styles.securityIcon
            }
          >
            <i className="bi bi-box-arrow-right"></i>
          </div>

          <div>
            <h2>Cerrar sesión</h2>

            <p>
              Cerrá la sesión actual
              en este dispositivo.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            void handleLogout()
          }
          disabled={
            isLoggingOut ||
            isSavingProfile
          }
        >
          {isLoggingOut
            ? "Cerrando sesión..."
            : "Cerrar sesión"}
        </button>
      </article>

      {showPremiumModal &&
        !isAdmin && (
          <PremiumLimitModal
            usage={movementUsage}
            onClose={() =>
              setShowPremiumModal(
                false
              )
            }
          />
        )}
    </section>
  );
}

export default Account;