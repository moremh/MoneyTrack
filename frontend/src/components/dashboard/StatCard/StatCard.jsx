import styles from "./StatCard.module.css";

function StatCard({ title, value, icon, color }) {
  return (
    <div
      className={styles.card}
      style={{ borderTop: `5px solid ${color}` }}
    >
      <div className={styles.top}>
        <span
          className={styles.icon}
          style={{ backgroundColor: color }}
        >
          <i className={icon}></i>
        </span>

        <span className={styles.title}>{title}</span>
      </div>

      <h2 className={styles.value}>{value}</h2>
    </div>
  );
}

export default StatCard;