import {
  createContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

export const FinanceContext = createContext();

export const FREE_LIMIT_ERROR_CODE = "FREE_LIMIT_REACHED";
export const DEFAULT_FREE_MONTHLY_LIMIT = 100;

const DEFAULT_INCOME_CATEGORIES = [
  "Trabajo",
  "Freelance",
  "Inversiones",
  "Regalos",
  "Otros",
];

const DEFAULT_EXPENSE_CATEGORIES = [
  "Comida",
  "Transporte",
  "Hogar",
  "Servicios",
  "Ocio",
  "Salud",
  "Otros",
];

const DEFAULT_SETTINGS = {
  userName: "Usuario",
  theme: "light",
};

const UNCATEGORIZED = "General";

const LEGACY_MIGRATION_KEY =
  "moneytrack_legacy_data_migrated_to";

const DATA_KEYS = {
  incomes: "incomes",
  expenses: "expenses",
  goals: "goals",
  settings: "settings",
  incomeCategories: "incomeCategories",
  expenseCategories: "expenseCategories",
};

function getUserStorageKey(userId, key) {
  return `moneytrack_${userId}_${key}`;
}

function parseStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key);

    if (saved === null) {
      return fallback;
    }

    return JSON.parse(saved);
  } catch (error) {
    console.error(
      `No se pudo leer la información guardada en ${key}:`,
      error
    );

    return fallback;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(
      `No se pudo guardar la información en ${key}:`,
      error
    );
  }
}

function existsIgnoreCase(list, value) {
  return list.some(
    (item) =>
      String(item).toLowerCase() ===
      String(value).toLowerCase()
  );
}

function normalizeCategories(savedList, fallbackList = []) {
  const categories = Array.isArray(savedList)
    ? savedList
    : fallbackList;

  const normalized = categories
    .filter(
      (category) =>
        typeof category === "string" &&
        category.trim() !== ""
    )
    .map((category) => {
      const cleanCategory = category.trim();

      return cleanCategory === "Sin categoría"
        ? UNCATEGORIZED
        : cleanCategory;
    });

  const unique = normalized.filter(
    (category, index, array) =>
      index ===
      array.findIndex(
        (item) =>
          item.toLowerCase() === category.toLowerCase()
      )
  );

  return existsIgnoreCase(unique, UNCATEGORIZED)
    ? unique
    : [UNCATEGORIZED, ...unique];
}

function getMovementDate(movement) {
  const dateValue =
    movement?.createdAt ||
    movement?.date ||
    movement?.movementDate;

  if (!dateValue) {
    return null;
  }

  if (
    typeof dateValue === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
  ) {
    const [year, month, day] = dateValue
      .split("-")
      .map(Number);

    return new Date(year, month - 1, day);
  }

  const parsedDate = new Date(dateValue);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate;
}

function isMovementFromCurrentMonth(movement) {
  const movementDate = getMovementDate(movement);

  if (!movementDate) {
    return false;
  }

  const currentDate = new Date();

  return (
    movementDate.getFullYear() ===
      currentDate.getFullYear() &&
    movementDate.getMonth() === currentDate.getMonth()
  );
}

function hasLegacyData() {
  return Object.values(DATA_KEYS).some(
    (key) => localStorage.getItem(key) !== null
  );
}

function hasUserData(userId) {
  return Object.values(DATA_KEYS).some(
    (key) =>
      localStorage.getItem(
        getUserStorageKey(userId, key)
      ) !== null
  );
}

function FinanceProvider({ children }) {
  const {
    currentUser,
    updateCurrentUser,
  } = useAuth();

  const currentUserId = currentUser?.id || null;

  const [loadedUserId, setLoadedUserId] =
    useState(null);

  const [incomes, setIncomes] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [goals, setGoals] = useState([]);

  const [settings, setSettings] = useState(
    DEFAULT_SETTINGS
  );

  const [
    incomeCategories,
    setIncomeCategories,
  ] = useState(() =>
    normalizeCategories(
      DEFAULT_INCOME_CATEGORIES,
      DEFAULT_INCOME_CATEGORIES
    )
  );

  const [
    expenseCategories,
    setExpenseCategories,
  ] = useState(() =>
    normalizeCategories(
      DEFAULT_EXPENSE_CATEGORIES,
      DEFAULT_EXPENSE_CATEGORIES
    )
  );

  /*
   * Cargar los datos correspondientes al usuario
   * que acaba de iniciar sesión.
   */
  useEffect(() => {
    setLoadedUserId(null);

    if (!currentUserId) {
      setIncomes([]);
      setExpenses([]);
      setGoals([]);

      setIncomeCategories(
        normalizeCategories(
          DEFAULT_INCOME_CATEGORIES,
          DEFAULT_INCOME_CATEGORIES
        )
      );

      setExpenseCategories(
        normalizeCategories(
          DEFAULT_EXPENSE_CATEGORIES,
          DEFAULT_EXPENSE_CATEGORIES
        )
      );

      setSettings(DEFAULT_SETTINGS);
      return;
    }

    const userHasSavedData =
      hasUserData(currentUserId);

    const migrationOwner =
      localStorage.getItem(
        LEGACY_MIGRATION_KEY
      );

    const shouldMigrateLegacyData =
      currentUser?.role !== "admin" &&
      !userHasSavedData &&
      !migrationOwner &&
      hasLegacyData();

    const getLoadKey = (key) =>
      shouldMigrateLegacyData
        ? key
        : getUserStorageKey(currentUserId, key);

    const userDefaultSettings = {
      ...DEFAULT_SETTINGS,
      userName:
        currentUser?.name ||
        DEFAULT_SETTINGS.userName,
    };

    const loadedIncomes = parseStorage(
      getLoadKey(DATA_KEYS.incomes),
      []
    );

    const loadedExpenses = parseStorage(
      getLoadKey(DATA_KEYS.expenses),
      []
    );

    const loadedGoals = parseStorage(
      getLoadKey(DATA_KEYS.goals),
      []
    );

    const loadedSettings = parseStorage(
      getLoadKey(DATA_KEYS.settings),
      userDefaultSettings
    );

    const loadedIncomeCategories =
      normalizeCategories(
        parseStorage(
          getLoadKey(DATA_KEYS.incomeCategories),
          DEFAULT_INCOME_CATEGORIES
        ),
        DEFAULT_INCOME_CATEGORIES
      );

    const loadedExpenseCategories =
      normalizeCategories(
        parseStorage(
          getLoadKey(DATA_KEYS.expenseCategories),
          DEFAULT_EXPENSE_CATEGORIES
        ),
        DEFAULT_EXPENSE_CATEGORIES
      );

    setIncomes(
      Array.isArray(loadedIncomes)
        ? loadedIncomes
        : []
    );

    setExpenses(
      Array.isArray(loadedExpenses)
        ? loadedExpenses
        : []
    );

    setGoals(
      Array.isArray(loadedGoals)
        ? loadedGoals
        : []
    );

    setSettings({
      ...userDefaultSettings,
      ...(loadedSettings || {}),
    });

    setIncomeCategories(
      loadedIncomeCategories
    );

    setExpenseCategories(
      loadedExpenseCategories
    );

    if (shouldMigrateLegacyData) {
      localStorage.setItem(
        LEGACY_MIGRATION_KEY,
        currentUserId
      );
    }

    setLoadedUserId(currentUserId);
  }, [currentUserId]);

  const canPersist =
    Boolean(currentUserId) &&
    loadedUserId === currentUserId;

  useEffect(() => {
    if (!canPersist) {
      return;
    }

    saveStorage(
      getUserStorageKey(
        currentUserId,
        DATA_KEYS.incomes
      ),
      incomes
    );
  }, [
    incomes,
    canPersist,
    currentUserId,
  ]);

  useEffect(() => {
    if (!canPersist) {
      return;
    }

    saveStorage(
      getUserStorageKey(
        currentUserId,
        DATA_KEYS.expenses
      ),
      expenses
    );
  }, [
    expenses,
    canPersist,
    currentUserId,
  ]);

  useEffect(() => {
    if (!canPersist) {
      return;
    }

    saveStorage(
      getUserStorageKey(
        currentUserId,
        DATA_KEYS.goals
      ),
      goals
    );
  }, [
    goals,
    canPersist,
    currentUserId,
  ]);

  useEffect(() => {
    document.body.dataset.theme =
      settings.theme || "light";

    if (!canPersist) {
      return;
    }

    saveStorage(
      getUserStorageKey(
        currentUserId,
        DATA_KEYS.settings
      ),
      settings
    );
  }, [
    settings,
    canPersist,
    currentUserId,
  ]);

  useEffect(() => {
    if (!canPersist) {
      return;
    }

    saveStorage(
      getUserStorageKey(
        currentUserId,
        DATA_KEYS.incomeCategories
      ),
      incomeCategories
    );
  }, [
    incomeCategories,
    canPersist,
    currentUserId,
  ]);

  useEffect(() => {
    if (!canPersist) {
      return;
    }

    saveStorage(
      getUserStorageKey(
        currentUserId,
        DATA_KEYS.expenseCategories
      ),
      expenseCategories
    );
  }, [
    expenseCategories,
    canPersist,
    currentUserId,
  ]);

  /*
   * Cantidad de ingresos y gastos creados
   * durante el mes actual.
   */
  const monthlyMovementCount = useMemo(() => {
    const currentMonthIncomes =
      incomes.filter(
        isMovementFromCurrentMonth
      ).length;

    const currentMonthExpenses =
      expenses.filter(
        isMovementFromCurrentMonth
      ).length;

    return (
      currentMonthIncomes +
      currentMonthExpenses
    );
  }, [incomes, expenses]);

  /*
   * El administrador y los usuarios Premium
   * no tienen límite mensual.
   */
  const isPremium = useMemo(() => {
    if (currentUser?.role === "admin") {
      return true;
    }

    if (currentUser?.plan !== "premium") {
      return false;
    }

    if (!currentUser?.premiumExpiresAt) {
      return true;
    }

    return (
      new Date(
        currentUser.premiumExpiresAt
      ).getTime() > Date.now()
    );
  }, [currentUser]);

  const monthlyLimit = isPremium
    ? null
    : Number(currentUser?.monthlyLimit) ||
      DEFAULT_FREE_MONTHLY_LIMIT;

  const remainingMovements = isPremium
    ? null
    : Math.max(
        monthlyLimit -
          monthlyMovementCount,
        0
      );

  const hasReachedMonthlyLimit =
    !isPremium &&
    monthlyMovementCount >= monthlyLimit;

  const monthlyUsagePercentage = isPremium
    ? 0
    : Math.min(
        Math.round(
          (monthlyMovementCount /
            monthlyLimit) *
            100
        ),
        100
      );

  const validateMovementLimit = () => {
    if (!currentUser) {
      return {
        success: false,
        code: "NOT_AUTHENTICATED",
        message:
          "Debés iniciar sesión para registrar movimientos.",
      };
    }

    if (hasReachedMonthlyLimit) {
      return {
        success: false,
        code: FREE_LIMIT_ERROR_CODE,
        message: `Llegaste al límite de ${monthlyLimit} movimientos mensuales del plan gratuito.`,
      };
    }

    return {
      success: true,
    };
  };

  const addIncome = (income) => {
    const validation =
      validateMovementLimit();

    if (!validation.success) {
      return validation;
    }

    const newIncome = {
      ...income,
      createdAt:
        income.createdAt ||
        new Date().toISOString(),
    };

    setIncomes((previousIncomes) => [
      newIncome,
      ...previousIncomes,
    ]);

    return {
      success: true,
      movement: newIncome,
    };
  };

  const deleteIncome = (id) => {
    setIncomes((previousIncomes) =>
      previousIncomes.filter(
        (item) => item.id !== id
      )
    );
  };

  const updateIncome = (updatedIncome) => {
    setIncomes((previousIncomes) =>
      previousIncomes.map((item) =>
        item.id === updatedIncome.id
          ? {
              ...item,
              ...updatedIncome,
              createdAt:
                item.createdAt ||
                updatedIncome.createdAt ||
                new Date().toISOString(),
            }
          : item
      )
    );

    return {
      success: true,
    };
  };

  const addExpense = (expense) => {
    const validation =
      validateMovementLimit();

    if (!validation.success) {
      return validation;
    }

    const newExpense = {
      ...expense,
      createdAt:
        expense.createdAt ||
        new Date().toISOString(),
    };

    setExpenses((previousExpenses) => [
      newExpense,
      ...previousExpenses,
    ]);

    return {
      success: true,
      movement: newExpense,
    };
  };

  const deleteExpense = (id) => {
    setExpenses((previousExpenses) =>
      previousExpenses.filter(
        (item) => item.id !== id
      )
    );
  };

  const updateExpense = (
    updatedExpense
  ) => {
    setExpenses((previousExpenses) =>
      previousExpenses.map((item) =>
        item.id === updatedExpense.id
          ? {
              ...item,
              ...updatedExpense,
              createdAt:
                item.createdAt ||
                updatedExpense.createdAt ||
                new Date().toISOString(),
            }
          : item
      )
    );

    return {
      success: true,
    };
  };

  const addGoal = (goal) => {
    setGoals((previousGoals) => [
      goal,
      ...previousGoals,
    ]);
  };

  const deleteGoal = (id) => {
    setGoals((previousGoals) =>
      previousGoals.filter(
        (goal) => goal.id !== id
      )
    );
  };

  const updateGoal = (updatedGoal) => {
    setGoals((previousGoals) =>
      previousGoals.map((goal) =>
        goal.id === updatedGoal.id
          ? updatedGoal
          : goal
      )
    );
  };

  const addIncomeCategory = (
    category
  ) => {
    const cleanCategory =
      category.trim();

    if (!cleanCategory) {
      return;
    }

    setIncomeCategories(
      (previousCategories) =>
        existsIgnoreCase(
          previousCategories,
          cleanCategory
        )
          ? previousCategories
          : [
              ...previousCategories,
              cleanCategory,
            ]
    );
  };

  const deleteIncomeCategory = (
    categoryToDelete
  ) => {
    if (
      categoryToDelete === UNCATEGORIZED
    ) {
      return;
    }

    setIncomeCategories(
      (previousCategories) => {
        const filteredCategories =
          previousCategories.filter(
            (category) =>
              category !==
              categoryToDelete
          );

        return existsIgnoreCase(
          filteredCategories,
          UNCATEGORIZED
        )
          ? filteredCategories
          : [
              UNCATEGORIZED,
              ...filteredCategories,
            ];
      }
    );

    setIncomes((previousIncomes) =>
      previousIncomes.map((item) =>
        item.category ===
        categoryToDelete
          ? {
              ...item,
              category: UNCATEGORIZED,
            }
          : item
      )
    );
  };

  const updateIncomeCategory = (
    oldName,
    newName
  ) => {
    const cleanName = newName.trim();

    if (
      !cleanName ||
      oldName === UNCATEGORIZED
    ) {
      return;
    }

    setIncomeCategories(
      (previousCategories) => {
        if (
          oldName.toLowerCase() !==
            cleanName.toLowerCase() &&
          existsIgnoreCase(
            previousCategories,
            cleanName
          )
        ) {
          return previousCategories;
        }

        return previousCategories.map(
          (category) =>
            category === oldName
              ? cleanName
              : category
        );
      }
    );

    setIncomes((previousIncomes) =>
      previousIncomes.map((item) =>
        item.category === oldName
          ? {
              ...item,
              category: cleanName,
            }
          : item
      )
    );
  };

  const addExpenseCategory = (
    category
  ) => {
    const cleanCategory =
      category.trim();

    if (!cleanCategory) {
      return;
    }

    setExpenseCategories(
      (previousCategories) =>
        existsIgnoreCase(
          previousCategories,
          cleanCategory
        )
          ? previousCategories
          : [
              ...previousCategories,
              cleanCategory,
            ]
    );
  };

  const deleteExpenseCategory = (
    categoryToDelete
  ) => {
    if (
      categoryToDelete === UNCATEGORIZED
    ) {
      return;
    }

    setExpenseCategories(
      (previousCategories) => {
        const filteredCategories =
          previousCategories.filter(
            (category) =>
              category !==
              categoryToDelete
          );

        return existsIgnoreCase(
          filteredCategories,
          UNCATEGORIZED
        )
          ? filteredCategories
          : [
              UNCATEGORIZED,
              ...filteredCategories,
            ];
      }
    );

    setExpenses((previousExpenses) =>
      previousExpenses.map((item) =>
        item.category ===
        categoryToDelete
          ? {
              ...item,
              category: UNCATEGORIZED,
            }
          : item
      )
    );
  };

  const updateExpenseCategory = (
    oldName,
    newName
  ) => {
    const cleanName = newName.trim();

    if (
      !cleanName ||
      oldName === UNCATEGORIZED
    ) {
      return;
    }

    setExpenseCategories(
      (previousCategories) => {
        if (
          oldName.toLowerCase() !==
            cleanName.toLowerCase() &&
          existsIgnoreCase(
            previousCategories,
            cleanName
          )
        ) {
          return previousCategories;
        }

        return previousCategories.map(
          (category) =>
            category === oldName
              ? cleanName
              : category
        );
      }
    );

    setExpenses((previousExpenses) =>
      previousExpenses.map((item) =>
        item.category === oldName
          ? {
              ...item,
              category: cleanName,
            }
          : item
      )
    );
  };

  const updateSettings = (
    newSettings
  ) => {
    const cleanUserName =
      typeof newSettings.userName ===
      "string"
        ? newSettings.userName.trim()
        : "";

    setSettings(
      (previousSettings) => ({
        ...previousSettings,
        ...newSettings,
        ...(cleanUserName
          ? {
              userName: cleanUserName,
            }
          : {}),
      })
    );

    if (
      cleanUserName &&
      cleanUserName !== currentUser?.name
    ) {
      updateCurrentUser({
        name: cleanUserName,
      });
    }
  };

  const clearIncomes = () =>
    setIncomes([]);

  const clearExpenses = () =>
    setExpenses([]);

  const clearGoals = () =>
    setGoals([]);

  const resetAppData = () => {
    setIncomes([]);
    setExpenses([]);
    setGoals([]);

    setIncomeCategories(
      normalizeCategories(
        DEFAULT_INCOME_CATEGORIES,
        DEFAULT_INCOME_CATEGORIES
      )
    );

    setExpenseCategories(
      normalizeCategories(
        DEFAULT_EXPENSE_CATEGORIES,
        DEFAULT_EXPENSE_CATEGORIES
      )
    );

    setSettings({
      ...DEFAULT_SETTINGS,
      userName:
        currentUser?.name ||
        DEFAULT_SETTINGS.userName,
    });
  };

  const movementUsage = {
    used: monthlyMovementCount,
    limit: monthlyLimit,
    remaining: remainingMovements,
    percentage: monthlyUsagePercentage,
    isPremium,
    hasReachedLimit:
      hasReachedMonthlyLimit,
    canAddMovement:
      isPremium ||
      !hasReachedMonthlyLimit,
  };

  return (
    <FinanceContext.Provider
      value={{
        incomes,
        expenses,
        goals,
        settings,
        incomeCategories,
        expenseCategories,

        movementUsage,
        monthlyMovementCount,
        monthlyLimit,
        remainingMovements,
        monthlyUsagePercentage,
        hasReachedMonthlyLimit,
        isPremium,

        addIncome,
        deleteIncome,
        updateIncome,

        addExpense,
        deleteExpense,
        updateExpense,

        addGoal,
        deleteGoal,
        updateGoal,

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
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export default FinanceProvider;