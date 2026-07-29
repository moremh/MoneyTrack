import styles from "./IncomeTable.module.css";

function IncomeTable({ incomes, onDelete, onEdit }) {
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
          {incomes.map((item) => (
            <tr key={item.id} className={styles.row}>
              <td>{item.description}</td>
              <td>{item.category}</td>
              <td>{item.date.split("-").reverse().join("/")}</td>
              <td className={styles.amount}>
                $ {Number(item.amount).toLocaleString("es-AR")}
              </td>

              <td className={styles.actionsCell}>
                <div className={styles.actions}>
                  <button type="button" onClick={() => onEdit(item)}>
                    <i className="bi bi-pencil"></i>
                  </button>

                  <button type="button" onClick={() => onDelete(item.id)}>
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default IncomeTable;