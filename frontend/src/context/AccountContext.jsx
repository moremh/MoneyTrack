import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

import {
  getLocalToday,
  isValidDateString,
} from "../utils/dateUtils";

export const AccountContext =
  createContext(null);

const ACCOUNT_FIELDS = `
  id,
  user_id,
  name,
  type,
  opening_balance,
  notes,
  is_active,
  include_in_balance,
  created_at,
  updated_at
`;

const TRANSFER_FIELDS = `
  id,
  user_id,
  from_account_id,
  to_account_id,
  amount,
  transfer_date,
  notes,
  created_at,
  updated_at
`;

const VALID_TYPES = [
  "wallet",
  "bank",
  "cash",
  "other",
];

const getCacheKey = (userId) =>
  `moneytrack:accounts:${userId}`;

const mapAccount = (account) => ({
  id: account.id,
  userId: account.user_id,
  name: account.name,
  type: account.type || "wallet",
  openingBalance:
    Number(account.opening_balance) || 0,
  notes: account.notes || "",
  isActive:
    account.is_active !== false,
  includeInBalance:
    account.include_in_balance !== false,
  createdAt: account.created_at,
  updatedAt: account.updated_at,
});

const mapTransfer = (transfer) => ({
  id: transfer.id,
  userId: transfer.user_id,
  fromAccountId:
    transfer.from_account_id,
  toAccountId:
    transfer.to_account_id,
  amount:
    Number(transfer.amount) || 0,
  date:
    transfer.transfer_date,
  notes:
    transfer.notes || "",
  createdAt:
    transfer.created_at,
  updatedAt:
    transfer.updated_at,
});

const readCache = (userId) => {
  if (
    !userId ||
    typeof localStorage ===
      "undefined"
  ) {
    return {
      accounts: [],
      transfers: [],
    };
  }

  try {
    const raw =
      localStorage.getItem(
        getCacheKey(userId)
      );

    if (!raw) {
      return {
        accounts: [],
        transfers: [],
      };
    }

    const parsed =
      JSON.parse(raw);

    /*
     * Compatibilidad con la primera
     * versión de Cuentas, que guardaba
     * solamente el array de cuentas.
     */
    if (Array.isArray(parsed)) {
      return {
        accounts: parsed,
        transfers: [],
      };
    }

    return {
      accounts:
        Array.isArray(
          parsed?.accounts
        )
          ? parsed.accounts
          : [],
      transfers:
        Array.isArray(
          parsed?.transfers
        )
          ? parsed.transfers
          : [],
    };
  } catch {
    return {
      accounts: [],
      transfers: [],
    };
  }
};

const writeCache = (
  userId,
  accounts,
  transfers
) => {
  if (
    !userId ||
    typeof localStorage ===
      "undefined"
  ) {
    return;
  }

  try {
    localStorage.setItem(
      getCacheKey(userId),
      JSON.stringify({
        accounts,
        transfers,
      })
    );
  } catch {
    // La caché offline es opcional.
  }
};

const isOffline = () =>
  typeof navigator !==
    "undefined" &&
  navigator.onLine === false;

const getNetworkErrorText =
  (error) =>
    [
      error?.message,
      error?.details,
      error?.hint,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

const isNetworkError = (error) => {
  if (isOffline()) {
    return true;
  }

  const text =
    getNetworkErrorText(error);

  return (
    text.includes(
      "failed to fetch"
    ) ||
    text.includes(
      "networkerror"
    ) ||
    text.includes(
      "network request failed"
    ) ||
    text.includes(
      "fetch failed"
    )
  );
};

function AccountProvider({
  children,
}) {
  const { currentUser } =
    useAuth();

  const currentUserId =
    currentUser?.id || null;

  const [accounts, setAccounts] =
    useState([]);

  const [
    transfers,
    setTransfers,
  ] = useState([]);

  const [loading, setLoading] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const loadAccountData =
    useCallback(async () => {
      if (!currentUserId) {
        setAccounts([]);
        setTransfers([]);
        setErrorMessage("");

        return {
          success: false,
          message:
            "No hay una sesión activa.",
        };
      }

      const cached =
        readCache(
          currentUserId
        );

      if (isOffline()) {
        setAccounts(
          cached.accounts
        );
        setTransfers(
          cached.transfers
        );

        return {
          success: true,
          offline: true,
        };
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const [
          accountsResult,
          transfersResult,
        ] =
          await Promise.all([
            supabase
              .from("accounts")
              .select(
                ACCOUNT_FIELDS
              )
              .eq(
                "user_id",
                currentUserId
              )
              .order(
                "is_active",
                {
                  ascending: false,
                }
              )
              .order(
                "created_at",
                {
                  ascending: true,
                }
              ),

            supabase
              .from(
                "account_transfers"
              )
              .select(
                TRANSFER_FIELDS
              )
              .eq(
                "user_id",
                currentUserId
              )
              .order(
                "transfer_date",
                {
                  ascending: false,
                }
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              ),
          ]);

        const firstError =
          accountsResult.error ||
          transfersResult.error;

        if (firstError) {
          if (
            isNetworkError(
              firstError
            ) &&
            (
              cached.accounts
                .length > 0 ||
              cached.transfers
                .length > 0
            )
          ) {
            setAccounts(
              cached.accounts
            );
            setTransfers(
              cached.transfers
            );

            return {
              success: true,
              offline: true,
            };
          }

          throw firstError;
        }

        const mappedAccounts =
          (
            accountsResult.data ||
            []
          ).map(mapAccount);

        const mappedTransfers =
          (
            transfersResult.data ||
            []
          ).map(mapTransfer);

        setAccounts(
          mappedAccounts
        );

        setTransfers(
          mappedTransfers
        );

        writeCache(
          currentUserId,
          mappedAccounts,
          mappedTransfers
        );

        return {
          success: true,
          accounts:
            mappedAccounts,
          transfers:
            mappedTransfers,
        };
      } catch (error) {
        console.error(
          "No se pudieron cargar las cuentas:",
          error
        );

        const message =
          "No se pudieron cargar las cuentas.";

        setErrorMessage(
          message
        );

        return {
          success: false,
          message,
        };
      } finally {
        setLoading(false);
      }
    }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setAccounts([]);
      setTransfers([]);
      return;
    }

    const cached =
      readCache(
        currentUserId
      );

    if (
      cached.accounts.length >
        0 ||
      cached.transfers.length >
        0
    ) {
      setAccounts(
        cached.accounts
      );
      setTransfers(
        cached.transfers
      );
    }

    void loadAccountData();
  }, [
    currentUserId,
    loadAccountData,
  ]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    writeCache(
      currentUserId,
      accounts,
      transfers
    );
  }, [
    accounts,
    transfers,
    currentUserId,
  ]);

  useEffect(() => {
    const handleReload = () => {
      void loadAccountData();
    };

    window.addEventListener(
      "moneytrack:accounts-changed",
      handleReload
    );

    return () => {
      window.removeEventListener(
        "moneytrack:accounts-changed",
        handleReload
      );
    };
  }, [loadAccountData]);

  const activeAccounts =
    useMemo(
      () =>
        accounts.filter(
          (account) =>
            account.isActive
        ),
      [accounts]
    );

  const validateAccountInput =
    useCallback(
      (accountData) => {
        const name = String(
          accountData?.name ||
            ""
        ).trim();

        const type =
          VALID_TYPES.includes(
            accountData?.type
          )
            ? accountData.type
            : "other";

        const openingBalance =
          Number(
            accountData
              ?.openingBalance ?? 0
          );

        const notes = String(
          accountData?.notes ||
            ""
        ).trim();

        const includeInBalance =
          accountData?.includeInBalance !==
          false;

        if (!name) {
          return {
            success: false,
            message:
              "El nombre de la cuenta es obligatorio.",
          };
        }

        if (
          !Number.isFinite(
            openingBalance
          ) ||
          openingBalance < 0
        ) {
          return {
            success: false,
            message:
              "El saldo inicial no puede ser negativo.",
          };
        }

        return {
          success: true,
          data: {
            name,
            type,
            openingBalance,
            notes,
            includeInBalance,
          },
        };
      },
      []
    );

  const addAccount =
    useCallback(
      async (accountData) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para crear una cuenta.",
          };
        }

        const validation =
          validateAccountInput(
            accountData
          );

        if (!validation.success) {
          return validation;
        }

        const duplicated =
          accounts.some(
            (account) =>
              account.name
                .trim()
                .toLowerCase() ===
              validation.data.name
                .toLowerCase()
          );

        if (duplicated) {
          return {
            success: false,
            message:
              "Ya existe una cuenta con ese nombre.",
          };
        }

        const { data, error } =
          await supabase
            .from("accounts")
            .insert({
              user_id:
                currentUserId,
              name:
                validation.data
                  .name,
              type:
                validation.data
                  .type,
              opening_balance:
                validation.data
                  .openingBalance,
              notes:
                validation.data
                  .notes || null,
              include_in_balance:
                validation.data
                  .includeInBalance,
              is_active: true,
            })
            .select(
              ACCOUNT_FIELDS
            )
            .single();

        if (error) {
          return {
            success: false,
            message:
              error.code ===
              "23505"
                ? "Ya existe una cuenta con ese nombre."
                : "No se pudo crear la cuenta.",
          };
        }

        const mapped =
          mapAccount(data);

        setAccounts(
          (
            currentAccounts
          ) => [
            ...currentAccounts,
            mapped,
          ]
        );

        return {
          success: true,
          account: mapped,
        };
      },
      [
        accounts,
        currentUserId,
        validateAccountInput,
      ]
    );

  const updateAccount =
    useCallback(
      async (
        accountId,
        accountData
      ) => {
        if (
          !currentUserId ||
          !accountId
        ) {
          return {
            success: false,
            message:
              "No se encontró la cuenta.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para editar una cuenta.",
          };
        }

        const validation =
          validateAccountInput(
            accountData
          );

        if (!validation.success) {
          return validation;
        }

        const duplicated =
          accounts.some(
            (account) =>
              account.id !==
                accountId &&
              account.name
                .trim()
                .toLowerCase() ===
                validation.data.name
                  .toLowerCase()
          );

        if (duplicated) {
          return {
            success: false,
            message:
              "Ya existe una cuenta con ese nombre.",
          };
        }

        const { data, error } =
          await supabase
            .from("accounts")
            .update({
              name:
                validation.data
                  .name,
              type:
                validation.data
                  .type,
              opening_balance:
                validation.data
                  .openingBalance,
              notes:
                validation.data
                  .notes || null,
              include_in_balance:
                validation.data
                  .includeInBalance,
            })
            .eq(
              "id",
              accountId
            )
            .eq(
              "user_id",
              currentUserId
            )
            .select(
              ACCOUNT_FIELDS
            )
            .single();

        if (error) {
          return {
            success: false,
            message:
              error.code ===
              "23505"
                ? "Ya existe una cuenta con ese nombre."
                : "No se pudo actualizar la cuenta.",
          };
        }

        const mapped =
          mapAccount(data);

        setAccounts(
          (
            currentAccounts
          ) =>
            currentAccounts.map(
              (account) =>
                account.id ===
                mapped.id
                  ? mapped
                  : account
            )
        );

        return {
          success: true,
          account: mapped,
        };
      },
      [
        accounts,
        currentUserId,
        validateAccountInput,
      ]
    );

  const setAccountActive =
    useCallback(
      async (
        accountId,
        isActive
      ) => {
        if (
          !currentUserId ||
          !accountId
        ) {
          return {
            success: false,
            message:
              "No se encontró la cuenta.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para cambiar el estado de una cuenta.",
          };
        }

        const { data, error } =
          await supabase
            .from("accounts")
            .update({
              is_active:
                Boolean(
                  isActive
                ),
            })
            .eq(
              "id",
              accountId
            )
            .eq(
              "user_id",
              currentUserId
            )
            .select(
              ACCOUNT_FIELDS
            )
            .single();

        if (error) {
          return {
            success: false,
            message:
              "No se pudo cambiar el estado de la cuenta.",
          };
        }

        const mapped =
          mapAccount(data);

        setAccounts(
          (
            currentAccounts
          ) =>
            currentAccounts.map(
              (account) =>
                account.id ===
                mapped.id
                  ? mapped
                  : account
            )
        );

        return {
          success: true,
          account: mapped,
        };
      },
      [currentUserId]
    );

  const deleteAccount =
    useCallback(
      async (accountId) => {
        if (
          !currentUserId ||
          !accountId
        ) {
          return {
            success: false,
            message:
              "No se encontró la cuenta.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para eliminar una cuenta.",
          };
        }

        const [
          transactionResult,
          transferResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "transactions"
              )
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq(
                "user_id",
                currentUserId
              )
              .eq(
                "account_id",
                accountId
              ),

            supabase
              .from(
                "account_transfers"
              )
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq(
                "user_id",
                currentUserId
              )
              .or(
                `from_account_id.eq.${accountId},to_account_id.eq.${accountId}`
              ),
          ]);

        const firstError =
          transactionResult.error ||
          transferResult.error;

        if (firstError) {
          return {
            success: false,
            message:
              "No se pudo comprobar el historial de la cuenta.",
          };
        }

        if (
          (
            transactionResult.count ||
            0
          ) > 0 ||
          (
            transferResult.count ||
            0
          ) > 0
        ) {
          return {
            success: false,
            code:
              "ACCOUNT_HAS_HISTORY",
            message:
              "Esta cuenta tiene movimientos o transferencias. Desactívala para conservar el historial.",
          };
        }

        const { error } =
          await supabase
            .from("accounts")
            .delete()
            .eq(
              "id",
              accountId
            )
            .eq(
              "user_id",
              currentUserId
            );

        if (error) {
          return {
            success: false,
            message:
              "No se pudo eliminar la cuenta.",
          };
        }

        setAccounts(
          (
            currentAccounts
          ) =>
            currentAccounts.filter(
              (account) =>
                account.id !==
                accountId
            )
        );

        return {
          success: true,
        };
      },
      [currentUserId]
    );

  const validateTransferInput =
    useCallback(
      (
        transferData,
        requireActive = false
      ) => {
        const fromAccountId =
          transferData
            ?.fromAccountId ||
          "";

        const toAccountId =
          transferData
            ?.toAccountId ||
          "";

        const amount =
          Number(
            transferData?.amount
          );

        const date =
          String(
            transferData?.date ||
              ""
          ).trim();

        const notes =
          String(
            transferData?.notes ||
              ""
          ).trim();

        if (
          !fromAccountId ||
          !toAccountId
        ) {
          return {
            success: false,
            message:
              "Seleccioná la cuenta de origen y la de destino.",
          };
        }

        if (
          fromAccountId ===
          toAccountId
        ) {
          return {
            success: false,
            message:
              "La cuenta de origen y destino deben ser diferentes.",
          };
        }

        const fromAccount =
          accounts.find(
            (account) =>
              account.id ===
              fromAccountId
          );

        const toAccount =
          accounts.find(
            (account) =>
              account.id ===
              toAccountId
          );

        if (
          !fromAccount ||
          !toAccount
        ) {
          return {
            success: false,
            message:
              "No se encontró una de las cuentas seleccionadas.",
          };
        }

        if (
          requireActive &&
          (
            !fromAccount.isActive ||
            !toAccount.isActive
          )
        ) {
          return {
            success: false,
            message:
              "Para crear una transferencia ambas cuentas deben estar activas.",
          };
        }

        if (
          !Number.isFinite(
            amount
          ) ||
          amount <= 0
        ) {
          return {
            success: false,
            message:
              "El monto de la transferencia debe ser mayor a 0.",
          };
        }

        if (
          !date ||
          !isValidDateString(
            date
          )
        ) {
          return {
            success: false,
            message:
              "Seleccioná una fecha válida.",
          };
        }

        if (
          date >
          getLocalToday()
        ) {
          return {
            success: false,
            message:
              "La fecha de la transferencia no puede ser posterior a hoy.",
          };
        }

        return {
          success: true,
          data: {
            fromAccountId,
            toAccountId,
            amount,
            date,
            notes,
          },
        };
      },
      [accounts]
    );

  const addTransfer =
    useCallback(
      async (transferData) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para transferir entre cuentas.",
          };
        }

        const validation =
          validateTransferInput(
            transferData,
            true
          );

        if (!validation.success) {
          return validation;
        }

        const { data, error } =
          await supabase
            .from(
              "account_transfers"
            )
            .insert({
              user_id:
                currentUserId,
              from_account_id:
                validation.data
                  .fromAccountId,
              to_account_id:
                validation.data
                  .toAccountId,
              amount:
                validation.data
                  .amount,
              transfer_date:
                validation.data
                  .date,
              notes:
                validation.data
                  .notes || null,
            })
            .select(
              TRANSFER_FIELDS
            )
            .single();

        if (error) {
          return {
            success: false,
            message:
              "No se pudo registrar la transferencia.",
          };
        }

        const mapped =
          mapTransfer(data);

        setTransfers(
          (
            currentTransfers
          ) => [
            mapped,
            ...currentTransfers,
          ]
        );

        return {
          success: true,
          transfer: mapped,
        };
      },
      [
        currentUserId,
        validateTransferInput,
      ]
    );

  const updateTransfer =
    useCallback(
      async (
        transferId,
        transferData
      ) => {
        if (
          !currentUserId ||
          !transferId
        ) {
          return {
            success: false,
            message:
              "No se encontró la transferencia.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para editar una transferencia.",
          };
        }

        const validation =
          validateTransferInput(
            transferData,
            false
          );

        if (!validation.success) {
          return validation;
        }

        const { data, error } =
          await supabase
            .from(
              "account_transfers"
            )
            .update({
              from_account_id:
                validation.data
                  .fromAccountId,
              to_account_id:
                validation.data
                  .toAccountId,
              amount:
                validation.data
                  .amount,
              transfer_date:
                validation.data
                  .date,
              notes:
                validation.data
                  .notes || null,
            })
            .eq(
              "id",
              transferId
            )
            .eq(
              "user_id",
              currentUserId
            )
            .select(
              TRANSFER_FIELDS
            )
            .single();

        if (error) {
          return {
            success: false,
            message:
              "No se pudo actualizar la transferencia.",
          };
        }

        const mapped =
          mapTransfer(data);

        setTransfers(
          (
            currentTransfers
          ) =>
            currentTransfers.map(
              (transfer) =>
                transfer.id ===
                mapped.id
                  ? mapped
                  : transfer
            )
        );

        return {
          success: true,
          transfer: mapped,
        };
      },
      [
        currentUserId,
        validateTransferInput,
      ]
    );

  const deleteTransfer =
    useCallback(
      async (transferId) => {
        if (
          !currentUserId ||
          !transferId
        ) {
          return {
            success: false,
            message:
              "No se encontró la transferencia.",
          };
        }

        if (isOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para eliminar una transferencia.",
          };
        }

        const { error } =
          await supabase
            .from(
              "account_transfers"
            )
            .delete()
            .eq(
              "id",
              transferId
            )
            .eq(
              "user_id",
              currentUserId
            );

        if (error) {
          return {
            success: false,
            message:
              "No se pudo eliminar la transferencia.",
          };
        }

        setTransfers(
          (
            currentTransfers
          ) =>
            currentTransfers.filter(
              (transfer) =>
                transfer.id !==
                transferId
            )
        );

        return {
          success: true,
        };
      },
      [currentUserId]
    );

  const value = useMemo(
    () => ({
      accounts,
      activeAccounts,
      transfers,
      loading,
      errorMessage,

      loadAccountData,

      addAccount,
      updateAccount,
      setAccountActive,
      deleteAccount,

      addTransfer,
      updateTransfer,
      deleteTransfer,
    }),
    [
      accounts,
      activeAccounts,
      transfers,
      loading,
      errorMessage,
      loadAccountData,
      addAccount,
      updateAccount,
      setAccountActive,
      deleteAccount,
      addTransfer,
      updateTransfer,
      deleteTransfer,
    ]
  );

  return (
    <AccountContext.Provider
      value={value}
    >
      {children}
    </AccountContext.Provider>
  );
}

export default AccountProvider;
