import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSearchParams } from "react-router-dom";

import { FinanceContext } from "../../context/FinanceContext";
import { useAuth } from "../../context/AuthContext";
import { useReminders } from "../../context/ReminderContext";
import { supabase } from "../../lib/supabase";

import {
  formatAmountInput,
  normalizeAmountOnBlur,
  parseAmountInput,
} from "../../utils/amountUtils";

import { getLocalToday } from "../../utils/dateUtils";

import {
  formatRegionalCurrency,
  formatRegionalDate,
} from "../../utils/regionalSettings";

import styles from "./Debts.module.css";

const DEBT_FIELDS = `
  id,
  user_id,
  direction,
  payment_mode,
  person_name,
  concept,
  original_amount,
  paid_amount,
  currency,
  debt_date,
  due_date,
  installment_count,
  first_installment_date,
  installment_end_date,
  notes,
  status,
  reminder_offsets,
  reminder_time,
  timezone,
  paid_at,
  created_at,
  updated_at,
  debt_installments (
    id,
    installment_number,
    amount_due,
    paid_amount,
    due_date,
    status,
    created_at,
    updated_at
  ),
  debt_payments (
    id,
    installment_id,
    amount,
    payment_date,
    notes,
    transaction_id,
    created_at
  )
`;

const OFFSET_OPTIONS = [
  { value: 7, label: "7 días antes" },
  { value: 3, label: "3 días antes" },
  { value: 1, label: "1 día antes" },
  { value: 0, label: "El mismo día" },
];

const EMPTY_FORM = {
  direction: "receivable",
  paymentMode: "flexible",
  personName: "",
  concept: "",
  amount: "",
  debtDate: "",
  dueDate: "",
  installmentDefinition: "count",
  installmentCount: "",
  firstInstallmentDate: "",
  installmentEndDate: "",
  notes: "",
  reminderOffsets: [0],
  reminderTime: "09:00",
};

const EMPTY_PAYMENT = {
  amount: "",
  paymentDate: "",
  notes: "",
  registerTransaction: true,
  category: "General",
};

const STATUS_LABELS = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Saldada",
  cancelled: "Cancelada",
};

const INSTALLMENT_LABELS = {
  pending: "Pendiente",
  partial: "Pago parcial",
  paid: "Pagada",
};

const normalizeOffsets = (values) =>
  [...new Set(
    (Array.isArray(values) ? values : [])
      .map(Number)
      .filter((value) => [0, 1, 3, 7].includes(value))
  )].sort((a, b) => b - a);

const addMonthsClamped = (dateString, months) => {
  const match = String(dateString || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const absoluteMonth = year * 12 + month - 1 + Number(months || 0);
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0)
  ).getUTCDate();

  return [
    targetYear,
    String(targetMonth + 1).padStart(2, "0"),
    String(Math.min(day, lastDay)).padStart(2, "0"),
  ].join("-");
};

const countFromEndDate = (firstDate, endDate) => {
  const first = String(firstDate || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );
  const end = String(endDate || "").match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!first || !end || endDate < firstDate) return 0;

  const firstIndex = Number(first[1]) * 12 + Number(first[2]);
  const endIndex = Number(end[1]) * 12 + Number(end[2]);

  return Math.max(1, endIndex - firstIndex + 1);
};

const installmentPreview = (total, count) => {
  const amount = Number(total);
  const quantity = Number(count);

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  const regular = Math.floor((amount / quantity) * 100) / 100;
  const last = Math.round(
    (amount - regular * (quantity - 1)) * 100
  ) / 100;

  return { regular, last };
};

const mapDebt = (row) => {
  const originalAmount = Number(row.original_amount) || 0;
  const paidAmount = Number(row.paid_amount) || 0;

  const installments = (row.debt_installments || [])
    .map((item) => {
      const amountDue = Number(item.amount_due) || 0;
      const installmentPaid = Number(item.paid_amount) || 0;

      return {
        id: item.id,
        number: Number(item.installment_number) || 0,
        amountDue,
        paidAmount: installmentPaid,
        outstandingAmount: Math.max(0, amountDue - installmentPaid),
        dueDate: item.due_date,
        status: item.status || "pending",
      };
    })
    .sort((a, b) => a.number - b.number);

  const payments = (row.debt_payments || [])
    .map((item) => ({
      id: item.id,
      installmentId: item.installment_id || null,
      amount: Number(item.amount) || 0,
      paymentDate: item.payment_date,
      notes: item.notes || "",
      transactionId: item.transaction_id || null,
      createdAt: item.created_at,
    }))
    .sort((a, b) =>
      String(b.createdAt || b.paymentDate || "").localeCompare(
        String(a.createdAt || a.paymentDate || "")
      )
    );

  return {
    id: row.id,
    userId: row.user_id,
    direction: row.direction || "receivable",
    paymentMode: row.payment_mode || "flexible",
    personName: row.person_name || "",
    concept: row.concept || "",
    originalAmount,
    paidAmount,
    outstandingAmount: Math.max(0, originalAmount - paidAmount),
    currency: row.currency || "ARS",
    debtDate: row.debt_date,
    dueDate: row.due_date || "",
    installmentCount: row.installment_count || null,
    firstInstallmentDate: row.first_installment_date || "",
    installmentEndDate: row.installment_end_date || "",
    notes: row.notes || "",
    status: row.status || "pending",
    reminderOffsets: normalizeOffsets(row.reminder_offsets),
    reminderTime: String(row.reminder_time || "09:00").slice(0, 5),
    timezone:
      row.timezone ||
      "America/Argentina/Buenos_Aires",
    installments,
    payments,
  };
};

function Debts() {
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    settings,
    addIncome,
    addExpense,
    incomeCategories,
    expenseCategories,
  } = useContext(FinanceContext);

  const { currentUser } = useAuth();
  const { reminders, loadReminders } = useReminders();

  const currentUserId = currentUser?.id || null;
  const today = getLocalToday();

  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState("receivable");
  const [statusFilter, setStatusFilter] = useState("open");
  const [searchTerm, setSearchTerm] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    debtDate: today,
  });
  const [saving, setSaving] = useState(false);

  const [paymentTarget, setPaymentTarget] = useState(null);
  const [paymentInstallment, setPaymentInstallment] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    ...EMPTY_PAYMENT,
    paymentDate: today,
  });
  const [paying, setPaying] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const targetDebtId = searchParams.get("debt") || "";
  const targetInstallmentId = searchParams.get("installment") || "";

  const showFeedback = useCallback((type, message) => {
    setFeedback({ type, message });
  }, []);

  const loadDebts = useCallback(async () => {
    if (!currentUserId) {
      setDebts([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("debts")
      .select(DEBT_FIELDS)
      .eq("user_id", currentUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("No se pudieron cargar las cuentas:", error);
      setDebts([]);
      setLoading(false);
      showFeedback(
        "error",
        "No se pudieron cargar las cuentas por cobrar y pagar."
      );
      return;
    }

    setDebts((data || []).map(mapDebt));
    setLoading(false);
  }, [currentUserId, showFeedback]);

  useEffect(() => {
    void loadDebts();
  }, [loadDebts]);

  useEffect(() => {
    if (!targetDebtId || debts.length === 0) return;

    const debt = debts.find((item) => item.id === targetDebtId);
    if (!debt) return;

    setDirectionFilter(debt.direction);
    setStatusFilter("all");

    window.setTimeout(() => {
      document
        .getElementById(`debt-${targetDebtId}`)
        ?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    }, 120);
  }, [debts, targetDebtId]);

  const formatMoney = useCallback(
    (value, currency) =>
      formatRegionalCurrency(value, {
        ...settings,
        currency: currency || settings.currency,
      }),
    [settings]
  );

  const activeReminderCount = useCallback(
    (debtId) =>
      reminders.filter(
        (reminder) =>
          reminder.relatedDebtId === debtId &&
          reminder.status === "pending"
      ).length,
    [reminders]
  );

  const amountNumber = useMemo(
    () => parseAmountInput(form.amount, settings),
    [form.amount, settings]
  );

  const calculatedInstallmentCount = useMemo(() => {
    if (form.paymentMode !== "installments") return 0;

    if (form.installmentDefinition === "count") {
      const count = Number(form.installmentCount);
      return Number.isInteger(count) && count > 0 ? count : 0;
    }

    return countFromEndDate(
      form.firstInstallmentDate,
      form.installmentEndDate
    );
  }, [
    form.installmentCount,
    form.installmentDefinition,
    form.firstInstallmentDate,
    form.installmentEndDate,
    form.paymentMode,
  ]);

  const calculatedEndDate = useMemo(() => {
    if (
      form.paymentMode !== "installments" ||
      !form.firstInstallmentDate ||
      calculatedInstallmentCount <= 0
    ) {
      return "";
    }

    if (
      form.installmentDefinition === "endDate" &&
      form.installmentEndDate
    ) {
      return form.installmentEndDate;
    }

    return addMonthsClamped(
      form.firstInstallmentDate,
      calculatedInstallmentCount - 1
    );
  }, [
    calculatedInstallmentCount,
    form.firstInstallmentDate,
    form.installmentDefinition,
    form.installmentEndDate,
    form.paymentMode,
  ]);

  const preview = useMemo(
    () =>
      installmentPreview(
        amountNumber,
        calculatedInstallmentCount
      ),
    [amountNumber, calculatedInstallmentCount]
  );

  const openCreate = (direction = directionFilter) => {
    setEditingDebt(null);
    setForm({
      ...EMPTY_FORM,
      direction,
      debtDate: today,
    });
    setFeedback(null);
    setFormOpen(true);
  };

  const openEdit = (debt) => {
    const hasPayments = debt.payments.length > 0;

    setEditingDebt({ ...debt, hasPayments });

    setForm({
      direction: debt.direction,
      paymentMode: debt.paymentMode,
      personName: debt.personName,
      concept: debt.concept,
      amount: String(debt.originalAmount),
      debtDate: debt.debtDate || today,
      dueDate: debt.paymentMode === "flexible" ? debt.dueDate : "",
      installmentDefinition: "count",
      installmentCount: debt.installmentCount
        ? String(debt.installmentCount)
        : "",
      firstInstallmentDate: debt.firstInstallmentDate || "",
      installmentEndDate: debt.installmentEndDate || "",
      notes: debt.notes || "",
      reminderOffsets: debt.reminderOffsets || [],
      reminderTime: debt.reminderTime || "09:00",
    });

    setFeedback(null);
    setFormOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]:
        name === "amount"
          ? formatAmountInput(value, current.amount, settings)
          : value,
    }));
  };

  const toggleOffset = (offset) => {
    setForm((current) => {
      const values = normalizeOffsets(current.reminderOffsets);
      return {
        ...current,
        reminderOffsets: values.includes(offset)
          ? values.filter((value) => value !== offset)
          : normalizeOffsets([...values, offset]),
      };
    });
  };

  const validateForm = () => {
    const personName = form.personName.trim();
    const concept = form.concept.trim();
    const amount = parseAmountInput(form.amount, settings);

    if (!personName) {
      return { success: false, message: "Ingresá la persona." };
    }

    if (!concept) {
      return { success: false, message: "Ingresá un concepto." };
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        success: false,
        message: "Ingresá un monto válido mayor a cero.",
      };
    }

    if (!form.debtDate) {
      return {
        success: false,
        message: "Seleccioná la fecha del registro.",
      };
    }

    if (editingDebt && amount < editingDebt.paidAmount) {
      return {
        success: false,
        message:
          "El monto total no puede ser menor a lo ya pagado/cobrado.",
      };
    }

    if (form.paymentMode === "flexible") {
      if (form.dueDate && form.dueDate < form.debtDate) {
        return {
          success: false,
          message:
            "El vencimiento no puede ser anterior a la fecha del registro.",
        };
      }
    } else {
      if (!form.firstInstallmentDate) {
        return {
          success: false,
          message: "Seleccioná la primera cuota.",
        };
      }

      if (form.firstInstallmentDate < form.debtDate) {
        return {
          success: false,
          message:
            "La primera cuota no puede ser anterior al registro.",
        };
      }

      if (
        calculatedInstallmentCount < 1 ||
        calculatedInstallmentCount > 120
      ) {
        return {
          success: false,
          message: "El plan debe tener entre 1 y 120 cuotas.",
        };
      }

      if (!calculatedEndDate) {
        return {
          success: false,
          message: "No se pudo calcular la fecha final.",
        };
      }
    }

    return {
      success: true,
      personName,
      concept,
      amount,
    };
  };

  const handleSave = async (event) => {
    event.preventDefault();

    const validation = validateForm();
    if (!validation.success) {
      showFeedback("error", validation.message);
      return;
    }

    setSaving(true);
    setFeedback(null);

    const installments = form.paymentMode === "installments";

    const payload = {
      user_id: currentUserId,
      direction: form.direction,
      payment_mode: form.paymentMode,
      person_name: validation.personName,
      concept: validation.concept,
      original_amount: validation.amount,
      currency: editingDebt?.currency || settings.currency || "ARS",
      debt_date: form.debtDate,
      due_date: installments
        ? calculatedEndDate
        : form.dueDate || null,
      installment_count: installments
        ? calculatedInstallmentCount
        : null,
      first_installment_date: installments
        ? form.firstInstallmentDate
        : null,
      installment_end_date: installments
        ? calculatedEndDate
        : null,
      notes: form.notes.trim() || null,
      reminder_offsets: normalizeOffsets(form.reminderOffsets),
      reminder_time: form.reminderTime || "09:00",
      timezone:
        settings.timezone ||
        currentUser?.timezone ||
        "America/Argentina/Buenos_Aires",
    };

    const result = editingDebt
      ? await supabase
          .from("debts")
          .update(payload)
          .eq("id", editingDebt.id)
          .eq("user_id", currentUserId)
          .select(DEBT_FIELDS)
          .single()
      : await supabase
          .from("debts")
          .insert(payload)
          .select(DEBT_FIELDS)
          .single();

    setSaving(false);

    if (result.error) {
      console.error("No se pudo guardar la cuenta:", result.error);

      showFeedback(
        "error",
        String(result.error.message || "").includes(
          "DEBT_PLAN_HAS_PAYMENTS"
        )
          ? "El plan de cuotas no puede cambiarse después de registrar pagos."
          : "No se pudo guardar la cuenta."
      );
      return;
    }

    await loadDebts();
    await loadReminders();

    setFormOpen(false);
    setEditingDebt(null);

    showFeedback(
      "success",
      editingDebt
        ? "Cuenta actualizada correctamente."
        : installments
          ? `Cuenta creada con ${calculatedInstallmentCount} cuotas y recordatorios automáticos.`
          : "Cuenta creada correctamente."
    );
  };

  const openPayment = (debt, installment = null) => {
    const maxAmount = installment
      ? installment.outstandingAmount
      : debt.outstandingAmount;

    const categories =
      debt.direction === "receivable"
        ? incomeCategories
        : expenseCategories;

    setPaymentTarget(debt);
    setPaymentInstallment(installment);
    setPaymentForm({
      ...EMPTY_PAYMENT,
      amount: String(maxAmount),
      paymentDate: today,
      category: categories?.[0] || "General",
    });
    setFeedback(null);
  };

  const handlePaymentChange = (event) => {
    const { name, value, type, checked } = event.target;

    setPaymentForm((current) => ({
      ...current,
      [name]:
        type === "checkbox"
          ? checked
          : name === "amount"
            ? formatAmountInput(value, current.amount, settings)
            : value,
    }));
  };

  const handlePayment = async (event) => {
    event.preventDefault();

    if (!paymentTarget || !currentUserId) return;

    const amount = parseAmountInput(paymentForm.amount, settings);
    const maxAmount = paymentInstallment
      ? paymentInstallment.outstandingAmount
      : paymentTarget.outstandingAmount;

    if (!Number.isFinite(amount) || amount <= 0) {
      showFeedback("error", "Ingresá un monto válido.");
      return;
    }

    if (amount > maxAmount + 0.0001) {
      showFeedback(
        "error",
        "El monto no puede superar el saldo pendiente."
      );
      return;
    }

    setPaying(true);
    setFeedback(null);

    const { data: paymentRow, error } = await supabase
      .from("debt_payments")
      .insert({
        user_id: currentUserId,
        debt_id: paymentTarget.id,
        installment_id: paymentInstallment?.id || null,
        amount,
        payment_date: paymentForm.paymentDate || today,
        notes: paymentForm.notes.trim() || null,
      })
      .select("id,transaction_id")
      .single();

    if (error) {
      console.error("No se pudo registrar el pago/cobro:", error);
      setPaying(false);

      const text = String(error.message || "");

      showFeedback(
        "error",
        text.includes("DEBT_PAYMENT_EXCEEDS")
          ? "El monto supera el saldo pendiente."
          : text.includes("INSTALLMENT_REQUIRED")
            ? "Seleccioná la cuota correspondiente."
            : "No se pudo registrar el pago/cobro."
      );
      return;
    }

    let transactionWarning = "";

    if (paymentForm.registerTransaction) {
      const movement = {
        description:
          paymentTarget.direction === "receivable"
            ? `Cobro: ${paymentTarget.concept} - ${paymentTarget.personName}`
            : `Pago: ${paymentTarget.concept} - ${paymentTarget.personName}`,
        amount,
        category: paymentForm.category || "General",
        date: paymentForm.paymentDate || today,
      };

      const movementResult =
        paymentTarget.direction === "receivable"
          ? await addIncome(movement)
          : await addExpense(movement);

      if (movementResult.success) {
        if (
          !movementResult.pendingSync &&
          movementResult.movement?.id &&
          paymentRow?.id
        ) {
          await supabase
            .from("debt_payments")
            .update({
              transaction_id: movementResult.movement.id,
            })
            .eq("id", paymentRow.id)
            .eq("user_id", currentUserId);
        }
      } else {
        transactionWarning =
          ` El pago/cobro quedó guardado, pero la transacción no pudo crearse: ${movementResult.message}`;
      }
    }

    await loadDebts();
    await loadReminders();

    setPaying(false);
    setPaymentTarget(null);
    setPaymentInstallment(null);

    showFeedback(
      transactionWarning ? "error" : "success",
      `Pago/cobro registrado correctamente.${transactionWarning}`
    );
  };

  const toggleCancelled = async (debt) => {
    setActionLoadingId(debt.id);

    const nextStatus =
      debt.status === "cancelled"
        ? debt.paidAmount > 0
          ? "partial"
          : "pending"
        : "cancelled";

    const { error } = await supabase
      .from("debts")
      .update({ status: nextStatus })
      .eq("id", debt.id)
      .eq("user_id", currentUserId);

    setActionLoadingId(null);

    if (error) {
      showFeedback("error", "No se pudo actualizar el estado.");
      return;
    }

    await loadDebts();
    await loadReminders();

    showFeedback(
      "success",
      nextStatus === "cancelled"
        ? "Cuenta cancelada."
        : "Cuenta reactivada."
    );
  };

  const deleteDebt = async () => {
    if (!deleteTarget) return;

    setActionLoadingId(deleteTarget.id);

    const { error } = await supabase
      .from("debts")
      .delete()
      .eq("id", deleteTarget.id)
      .eq("user_id", currentUserId);

    setActionLoadingId(null);

    if (error) {
      showFeedback("error", "No se pudo eliminar la cuenta.");
      return;
    }

    if (targetDebtId === deleteTarget.id) {
      setSearchParams({});
    }

    setDeleteTarget(null);
    await loadDebts();
    await loadReminders();
    showFeedback("success", "Cuenta eliminada correctamente.");
  };

  const filteredDebts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return debts
      .filter((debt) => debt.direction === directionFilter)
      .filter((debt) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "open") {
          return ["pending", "partial"].includes(debt.status);
        }
        return debt.status === statusFilter;
      })
      .filter((debt) => {
        if (!search) return true;

        return [debt.personName, debt.concept, debt.notes]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(search)
          );
      });
  }, [debts, directionFilter, searchTerm, statusFilter]);

  const totals = useMemo(() => {
    const open = debts.filter((debt) =>
      ["pending", "partial"].includes(debt.status)
    );

    return {
      receivable: open
        .filter((debt) => debt.direction === "receivable")
        .reduce((sum, debt) => sum + debt.outstandingAmount, 0),
      payable: open
        .filter((debt) => debt.direction === "payable")
        .reduce((sum, debt) => sum + debt.outstandingAmount, 0),
    };
  }, [debts]);

  const selectedCategories =
    paymentTarget?.direction === "receivable"
      ? incomeCategories
      : expenseCategories;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Organización</p>
          <h1>Cuentas por cobrar y pagar</h1>
          <p className={styles.subtitle}>
            Administrá cobros, pagos parciales y planes de cuotas
            con vencimientos y recordatorios automáticos.
          </p>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => openCreate()}
        >
          <i className="bi bi-plus-lg"></i>
          Nueva cuenta
        </button>
      </header>

      {feedback && (
        <div
          className={`${styles.feedback} ${
            feedback.type === "success"
              ? styles.feedbackSuccess
              : styles.feedbackError
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Cerrar"
          >
            <i className="bi bi-x-lg"></i>
          </button>
        </div>
      )}

      <section className={styles.stats}>
        <div className={styles.statCard}>
          <span>Por cobrar</span>
          <strong>
            {formatMoney(totals.receivable, settings.currency)}
          </strong>
        </div>

        <div className={styles.statCard}>
          <span>Por pagar</span>
          <strong>
            {formatMoney(totals.payable, settings.currency)}
          </strong>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.directionTabs}>
          <button
            type="button"
            className={
              directionFilter === "receivable"
                ? styles.activeDirection
                : ""
            }
            onClick={() => setDirectionFilter("receivable")}
          >
            Por cobrar
          </button>

          <button
            type="button"
            className={
              directionFilter === "payable"
                ? styles.activeDirection
                : ""
            }
            onClick={() => setDirectionFilter("payable")}
          >
            Por pagar
          </button>
        </div>

        <div className={styles.toolbar}>
          <input
            type="search"
            placeholder="Buscar persona o concepto..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="open">Pendientes</option>
            <option value="paid">Saldadas</option>
            <option value="cancelled">Canceladas</option>
            <option value="all">Todas</option>
          </select>
        </div>

        {loading ? (
          <div className={styles.emptyState}>
            Cargando...
          </div>
        ) : filteredDebts.length === 0 ? (
          <div className={styles.emptyState}>
            <h3>No hay registros</h3>
            <p>
              Todavía no cargaste cuentas en esta sección.
            </p>
          </div>
        ) : (
          <div className={styles.debtList}>
            {filteredDebts.map((debt) => {
              const progress =
                debt.originalAmount > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (debt.paidAmount / debt.originalAmount) * 100
                      )
                    )
                  : 0;

              const nextInstallment =
                debt.installments.find(
                  (item) => item.status !== "paid"
                ) || null;

              return (
                <article
                  id={`debt-${debt.id}`}
                  key={debt.id}
                  className={`${styles.debtCard} ${
                    targetDebtId === debt.id
                      ? styles.debtCardTarget
                      : ""
                  }`}
                >
                  <div className={styles.debtTop}>
                    <div>
                      <h3>{debt.personName}</h3>
                      <p>{debt.concept}</p>
                      <small>
                        {debt.paymentMode === "installments"
                          ? `${debt.installmentCount} cuotas`
                          : "Pagos parciales libres"}
                      </small>
                    </div>

                    <span
                      className={`${styles.statusBadge} ${styles[`status${debt.status}`]}`}
                    >
                      {STATUS_LABELS[debt.status]}
                    </span>
                  </div>

                  <div className={styles.amountGrid}>
                    <div>
                      <span>Total</span>
                      <strong>
                        {formatMoney(
                          debt.originalAmount,
                          debt.currency
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Pagado/cobrado</span>
                      <strong>
                        {formatMoney(
                          debt.paidAmount,
                          debt.currency
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>Pendiente</span>
                      <strong>
                        {formatMoney(
                          debt.outstandingAmount,
                          debt.currency
                        )}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.progress}>
                    <span style={{ width: `${progress}%` }}></span>
                  </div>

                  <div className={styles.meta}>
                    <span>
                      Registrada:{" "}
                      {formatRegionalDate(debt.debtDate, settings)}
                    </span>

                    {debt.paymentMode === "installments" ? (
                      nextInstallment ? (
                        <span>
                          Próxima cuota: {nextInstallment.number} ·{" "}
                          {formatRegionalDate(
                            nextInstallment.dueDate,
                            settings
                          )}{" "}
                          ·{" "}
                          {formatMoney(
                            nextInstallment.outstandingAmount,
                            debt.currency
                          )}
                        </span>
                      ) : (
                        <span>Plan completo</span>
                      )
                    ) : (
                      <span>
                        {debt.dueDate
                          ? `Vence: ${formatRegionalDate(
                              debt.dueDate,
                              settings
                            )}`
                          : "Sin vencimiento"}
                      </span>
                    )}

                    <span>
                      {activeReminderCount(debt.id)} avisos pendientes
                    </span>
                  </div>

                  {debt.paymentMode === "installments" && (
                    <details
                      className={styles.details}
                      open={targetDebtId === debt.id}
                    >
                      <summary>Ver cuotas</summary>

                      <div className={styles.installments}>
                        {debt.installments.map((installment) => (
                          <div
                            key={installment.id}
                            className={`${styles.installmentRow} ${
                              targetInstallmentId === installment.id
                                ? styles.installmentTarget
                                : ""
                            }`}
                          >
                            <div>
                              <strong>
                                Cuota {installment.number} de{" "}
                                {debt.installmentCount}
                              </strong>
                              <small>
                                {formatRegionalDate(
                                  installment.dueDate,
                                  settings
                                )}
                              </small>
                            </div>

                            <div>
                              <strong>
                                {formatMoney(
                                  installment.amountDue,
                                  debt.currency
                                )}
                              </strong>
                              {installment.status === "partial" && (
                                <small>
                                  Falta{" "}
                                  {formatMoney(
                                    installment.outstandingAmount,
                                    debt.currency
                                  )}
                                </small>
                              )}
                            </div>

                            <span>
                              {INSTALLMENT_LABELS[installment.status]}
                            </span>

                            {installment.status !== "paid" &&
                              debt.status !== "cancelled" && (
                                <button
                                  type="button"
                                  className={styles.smallPaymentButton}
                                  onClick={() =>
                                    openPayment(debt, installment)
                                  }
                                >
                                  {debt.direction === "receivable"
                                    ? "Cobrar"
                                    : "Pagar"}
                                </button>
                              )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}

                  {debt.payments.length > 0 && (
                    <details className={styles.details}>
                      <summary>Historial de pagos/cobros</summary>

                      <ul className={styles.history}>
                        {debt.payments.map((payment) => {
                          const installment = debt.installments.find(
                            (item) => item.id === payment.installmentId
                          );

                          return (
                            <li key={payment.id}>
                              <span>
                                {formatRegionalDate(
                                  payment.paymentDate,
                                  settings
                                )}
                                {installment
                                  ? ` · Cuota ${installment.number}`
                                  : ""}
                              </span>

                              <strong>
                                {formatMoney(
                                  payment.amount,
                                  debt.currency
                                )}
                              </strong>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  )}

                  <div className={styles.actions}>
                    {["pending", "partial"].includes(debt.status) &&
                      debt.paymentMode === "flexible" && (
                        <button
                          type="button"
                          className={styles.paymentButton}
                          onClick={() => openPayment(debt)}
                        >
                          {debt.direction === "receivable"
                            ? "Registrar cobro"
                            : "Registrar pago"}
                        </button>
                      )}

                    {debt.status !== "paid" && (
                      <button
                        type="button"
                        className={styles.neutralButton}
                        disabled={actionLoadingId === debt.id}
                        onClick={() => void toggleCancelled(debt)}
                      >
                        {debt.status === "cancelled"
                          ? "Reactivar"
                          : "Cancelar"}
                      </button>
                    )}

                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => openEdit(debt)}
                      aria-label="Editar"
                    >
                      <i className="bi bi-pencil"></i>
                    </button>

                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setDeleteTarget(debt)}
                      aria-label="Eliminar"
                    >
                      <i className="bi bi-trash"></i>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {formOpen && (
        <div className={styles.modalBackdrop}>
          <section className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>
                {editingDebt ? "Editar cuenta" : "Nueva cuenta"}
              </h2>

              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setFormOpen(false)}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSave}>
              <div className={styles.segmented}>
                <button
                  type="button"
                  className={
                    form.direction === "receivable"
                      ? styles.segmentedActive
                      : ""
                  }
                  disabled={editingDebt?.hasPayments}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      direction: "receivable",
                    }))
                  }
                >
                  Por cobrar
                </button>

                <button
                  type="button"
                  className={
                    form.direction === "payable"
                      ? styles.segmentedActive
                      : ""
                  }
                  disabled={editingDebt?.hasPayments}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      direction: "payable",
                    }))
                  }
                >
                  Por pagar
                </button>
              </div>

              <div className={styles.formGrid}>
                <label>
                  <span>Persona</span>
                  <input
                    name="personName"
                    value={form.personName}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label>
                  <span>Concepto</span>
                  <input
                    name="concept"
                    value={form.concept}
                    onChange={handleFormChange}
                    required
                  />
                </label>

                <label>
                  <span>Monto total</span>
                  <input
                    name="amount"
                    inputMode="decimal"
                    value={form.amount}
                    onChange={handleFormChange}
                    onBlur={() =>
                      setForm((current) => ({
                        ...current,
                        amount: normalizeAmountOnBlur(
                          current.amount,
                          settings
                        ),
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Fecha de inicio</span>
                  <input
                    type="date"
                    name="debtDate"
                    value={form.debtDate}
                    onChange={handleFormChange}
                    required
                  />
                </label>
              </div>

              <div className={styles.planOptions}>
                <button
                  type="button"
                  className={
                    form.paymentMode === "flexible"
                      ? styles.planActive
                      : ""
                  }
                  disabled={editingDebt?.hasPayments}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      paymentMode: "flexible",
                      installmentCount: "",
                      firstInstallmentDate: "",
                      installmentEndDate: "",
                    }))
                  }
                >
                  <strong>Pagos parciales libres</strong>
                  <small>
                    Cargás cualquier monto cada vez que paguen o pagues.
                  </small>
                </button>

                <button
                  type="button"
                  className={
                    form.paymentMode === "installments"
                      ? styles.planActive
                      : ""
                  }
                  disabled={editingDebt?.hasPayments}
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      paymentMode: "installments",
                      dueDate: "",
                    }))
                  }
                >
                  <strong>Plan de cuotas</strong>
                  <small>
                    MoneyTrack calcula y genera cada cuota.
                  </small>
                </button>
              </div>

              {form.paymentMode === "flexible" ? (
                <label>
                  <span>Vencimiento general (opcional)</span>
                  <input
                    type="date"
                    name="dueDate"
                    value={form.dueDate}
                    onChange={handleFormChange}
                    min={form.debtDate || undefined}
                  />
                </label>
              ) : (
                <div className={styles.installmentSetup}>
                  <label>
                    <span>Primera cuota</span>
                    <input
                      type="date"
                      name="firstInstallmentDate"
                      value={form.firstInstallmentDate}
                      onChange={handleFormChange}
                      min={form.debtDate || undefined}
                      disabled={editingDebt?.hasPayments}
                    />
                  </label>

                  <div className={styles.definitionButtons}>
                    <button
                      type="button"
                      className={
                        form.installmentDefinition === "count"
                          ? styles.definitionActive
                          : ""
                      }
                      disabled={editingDebt?.hasPayments}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          installmentDefinition: "count",
                          installmentEndDate: "",
                        }))
                      }
                    >
                      Cantidad
                    </button>

                    <button
                      type="button"
                      className={
                        form.installmentDefinition === "endDate"
                          ? styles.definitionActive
                          : ""
                      }
                      disabled={editingDebt?.hasPayments}
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          installmentDefinition: "endDate",
                          installmentCount: "",
                        }))
                      }
                    >
                      Fecha final
                    </button>
                  </div>

                  {form.installmentDefinition === "count" ? (
                    <label>
                      <span>Cantidad de cuotas</span>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        name="installmentCount"
                        value={form.installmentCount}
                        onChange={handleFormChange}
                        disabled={editingDebt?.hasPayments}
                      />
                    </label>
                  ) : (
                    <label>
                      <span>Fecha de la última cuota</span>
                      <input
                        type="date"
                        name="installmentEndDate"
                        value={form.installmentEndDate}
                        onChange={handleFormChange}
                        min={form.firstInstallmentDate || undefined}
                        disabled={editingDebt?.hasPayments}
                      />
                    </label>
                  )}

                  {preview && (
                    <div className={styles.preview}>
                      <span>
                        {calculatedInstallmentCount} cuotas ·{" "}
                        {formatMoney(
                          preview.regular,
                          editingDebt?.currency || settings.currency
                        )}{" "}
                        aprox. · finaliza{" "}
                        {formatRegionalDate(
                          calculatedEndDate,
                          settings
                        )}
                      </span>

                      {Math.abs(preview.last - preview.regular) >
                        0.001 && (
                        <small>
                          Última cuota ajustada:{" "}
                          {formatMoney(
                            preview.last,
                            editingDebt?.currency || settings.currency
                          )}
                        </small>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className={styles.remindersBox}>
                <strong>Recordatorios</strong>
                <p>
                  En cuotas se aplican automáticamente a cada vencimiento.
                </p>

                <div className={styles.offsets}>
                  {OFFSET_OPTIONS.map((option) => (
                    <label key={option.value}>
                      <input
                        type="checkbox"
                        checked={form.reminderOffsets.includes(
                          option.value
                        )}
                        onChange={() => toggleOffset(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                <label>
                  <span>Hora</span>
                  <input
                    type="time"
                    name="reminderTime"
                    value={form.reminderTime}
                    onChange={handleFormChange}
                  />
                </label>
              </div>

              <label>
                <span>Notas</span>
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={handleFormChange}
                  rows={3}
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.neutralButton}
                  onClick={() => setFormOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "Guardando..."
                    : editingDebt
                      ? "Guardar cambios"
                      : "Crear cuenta"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {paymentTarget && (
        <div className={styles.modalBackdrop}>
          <section className={`${styles.modal} ${styles.paymentModal}`}>
            <div className={styles.modalHeader}>
              <h2>
                {paymentTarget.direction === "receivable"
                  ? "Registrar cobro"
                  : "Registrar pago"}
              </h2>

              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setPaymentTarget(null)}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <form className={styles.form} onSubmit={handlePayment}>
              <label>
                <span>Monto</span>
                <input
                  name="amount"
                  inputMode="decimal"
                  value={paymentForm.amount}
                  onChange={handlePaymentChange}
                  required
                />
              </label>

              <label>
                <span>Fecha</span>
                <input
                  type="date"
                  name="paymentDate"
                  value={paymentForm.paymentDate}
                  max={today}
                  onChange={handlePaymentChange}
                  required
                />
              </label>

              <label>
                <span>Nota</span>
                <textarea
                  name="notes"
                  value={paymentForm.notes}
                  onChange={handlePaymentChange}
                  rows={2}
                />
              </label>

              <div className={styles.transactionBox}>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    name="registerTransaction"
                    checked={paymentForm.registerTransaction}
                    onChange={handlePaymentChange}
                  />
                  Registrar también como{" "}
                  {paymentTarget.direction === "receivable"
                    ? "ingreso"
                    : "gasto"}
                </label>

                {paymentForm.registerTransaction && (
                  <label>
                    <span>Categoría</span>
                    <select
                      name="category"
                      value={paymentForm.category}
                      onChange={handlePaymentChange}
                    >
                      {(selectedCategories || ["General"]).map(
                        (category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        )
                      )}
                    </select>
                  </label>
                )}
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.neutralButton}
                  onClick={() => setPaymentTarget(null)}
                  disabled={paying}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className={styles.paymentButton}
                  disabled={paying}
                >
                  {paying ? "Registrando..." : "Registrar"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className={styles.modalBackdrop}>
          <section className={`${styles.modal} ${styles.confirmModal}`}>
            <h2>Eliminar cuenta</h2>
            <p>
              Se eliminarán cuotas, pagos y recordatorios vinculados.
              Las transacciones financieras ya creadas se conservarán.
            </p>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.neutralButton}
                onClick={() => setDeleteTarget(null)}
              >
                Volver
              </button>

              <button
                type="button"
                className={styles.dangerButton}
                onClick={() => void deleteDebt()}
                disabled={actionLoadingId === deleteTarget.id}
              >
                Eliminar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Debts;
