import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AuthContext = createContext(null);

const USERS_STORAGE_KEY = "moneytrack_auth_users";
const SESSION_STORAGE_KEY = "moneytrack_auth_session";
const DEFAULT_MONTHLY_LIMIT = 100;

const createDefaultUsers = () => [
  {
    id: "moneytrack-admin",
    name: "Administradora",
    email: "admin@moneytrack.com",
    password: "Admin123!",
    role: "admin",
    plan: "premium",
    billingCycle: "annual",
    premiumStatus: "active",
    premiumActivatedAt: new Date().toISOString(),
    premiumExpiresAt: null,
    monthlyLimit: null,
    accountStatus: "active",
    lastPaymentAmount: 0,
    lastPaymentAt: null,
    lastPaymentPlan: null,
    adminNote: "",
    paymentHistory: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: "moneytrack-demo",
    name: "Usuario Demo",
    email: "demo@moneytrack.com",
    password: "Demo123!",
    role: "user",
    plan: "free",
    billingCycle: null,
    premiumStatus: "inactive",
    premiumActivatedAt: null,
    premiumExpiresAt: null,
    monthlyLimit: DEFAULT_MONTHLY_LIMIT,
    accountStatus: "active",
    lastPaymentAmount: 0,
    lastPaymentAt: null,
    lastPaymentPlan: null,
    adminNote: "",
    paymentHistory: [],
    createdAt: new Date().toISOString(),
  },
];

const normalizeUser = (user) => {
  const isAdmin = user.role === "admin";

  return {
    ...user,
    role: isAdmin ? "admin" : "user",
    plan: isAdmin
      ? "premium"
      : user.plan === "premium"
        ? "premium"
        : "free",
    billingCycle: isAdmin
      ? "annual"
      : user.billingCycle || null,
    premiumStatus: isAdmin
      ? "active"
      : user.premiumStatus || "inactive",
    premiumActivatedAt: user.premiumActivatedAt || null,
    premiumExpiresAt: user.premiumExpiresAt || null,
    monthlyLimit: isAdmin
      ? null
      : Number(user.monthlyLimit) || DEFAULT_MONTHLY_LIMIT,
    accountStatus: user.accountStatus || "active",
    lastPaymentAmount: Number(user.lastPaymentAmount) || 0,
    lastPaymentAt: user.lastPaymentAt || null,
    lastPaymentPlan: user.lastPaymentPlan || null,
    adminNote:
      typeof user.adminNote === "string"
        ? user.adminNote
        : "",
    paymentHistory: Array.isArray(user.paymentHistory)
      ? user.paymentHistory
      : [],
    createdAt: user.createdAt || new Date().toISOString(),
  };
};

const loadUsers = () => {
  try {
    const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);

    if (storedUsers) {
      const parsedUsers = JSON.parse(storedUsers);

      if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
        return parsedUsers.map(normalizeUser);
      }
    }
  } catch (error) {
    console.error("No se pudieron recuperar los usuarios:", error);
  }

  const defaultUsers = createDefaultUsers().map(normalizeUser);

  localStorage.setItem(
    USERS_STORAGE_KEY,
    JSON.stringify(defaultUsers)
  );

  return defaultUsers;
};

const loadSession = () => {
  try {
    const storedSession = localStorage.getItem(
      SESSION_STORAGE_KEY
    );

    if (!storedSession) {
      return null;
    }

    const parsedSession = JSON.parse(storedSession);

    return parsedSession?.userId || null;
  } catch (error) {
    console.error("No se pudo recuperar la sesión:", error);
    return null;
  }
};

const removePassword = (user) => {
  if (!user) {
    return null;
  }

  const { password, ...safeUser } = user;

  return safeUser;
};

const generateId = () => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
};

const addMonthsSafely = (dateValue, months) => {
  const originalDate = new Date(dateValue);
  const originalDay = originalDate.getDate();

  const result = new Date(originalDate);

  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  const lastDayOfTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  result.setDate(
    Math.min(originalDay, lastDayOfTargetMonth)
  );

  return result;
};

function AuthProvider({ children }) {
  const [userRecords, setUserRecords] = useState(loadUsers);
  const [currentUserId, setCurrentUserId] = useState(loadSession);

  useEffect(() => {
    localStorage.setItem(
      USERS_STORAGE_KEY,
      JSON.stringify(userRecords)
    );
  }, [userRecords]);

  useEffect(() => {
    if (currentUserId) {
      localStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          userId: currentUserId,
        })
      );
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [currentUserId]);

  useEffect(() => {
    const checkExpiredSubscriptions = () => {
      const now = Date.now();

      setUserRecords((currentUsers) => {
        let hasChanges = false;

        const updatedUsers = currentUsers.map((user) => {
          const expirationTime = user.premiumExpiresAt
            ? new Date(user.premiumExpiresAt).getTime()
            : null;

          if (
            user.role === "user" &&
            user.plan === "premium" &&
            expirationTime &&
            expirationTime <= now
          ) {
            hasChanges = true;

            return {
              ...user,
              plan: "free",
              billingCycle: null,
              premiumStatus: "expired",
              monthlyLimit:
                Number(user.monthlyLimit) ||
                DEFAULT_MONTHLY_LIMIT,
            };
          }

          return user;
        });

        return hasChanges ? updatedUsers : currentUsers;
      });
    };

    checkExpiredSubscriptions();

    const intervalId = window.setInterval(
      checkExpiredSubscriptions,
      60000
    );

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const currentUserRecord = useMemo(
    () =>
      userRecords.find(
        (user) => user.id === currentUserId
      ) || null,
    [userRecords, currentUserId]
  );

  const currentUser = useMemo(
    () => removePassword(currentUserRecord),
    [currentUserRecord]
  );

  const users = useMemo(
    () => userRecords.map(removePassword),
    [userRecords]
  );

  const login = ({ email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();

    const user = userRecords.find(
      (storedUser) =>
        storedUser.email.toLowerCase() === normalizedEmail
    );

    if (!user || user.password !== password) {
      return {
        success: false,
        message: "El correo o la contraseña son incorrectos.",
      };
    }

    if (user.accountStatus === "blocked") {
      return {
        success: false,
        message: "Esta cuenta se encuentra bloqueada.",
      };
    }

    setCurrentUserId(user.id);

    return {
      success: true,
      user: removePassword(user),
    };
  };

  const register = ({ name, email, password }) => {
    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedName || !normalizedEmail || !password) {
      return {
        success: false,
        message: "Todos los campos son obligatorios.",
      };
    }

    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

    if (!validEmail) {
      return {
        success: false,
        message: "Ingresá un correo electrónico válido.",
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        message:
          "La contraseña debe tener al menos 8 caracteres.",
      };
    }

    const emailExists = userRecords.some(
      (user) =>
        user.email.toLowerCase() === normalizedEmail
    );

    if (emailExists) {
      return {
        success: false,
        message: "Ya existe una cuenta con ese correo.",
      };
    }

    const newUser = normalizeUser({
      id: generateId(),
      name: normalizedName,
      email: normalizedEmail,
      password,
      role: "user",
      plan: "free",
      billingCycle: null,
      premiumStatus: "inactive",
      premiumActivatedAt: null,
      premiumExpiresAt: null,
      monthlyLimit: DEFAULT_MONTHLY_LIMIT,
      accountStatus: "active",
      lastPaymentAmount: 0,
      lastPaymentAt: null,
      lastPaymentPlan: null,
      adminNote: "",
      paymentHistory: [],
      createdAt: new Date().toISOString(),
    });

    setUserRecords((currentUsers) => [
      ...currentUsers,
      newUser,
    ]);

    setCurrentUserId(newUser.id);

    return {
      success: true,
      user: removePassword(newUser),
    };
  };

  const logout = () => {
    setCurrentUserId(null);
  };

  const updateCurrentUser = (changes) => {
    if (!currentUserId) {
      return {
        success: false,
        message: "No hay una sesión activa.",
      };
    }

    const cleanName =
      typeof changes.name === "string"
        ? changes.name.trim()
        : "";

    if (!cleanName) {
      return {
        success: false,
        message: "El nombre no puede estar vacío.",
      };
    }

    setUserRecords((currentUsers) =>
      currentUsers.map((user) =>
        user.id === currentUserId
          ? {
              ...user,
              name: cleanName,
            }
          : user
      )
    );

    return {
      success: true,
      message: "Cuenta actualizada correctamente.",
    };
  };

  const activatePremium = (
    userId,
    billingCycle,
    paymentAmount = 0,
    note = ""
  ) => {
    if (
      billingCycle !== "monthly" &&
      billingCycle !== "annual"
    ) {
      return {
        success: false,
        message: "El tipo de plan no es válido.",
      };
    }

    const targetUser = userRecords.find(
      (user) => user.id === userId && user.role !== "admin"
    );

    if (!targetUser) {
      return {
        success: false,
        message: "No se encontró el usuario.",
      };
    }

    const numericAmount = Number(paymentAmount);

    if (
      Number.isNaN(numericAmount) ||
      numericAmount < 0
    ) {
      return {
        success: false,
        message: "El monto ingresado no es válido.",
      };
    }

    const now = new Date();
    const months = billingCycle === "annual" ? 12 : 1;

    setUserRecords((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id !== userId || user.role === "admin") {
          return user;
        }

        const currentExpiration = user.premiumExpiresAt
          ? new Date(user.premiumExpiresAt)
          : null;

        const hasActiveFuturePeriod =
          user.plan === "premium" &&
          currentExpiration &&
          currentExpiration > now;

        const periodStartAt = hasActiveFuturePeriod
          ? currentExpiration
          : now;

        const periodEndAt = addMonthsSafely(
          periodStartAt,
          months
        );

        const paymentRecord = {
          id: generateId(),
          planType: billingCycle,
          amount: numericAmount,
          paymentDate: now.toISOString(),
          periodStartAt: periodStartAt.toISOString(),
          periodEndAt: periodEndAt.toISOString(),
          status: "approved",
          note:
            typeof note === "string"
              ? note.trim()
              : "",
        };

        return {
          ...user,
          plan: "premium",
          billingCycle,
          premiumStatus: "active",
          premiumActivatedAt:
            hasActiveFuturePeriod && user.premiumActivatedAt
              ? user.premiumActivatedAt
              : now.toISOString(),
          premiumExpiresAt: periodEndAt.toISOString(),
          lastPaymentAmount: numericAmount,
          lastPaymentAt: now.toISOString(),
          lastPaymentPlan: billingCycle,
          adminNote:
            typeof note === "string" && note.trim()
              ? note.trim()
              : user.adminNote || "",
          paymentHistory: [
            paymentRecord,
            ...(user.paymentHistory || []),
          ].slice(0, 100),
        };
      })
    );

    return {
      success: true,
      message:
        billingCycle === "annual"
          ? "Premium anual activado correctamente."
          : "Premium mensual activado correctamente.",
    };
  };

  const removePremium = (userId) => {
    const targetUser = userRecords.find(
      (user) => user.id === userId && user.role !== "admin"
    );

    if (!targetUser) {
      return {
        success: false,
        message: "No se encontró el usuario.",
      };
    }

    setUserRecords((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId && user.role !== "admin"
          ? {
              ...user,
              plan: "free",
              billingCycle: null,
              premiumStatus: "inactive",
              premiumActivatedAt: null,
              premiumExpiresAt: null,
              monthlyLimit:
                Number(user.monthlyLimit) ||
                DEFAULT_MONTHLY_LIMIT,
            }
          : user
      )
    );

    return {
      success: true,
      message: "El plan Premium fue retirado.",
    };
  };

  const toggleAccountStatus = (userId) => {
    const targetUser = userRecords.find(
      (user) => user.id === userId && user.role !== "admin"
    );

    if (!targetUser) {
      return {
        success: false,
        message: "No se encontró el usuario.",
      };
    }

    const newStatus =
      targetUser.accountStatus === "blocked"
        ? "active"
        : "blocked";

    setUserRecords((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId && user.role !== "admin"
          ? {
              ...user,
              accountStatus: newStatus,
            }
          : user
      )
    );

    if (
      newStatus === "blocked" &&
      currentUserId === userId
    ) {
      setCurrentUserId(null);
    }

    return {
      success: true,
      accountStatus: newStatus,
      message:
        newStatus === "blocked"
          ? "La cuenta fue bloqueada."
          : "La cuenta fue habilitada.",
    };
  };

  const changeMonthlyLimit = (userId, newLimit) => {
    const numericLimit = Number(newLimit);

    if (!Number.isInteger(numericLimit) || numericLimit < 1) {
      return {
        success: false,
        message:
          "El límite debe ser un número entero mayor a 0.",
      };
    }

    const targetUser = userRecords.find(
      (user) => user.id === userId && user.role !== "admin"
    );

    if (!targetUser) {
      return {
        success: false,
        message: "No se encontró el usuario.",
      };
    }

    setUserRecords((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId && user.role !== "admin"
          ? {
              ...user,
              monthlyLimit: numericLimit,
            }
          : user
      )
    );

    return {
      success: true,
      message: "Límite mensual actualizado correctamente.",
    };
  };

  const updateAdminNote = (userId, note) => {
    const targetUser = userRecords.find(
      (user) => user.id === userId && user.role !== "admin"
    );

    if (!targetUser) {
      return {
        success: false,
        message: "No se encontró el usuario.",
      };
    }

    const cleanNote =
      typeof note === "string"
        ? note.trim()
        : "";

    setUserRecords((currentUsers) =>
      currentUsers.map((user) =>
        user.id === userId && user.role !== "admin"
          ? {
              ...user,
              adminNote: cleanNote,
            }
          : user
      )
    );

    return {
      success: true,
      message: "Nota administrativa guardada.",
    };
  };

  const value = {
    users,
    currentUser,
    isAuthenticated: Boolean(currentUser),
    isAdmin: currentUser?.role === "admin",
    login,
    register,
    logout,
    updateCurrentUser,
    activatePremium,
    removePremium,
    toggleAccountStatus,
    changeMonthlyLimit,
    updateAdminNote,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider."
    );
  }

  return context;
};

export default AuthProvider;