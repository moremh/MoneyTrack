import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export const FinanceContext = createContext(null);

export const FREE_LIMIT_ERROR_CODE =
  "FREE_LIMIT_REACHED";

export const DEFAULT_FREE_MONTHLY_LIMIT = 100;

const UNCATEGORIZED = "General";

const DEFAULT_SETTINGS = {
  userName: "Usuario",
  theme: "light",
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

const mapTransaction = (transaction) => ({
  id: transaction.id,
  userId: transaction.user_id,
  type: transaction.type,
  description: transaction.description,
  amount: Number(transaction.amount) || 0,
  categoryId: transaction.category_id || null,
  category:
    transaction.category_name || UNCATEGORIZED,
  date: transaction.date,
  createdAt: transaction.created_at,
  updatedAt: transaction.updated_at,
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

  const currentUserId =
    currentUser?.id || null;

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
      setCategoryRecords([]);

      setSettings(
        DEFAULT_SETTINGS
      );

      setMovementUsage(
        getDefaultMovementUsage(null)
      );

      setErrorMessage("");
      setLoading(false);
    }, []);

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

      try {
        const [
          transactionsResult,
          categoriesResult,
          goalsResult,
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

          supabase.rpc(
            "get_my_movement_usage"
          ),
        ]);

        if (
          transactionsResult.error
        ) {
          throw transactionsResult.error;
        }

        if (categoriesResult.error) {
          throw categoriesResult.error;
        }

        if (goalsResult.error) {
          throw goalsResult.error;
        }

        const transactions = (
          transactionsResult.data || []
        ).map(mapTransaction);

        setIncomes(
          transactions.filter(
            (transaction) =>
              transaction.type ===
              "income"
          )
        );

        setExpenses(
          transactions.filter(
            (transaction) =>
              transaction.type ===
              "expense"
          )
        );

        setCategoryRecords(
          (
            categoriesResult.data || []
          ).map(mapCategory)
        );

        setGoals(
          (goalsResult.data || []).map(
            mapGoal
          )
        );

        setSettings({
          userName:
            currentUser?.name ||
            DEFAULT_SETTINGS.userName,

          theme: normalizeTheme(
            currentUser?.theme ||
              DEFAULT_SETTINGS.theme
          ),
        });

        if (usageResult.error) {
          console.error(
            "No se pudo cargar el uso mensual:",
            usageResult.error
          );

          setMovementUsage(
            getDefaultMovementUsage(
              currentUser
            )
          );
        } else {
          setMovementUsage(
            mapMovementUsage(
              usageResult.data,
              currentUser
            )
          );
        }

        return {
          success: true,
        };
      } catch (error) {
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

        if (!movement?.date) {
          return {
            success: false,
            message:
              "La fecha es obligatoria.",
          };
        }

        return {
          success: true,
        };
      },
      [currentUserId]
    );

  const addMovement = useCallback(
    async (movement, type) => {
      const validation =
        validateMovement(movement);

      if (!validation.success) {
        return validation;
      }

      if (
        movementUsage.hasReachedLimit &&
        !movementUsage.isPremium
      ) {
        return {
          success: false,
          code:
            FREE_LIMIT_ERROR_CODE,
          message: `Llegaste al límite de ${movementUsage.limit} movimientos mensuales del plan gratuito.`,
        };
      }

      const cleanCategory =
        String(
          movement.category ||
            UNCATEGORIZED
        ).trim() || UNCATEGORIZED;

      const categoryRecord =
        findCategoryRecord(
          cleanCategory,
          type
        );

      const payload = {
        user_id: currentUserId,
        type,

        description:
          movement.description.trim(),

        amount:
          Number(movement.amount),

        category_id:
          categoryRecord?.id || null,

        category_name:
          cleanCategory,

        date: movement.date,
      };

      const { data, error } =
        await supabase
          .from("transactions")
          .insert(payload)
          .select(
            TRANSACTION_FIELDS
          )
          .single();

      if (error) {
        if (
          isFreeLimitError(error)
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
          (currentIncomes) => [
            newMovement,
            ...currentIncomes,
          ]
        );
      } else {
        setExpenses(
          (currentExpenses) => [
            newMovement,
            ...currentExpenses,
          ]
        );
      }

      await refreshMovementUsage();

      return {
        success: true,
        movement: newMovement,
      };
    },
    [
      currentUserId,
      findCategoryRecord,
      movementUsage,
      refreshMovementUsage,
      validateMovement,
    ]
  );

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

        const cleanCategory =
          String(
            updatedMovement.category ||
              UNCATEGORIZED
          ).trim() || UNCATEGORIZED;

        const categoryRecord =
          findCategoryRecord(
            cleanCategory,
            type
          );

        const payload = {
          type,

          description:
            updatedMovement.description.trim(),

          amount: Number(
            updatedMovement.amount
          ),

          category_id:
            categoryRecord?.id || null,

          category_name:
            cleanCategory,

          date: updatedMovement.date,
        };

        const { data, error } =
          await supabase
            .from("transactions")
            .update(payload)
            .eq(
              "id",
              updatedMovement.id
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
          movement:
            mappedMovement,
        };
      },
      [
        currentUserId,
        findCategoryRecord,
        validateMovement,
      ]
    );

  const deleteMovement =
    useCallback(
      async (id, type) => {
        if (!currentUserId || !id) {
          return {
            success: false,
            message:
              "No se encontró el movimiento.",
          };
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
          return {
            success: false,
            message:
              getDatabaseErrorMessage(
                error,
                "No se pudo eliminar el movimiento."
              ),
          };
        }

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

        await refreshMovementUsage();

        return {
          success: true,
        };
      },
      [
        currentUserId,
        refreshMovementUsage,
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
        categoryName,
        type
      ) => {
        if (!currentUserId) {
          return {
            success: false,
            message:
              "No hay una sesión activa.",
          };
        }

        const cleanName =
          String(
            categoryName || ""
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

        const { data, error } =
          await supabase
            .from("categories")
            .insert({
              user_id:
                currentUserId,
              name: cleanName,
              type,
              color: null,
              icon: null,
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
        newName,
        type
      ) => {
        const cleanName =
          String(
            newName || ""
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

        const {
          data,
          error,
        } = await supabase
          .from("categories")
          .update({
            name: cleanName,
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

      if (
        !Number.isFinite(
          payload.current_amount
        ) ||
        payload.current_amount < 0
      ) {
        return {
          success: false,
          message:
            "El monto actual no puede ser negativo.",
        };
      }

      const { data, error } =
        await supabase
          .from("goals")
          .insert({
            user_id:
              currentUserId,
            ...payload,
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

      const { data, error } =
        await supabase
          .from("goals")
          .update(payload)
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

      return {
        success: true,
      };
    },
    [currentUserId]
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
      settings,

      incomeCategories,
      expenseCategories,

      loading,
      errorMessage,

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
      settings,
      incomeCategories,
      expenseCategories,
      loading,
      errorMessage,
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