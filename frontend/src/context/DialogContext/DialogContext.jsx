import {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import { createPortal } from "react-dom";

import styles from "./DialogContext.module.css";

export const DialogContext =
  createContext(null);

function DialogProvider({
  children,
}) {
  const [
    dialog,
    setDialog,
  ] = useState(null);

  const resolverRef =
    useRef(null);

  const closeDialog =
    useCallback(
      (result) => {
        setDialog(null);

        if (
          resolverRef.current
        ) {
          resolverRef.current(
            result
          );

          resolverRef.current =
            null;
        }
      },
      []
    );

  const confirmDialog =
    useCallback(
      ({
        title =
          "Confirmar acción",
        message,
        confirmText =
          "Confirmar",
        cancelText =
          "Cancelar",
        danger = false,
      }) =>
        new Promise(
          (resolve) => {
            resolverRef.current =
              resolve;

            setDialog({
              type: "confirm",
              title,
              message,
              confirmText,
              cancelText,
              danger,
            });
          }
        ),
      []
    );

  const alertDialog =
    useCallback(
      ({
        title = "Aviso",
        message,
        confirmText =
          "Aceptar",
        danger = false,
      }) =>
        new Promise(
          (resolve) => {
            resolverRef.current =
              resolve;

            setDialog({
              type: "alert",
              title,
              message,
              confirmText,
              danger,
            });
          }
        ),
      []
    );

  const value =
    useMemo(
      () => ({
        confirmDialog,
        alertDialog,
      }),
      [
        confirmDialog,
        alertDialog,
      ]
    );

  return (
    <DialogContext.Provider
      value={value}
    >
      {children}

      {dialog &&
        createPortal(
          <div
            className={styles.dialogOverlay}
            onClick={() =>
              closeDialog(
                dialog.type === "confirm"
                  ? false
                  : true
              )
            }
          >
            <div
              className={styles.dialogModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="dialog-context-title"
              aria-describedby="dialog-context-description"
              onClick={(event) =>
                event.stopPropagation()
              }
            >
              <button
                className={styles.closeButton}
                type="button"
                aria-label="Cerrar diálogo"
                onClick={() =>
                  closeDialog(
                    dialog.type === "confirm"
                      ? false
                      : true
                  )
                }
              >
                <i className="bi bi-x-lg"></i>
              </button>

              <div
                className={
                  styles.dialog
                }
              >
            <div
              className={`${styles.icon} ${
                dialog.danger
                  ? styles.dangerIcon
                  : styles.infoIcon
              }`}
            >
              <i
                className={
                  dialog.danger
                    ? "bi bi-exclamation-triangle"
                    : "bi bi-info-circle"
                }
              ></i>
            </div>

            <div
              className={
                styles.content
              }
            >
              <h2 id="dialog-context-title">
                {dialog.title}
              </h2>

              <p id="dialog-context-description">
                {dialog.message}
              </p>
            </div>

            <div
              className={
                styles.actions
              }
            >
              {dialog.type ===
                "confirm" && (
                <button
                  type="button"
                  className={
                    styles.cancelButton
                  }
                  onClick={() =>
                    closeDialog(
                      false
                    )
                  }
                >
                  {
                    dialog.cancelText
                  }
                </button>
              )}

              <button
                type="button"
                className={`${styles.confirmButton} ${
                  dialog.danger
                    ? styles.dangerButton
                    : ""
                }`}
                onClick={() =>
                  closeDialog(true)
                }
              >
                {
                  dialog.confirmText
                }
              </button>
            </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DialogContext.Provider>
  );
}

export default DialogProvider;