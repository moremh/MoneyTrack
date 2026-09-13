import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  addPendingSyncOperation,
  getFinanceSnapshot,
  getPendingSyncConflicts,
  getPendingSyncOperations,
  markPendingSyncConflict,
  queueGoalMovementSyncOperation,
  queueTransactionSyncOperation,
  removePendingSyncOperation,
  saveFinanceSnapshot,
  updatePendingSyncOperation,
} from "../lib/offlineStorage";

import { useAuth } from "./AuthContext";

import {
  getLocalToday,
  isValidDateString,
} from "../utils/dateUtils";

import {
  getDefaultCategoryIcon,
  getRandomCategoryColor,
  normalizeCategoryColor,
  normalizeCategoryIcon,
} from "../utils/categoryCustomization";

export const FinanceContext = createContext(null);

export const FREE_LIMIT_ERROR_CODE =
  "FREE_LIMIT_REACHED";

export const DEFAULT_FREE_MONTHLY_LIMIT = 100;

const UNCATEGORIZED = "General";

const DEFAULT_SETTINGS = {
  userName: "Usuario",
  theme: "light",
};

const createClientMutationId =
  () => {
    const cryptoObject =
      globalThis?.crypto;

    if (
      cryptoObject &&
      typeof cryptoObject.randomUUID ===
        "function"
    ) {
      return (
        cryptoObject.randomUUID()
      );
    }

    /*
     * Fallback para navegadores donde
     * randomUUID no esté disponible.
     *
     * Sigue generando un UUID válido
     * para poder enviarlo a PostgreSQL.
     */

    const bytes =
      new Uint8Array(16);

    if (
      cryptoObject &&
      typeof cryptoObject.getRandomValues ===
        "function"
    ) {
      cryptoObject.getRandomValues(
        bytes
      );
    } else {
      for (
        let index = 0;
        index < bytes.length;
        index += 1
      ) {
        bytes[index] =
          Math.floor(
            Math.random() * 256
          );
      }
    }

    bytes[6] =
      (bytes[6] & 0x0f) |
      0x40;

    bytes[8] =
      (bytes[8] & 0x3f) |
      0x80;

    const hex =
      Array.from(
        bytes,
        (byte) =>
          byte
            .toString(16)
            .padStart(2, "0")
      );

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  };

  const isDeviceOffline = () =>
  typeof navigator !==
    "undefined" &&
  navigator.onLine === false;

  const isNetworkError = (
  error
) => {
  if (isDeviceOffline()) {
    return true;
  }

  const content = [
    error?.message,
    error?.details,
    error?.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    content.includes(
      "failed to fetch"
    ) ||
    content.includes(
      "networkerror"
    ) ||
    content.includes(
      "network request failed"
    ) ||
    content.includes(
      "fetch failed"
    )
  );
};

const TRANSACTION_FIELDS = `
  id,
  user_id,
  type,
  description,
  amount,
  category_id,
  category_name,
  date,
  client_mutation_id,
  created_at,
  updated_at
`;

const CATEGORY_FIELDS = `
  id,
  user_id,
  name,
  type,
  color,
  icon,
  is_default,
  created_at,
  updated_at
`;

const GOAL_FIELDS = `
  id,
  user_id,
  name,
  description,
  target_amount,
  current_amount,
  deadline,
  status,
  created_at,
  updated_at
`;

const GOAL_MOVEMENT_FIELDS = `
  id,
  user_id,
  goal_id,
  type,
  amount,
  description,
  date,
  client_mutation_id,
  created_at,
  updated_at
`;

const getDefaultMovementUsage = (currentUser) => {
  const isPremium =
    currentUser?.role === "admin" ||
    currentUser?.plan === "premium";

  const limit = isPremium
    ? null
    : Number(currentUser?.monthlyLimit) ||
      DEFAULT_FREE_MONTHLY_LIMIT;

  return {
    used: 0,
    limit,
    remaining: isPremium ? null : limit,
    percentage: 0,
    isPremium,
    hasReachedLimit: false,
    canAddMovement: true,
  };
};

const normalizeTheme = (theme) => {
  if (
    theme === "dark" ||
    theme === "light" ||
    theme === "system"
  ) {
    return theme;
  }

  return "light";
};

const mapTransaction = (
  transaction
) => ({
  id: transaction.id,

  userId:
    transaction.user_id,

  type:
    transaction.type,

  description:
    transaction.description,

  amount:
    Number(
      transaction.amount
    ) || 0,

  categoryId:
    transaction.category_id ||
    null,

  category:
    transaction.category_name ||
    UNCATEGORIZED,

  date:
    transaction.date,

  clientMutationId:
    transaction.client_mutation_id ||
    null,

  /*
   * Los movimientos obtenidos desde
   * Supabase ya están sincronizados.
   */
  isPendingSync: false,

  createdAt:
    transaction.created_at,

  updatedAt:
    transaction.updated_at,
});

const mapCategory = (category) => ({
  id: category.id,
  userId: category.user_id,
  name: category.name,
  type: category.type,
  color: category.color || null,
  icon: category.icon || null,
  isDefault: Boolean(category.is_default),
  createdAt: category.created_at,
  updatedAt: category.updated_at,
});

const mapGoal = (goal) => {
  const targetAmount =
    Number(goal.target_amount) || 0;

  const currentAmount =
    Number(goal.current_amount) || 0;

  return {
    id: goal.id,
    userId: goal.user_id,

    name: goal.name,
    title: goal.name,

    description: goal.description || "",

    targetAmount,
    target: targetAmount,
    amount: targetAmount,

    currentAmount,
    savedAmount: currentAmount,
    saved: currentAmount,

    deadline: goal.deadline || "",
    date: goal.deadline || "",

    status: goal.status || "active",

    createdAt: goal.created_at,
    updatedAt: goal.updated_at,
  };
};

const mapGoalMovement = (movement) => {
  const description =
    movement.description || "";

  return {
    id: movement.id,
    userId: movement.user_id,
    goalId: movement.goal_id,
    type: movement.type,
    amount:
      Number(movement.amount) || 0,
    description,
    date: movement.date,

    clientMutationId:
      movement.client_mutation_id ||
      null,

    /*
     * Los movimientos obtenidos desde
     * Supabase ya están sincronizados.
     */
    isPendingSync: false,

    /*
     * Este registro fue creado cuando
     * migramos los ahorros antiguos al
     * historial. Representa dinero que
     * ya estaba ahorrado, no un nuevo
     * movimiento financiero del período.
     */
    isOpeningBalance:
      description ===
      "Saldo inicial del objetivo",

    createdAt:
      movement.created_at,

    updatedAt:
      movement.updated_at,
  };
};


/*
 * Devuelve el efecto que un movimiento
 * de ahorro tiene sobre el saldo.
 *
 * deposit    => suma
 * withdrawal => resta
 */
const getGoalMovementEffect = (
  movement
) => {
  if (!movement) {
    return 0;
  }

  const amount =
    Number(movement.amount) || 0;

  return movement.type ===
    "withdrawal"
    ? -amount
    : amount;
};


const sortGoalMovements = (
  movements
) => {
  return [...movements].sort(
    (a, b) => {
      const dateComparison =
        String(
          b?.date || ""
        ).localeCompare(
          String(
            a?.date || ""
          )
        );

      if (dateComparison !== 0) {
        return dateComparison;
      }

      return String(
        b?.createdAt || ""
      ).localeCompare(
        String(
          a?.createdAt || ""
        )
      );
    }
  );
};


/*
 * Aplica de forma local el cambio de un
 * movimiento de ahorro sobre los objetivos.
 *
 * - CREATE:
 *   previousMovement = null
 *
 * - UPDATE:
 *   previousMovement = versión anterior
 *   nextMovement = versión nueva
 *
 * - DELETE:
 *   nextMovement = null
 *
 * Esto nos permite mantener los saldos
 * correctos incluso sin conexión.
 */
const calculateGoalsAfterMovementChange =
  (
    currentGoals,
    previousMovement,
    nextMovement
  ) => {
    const goalsArray =
      Array.isArray(currentGoals)
        ? currentGoals
        : [];

    const amountByGoalId =
      new Map(
        goalsArray.map(
          (goal) => [
            goal.id,
            Number(
              goal.currentAmount
            ) || 0,
          ]
        )
      );

    const affectedGoalIds =
      new Set();

    const applyDelta = (
      goalId,
      delta
    ) => {
      if (!goalId) {
        return true;
      }

      if (
        !amountByGoalId.has(
          goalId
        )
      ) {
        return false;
      }

      const nextAmount =
        (
          amountByGoalId.get(
            goalId
          ) || 0
        ) + delta;

      /*
       * Evitamos pequeños negativos
       * causados por precisión decimal.
       */
      if (nextAmount < -0.000001) {
        return false;
      }

      amountByGoalId.set(
        goalId,
        Math.max(
          nextAmount,
          0
        )
      );

      affectedGoalIds.add(
        goalId
      );

      return true;
    };

    if (previousMovement) {
      const reversed =
        applyDelta(
          previousMovement.goalId,
          -getGoalMovementEffect(
            previousMovement
          )
        );

      if (!reversed) {
        return {
          success: false,
          goals: goalsArray,
        };
      }
    }

    if (nextMovement) {
      const applied =
        applyDelta(
          nextMovement.goalId,
          getGoalMovementEffect(
            nextMovement
          )
        );

      if (!applied) {
        return {
          success: false,
          goals: goalsArray,
        };
      }
    }

    const nextGoals =
      goalsArray.map(
        (goal) => {
          if (
            !affectedGoalIds.has(
              goal.id
            )
          ) {
            return goal;
          }

          const currentAmount =
            amountByGoalId.get(
              goal.id
            ) || 0;

          const targetAmount =
            Number(
              goal.targetAmount
            ) || 0;

          return {
            ...goal,

            currentAmount,
            savedAmount:
              currentAmount,
            saved:
              currentAmount,

            status:
              targetAmount > 0 &&
              currentAmount >=
                targetAmount
                ? "completed"
                : "active",
          };
        }
      );

    return {
      success: true,
      goals: nextGoals,
    };
  };

const mapMovementUsage = (
  data,
  currentUser
) => {
  const row = Array.isArray(data)
    ? data[0]
    : data;

  if (!row) {
    return getDefaultMovementUsage(
      currentUser
    );
  }

  const isPremium = Boolean(
    row.is_premium
  );

  const limit = isPremium
    ? null
    : Number(row.movement_limit) ||
      DEFAULT_FREE_MONTHLY_LIMIT;

  const used = Number(row.used) || 0;

  const remaining = isPremium
    ? null
    : Math.max(
        Number(row.remaining) || 0,
        0
      );

  const percentage = isPremium
    ? 0
    : Math.min(
        Math.max(
          Number(row.percentage) || 0,
          0
        ),
        100
      );

  const hasReachedLimit =
    !isPremium &&
    Boolean(row.has_reached_limit);

  return {
    used,
    limit,
    remaining,
    percentage,
    isPremium,
    hasReachedLimit,
    canAddMovement:
      isPremium || !hasReachedLimit,
  };
};

const getErrorContent = (error) => {
  return [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
};

const isFreeLimitError = (error) => {
  return getErrorContent(error).includes(
    FREE_LIMIT_ERROR_CODE
  );
};

const isOfflineTransactionConflict =
  (error) => {
    return getErrorContent(
      error
    ).includes(
      "OFFLINE_TRANSACTION_CONFLICT"
    );
  };

const isOfflineTransactionNotFound =
  (error) => {
    return getErrorContent(
      error
    ).includes(
      "TRANSACTION_NOT_FOUND"
    );
  };


const isOfflineGoalMovementConflict =
  (error) => {
    return getErrorContent(
      error
    ).includes(
      "OFFLINE_GOAL_MOVEMENT_CONFLICT"
    );
  };


const isOfflineGoalMovementNotFound =
  (error) => {
    return getErrorContent(
      error
    ).includes(
      "GOAL_MOVEMENT_NOT_FOUND"
    );
  };

const getDatabaseErrorMessage = (
  error,
  fallbackMessage
) => {
  const errorContent =
    getErrorContent(error);

  if (
    errorContent.includes(
      FREE_LIMIT_ERROR_CODE
    )
  ) {
    return "Llegaste al límite mensual de movimientos del plan gratuito.";
  }

  if (
    errorContent.includes(
      "ACCOUNT_BLOCKED"
    )
  ) {
    return "Esta cuenta se encuentra bloqueada.";
  }

  if (
    errorContent.includes(
      "CATEGORY_TYPE_MISMATCH"
    )
  ) {
    return "La categoría seleccionada no corresponde al tipo de movimiento.";
  }

  if (
    errorContent.includes(
      "CATEGORY_NOT_OWNED_BY_USER"
    )
  ) {
    return "No tenés permiso para utilizar esa categoría.";
  }

  if (
    errorContent.includes(
      "INSUFFICIENT_GOAL_BALANCE"
    )
  ) {
    return "No podés retirar un monto mayor al dinero ahorrado en este objetivo.";
  }

  if (
  errorContent.includes(
    "GOAL_MOVEMENT_NOT_FOUND"
  )
) {
  return "No se encontró el movimiento de ahorro.";
}

  if (
    errorContent.includes(
      "GOAL_NOT_FOUND"
    )
  ) {
    return "No se encontró el objetivo de ahorro.";
  }

  if (
    errorContent.includes(
      "INVALID_GOAL_MOVEMENT_TYPE"
    )
  ) {
    return "El tipo de movimiento de ahorro no es válido.";
  }

  if (
    errorContent.includes(
      "INVALID_GOAL_MOVEMENT_AMOUNT"
    )
  ) {
    return "El monto del ahorro debe ser mayor a 0.";
  }

  if (
    errorContent.includes(
      "INVALID_GOAL_MOVEMENT_DATE"
    )
  ) {
    return "La fecha del movimiento de ahorro no es válida.";
  }

  if (
    errorContent.includes(
      "NOT_AUTHENTICATED"
    )
  ) {
    return "Debés iniciar sesión para registrar movimientos de ahorro.";
  }

  if (error?.code === "23505") {
    return "Ya existe un registro con esos datos.";
  }

  console.error(
    fallbackMessage,
    error
  );

  return fallbackMessage;
};

const getGoalPayload = (goal) => {
  const name = String(
    goal?.name ||
      goal?.title ||
      ""
  ).trim();

  const description = String(
    goal?.description || ""
  ).trim();

  const targetAmount = Number(
    goal?.targetAmount ??
      goal?.target_amount ??
      goal?.target ??
      goal?.amount
  );

  const currentAmount = Number(
    goal?.currentAmount ??
      goal?.current_amount ??
      goal?.savedAmount ??
      goal?.saved ??
      0
  );

  const deadline =
    goal?.deadline ||
    goal?.date ||
    null;

  let status =
    goal?.status || "active";

  if (
    Number.isFinite(targetAmount) &&
    Number.isFinite(currentAmount) &&
    targetAmount > 0 &&
    currentAmount >= targetAmount
  ) {
    status = "completed";
  }

  return {
    name,
    description:
      description || null,
    target_amount: targetAmount,
    current_amount: currentAmount,
    deadline: deadline || null,
    status,
  };
};

function FinanceProvider({ children }) {
  const {
    currentUser,
    refreshCurrentUser,
  } = useAuth();

  const [incomes, setIncomes] =
    useState([]);

  const [expenses, setExpenses] =
    useState([]);

  const [goals, setGoals] =
    useState([]);

  const [
    goalMovements,
    setGoalMovements,
  ] = useState([]);

  const [
    categoryRecords,
    setCategoryRecords,
  ] = useState([]);

  const [settings, setSettings] =
    useState(DEFAULT_SETTINGS);

  const [
    movementUsage,
    setMovementUsage,
  ] = useState(
    getDefaultMovementUsage(null)
  );

  const [loading, setLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [
  financeCacheReady,
  setFinanceCacheReady,
] = useState(false);

  const syncInProgressRef =
  useRef(false);

  const [
  isOnline,
  setIsOnline,
] = useState(() => {
  if (
    typeof navigator ===
    "undefined"
  ) {
    return true;
  }

  return navigator.onLine;
});

const [
  isSyncing,
  setIsSyncing,
] = useState(false);

const [
  pendingSyncCount,
  setPendingSyncCount,
] = useState(0);

const [
  syncConflicts,
  setSyncConflicts,
] = useState([]);

  const currentUserId =
    currentUser?.id || null;

  const refreshPendingSyncCount =
    useCallback(async () => {
      if (!currentUserId) {
        setPendingSyncCount(0);
        return 0;
      }

      const operations =
        await getPendingSyncOperations(
          currentUserId
        );

      const count =
        operations.filter(
          (operation) =>
            [
              "transaction",
              "goal_movement",
            ].includes(
              operation?.entity
            ) &&
            [
              "create",
              "update",
              "delete",
            ].includes(
              operation?.action
            )
        ).length;

      setPendingSyncCount(count);

      return count;
    }, [currentUserId]);

  const refreshSyncConflicts =
    useCallback(async () => {
      if (!currentUserId) {
        setSyncConflicts([]);
        return [];
      }

      const conflicts =
        await getPendingSyncConflicts(
          currentUserId
        );

      setSyncConflicts(conflicts);

      return conflicts;
    }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) {
      setPendingSyncCount(0);
      setSyncConflicts([]);
      return;
    }

    void refreshPendingSyncCount();
    void refreshSyncConflicts();
  }, [
    currentUserId,
    financeCacheReady,
    refreshPendingSyncCount,
    refreshSyncConflicts,
  ]);

  useEffect(() => {
    const handleOnlineState = () => {
      setIsOnline(true);
    };

    const handleOfflineState = () => {
      setIsOnline(false);
    };

    setIsOnline(
      typeof navigator === "undefined"
        ? true
        : navigator.onLine
    );

    window.addEventListener(
      "online",
      handleOnlineState
    );

    window.addEventListener(
      "offline",
      handleOfflineState
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnlineState
      );

      window.removeEventListener(
        "offline",
        handleOfflineState
      );
    };
  }, []);

  const incomeCategories =
    useMemo(() => {
      const names = categoryRecords
        .filter(
          (category) =>
            category.type === "income"
        )
        .map(
          (category) =>
            category.name
        );

      return [
        UNCATEGORIZED,
        ...names.filter(
          (name) =>
            name.toLowerCase() !==
            UNCATEGORIZED.toLowerCase()
        ),
      ];
    }, [categoryRecords]);

  const expenseCategories =
    useMemo(() => {
      const names = categoryRecords
        .filter(
          (category) =>
            category.type === "expense"
        )
        .map(
          (category) =>
            category.name
        );

      return [
        UNCATEGORIZED,
        ...names.filter(
          (name) =>
            name.toLowerCase() !==
            UNCATEGORIZED.toLowerCase()
        ),
      ];
    }, [categoryRecords]);

const resetLocalState =
  useCallback(() => {
    setIncomes([]);
    setExpenses([]);
    setGoals([]);
    setGoalMovements([]);
    setCategoryRecords([]);

    setSettings(
      DEFAULT_SETTINGS
    );

    setMovementUsage(
      getDefaultMovementUsage(null)
    );

    setFinanceCacheReady(false);
    setPendingSyncCount(0);
    setSyncConflicts([]);

    setErrorMessage("");
    setLoading(false);
  }, []);

const applyFinanceSnapshot =
  useCallback(
    (snapshot) => {
      if (!snapshot) {
        return false;
      }

      setIncomes(
        Array.isArray(snapshot.incomes)
          ? snapshot.incomes
          : []
      );

      setExpenses(
        Array.isArray(snapshot.expenses)
          ? snapshot.expenses
          : []
      );

      setGoals(
        Array.isArray(snapshot.goals)
          ? snapshot.goals
          : []
      );

      setGoalMovements(
        Array.isArray(
          snapshot.goalMovements
        )
          ? snapshot.goalMovements
          : []
      );

      setCategoryRecords(
        Array.isArray(
          snapshot.categoryRecords
        )
          ? snapshot.categoryRecords
          : []
      );

      setSettings({
        userName:
          snapshot.settings?.userName ||
          currentUser?.name ||
          DEFAULT_SETTINGS.userName,

        theme: normalizeTheme(
          snapshot.settings?.theme ||
            currentUser?.theme ||
            DEFAULT_SETTINGS.theme
        ),
      });

      setMovementUsage(
        snapshot.movementUsage ||
          getDefaultMovementUsage(
            currentUser
          )
      );

      setErrorMessage("");
      setFinanceCacheReady(true);

      return true;
    },
    [currentUser]
  );

  const refreshMovementUsage =
    useCallback(async () => {
      if (!currentUserId) {
        const emptyUsage =
          getDefaultMovementUsage(null);

        setMovementUsage(emptyUsage);

        return {
          success: false,
          usage: emptyUsage,
          message:
            "No hay una sesión activa.",
        };
      }

      const { data, error } =
        await supabase.rpc(
          "get_my_movement_usage"
        );

      if (error) {
        const fallbackUsage =
          getDefaultMovementUsage(
            currentUser
          );

        setMovementUsage(
          fallbackUsage
        );

        return {
          success: false,
          usage: fallbackUsage,
          message:
            "No se pudo actualizar el uso mensual.",
        };
      }

      const mappedUsage =
        mapMovementUsage(
          data,
          currentUser
        );

      setMovementUsage(
        mappedUsage
      );

      return {
        success: true,
        usage: mappedUsage,
      };
    }, [
      currentUser,
      currentUserId,
    ]);

  const loadFinanceData =
  useCallback(async () => {
    if (!currentUserId) {
      resetLocalState();

      return {
        success: false,
        message:
          "No hay una sesión activa.",
      };
    }

    setLoading(true);
    setErrorMessage("");

    const loadCachedFinance =
      async () => {
        const snapshot =
          await getFinanceSnapshot(
            currentUserId
          );

        if (!snapshot) {
          return false;
        }

        return applyFinanceSnapshot(
          snapshot
        );
      };

    /*
     * Si sabemos que no hay conexión,
     * ni siquiera intentamos consultar
     * Supabase.
     */
    if (!navigator.onLine) {
      const loadedFromCache =
        await loadCachedFinance();

      setLoading(false);

      if (loadedFromCache) {
        return {
          success: true,
          offline: true,
        };
      }

      const message =
        "No hay conexión y todavía no existen datos financieros guardados en este dispositivo.";

      setErrorMessage(message);

      return {
        success: false,
        offline: true,
        message,
      };
    }

    try {
      const [
        transactionsResult,
        categoriesResult,
        goalsResult,
        goalMovementsResult,
        usageResult,
      ] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            TRANSACTION_FIELDS
          )
          .eq(
            "user_id",
            currentUserId
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("categories")
          .select(CATEGORY_FIELDS)
          .eq(
            "user_id",
            currentUserId
          )
          .order("created_at", {
            ascending: true,
          }),

        supabase
          .from("goals")
          .select(GOAL_FIELDS)
          .eq(
            "user_id",
            currentUserId
          )
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("goal_movements")
          .select(
            GOAL_MOVEMENT_FIELDS
          )
          .eq(
            "user_id",
            currentUserId
          )
          .order("date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),

        supabase.rpc(
          "get_my_movement_usage"
        ),
      ]);

      if (
        transactionsResult.error
      ) {
        throw transactionsResult.error;
      }

      if (
        categoriesResult.error
      ) {
        throw categoriesResult.error;
      }

      if (goalsResult.error) {
        throw goalsResult.error;
      }

      if (
        goalMovementsResult.error
      ) {
        throw goalMovementsResult.error;
      }

      const transactions = (
        transactionsResult.data || []
      ).map(mapTransaction);

      const nextIncomes =
        transactions.filter(
          (transaction) =>
            transaction.type ===
            "income"
        );

      const nextExpenses =
        transactions.filter(
          (transaction) =>
            transaction.type ===
            "expense"
        );

      const nextCategories = (
        categoriesResult.data || []
      ).map(mapCategory);

      const nextGoals = (
        goalsResult.data || []
      ).map(mapGoal);

      const nextGoalMovements = (
        goalMovementsResult.data || []
      ).map(mapGoalMovement);

      const nextSettings = {
        userName:
          currentUser?.name ||
          DEFAULT_SETTINGS.userName,

        theme: normalizeTheme(
          currentUser?.theme ||
            DEFAULT_SETTINGS.theme
        ),
      };

      let nextMovementUsage;

      if (usageResult.error) {
        console.error(
          "No se pudo cargar el uso mensual:",
          usageResult.error
        );

        nextMovementUsage =
          getDefaultMovementUsage(
            currentUser
          );
      } else {
        nextMovementUsage =
          mapMovementUsage(
            usageResult.data,
            currentUser
          );
      }

      setIncomes(nextIncomes);
      setExpenses(nextExpenses);

      setCategoryRecords(
        nextCategories
      );

      setGoals(nextGoals);

      setGoalMovements(
        nextGoalMovements
      );

      setSettings(nextSettings);

      setMovementUsage(
        nextMovementUsage
      );

      /*
       * A partir de este momento ya
       * podemos mantener una copia local
       * de los estados financieros.
       */
      setFinanceCacheReady(true);

      await saveFinanceSnapshot(
        currentUserId,
        {
          incomes: nextIncomes,
          expenses: nextExpenses,
          goals: nextGoals,

          goalMovements:
            nextGoalMovements,

          categoryRecords:
            nextCategories,

          settings: nextSettings,

          movementUsage:
            nextMovementUsage,

          cachedAt:
            new Date().toISOString(),
        }
      );

      return {
        success: true,
        offline: false,
      };
    } catch (error) {
      console.warn(
        "No se pudieron obtener los datos desde Supabase. Intentando usar la copia offline.",
        error
      );

      /*
       * Incluso si navigator.onLine decía
       * que había internet, la conexión a
       * Supabase puede haber fallado.
       */
      const loadedFromCache =
        await loadCachedFinance();

      if (loadedFromCache) {
        return {
          success: true,
          offline: true,
        };
      }

      const message =
        getDatabaseErrorMessage(
          error,
          "No se pudieron cargar los datos financieros."
        );

      setErrorMessage(message);

      return {
        success: false,
        message,
      };
    } finally {
      setLoading(false);
    }
  }, [
    applyFinanceSnapshot,
    currentUser,
    currentUserId,
    resetLocalState,
  ]);

  useEffect(() => {
    if (!currentUserId) {
      resetLocalState();
      return;
    }

    void loadFinanceData();
  }, [
    currentUserId,
    loadFinanceData,
    resetLocalState,
  ]);

useEffect(() => {
  if (
    !currentUserId ||
    !financeCacheReady
  ) {
    return;
  }

  void saveFinanceSnapshot(
    currentUserId,
    {
      incomes,
      expenses,
      goals,

      goalMovements,

      categoryRecords,

      settings,

      movementUsage,

      cachedAt:
        new Date().toISOString(),
    }
  );
}, [
  currentUserId,
  financeCacheReady,
  incomes,
  expenses,
  goals,
  goalMovements,
  categoryRecords,
  settings,
  movementUsage,
]);

  useEffect(() => {
    const applyTheme = () => {
      const selectedTheme =
        settings.theme || "light";

      const resolvedTheme =
        selectedTheme === "system"
          ? window.matchMedia(
              "(prefers-color-scheme: dark)"
            ).matches
            ? "dark"
            : "light"
          : selectedTheme;

      document.body.dataset.theme =
        resolvedTheme;
    };

    applyTheme();

    if (
      settings.theme !== "system"
    ) {
      return undefined;
    }

    const mediaQuery =
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      );

    mediaQuery.addEventListener?.(
      "change",
      applyTheme
    );

    return () => {
      mediaQuery.removeEventListener?.(
        "change",
        applyTheme
      );
    };
  }, [settings.theme]);

  const findCategoryRecord =
    useCallback(
      (categoryName, type) => {
        if (
          !categoryName ||
          categoryName.toLowerCase() ===
            UNCATEGORIZED.toLowerCase()
        ) {
          return null;
        }

        return (
          categoryRecords.find(
            (category) =>
              category.type === type &&
              category.name.toLowerCase() ===
                categoryName
                  .trim()
                  .toLowerCase()
          ) || null
        );
      },
      [categoryRecords]
    );

  const validateMovement =
    useCallback(
      (movement) => {
        if (!currentUserId) {
          return {
            success: false,
            code:
              "NOT_AUTHENTICATED",
            message:
              "Debés iniciar sesión para registrar movimientos.",
          };
        }

        const description = String(
          movement?.description || ""
        ).trim();

        const amount = Number(
          movement?.amount
        );

        if (!description) {
          return {
            success: false,
            message:
              "La descripción es obligatoria.",
          };
        }

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return {
            success: false,
            message:
              "El monto debe ser mayor a 0.",
          };
        }

        const movementDate =
          String(
            movement?.date || ""
          ).trim();

        if (!movementDate) {
          return {
            success: false,
            message:
              "La fecha es obligatoria.",
          };
        }

        if (
          !isValidDateString(
            movementDate
          )
        ) {
          return {
            success: false,
            message:
              "La fecha del movimiento no es válida.",
          };
        }

        if (
          movementDate >
          getLocalToday()
        ) {
          return {
            success: false,
            message:
              "La fecha del movimiento no puede ser posterior a hoy.",
          };
        }

        return {
          success: true,
          date: movementDate,
        };
      },
      [currentUserId]
    );

  const addMovement = useCallback(
  async (movement, type) => {
    const validation =
      validateMovement(
        movement
      );

    if (!validation.success) {
      return validation;
    }

    /*
     * El límite que tenemos cargado
     * sigue siendo válido como primera
     * protección.
     *
     * Los movimientos offline todavía
     * no consumen cuota porque todavía
     * no fueron registrados en Supabase.
     */
    if (
      movementUsage
        .hasReachedLimit &&
      !movementUsage.isPremium
    ) {
      return {
        success: false,

        code:
          FREE_LIMIT_ERROR_CODE,

        message:
          `Llegaste al límite de ${movementUsage.limit} movimientos mensuales del plan gratuito.`,
      };
    }

    const cleanCategory =
      String(
        movement.category ||
          UNCATEGORIZED
      ).trim() ||
      UNCATEGORIZED;

    const categoryRecord =
      findCategoryRecord(
        cleanCategory,
        type
      );

    /*
     * Generamos el identificador
     * ANTES de decidir si estamos
     * online u offline.
     *
     * Así, si Supabase recibe el
     * movimiento pero se corta internet
     * antes de responder, podremos
     * reintentarlo después sin duplicarlo.
     */
    const clientMutationId =
      createClientMutationId();

    const description =
      String(
        movement.description ||
          ""
      ).trim();

    const amount =
      Number(
        movement.amount
      );

    const now =
      new Date().toISOString();

    const offlineOperation = {
      id:
        clientMutationId,

      clientMutationId,

      entity:
        "transaction",

      action:
        "create",

      type,

      payload: {
        type,

        description,

        amount,

        categoryId:
          categoryRecord?.id ||
          null,

        categoryName:
          cleanCategory,

        date:
          validation.date,
      },

      queuedAt:
        now,
    };

    /*
     * Este objeto tiene el mismo formato
     * que utilizan incomes y expenses
     * dentro de MoneyTrack.
     */
    const localMovement = {
      id:
        clientMutationId,

      userId:
        currentUserId,

      type,

      description,

      amount,

      categoryId:
        categoryRecord?.id ||
        null,

      category:
        cleanCategory,

      date:
        validation.date,

      clientMutationId,

      isPendingSync: true,

      createdAt:
        now,

      updatedAt:
        now,
    };

    /*
     * Guarda localmente el movimiento
     * y lo agrega a la cola.
     */
    const queueOfflineMovement =
      async () => {
        const queued =
          await addPendingSyncOperation(
            currentUserId,
            offlineOperation
          );

        if (!queued) {
          return {
            success: false,

            message:
              "No se pudo guardar el movimiento sin conexión en este dispositivo.",
          };
        }

        await refreshPendingSyncCount();

        if (type === "income") {
          setIncomes(
            (
              currentIncomes
            ) => {
              const alreadyExists =
                currentIncomes.some(
                  (income) =>
                    income.id ===
                    localMovement.id
                );

              if (
                alreadyExists
              ) {
                return (
                  currentIncomes
                );
              }

              return [
                localMovement,
                ...currentIncomes,
              ];
            }
          );
        } else {
          setExpenses(
            (
              currentExpenses
            ) => {
              const alreadyExists =
                currentExpenses.some(
                  (expense) =>
                    expense.id ===
                    localMovement.id
                );

              if (
                alreadyExists
              ) {
                return (
                  currentExpenses
                );
              }

              return [
                localMovement,
                ...currentExpenses,
              ];
            }
          );
        }

        return {
          success: true,

          offline: true,

          pendingSync: true,

          movement:
            localMovement,

          message:
            "Movimiento guardado sin conexión. Se sincronizará cuando vuelva internet.",
        };
      };


    /*
     * Si el navegador ya sabe que no
     * tenemos conexión, ni siquiera
     * intentamos consultar Supabase.
     */
    if (isDeviceOffline()) {
      return (
        await queueOfflineMovement()
      );
    }


    /*
     * Con conexión hacemos el alta
     * normal.
     *
     * Guardamos también
     * client_mutation_id para que un
     * eventual reintento sea seguro.
     */
    const payload = {
      user_id:
        currentUserId,

      type,

      description,

      amount,

      category_id:
        categoryRecord?.id ||
        null,

      category_name:
        cleanCategory,

      date:
        validation.date,

      client_mutation_id:
        clientMutationId,
    };


    const { data, error } =
      await supabase
        .from(
          "transactions"
        )
        .insert(payload)
        .select(
          TRANSACTION_FIELDS
        )
        .single();


    if (error) {
      /*
       * Si realmente es un problema
       * de conexión, guardamos el mismo
       * movimiento en la cola.
       *
       * Como mantenemos el mismo
       * clientMutationId, aunque
       * Supabase lo haya llegado a
       * insertar, la sincronización
       * posterior no lo duplicará.
       */
      if (
        isNetworkError(error)
      ) {
        return (
          await queueOfflineMovement()
        );
      }

      if (
        isFreeLimitError(
          error
        )
      ) {
        await refreshMovementUsage();

        return {
          success: false,

          code:
            FREE_LIMIT_ERROR_CODE,

          message:
            "Llegaste al límite mensual de movimientos del plan gratuito.",
        };
      }

      return {
        success: false,

        message:
          getDatabaseErrorMessage(
            error,
            "No se pudo registrar el movimiento."
          ),
      };
    }


    const newMovement =
      mapTransaction(data);

    if (type === "income") {
      setIncomes(
        (
          currentIncomes
        ) => [
          newMovement,
          ...currentIncomes,
        ]
      );
    } else {
      setExpenses(
        (
          currentExpenses
        ) => [
          newMovement,
          ...currentExpenses,
        ]
      );
    }


    await refreshMovementUsage();


    return {
      success: true,

      offline: false,

      pendingSync: false,

      movement:
        newMovement,
    };
  },
  [
    currentUserId,
    findCategoryRecord,
    movementUsage,
    refreshMovementUsage,
    refreshPendingSyncCount,
    validateMovement,
  ]
);

  const mergeSyncedTransactionIntoState =
  useCallback(
    (syncedMovement) => {
      if (!syncedMovement) {
        return;
      }

      const mutationId =
        syncedMovement
          .clientMutationId;

      const mergeMovement = (
        currentMovements
      ) => {
        /*
         * Eliminamos:
         *
         * - el movimiento local pendiente
         * - una posible copia previa del
         *   movimiento real
         *
         * y dejamos solamente la versión
         * confirmada por Supabase.
         */
        const remainingMovements =
          currentMovements.filter(
            (movement) => {
              if (
                movement.id ===
                syncedMovement.id
              ) {
                return false;
              }

              if (
                mutationId &&
                movement.id ===
                  mutationId
              ) {
                return false;
              }

              if (
                mutationId &&
                movement
                  .clientMutationId ===
                  mutationId
              ) {
                return false;
              }

              return true;
            }
          );

        return [
          syncedMovement,
          ...remainingMovements,
        ];
      };

      if (
        syncedMovement.type ===
        "income"
      ) {
        setIncomes(
          mergeMovement
        );

        return;
      }

      if (
        syncedMovement.type ===
        "expense"
      ) {
        setExpenses(
          mergeMovement
        );
      }
    },
    []
  );

  const fetchServerTransaction =
    useCallback(
      async (transactionId) => {
        if (
          !currentUserId ||
          !transactionId
        ) {
          return {
            success: false,
            movement: null,
            error: null,
          };
        }

        const { data, error } =
          await supabase
            .from("transactions")
            .select(
              TRANSACTION_FIELDS
            )
            .eq(
              "id",
              transactionId
            )
            .eq(
              "user_id",
              currentUserId
            )
            .maybeSingle();

        if (error) {
          return {
            success: false,
            movement: null,
            error,
          };
        }

        return {
          success: true,
          movement:
            data
              ? mapTransaction(data)
              : null,
          error: null,
        };
      },
      [currentUserId]
    );

  const fetchServerGoalMovement =
    useCallback(
      async (goalMovementId) => {
        if (
          !currentUserId ||
          !goalMovementId
        ) {
          return {
            success: false,
            movement: null,
            error: null,
          };
        }

        const { data, error } =
          await supabase
            .from("goal_movements")
            .select(
              GOAL_MOVEMENT_FIELDS
            )
            .eq(
              "id",
              goalMovementId
            )
            .eq(
              "user_id",
              currentUserId
            )
            .maybeSingle();

        if (error) {
          return {
            success: false,
            movement: null,
            error,
          };
        }

        return {
          success: true,
          movement:
            data
              ? mapGoalMovement(
                  data
                )
              : null,
          error: null,
        };
      },
      [currentUserId]
    );


  const fetchServerGoal =
    useCallback(
      async (goalId) => {
        if (
          !currentUserId ||
          !goalId
        ) {
          return {
            success: false,
            goal: null,
            error: null,
          };
        }

        const { data, error } =
          await supabase
            .from("goals")
            .select(GOAL_FIELDS)
            .eq(
              "id",
              goalId
            )
            .eq(
              "user_id",
              currentUserId
            )
            .maybeSingle();

        if (error) {
          return {
            success: false,
            goal: null,
            error,
          };
        }

        return {
          success: true,
          goal:
            data
              ? mapGoal(data)
              : null,
          error: null,
        };
      },
      [currentUserId]
    );


  /*
   * Reconstruye objetivos + historial tomando
   * Supabase como base y reaplicando encima
   * las operaciones de ahorro que todavía
   * siguen pendientes en IndexedDB.
   *
   * Esto evita perder el estado optimista si
   * hay varias operaciones offline al mismo
   * tiempo o si una de ellas queda en conflicto.
   */
  const reconcileGoalStateFromServerAndQueue =
    useCallback(async () => {
      if (
        !currentUserId ||
        isDeviceOffline()
      ) {
        return {
          success: false,
          offline:
            isDeviceOffline(),
        };
      }

      const [
        goalsResult,
        movementsResult,
      ] = await Promise.all([
        supabase
          .from("goals")
          .select(GOAL_FIELDS)
          .eq(
            "user_id",
            currentUserId
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          ),

        supabase
          .from("goal_movements")
          .select(
            GOAL_MOVEMENT_FIELDS
          )
          .eq(
            "user_id",
            currentUserId
          )
          .order(
            "date",
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

      if (
        goalsResult.error ||
        movementsResult.error
      ) {
        return {
          success: false,
          error:
            goalsResult.error ||
            movementsResult.error,
        };
      }

      let optimisticGoals =
        (
          goalsResult.data || []
        ).map(mapGoal);

      let optimisticMovements =
        (
          movementsResult.data || []
        ).map(mapGoalMovement);

      const pendingOperations =
        await getPendingSyncOperations(
          currentUserId
        );

      const goalOperations =
        pendingOperations.filter(
          (operation) =>
            operation?.entity ===
              "goal_movement" &&
            [
              "create",
              "update",
              "delete",
            ].includes(
              operation?.action
            )
        );

      for (
        const operation of
        goalOperations
      ) {
        const payload =
          operation.payload || {};

        if (
          operation.action ===
          "create"
        ) {
          const mutationId =
            operation
              .clientMutationId ||
            operation.id;

          const serverIndex =
            optimisticMovements
              .findIndex(
                (movement) =>
                  movement
                    .clientMutationId ===
                  mutationId
              );

          /*
           * El CREATE pudo haber llegado a
           * Supabase y haberse cortado la
           * conexión antes de recibir la
           * respuesta. En ese caso no debemos
           * aplicar el saldo dos veces.
           */
          if (
            serverIndex !== -1
          ) {
            optimisticMovements[
              serverIndex
            ] = {
              ...optimisticMovements[
                serverIndex
              ],
              isPendingSync: true,
            };

            continue;
          }

          const localMovement = {
            id: mutationId,
            userId:
              currentUserId,
            goalId:
              operation.goalId ||
              payload.goalId ||
              null,
            type:
              operation.type ||
              payload.type,
            amount:
              Number(
                payload.amount
              ) || 0,
            description:
              payload.description ||
              "",
            date:
              payload.date ||
              "",
            clientMutationId:
              mutationId,
            isPendingSync: true,
            isOpeningBalance: false,
            createdAt:
              operation.queuedAt ||
              new Date()
                .toISOString(),
            updatedAt:
              operation
                .lastUpdatedAt ||
              operation.queuedAt ||
              new Date()
                .toISOString(),
          };

          const goalResult =
            calculateGoalsAfterMovementChange(
              optimisticGoals,
              null,
              localMovement
            );

          if (goalResult.success) {
            optimisticGoals =
              goalResult.goals;
          }

          optimisticMovements =
            sortGoalMovements([
              localMovement,
              ...optimisticMovements,
            ]);

          continue;
        }

        const goalMovementId =
          operation
            .goalMovementId ||
          operation.movementId ||
          payload.goalMovementId ||
          payload.movementId ||
          null;

        if (!goalMovementId) {
          continue;
        }

        const currentIndex =
          optimisticMovements
            .findIndex(
              (movement) =>
                movement.id ===
                goalMovementId
            );

        const previousMovement =
          currentIndex !== -1
            ? optimisticMovements[
                currentIndex
              ]
            : null;

        if (
          operation.action ===
          "update"
        ) {
          const localMovement = {
            ...(previousMovement ||
              {}),

            id:
              goalMovementId,
            userId:
              currentUserId,
            goalId:
              operation.goalId ||
              payload.goalId ||
              previousMovement
                ?.goalId ||
              null,
            type:
              operation.type ||
              payload.type ||
              previousMovement
                ?.type,
            amount:
              Number(
                payload.amount
              ) || 0,
            description:
              payload.description ||
              "",
            date:
              payload.date ||
              "",
            clientMutationId:
              previousMovement
                ?.clientMutationId ||
              operation
                .clientMutationId ||
              null,
            isPendingSync: true,
            isOpeningBalance:
              previousMovement
                ?.isOpeningBalance ||
              false,
            syncBaseUpdatedAt:
              operation
                .expectedUpdatedAt ||
              null,
            createdAt:
              previousMovement
                ?.createdAt ||
              operation.queuedAt ||
              new Date()
                .toISOString(),
            updatedAt:
              operation
                .lastUpdatedAt ||
              new Date()
                .toISOString(),
          };

          const goalResult =
            calculateGoalsAfterMovementChange(
              optimisticGoals,
              previousMovement,
              localMovement
            );

          if (goalResult.success) {
            optimisticGoals =
              goalResult.goals;
          }

          if (
            currentIndex === -1
          ) {
            optimisticMovements =
              sortGoalMovements([
                localMovement,
                ...optimisticMovements,
              ]);
          } else {
            optimisticMovements =
              sortGoalMovements(
                optimisticMovements.map(
                  (movement) =>
                    movement.id ===
                    goalMovementId
                      ? localMovement
                      : movement
                )
              );
          }

          continue;
        }

        if (
          operation.action ===
            "delete" &&
          previousMovement
        ) {
          const goalResult =
            calculateGoalsAfterMovementChange(
              optimisticGoals,
              previousMovement,
              null
            );

          if (goalResult.success) {
            optimisticGoals =
              goalResult.goals;
          }

          optimisticMovements =
            optimisticMovements.filter(
              (movement) =>
                movement.id !==
                goalMovementId
            );
        }
      }

      setGoals(
        optimisticGoals
      );

      setGoalMovements(
        sortGoalMovements(
          optimisticMovements
        )
      );

      return {
        success: true,
        goals:
          optimisticGoals,
        goalMovements:
          optimisticMovements,
      };
    }, [
      currentUserId,
    ]);


  const syncPendingTransactions =
  useCallback(async () => {
    if (!currentUserId) {
      return {
        success: false,
        synced: 0,
      };
    }

    if (
      typeof navigator !==
        "undefined" &&
      navigator.onLine === false
    ) {
      return {
        success: false,
        offline: true,
        synced: 0,
      };
    }

    if (
      syncInProgressRef.current
    ) {
      return {
        success: false,
        alreadyRunning: true,
        synced: 0,
      };
    }

    syncInProgressRef.current =
      true;

    setIsSyncing(true);

    let syncedCount = 0;
    let failedCount = 0;

    let syncedTransactionCount =
      0;

    let sawGoalMovementOperation =
      false;

    try {
      const pendingOperations =
        await getPendingSyncOperations(
          currentUserId
        );

      /*
       * Mantenemos una sola cola para:
       *
       * - ingresos / gastos
       * - movimientos de ahorro
       *
       * Los conflictos no se reintentan
       * automáticamente hasta que la persona
       * elija qué versión conservar.
       */
      const syncOperations =
        pendingOperations.filter(
          (operation) =>
            [
              "transaction",
              "goal_movement",
            ].includes(
              operation?.entity
            ) &&
            [
              "create",
              "update",
              "delete",
            ].includes(
              operation?.action
            ) &&
            operation?.status !==
              "conflict"
        );

      if (
        syncOperations.length ===
        0
      ) {
        return {
          success: true,
          synced: 0,
          failed: 0,
        };
      }

      for (
        const operation of
        syncOperations
      ) {
        const payload =
          operation.payload || {};

        /*
         * ====================================================
         * INGRESOS / GASTOS
         * ====================================================
         */
        if (
          operation.entity ===
          "transaction"
        ) {
          let data = null;
          let error = null;

          if (
            operation.action ===
            "create"
          ) {
            const result =
              await supabase.rpc(
                "sync_offline_transaction_create",
                {
                  p_client_mutation_id:
                    operation
                      .clientMutationId ||
                    operation.id,

                  p_type:
                    operation.type ||
                    payload.type,

                  p_description:
                    payload.description,

                  p_amount:
                    Number(
                      payload.amount
                    ),

                  p_category_id:
                    payload.categoryId ||
                    null,

                  p_category_name:
                    payload.categoryName ||
                    UNCATEGORIZED,

                  p_date:
                    payload.date,
                }
              );

            data = result.data;
            error = result.error;
          }

          if (
            operation.action ===
            "update"
          ) {
            const result =
              await supabase.rpc(
                "sync_offline_transaction_update",
                {
                  p_transaction_id:
                    operation
                      .transactionId ||
                    payload
                      .transactionId,

                  p_type:
                    operation.type ||
                    payload.type,

                  p_description:
                    payload.description,

                  p_amount:
                    Number(
                      payload.amount
                    ),

                  p_category_id:
                    payload.categoryId ||
                    null,

                  p_category_name:
                    payload.categoryName ||
                    UNCATEGORIZED,

                  p_date:
                    payload.date,

                  p_expected_updated_at:
                    operation
                      .expectedUpdatedAt ||
                    null,
                }
              );

            data = result.data;
            error = result.error;
          }

          if (
            operation.action ===
            "delete"
          ) {
            const result =
              await supabase.rpc(
                "sync_offline_transaction_delete",
                {
                  p_transaction_id:
                    operation
                      .transactionId ||
                    payload
                      .transactionId,

                  p_expected_updated_at:
                    operation
                      .expectedUpdatedAt ||
                    null,
                }
              );

            data = result.data;
            error = result.error;
          }

          if (error) {
            if (
              isNetworkError(error)
            ) {
              failedCount += 1;
              break;
            }

            if (
              operation.action ===
                "create" &&
              isFreeLimitError(
                error
              )
            ) {
              failedCount += 1;

              await refreshMovementUsage();

              console.warn(
                "Un movimiento offline no pudo sincronizarse porque se alcanzó el límite mensual."
              );

              continue;
            }

            const transactionMissing =
              operation.action ===
                "update" &&
              isOfflineTransactionNotFound(
                error
              );

            if (
              isOfflineTransactionConflict(
                error
              ) ||
              transactionMissing
            ) {
              failedCount += 1;

              const transactionId =
                operation
                  .transactionId ||
                payload.transactionId;

              let serverTransaction =
                null;

              if (transactionId) {
                const serverResult =
                  await fetchServerTransaction(
                    transactionId
                  );

                if (
                  !serverResult.success
                ) {
                  console.error(
                    "No se pudo obtener la versión actual del movimiento en conflicto:",
                    serverResult.error
                  );
                } else {
                  serverTransaction =
                    serverResult.movement;
                }
              }

              const marked =
                await markPendingSyncConflict(
                  currentUserId,
                  operation.id,
                  {
                    message:
                      transactionMissing
                        ? "Este movimiento ya no existe en la nube. Podés conservar tu versión para volver a crearlo o aceptar la versión de la nube."
                        : "Este movimiento fue modificado desde otro dispositivo antes de sincronizarse.",

                    serverTransaction,
                  }
                );

              if (!marked) {
                console.error(
                  "Se detectó un conflicto, pero no se pudo guardar su estado local."
                );
              }

              continue;
            }

            failedCount += 1;

            console.error(
              "No se pudo sincronizar una operación offline:",
              error
            );

            continue;
          }

          if (
            operation.action ===
              "create" ||
            operation.action ===
              "update"
          ) {
            const rawTransaction =
              Array.isArray(data)
                ? data[0]
                : data;

            if (!rawTransaction) {
              failedCount += 1;

              console.error(
                "Supabase no devolvió la transacción sincronizada."
              );

              continue;
            }

            const syncedMovement =
              mapTransaction(
                rawTransaction
              );

            mergeSyncedTransactionIntoState(
              syncedMovement
            );
          }

          if (
            operation.action ===
            "delete"
          ) {
            const transactionId =
              operation
                .transactionId ||
              payload.transactionId;

            setIncomes(
              (currentIncomes) =>
                currentIncomes.filter(
                  (income) =>
                    income.id !==
                    transactionId
                )
            );

            setExpenses(
              (currentExpenses) =>
                currentExpenses.filter(
                  (expense) =>
                    expense.id !==
                    transactionId
                )
            );
          }

          const removed =
            await removePendingSyncOperation(
              currentUserId,
              operation.id
            );

          if (!removed) {
            console.warn(
              "La operación se sincronizó, pero no pudo eliminarse de la cola local."
            );
          }

          syncedCount += 1;
          syncedTransactionCount +=
            1;

          continue;
        }

        /*
         * ====================================================
         * MOVIMIENTOS DE AHORRO
         * ====================================================
         */
        if (
          operation.entity ===
          "goal_movement"
        ) {
          sawGoalMovementOperation =
            true;

          let data = null;
          let error = null;

          if (
            operation.action ===
            "create"
          ) {
            const result =
              await supabase.rpc(
                "sync_offline_goal_movement_create",
                {
                  p_client_mutation_id:
                    operation
                      .clientMutationId ||
                    operation.id,

                  p_goal_id:
                    operation.goalId ||
                    payload.goalId,

                  p_type:
                    operation.type ||
                    payload.type,

                  p_amount:
                    Number(
                      payload.amount
                    ),

                  p_description:
                    payload.description ||
                    null,

                  p_date:
                    payload.date,
                }
              );

            data = result.data;
            error = result.error;
          }

          if (
            operation.action ===
            "update"
          ) {
            const result =
              await supabase.rpc(
                "sync_offline_goal_movement_update",
                {
                  p_movement_id:
                    operation
                      .goalMovementId ||
                    operation
                      .movementId ||
                    payload
                      .goalMovementId ||
                    payload
                      .movementId,

                  p_goal_id:
                    operation.goalId ||
                    payload.goalId,

                  p_type:
                    operation.type ||
                    payload.type,

                  p_amount:
                    Number(
                      payload.amount
                    ),

                  p_description:
                    payload.description ||
                    null,

                  p_date:
                    payload.date,

                  p_expected_updated_at:
                    operation
                      .expectedUpdatedAt ||
                    null,
                }
              );

            data = result.data;
            error = result.error;
          }

          if (
            operation.action ===
            "delete"
          ) {
            const result =
              await supabase.rpc(
                "sync_offline_goal_movement_delete",
                {
                  p_movement_id:
                    operation
                      .goalMovementId ||
                    operation
                      .movementId ||
                    payload
                      .goalMovementId ||
                    payload
                      .movementId,

                  p_expected_updated_at:
                    operation
                      .expectedUpdatedAt ||
                    null,
                }
              );

            data = result.data;
            error = result.error;
          }

          if (error) {
            if (
              isNetworkError(error)
            ) {
              failedCount += 1;
              break;
            }

            const errorContent =
              getErrorContent(error);

            const movementMissing =
              operation.action ===
                "update" &&
              isOfflineGoalMovementNotFound(
                error
              );

            const balanceChanged =
              errorContent.includes(
                "INSUFFICIENT_GOAL_BALANCE"
              );

            const goalMissing =
              errorContent.includes(
                "GOAL_NOT_FOUND"
              );

            const hasConflict =
              isOfflineGoalMovementConflict(
                error
              ) ||
              movementMissing ||
              balanceChanged ||
              goalMissing;

            if (hasConflict) {
              failedCount += 1;

              const goalMovementId =
                operation
                  .goalMovementId ||
                operation
                  .movementId ||
                payload
                  .goalMovementId ||
                payload
                  .movementId ||
                null;

              let serverGoalMovement =
                null;

              let serverGoal = null;

              if (goalMovementId) {
                const movementResult =
                  await fetchServerGoalMovement(
                    goalMovementId
                  );

                if (
                  movementResult.success
                ) {
                  serverGoalMovement =
                    movementResult.movement;
                }
              }

              const serverGoalId =
                serverGoalMovement
                  ?.goalId ||
                operation.goalId ||
                payload.goalId ||
                null;

              if (serverGoalId) {
                const goalResult =
                  await fetchServerGoal(
                    serverGoalId
                  );

                if (
                  goalResult.success
                ) {
                  serverGoal =
                    goalResult.goal;
                }
              }

              let conflictMessage =
                "Este movimiento de ahorro fue modificado desde otro dispositivo antes de sincronizarse.";

              if (movementMissing) {
                conflictMessage =
                  "Este movimiento de ahorro ya no existe en la nube.";
              } else if (
                balanceChanged
              ) {
                conflictMessage =
                  "El saldo del objetivo cambió en la nube y este movimiento ya no puede aplicarse tal como estaba guardado.";
              } else if (
                goalMissing
              ) {
                conflictMessage =
                  "El objetivo relacionado con este movimiento ya no existe en la nube.";
              }

              const marked =
                await markPendingSyncConflict(
                  currentUserId,
                  operation.id,
                  {
                    message:
                      conflictMessage,

                    serverGoalMovement,
                    serverGoal,
                  }
                );

              if (!marked) {
                console.error(
                  "Se detectó un conflicto de ahorro, pero no se pudo guardar su estado local."
                );
              }

              continue;
            }

            failedCount += 1;

            console.error(
              "No se pudo sincronizar una operación de ahorro offline:",
              error
            );

            continue;
          }

          if (
            operation.action ===
              "create" ||
            operation.action ===
              "update"
          ) {
            const rawGoalMovement =
              Array.isArray(data)
                ? data[0]
                : data;

            if (!rawGoalMovement) {
              failedCount += 1;

              console.error(
                "Supabase no devolvió el movimiento de ahorro sincronizado."
              );

              continue;
            }
          }

          const removed =
            await removePendingSyncOperation(
              currentUserId,
              operation.id
            );

          if (!removed) {
            console.warn(
              "El movimiento de ahorro se sincronizó, pero no pudo eliminarse de la cola local."
            );
          }

          syncedCount += 1;
        }
      }

      if (
        syncedTransactionCount > 0
      ) {
        await refreshMovementUsage();
      }

      /*
       * Volvemos a construir los objetivos
       * desde Supabase y reaplicamos cualquier
       * operación de ahorro que todavía siga
       * pendiente o en conflicto.
       */
      if (
        sawGoalMovementOperation &&
        !isDeviceOffline()
      ) {
        const reconcileResult =
          await reconcileGoalStateFromServerAndQueue();

        if (
          !reconcileResult.success &&
          !reconcileResult.offline
        ) {
          console.warn(
            "No se pudo reconciliar el estado de los objetivos después de sincronizar.",
            reconcileResult.error
          );
        }
      }

      return {
        success:
          failedCount === 0,

        synced:
          syncedCount,

        failed:
          failedCount,
      };
    } catch (error) {
      console.error(
        "Error al sincronizar movimientos pendientes:",
        error
      );

      return {
        success: false,

        synced:
          syncedCount,

        failed:
          failedCount + 1,
      };
    } finally {
      await refreshPendingSyncCount();
      await refreshSyncConflicts();

      setIsSyncing(false);

      syncInProgressRef.current =
        false;
    }
  }, [
    currentUserId,
    fetchServerGoal,
    fetchServerGoalMovement,
    fetchServerTransaction,
    mergeSyncedTransactionIntoState,
    reconcileGoalStateFromServerAndQueue,
    refreshMovementUsage,
    refreshPendingSyncCount,
    refreshSyncConflicts,
  ]);

  const resolveSyncConflictUseServer =
    useCallback(
      async (operationId) => {
        if (
          !currentUserId ||
          !operationId
        ) {
          return {
            success: false,
            message:
              "No se encontró el conflicto.",
          };
        }

        if (isDeviceOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para resolver este conflicto.",
          };
        }

        const conflictOperation =
          syncConflicts.find(
            (operation) =>
              operation.id ===
              operationId
          );

        if (!conflictOperation) {
          return {
            success: false,
            message:
              "No se encontró el conflicto.",
          };
        }

        /*
         * ====================================================
         * CONFLICTO DE MOVIMIENTO DE AHORRO
         * ====================================================
         *
         * Aceptar la nube significa descartar
         * la operación local y reconstruir
         * objetivos + historial desde Supabase,
         * reaplicando solamente las demás
         * operaciones que sigan pendientes.
         */
        if (
          conflictOperation.entity ===
          "goal_movement"
        ) {
          const removed =
            await removePendingSyncOperation(
              currentUserId,
              operationId
            );

          if (!removed) {
            return {
              success: false,
              message:
                "No se pudo descartar el cambio local.",
            };
          }

          const reconcileResult =
            await reconcileGoalStateFromServerAndQueue();

          await refreshPendingSyncCount();
          await refreshSyncConflicts();

          if (
            !reconcileResult.success
          ) {
            return {
              success: false,
              message:
                "Se descartó el cambio local, pero no se pudo actualizar la información desde la nube.",
            };
          }

          return {
            success: true,
            message:
              "Se conservó la versión guardada en la nube.",
          };
        }

        /*
         * ====================================================
         * CONFLICTO DE INGRESO / GASTO
         * ====================================================
         */
        const transactionId =
          conflictOperation
            .transactionId ||
          conflictOperation
            .payload
            ?.transactionId ||
          null;

        let serverMovement = null;

        if (transactionId) {
          const serverResult =
            await fetchServerTransaction(
              transactionId
            );

          if (!serverResult.success) {
            return {
              success: false,
              message:
                "No se pudo obtener la versión actual de la nube. Intentá nuevamente.",
            };
          }

          serverMovement =
            serverResult.movement;
        }

        const removed =
          await removePendingSyncOperation(
            currentUserId,
            operationId
          );

        if (!removed) {
          return {
            success: false,
            message:
              "No se pudo descartar el cambio local.",
          };
        }

        if (serverMovement) {
          mergeSyncedTransactionIntoState(
            serverMovement
          );
        } else if (transactionId) {
          setIncomes(
            (currentIncomes) =>
              currentIncomes.filter(
                (income) =>
                  income.id !==
                  transactionId
              )
          );

          setExpenses(
            (currentExpenses) =>
              currentExpenses.filter(
                (expense) =>
                  expense.id !==
                  transactionId
              )
          );
        }

        await refreshPendingSyncCount();
        await refreshSyncConflicts();

        return {
          success: true,
          movement: serverMovement,
          message:
            serverMovement
              ? "Se conservó la versión guardada en la nube."
              : "El movimiento ya no existe en la nube y se descartó el cambio local.",
        };
      },
      [
        currentUserId,
        fetchServerTransaction,
        mergeSyncedTransactionIntoState,
        reconcileGoalStateFromServerAndQueue,
        refreshPendingSyncCount,
        refreshSyncConflicts,
        syncConflicts,
      ]
    );


  const resolveSyncConflictKeepLocal =
    useCallback(
      async (operationId) => {
        if (
          !currentUserId ||
          !operationId
        ) {
          return {
            success: false,
            message:
              "No se encontró el conflicto.",
          };
        }

        if (isDeviceOffline()) {
          return {
            success: false,
            offline: true,
            message:
              "Necesitás conexión para resolver este conflicto.",
          };
        }

        const conflictOperation =
          syncConflicts.find(
            (operation) =>
              operation.id ===
              operationId
          );

        if (!conflictOperation) {
          return {
            success: false,
            message:
              "No se encontró el conflicto.",
          };
        }

        /*
         * ====================================================
         * CONFLICTO DE MOVIMIENTO DE AHORRO
         * ====================================================
         */
        if (
          conflictOperation.entity ===
          "goal_movement"
        ) {
          const payload =
            conflictOperation
              .payload || {};

          const goalMovementId =
            conflictOperation
              .goalMovementId ||
            conflictOperation
              .movementId ||
            payload
              .goalMovementId ||
            payload
              .movementId ||
            null;

          const targetGoalId =
            conflictOperation
              .goalId ||
            payload.goalId ||
            null;

          /*
           * El objetivo tiene que seguir
           * existiendo para poder conservar
           * un aporte/retiro local.
           */
          if (targetGoalId) {
            const goalResult =
              await fetchServerGoal(
                targetGoalId
              );

            if (
              !goalResult.success
            ) {
              return {
                success: false,
                message:
                  "No se pudo comprobar el objetivo en la nube.",
              };
            }

            if (!goalResult.goal) {
              return {
                success: false,
                message:
                  "No se puede conservar este movimiento porque el objetivo ya no existe en la nube.",
              };
            }
          }

          let serverGoalMovement =
            null;

          if (goalMovementId) {
            const movementResult =
              await fetchServerGoalMovement(
                goalMovementId
              );

            if (
              !movementResult.success
            ) {
              return {
                success: false,
                message:
                  "No se pudo obtener la versión actual del movimiento de ahorro.",
              };
            }

            serverGoalMovement =
              movementResult.movement;
          }

          if (
            conflictOperation.action ===
            "create"
          ) {
            /*
             * CREATE no necesita rebase de
             * updated_at. Quitamos el conflicto
             * y volvemos a intentarlo.
             */
            const updated =
              await updatePendingSyncOperation(
                currentUserId,
                operationId,
                {
                  status:
                    "pending",
                  conflict:
                    null,
                }
              );

            if (!updated) {
              return {
                success: false,
                message:
                  "No se pudo preparar el movimiento para volver a sincronizarlo.",
              };
            }
          } else if (
            serverGoalMovement
          ) {
            /*
             * La persona eligió su versión.
             * Rebasamos contra el updated_at
             * actual y dejamos que Supabase
             * vuelva a validar el movimiento.
             */
            const updated =
              await updatePendingSyncOperation(
                currentUserId,
                operationId,
                {
                  status:
                    "pending",
                  conflict:
                    null,

                  expectedUpdatedAt:
                    serverGoalMovement
                      .updatedAt ||
                    null,
                }
              );

            if (!updated) {
              return {
                success: false,
                message:
                  "No se pudo preparar el cambio para volver a sincronizarlo.",
              };
            }
          } else if (
            conflictOperation.action ===
            "update"
          ) {
            /*
             * El movimiento original fue
             * eliminado desde otro dispositivo.
             * Si se conserva la versión local,
             * lo recreamos como un movimiento
             * nuevo e idempotente.
             */
            const recreateMutationId =
              createClientMutationId();

            const updated =
              await updatePendingSyncOperation(
                currentUserId,
                operationId,
                {
                  action:
                    "create",

                  clientMutationId:
                    recreateMutationId,

                  goalMovementId:
                    null,

                  movementId:
                    null,

                  expectedUpdatedAt:
                    null,

                  status:
                    "pending",

                  conflict:
                    null,
                }
              );

            if (!updated) {
              return {
                success: false,
                message:
                  "No se pudo preparar el movimiento para volver a crearlo.",
              };
            }

            /*
             * Permitimos que la reconciliación
             * identifique la versión local con
             * el nuevo clientMutationId.
             */
            setGoalMovements(
              (currentMovements) =>
                currentMovements.map(
                  (movement) =>
                    movement.id ===
                    goalMovementId
                      ? {
                          ...movement,

                          clientMutationId:
                            recreateMutationId,

                          isPendingSync:
                            true,

                          syncBaseUpdatedAt:
                            null,
                        }
                      : movement
                )
            );
          } else if (
            conflictOperation.action ===
            "delete"
          ) {
            /*
             * Si ya no existe en la nube,
             * el resultado deseado del DELETE
             * ya está cumplido.
             */
            await removePendingSyncOperation(
              currentUserId,
              operationId
            );

            await reconcileGoalStateFromServerAndQueue();
            await refreshPendingSyncCount();
            await refreshSyncConflicts();

            return {
              success: true,
              message:
                "El movimiento de ahorro ya estaba eliminado en la nube.",
            };
          } else {
            return {
              success: false,
              message:
                "No se pudo conservar esta versión local.",
            };
          }

          await refreshPendingSyncCount();
          await refreshSyncConflicts();

          const syncResult =
            await syncPendingTransactions();

          if (!syncResult.success) {
            return {
              success: false,
              pendingSync: true,
              message:
                "Tu versión quedó guardada, pero Supabase todavía no pudo aplicarla. Revisá el conflicto antes de continuar.",
            };
          }

          return {
            success: true,
            message:
              serverGoalMovement
                ? "Se conservó tu versión y se sincronizó correctamente."
                : "Se guardó tu versión local correctamente.",
          };
        }

        /*
         * ====================================================
         * CONFLICTO DE INGRESO / GASTO
         * ====================================================
         */
        const transactionId =
          conflictOperation
            .transactionId ||
          conflictOperation
            .payload
            ?.transactionId ||
          null;

        let serverMovement = null;

        if (transactionId) {
          const serverResult =
            await fetchServerTransaction(
              transactionId
            );

          if (!serverResult.success) {
            return {
              success: false,
              message:
                "No se pudo obtener la versión actual de la nube. Intentá nuevamente.",
            };
          }

          serverMovement =
            serverResult.movement;
        }

        /*
         * Si la transacción todavía existe,
         * reintentamos tomando como base la
         * versión más reciente del servidor.
         */
        if (serverMovement) {
          const updated =
            await updatePendingSyncOperation(
              currentUserId,
              operationId,
              {
                status:
                  "pending",
                conflict:
                  null,

                expectedUpdatedAt:
                  serverMovement
                    .updatedAt ||
                  null,
              }
            );

          if (!updated) {
            return {
              success: false,
              message:
                "No se pudo preparar el cambio para volver a sincronizarlo.",
            };
          }
        } else if (
          conflictOperation.action ===
          "update"
        ) {
          /*
           * El movimiento fue eliminado en
           * otro dispositivo. Si la persona
           * conserva su versión, lo recreamos.
           */
          const recreateMutationId =
            conflictOperation
              .clientMutationId ||
            conflictOperation.id;

          const updated =
            await updatePendingSyncOperation(
              currentUserId,
              operationId,
              {
                action:
                  "create",

                clientMutationId:
                  recreateMutationId,

                transactionId:
                  null,

                expectedUpdatedAt:
                  null,

                status:
                  "pending",

                conflict:
                  null,
              }
            );

          if (!updated) {
            return {
              success: false,
              message:
                "No se pudo preparar el movimiento para volver a crearlo.",
            };
          }

          const markForRecreate =
            (movement) =>
              movement.id ===
              transactionId
                ? {
                    ...movement,

                    clientMutationId:
                      recreateMutationId,

                    isPendingSync:
                      true,

                    syncBaseUpdatedAt:
                      null,
                  }
                : movement;

          setIncomes(
            (currentIncomes) =>
              currentIncomes.map(
                markForRecreate
              )
          );

          setExpenses(
            (currentExpenses) =>
              currentExpenses.map(
                markForRecreate
              )
          );
        } else if (
          conflictOperation.action ===
          "delete"
        ) {
          await removePendingSyncOperation(
            currentUserId,
            operationId
          );

          await refreshPendingSyncCount();
          await refreshSyncConflicts();

          return {
            success: true,
            message:
              "El movimiento ya estaba eliminado en la nube.",
          };
        } else {
          return {
            success: false,
            message:
              "No se pudo conservar esta versión local.",
          };
        }

        await refreshPendingSyncCount();
        await refreshSyncConflicts();

        const syncResult =
          await syncPendingTransactions();

        if (!syncResult.success) {
          return {
            success: false,
            pendingSync: true,
            message:
              "Tu versión quedó guardada y volverá a sincronizarse cuando sea posible.",
          };
        }

        return {
          success: true,
          message:
            serverMovement
              ? "Se conservó tu versión y se sincronizó correctamente."
              : "Se volvió a crear tu versión del movimiento y se sincronizó correctamente.",
        };
      },
      [
        currentUserId,
        fetchServerGoal,
        fetchServerGoalMovement,
        fetchServerTransaction,
        reconcileGoalStateFromServerAndQueue,
        refreshPendingSyncCount,
        refreshSyncConflicts,
        syncConflicts,
        syncPendingTransactions,
      ]
    );


  useEffect(() => {
  if (
    !currentUserId ||
    !financeCacheReady
  ) {
    return undefined;
  }

  const handleOnline = () => {
    void syncPendingTransactions();
  };

  window.addEventListener(
    "online",
    handleOnline
  );

  /*
   * También revisamos la cola al abrir
   * MoneyTrack con conexión.
   *
   * Esto cubre el caso en el que el
   * usuario cerró la aplicación mientras
   * todavía tenía movimientos pendientes.
   */
  if (
    navigator.onLine
  ) {
    void syncPendingTransactions();
  }

  return () => {
    window.removeEventListener(
      "online",
      handleOnline
    );
  };
}, [
  currentUserId,
  financeCacheReady,
  syncPendingTransactions,
]);

  const updateMovement =
  useCallback(
    async (
      updatedMovement,
      type
    ) => {
      const validation =
        validateMovement(
          updatedMovement
        );

      if (!validation.success) {
        return validation;
      }

      if (!updatedMovement?.id) {
        return {
          success: false,
          message:
            "No se encontró el movimiento que deseas editar.",
        };
      }

      const currentMovements =
        type === "income"
          ? incomes
          : expenses;

      const originalMovement =
        currentMovements.find(
          (movement) =>
            movement.id ===
            updatedMovement.id
        );

      if (!originalMovement) {
        return {
          success: false,
          message:
            "No se encontró el movimiento que deseas editar.",
        };
      }

      if (
        originalMovement
          .isPendingSync &&
        syncInProgressRef.current
      ) {
        return {
          success: false,
          message:
            "El movimiento se está sincronizando. Esperá unos segundos antes de editarlo.",
        };
      }

      const cleanCategory =
        String(
          updatedMovement.category ||
            UNCATEGORIZED
        ).trim() ||
        UNCATEGORIZED;

      const categoryRecord =
        findCategoryRecord(
          cleanCategory,
          type
        );

      const description =
        String(
          updatedMovement
            .description || ""
        ).trim();

      const amount =
        Number(
          updatedMovement.amount
        );

      const now =
        new Date().toISOString();

      const expectedUpdatedAt =
        originalMovement
          .syncBaseUpdatedAt ||
        originalMovement
          .updatedAt ||
        null;

      const localMovement = {
        ...originalMovement,

        type,
        description,
        amount,

        categoryId:
          categoryRecord?.id ||
          null,

        category:
          cleanCategory,

        date:
          validation.date,

        isPendingSync: true,

        syncBaseUpdatedAt:
          expectedUpdatedAt,

        updatedAt:
          now,
      };

      const offlineOperation = {
        id:
          createClientMutationId(),

        entity:
          "transaction",

        action:
          "update",

        transactionId:
          originalMovement.id,

        type,

        expectedUpdatedAt,

        payload: {
          transactionId:
            originalMovement.id,

          type,
          description,
          amount,

          categoryId:
            categoryRecord?.id ||
            null,

          categoryName:
            cleanCategory,

          date:
            validation.date,
        },

        queuedAt:
          now,
      };

      const applyLocalMovement =
        () => {
          if (type === "income") {
            setIncomes(
              (currentIncomes) =>
                currentIncomes.map(
                  (income) =>
                    income.id ===
                    localMovement.id
                      ? localMovement
                      : income
                )
            );
          } else {
            setExpenses(
              (currentExpenses) =>
                currentExpenses.map(
                  (expense) =>
                    expense.id ===
                    localMovement.id
                      ? localMovement
                      : expense
                )
            );
          }
        };

      const queueOfflineUpdate =
        async () => {
          const queued =
            await queueTransactionSyncOperation(
              currentUserId,
              offlineOperation
            );

          if (!queued) {
            return {
              success: false,
              message:
                "No se pudo guardar la edición sin conexión.",
            };
          }

          applyLocalMovement();

          await refreshPendingSyncCount();

          return {
            success: true,
            offline: true,
            pendingSync: true,
            movement:
              localMovement,
            message:
              "Cambio guardado sin conexión. Se sincronizará cuando vuelva internet.",
          };
        };

      if (
        originalMovement
          .isPendingSync
      ) {
        return (
          await queueOfflineUpdate()
        );
      }

      if (isDeviceOffline()) {
        return (
          await queueOfflineUpdate()
        );
      }

      const payload = {
        type,
        description,
        amount,

        category_id:
          categoryRecord?.id ||
          null,

        category_name:
          cleanCategory,

        date:
          validation.date,
      };

      const { data, error } =
        await supabase
          .from("transactions")
          .update(payload)
          .eq(
            "id",
            originalMovement.id
          )
          .eq(
            "user_id",
            currentUserId
          )
          .select(
            TRANSACTION_FIELDS
          )
          .single();

      if (error) {
        if (
          isNetworkError(error)
        ) {
          return (
            await queueOfflineUpdate()
          );
        }

        return {
          success: false,
          message:
            getDatabaseErrorMessage(
              error,
              "No se pudo actualizar el movimiento."
            ),
        };
      }

      const mappedMovement =
        mapTransaction(data);

      if (type === "income") {
        setIncomes(
          (currentIncomes) =>
            currentIncomes.map(
              (income) =>
                income.id ===
                mappedMovement.id
                  ? mappedMovement
                  : income
            )
        );
      } else {
        setExpenses(
          (currentExpenses) =>
            currentExpenses.map(
              (expense) =>
                expense.id ===
                mappedMovement.id
                  ? mappedMovement
                  : expense
            )
        );
      }

      return {
        success: true,
        offline: false,
        pendingSync: false,
        movement:
          mappedMovement,
      };
    },
    [
      currentUserId,
      expenses,
      findCategoryRecord,
      incomes,
      refreshPendingSyncCount,
      validateMovement,
    ]
  );

  const deleteMovement =
  useCallback(
    async (id, type) => {
      if (
        !currentUserId ||
        !id
      ) {
        return {
          success: false,
          message:
            "No se encontró el movimiento.",
        };
      }

      const currentMovements =
        type === "income"
          ? incomes
          : expenses;

      const originalMovement =
        currentMovements.find(
          (movement) =>
            movement.id === id
        );

      if (!originalMovement) {
        return {
          success: false,
          message:
            "No se encontró el movimiento.",
        };
      }

      if (
        originalMovement
          .isPendingSync &&
        syncInProgressRef.current
      ) {
        return {
          success: false,
          message:
            "El movimiento se está sincronizando. Esperá unos segundos antes de eliminarlo.",
        };
      }

      const expectedUpdatedAt =
        originalMovement
          .syncBaseUpdatedAt ||
        originalMovement
          .updatedAt ||
        null;

      const offlineOperation = {
        id:
          createClientMutationId(),

        entity:
          "transaction",

        action:
          "delete",

        transactionId:
          originalMovement.id,

        expectedUpdatedAt,

        payload: {
          transactionId:
            originalMovement.id,
        },

        queuedAt:
          new Date().toISOString(),
      };

      const removeLocalMovement =
        () => {
          if (type === "income") {
            setIncomes(
              (currentIncomes) =>
                currentIncomes.filter(
                  (income) =>
                    income.id !== id
                )
            );
          } else {
            setExpenses(
              (currentExpenses) =>
                currentExpenses.filter(
                  (expense) =>
                    expense.id !== id
                )
            );
          }
        };

      const queueOfflineDelete =
        async () => {
          const queued =
            await queueTransactionSyncOperation(
              currentUserId,
              offlineOperation
            );

          if (!queued) {
            return {
              success: false,
              message:
                "No se pudo guardar la eliminación sin conexión.",
            };
          }

          removeLocalMovement();

          await refreshPendingSyncCount();

          return {
            success: true,
            offline: true,
            pendingSync: true,
            message:
              "Movimiento eliminado localmente. El cambio se sincronizará cuando vuelva internet.",
          };
        };

      if (
        originalMovement
          .isPendingSync
      ) {
        return (
          await queueOfflineDelete()
        );
      }

      if (isDeviceOffline()) {
        return (
          await queueOfflineDelete()
        );
      }

      const { error } =
        await supabase
          .from("transactions")
          .delete()
          .eq("id", id)
          .eq(
            "user_id",
            currentUserId
          );

      if (error) {
        if (
          isNetworkError(error)
        ) {
          return (
            await queueOfflineDelete()
          );
        }

        return {
          success: false,
          message:
            getDatabaseErrorMessage(
              error,
              "No se pudo eliminar el movimiento."
            ),
        };
      }

      removeLocalMovement();

      await refreshMovementUsage();

      return {
        success: true,
        offline: false,
        pendingSync: false,
      };
    },
    [
      currentUserId,
      expenses,
      incomes,
      refreshMovementUsage,
      refreshPendingSyncCount,
    ]
  );

  const addIncome = useCallback(
    (income) =>
      addMovement(
        income,
        "income"
      ),
    [addMovement]
  );

  const updateIncome =
    useCallback(
      (income) =>
        updateMovement(
          income,
          "income"
        ),
      [updateMovement]
    );

  const deleteIncome =
    useCallback(
      (id) =>
        deleteMovement(
          id,
          "income"
        ),
      [deleteMovement]
    );

  const addExpense = useCallback(
    (expense) =>
      addMovement(
        expense,
        "expense"
      ),
    [addMovement]
  );

  const updateExpense =
    useCallback(
      (expense) =>
        updateMovement(
          expense,
          "expense"
        ),
      [updateMovement]
    );

  const deleteExpense =
    useCallback(
      (id) =>
        deleteMovement(
          id,
          "expense"
        ),
      [deleteMovement]
    );

  const addCategory =
    useCallback(
      async (
        categoryInput,
        type
      ) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        const categoryData =
          categoryInput &&
          typeof categoryInput ===
            "object"
            ? categoryInput
            : {
                name:
                  categoryInput,
              };

        const cleanName =
          String(
            categoryData?.name ||
              ""
          ).trim();

        if (!cleanName) {
          return {
            success: false,
            message:
              "El nombre de la categoría es obligatorio.",
          };
        }

        if (
          cleanName.toLowerCase() ===
          UNCATEGORIZED.toLowerCase()
        ) {
          return {
            success: false,
            message:
              "La categoría General ya existe.",
          };
        }

        const duplicated =
          categoryRecords.some(
            (category) =>
              category.type === type &&
              category.name.toLowerCase() ===
                cleanName.toLowerCase()
          );

        if (duplicated) {
          return {
            success: false,
            message:
              "La categoría ya existe.",
          };
        }

        const selectedColor =
          normalizeCategoryColor(
            categoryData?.color
          ) ||
          getRandomCategoryColor();

        const selectedIcon =
          normalizeCategoryIcon(
            categoryData?.icon
          ) ||
          getDefaultCategoryIcon(
            type
          );

        const { data, error } =
          await supabase
            .from("categories")
            .insert({
              user_id:
                currentUserId,
              name: cleanName,
              type,
              color:
                selectedColor,
              icon:
                selectedIcon,
              is_default: false,
            })
            .select(
              CATEGORY_FIELDS
            )
            .single();

        if (error) {
          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo crear la categoría."
              ),
          };
        }

        const mappedCategory =
          mapCategory(data);

        setCategoryRecords(
          (currentCategories) => [
            ...currentCategories,
            mappedCategory,
          ]
        );

        return {
          success: true,
          category:
            mappedCategory,
        };
      },
      [
        categoryRecords,
        currentUserId,
      ]
    );

  const deleteCategory =
    useCallback(
      async (
        categoryName,
        type
      ) => {
        if (
          !categoryName ||
          categoryName.toLowerCase() ===
            UNCATEGORIZED.toLowerCase()
        ) {
          return {
            success: false,
            message:
              "La categoría General no se puede eliminar.",
          };
        }

        const category =
          findCategoryRecord(
            categoryName,
            type
          );

        if (!category) {
          return {
            success: false,
            message:
              "No se encontró la categoría.",
          };
        }

        const {
          error:
            transactionsError,
        } = await supabase
          .from("transactions")
          .update({
            category_id: null,
            category_name:
              UNCATEGORIZED,
          })
          .eq(
            "user_id",
            currentUserId
          )
          .eq(
            "category_id",
            category.id
          );

        if (transactionsError) {
          return {
            success: false,
            message:
              "No se pudieron actualizar los movimientos asociados.",
          };
        }

        const { error } =
          await supabase
            .from("categories")
            .delete()
            .eq(
              "id",
              category.id
            )
            .eq(
              "user_id",
              currentUserId
            );

        if (error) {
          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo eliminar la categoría."
              ),
          };
        }

        setCategoryRecords(
          (currentCategories) =>
            currentCategories.filter(
              (currentCategory) =>
                currentCategory.id !==
                category.id
            )
        );

        const replaceCategory = (
          movement
        ) =>
          movement.categoryId ===
          category.id
            ? {
                ...movement,
                categoryId: null,
                category:
                  UNCATEGORIZED,
              }
            : movement;

        if (type === "income") {
          setIncomes(
            (currentIncomes) =>
              currentIncomes.map(
                replaceCategory
              )
          );
        } else {
          setExpenses(
            (currentExpenses) =>
              currentExpenses.map(
                replaceCategory
              )
          );
        }

        return {
          success: true,
        };
      },
      [
        currentUserId,
        findCategoryRecord,
      ]
    );

  const updateCategory =
    useCallback(
      async (
        oldName,
        categoryInput,
        type
      ) => {
        const categoryData =
          categoryInput &&
          typeof categoryInput ===
            "object"
            ? categoryInput
            : {
                name:
                  categoryInput,
              };

        const cleanName =
          String(
            categoryData?.name ||
              ""
          ).trim();

        if (!cleanName) {
          return {
            success: false,
            message:
              "El nuevo nombre es obligatorio.",
          };
        }

        if (
          oldName.toLowerCase() ===
          UNCATEGORIZED.toLowerCase()
        ) {
          return {
            success: false,
            message:
              "La categoría General no se puede modificar.",
          };
        }

        const category =
          findCategoryRecord(
            oldName,
            type
          );

        if (!category) {
          return {
            success: false,
            message:
              "No se encontró la categoría.",
          };
        }

        const duplicated =
          categoryRecords.some(
            (currentCategory) =>
              currentCategory.id !==
                category.id &&
              currentCategory.type ===
                type &&
              currentCategory.name.toLowerCase() ===
                cleanName.toLowerCase()
          );

        if (duplicated) {
          return {
            success: false,
            message:
              "Ya existe una categoría con ese nombre.",
          };
        }

        const selectedColor =
          normalizeCategoryColor(
            categoryData?.color
          ) ||
          normalizeCategoryColor(
            category.color
          ) ||
          getRandomCategoryColor();

        const selectedIcon =
          normalizeCategoryIcon(
            categoryData?.icon
          ) ||
          normalizeCategoryIcon(
            category.icon
          ) ||
          getDefaultCategoryIcon(
            type
          );

        const {
          data,
          error,
        } = await supabase
          .from("categories")
          .update({
            name: cleanName,
            color:
              selectedColor,
            icon:
              selectedIcon,
          })
          .eq(
            "id",
            category.id
          )
          .eq(
            "user_id",
            currentUserId
          )
          .select(
            CATEGORY_FIELDS
          )
          .single();

        if (error) {
          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo modificar la categoría."
              ),
          };
        }

        const {
          error:
            transactionsError,
        } = await supabase
          .from("transactions")
          .update({
            category_name:
              cleanName,
          })
          .eq(
            "user_id",
            currentUserId
          )
          .eq(
            "category_id",
            category.id
          );

        if (transactionsError) {
          await loadFinanceData();

          return {
            success: false,
            message:
              "La categoría fue modificada, pero no se pudieron actualizar todos sus movimientos.",
          };
        }

        const mappedCategory =
          mapCategory(data);

        setCategoryRecords(
          (currentCategories) =>
            currentCategories.map(
              (currentCategory) =>
                currentCategory.id ===
                category.id
                  ? mappedCategory
                  : currentCategory
            )
        );

        const replaceCategory = (
          movement
        ) =>
          movement.categoryId ===
          category.id
            ? {
                ...movement,
                category:
                  cleanName,
              }
            : movement;

        if (type === "income") {
          setIncomes(
            (currentIncomes) =>
              currentIncomes.map(
                replaceCategory
              )
          );
        } else {
          setExpenses(
            (currentExpenses) =>
              currentExpenses.map(
                replaceCategory
              )
          );
        }

        return {
          success: true,
          category:
            mappedCategory,
        };
      },
      [
        categoryRecords,
        currentUserId,
        findCategoryRecord,
        loadFinanceData,
      ]
    );

  const addIncomeCategory =
    useCallback(
      (category) =>
        addCategory(
          category,
          "income"
        ),
      [addCategory]
    );

  const deleteIncomeCategory =
    useCallback(
      (category) =>
        deleteCategory(
          category,
          "income"
        ),
      [deleteCategory]
    );

  const updateIncomeCategory =
    useCallback(
      (oldName, newName) =>
        updateCategory(
          oldName,
          newName,
          "income"
        ),
      [updateCategory]
    );

  const addExpenseCategory =
    useCallback(
      (category) =>
        addCategory(
          category,
          "expense"
        ),
      [addCategory]
    );

  const deleteExpenseCategory =
    useCallback(
      (category) =>
        deleteCategory(
          category,
          "expense"
        ),
      [deleteCategory]
    );

  const updateExpenseCategory =
    useCallback(
      (oldName, newName) =>
        updateCategory(
          oldName,
          newName,
          "expense"
        ),
      [updateCategory]
    );

const addGoal = useCallback(
  async (goal) => {
    if (!currentUserId) {
      return {
        success: false,
        message:
          "No hay una sesión activa.",
      };
    }

    const payload =
      getGoalPayload(goal);

    if (!payload.name) {
      return {
        success: false,
        message:
          "El nombre del objetivo es obligatorio.",
      };
    }

    if (
      !Number.isFinite(
        payload.target_amount
      ) ||
      payload.target_amount <= 0
    ) {
      return {
        success: false,
        message:
          "El monto objetivo debe ser mayor a 0.",
      };
    }

    /*
     * Los objetivos nuevos siempre
     * comienzan con saldo 0.
     *
     * El ahorro únicamente se modifica
     * mediante movimientos de ahorro.
     */
    const goalPayload = {
      ...payload,
      current_amount: 0,
      status: "active",
    };

    const { data, error } =
      await supabase
        .from("goals")
        .insert({
          user_id:
            currentUserId,
          ...goalPayload,
        })
        .select(GOAL_FIELDS)
        .single();

    if (error) {
      return {
        success: false,
        message:
          getDatabaseErrorMessage(
            error,
            "No se pudo crear el objetivo."
          ),
      };
    }

    const mappedGoal =
      mapGoal(data);

    setGoals(
      (currentGoals) => [
        mappedGoal,
        ...currentGoals,
      ]
    );

    return {
      success: true,
      goal: mappedGoal,
    };
  },
  [currentUserId]
);

const updateGoal = useCallback(
  async (updatedGoal) => {
    if (
      !currentUserId ||
      !updatedGoal?.id
    ) {
      return {
        success: false,
        message:
          "No se encontró el objetivo.",
      };
    }

    const payload =
      getGoalPayload(
        updatedGoal
      );

    if (!payload.name) {
      return {
        success: false,
        message:
          "El nombre del objetivo es obligatorio.",
      };
    }

    if (
      !Number.isFinite(
        payload.target_amount
      ) ||
      payload.target_amount <= 0
    ) {
      return {
        success: false,
        message:
          "El monto objetivo debe ser mayor a 0.",
      };
    }

    /*
     * Primero obtenemos el objetivo
     * actual desde Supabase.
     *
     * current_amount NO se toma del
     * formulario porque el ahorro
     * solamente puede cambiar mediante
     * aportes o retiros.
     */
    const {
      data: existingGoal,
      error: existingGoalError,
    } = await supabase
      .from("goals")
      .select(
        "current_amount, description"
      )
      .eq(
        "id",
        updatedGoal.id
      )
      .eq(
        "user_id",
        currentUserId
      )
      .single();

    if (existingGoalError) {
      return {
        success: false,
        message:
          getDatabaseErrorMessage(
            existingGoalError,
            "No se pudo obtener el objetivo."
          ),
      };
    }

    const currentAmount =
      Number(
        existingGoal?.current_amount
      ) || 0;

    const status =
      currentAmount >=
      payload.target_amount
        ? "completed"
        : "active";

    /*
     * Solamente permitimos modificar
     * datos propios del objetivo.
     *
     * current_amount queda intacto.
     */
    const updatePayload = {
      name: payload.name,

      description:
        updatedGoal.description !==
        undefined
          ? String(
              updatedGoal.description ||
                ""
            ).trim() || null
          : existingGoal?.description ||
            null,

      target_amount:
        payload.target_amount,

      deadline:
        payload.deadline,

      status,
    };

    const { data, error } =
      await supabase
        .from("goals")
        .update(
          updatePayload
        )
        .eq(
          "id",
          updatedGoal.id
        )
        .eq(
          "user_id",
          currentUserId
        )
        .select(GOAL_FIELDS)
        .single();

    if (error) {
      return {
        success: false,
        message:
          getDatabaseErrorMessage(
            error,
            "No se pudo modificar el objetivo."
          ),
      };
    }

    const mappedGoal =
      mapGoal(data);

    setGoals(
      (currentGoals) =>
        currentGoals.map(
          (goal) =>
            goal.id ===
            mappedGoal.id
              ? mappedGoal
              : goal
        )
    );

    return {
      success: true,
      goal: mappedGoal,
    };
  },
  [currentUserId]
);

  const deleteGoal = useCallback(
    async (id) => {
      if (!currentUserId || !id) {
        return {
          success: false,
          message:
            "No se encontró el objetivo.",
        };
      }

      const { error } =
        await supabase
          .from("goals")
          .delete()
          .eq("id", id)
          .eq(
            "user_id",
            currentUserId
          );

      if (error) {
        return {
          success: false,
          message:
            getDatabaseErrorMessage(
              error,
              "No se pudo eliminar el objetivo."
            ),
        };
      }

      setGoals(
        (currentGoals) =>
          currentGoals.filter(
            (goal) =>
              goal.id !== id
          )
      );

      setGoalMovements(
        (currentMovements) =>
          currentMovements.filter(
            (movement) =>
              movement.goalId !== id
          )
      );

      return {
        success: true,
      };
    },
    [currentUserId]
  );

  const recordGoalMovement =
    useCallback(
      async (movement) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        const goalId = String(
          movement?.goalId ||
            movement?.goal_id ||
            ""
        ).trim();

        const type = String(
          movement?.type || ""
        )
          .trim()
          .toLowerCase();

        const amount = Number(
          movement?.amount
        );

        const description = String(
          movement?.description || ""
        ).trim();

        const movementDate = String(
          movement?.date || ""
        ).trim();

        if (!goalId) {
          return {
            success: false,
            message:
              "Seleccioná un objetivo de ahorro.",
          };
        }

        if (
          type !== "deposit" &&
          type !== "withdrawal"
        ) {
          return {
            success: false,
            message:
              "Seleccioná si querés agregar o retirar dinero.",
          };
        }

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return {
            success: false,
            message:
              "El monto debe ser mayor a 0.",
          };
        }

        if (!movementDate) {
          return {
            success: false,
            message:
              "La fecha es obligatoria.",
          };
        }

        if (
          !isValidDateString(
            movementDate
          )
        ) {
          return {
            success: false,
            message:
              "La fecha del movimiento no es válida.",
          };
        }

        if (
          movementDate >
          getLocalToday()
        ) {
          return {
            success: false,
            message:
              "La fecha del movimiento no puede ser posterior a hoy.",
          };
        }

        const selectedGoal =
          goals.find(
            (goal) =>
              goal.id === goalId
          );

        if (!selectedGoal) {
          return {
            success: false,
            message:
              "No se encontró el objetivo seleccionado.",
          };
        }

        if (
          type === "withdrawal" &&
          amount >
            Number(
              selectedGoal.currentAmount
            )
        ) {
          return {
            success: false,
            message:
              "No podés retirar más dinero del que tenés ahorrado en este objetivo.",
          };
        }

        const clientMutationId =
          createClientMutationId();

        const now =
          new Date()
            .toISOString();

        const localMovement = {
          id:
            clientMutationId,

          userId:
            currentUserId,

          goalId,
          type,
          amount,
          description,
          date:
            movementDate,

          clientMutationId,

          isPendingSync: true,
          isOpeningBalance: false,

          syncBaseUpdatedAt:
            null,

          createdAt:
            now,

          updatedAt:
            now,
        };

        const offlineOperation = {
          id:
            clientMutationId,

          clientMutationId,

          entity:
            "goal_movement",

          action:
            "create",

          goalId,
          type,

          payload: {
            goalId,
            type,
            amount,

            description:
              description ||
              null,

            date:
              movementDate,
          },

          queuedAt:
            now,
        };

        const localGoalResult =
          calculateGoalsAfterMovementChange(
            goals,
            null,
            localMovement
          );

        if (
          !localGoalResult.success
        ) {
          return {
            success: false,
            message:
              "No se pudo actualizar el saldo del objetivo.",
          };
        }

        const applyLocalMovement =
          () => {
            setGoals(
              localGoalResult.goals
            );

            setGoalMovements(
              (currentMovements) => {
                const withoutDuplicate =
                  currentMovements.filter(
                    (
                      currentMovement
                    ) =>
                      currentMovement.id !==
                      localMovement.id &&
                      currentMovement
                        .clientMutationId !==
                      clientMutationId
                  );

                return (
                  sortGoalMovements([
                    localMovement,
                    ...withoutDuplicate,
                  ])
                );
              }
            );
          };

        const queueOfflineMovement =
          async () => {
            const queued =
              await addPendingSyncOperation(
                currentUserId,
                offlineOperation
              );

            if (!queued) {
              return {
                success: false,
                message:
                  "No se pudo guardar el movimiento de ahorro sin conexión.",
              };
            }

            applyLocalMovement();

            await refreshPendingSyncCount();

            return {
              success: true,
              offline: true,
              pendingSync: true,
              movement:
                localMovement,
              message:
                "Movimiento de ahorro guardado sin conexión. Se sincronizará cuando vuelva internet.",
            };
          };

        if (isDeviceOffline()) {
          return (
            await queueOfflineMovement()
          );
        }

        /*
         * Usamos el RPC idempotente incluso
         * cuando hay conexión.
         *
         * Si Supabase procesa el movimiento
         * pero la respuesta se pierde, el
         * mismo clientMutationId impide que
         * se duplique al reintentarlo.
         */
        const { data, error } =
          await supabase.rpc(
            "sync_offline_goal_movement_create",
            {
              p_client_mutation_id:
                clientMutationId,

              p_goal_id:
                goalId,

              p_type:
                type,

              p_amount:
                amount,

              p_description:
                description ||
                null,

              p_date:
                movementDate,
            }
          );

        if (error) {
          if (
            isNetworkError(error)
          ) {
            return (
              await queueOfflineMovement()
            );
          }

          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo registrar el movimiento de ahorro."
              ),
          };
        }

        const rawMovement =
          Array.isArray(data)
            ? data[0]
            : data;

        const mappedMovement =
          rawMovement
            ? mapGoalMovement(
                rawMovement
              )
            : null;

        const reconcileResult =
          await reconcileGoalStateFromServerAndQueue();

        if (
          !reconcileResult.success
        ) {
          /*
           * La operación ya se guardó en
           * Supabase. Si falla la recarga no
           * devolvemos un falso error de alta.
           */
          if (mappedMovement) {
            setGoalMovements(
              (
                currentMovements
              ) =>
                sortGoalMovements([
                  mappedMovement,

                  ...currentMovements.filter(
                    (
                      currentMovement
                    ) =>
                      currentMovement.id !==
                        mappedMovement.id &&
                      currentMovement
                        .clientMutationId !==
                        clientMutationId
                  ),
                ])
            );
          }
        }

        const goalResult =
          await fetchServerGoal(
            goalId
          );

        return {
          success: true,
          offline: false,
          pendingSync: false,
          movement:
            mappedMovement,
          goal:
            goalResult.success
              ? goalResult.goal
              : null,
        };
      },
      [
        currentUserId,
        fetchServerGoal,
        goals,
        reconcileGoalStateFromServerAndQueue,
        refreshPendingSyncCount,
      ]
    );


  const updateGoalMovement =
    useCallback(
      async (
        updatedMovement
      ) => {
        if (
          !currentUserId ||
          !updatedMovement?.id
        ) {
          return {
            success: false,
            message:
              "No se encontró el movimiento de ahorro.",
          };
        }

        const originalMovement =
          goalMovements.find(
            (movement) =>
              movement.id ===
              updatedMovement.id
          );

        if (!originalMovement) {
          return {
            success: false,
            message:
              "No se encontró el movimiento de ahorro.",
          };
        }

        if (
          originalMovement
            .isPendingSync &&
          syncInProgressRef.current
        ) {
          return {
            success: false,
            message:
              "El movimiento de ahorro se está sincronizando. Esperá unos segundos antes de editarlo.",
          };
        }

        const goalId = String(
          updatedMovement
            ?.goalId ||
            updatedMovement
              ?.goal_id ||
            ""
        ).trim();

        const type = String(
          updatedMovement?.type ||
            ""
        )
          .trim()
          .toLowerCase();

        const amount = Number(
          updatedMovement?.amount
        );

        const description =
          String(
            updatedMovement
              ?.description ||
              ""
          ).trim();

        const movementDate =
          String(
            updatedMovement
              ?.date ||
              ""
          ).trim();

        if (!goalId) {
          return {
            success: false,
            message:
              "Seleccioná un objetivo de ahorro.",
          };
        }

        if (
          type !== "deposit" &&
          type !== "withdrawal"
        ) {
          return {
            success: false,
            message:
              "Seleccioná si es un aporte o un retiro.",
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
              "El monto debe ser mayor a 0.",
          };
        }

        if (!movementDate) {
          return {
            success: false,
            message:
              "La fecha es obligatoria.",
          };
        }

        if (
          !isValidDateString(
            movementDate
          )
        ) {
          return {
            success: false,
            message:
              "La fecha del movimiento no es válida.",
          };
        }

        if (
          movementDate >
          getLocalToday()
        ) {
          return {
            success: false,
            message:
              "La fecha del movimiento no puede ser posterior a hoy.",
          };
        }

        if (
          !goals.some(
            (goal) =>
              goal.id === goalId
          )
        ) {
          return {
            success: false,
            message:
              "No se encontró el objetivo seleccionado.",
          };
        }

        const expectedUpdatedAt =
          originalMovement
            .syncBaseUpdatedAt ||
          originalMovement
            .updatedAt ||
          null;

        const now =
          new Date()
            .toISOString();

        const localMovement = {
          ...originalMovement,

          goalId,
          type,
          amount,
          description,

          date:
            movementDate,

          isPendingSync:
            true,

          syncBaseUpdatedAt:
            expectedUpdatedAt,

          updatedAt:
            now,
        };

        const localGoalResult =
          calculateGoalsAfterMovementChange(
            goals,
            originalMovement,
            localMovement
          );

        if (
          !localGoalResult.success
        ) {
          return {
            success: false,
            message:
              "Este cambio dejaría un objetivo con saldo negativo. Revisá el monto o el tipo de movimiento.",
          };
        }

        const offlineOperation = {
          id:
            createClientMutationId(),

          entity:
            "goal_movement",

          action:
            "update",

          goalMovementId:
            originalMovement.id,

          goalId,
          type,

          expectedUpdatedAt,

          payload: {
            goalMovementId:
              originalMovement.id,

            goalId,
            type,
            amount,

            description:
              description ||
              null,

            date:
              movementDate,
          },

          queuedAt:
            now,
        };

        const applyLocalMovement =
          () => {
            setGoals(
              localGoalResult.goals
            );

            setGoalMovements(
              (
                currentMovements
              ) =>
                sortGoalMovements(
                  currentMovements.map(
                    (movement) =>
                      movement.id ===
                      localMovement.id
                        ? localMovement
                        : movement
                  )
                )
            );
          };

        const queueOfflineUpdate =
          async () => {
            const queued =
              await queueGoalMovementSyncOperation(
                currentUserId,
                offlineOperation
              );

            if (!queued) {
              return {
                success: false,
                message:
                  "No se pudo guardar la edición del ahorro sin conexión.",
              };
            }

            applyLocalMovement();

            await refreshPendingSyncCount();

            return {
              success: true,
              offline: true,
              pendingSync: true,
              movement:
                localMovement,
              message:
                "Cambio de ahorro guardado sin conexión. Se sincronizará cuando vuelva internet.",
            };
          };

        /*
         * Si ya existe una operación
         * pendiente, la combinamos con la
         * nueva edición aunque haya vuelto
         * internet.
         */
        if (
          originalMovement
            .isPendingSync
        ) {
          return (
            await queueOfflineUpdate()
          );
        }

        if (isDeviceOffline()) {
          return (
            await queueOfflineUpdate()
          );
        }

        const { data, error } =
          await supabase.rpc(
            "update_goal_movement",
            {
              p_movement_id:
                originalMovement.id,

              p_goal_id:
                goalId,

              p_type:
                type,

              p_amount:
                amount,

              p_description:
                description ||
                null,

              p_date:
                movementDate,
            }
          );

        if (error) {
          if (
            isNetworkError(error)
          ) {
            return (
              await queueOfflineUpdate()
            );
          }

          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo actualizar el movimiento de ahorro."
              ),
          };
        }

        const rawMovement =
          Array.isArray(data)
            ? data[0]
            : data;

        const mappedMovement =
          rawMovement
            ? mapGoalMovement(
                rawMovement
              )
            : null;

        await reconcileGoalStateFromServerAndQueue();

        return {
          success: true,
          offline: false,
          pendingSync: false,
          movement:
            mappedMovement,
        };
      },
      [
        currentUserId,
        goalMovements,
        goals,
        reconcileGoalStateFromServerAndQueue,
        refreshPendingSyncCount,
      ]
    );


  const deleteGoalMovement =
    useCallback(
      async (movementId) => {
        if (
          !currentUserId ||
          !movementId
        ) {
          return {
            success: false,
            message:
              "No se encontró el movimiento de ahorro.",
          };
        }

        const originalMovement =
          goalMovements.find(
            (movement) =>
              movement.id ===
              movementId
          );

        if (!originalMovement) {
          return {
            success: false,
            message:
              "No se encontró el movimiento de ahorro.",
          };
        }

        if (
          originalMovement
            .isPendingSync &&
          syncInProgressRef.current
        ) {
          return {
            success: false,
            message:
              "El movimiento de ahorro se está sincronizando. Esperá unos segundos antes de eliminarlo.",
          };
        }

        const localGoalResult =
          calculateGoalsAfterMovementChange(
            goals,
            originalMovement,
            null
          );

        if (
          !localGoalResult.success
        ) {
          return {
            success: false,
            message:
              "No podés eliminar este movimiento porque dejaría el objetivo con saldo negativo.",
          };
        }

        const expectedUpdatedAt =
          originalMovement
            .syncBaseUpdatedAt ||
          originalMovement
            .updatedAt ||
          null;

        const now =
          new Date()
            .toISOString();

        const offlineOperation = {
          id:
            createClientMutationId(),

          entity:
            "goal_movement",

          action:
            "delete",

          goalMovementId:
            originalMovement.id,

          goalId:
            originalMovement.goalId,

          expectedUpdatedAt,

          payload: {
            goalMovementId:
              originalMovement.id,

            goalId:
              originalMovement.goalId,
          },

          queuedAt:
            now,
        };

        const applyLocalDelete =
          () => {
            setGoals(
              localGoalResult.goals
            );

            setGoalMovements(
              (
                currentMovements
              ) =>
                currentMovements.filter(
                  (movement) =>
                    movement.id !==
                    movementId
                )
            );
          };

        const queueOfflineDelete =
          async () => {
            const queued =
              await queueGoalMovementSyncOperation(
                currentUserId,
                offlineOperation
              );

            if (!queued) {
              return {
                success: false,
                message:
                  "No se pudo guardar la eliminación del ahorro sin conexión.",
              };
            }

            applyLocalDelete();

            await refreshPendingSyncCount();

            return {
              success: true,
              offline: true,
              pendingSync: true,
              message:
                "El movimiento se eliminó en este dispositivo y el cambio se sincronizará cuando vuelva internet.",
            };
          };

        /*
         * CREATE + DELETE desaparecerá de
         * la cola automáticamente.
         *
         * UPDATE + DELETE quedará reducido
         * a un único DELETE.
         */
        if (
          originalMovement
            .isPendingSync
        ) {
          return (
            await queueOfflineDelete()
          );
        }

        if (isDeviceOffline()) {
          return (
            await queueOfflineDelete()
          );
        }

        const { error } =
          await supabase.rpc(
            "delete_goal_movement",
            {
              p_movement_id:
                movementId,
            }
          );

        if (error) {
          if (
            isNetworkError(error)
          ) {
            return (
              await queueOfflineDelete()
            );
          }

          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo eliminar el movimiento de ahorro."
              ),
          };
        }

        await reconcileGoalStateFromServerAndQueue();

        return {
          success: true,
          offline: false,
          pendingSync: false,
        };
      },
      [
        currentUserId,
        goalMovements,
        goals,
        reconcileGoalStateFromServerAndQueue,
        refreshPendingSyncCount,
      ]
    );


  const updateSettings =
    useCallback(
      async (newSettings) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        const nextUserName =
          typeof newSettings
            ?.userName ===
          "string"
            ? newSettings.userName.trim()
            : settings.userName;

        const nextTheme =
          normalizeTheme(
            newSettings?.theme ??
              settings.theme
          );

        if (!nextUserName) {
          return {
            success: false,
            message:
              "El nombre no puede estar vacío.",
          };
        }

        const { error } =
          await supabase
            .from("profiles")
            .update({
              name: nextUserName,
              theme: nextTheme,
            })
            .eq(
              "id",
              currentUserId
            );

        if (error) {
          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo actualizar la configuración."
              ),
          };
        }

        setSettings({
          userName:
            nextUserName,
          theme: nextTheme,
        });

        if (
          typeof refreshCurrentUser ===
          "function"
        ) {
          await refreshCurrentUser();
        }

        return {
          success: true,
          message:
            "Configuración actualizada correctamente.",
        };
      },
      [
        currentUserId,
        refreshCurrentUser,
        settings.theme,
        settings.userName,
      ]
    );

  const clearIncomes =
    useCallback(async () => {
      if (!currentUserId) {
        return {
          success: false,
        };
      }

      const { error } =
        await supabase
          .from("transactions")
          .delete()
          .eq(
            "user_id",
            currentUserId
          )
          .eq(
            "type",
            "income"
          );

      if (error) {
        return {
          success: false,
          message:
            "No se pudieron eliminar los ingresos.",
        };
      }

      setIncomes([]);
      await refreshMovementUsage();

      return {
        success: true,
      };
    }, [
      currentUserId,
      refreshMovementUsage,
    ]);

  const clearExpenses =
    useCallback(async () => {
      if (!currentUserId) {
        return {
          success: false,
        };
      }

      const { error } =
        await supabase
          .from("transactions")
          .delete()
          .eq(
            "user_id",
            currentUserId
          )
          .eq(
            "type",
            "expense"
          );

      if (error) {
        return {
          success: false,
          message:
            "No se pudieron eliminar los gastos.",
        };
      }

      setExpenses([]);
      await refreshMovementUsage();

      return {
        success: true,
      };
    }, [
      currentUserId,
      refreshMovementUsage,
    ]);

  const clearGoals =
    useCallback(async () => {
      if (!currentUserId) {
        return {
          success: false,
        };
      }

      const { error } =
        await supabase
          .from("goals")
          .delete()
          .eq(
            "user_id",
            currentUserId
          );

      if (error) {
        return {
          success: false,
          message:
            "No se pudieron eliminar los objetivos.",
        };
      }

      setGoals([]);
      setGoalMovements([]);

      return {
        success: true,
      };
    }, [currentUserId]);

  const resetAppData =
    useCallback(async () => {
      if (!currentUserId) {
        return {
          success: false,
          message:
            "No hay una sesión activa.",
        };
      }

      const [
        transactionsResult,
        goalsResult,
        categoriesResult,
        profileResult,
      ] = await Promise.all([
        supabase
          .from("transactions")
          .delete()
          .eq(
            "user_id",
            currentUserId
          ),

        supabase
          .from("goals")
          .delete()
          .eq(
            "user_id",
            currentUserId
          ),

        supabase
          .from("categories")
          .delete()
          .eq(
            "user_id",
            currentUserId
          )
          .eq(
            "is_default",
            false
          ),

        supabase
          .from("profiles")
          .update({
            theme: "light",
          })
          .eq(
            "id",
            currentUserId
          ),
      ]);

      const firstError =
        transactionsResult.error ||
        goalsResult.error ||
        categoriesResult.error ||
        profileResult.error;

      if (firstError) {
        return {
          success: false,
          message:
            getDatabaseErrorMessage(
              firstError,
              "No se pudieron restablecer los datos."
            ),
        };
      }

      await loadFinanceData();

      if (
        typeof refreshCurrentUser ===
        "function"
      ) {
        await refreshCurrentUser();
      }

      return {
        success: true,
        message:
          "Los datos fueron restablecidos correctamente.",
      };
    },
    [
      currentUserId,
      loadFinanceData,
      refreshCurrentUser,
    ]);


const syncConflictCount =
  syncConflicts.length;

const hasSyncConflicts =
  syncConflictCount > 0;

const syncStatus =
  !isOnline
    ? "offline"
    : isSyncing
      ? "syncing"
      : hasSyncConflicts
        ? "conflict"
        : pendingSyncCount > 0
          ? "pending"
          : "online";

  const monthlyMovementCount =
    movementUsage.used;

  const monthlyLimit =
    movementUsage.limit;

  const remainingMovements =
    movementUsage.remaining;

  const monthlyUsagePercentage =
    movementUsage.percentage;

  const hasReachedMonthlyLimit =
    movementUsage.hasReachedLimit;

  const isPremium =
    movementUsage.isPremium;

  const value = useMemo(
  () => ({
    incomes,
    expenses,
    goals,
    goalMovements,
    settings,

    incomeCategories,
    expenseCategories,
    categoryRecords,

    loading,
    errorMessage,

    isOnline,
    isSyncing,
    syncStatus,
    pendingSyncCount,
    syncConflictCount,
    hasSyncConflicts,
    syncConflicts,
    syncPendingTransactions,
    refreshSyncConflicts,
    resolveSyncConflictUseServer,
    resolveSyncConflictKeepLocal,

    movementUsage,
    monthlyMovementCount,
    monthlyLimit,
    remainingMovements,
    monthlyUsagePercentage,
    hasReachedMonthlyLimit,
    isPremium,

    loadFinanceData,
    refreshMovementUsage,

    addIncome,
    deleteIncome,
    updateIncome,

    addExpense,
    deleteExpense,
    updateExpense,

    addGoal,
    deleteGoal,
    updateGoal,
    recordGoalMovement,
    updateGoalMovement,
    deleteGoalMovement,

    addIncomeCategory,
    deleteIncomeCategory,
    updateIncomeCategory,

    addExpenseCategory,
    deleteExpenseCategory,
    updateExpenseCategory,

    updateSettings,

    clearIncomes,
    clearExpenses,
    clearGoals,
    resetAppData,
  }),
  [
    incomes,
    expenses,
    goals,
    goalMovements,
    settings,

    incomeCategories,
    expenseCategories,
    categoryRecords,

    loading,
    errorMessage,

    isOnline,
    isSyncing,
    syncStatus,
    pendingSyncCount,
    syncConflictCount,
    hasSyncConflicts,
    syncConflicts,
    syncPendingTransactions,
    refreshSyncConflicts,
    resolveSyncConflictUseServer,
    resolveSyncConflictKeepLocal,

    movementUsage,
    monthlyMovementCount,
    monthlyLimit,
    remainingMovements,
    monthlyUsagePercentage,
    hasReachedMonthlyLimit,
    isPremium,

    loadFinanceData,
    refreshMovementUsage,

    addIncome,
    deleteIncome,
    updateIncome,

    addExpense,
    deleteExpense,
    updateExpense,

    addGoal,
    deleteGoal,
    updateGoal,
    recordGoalMovement,
    updateGoalMovement,
    deleteGoalMovement,

    addIncomeCategory,
    deleteIncomeCategory,
    updateIncomeCategory,

    addExpenseCategory,
    deleteExpenseCategory,
    updateExpenseCategory,

    updateSettings,

    clearIncomes,
    clearExpenses,
    clearGoals,
    resetAppData,
  ]
);

  return (
    <FinanceContext.Provider
      value={value}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export default FinanceProvider;