import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FinanceContext,
} from "../../context/FinanceContext";

import styles from "./SyncConflictModal.module.css";

const formatAmount = (value) => {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    }
  ).format(amount);
};

const formatDate = (value) => {
  if (!value) {
    return "—";
  }

  const parsedDate = new Date(
    `${value}T12:00:00`
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString(
    "es-AR"
  );
};

const getMovementTypeLabel = (type) => {
  if (type === "income") {
    return "Ingreso";
  }

  if (type === "expense") {
    return "Gasto";
  }

  if (type === "deposit") {
    return "Aporte";
  }

  if (type === "withdrawal") {
    return "Retiro";
  }

  return "Movimiento";
};

function SyncConflictModal({
  open,
  onClose,
}) {
  const {
    goals,
    isOnline,
    syncConflicts,
    syncConflictCount,
    resolveSyncConflictUseServer,
    resolveSyncConflictKeepLocal,
  } = useContext(FinanceContext);

  const [busyAction, setBusyAction] =
    useState("");

  const [message, setMessage] =
    useState("");

  const closeButtonRef = useRef(null);

  const conflict =
    syncConflicts?.[0] || null;

  const isGoalMovementConflict =
    conflict?.entity ===
    "goal_movement";

  const localVersion = useMemo(() => {
    if (!conflict) {
      return null;
    }

    const payload =
      conflict.payload || {};

    return {
      type:
        conflict.type ||
        payload.type ||
        null,

      description:
        payload.description ||
        "",

      amount:
        payload.amount,

      category:
        payload.categoryName ||
        "General",

      goalId:
        conflict.goalId ||
        payload.goalId ||
        null,

      date:
        payload.date || "",
    };
  }, [conflict]);

  const serverVersion =
    isGoalMovementConflict
      ? conflict?.conflict
          ?.serverGoalMovement ||
        null
      : conflict?.conflict
          ?.serverTransaction ||
        null;

  const serverGoal =
    conflict?.conflict
      ?.serverGoal ||
    null;

  const localGoalName =
    useMemo(() => {
      if (
        !isGoalMovementConflict ||
        !localVersion?.goalId
      ) {
        return "";
      }

      const goal =
        goals?.find(
          (item) =>
            item.id ===
            localVersion.goalId
        );

      return (
        goal?.name ||
        goal?.title ||
        ""
      );
    }, [
      goals,
      isGoalMovementConflict,
      localVersion?.goalId,
    ]);

  const serverGoalName =
    isGoalMovementConflict
      ? (
          serverGoal?.name ||
          serverGoal?.title ||
          goals?.find(
            (item) =>
              item.id ===
              serverVersion?.goalId
          )?.name ||
          ""
        )
      : "";

  const isDeleteConflict =
    conflict?.action ===
    "delete";

  const isUpdateConflict =
    conflict?.action ===
    "update";

  const isCreateConflict =
    conflict?.action ===
    "create";

  let keepLocalLabel =
    "Conservar mis cambios";

  let cloudLabel =
    "Usar versión de la nube";

  if (isDeleteConflict) {
    keepLocalLabel =
      "Mantener eliminación";
  }

  if (
    isUpdateConflict &&
    !serverVersion
  ) {
    keepLocalLabel =
      isGoalMovementConflict
        ? "Volver a crear mi movimiento"
        : "Volver a crear mi versión";

    cloudLabel =
      "Aceptar eliminación de la nube";
  }

  if (
    isGoalMovementConflict &&
    isCreateConflict
  ) {
    keepLocalLabel =
      "Volver a intentar mi movimiento";

    cloudLabel =
      "Descartar mi movimiento";
  }

  useEffect(() => {
    setMessage("");
    setBusyAction("");
  }, [conflict?.id]);

  useEffect(() => {
    if (
      open &&
      syncConflictCount === 0
    ) {
      onClose?.();
    }
  }, [
    open,
    onClose,
    syncConflictCount,
  ]);

  useEffect(() => {
    if (!open || !conflict) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const handleKeyDown = (event) => {
      if (
        event.key === "Escape" &&
        !busyAction
      ) {
        onClose?.();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    busyAction,
    conflict,
    onClose,
    open,
  ]);

  if (!open || !conflict) {
    return null;
  }

  const resolveConflict = async (
    mode
  ) => {
    if (!isOnline) {
      setMessage(
        "Necesitás conexión para resolver este conflicto."
      );
      return;
    }

    const resolver =
      mode === "server"
        ? resolveSyncConflictUseServer
        : resolveSyncConflictKeepLocal;

    setBusyAction(mode);
    setMessage("");

    try {
      const result =
        await resolver(
          conflict.id
        );

      if (!result?.success) {
        setMessage(
          result?.message ||
            "No se pudo resolver el conflicto."
        );
      }
    } catch (error) {
      console.error(
        "No se pudo resolver el conflicto de sincronización:",
        error
      );

      setMessage(
        "Ocurrió un error al resolver el conflicto."
      );
    } finally {
      setBusyAction("");
    }
  };

  const conflictDescription =
    isGoalMovementConflict
      ? "Este movimiento de ahorro no coincide con el estado actual de la nube. Elegí cómo querés resolverlo."
      : "Este movimiento cambió tanto en este dispositivo como en la nube. Elegí cuál versión querés conservar.";

  return (
    <div
      className={styles.backdrop}
      role="presentation"
    >
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
        aria-describedby="sync-conflict-description"
      >
        <div className={styles.header}>
          <div
            className={styles.headerIcon}
            aria-hidden="true"
          >
            <i className="bi bi-exclamation-triangle"></i>
          </div>

          <div className={styles.headerText}>
            <p className={styles.eyebrow}>
              Sincronización
            </p>

            <h2 id="sync-conflict-title">
              Hay un conflicto por resolver
            </h2>

            <p
              id="sync-conflict-description"
              className={styles.description}
            >
              {conflictDescription}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={Boolean(busyAction)}
            aria-label="Cerrar conflicto"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        <div className={styles.metaRow}>
          <span className={styles.conflictCounter}>
            {syncConflictCount === 1
              ? "1 conflicto pendiente"
              : `${syncConflictCount} conflictos pendientes`}
          </span>

          <span className={styles.movementType}>
            {getMovementTypeLabel(
              localVersion?.type ||
                serverVersion?.type
            )}
          </span>
        </div>

        {conflict?.conflict?.message && (
          <div className={styles.notice}>
            <i className="bi bi-info-circle"></i>
            <span>
              {conflict.conflict.message}
            </span>
          </div>
        )}

        <div className={styles.comparisonGrid}>
          <article className={styles.versionCard}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.cardEyebrow}>
                  Este dispositivo
                </p>

                <h3>
                  {isDeleteConflict
                    ? "Tu decisión"
                    : "Tu versión"}
                </h3>
              </div>

              <span
                className={`${styles.versionBadge} ${styles.localBadge}`}
              >
                Local
              </span>
            </div>

            {isDeleteConflict ? (
              <div className={styles.deleteIntent}>
                <i className="bi bi-trash3"></i>

                <div>
                  <strong>
                    Eliminar este movimiento
                  </strong>

                  <span>
                    Elegiste borrarlo mientras estabas sin conexión.
                  </span>
                </div>
              </div>
            ) : (
              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <span>
                    Descripción
                  </span>

                  <strong>
                    {localVersion?.description ||
                      "Sin descripción"}
                  </strong>
                </div>

                <div className={styles.detailRow}>
                  <span>Monto</span>

                  <strong>
                    {formatAmount(
                      localVersion?.amount
                    )}
                  </strong>
                </div>

                {isGoalMovementConflict ? (
                  <div className={styles.detailRow}>
                    <span>
                      Objetivo
                    </span>

                    <strong>
                      {localGoalName ||
                        "Objetivo de ahorro"}
                    </strong>
                  </div>
                ) : (
                  <div className={styles.detailRow}>
                    <span>
                      Categoría
                    </span>

                    <strong>
                      {localVersion?.category ||
                        "General"}
                    </strong>
                  </div>
                )}

                <div className={styles.detailRow}>
                  <span>Fecha</span>

                  <strong>
                    {formatDate(
                      localVersion?.date
                    )}
                  </strong>
                </div>
              </div>
            )}
          </article>

          <article className={styles.versionCard}>
            <div className={styles.cardHeading}>
              <div>
                <p className={styles.cardEyebrow}>
                  Supabase
                </p>

                <h3>
                  Versión de la nube
                </h3>
              </div>

              <span
                className={`${styles.versionBadge} ${styles.cloudBadge}`}
              >
                Nube
              </span>
            </div>

            {serverVersion ? (
              <div className={styles.details}>
                <div className={styles.detailRow}>
                  <span>
                    Descripción
                  </span>

                  <strong>
                    {serverVersion.description ||
                      "Sin descripción"}
                  </strong>
                </div>

                <div className={styles.detailRow}>
                  <span>Monto</span>

                  <strong>
                    {formatAmount(
                      serverVersion.amount
                    )}
                  </strong>
                </div>

                {isGoalMovementConflict ? (
                  <div className={styles.detailRow}>
                    <span>
                      Objetivo
                    </span>

                    <strong>
                      {serverGoalName ||
                        "Objetivo de ahorro"}
                    </strong>
                  </div>
                ) : (
                  <div className={styles.detailRow}>
                    <span>
                      Categoría
                    </span>

                    <strong>
                      {serverVersion.category ||
                        "General"}
                    </strong>
                  </div>
                )}

                <div className={styles.detailRow}>
                  <span>Fecha</span>

                  <strong>
                    {formatDate(
                      serverVersion.date
                    )}
                  </strong>
                </div>
              </div>
            ) : (
              <div className={styles.missingCloudVersion}>
                <i className="bi bi-cloud-slash"></i>

                <div>
                  <strong>
                    {isCreateConflict
                      ? "Este movimiento todavía no existe en la nube"
                      : "El movimiento ya no existe en la nube"}
                  </strong>

                  <span>
                    {isCreateConflict
                      ? "El estado actual de la nube impidió que pudiera aplicarse."
                      : "Fue eliminado desde otro dispositivo antes de que este cambio pudiera sincronizarse."}
                  </span>
                </div>
              </div>
            )}
          </article>
        </div>

        {!isOnline && (
          <div className={styles.offlineWarning}>
            <i className="bi bi-wifi-off"></i>

            <span>
              Volvé a conectarte a internet para resolver el conflicto.
            </span>
          </div>
        )}

        {message && (
          <div
            className={styles.errorMessage}
            role="alert"
          >
            {message}
          </div>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              resolveConflict(
                "server"
              )
            }
            disabled={
              Boolean(busyAction) ||
              !isOnline
            }
          >
            {busyAction === "server" ? (
              <>
                <i className="bi bi-arrow-repeat"></i>
                Resolviendo...
              </>
            ) : (
              <>
                <i className="bi bi-cloud-check"></i>
                {cloudLabel}
              </>
            )}
          </button>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={() =>
              resolveConflict(
                "local"
              )
            }
            disabled={
              Boolean(busyAction) ||
              !isOnline
            }
          >
            {busyAction === "local" ? (
              <>
                <i className="bi bi-arrow-repeat"></i>
                Sincronizando...
              </>
            ) : (
              <>
                <i className="bi bi-device-ssd"></i>
                {keepLocalLabel}
              </>
            )}
          </button>
        </div>

        {isUpdateConflict &&
          !serverVersion && (
            <p className={styles.helperText}>
              Si conservás tu versión, MoneyTrack volverá a crear el movimiento como uno nuevo.
            </p>
          )}
      </section>
    </div>
  );
}

export default SyncConflictModal;
