import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useSearchParams } from "react-router-dom";
import { FinanceContext } from "../../context/FinanceContext";
import { AccountContext } from "../../context/AccountContext";
import { supabase } from "../../lib/supabase";
import { useReminders } from "../../context/ReminderContext";
import { DialogContext } from "../../context/DialogContext/DialogContext";
import { formatAmountInput, formatStoredAmount, parseAmountInput } from "../../utils/amountUtils";
import { formatRegionalCurrency } from "../../utils/regionalSettings";
import { getLocalToday, isValidDateString } from "../../utils/dateUtils";
import { RECURRENCE_LABELS, getPeriodKey, periodLabel, formatSubscriptionDate, getRecurringMonthlyEstimate, subscriptionStatus, parseTagList } from "../../utils/recurringExpenses";
import Modal from "../../components/common/Modal/Modal";
import styles from "./Subscriptions.module.css";

const EMPTY_FORM = { name: "", amount: "", recurrence: "monthly", intervalDays: "30", nextDueOn: "", categoryName: "General", accountId: "", notes: "", tags: "", status: "active", reminderDaysBefore: "" };
const STATUS_TEXT = { active: "Activa", paused: "Pausada", cancelled: "Cancelada", paid: "Pagada", overdue: "Vencida", pending: "Pendiente", unscheduled: "Sin fecha" };

function Subscriptions() {
  const [searchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const { loadReminders } = useReminders();
  const { confirmDialog } = useContext(DialogContext) || {};
  const userId = currentUser?.id;
  const { settings = {}, expenses = [], expenseCategories = [], loadFinanceData, refreshMovementUsage } = useContext(FinanceContext);
  const { accounts = [] } = useContext(AccountContext) || {};
  const [items, setItems] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formItem, setFormItem] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [paymentItem, setPaymentItem] = useState(null);
  const [paymentMode, setPaymentMode] = useState("new");
  const [payAmount, setPayAmount] = useState("");
  const [payAccount, setPayAccount] = useState("");
  const [payDate, setPayDate] = useState("");
  const [periodDate, setPeriodDate] = useState(getLocalToday());
  const [existingExpenseId, setExistingExpenseId] = useState("");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [requestId, setRequestId] = useState("");
  const [historyItem, setHistoryItem] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [editingDate, setEditingDate] = useState("");
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  useEffect(() => { setQuery(searchParams.get("q") || ""); }, [searchParams]);

  const reload = useCallback(async () => {
    if (!userId) { setItems([]); setPayments([]); setLoading(false); return; }
    setLoading(true);
    const [a, b] = await Promise.all([
      supabase.from("recurring_expenses").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
      supabase.from("recurring_expense_payments").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    ]);
    if (a.error || b.error) {
      setError("No se pudieron cargar las suscripciones. Comprobá que la migración 030 esté aplicada en Supabase.");
    } else {
      setItems(a.data || []); setPayments(b.data || []); setError("");
    }
    setLoading(false);
  }, [userId]);
  useEffect(() => { void reload(); }, [reload]);

  const money = useCallback(value => formatRegionalCurrency(value, settings), [settings]);
  const monthlyEstimate = useMemo(() => items.reduce((sum, x) => sum + getRecurringMonthlyEstimate(x), 0), [items]);
  const thisMonth = getLocalToday().slice(0, 7);
  const paidThisMonth = useMemo(() => payments.reduce((sum, p) => {
    const txn = expenses.find(x => x.id === p.transaction_id);
    const date = txn?.date || p.paid_on || p.created_at?.slice(0, 10) || "";
    return sum + (date.slice(0, 7) === thisMonth ? Number(txn?.amount ?? p.amount) || 0 : 0);
  }, 0), [payments, expenses, thisMonth]);
  const filtered = useMemo(() => items.filter(item => {
    const label = subscriptionStatus(item, payments);
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.status === "active" : label === statusFilter);
    const needle = query.trim().toLocaleLowerCase("es-AR");
    return matchesStatus && (!needle || `${item.name} ${item.category_name} ${item.notes} ${(item.tags || []).join(" ")}`.toLocaleLowerCase("es-AR").includes(needle));
  }), [items, payments, statusFilter, query]);
  const linkedTransactionIds = useMemo(() => new Set(payments.map(p => p.transaction_id)), [payments]);
  const availableExpenses = useMemo(() => expenses.filter(x => {
    if (x.isPendingSync || linkedTransactionIds.has(x.id)) return false;
    const text = `${x.description || ""} ${x.category || ""} ${x.amount || ""}`.toLocaleLowerCase("es-AR");
    return text.includes(expenseSearch.trim().toLocaleLowerCase("es-AR"));
  }).slice(0, 75), [expenses, linkedTransactionIds, expenseSearch]);
  const formAmount = value => formatAmountInput(value, "", settings);
  const parseMoney = value => parseAmountInput(value, settings);

  const openForm = (item = null) => {
    setFormItem(item);
    setForm(item ? {
      name: item.name, amount: formatStoredAmount(item.amount, settings), recurrence: item.recurrence,
      intervalDays: String(item.interval_days || 30), nextDueOn: item.next_due_on || "", categoryName: item.category_name,
      accountId: item.default_account_id || "", notes: item.notes || "", tags: (item.tags || []).join(", "), status: item.status, reminderDaysBefore: item.reminder_days_before === null ? "" : String(item.reminder_days_before),
    } : { ...EMPTY_FORM });
    setError(""); setFormOpen(true);
  };

  const saveForm = async event => {
    event.preventDefault();
    if (saving) return;
    const amount = parseMoney(form.amount);
    if (!form.name.trim() || form.name.trim().length > 100 || !Number.isFinite(amount) || amount <= 0 || amount > 999999999999.99 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.0001) {
      setError("Ingresá un nombre y un importe válido mayor que cero."); return;
    }
    if (form.nextDueOn && !isValidDateString(form.nextDueOn)) { setError("La fecha de vencimiento no es válida."); return; }
    const payload = {
      name: form.name.trim(), amount: Math.round(amount * 100) / 100, recurrence: form.recurrence,
      interval_days: form.recurrence === "custom" ? Number(form.intervalDays) : null,
      next_due_on: form.nextDueOn || null,
      category_name: form.categoryName.trim() || "General", default_account_id: form.accountId || null,
      notes: form.notes.trim().slice(0, 2000), tags: parseTagList(form.tags), status: form.status,
      reminder_days_before: form.reminderDaysBefore === "" ? null : Number(form.reminderDaysBefore),
    };
    if (payload.recurrence === "custom" && (!Number.isInteger(payload.interval_days) || payload.interval_days < 1 || payload.interval_days > 3650)) {
      setError("Indicá una cantidad válida de días entre 1 y 3650."); return;
    }
    if (!payload.next_due_on) payload.reminder_days_before = null;
    setSaving(true); setError("");
    const result = formItem
      ? await supabase.from("recurring_expenses").update(payload).eq("id", formItem.id).eq("user_id", userId).select("id").single()
      : await supabase.from("recurring_expenses").insert({ ...payload, user_id: userId }).select("id").single();
    setSaving(false);
    if (result.error) { setError(`No se pudo guardar la suscripción: ${result.error.message}`); return; }
    setFormOpen(false); setNotice("Suscripción guardada correctamente."); await Promise.all([reload(), loadReminders()]);
  };

  const removeItem = async item => {
    const message = `¿Eliminar la suscripción «${item.name}»? Los gastos registrados permanecerán en Gastos, pero se eliminará su historial de vinculación.`;
    const confirmed = confirmDialog ? await confirmDialog({ title: "Eliminar suscripción", message, confirmText: "Eliminar", cancelText: "Cancelar", danger: true }) : window.confirm(message);
    if (!confirmed) return;
    const { error: dbError } = await supabase.from("recurring_expenses").delete().eq("id", item.id).eq("user_id", userId);
    if (dbError) { setError(dbError.message); return; }
    setNotice("Suscripción eliminada. Los gastos históricos se conservaron."); await Promise.all([reload(), loadReminders()]);
  };

  const openPay = item => {
    setPaymentItem(item); setPaymentMode("new"); setPayAmount(formatStoredAmount(item.amount, settings));
    setPayAccount(item.default_account_id || ""); setPayDate(""); setPeriodDate(item.next_due_on || getLocalToday());
    setExistingExpenseId(""); setExpenseSearch(""); setPayNotes(""); setRequestId(window.crypto.randomUUID()); setError("");
  };

  const savePayment = async event => {
    event.preventDefault();
    if (saving || !paymentItem) return;
    if (!navigator.onLine) { setError("Para confirmar una suscripción necesitás conexión. Así evitamos gastos duplicados."); return; }
    const key = getPeriodKey(paymentItem.recurrence, periodDate);
    if (!key) { setError("Seleccioná un período válido para identificar este pago."); return; }
    if (payments.some(p => p.recurring_expense_id === paymentItem.id && p.period_key === key)) {
      setError(`Ya existe un pago para el período ${periodLabel(key)}.`); return;
    }
    if (payDate && !isValidDateString(payDate)) { setError("La fecha real de pago no es válida."); return; }
    if (payDate && payDate > getLocalToday()) { setError("La fecha de pago no puede ser futura."); return; }
    const amount = parseMoney(payAmount);
    if (paymentMode === "new" && (!Number.isFinite(amount) || amount <= 0)) { setError("Ingresá el importe abonado."); return; }
    if (paymentMode === "existing" && !existingExpenseId) { setError("Seleccioná un gasto existente."); return; }
    setSaving(true); setError("");
    const rpc = paymentMode === "new"
      ? await supabase.rpc("register_recurring_expense_payment", {
          p_recurring_expense_id: paymentItem.id, p_period_key: key, p_amount: Math.round(amount * 100) / 100,
          p_account_id: payAccount || null, p_paid_on: payDate || null, p_notes: payNotes.trim(), p_request_id: requestId,
        })
      : await supabase.rpc("link_recurring_expense_transaction", {
          p_recurring_expense_id: paymentItem.id, p_transaction_id: existingExpenseId, p_period_key: key,
          p_paid_on: payDate || null,
        });
    setSaving(false);
    if (rpc.error) {
      const message = rpc.error.message?.includes("FREE_LIMIT_REACHED")
        ? "Alcanzaste el límite mensual de movimientos de tu plan."
        : `No se pudo registrar el pago: ${rpc.error.message}`;
      setError(message); return;
    }
    setPaymentItem(null); setNotice(paymentMode === "new" ? "Pago registrado también en Gastos." : "Gasto existente vinculado sin registrarlo dos veces.");
    await Promise.all([reload(), loadFinanceData(), loadReminders(), refreshMovementUsage?.()]);
    window.dispatchEvent(new Event("moneytrack:annotations-changed"));
  };

  const undoPayment = async payment => {
    const message = payment.source === "created"
      ? "¿Anular este pago? También se eliminará el gasto creado por Suscripciones y se corregirá el saldo."
      : "¿Desvincular este pago? El gasto original permanecerá en Gastos.";
    const confirmed = confirmDialog ? await confirmDialog({ title: "Anular pago", message, confirmText: "Confirmar", cancelText: "Cancelar", danger: true }) : window.confirm(message);
    if (!confirmed) return;
    const { error: dbError } = await supabase.rpc("undo_recurring_expense_payment", { p_payment_id: payment.id });
    if (dbError) { setError(dbError.message); return; }
    setNotice("Pago actualizado correctamente."); await Promise.all([reload(), loadFinanceData(), loadReminders(), refreshMovementUsage?.()]);
  };

  const updatePaymentDate = async event => {
    event.preventDefault();
    if (!editingPayment || saving) return;
    if (editingDate && (!isValidDateString(editingDate) || editingDate > getLocalToday())) { setError("La fecha real de pago no es válida."); return; }
    setSaving(true);
    const { error: dbError } = await supabase.rpc("update_recurring_payment_date", { p_payment_id: editingPayment.id, p_paid_on: editingDate || null });
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    setEditingPayment(null); setNotice("Fecha actualizada."); await Promise.all([reload(), loadFinanceData()]);
  };

  const switchStatus = async (item, status) => {
    const { error: dbError } = await supabase.from("recurring_expenses").update({ status }).eq("id", item.id).eq("user_id", userId);
    if (dbError) { setError(dbError.message); return; }
    await Promise.all([reload(), loadReminders()]);
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>Pagos recurrentes</span><h1>Suscripciones</h1><p>Organizá tus servicios y registrá sus pagos directamente en Gastos. Las fechas son opcionales.</p></div>
        <button className={styles.primary} onClick={() => openForm()}>+ Agregar suscripción</button>
      </header>

      <div className={styles.metrics}>
        <div className={styles.metric}><small>Estimado mensual</small><strong>{money(monthlyEstimate)}</strong><span>Aproximado, según la frecuencia</span></div>
        <div className={styles.metric}><small>Pagado este mes</small><strong>{money(paidThisMonth)}</strong><span>Movimientos registrados</span></div>
        <div className={styles.metric}><small>Suscripciones activas</small><strong>{items.filter(x => x.status === "active").length}</strong><span>Servicios en seguimiento</span></div>
        <div className={styles.metric}><small>Vencidas</small><strong>{items.filter(x => subscriptionStatus(x, payments) === "overdue").length}</strong><span>Solo las que tienen fecha</span></div>
      </div>
      {notice && <p className={styles.success} role="status">{notice}<button onClick={() => setNotice("")}>Cerrar</button></p>}
      {error && <p className={styles.error} role="alert">{error}<button onClick={() => setError("")}>Cerrar</button></p>}
      <div className={styles.filters}>
        <label>Buscar servicio<input placeholder="Netflix, gimnasio, Trabajo..." value={query} onChange={e => setQuery(e.target.value)}/></label>
        <label>Estado<select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">Todos</option><option value="active">Activas</option><option value="overdue">Vencidas</option><option value="pending">Pendientes</option><option value="unscheduled">Sin fecha</option><option value="paid">Pagadas</option><option value="paused">Pausadas</option><option value="cancelled">Canceladas</option></select></label>
      </div>
      {loading ? <p>Cargando suscripciones…</p> : filtered.length === 0 ? <div className={styles.empty}>{items.length === 0 ? "Todavía no agregaste suscripciones." : "No hay servicios con esos filtros."}</div> : (
        <div className={styles.cards}>
          {filtered.map(item => {
            const state = subscriptionStatus(item, payments);
            const count = payments.filter(x => x.recurring_expense_id === item.id).length;
            return <article key={item.id} className={styles.card}>
              <div className={styles.cardTop}><div><h2>{item.name}</h2><p>{item.category_name} · {RECURRENCE_LABELS[item.recurrence]}{item.recurrence === "custom" ? ` (${item.interval_days} días)` : ""}</p></div><span className={`${styles.status} ${state === "overdue" ? styles.overdue : state === "paid" ? styles.paid : ""}`}>{STATUS_TEXT[state] || state}</span></div>
              <strong className={styles.amount}>{money(item.amount)}</strong>
              <p className={styles.muted}>Próximo vencimiento: <b>{item.next_due_on ? formatSubscriptionDate(item.next_due_on) : "Sin fecha definida"}</b></p>
              <p className={styles.muted}>{count} {count === 1 ? "pago registrado" : "pagos registrados"}{item.tags?.length ? ` · ${item.tags.join(", ")}` : ""}</p>
              {item.notes && <p className={styles.notes}>{item.notes}</p>}
              <div className={styles.actions}>
                <button className={styles.primary} onClick={() => openPay(item)} disabled={item.status !== "active"}>Registrar pago</button>
                <button onClick={() => setHistoryItem(item)}>Historial</button>
                <button onClick={() => openForm(item)}>Editar</button>
                {item.status === "active" ? <button onClick={() => switchStatus(item, "paused")}>Pausar</button> : item.status === "paused" ? <button onClick={() => switchStatus(item, "active")}>Reactivar</button> : null}
                <button className={styles.dangerText} onClick={() => removeItem(item)}>Eliminar</button>
              </div>
            </article>;
          })}
        </div>
      )}

      {formOpen && <Modal onClose={() => !saving && setFormOpen(false)}><div className={styles.modal}>
        <h2>{formItem ? "Editar suscripción" : "Nueva suscripción"}</h2>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <form onSubmit={saveForm} className={styles.form}>
          <label>Nombre del servicio *<input required maxLength={100} placeholder="Ej.: Spotify, Internet, gimnasio" value={form.name} onChange={e => setForm(x => ({ ...x, name: e.target.value }))}/></label>
          <label>Importe previsto *<input required inputMode="decimal" placeholder="0" value={form.amount} onChange={e => setForm(x => ({ ...x, amount: formatAmountInput(e.target.value, x.amount, settings) }))}/></label>
          <label>Frecuencia<select value={form.recurrence} onChange={e => setForm(x => ({ ...x, recurrence: e.target.value }))}>{Object.entries(RECURRENCE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label>
          {form.recurrence === "custom" && <label>Repetir cada cuántos días<input type="number" min="1" max="3650" value={form.intervalDays} onChange={e => setForm(x => ({ ...x, intervalDays: e.target.value }))}/></label>}
          <label>Próximo vencimiento (opcional)<input type="date" value={form.nextDueOn} onChange={e => setForm(x => ({ ...x, nextDueOn: e.target.value }))}/><small>Podés dejarlo vacío y agregarlo más adelante.</small>{form.nextDueOn && <button type="button" onClick={() => setForm(x => ({...x,nextDueOn:"",reminderDaysBefore:""}))}>Quitar fecha</button>}</label>
          <label>Recordatorio<select value={form.reminderDaysBefore} onChange={e => setForm(x => ({ ...x, reminderDaysBefore: e.target.value }))} disabled={!form.nextDueOn}><option value="">Sin aviso automático</option><option value="0">El mismo día</option><option value="1">1 día antes</option><option value="3">3 días antes</option><option value="7">7 días antes</option></select><small>Solo se activará si agregás una fecha de vencimiento.</small></label>
          <label>Categoría<select value={form.categoryName} onChange={e => setForm(x => ({ ...x, categoryName: e.target.value }))}><option value="General">General</option>{[...new Set(expenseCategories)].filter(x => x && x !== "General").map(x => <option key={x} value={x}>{x}</option>)}</select></label>
          <label>Cuenta habitual (opcional)<select value={form.accountId} onChange={e => setForm(x => ({ ...x, accountId: e.target.value }))}><option value="">Sin cuenta — saldo general</option>{accounts.filter(x => x.isActive).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          <label>Etiquetas (opcional)<input placeholder="Hogar, Trabajo, Vacaciones" value={form.tags} onChange={e => setForm(x => ({ ...x, tags: e.target.value }))}/></label>
          <label>Notas (opcional)<textarea rows="2" maxLength={2000} value={form.notes} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))}/></label>
          <label>Estado<select value={form.status} onChange={e => setForm(x => ({ ...x, status: e.target.value }))}><option value="active">Activa</option><option value="paused">Pausada</option><option value="cancelled">Cancelada</option></select></label>
          <div className={styles.footer}><button type="button" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className={styles.primary} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button></div>
        </form>
      </div></Modal>}

      {paymentItem && <Modal onClose={() => !saving && setPaymentItem(null)}><div className={styles.modal}>
        <h2>Registrar pago de {paymentItem.name}</h2>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <form onSubmit={savePayment} className={styles.form}>
          <label>Tipo de registro<select value={paymentMode} onChange={e => {setPaymentMode(e.target.value);setPayDate("");}}><option value="new">Crear gasto nuevo</option><option value="existing">Vincular un gasto ya registrado</option></select></label>
          <label>Período correspondiente
            {paymentItem.recurrence === "monthly" ? <input type="month" required value={periodDate.slice(0,7)} onChange={e => setPeriodDate(`${e.target.value}-01`)}/>
              : paymentItem.recurrence === "annual" ? <input type="number" min="2000" max="2100" required value={periodDate.slice(0,4)} onChange={e => setPeriodDate(`${e.target.value}-01-01`)}/>
              : <input type="date" required value={periodDate} onChange={e => setPeriodDate(e.target.value)}/>}
            <small>Sirve para organizar los pagos por período y evitar duplicados. No es la fecha real del pago.</small>
          </label>
          {paymentMode === "new" ? <>
            <label>Importe abonado *<input required inputMode="decimal" placeholder="0" value={payAmount} onChange={e => setPayAmount(x => formatAmountInput(e.target.value, x, settings))}/></label>
            <label>Cuenta (opcional)<select value={payAccount} onChange={e => setPayAccount(e.target.value)}><option value="">Sin cuenta — saldo general</option>{accounts.filter(x => x.isActive).map(x => <option value={x.id} key={x.id}>{x.name}</option>)}</select></label>
          </> : <label>Gasto existente *
            <input placeholder="Buscar por descripción, categoría o importe" value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)}/>
            <select required value={existingExpenseId} onChange={e => { setExistingExpenseId(e.target.value); setPayDate(""); }}><option value="">Seleccionar gasto</option>{availableExpenses.map(x => <option key={x.id} value={x.id}>{formatSubscriptionDate(x.date)} · {x.description} · {money(x.amount)}</option>)}</select>
            <small>No crearemos otro gasto: solo lo vincularemos. Si añadís una fecha, debe coincidir con la del gasto seleccionado.</small>
          </label>}
          <label>Fecha real del pago (opcional)<input type="date" max={getLocalToday()} value={payDate} onChange={e => setPayDate(e.target.value)}/><small>Si no te acordás, dejala vacía. El gasto nuevo usará la fecha de registro y podrás completar la fecha real después.</small>{payDate && <button type="button" onClick={() => setPayDate("")}>Quitar fecha</button>}</label>
          {paymentMode === "new" && <label>Observaciones del pago (opcional)<textarea rows="2" maxLength={1000} value={payNotes} onChange={e => setPayNotes(e.target.value)}/></label>}
          <div className={styles.footer}><button type="button" onClick={() => setPaymentItem(null)}>Cancelar</button><button className={styles.primary} disabled={saving}>{saving ? "Registrando…" : "Confirmar pago"}</button></div>
        </form>
      </div></Modal>}

      {historyItem && <Modal onClose={() => setHistoryItem(null)}><div className={styles.modal}>
        <h2>Historial: {historyItem.name}</h2>
        {payments.filter(p => p.recurring_expense_id === historyItem.id).length === 0 ? <p>Este servicio todavía no tiene pagos registrados.</p> : (
          <div className={styles.history}>{payments.filter(p => p.recurring_expense_id === historyItem.id).map(p => {
            const expense = expenses.find(x => x.id === p.transaction_id);
            return <div key={p.id} className={styles.historyRow}>
              <div><strong>{periodLabel(p.period_key)} · {money(expense?.amount ?? p.amount)}</strong><p className={styles.muted}>Fecha real: {p.paid_on ? formatSubscriptionDate(p.paid_on) : "Pendiente de informar"}</p><small className={styles.muted}>Registrado: {new Date(p.created_at).toLocaleString("es-AR")}</small></div>
              <div className={styles.historyActions}><button onClick={() => { setEditingPayment(p);setEditingDate(p.paid_on || "");setError(""); }}>Fecha</button><button className={styles.dangerText} onClick={() => undoPayment(p)}>{p.source === "created" ? "Anular" : "Desvincular"}</button></div>
            </div>;
          })}</div>
        )}
        <div className={styles.footer}><button onClick={() => setHistoryItem(null)}>Cerrar</button></div>
      </div></Modal>}

      {editingPayment && <Modal onClose={() => setEditingPayment(null)}><div className={styles.modal}><h2>Fecha real del pago</h2><p>Podés completarla ahora o dejarla sin indicar.</p>{error && <p role="alert" className={styles.error}>{error}</p>}<form className={styles.form} onSubmit={updatePaymentDate}>
        <label>Fecha real (opcional)<input type="date" max={getLocalToday()} value={editingDate} onChange={e => setEditingDate(e.target.value)}/></label>
        <p className={styles.muted}>Si elegís una fecha, también se actualizará la fecha del gasto vinculado.</p>
        <div className={styles.footer}><button type="button" onClick={() => setEditingPayment(null)}>Cancelar</button><button type="submit" className={styles.primary} disabled={saving}>Guardar fecha</button></div>
      </form></div></Modal>}
    </div>
  );
}

export default Subscriptions;
