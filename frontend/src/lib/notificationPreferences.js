const STORAGE_KEY =
  "moneytrack:notification-preferences:v1";

const CHANGE_EVENT =
  "moneytrack:notification-preferences-changed";

const getDefaultPushEnabled = () => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window)
  ) {
    return false;
  }

  /*
   * Mantiene compatibilidad con los dispositivos
   * que ya habían concedido permiso antes de sumar
   * la pantalla de Configuración.
   */
  return window.Notification.permission === "granted";
};

const DEFAULT_PREFERENCES = {
  pushEnabled: null,
  inAppAlertsEnabled: true,
  soundEnabled: true,
};

const normalizePreferences = (value = {}) => ({
  pushEnabled:
    typeof value.pushEnabled === "boolean"
      ? value.pushEnabled
      : getDefaultPushEnabled(),

  inAppAlertsEnabled:
    value.inAppAlertsEnabled !== false,

  soundEnabled:
    value.soundEnabled !== false,
});

export const getNotificationPreferences = () => {
  if (typeof window === "undefined") {
    return normalizePreferences(
      DEFAULT_PREFERENCES
    );
  }

  try {
    const raw = window.localStorage.getItem(
      STORAGE_KEY
    );

    if (!raw) {
      return normalizePreferences(
        DEFAULT_PREFERENCES
      );
    }

    return normalizePreferences({
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(raw),
    });
  } catch {
    return normalizePreferences(
      DEFAULT_PREFERENCES
    );
  }
};

export const updateNotificationPreferences = (
  changes
) => {
  const current =
    getNotificationPreferences();

  const next = normalizePreferences({
    ...current,
    ...(changes || {}),
  });

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Si localStorage no está disponible,
      // mantenemos el cambio solo en memoria/UI.
    }

    window.dispatchEvent(
      new CustomEvent(CHANGE_EVENT, {
        detail: next,
      })
    );
  }

  return next;
};

export const subscribeNotificationPreferences = (
  listener
) => {
  if (
    typeof window === "undefined" ||
    typeof listener !== "function"
  ) {
    return () => {};
  }

  const handleChange = (event) => {
    listener(
      event.detail ||
        getNotificationPreferences()
    );
  };

  const handleStorage = (event) => {
    if (
      event.key === STORAGE_KEY ||
      event.key === null
    ) {
      listener(
        getNotificationPreferences()
      );
    }
  };

  window.addEventListener(
    CHANGE_EVENT,
    handleChange
  );

  window.addEventListener(
    "storage",
    handleStorage
  );

  return () => {
    window.removeEventListener(
      CHANGE_EVENT,
      handleChange
    );

    window.removeEventListener(
      "storage",
      handleStorage
    );
  };
};

let audioContext = null;

const getAudioContext = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const AudioContextClass =
    window.AudioContext ||
    window.webkitAudioContext;

  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext =
      new AudioContextClass();
  }

  return audioContext;
};

export const primeReminderSound = async () => {
  const context = getAudioContext();

  if (!context) {
    return false;
  }

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    return context.state === "running";
  } catch {
    return false;
  }
};

const playTone = (
  context,
  {
    frequency,
    startAt,
    duration,
    volume,
  }
) => {
  const oscillator =
    context.createOscillator();

  const gain =
    context.createGain();

  oscillator.type = "sine";

  oscillator.frequency.setValueAtTime(
    frequency,
    startAt
  );

  gain.gain.setValueAtTime(
    0.0001,
    startAt
  );

  gain.gain.exponentialRampToValueAtTime(
    volume,
    startAt + 0.02
  );

  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + duration
  );

  oscillator.connect(gain);
  gain.connect(context.destination);

  oscillator.start(startAt);
  oscillator.stop(
    startAt + duration + 0.03
  );
};

export const playReminderSound = async () => {
  const preferences =
    getNotificationPreferences();

  if (!preferences.soundEnabled) {
    return {
      success: false,
      disabled: true,
    };
  }

  const context = getAudioContext();

  if (!context) {
    return {
      success: false,
      unsupported: true,
    };
  }

  try {
    if (context.state === "suspended") {
      await context.resume();
    }

    if (context.state !== "running") {
      return {
        success: false,
        blocked: true,
      };
    }

    const now = context.currentTime;

    playTone(context, {
      frequency: 880,
      startAt: now,
      duration: 0.18,
      volume: 0.17,
    });

    playTone(context, {
      frequency: 1175,
      startAt: now + 0.24,
      duration: 0.22,
      volume: 0.18,
    });

    playTone(context, {
      frequency: 988,
      startAt: now + 0.52,
      duration: 0.28,
      volume: 0.15,
    });

    return {
      success: true,
    };
  } catch (error) {
    console.warn(
      "No se pudo reproducir el sonido del recordatorio:",
      error
    );

    return {
      success: false,
      error,
    };
  }
};
