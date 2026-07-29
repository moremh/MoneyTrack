import styles from "./Card.module.css";

function Card({ title, children }) {
  return (
    <section className={styles.card}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {children}
    </section>
  );
}

export default Card;