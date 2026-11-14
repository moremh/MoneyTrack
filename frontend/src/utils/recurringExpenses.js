import { getLocalToday, isValidDateString } from "./dateUtils";

export const RECURRENCE_LABELS = {
  monthly: "Mensual", annual: "Anual", weekly: "Semanal", custom: "Cada cierta cantidad de días",
};

export function getPeriodKey(recurrence, date) {
  if (!isValidDateString(date)) return "";
  if (recurrence === "annual") return date.slice(0, 4);
  if (recurrence === "monthly") return date.slice(0, 7);
  if (recurrence === "weekly") {
    const utc = new Date(`${date}T12:00:00Z`);
    const day = utc.getUTCDay();
    utc.setUTCDate(utc.getUTCDate() - ((day + 6) % 7));
    return utc.toISOString().slice(0, 10);
  }
  return date;
}

export function periodLabel(key) {
  if (/^\d{4}$/.test(key)) return key;
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split("-");
    return `${month}/${year}`;
  }
  return formatSubscriptionDate(key);
}

export function formatSubscriptionDate(isoDate) {
  if (!isValidDateString(String(isoDate || ""))) return "Sin fecha";
  const [year, month, day] = isoDate.split("-");
  const thisYear = String(new Date().getFullYear());
  return `${day}/${month}/${year === thisYear ? year.slice(2) : year}`;
}

export function getRecurringMonthlyEstimate(item) {
  const amount = Number(item.amount) || 0;
  if (item.status !== "active") return 0;
  if (item.recurrence === "weekly") return amount * 52 / 12;
  if (item.recurrence === "annual") return amount / 12;
  if (item.recurrence === "custom") return amount * 365 / (12 * (Number(item.interval_days) || 30));
  return amount;
}

export function subscriptionStatus(item, payments = [], today = getLocalToday()) {
  if (item.status !== "active") return item.status;
  const paidPeriod = getPeriodKey(item.recurrence, item.next_due_on || today);
  if (payments.some(p => p.recurring_expense_id === item.id && p.period_key === paidPeriod)) return "paid";
  if (!item.next_due_on) return "unscheduled";
  return item.next_due_on < today ? "overdue" : "pending";
}

export function parseTagList(raw) {
  return [...new Set(String(raw || "").split(",").map(x => x.trim()).filter(Boolean))].slice(0, 12);
}
