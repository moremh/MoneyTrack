import { useContext } from "react";

import { FinanceContext } from "../../../context/FinanceContext";

import {
  getCategoryDisplayColor,
  getCategoryDisplayIcon,
  getContrastTextColor,
} from "../../../utils/categoryCustomization";

import styles from "./IncomeTable.module.css";

function IncomeTable({ incomes, onDelete, onEdit }) {
  const financeContext =
    useContext(FinanceContext);

  const categoryRecords =
    financeContext?.categoryRecords || [];

  const findCategory = (item) => {
    if (item.categoryId) {
      const byId = categoryRecords.find(
        (category) =>
          category.id === item.categoryId
      );

      if (byId) {
        return byId;
      }
    }

    return (
      categoryRecords.find(
        (category) =>
          category.type === item.type &&
          category.name.toLowerCase() ===
            String(
              item.category || "General"
            ).toLowerCase()
      ) || {
        name: item.category || "General",
        type: item.type,
      }
    );
  };

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th>Descripción</th>
            <th>Categoría</th>
            <th>Fecha</th>
            <th>Monto</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {incomes.map((item) => {
            const category =
              findCategory(item);

            const categoryColor =
              getCategoryDisplayColor(
                category
              );

            const categoryIcon =
              getCategoryDisplayIcon(
                category,
                item.type
              );

            return (
              <tr
                key={item.id}
                className={styles.row}
              >
                <td>{item.description}</td>

                <td>
                  <span
                    className={
                      styles.categoryBadge
                    }
                    style={{
                      "--category-color":
                        categoryColor,
                      "--category-text":
                        getContrastTextColor(
                          categoryColor
                        ),
                    }}
                  >
                    <i
                      className={
                        categoryIcon
                      }
                    ></i>
                    <span>
                      {item.category ||
                        "General"}
                    </span>
                  </span>
                </td>

                <td>
                  {item.date
                    .split("-")
                    .reverse()
                    .join("/")}
                </td>

                <td className={styles.amount}>
                  ${" "}
                  {Number(
                    item.amount
                  ).toLocaleString(
                    "es-AR"
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
