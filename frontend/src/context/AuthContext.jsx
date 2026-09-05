import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  clearUserOfflineData,
  getCachedProfile,
  saveCachedProfile,
} from "../lib/offlineStorage";

export const AuthContext = createContext(null);

const DEFAULT_MONTHLY_LIMIT = 100;

const getSubscription = (subscriptions) => {
  if (Array.isArray(subscriptions)) {
    return subscriptions[0] || null;
  }

  return subscriptions || null;
};

const mapPayment = (payment) => ({
  id: payment.id,
  userId: payment.user_id,
  subscriptionId: payment.subscription_id,
  planType: payment.plan_type,
  amount: Number(payment.amount) || 0,
  status: payment.status,
  paymentDate: payment.payment_date,
  periodStartAt: payment.period_start_at,
  periodEndAt: payment.period_end_at,
  note: payment.note || "",
  createdBy: payment.created_by,
  createdAt: payment.created_at,
});

const mapProfile = (
  profile,
  payments = [],
  notes = []
) => {
  if (!profile) {
    return null;
  }

  const subscription = getSubscription(
    profile.subscriptions
  );

  const isAdmin = profile.role === "admin";

  const paymentHistory = payments
    .filter(
      (payment) => payment.user_id === profile.id
    )
    .map(mapPayment);

  const userNotes = notes.filter(
    (note) => note.user_id === profile.id
  );

  return {
    id: profile.id,
    name: profile.name || "Usuario",
    email: profile.email || "",
    role: isAdmin ? "admin" : "user",
    accountStatus:
      profile.account_status || "active",
    currency: profile.currency || "ARS",
    theme: profile.theme || "system",
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,

    plan: isAdmin
      ? "premium"
      : subscription?.plan || "free",

    billingCycle: isAdmin
      ? "annual"
      : subscription?.billing_cycle || null,

    premiumStatus: isAdmin
      ? "active"
      : subscription?.premium_status || "inactive",

    premiumActivatedAt:
      subscription?.premium_activated_at || null,

    premiumExpiresAt:
      subscription?.premium_expires_at || null,

    monthlyLimit: isAdmin
      ? null
      : Number(subscription?.monthly_limit) ||
        DEFAULT_MONTHLY_LIMIT,

    lastPaymentAmount:
      Number(subscription?.last_payment_amount) || 0,

    lastPaymentAt:
      subscription?.last_payment_at || null,

    lastPaymentPlan:
      paymentHistory[0]?.planType || null,

    subscriptionId:
      subscription?.id || null,

    adminNote:
      userNotes[0]?.note || "",

    paymentHistory,
    adminNotes: userNotes.map((note) => ({
      id: note.id,
      note: note.note,
      createdBy: note.created_by,
      createdAt: note.created_at,
    })),
  };
};

const getAuthErrorMessage = (error) => {
  const message =
    error?.message?.toLowerCase() || "";

  if (
    message.includes(
      "invalid login credentials"
    )
  ) {
    return "El correo o la contraseña son incorrectos.";
  }

  if (
    message.includes("email not confirmed")
  ) {
    return "Tenés que confirmar tu correo electrónico antes de iniciar sesión.";
  }

  if (
    message.includes("user already registered") ||
    message.includes("already been registered")
  ) {
    return "Ya existe una cuenta con ese correo.";
  }

  if (
    message.includes("password should be")
  ) {
    return "La contraseña no cumple con los requisitos de seguridad.";
  }

  if (
    message.includes("signup is disabled")
  ) {
    return "El registro de usuarios se encuentra deshabilitado.";
  }

  if (
    message.includes("rate limit")
  ) {
    return "Se realizaron demasiados intentos. Esperá unos minutos y volvé a probar.";
  }

  return (
    error?.message ||
    "Ocurrió un error inesperado."
  );
};

function AuthProvider({ children }) {
  const [session, setSession] =
    useState(null);

  const [authUser, setAuthUser] =
    useState(null);

  const [currentUser, setCurrentUser] =
    useState(null);

  const [users, setUsers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [usersLoading, setUsersLoading] =
    useState(false);

const fetchCurrentProfile = useCallback(
  async (userId) => {
    if (!userId) {
      return {
        success: false,
        user: null,
        message:
          "No se encontró el usuario autenticado.",
      };
    }

    const loadCachedProfile =
      async () => {
        const cachedUser =
          await getCachedProfile(
            userId
          );

        if (!cachedUser) {
          return null;
        }

        return {
          success: true,
          user: cachedUser,
          offline: true,
        };
      };

    /*
     * Si no hay conexión, usamos el último
     * perfil sincronizado de este usuario.
     */
    if (!navigator.onLine) {
      const cachedResult =
        await loadCachedProfile();

      if (cachedResult) {
        return cachedResult;
      }

      return {
        success: false,
        user: null,
        offline: true,
        message:
          "No hay conexión y todavía no existe información offline para esta cuenta.",
      };
    }

    /*
     * Actualiza la suscripción si Premium
     * ya venció.
     */
    const { error: refreshError } =
      await supabase.rpc(
        "refresh_my_subscription"
      );

    if (refreshError) {
      console.error(
        "No se pudo revisar la suscripción:",
        refreshError
      );
    }

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(`
        id,
        name,
        email,
        role,
        account_status,
        currency,
        theme,
        created_at,
        updated_at,
        subscriptions (
          id,
          user_id,
          plan,
          billing_cycle,
          premium_status,
          monthly_limit,
          premium_activated_at,
          premium_expires_at,
          last_payment_amount,
          last_payment_at,
          created_at,
          updated_at
        )
      `)
      .eq("id", userId)
      .maybeSingle();

    /*
     * Puede ocurrir que navigator.onLine diga
     * que existe conexión pero Supabase no
     * responda. En ese caso también intentamos
     * utilizar la copia local.
     */
    if (profileError) {
      console.error(
        "No se pudo cargar el perfil:",
        profileError
      );

      const cachedResult =
        await loadCachedProfile();

      if (cachedResult) {
        return cachedResult;
      }

      return {
        success: false,
        user: null,
        message:
          "No se pudo cargar la información de la cuenta.",
      };
    }

    if (!profile) {
      return {
        success: false,
        user: null,
        message:
          "No se encontró el perfil asociado a esta cuenta.",
      };
    }

    const mappedUser =
      mapProfile(profile);

    /*
     * Guardamos solamente el perfil del
     * usuario autenticado. Nunca mezclamos
     * información entre cuentas.
     */
    await saveCachedProfile(
      mappedUser
    );

    return {
      success: true,
      user: mappedUser,
      offline: false,
    };
  },
  []
);

  const fetchAdminUsers =
    useCallback(async () => {
      setUsersLoading(true);

      try {
        const [
          profilesResult,
          paymentsResult,
          notesResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select(`
              id,
              name,
              email,
              role,
              account_status,
              currency,
              theme,
              created_at,
              updated_at,
              subscriptions (
                id,
                user_id,
                plan,
                billing_cycle,
                premium_status,
                monthly_limit,
                premium_activated_at,
                premium_expires_at,
                last_payment_amount,
                last_payment_at,
                created_at,
                updated_at
              )
            `)
            .eq("role", "user")
            .order("created_at", {
              ascending: false,
            }),

          supabase
            .from("payments")
            .select(`
              id,
              user_id,
              subscription_id,
              plan_type,
              amount,
              status,
              payment_date,
              period_start_at,
              period_end_at,
              note,
              created_by,
              created_at
            `)
            .order("payment_date", {
              ascending: false,
            }),

          supabase
            .from("admin_notes")
            .select(`
              id,
              user_id,
              note,
              created_by,
              created_at
            `)
            .order("created_at", {
              ascending: false,
            }),
        ]);

        if (profilesResult.error) {
          throw profilesResult.error;
        }

        if (paymentsResult.error) {
          throw paymentsResult.error;
        }

        if (notesResult.error) {
          throw notesResult.error;
        }

        const mappedUsers = (
          profilesResult.data || []
        ).map((profile) =>
          mapProfile(
            profile,
            paymentsResult.data || [],
            notesResult.data || []
          )
        );

        setUsers(mappedUsers);

        return {
          success: true,
          users: mappedUsers,
        };
      } catch (error) {
        console.error(
          "No se pudieron cargar los usuarios:",
          error
        );

        setUsers([]);

        return {
          success: false,
          users: [],
          message:
            "No se pudieron cargar los usuarios.",
        };
      } finally {
        setUsersLoading(false);
      }
    }, []);

  const loadSessionUser = useCallback(
    async (
      nextSession,
      options = {}
    ) => {
      const {
        showLoading = true,
      } = options;

      if (showLoading) {
        setLoading(true);
      }

      setSession(nextSession);
      setAuthUser(
        nextSession?.user || null
      );

      if (!nextSession?.user) {
        setCurrentUser(null);
        setUsers([]);
        setLoading(false);

        return {
          success: true,
          user: null,
        };
      }

      const profileResult =
        await fetchCurrentProfile(
          nextSession.user.id
        );

      if (!profileResult.success) {
        setCurrentUser(null);
        setUsers([]);
        setLoading(false);

        return profileResult;
      }

      const loadedUser =
        profileResult.user;

      if (
        loadedUser.accountStatus ===
        "blocked"
      ) {
        await supabase.auth.signOut();

        setSession(null);
        setAuthUser(null);
        setCurrentUser(null);
        setUsers([]);
        setLoading(false);

        return {
          success: false,
          user: null,
          message:
            "Esta cuenta se encuentra bloqueada.",
        };
      }

      setCurrentUser(loadedUser);

      if (
  loadedUser.role === "admin" &&
  navigator.onLine
) {
  await fetchAdminUsers();
} else {
  setUsers([]);
}

      setLoading(false);

      return {
        success: true,
        user: loadedUser,
      };
    },
    [
      fetchAdminUsers,
      fetchCurrentProfile,
    ]
  );

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const {
        data,
        error,
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        console.error(
          "No se pudo recuperar la sesión:",
          error
        );

        setLoading(false);
        return;
      }

      await loadSessionUser(data.session);
    };

    initializeAuth();

    const {
      data: authListener,
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        window.setTimeout(() => {
          if (isMounted) {
            void loadSessionUser(
              nextSession,
              {
                showLoading: false,
              }
            );
          }
        }, 0);
      }
    );

    return () => {
      isMounted = false;

      authListener.subscription.unsubscribe();
    };
  }, [loadSessionUser]);

  const login = async ({
    email,
    password,
  }) => {
    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (
      !normalizedEmail ||
      !password
    ) {
      return {
        success: false,
        message:
          "Ingresá tu correo electrónico y contraseña.",
      };
    }

    const {
      data,
      error,
    } =
      await supabase.auth.signInWithPassword(
        {
          email: normalizedEmail,
          password,
        }
      );

    if (error) {
      return {
        success: false,
        message:
          getAuthErrorMessage(error),
      };
    }

    const sessionResult =
      await loadSessionUser(
        data.session
      );

    if (!sessionResult.success) {
      return sessionResult;
    }

    return {
      success: true,
      user: sessionResult.user,
    };
  };

  const register = async ({
    name,
    email,
    password,
  }) => {
    const normalizedName =
      name.trim();

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    if (
      !normalizedName ||
      !normalizedEmail ||
      !password
    ) {
      return {
        success: false,
        message:
          "Todos los campos son obligatorios.",
      };
    }

    const validEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        normalizedEmail
      );

    if (!validEmail) {
      return {
        success: false,
        message:
          "Ingresá un correo electrónico válido.",
      };
    }

    if (password.length < 8) {
      return {
        success: false,
        message:
          "La contraseña debe tener al menos 8 caracteres.",
      };
    }

    const {
      data,
      error,
    } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: normalizedName,
        },
        emailRedirectTo:
          `${window.location.origin}/login`,
      },
    });

    if (error) {
      return {
        success: false,
        message:
          getAuthErrorMessage(error),
      };
    }

    /*
     * Si la confirmación de correo está
     * activada, Supabase crea el usuario pero
     * no devuelve una sesión todavía.
     */
    if (!data.session) {
      return {
        success: true,
        user: null,
        requiresEmailConfirmation: true,
        message:
          "La cuenta fue creada. Revisá tu correo para confirmarla antes de iniciar sesión.",
      };
    }

    const sessionResult =
      await loadSessionUser(
        data.session
      );

    if (!sessionResult.success) {
      return sessionResult;
    }

    return {
      success: true,
      user: sessionResult.user,
      requiresEmailConfirmation: false,
      message:
        "La cuenta fue creada correctamente.",
    };
  };

const logout = async () => {
  const offlineUserId =
    currentUser?.id ||
    authUser?.id ||
    null;

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    return {
      success: false,
      message:
        getAuthErrorMessage(error),
    };
  }

  if (offlineUserId) {
    await clearUserOfflineData(
      offlineUserId
    );
  }

  setSession(null);
  setAuthUser(null);
  setCurrentUser(null);
  setUsers([]);

  return {
    success: true,
  };
};

  const refreshCurrentUser =
    useCallback(async () => {
      if (!authUser?.id) {
        return {
          success: false,
          message:
            "No hay una sesión activa.",
        };
      }

      const result =
        await fetchCurrentProfile(
          authUser.id
        );

      if (result.success) {
        setCurrentUser(result.user);
      }

      return result;
    }, [
      authUser?.id,
      fetchCurrentProfile,
    ]);

  const refreshUsers =
    useCallback(async () => {
      if (
        currentUser?.role !== "admin"
      ) {
        setUsers([]);

        return {
          success: false,
          users: [],
          message:
            "Se requieren permisos de administración.",
        };
      }

      return fetchAdminUsers();
    }, [
      currentUser?.role,
      fetchAdminUsers,
    ]);

  const updateCurrentUser = async (
    changes
  ) => {
    if (!currentUser?.id) {
      return {
        success: false,
        message:
          "No hay una sesión activa.",
      };
    }

    const cleanName =
      typeof changes.name === "string"
        ? changes.name.trim()
        : "";

    if (!cleanName) {
      return {
        success: false,
        message:
          "El nombre no puede estar vacío.",
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name: cleanName,
      })
      .eq("id", currentUser.id);

    if (error) {
      return {
        success: false,
        message:
          "No se pudo actualizar la cuenta.",
      };
    }

    const result =
      await refreshCurrentUser();

    return {
      success: result.success,
      message: result.success
        ? "Cuenta actualizada correctamente."
        : result.message,
    };
  };

  const activatePremium = async (
    userId,
    billingCycle,
    paymentAmount = 0,
    note = ""
  ) => {
    const numericAmount = Number(
      paymentAmount
    );

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount < 0
    ) {
      return {
        success: false,
        message:
          "El monto ingresado no es válido.",
      };
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_activate_premium",
      {
        target_user_id: userId,
        selected_billing_cycle:
          billingCycle,
        payment_amount:
          numericAmount,
        payment_note:
          typeof note === "string"
            ? note.trim()
            : "",
      }
    );

    if (error) {
      console.error(
        "No se pudo activar Premium:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo activar o renovar Premium.",
      };
    }

    await fetchAdminUsers();

    return (
      data || {
        success: true,
        message:
          "Premium actualizado correctamente.",
      }
    );
  };

  const removePremium = async (
    userId
  ) => {
    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_remove_premium",
      {
        target_user_id: userId,
      }
    );

    if (error) {
      console.error(
        "No se pudo quitar Premium:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo quitar el plan Premium.",
      };
    }

    await fetchAdminUsers();

    return (
      data || {
        success: true,
        message:
          "El plan Premium fue retirado.",
      }
    );
  };

  const toggleAccountStatus = async (
    userId
  ) => {
    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_toggle_account_status",
      {
        target_user_id: userId,
      }
    );

    if (error) {
      console.error(
        "No se pudo cambiar el estado:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo cambiar el estado de la cuenta.",
      };
    }

    await fetchAdminUsers();

    return (
      data || {
        success: true,
        message:
          "Estado actualizado correctamente.",
      }
    );
  };

  const changeMonthlyLimit = async (
    userId,
    newLimit
  ) => {
    const numericLimit = Number(
      newLimit
    );

    if (
      !Number.isInteger(numericLimit) ||
      numericLimit < 1
    ) {
      return {
        success: false,
        message:
          "El límite debe ser un número entero mayor a 0.",
      };
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_change_monthly_limit",
      {
        target_user_id: userId,
        new_monthly_limit:
          numericLimit,
      }
    );

    if (error) {
      console.error(
        "No se pudo cambiar el límite:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo actualizar el límite mensual.",
      };
    }

    await fetchAdminUsers();

    return (
      data || {
        success: true,
        message:
          "Límite mensual actualizado.",
      }
    );
  };

  const updateAdminNote = async (
    userId,
    note
  ) => {
    const cleanNote =
      typeof note === "string"
        ? note.trim()
        : "";

    if (!cleanNote) {
      return {
        success: false,
        message:
          "La nota no puede estar vacía.",
      };
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "admin_save_note",
      {
        target_user_id: userId,
        note_text: cleanNote,
      }
    );

    if (error) {
      console.error(
        "No se pudo guardar la nota:",
        error
      );

      return {
        success: false,
        message:
          "No se pudo guardar la nota administrativa.",
      };
    }

    await fetchAdminUsers();

    return (
      data || {
        success: true,
        message:
          "Nota administrativa guardada.",
      }
    );
  };

  const value = useMemo(
    () => ({
      session,
      authUser,
      currentUser,
      users,
      loading,
      usersLoading,

      isAuthenticated:
        Boolean(
          session &&
          currentUser
        ),

      isAdmin:
        currentUser?.role ===
        "admin",

      login,
      register,
      logout,
      updateCurrentUser,

      refreshCurrentUser,
      refreshUsers,

      activatePremium,
      removePremium,
      toggleAccountStatus,
      changeMonthlyLimit,
      updateAdminNote,
    }),
    [
      session,
      authUser,
      currentUser,
      users,
      loading,
      usersLoading,
      refreshCurrentUser,
      refreshUsers,
    ]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider."
    );
  }

  return context;
};

export default AuthProvider;