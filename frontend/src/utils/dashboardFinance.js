/**
 * Un solo origen de cálculos para tarjetas y gráficos de MoneyTrack.
 * Se redondea cada movimiento a centavos antes de acumular.
 */
export function toCents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function roundMoney(value) {
  return toCents(value) / 100;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  const verified = new Date(time);
  if (
    verified.getUTCFullYear() !== year ||
    verified.getUTCMonth() + 1 !== month ||
    verified.getUTCDate() !== day
  ) return null;
  return { year, month, day, time };
}

function inDateRange(date, fromDate, toDate) {
  return Boolean(validDate(date)) &&
    (!fromDate || date >= fromDate) &&
    (!toDate || date <= toDate);
}

/**
 * La reserva de un objetivo INDEPENDIENTE no toca el saldo contable de Cuentas.
 * La de un objetivo VINCULADO coincide con el saldo de la cuenta asignada.
 * Varios objetivos vinculados a una misma cuenta se cuentan una sola vez.
 */
export function calculateSavedTotals({
  goals = [],
  accountBalances = new Map(),
  includedAccountIds = new Set(),
}) {
  let totalSaved = 0;
  let reservedInIncluded = 0;
  const countedAccountIds = new Set();

  for (const goal of goals) {
    if (!goal.accountId) {
      const saved = Math.max(0, toCents(goal.currentAmount));
      totalSaved += saved;
      reservedInIncluded += saved;
      continue;
    }
    const id = String(goal.accountId);
    if (countedAccountIds.has(id)) continue;
    countedAccountIds.add(id);

    const balance = Math.max(0, toCents(
      accountBalances.get(goal.accountId) || 0
    ));
    totalSaved += balance;
    if (includedAccountIds.has(goal.accountId)) {
      reservedInIncluded += balance;
    }
  }
  return {
    totalSaved: totalSaved / 100,
    reservedInIncluded: reservedInIncluded / 100,
  };
}

/**
 * Todos los eventos que cambian AHORROS; mismo conjunto para tarjeta y gráfico.
 * Los saldos iniciales son stock previo y no aparecen como aportes del período.
 * Los movimientos entre dos cuentas ahorradas no alteran el ahorro total.
 */
export function getSavingsEvents({
  goals = [],
  goalMovements = [],
  transfers = [],
  incomes = [],
  expenses = [],
}) {
  const goalsById = new Map(goals.map(goal => [String(goal.id), goal]));
  const linkedAccounts = new Set(
    goals.filter(goal => goal.accountId).map(goal => String(goal.accountId))
  );
  const events = [];

  function add(date, amount, type, source) {
    const value = toCents(amount);
    if (!validDate(date) || value <= 0) return;
    events.push({ date, amount: value / 100, type, source });
  }

  for (const movement of goalMovements) {
    if (
      movement.isOpeningBalance ||
      movement.description === "Saldo inicial del objetivo"
    ) continue;
    if (goalsById.get(String(movement.goalId))?.accountId) continue;
    if (movement.type === "deposit" || movement.type === "withdrawal") {
      add(movement.date, movement.amount, movement.type, "manual-goal");
    }
  }

  for (const transfer of transfers) {
    const fromSaved = linkedAccounts.has(String(transfer.fromAccountId));
    const toSaved = linkedAccounts.has(String(transfer.toAccountId));
    if (fromSaved === toSaved) continue;
    add(transfer.date, transfer.amount, toSaved ? "deposit" : "withdrawal", "transfer");
  }

  // Una cuenta de ahorro también cambia al registrar ingresos/gastos DIRECTOS.
  // Estos movimientos ya están en las series verde/roja; registrarlos como ahorro
  // no los duplica contablemente, solo informa cuánto cambió la reserva.
  for (const income of incomes) {
    if (linkedAccounts.has(String(income.accountId))) {
      add(income.date, income.amount, "deposit", "linked-income");
    }
  }
  for (const expense of expenses) {
    if (linkedAccounts.has(String(expense.accountId))) {
      add(expense.date, expense.amount, "withdrawal", "linked-expense");
    }
  }
  return events;
}

export function filterSavingsEvents(events, fromDate = "", toDate = "") {
  return events.filter(event => inDateRange(event.date, fromDate, toDate));
}

export function calculatePeriodTotals(incomes = [], expenses = [], savingsEvents = []) {
  let incomeCents = 0;
  let expenseCents = 0;
  let depositedCents = 0;
  let withdrawnCents = 0;
  incomes.forEach(item => { if (validDate(item.date)) incomeCents += toCents(item.amount); });
  expenses.forEach(item => { if (validDate(item.date)) expenseCents += toCents(item.amount); });
  savingsEvents.forEach(event => {
    if (!validDate(event.date)) return;
    if (event.type === "withdrawal") withdrawnCents += toCents(event.amount);
    else if (event.type === "deposit") depositedCents += toCents(event.amount);
  });
  const savingsNetCents = depositedCents - withdrawnCents;
  return {
    income: incomeCents / 100,
    expenses: expenseCents / 100,
    balance: (incomeCents - expenseCents) / 100,
    savedDeposited: depositedCents / 100,
    savedWithdrawn: withdrawnCents / 100,
    savingsNet: savingsNetCents / 100,
    generatedAvailable: (incomeCents - expenseCents - savingsNetCents) / 100,
  };
}

const DAY = 86400000;
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function monthIndex(parts) {
  return parts.year * 12 + parts.month - 1;
}

function fromMonthIndex(index) {
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}

/** Agrupación que usa el gráfico; la suma final coincide con calculatePeriodTotals. */
export function buildFinanceSeries({
  incomes = [],
  expenses = [],
  savingsEvents = [],
  mode = "monthly",
  fromDate = "",
  toDate = "",
}) {
  const dates = [...incomes, ...expenses, ...savingsEvents]
    .map(item => item.date)
    .filter(date => validDate(date))
    .sort();
  // La vista historica llega hasta el mes actual, incluso sin movimientos.
  // La fila sin movimientos conserva ingresos/gastos en cero y el ahorro guardado.
  const todayDate = new Date();
  const today = [
    todayDate.getFullYear(),
    String(todayDate.getMonth() + 1).padStart(2, "0"),
    String(todayDate.getDate()).padStart(2, "0"),
  ].join("-");
  const lastRegistered = dates[dates.length - 1] || "";
  const start = validDate(fromDate || dates[0] || today);
  const end = validDate(toDate || (lastRegistered > today ? lastRegistered : today));
  if (!start || !end || end.time < start.time) return [];

  const daily = mode === "daily" && (end.time - start.time) <= 45 * DAY;
  const groups = new Map();
  const blank = () => ({ income: 0, expenses: 0, deposited: 0, withdrawn: 0 });

  function insert(items, target) {
    for (const item of items) {
      if (!inDateRange(item.date, fromDate, toDate)) continue;
      const p = validDate(item.date);
      if (p.time < start.time || p.time > end.time) continue;
      const key = daily ? item.date : `${p.year}-${String(p.month).padStart(2, "0")}`;
      const bucket = groups.get(key) || blank();
      bucket[target] += toCents(item.amount);
      groups.set(key, bucket);
    }
  }

  insert(incomes, "income");
  insert(expenses, "expenses");
  insert(savingsEvents.filter(x => x.type === "deposit"), "deposited");
  insert(savingsEvents.filter(x => x.type === "withdrawal"), "withdrawn");

  const rows = [];
  let balanceRunning = 0;
  let availableRunning = 0;
  function addRow(key, label, fullLabel) {
    const b = groups.get(key) || blank();
    const result = b.income - b.expenses;
    const netSaved = b.deposited - b.withdrawn;
    balanceRunning += result;
    availableRunning += result - netSaved;
    rows.push({
      clave: key,
      periodo: label,
      etiquetaCompleta: fullLabel,
      ingresos: b.income / 100,
      gastos: b.expenses / 100,
      gastosBarra: -b.expenses / 100,
      ahorroApartado: b.deposited / 100,
      ahorroRetirado: b.withdrawn / 100,
      ahorroNeto: netSaved / 100,
      // Conserva este dato legado para las comprobaciones financieras existentes.
      ahorroBarra: -netSaved / 100,
      // REPRESENTACIÓN VISUAL DEL AHORRO, independiente del saldo disponible:
      // + al reservar dinero, - al retirarlo. Ambos aparecen aunque se compensen.
      ahorroDepositoBarra: b.deposited / 100,
      ahorroRetiroBarra: b.withdrawn > 0 ? -b.withdrawn / 100 : 0,
      resultado: result / 100,
      disponibleGenerado: (result - netSaved) / 100,
      acumulado: balanceRunning / 100,
      disponibleAcumulado: availableRunning / 100,
    });
  }

  if (daily) {
    for (let time = start.time; time <= end.time; time += DAY) {
      const day = new Date(time);
      const iso = day.toISOString().slice(0, 10);
      const number = String(day.getUTCDate()).padStart(2, "0");
      const month = String(day.getUTCMonth() + 1).padStart(2, "0");
      addRow(iso, String(day.getUTCDate()), `${number}/${month}/${day.getUTCFullYear()}`);
    }
  } else {
    for (let index = monthIndex(start); index <= monthIndex(end); index++) {
      const p = fromMonthIndex(index);
      const key = `${p.year}-${String(p.month).padStart(2, "0")}`;
      const label = `${MONTHS[p.month - 1]} ${p.year}`;
      addRow(key, label, label);
    }
  }
  return rows;
}

/**
 * Cambios históricos del saldo DISPONIBLE (no del resultado del período).
 * - Las cuentas incluidas aportan sus ingresos/gastos, saldo inicial y transferencias.
 * - El ahorro manual reserva/libera dinero sin generar gasto/ingreso.
 * - El dinero que entra en una cuenta vinculada queda reservado automáticamente.
 * Se reconstruye desde el saldo actual para conservar el arrastre entre períodos.
 */
export function getAvailableChanges({
  accounts = [], incomes = [], expenses = [], transfers = [],
  goals = [], goalMovements = [],
}) {
  const included = new Set(
    accounts.filter(a => a.isActive && a.includeInBalance !== false)
      .map(a => String(a.id))
  );
  const linked = new Set(goals.filter(g => g.accountId).map(g => String(g.accountId)));
  const goalById = new Map(goals.map(g => [String(g.id), g]));
  const changes = [];
  function add(date, amount) {
    const cents = toCents(amount);
    if (validDate(date) && cents !== 0) changes.push({ date, amount: cents / 100 });
  }

  for (const account of accounts) {
    if (!included.has(String(account.id))) continue;
    const date = String(account.createdAt || '').slice(0, 10);
    // Si no hay fecha válida de creación, el saldo inicial permanece como base histórica.
    add(date, linked.has(String(account.id)) ? 0 : account.openingBalance);
  }
  for (const income of incomes) {
    const id = String(income.accountId);
    if (!included.has(id)) continue;
    add(income.date, linked.has(id) ? 0 : income.amount);
  }
  for (const expense of expenses) {
    const id = String(expense.accountId);
    if (!included.has(id)) continue;
    add(expense.date, linked.has(id) ? 0 : -(Number(expense.amount) || 0));
  }
  for (const transfer of transfers) {
    const amount = toCents(transfer.amount) / 100;
    const source = String(transfer.fromAccountId);
    const target = String(transfer.toAccountId);
    if (included.has(source) && !linked.has(source)) add(transfer.date, -amount);
    if (included.has(target) && !linked.has(target)) add(transfer.date, amount);
  }
  for (const movement of goalMovements) {
    if (movement.isOpeningBalance || movement.description === 'Saldo inicial del objetivo') continue;
    if (goalById.get(String(movement.goalId))?.accountId) continue;
    if (movement.type === 'deposit') add(movement.date, -(Number(movement.amount) || 0));
    if (movement.type === 'withdrawal') add(movement.date, movement.amount);
  }
  return changes;
}

/**
 * Ancla los puntos del gráfico a la tarjeta de Saldo general actual.
 * Si el rango termina hoy, el último punto coincide con esa tarjeta.
 * Para rangos pasados, muestra el saldo reconstruido al cierre de ese período.
 */
export function attachAvailableBalances(rows, availableChanges = [], currentAvailable = 0,
  fromDate = '', toDate = '', mode = 'monthly') {
  if (!rows.length) return rows;
  // Al usar meses, cada punto representa el último día del mes, salvo el mes final.
  const startDate = fromDate || (mode === 'daily' ? rows[0].clave : rows[0].clave + '-01');
  const endDate = toDate || (mode === 'daily' ? rows[rows.length - 1].clave : rows[rows.length - 1].clave + '-31');
  const groupKey = (date) => mode === 'daily' ? date : date.slice(0, 7);
  const totalsByKey = new Map();
  let afterEnd = 0;
  let inside = 0;

  for (const change of availableChanges) {
    if (!validDate(change.date)) continue;
    const cents = toCents(change.amount);
    if (change.date > endDate) { afterEnd += cents; continue; }
    if (change.date < startDate) continue;
    inside += cents;
    const key = groupKey(change.date);
    totalsByKey.set(key, (totalsByKey.get(key) || 0) + cents);
  }
  let running = toCents(currentAvailable) - afterEnd - inside;
  return rows.map(row => {
    // La variación real considera SOLO cuentas incluidas y reservas de ahorro.
    // No depende de que un ingreso/gasto sea registrado en una cuenta excluida.
    const variacion = totalsByKey.get(row.clave) || 0;
    running += variacion;
    return {
      ...row,
      variacionDisponible: variacion / 100,
      saldoDisponible: running / 100,
    };
  });
}


/**
 * Evolución de Ahorros: SIEMPRE se representa cuánto dinero está guardado,
 * nunca un movimiento negativo. La tarjeta Ahorros es la fuente del valor
 * de cierre; la historia se reconstruye retrocediendo aportes y retiros.
 *
 * No cambia ingresos, gastos ni saldo general, solo la representación visual.
 * Se usan TODOS los eventos para reconstruir los saldos anteriores al filtro.
 */
export function attachSavingsBalances(
  rows,
  savingsHistory = [],
  currentSavings = 0,
  fromDate = "",
  toDate = "",
  mode = "monthly",
) {
  if (!rows.length) return rows;

  const daily = mode === "daily";
  const firstDate = fromDate || (daily ? rows[0].clave : `${rows[0].clave}-01`);
  const lastDate = toDate || (
    daily ? rows[rows.length - 1].clave : `${rows[rows.length - 1].clave}-31`
  );
  const keyOf = (date) => daily ? date : date.slice(0, 7);

  let afterEndCents = 0;
  let insideCents = 0;
  const changesByKey = new Map();

  for (const event of savingsHistory) {
    if (!validDate(event.date)) continue;
    const cents = toCents(event.amount);
    if (cents <= 0) continue;
    const signed = event.type === "withdrawal" ? -cents : cents;

    if (event.date > lastDate) {
      afterEndCents += signed;
      continue;
    }
    if (event.date < firstDate) continue;
    insideCents += signed;
    const key = keyOf(event.date);
    changesByKey.set(key, (changesByKey.get(key) || 0) + signed);
  }

  // Ahorros al comenzar el filtro (incluye lo guardado en meses previos).
  let running = toCents(currentSavings) - afterEndCents - insideCents;

  return rows.map((row) => {
    running += changesByKey.get(row.clave) || 0;
    return {
      ...row,
      // No se visualiza una reserva por debajo de cero.
      ahorrosAcumulados: Math.max(0, running) / 100,
    };
  });
}
