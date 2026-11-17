import { useContext } from "react";

import { FinanceContext } from "../../../context/FinanceContext";
import { AccountContext } from "../../../context/AccountContext";

import {
  formatRegionalCurrency,
  formatRegionalDate,
} from "../../../utils/regionalSettings";

import styles from "./IncomeTable.module.css";

function IncomeTable({ incomes, onDelete, onEdit, onDetails, onDuplicate }) {
  const financeContext =
    useContext(FinanceContext);

  const settings =
    financeContext?.settings || {};

  const accountContext =
    useContext(AccountContext);

  const accounts =
    accountContext?.accounts || [];

  const getAccountName = (
    item
  ) => {
    if (!item?.accountId) {
      return null;
    }

    return (
      accounts.find(
        (account) =>
          account.id ===
          item.accountId
      )?.name || "Cuenta"
    );
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th>Descripción</th>
            <th>Cuenta</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th aria-label="Acciones"></th>
          </tr>
        </thead>

        <tbody>
          {incomes.map((item) => {
            return (
              <tr
                key={item.id}
                className={styles.row}
              >
                <td className={styles.descriptionCell}>{item.description}</td>

                <td className={styles.accountCell}>
                  {getAccountName(item) ? (
                    <span
                      className={
                        styles.accountBadge
                      }
                    >
                      <i className="bi bi-wallet2"></i>
                      <span>
                        {getAccountName(
                          item
                        )}
                      </span>
                    </span>
                  ) : (
                    <span
                      className={
                        styles.noAccount
                      }
                    >
                      Saldo general
                    </span>
                  )}
                </td>

                <td className={styles.dateCell}>
                  {formatRegionalDate(item.date, settings)}
                  {item.createdAt && <small className={styles.recordedTime}>
                    Registrado {new Intl.DateTimeFormat("es-AR", {hour:"2-digit",minute:"2-digit",
                      timeZone: settings.timezone || "America/Argentina/Buenos_Aires"}).format(new Date(item.createdAt))}
                  </small>}
                </td>

                <td className={styles.amount}>
                  {formatRegionalCurrency(
                    item.amount,
                    settings
                  )}
                </td>

                <td
                  className={
                    styles.actionsCell
                  }
                >
                  <div
                    className={styles.actions}
                  >
                    <button type="button" onClick={() => onDetails?.(item)}
                      title="Ver detalles" aria-label={`Detalles de ${item.description}`}>
                      <i className="bi bi-info-circle" aria-hidden="true"></i> Detalles
                    </button>
                    <button type="button" onClick={() => onDuplicate?.(item)}
                      title="Duplicar movimiento" aria-label={`Duplicar ${item.description}`}>
                      <i className="bi bi-copy"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onEdit(item)
                      }
                      aria-label={`Editar ${
                        item.type === "expense"
                          ? "gasto"
                          : "ingreso"
                      } ${item.description}`}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        onDelete(item.id)
                      }
                      aria-label={`Eliminar ${
                        item.type === "expense"
                          ? "gasto"
                          : "ingreso"
                      } ${item.description}`}
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default IncomeTable;
