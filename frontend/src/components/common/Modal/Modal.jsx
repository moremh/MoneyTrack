import styles from "./Modal.module.css";

function Modal({ children, onClose }) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className={styles.closeButton}
          type="button"
          onClick={onClose}
        >
          <i className="bi bi-x-lg"></i>
        </button>

        {children}
      </div>
    </div>
  );
}

export default Modal;