import styles from "./RecentTransactions.module.css";

function RecentTransactions() {
  return (
    <div className={styles.card}>
      <h2>Últimos movimientos</h2>

      <ul className={styles.list}>
        <li>
          <span>Supermercado</span>
          <strong>-$18.500</strong>
        </li>

        <li>
          <span>Sueldo</span>
          <strong>+$240.000</strong>
        </li>

        <li>
          <span>Netflix</span>
          <strong>-$6.500</strong>
        </li>

        <li>
          <span>Combustible</span>
          <strong>-$15.000</strong>
        </li>
      </ul>
    </div>
  );
}

export default RecentTransactions;