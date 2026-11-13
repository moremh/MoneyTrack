// Mismo criterio de búsqueda en Ingresos, Gastos, Reportes y búsqueda global.
export const normalizeSearch = (value) => String(value || "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[$€£]/g, "").toLocaleLowerCase("es").trim();

export function matchesMovement(movement, filters = {}, annotations = {}, accountName = "") {
  if (filters.fromDate && movement.date < filters.fromDate) return false;
  if (filters.toDate && movement.date > filters.toDate) return false;
  if (filters.category && movement.category !== filters.category) return false;
  if (filters.accountId === "__none__" && movement.accountId) return false;
  if (filters.accountId && filters.accountId !== "__none__" && movement.accountId !== filters.accountId) return false;
  const amount = Number(movement.amount) || 0;
  if (filters.minAmount !== "" && filters.minAmount != null && amount < Number(filters.minAmount)) return false;
  if (filters.maxAmount !== "" && filters.maxAmount != null && amount > Number(filters.maxAmount)) return false;
  const annotation = annotations[movement.id] || {};
  if (filters.tag && !(annotation.tags || []).some(tag => normalizeSearch(tag) === normalizeSearch(filters.tag))) return false;
  const query = normalizeSearch(filters.query);
  if (query) {
    const fields = [movement.description, movement.category, movement.date, amount.toString(),
      new Intl.NumberFormat("es-AR").format(amount), accountName,
      annotation.notes, ...(annotation.tags || [])];
    if (!fields.some(value => normalizeSearch(value).includes(query))) return false;
  }
  return true;
}
export function orderMovements(movements, order="recent") {
  return [...movements].sort((a,b) => {
    if (order === "amount-desc") return Number(b.amount) - Number(a.amount);
    if (order === "amount-asc") return Number(a.amount) - Number(b.amount);
    if (order === "oldest") return String(a.createdAt || a.date).localeCompare(String(b.createdAt || b.date));
    return String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date));
  });
}
