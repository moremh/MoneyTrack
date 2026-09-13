import {
  useContext,
  useMemo,
  useState,
} from "react";

import { FinanceContext } from "../../context/FinanceContext";

import {
  CATEGORY_ICONS,
  CATEGORY_QUICK_COLORS,
  getCategoryDisplayColor,
  getCategoryDisplayIcon,
  getContrastTextColor,
  getDefaultCategoryIcon,
  getRandomCategoryColor,
} from "../../utils/categoryCustomization";

import styles from "./Categories.module.css";

function createDraft(type) {
  return {
    name: "",
    color: getRandomCategoryColor(),
    icon: getDefaultCategoryIcon(type),
  };
}

function CategoryStylePicker({
  color,
  icon,
  onColorChange,
  onIconChange,
  disabled = false,
}) {
  return (
    <div className={styles.stylePicker}>
      <div className={styles.pickerGroup}>
        <span className={styles.pickerLabel}>
          Ícono
        </span>

        <div
          className={styles.iconGrid}
          role="group"
          aria-label="Elegir ícono de la categoría"
        >
          {CATEGORY_ICONS.map((option) => {
            const selected =
              option.value === icon;

            return (
              <button
                key={option.value}
                type="button"
                className={`${styles.iconOption} ${
                  selected
                    ? styles.selectedIconOption
                    : ""
                }`}
                onClick={() =>
                  onIconChange(option.value)
                }
                disabled={disabled}
                title={option.label}
                aria-label={option.label}
                aria-pressed={selected}
              >
                <i className={option.value}></i>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.pickerGroup}>
        <span className={styles.pickerLabel}>
          Color
        </span>

        <div
          className={styles.colorControls}
          role="group"
          aria-label="Elegir color de la categoría"
        >
          <div className={styles.colorGrid}>
            {CATEGORY_QUICK_COLORS.map(
              (option) => {
                const selected =
                  option.toLowerCase() ===
                  String(color || "").toLowerCase();

                return (
                  <button
                    key={option}
                    type="button"
                    className={`${styles.colorOption} ${
                      selected
                        ? styles.selectedColorOption
                        : ""
                    }`}
                    style={{
                      "--swatch-color": option,
                    }}
                    onClick={() =>
                      onColorChange(option)
                    }
                    disabled={disabled}
                    aria-label={`Elegir color ${option}`}
                    aria-pressed={selected}
                  >
                    <span></span>
                  </button>
                );
              }
            )}
          </div>

          <label
            className={`${styles.moreColorsButton} ${
              disabled
                ? styles.disabledControl
                : ""
            }`}
          >
            <i className="bi bi-palette"></i>
            <span>Más colores</span>

            <input
              className={styles.nativeColorInput}
              type="color"
              value={color}
              onChange={(event) =>
                onColorChange(event.target.value)
              }
              disabled={disabled}
              aria-label="Abrir selector de colores"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function CategoryPreview({
  name,
  color,
  icon,
  type,
}) {
  const safeColor =
    getCategoryDisplayColor({
      name,
      color,
      type,
    });

  const safeIcon =
    icon || getDefaultCategoryIcon(type);

  return (
    <div className={styles.previewRow}>
      <span className={styles.previewLabel}>
        Vista previa
      </span>

      <span
        className={styles.previewBadge}
        style={{
          "--category-color": safeColor,
          "--category-text":
            getContrastTextColor(safeColor),
        }}
      >
        <i className={safeIcon}></i>
        <span>
          {name.trim() || "Nueva categoría"}
        </span>
      </span>
    </div>
  );
}

function CategorySection({
  type,
  title,
  categories,
  onAdd,
  onUpdate,
  onDelete,
}) {
  const [draft, setDraft] = useState(() =>
    createDraft(type)
  );

  const [editingName, setEditingName] =
    useState(null);

  const [editDraft, setEditDraft] =
    useState(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [action, setAction] =
    useState("");

  const isBusy = Boolean(action);

  const typeLabel =
    type === "income"
      ? "ingreso"
      : "gasto";

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const hasDuplicateName = (
    name,
    ignoredName = null
  ) => {
    const normalized =
      name.trim().toLowerCase();

    return categories.some((category) => {
      if (
        ignoredName &&
        category.name.toLowerCase() ===
          ignoredName.toLowerCase()
      ) {
        return false;
      }

      return (
        category.name.toLowerCase() ===
        normalized
      );
    });
  };

  const handleAdd = async (event) => {
    event.preventDefault();

    if (isBusy) {
      return;
    }

    clearMessages();

    const name = draft.name.trim();

    if (!name) {
      setError(
        `Debes escribir un nombre para la categoría de ${typeLabel}.`
      );
      return;
    }

    if (hasDuplicateName(name)) {
      setError(
        `Esa categoría de ${typeLabel} ya existe.`
      );
      return;
    }

    setAction("add");

    try {
      const result = await onAdd({
        name,
        color: draft.color,
        icon: draft.icon,
      });

      if (!result?.success) {
        setError(
          result?.message ||
            `No se pudo agregar la categoría de ${typeLabel}.`
        );
        return;
      }

      setDraft(createDraft(type));

      setMessage(
        result.message ||
          `Categoría de ${typeLabel} agregada correctamente.`
      );
    } catch (caughtError) {
      console.error(
        `No se pudo agregar la categoría de ${typeLabel}:`,
        caughtError
      );

      setError(
        `No se pudo agregar la categoría de ${typeLabel}. Volvé a intentarlo.`
      );
    } finally {
      setAction("");
    }
  };

  const startEdit = (category) => {
    if (isBusy || category.isProtected) {
      return;
    }

    clearMessages();

    setEditingName(category.name);
    setEditDraft({
      name: category.name,
      color: getCategoryDisplayColor(category),
      icon: getCategoryDisplayIcon(
        category,
        type
      ),
    });
  };

  const cancelEdit = () => {
    if (isBusy) {
      return;
    }

    setEditingName(null);
    setEditDraft(null);
    clearMessages();
  };

  const saveEdit = async (
    originalCategory
  ) => {
    if (isBusy || !editDraft) {
      return;
    }

    clearMessages();

    const name =
      editDraft.name.trim();

    if (!name) {
      setError(
        "El nombre de la categoría no puede estar vacío."
      );
      return;
    }

    if (
      hasDuplicateName(
        name,
        originalCategory.name
      )
    ) {
      setError(
        `Ya existe otra categoría de ${typeLabel} con ese nombre.`
      );
      return;
    }

    const originalColor =
      getCategoryDisplayColor(
        originalCategory
      );

    const originalIcon =
      getCategoryDisplayIcon(
        originalCategory,
        type
      );

    if (
      name.toLowerCase() ===
        originalCategory.name.toLowerCase() &&
      editDraft.color === originalColor &&
      editDraft.icon === originalIcon
    ) {
      cancelEdit();
      return;
    }

    setAction(
      `edit-${originalCategory.name}`
    );

    try {
      const result = await onUpdate(
        originalCategory.name,
        {
          name,
          color: editDraft.color,
          icon: editDraft.icon,
        }
      );

      if (!result?.success) {
        setError(
          result?.message ||
            `No se pudo actualizar la categoría de ${typeLabel}.`
        );
        return;
      }

      setEditingName(null);
      setEditDraft(null);

      setMessage(
        result.message ||
          `Categoría de ${typeLabel} actualizada correctamente.`
      );
    } catch (caughtError) {
      console.error(
        `No se pudo actualizar la categoría de ${typeLabel}:`,
        caughtError
      );

      setError(
        `No se pudo actualizar la categoría de ${typeLabel}. Volvé a intentarlo.`
      );
    } finally {
      setAction("");
    }
  };

  const handleDelete = async (
    category
  ) => {
    if (isBusy || category.isProtected) {
      return;
    }

    clearMessages();

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la categoría "${category.name}"? Los movimientos asociados pasarán a la categoría General.`
    );

    if (!confirmed) {
      return;
    }

    setAction(`delete-${category.name}`);

    try {
      const result = await onDelete(
        category.name
      );

      if (!result?.success) {
        setError(
          result?.message ||
            `No se pudo eliminar la categoría de ${typeLabel}.`
        );
        return;
      }

      if (editingName === category.name) {
        setEditingName(null);
        setEditDraft(null);
      }

      setMessage(
        result.message ||
          `Categoría de ${typeLabel} eliminada correctamente.`
      );
    } catch (caughtError) {
      console.error(
        `No se pudo eliminar la categoría de ${typeLabel}:`,
        caughtError
      );

      setError(
        `No se pudo eliminar la categoría de ${typeLabel}. Volvé a intentarlo.`
      );
    } finally {
      setAction("");
    }
  };

  return (
    <section
      className={styles.card}
      aria-busy={isBusy}
    >
      <div className={styles.cardHeader}>
        <div>
          <h2 className={styles.cardTitle}>
            {title}
          </h2>

          <p className={styles.cardHint}>
            El color y el ícono son opcionales. Si no los cambiás, MoneyTrack usa una opción automática.
          </p>
        </div>
      </div>

      {error && (
        <div
          className={`${styles.message} ${styles.errorMessage}`}
          role="alert"
        >
          <i className="bi bi-exclamation-circle"></i>
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div
          className={`${styles.message} ${styles.successMessage}`}
          role="status"
        >
          <i className="bi bi-check-circle"></i>
          <span>{message}</span>
        </div>
      )}

      <form
        className={styles.createBox}
        onSubmit={handleAdd}
      >
        <div className={styles.addRow}>
          <input
            className={styles.input}
            type="text"
            placeholder={`Nueva categoría de ${typeLabel}`}
            value={draft.name}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                name: event.target.value,
              }));
              clearMessages();
            }}
            disabled={isBusy}
          />

          <button
            className={styles.addButton}
            type="submit"
            disabled={isBusy}
          >
            <i
              className={
                action === "add"
                  ? "bi bi-hourglass-split"
                  : "bi bi-plus-circle"
              }
            ></i>

            {action === "add"
              ? "Agregando..."
              : "Agregar"}
          </button>
        </div>

        <details
          className={styles.customizationDetails}
        >
          <summary>
            <i className="bi bi-palette2"></i>
            Personalizar color e ícono
          </summary>

          <div className={styles.customizationContent}>
            <CategoryStylePicker
              color={draft.color}
              icon={draft.icon}
              onColorChange={(color) =>
                setDraft((current) => ({
                  ...current,
                  color,
                }))
              }
              onIconChange={(icon) =>
                setDraft((current) => ({
                  ...current,
                  icon,
                }))
              }
              disabled={isBusy}
            />

            <CategoryPreview
              name={draft.name}
              color={draft.color}
              icon={draft.icon}
              type={type}
            />
          </div>
        </details>
      </form>

      <div className={styles.list}>
        {categories.map((category) => {
          const isEditing =
            editingName === category.name;

          const isSaving =
            action === `edit-${category.name}`;

          const isDeleting =
            action === `delete-${category.name}`;

          const displayColor =
            getCategoryDisplayColor(category);

          const displayIcon =
            getCategoryDisplayIcon(
              category,
              type
            );

          return (
            <div
              key={category.id || category.name}
              className={`${styles.item} ${
                isEditing
                  ? styles.editingItem
                  : ""
              }`}
            >
              {isEditing && editDraft ? (
                <div className={styles.editPanel}>
                  <input
                    className={styles.editInput}
                    type="text"
                    value={editDraft.name}
                    onChange={(event) => {
                      setEditDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                      clearMessages();
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                      }
                    }}
                    disabled={isBusy}
                    autoFocus
                  />

                  <CategoryStylePicker
                    color={editDraft.color}
                    icon={editDraft.icon}
                    onColorChange={(color) =>
                      setEditDraft((current) => ({
                        ...current,
                        color,
                      }))
                    }
                    onIconChange={(icon) =>
                      setEditDraft((current) => ({
                        ...current,
                        icon,
                      }))
                    }
                    disabled={isBusy}
                  />

                  <CategoryPreview
                    name={editDraft.name}
                    color={editDraft.color}
                    icon={editDraft.icon}
                    type={type}
                  />

                  <div className={styles.editActions}>
                    <button
                      className={styles.saveButton}
                      type="button"
                      onClick={() =>
                        void saveEdit(category)
                      }
                      disabled={isBusy}
                    >
                      <i
                        className={
                          isSaving
                            ? "bi bi-hourglass-split"
                            : "bi bi-check-lg"
                        }
                      ></i>
                      {isSaving
                        ? "Guardando..."
                        : "Guardar"}
                    </button>

                    <button
                      className={styles.cancelButton}
                      type="button"
                      onClick={cancelEdit}
                      disabled={isBusy}
                    >
                      <i className="bi bi-x-lg"></i>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.itemMain}>
                    <span
                      className={styles.categoryIcon}
                      style={{
                        "--category-color":
                          displayColor,
                        "--category-text":
                          getContrastTextColor(
                            displayColor
                          ),
                      }}
                    >
                      <i className={displayIcon}></i>
                    </span>

                    <div className={styles.itemText}>
                      <span className={styles.itemName}>
                        {category.name}
                      </span>

                      {category.isProtected && (
                        <span className={styles.systemLabel}>
                          Categoría general
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.actions}>
                    <button
                      className={styles.iconButton}
                      type="button"
                      onClick={() =>
                        startEdit(category)
                      }
                      disabled={
                        category.isProtected ||
                        isBusy
                      }
                      title={
                        category.isProtected
                          ? "La categoría General no se puede editar"
                          : "Editar"
                      }
                      aria-label={`Editar categoría ${category.name}`}
                    >
                      <i className="bi bi-pencil"></i>
                    </button>

                    <button
                      className={`${styles.iconButton} ${styles.deleteButton}`}
                      type="button"
                      onClick={() =>
                        void handleDelete(category)
                      }
                      disabled={
                        category.isProtected ||
                        isBusy
                      }
                      title={
                        category.isProtected
                          ? "La categoría General no se puede eliminar"
                          : "Eliminar"
                      }
                      aria-label={`Eliminar categoría ${category.name}`}
                    >
                      <i
                        className={
                          isDeleting
                            ? "bi bi-hourglass-split"
                            : "bi bi-trash"
                        }
                      ></i>
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Categories() {
  const {
    categoryRecords = [],

    addIncomeCategory,
    deleteIncomeCategory,
    updateIncomeCategory,

    addExpenseCategory,
    deleteExpenseCategory,
    updateExpenseCategory,
  } = useContext(FinanceContext);

  const incomeCategoryRecords =
    useMemo(() => {
      const records = categoryRecords.filter(
        (category) =>
          category.type === "income" &&
          category.name.toLowerCase() !==
            "general"
      );

      return [
        {
          id: "general-income",
          name: "General",
          type: "income",
          color: "#64748b",
          icon: "bi bi-tag",
          isProtected: true,
        },
        ...records,
      ];
    }, [categoryRecords]);

  const expenseCategoryRecords =
    useMemo(() => {
      const records = categoryRecords.filter(
        (category) =>
          category.type === "expense" &&
          category.name.toLowerCase() !==
            "general"
      );

      return [
        {
          id: "general-expense",
          name: "General",
          type: "expense",
          color: "#64748b",
          icon: "bi bi-tag",
          isProtected: true,
        },
        ...records,
      ];
    }, [categoryRecords]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Categorías
        </h1>

        <p className={styles.subtitle}>
          Organizá tus ingresos y gastos y personalizá cada categoría con un color y un ícono.
        </p>
      </div>

      <div className={styles.grid}>
        <CategorySection
          type="income"
          title="Categorías de ingresos"
          categories={incomeCategoryRecords}
          onAdd={addIncomeCategory}
          onUpdate={updateIncomeCategory}
          onDelete={deleteIncomeCategory}
        />

        <CategorySection
          type="expense"
          title="Categorías de gastos"
          categories={expenseCategoryRecords}
          onAdd={addExpenseCategory}
          onUpdate={updateExpenseCategory}
          onDelete={deleteExpenseCategory}
        />
      </div>
    </div>
  );
}

export default Categories;
