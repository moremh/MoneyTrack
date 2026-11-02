import { getLocalToday, isValidDateString } from "./dateUtils.js";

// Se supone un primer aporte durante el mes actual y uno cada mes siguiente.
// La fecha del aporte se mantiene en el mismo día del mes cuando exista
// (31 de enero -> 28 de febrero, por ejemplo).
const parseDate = (iso) => {
  if (!isValidDateString(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
};

const addMonths = (isoDate, count) => {
  const parsed = parseDate(isoDate);
  if (!parsed || !Number.isInteger(count) || count < 0) return null;
  const first = new Date(Date.UTC(parsed.year, parsed.month - 1 + count, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth() + 1;
  const endDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(parsed.day, endDay);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const remainingCentsFor = (targetAmount, currentAmount) => {
  const target = Number(targetAmount);
  const current = Number(currentAmount);
  if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(current)) return null;
  return Math.max(0, Math.round(target * 100) - Math.round(Math.max(0, current) * 100));
};

/**
 * Si el usuario elige una FECHA, se calcula el aporte mínimo mensual
 * sobre lo que FALTA ahorrar, no sobre la meta original completa.
 * Incluye un aporte posible hoy y después uno por mes hasta el plazo.
 */
export function calculateGoalMonthlySavings({
  targetAmount,
  currentAmount = 0,
  deadline,
  today = getLocalToday(),
}) {
  if (!parseDate(deadline) || !parseDate(today)) return null;
  const remainingCents = remainingCentsFor(targetAmount, currentAmount);
  if (remainingCents === null) return null;
  if (remainingCents === 0) {
    return { status: "completed", remainingAmount: 0, months: 0, monthlyAmount: 0 };
  }
  if (deadline < today) {
    return { status: "expired", remainingAmount: remainingCents / 100, months: 0, monthlyAmount: null };
  }

  const [deadlineYear, deadlineMonth] = deadline.split("-").map(Number);
  const [todayYear, todayMonth] = today.split("-").map(Number);
  const maxMonths = (deadlineYear - todayYear) * 12 + deadlineMonth - todayMonth + 1;
  let months = 0;
  for (let i = 0; i < maxMonths; i += 1) {
    const scheduled = addMonths(today, i);
    if (scheduled && scheduled <= deadline) months += 1;
  }
  // Si vence dentro del mes actual, un aporte inmediato sigue siendo posible.
  months = Math.max(1, months);
  return {
    status: "active",
    remainingAmount: remainingCents / 100,
    months,
    monthlyAmount: Math.ceil(remainingCents / months) / 100,
  };
}

/**
 * Si el usuario elige un APORTE MENSUAL, se estima cuántos aportes
 * necesita para cubrir lo pendiente y la fecha del último aporte.
 * Es una estimación, no un débito automático ni un calendario de pagos.
 */
export function calculateGoalCompletionDate({
  targetAmount,
  currentAmount = 0,
  monthlyAmount,
  today = getLocalToday(),
}) {
  if (!parseDate(today)) return null;
  const remainingCents = remainingCentsFor(targetAmount, currentAmount);
  const contribution = Number(monthlyAmount);
  if (remainingCents === null || !Number.isFinite(contribution) || contribution <= 0) return null;
  const contributionCents = Math.round(contribution * 100);
  if (!Number.isSafeInteger(contributionCents) || contributionCents <= 0) return null;
  if (remainingCents === 0) {
    return { status: "completed", remainingAmount: 0, months: 0, monthlyAmount: contribution, completionDate: today };
  }
  const months = Math.ceil(remainingCents / contributionCents);
  if (months > 1200) {
    return { status: "too_long", remainingAmount: remainingCents / 100, months, monthlyAmount: contribution, completionDate: null };
  }
  return {
    status: "active",
    remainingAmount: remainingCents / 100,
    months,
    monthlyAmount: contribution,
    completionDate: addMonths(today, months - 1),
  };
}
