export const CATEGORY_DEFAULT_COLORS = [
  "#22c55e",
  "#2563eb",
  "#8b5cf6",
  "#64748b",
  "#ef4444",
  "#f59e0b",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#6366f1",
];

export const CATEGORY_QUICK_COLORS = [
  "#2563eb",
  "#3b82f6",
  "#0ea5e9",
  "#06b6d4",
  "#14b8a6",
  "#10b981",
  "#22c55e",
  "#84cc16",
  "#eab308",
  "#f59e0b",
  "#f97316",
  "#ef4444",
  "#f43f5e",
  "#ec4899",
  "#d946ef",
  "#a855f7",
  "#8b5cf6",
  "#6366f1",
  "#64748b",
  "#475569",
];

export const CATEGORY_ICONS = [
  { value: "bi bi-tag", label: "Etiqueta" },
  { value: "bi bi-cash-stack", label: "Dinero" },
  { value: "bi bi-wallet2", label: "Billetera" },
  { value: "bi bi-credit-card", label: "Tarjeta" },
  { value: "bi bi-bank", label: "Banco" },
  { value: "bi bi-briefcase", label: "Trabajo" },
  { value: "bi bi-laptop", label: "Freelance" },
  { value: "bi bi-graph-up-arrow", label: "Inversiones" },
  { value: "bi bi-basket", label: "Compras" },
  { value: "bi bi-cart3", label: "Supermercado" },
  { value: "bi bi-cup-hot", label: "Café" },
  { value: "bi bi-bus-front", label: "Transporte" },
  { value: "bi bi-car-front", label: "Auto" },
  { value: "bi bi-house", label: "Casa" },
  { value: "bi bi-receipt", label: "Servicios" },
  { value: "bi bi-heart-pulse", label: "Salud" },
  { value: "bi bi-book", label: "Educación" },
  { value: "bi bi-controller", label: "Entretenimiento" },
  { value: "bi bi-airplane", label: "Viajes" },
  { value: "bi bi-gift", label: "Regalos" },
  { value: "bi bi-piggy-bank", label: "Ahorro" },
  { value: "bi bi-trophy", label: "Deporte" },
  { value: "bi bi-activity", label: "Gimnasio" },
  { value: "bi bi-heart", label: "Pareja" },
  { value: "bi bi-robot", label: "Inteligencia artificial" },
  { value: "bi bi-stars", label: "Belleza / estética" },
  { value: "bi bi-cup-straw", label: "Salidas" },
  { value: "bi bi-fork-knife", label: "Comida" },
  { value: "bi bi-three-dots", label: "Otros" },
];

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const BOOTSTRAP_ICON_PATTERN = /^bi bi-[a-z0-9-]+$/i;

export function normalizeCategoryColor(value) {
  const color = String(value || "").trim();

  return HEX_COLOR_PATTERN.test(color)
    ? color.toLowerCase()
    : null;
}

export function normalizeCategoryIcon(value) {
  const icon = String(value || "").trim();

  return BOOTSTRAP_ICON_PATTERN.test(icon)
    ? icon
    : null;
}

export function getRandomCategoryColor() {
  const index = Math.floor(
    Math.random() * CATEGORY_DEFAULT_COLORS.length
  );

  return CATEGORY_DEFAULT_COLORS[index];
}

export function getDefaultCategoryIcon(type) {
  return type === "income"
    ? "bi bi-wallet2"
    : "bi bi-tag";
}

function hashText(value) {
  const text = String(value || "General");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getCategoryDisplayColor(category) {
  const savedColor = normalizeCategoryColor(
    category?.color
  );

  if (savedColor) {
    return savedColor;
  }

  if (
    String(category?.name || "").toLowerCase() ===
    "general"
  ) {
    return "#64748b";
  }

  const index =
    hashText(category?.name) %
    CATEGORY_DEFAULT_COLORS.length;

  return CATEGORY_DEFAULT_COLORS[index];
}

export function getCategoryDisplayIcon(category, type) {
  return (
    normalizeCategoryIcon(category?.icon) ||
    getDefaultCategoryIcon(type || category?.type)
  );
}

export function getContrastTextColor(color) {
  const normalized = normalizeCategoryColor(color);

  if (!normalized) {
    return "#ffffff";
  }

  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);

  const luminance =
    (0.299 * red + 0.587 * green + 0.114 * blue) /
    255;

  return luminance > 0.67
    ? "#0f172a"
    : "#ffffff";
}
