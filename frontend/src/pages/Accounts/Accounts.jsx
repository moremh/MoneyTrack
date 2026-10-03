import {
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AccountContext } from "../../context/AccountContext";
import { FinanceContext } from "../../context/FinanceContext";

import Card from "../../components/common/Card/Card";

import {
  formatAmountInput,
  formatStoredAmount,
  normalizeAmountOnBlur,
  parseAmountInput,
} from "../../utils/amountUtils";

import {
  getLocalToday,
} from "../../utils/dateUtils";

import {
  formatRegionalCurrency,
  formatRegionalDate,
  getLocale,
} from "../../utils/regionalSettings";

import styles from "./Accounts.module.css";

const TYPE_OPTIONS = [
  {
    value: "wallet",
    label: "Billetera virtual",
    icon: "bi bi-wallet2",
  },
  {
    value: "bank",
    label: "Banco",
    icon: "bi bi-bank",
  },
  {
    value: "cash",
    label: "Efectivo",
    icon: "bi bi-cash-stack",
  },
  {
    value: "other",
    label: "Otra",
    icon:
      "bi bi-credit-card-2-front",
  },
];

const getTypeData = (type) =>
  TYPE_OPTIONS.find(
    (option) =>
      option.value === type
  ) || TYPE_OPTIONS[3];

const formatLocalDate = (date) => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getMonthStart = () => {
  const date =
    new Date();

  date.setDate(1);

  return formatLocalDate(date);
};

const getMonthsAgoStart =
  (monthsAgo) => {
    const date =
      new Date();

    date.setDate(1);

    date.setMonth(
      date.getMonth() -
        monthsAgo
    );

    return formatLocalDate(
      date
    );
  };

const getYearStart = () => {
  const date =
    new Date();

  date.setMonth(0);
  date.setDate(1);

  return formatLocalDate(date);
};

function Accounts() {
  const {
    accounts = [],
    activeAccounts = [],
    transfers = [],
    loading,
    errorMessage:
      loadingErrorMessage,
    addAccount,
    updateAccount,
    setAccountActive,
    deleteAccount,
    addTransfer,
    updateTransfer,
    deleteTransfer,
  } =
    useContext(AccountContext) ||
    {};

  const {
    incomes = [],
    expenses = [],
    settings = {},
  } =
    useContext(FinanceContext);

  const [
    editingAccount,
    setEditingAccount,
  ] = useState(null);

  const [name, setName] =
    useState("");

  const [type, setType] =
    useState("wallet");

  const [
    openingBalance,
    setOpeningBalance,
  ] = useState("");

  const [notes, setNotes] =
    useState("");

  const [
    includeInBalance,
    setIncludeInBalance,
  ] = useState(true);

  const [
    editingTransfer,
    setEditingTransfer,
  ] = useState(null);

  const [
    fromAccountId,
    setFromAccountId,
  ] = useState("");

  const [
    toAccountId,
    setToAccountId,
  ] = useState("");

  const [
    transferAmount,
    setTransferAmount,
  ] = useState("");

  const [
    transferDate,
    setTransferDate,
  ] = useState(
    getLocalToday()
  );

  const [
    transferNotes,
    setTransferNotes,
  ] = useState("");

  const [
    historyAccountId,
    setHistoryAccountId,
  ] = useState("");

  const [
    fromDate,
    setFromDate,
  ] = useState(() =>
    getMonthStart()
  );

  const [
    toDate,
    setToDate,
  ] = useState(() =>
    getLocalToday()
  );

  const [
    activePreset,
    setActivePreset,
  ] = useState("month");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const [
    isTransferSubmitting,
    setIsTransferSubmitting,
  ] = useState(false);

  const accountById =
    useMemo(
      () =>
        new Map(
          accounts.map(
            (account) => [
              account.id,
              account,
            ]
          )
        ),
      [accounts]
    );

  const cumulativeStats =
    useMemo(() => {
      const stats =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              {
                balance:
                  Number(
                    account
                      .openingBalance
                  ) || 0,
                transactionCount:
                  0,
                transferCount:
                  0,
              },
            ]
          )
        );

      incomes.forEach(
        (movement) => {
          if (
            !movement?.accountId ||
            !stats.has(
              movement.accountId
            )
          ) {
            return;
          }

          const current =
            stats.get(
              movement.accountId
            );

          current.balance +=
            Number(
              movement.amount
            ) || 0;

          current.transactionCount +=
            1;
        }
      );

      expenses.forEach(
        (movement) => {
          if (
            !movement?.accountId ||
            !stats.has(
              movement.accountId
            )
          ) {
            return;
          }

          const current =
            stats.get(
              movement.accountId
            );

          current.balance -=
            Number(
              movement.amount
            ) || 0;

          current.transactionCount +=
            1;
        }
      );

      transfers.forEach(
        (transfer) => {
          const amount =
            Number(
              transfer.amount
            ) || 0;

          const fromStats =
            stats.get(
              transfer
                .fromAccountId
            );

          if (fromStats) {
            fromStats.balance -=
              amount;

            fromStats.transferCount +=
              1;
          }

          const toStats =
            stats.get(
              transfer.toAccountId
            );

          if (toStats) {
            toStats.balance +=
              amount;

            toStats.transferCount +=
              1;
          }
        }
      );

      return stats;
    }, [
      accounts,
      incomes,
      expenses,
      transfers,
    ]);

  const periodStats =
    useMemo(() => {
      const includeOpening =
        activePreset === "all";

      const inPeriod =
        (date) => {
          if (
            fromDate &&
            date < fromDate
          ) {
            return false;
          }

          if (
            toDate &&
            date > toDate
          ) {
            return false;
          }

          return true;
        };

      const stats =
        new Map(
          accounts.map(
            (account) => [
              account.id,
              {
                balance:
                  includeOpening
                    ? Number(
                        account
                          .openingBalance
                      ) || 0
                    : 0,
                transactionCount:
                  0,
                transferCount:
                  0,
              },
            ]
          )
        );

      incomes
        .filter(
          (movement) =>
            inPeriod(
              movement.date
            )
        )
        .forEach(
          (movement) => {
            if (
              !movement?.accountId ||
              !stats.has(
                movement.accountId
              )
            ) {
              return;
            }

            const current =
              stats.get(
                movement.accountId
              );

            current.balance +=
              Number(
                movement.amount
              ) || 0;

            current.transactionCount +=
              1;
          }
        );

      expenses
        .filter(
          (movement) =>
            inPeriod(
              movement.date
            )
        )
        .forEach(
          (movement) => {
            if (
              !movement?.accountId ||
              !stats.has(
                movement.accountId
              )
            ) {
              return;
            }

            const current =
              stats.get(
                movement.accountId
              );

            current.balance -=
              Number(
                movement.amount
              ) || 0;

            current.transactionCount +=
              1;
          }
        );

      transfers
        .filter(
          (transfer) =>
            inPeriod(
              transfer.date
            )
        )
        .forEach(
          (transfer) => {
            const amount =
              Number(
                transfer.amount
              ) || 0;

            const fromStats =
              stats.get(
                transfer
                  .fromAccountId
              );

            if (fromStats) {
              fromStats.balance -=
                amount;

              fromStats.transferCount +=
                1;
            }

            const toStats =
              stats.get(
                transfer.toAccountId
              );

            if (toStats) {
              toStats.balance +=
                amount;

              toStats.transferCount +=
                1;
            }
          }
        );

      return stats;
    }, [
      accounts,
      incomes,
      expenses,
      transfers,
      fromDate,
      toDate,
      activePreset,
    ]);

  const activeTotal =
    useMemo(
      () =>
        accounts
          .filter(
            (account) =>
              account.isActive &&
              account.includeInBalance !==
                false
          )
          .reduce(
            (
              total,
              account
            ) =>
              total +
              (
                periodStats.get(
                  account.id
                )?.balance || 0
              ),
            0
          ),
      [
        accounts,
        periodStats,
      ]
    );

  const accountOptions =
    useMemo(() => {
      const ids =
        new Set(
          activeAccounts.map(
            (account) =>
              account.id
          )
        );

      if (
        editingTransfer
          ?.fromAccountId
      ) {
        ids.add(
          editingTransfer
            .fromAccountId
        );
      }

      if (
        editingTransfer
          ?.toAccountId
      ) {
        ids.add(
          editingTransfer
            .toAccountId
        );
      }

      return accounts.filter(
        (account) =>
          ids.has(account.id)
      );
    }, [
      accounts,
      activeAccounts,
      editingTransfer,
    ]);

  useEffect(() => {
    if (
      editingTransfer ||
      activeAccounts.length <
        2
    ) {
      return;
    }

    setFromAccountId(
      (current) =>
        activeAccounts.some(
          (account) =>
            account.id ===
            current
        )
          ? current
          : activeAccounts[0]
              ?.id || ""
    );

    setToAccountId(
      (current) => {
        if (
          activeAccounts.some(
            (account) =>
              account.id ===
                current &&
              current !==
                fromAccountId
          )
        ) {
          return current;
        }

        return (
          activeAccounts.find(
            (account) =>
              account.id !==
              (
                fromAccountId ||
                activeAccounts[0]
                  ?.id
              )
          )?.id || ""
        );
      }
    );
  }, [
    activeAccounts,
    editingTransfer,
    fromAccountId,
  ]);

  const historyRows =
    useMemo(() => {
      const movementRows = [
        ...incomes,
        ...expenses,
      ]
        .filter(
          (movement) =>
            movement.accountId
        )
        .map(
          (movement) => ({
            id:
              `movement-${movement.id}`,
            sourceId:
              movement.id,
            kind:
              movement.type,
            date:
              movement.date,
            createdAt:
              movement.createdAt ||
              movement.updatedAt ||
              "",
            description:
              movement.description,
            accountId:
              movement.accountId,
            accountLabel:
              accountById.get(
                movement.accountId
              )?.name ||
              "Cuenta",
            amount:
              Number(
                movement.amount
              ) || 0,
          })
        );

      const transferRows =
        transfers.map(
          (transfer) => {
            const fromName =
              accountById.get(
                transfer
                  .fromAccountId
              )?.name ||
              "Cuenta";

            const toName =
              accountById.get(
                transfer
                  .toAccountId
              )?.name ||
              "Cuenta";

            return {
              id:
                `transfer-${transfer.id}`,
              sourceId:
                transfer.id,
              kind:
                "transfer",
              date:
                transfer.date,
              createdAt:
                transfer.createdAt ||
                transfer.updatedAt ||
                "",
              description:
                `${fromName} → ${toName}`,
              accountId: null,
              fromAccountId:
                transfer
                  .fromAccountId,
              toAccountId:
                transfer
                  .toAccountId,
              accountLabel:
                "Transferencia interna",
              amount:
                Number(
                  transfer.amount
                ) || 0,
              notes:
                transfer.notes ||
                "",
            };
          }
        );

      return [
        ...movementRows,
        ...transferRows,
      ]
        .filter((row) => {
          if (
            fromDate &&
            row.date < fromDate
          ) {
            return false;
          }

          if (
            toDate &&
            row.date > toDate
          ) {
            return false;
          }

          return true;
        })
        .filter((row) => {
          if (
            !historyAccountId
          ) {
            return true;
          }

          if (
            row.kind ===
            "transfer"
          ) {
            return (
              row.fromAccountId ===
                historyAccountId ||
              row.toAccountId ===
                historyAccountId
            );
          }

          return (
            row.accountId ===
            historyAccountId
          );
        })
        .sort((a, b) => {
          const dateCompare =
            String(
              b.date || ""
            ).localeCompare(
              String(
                a.date || ""
              )
            );

          if (
            dateCompare !== 0
          ) {
            return dateCompare;
          }

          return String(
            b.createdAt || ""
          ).localeCompare(
            String(
              a.createdAt || ""
            )
          );
        });
    }, [
      incomes,
      expenses,
      transfers,
      accountById,
      historyAccountId,
      fromDate,
      toDate,
    ]);

  const applyPreset =
    (preset) => {
      const today =
        getLocalToday();

      if (preset === "month") {
        setFromDate(
          getMonthStart()
        );

        setToDate(today);

        setActivePreset(
          "month"
        );

        return;
      }

      if (
        preset === "quarter"
      ) {
        setFromDate(
          getMonthsAgoStart(2)
        );

        setToDate(today);

        setActivePreset(
          "quarter"
        );

        return;
      }

      if (preset === "year") {
        setFromDate(
          getYearStart()
        );

        setToDate(today);

        setActivePreset(
          "year"
        );

        return;
      }

      setFromDate("");
      setToDate("");
      setActivePreset("all");
    };

  const handleFromDateChange =
    (value) => {
      setFromDate(value);

      setActivePreset(
        "custom"
      );
    };

  const handleToDateChange =
    (value) => {
      setToDate(value);

      setActivePreset(
        "custom"
      );
    };

  const clearAccountForm =
    () => {
      setEditingAccount(null);
      setName("");
      setType("wallet");
      setOpeningBalance("");
      setNotes("");
      setIncludeInBalance(true);
      setErrorMessage("");
    };

  const startEditingAccount =
    (account) => {
      setEditingAccount(
        account
      );

      setName(
        account.name || ""
      );

      setType(
        account.type ||
          "wallet"
      );

      setOpeningBalance(
        formatStoredAmount(
          account.openingBalance ||
            0,
          settings
        )
      );

      setNotes(
        account.notes || ""
      );

      setIncludeInBalance(
        account.includeInBalance !==
          false
      );

      setErrorMessage("");
      setSuccessMessage("");
    };

  const handleAccountSubmit =
    async (event) => {
      event.preventDefault();

      if (isSubmitting) {
        return;
      }

      setErrorMessage("");
      setSuccessMessage("");

      const parsedOpening =
        openingBalance.trim()
          ? parseAmountInput(
              openingBalance,
              settings
            )
          : 0;

      if (
        Number.isNaN(
          parsedOpening
        ) ||
        parsedOpening < 0
      ) {
        setErrorMessage(
          "El saldo inicial no puede ser negativo."
        );
        return;
      }

      setIsSubmitting(true);

      const payload = {
        name,
        type,
        openingBalance:
          parsedOpening,
        notes,
        includeInBalance,
      };

      try {
        const result =
          editingAccount
            ? await updateAccount(
                editingAccount.id,
                payload
              )
            : await addAccount(
                payload
              );

        if (
          !result?.success
        ) {
          setErrorMessage(
            result?.message ||
              "No se pudo guardar la cuenta."
          );
          return;
        }

        setSuccessMessage(
          editingAccount
            ? "Cuenta actualizada correctamente."
            : "Cuenta creada correctamente."
        );

        clearAccountForm();
      } finally {
        setIsSubmitting(false);
      }
    };

  const handleToggleActive =
    async (account) => {
      setErrorMessage("");
      setSuccessMessage("");

      const result =
        await setAccountActive(
          account.id,
          !account.isActive
        );

      if (!result?.success) {
        setErrorMessage(
          result?.message ||
            "No se pudo cambiar el estado de la cuenta."
        );
        return;
      }

      setSuccessMessage(
        account.isActive
          ? "Cuenta desactivada. Ya no aparecerá para nuevos movimientos."
          : "Cuenta reactivada correctamente."
      );
    };

  const handleDeleteAccount =
    async (account) => {
      setErrorMessage("");
      setSuccessMessage("");

      const confirmed =
        window.confirm(
          `¿Eliminar la cuenta "${account.name}"? Solo se puede borrar si no tiene historial.`
        );

      if (!confirmed) {
        return;
      }

      const result =
        await deleteAccount(
          account.id
        );

      if (!result?.success) {
        setErrorMessage(
          result?.message ||
            "No se pudo eliminar la cuenta."
        );
        return;
      }

      if (
        editingAccount?.id ===
        account.id
      ) {
        clearAccountForm();
      }

      setSuccessMessage(
        "Cuenta eliminada correctamente."
      );
    };

  const resetTransferForm =
    () => {
      setEditingTransfer(null);

      const first =
        activeAccounts[0]
          ?.id || "";

      const second =
        activeAccounts.find(
          (account) =>
            account.id !== first
        )?.id || "";

      setFromAccountId(first);
      setToAccountId(second);
      setTransferAmount("");
      setTransferDate(
        getLocalToday()
      );
      setTransferNotes("");
      setErrorMessage("");
    };

  const startEditingTransfer =
    (transfer) => {
      setEditingTransfer(
        transfer
      );

      setFromAccountId(
        transfer.fromAccountId
      );

      setToAccountId(
        transfer.toAccountId
      );

      setTransferAmount(
        formatStoredAmount(
          transfer.amount,
          settings
        )
      );

      setTransferDate(
        transfer.date ||
          getLocalToday()
      );

      setTransferNotes(
        transfer.notes || ""
      );

      setErrorMessage("");
      setSuccessMessage("");
    };

  const handleTransferSubmit =
    async (event) => {
      event.preventDefault();

      if (
        isTransferSubmitting
      ) {
        return;
      }

      setErrorMessage("");
      setSuccessMessage("");

      const amount =
        parseAmountInput(
          transferAmount,
          settings
        );

      if (
        Number.isNaN(amount) ||
        amount <= 0
      ) {
        setErrorMessage(
          "El monto de la transferencia debe ser mayor a 0."
        );
        return;
      }

      setIsTransferSubmitting(
        true
      );

      try {
        const payload = {
          fromAccountId,
          toAccountId,
          amount,
          date:
            transferDate ||
            getLocalToday(),
          notes:
            transferNotes,
        };

        const result =
          editingTransfer
            ? await updateTransfer(
                editingTransfer.id,
                payload
              )
            : await addTransfer(
                payload
              );

        if (
          !result?.success
        ) {
          setErrorMessage(
            result?.message ||
              "No se pudo guardar la transferencia."
          );
          return;
        }

        setSuccessMessage(
          editingTransfer
            ? "Transferencia actualizada correctamente."
            : "Transferencia registrada correctamente."
        );

        resetTransferForm();
      } finally {
        setIsTransferSubmitting(
          false
        );
      }
    };

  const handleDeleteTransfer =
    async (transfer) => {
      const fromName =
        accountById.get(
          transfer.fromAccountId
        )?.name ||
        "cuenta";

      const toName =
        accountById.get(
          transfer.toAccountId
        )?.name ||
        "cuenta";

      const confirmed =
        window.confirm(
          `¿Eliminar la transferencia de ${fromName} a ${toName}?`
        );

      if (!confirmed) {
        return;
      }

      const result =
        await deleteTransfer(
          transfer.id
        );

      if (!result?.success) {
        setErrorMessage(
          result?.message ||
            "No se pudo eliminar la transferencia."
        );
        return;
      }

      if (
        editingTransfer?.id ===
        transfer.id
      ) {
        resetTransferForm();
      }

      setSuccessMessage(
        "Transferencia eliminada correctamente."
      );
    };

  const getMovementKindLabel =
    (kind) => {
      if (kind === "income") {
        return "Ingreso";
      }

      if (
        kind === "expense"
      ) {
        return "Gasto";
      }

      return "Transferencia";
    };

  return (
    <div className={styles.page}>
      <div
        className={
          styles.heading
        }
      >
        <div>
          <h1
            className={
              styles.title
            }
          >
            Cuentas
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            Organizá dónde está tu
            dinero, asociá ingresos
            y gastos y mové dinero
            entre tus propias
            cuentas sin alterar el
            balance general.
          </p>
        </div>
      </div>

      <section
        className={
          styles.periodFilters
        }
      >
        <div
          className={
            styles.presetButtons
          }
        >
          <button
            type="button"
            className={
              activePreset ===
              "month"
                ? styles.presetActive
                : ""
            }
            onClick={() =>
              applyPreset(
                "month"
              )
            }
          >
            Mes
          </button>

          <button
            type="button"
            className={
              activePreset ===
              "quarter"
                ? styles.presetActive
                : ""
            }
            onClick={() =>
              applyPreset(
                "quarter"
              )
            }
          >
            3 meses
          </button>

          <button
            type="button"
            className={
              activePreset ===
              "year"
                ? styles.presetActive
                : ""
            }
            onClick={() =>
              applyPreset(
                "year"
              )
            }
          >
            Año
          </button>

          <button
            type="button"
            className={
              activePreset ===
              "all"
                ? styles.presetActive
                : ""
            }
            onClick={() =>
              applyPreset(
                "all"
              )
            }
          >
            Todo
          </button>
        </div>

        <div
          className={
            styles.customDates
          }
        >
          <label>
            <span>Desde</span>

            <input
              type="date"
              value={fromDate}
              max={
                toDate ||
                getLocalToday()
              }
              onChange={(
                event
              ) =>
                handleFromDateChange(
                  event.target
                    .value
                )
              }
            />
          </label>

          <label>
            <span>Hasta</span>

            <input
              type="date"
              value={toDate}
              min={
                fromDate ||
                undefined
              }
              max={
                getLocalToday()
              }
              onChange={(
                event
              ) =>
                handleToDateChange(
                  event.target
                    .value
                )
              }
            />
          </label>
        </div>
      </section>

      <div
        className={
          styles.summaryGrid
        }
      >
        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Saldo del período
          </span>

          <strong>
            {formatRegionalCurrency(
              activeTotal,
              settings
            )}
          </strong>

          <small>
            {activePreset === "month"
              ? "Este mes comienza en $0."
              : activePreset === "all"
                ? "Incluye saldo inicial y todo el historial."
                : "Calculado solo con el período seleccionado."}
          </small>
        </div>

        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Cuentas activas
          </span>

          <strong>
            {
              activeAccounts.length
            }
          </strong>

          <small>
            Podés crear todas las
            que necesites.
          </small>
        </div>

        <div
          className={
            styles.summaryCard
          }
        >
          <span>
            Transferencias
          </span>

          <strong>
            {transfers.length}
          </strong>

          <small>
            No cuentan como ingreso
            ni gasto.
          </small>
        </div>
      </div>

      {(errorMessage ||
        loadingErrorMessage) && (
        <div
          className={
            styles.errorMessage
          }
          role="alert"
        >
          <i className="bi bi-exclamation-circle"></i>

          <span>
            {errorMessage ||
              loadingErrorMessage}
          </span>
        </div>
      )}

      {successMessage && (
        <div
          className={
            styles.successMessage
          }
          role="status"
        >
          <i className="bi bi-check-circle"></i>

          <span>
            {successMessage}
          </span>
        </div>
      )}

      <Card
        title={
          editingAccount
            ? "Editar cuenta"
            : "Nueva cuenta"
        }
      >
        <form
          className={
            styles.form
          }
          onSubmit={
            handleAccountSubmit
          }
        >
          <div
            className={
              styles.formGrid
            }
          >
            <div
              className={
                styles.group
              }
            >
              <label htmlFor="account-name">
                Nombre
              </label>

              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                placeholder="Ej: Mercado Pago"
                disabled={
                  isSubmitting
                }
              />
            </div>

            <div
              className={
                styles.group
              }
            >
              <label htmlFor="account-type">
                Tipo
              </label>

              <select
                id="account-type"
                value={type}
                onChange={(
                  event
                ) =>
                  setType(
                    event.target
                      .value
                  )
                }
                disabled={
                  isSubmitting
                }
              >
                {TYPE_OPTIONS.map(
                  (option) => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {
                        option.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              className={
                styles.group
              }
            >
              <label htmlFor="account-opening-balance">
                Saldo inicial
              </label>

              <input
                id="account-opening-balance"
                type="text"
                inputMode="decimal"
                lang={getLocale(
                  settings
                    ?.language,
                  settings?.region
                )}
                value={
                  openingBalance
                }
                onChange={(
                  event
                ) => {
                  const nextValue =
                    event.target
                      .value;

                  setOpeningBalance(
                    (
                      currentValue
                    ) =>
                      formatAmountInput(
                        nextValue,
                        currentValue,
                        settings
                      )
                  );
                }}
                onBlur={() =>
                  setOpeningBalance(
                    (
                      currentValue
                    ) =>
                      normalizeAmountOnBlur(
                        currentValue,
                        settings
                      )
                  )
                }
                placeholder={formatStoredAmount(
                  0,
                  settings
                )}
                disabled={
                  isSubmitting
                }
              />
            </div>

            <div
              className={
                styles.group
              }
            >
              <label htmlFor="account-notes">
                Nota
                <span>
                  {" "}
                  (opcional)
                </span>
              </label>

              <input
                id="account-notes"
                type="text"
                value={notes}
                onChange={(
                  event
                ) =>
                  setNotes(
                    event.target
                      .value
                  )
                }
                placeholder="Ej: Cuenta principal"
                disabled={
                  isSubmitting
                }
              />
            </div>

            <label
              className={
                styles.balanceVisibilityOption
              }
            >
              <input
                type="checkbox"
                checked={
                  includeInBalance
                }
                onChange={(
                  event
                ) =>
                  setIncludeInBalance(
                    event.target.checked
                  )
                }
                disabled={
                  isSubmitting
                }
              />

              <span>
                <strong>
                  Incluir en balance general
                </strong>

                <small>
                  Si lo desmarcás, la cuenta
                  seguirá activa y disponible
                  para registrar movimientos,
                  pero no se incluirá en el
                  saldo general.
                </small>
              </span>
            </label>
          </div>

          <div
            className={
              styles.formActions
            }
          >
            <button
              type="submit"
              className={
                styles.primaryButton
              }
              disabled={
                isSubmitting
              }
            >
              <i
                className={
                  editingAccount
                    ? "bi bi-check-lg"
                    : "bi bi-plus-lg"
                }
              ></i>

              {isSubmitting
                ? "Guardando..."
                : editingAccount
                  ? "Guardar cambios"
                  : "Agregar cuenta"}
            </button>

            {editingAccount && (
              <button
                type="button"
                className={
                  styles.secondaryButton
                }
                onClick={
                  clearAccountForm
                }
                disabled={
                  isSubmitting
                }
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </Card>

      <Card title="Mis cuentas">
        {loading &&
        accounts.length === 0 ? (
          <div
            className={
              styles.emptyState
            }
          >
            Cargando cuentas...
          </div>
        ) : accounts.length ===
          0 ? (
          <div
            className={
              styles.emptyState
            }
          >
            <i className="bi bi-wallet2"></i>
            <strong>
              Todavía no tenés
              cuentas.
            </strong>
            <span>
              Creá Mercado Pago,
              Brubank, Naranja X,
              efectivo o cualquier
              otra cuenta que uses.
            </span>
          </div>
        ) : (
          <div
            className={
              styles.accountsGrid
            }
          >
            {accounts.map(
              (account) => {
                const typeData =
                  getTypeData(
                    account.type
                  );

                const stats =
                  periodStats.get(
                    account.id
                  ) || {
                    balance: 0,
                    transactionCount:
                      0,
                    transferCount:
                      0,
                  };

                const cumulative =
                  cumulativeStats.get(
                    account.id
                  ) || {
                    balance: 0,
                  };

                return (
                  <article
                    key={
                      account.id
                    }
                    className={`${styles.accountCard} ${
                      !account.isActive
                        ? styles.inactiveCard
                        : ""
                    }`}
                  >
                    <div
                      className={
                        styles.accountHeader
                      }
                    >
                      <div
                        className={
                          styles.accountIcon
                        }
                      >
                        <i
                          className={
                            typeData.icon
                          }
                        ></i>
                      </div>

                      <div
                        className={
                          styles.accountIdentity
                        }
                      >
                        <strong>
                          {
                            account.name
                          }
                        </strong>

                        <span>
                          {
                            typeData.label
                          }
                        </span>
                      </div>

                      <div
                      className={
                        styles.accountBadges
                      }
                    >
                      {account.includeInBalance === false && (
                        <span
                          className={[
                            styles.statusBadge,
                            styles.excludedBadge,
                          ].join(" ")}
                        >
                          Excluida del balance
                        </span>
                      )}

                      <span
                        className={[
                          styles.statusBadge,
                          account.isActive
                            ? styles.activeBadge
                            : styles.inactiveBadge,
                        ].join(" ")}
                      >
                        {account.isActive
                          ? "Activa"
                          : "Inactiva"}
                      </span>
                    </div>
                    </div>

                    <div
                      className={
                        styles.balanceBlock
                      }
                    >
                      <span>
                        Saldo del período
                      </span>

                      <strong>
                        {formatRegionalCurrency(
                          stats.balance,
                          settings
                        )}
                      </strong>
                    </div>

                    <div
                      className={
                        styles.accountMeta
                      }
                    >
                      <span>
                        Saldo acumulado:{" "}
                        <strong>
                          {formatRegionalCurrency(
                            cumulative.balance,
                            settings
                          )}
                        </strong>
                      </span>

                      <span>
                        {
                          stats.transactionCount
                        }{" "}
                        mov. ·{" "}
                        {
                          stats.transferCount
                        }{" "}
                        transf. en el período
                      </span>
                    </div>

                    {account.notes && (
                      <p
                        className={
                          styles.notes
                        }
                      >
                        {
                          account.notes
                        }
                      </p>
                    )}

                    <div
                      className={
                        styles.accountActions
                      }
                    >
                      <button
                        type="button"
                        onClick={() =>
                          startEditingAccount(
                            account
                          )
                        }
                      >
                        <i className="bi bi-pencil"></i>
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleActive(
                            account
                          )
                        }
                      >
                        <i
                          className={
                            account.isActive
                              ? "bi bi-archive"
                              : "bi bi-arrow-counterclockwise"
                          }
                        ></i>

                        {account.isActive
                          ? "Desactivar"
                          : "Reactivar"}
                      </button>

                      <button
                        type="button"
                        className={
                          styles.deleteButton
                        }
                        onClick={() =>
                          handleDeleteAccount(
                            account
                          )
                        }
                      >
                        <i className="bi bi-trash"></i>
                        Eliminar
                      </button>
                    </div>
                  </article>
                );
              }
            )}
          </div>
        )}
      </Card>

      <Card
        title={
          editingTransfer
            ? "Editar transferencia"
            : "Transferir entre cuentas"
        }
      >
        {activeAccounts.length <
          2 &&
        !editingTransfer ? (
          <div
            className={
              styles.inlineNotice
            }
          >
            <i className="bi bi-info-circle"></i>
            <span>
              Necesitás al menos dos
              cuentas activas para
              registrar una
              transferencia.
            </span>
          </div>
        ) : (
          <form
            className={
              styles.form
            }
            onSubmit={
              handleTransferSubmit
            }
          >
            <div
              className={
                styles.transferGrid
              }
            >
              <div
                className={
                  styles.group
                }
              >
                <label htmlFor="transfer-from">
                  Desde
                </label>

                <select
                  id="transfer-from"
                  value={
                    fromAccountId
                  }
                  onChange={(
                    event
                  ) =>
                    setFromAccountId(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    isTransferSubmitting
                  }
                >
                  <option value="">
                    Seleccione...
                  </option>

                  {accountOptions.map(
                    (account) => (
                      <option
                        key={
                          account.id
                        }
                        value={
                          account.id
                        }
                      >
                        {
                          account.name
                        }
                        {!account.isActive
                          ? " (inactiva)"
                          : ""}
                      </option>
                    )
                  )}
                </select>

                {fromAccountId && (
                  <small
                    className={
                      styles.balanceHint
                    }
                  >
                    Saldo actual:{" "}
                    {formatRegionalCurrency(
                      cumulativeStats.get(
                        fromAccountId
                      )?.balance ||
                        0,
                      settings
                    )}
                  </small>
                )}
              </div>

              <div
                className={
                  styles.transferArrow
                }
              >
                <i className="bi bi-arrow-right"></i>
              </div>

              <div
                className={
                  styles.group
                }
              >
                <label htmlFor="transfer-to">
                  Hacia
                </label>

                <select
                  id="transfer-to"
                  value={
                    toAccountId
                  }
                  onChange={(
                    event
                  ) =>
                    setToAccountId(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    isTransferSubmitting
                  }
                >
                  <option value="">
                    Seleccione...
                  </option>

                  {accountOptions.map(
                    (account) => (
                      <option
                        key={
                          account.id
                        }
                        value={
                          account.id
                        }
                        disabled={
                          account.id ===
                          fromAccountId
                        }
                      >
                        {
                          account.name
                        }
                        {!account.isActive
                          ? " (inactiva)"
                          : ""}
                      </option>
                    )
                  )}
                </select>

                {toAccountId && (
                  <small
                    className={
                      styles.balanceHint
                    }
                  >
                    Saldo actual:{" "}
                    {formatRegionalCurrency(
                      cumulativeStats.get(
                        toAccountId
                      )?.balance ||
                        0,
                      settings
                    )}
                  </small>
                )}
              </div>

              <div
                className={
                  styles.group
                }
              >
                <label htmlFor="transfer-amount">
                  Monto
                </label>

                <input
                  id="transfer-amount"
                  type="text"
                  inputMode="decimal"
                  lang={getLocale(
                    settings
                      ?.language,
                    settings
                      ?.region
                  )}
                  value={
                    transferAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setTransferAmount(
                      (
                        currentValue
                      ) =>
                        formatAmountInput(
                          event.target
                            .value,
                          currentValue,
                          settings
                        )
                    )
                  }
                  onBlur={() =>
                    setTransferAmount(
                      (
                        currentValue
                      ) =>
                        normalizeAmountOnBlur(
                          currentValue,
                          settings
                        )
                    )
                  }
                  disabled={
                    isTransferSubmitting
                  }
                />
              </div>

              <div
                className={
                  styles.group
                }
              >
                <label htmlFor="transfer-date">
                  Fecha
                </label>

                <input
                  id="transfer-date"
                  type="date"
                  value={
                    transferDate
                  }
                  max={
                    getLocalToday()
                  }
                  onChange={(
                    event
                  ) =>
                    setTransferDate(
                      event.target
                        .value
                    )
                  }
                  disabled={
                    isTransferSubmitting
                  }
                />
              </div>

              <div
                className={`${styles.group} ${styles.transferNotes}`}
              >
                <label htmlFor="transfer-notes">
                  Nota
                  <span>
                    {" "}
                    (opcional)
                  </span>
                </label>

                <input
                  id="transfer-notes"
                  type="text"
                  value={
                    transferNotes
                  }
                  onChange={(
                    event
                  ) =>
                    setTransferNotes(
                      event.target
                        .value
                    )
                  }
                  placeholder="Ej: Pasé dinero para gastos del mes"
                  disabled={
                    isTransferSubmitting
                  }
                />
              </div>
            </div>

            <div
              className={
                styles.transferInfo
              }
            >
              <i className="bi bi-arrow-left-right"></i>
              <span>
                Una transferencia
                interna no modifica
                tus ingresos, gastos
                ni tu balance general.
              </span>
            </div>

            <div
              className={
                styles.formActions
              }
            >
              <button
                type="submit"
                className={
                  styles.primaryButton
                }
                disabled={
                  isTransferSubmitting
                }
              >
                <i className="bi bi-arrow-left-right"></i>

                {isTransferSubmitting
                  ? "Guardando..."
                  : editingTransfer
                    ? "Guardar cambios"
                    : "Registrar transferencia"}
              </button>

              {editingTransfer && (
                <button
                  type="button"
                  className={
                    styles.secondaryButton
                  }
                  onClick={
                    resetTransferForm
                  }
                  disabled={
                    isTransferSubmitting
                  }
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
      </Card>

      <Card title="Historial de cuentas">
        <div
          className={
            styles.historyToolbar
          }
        >
          <div
            className={
              styles.group
            }
          >
            <label htmlFor="history-account">
              Ver cuenta
            </label>

            <select
              id="history-account"
              value={
                historyAccountId
              }
              onChange={(
                event
              ) =>
                setHistoryAccountId(
                  event.target
                    .value
                )
              }
            >
              <option value="">
                Todas las cuentas
              </option>

              {accounts.map(
                (account) => (
                  <option
                    key={
                      account.id
                    }
                    value={
                      account.id
                    }
                  >
                    {
                      account.name
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <span
            className={
              styles.historyCount
            }
          >
            {historyRows.length}{" "}
            {historyRows.length ===
            1
              ? "registro"
              : "registros"}
          </span>
        </div>

        {historyRows.length ===
        0 ? (
          <div
            className={
              styles.emptyState
            }
          >
            <i className="bi bi-clock-history"></i>
            <strong>
              Sin movimientos para
              mostrar.
            </strong>
            <span>
              Los ingresos, gastos y
              transferencias
              asociados a cuentas
              aparecerán aquí.
            </span>
          </div>
        ) : (
          <div
            className={
              styles.historyTableWrapper
            }
          >
            <table
              className={
                styles.historyTable
              }
            >
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Detalle</th>
                  <th>Cuenta</th>
                  <th>Monto</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {historyRows.map(
                  (row) => (
                    <tr
                      key={
                        row.id
                      }
                    >
                      <td>
                        {formatRegionalDate(
                          row.date,
                          settings
                        )}
                      </td>

                      <td>
                        <span
                          className={`${styles.kindBadge} ${
                            row.kind ===
                            "income"
                              ? styles.incomeBadge
                              : row.kind ===
                                  "expense"
                                ? styles.expenseBadge
                                : styles.transferBadge
                          }`}
                        >
                          {getMovementKindLabel(
                            row.kind
                          )}
                        </span>
                      </td>

                      <td>
                        <strong>
                          {
                            row.description
                          }
                        </strong>

                        {row.notes && (
                          <small
                            className={
                              styles.historyNote
                            }
                          >
                            {
                              row.notes
                            }
                          </small>
                        )}
                      </td>

                      <td>
                        {
                          row.accountLabel
                        }
                      </td>

                      <td
                        className={`${styles.historyAmount} ${
                          row.kind ===
                          "income"
                            ? styles.amountIncome
                            : row.kind ===
                                "expense"
                              ? styles.amountExpense
                              : ""
                        }`}
                      >
                        {row.kind ===
                        "income"
                          ? "+"
                          : row.kind ===
                              "expense"
                            ? "-"
                            : ""}
                        {formatRegionalCurrency(
                          row.amount,
                          settings
                        )}
                      </td>

                      <td>
                        {row.kind ===
                          "transfer" && (
                          <div
                            className={
                              styles.historyActions
                            }
                          >
                            <button
                              type="button"
                              onClick={() =>
                                startEditingTransfer(
                                  transfers.find(
                                    (
                                      transfer
                                    ) =>
                                      transfer.id ===
                                      row.sourceId
                                  )
                                )
                              }
                              aria-label="Editar transferencia"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteTransfer(
                                  transfers.find(
                                    (
                                      transfer
                                    ) =>
                                      transfer.id ===
                                      row.sourceId
                                  )
                                )
                              }
                              aria-label="Eliminar transferencia"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Accounts;
