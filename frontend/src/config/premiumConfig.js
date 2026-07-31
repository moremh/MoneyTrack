export const DEFAULT_COMMERCIAL_SETTINGS = {
  id: "main",
  whatsappNumber: "5493813540133",

  plansEyebrow: "Planes MoneyTrack",
  plansTitle: "Elegí el plan que mejor se adapte a vos",
  plansDescription:
    "Todos los planes tienen las mismas herramientas. La diferencia está en la cantidad de movimientos que podés registrar.",

  activationTitle: "¿Cómo se activa Premium?",
  activationDescription:
    "Elegís el plan, enviás el mensaje por WhatsApp y recibís los datos para realizar la transferencia. Después de verificar el comprobante, tu cuenta se activa desde el panel administrativo.",

  modalEyebrow: "MoneyTrack Premium",
  modalTitle: "Conocé los planes Premium",
  modalLimitTitle: "Llegaste al límite mensual",
  modalDescription:
    "Elegí un plan Premium para registrar movimientos sin límites.",
  modalLimitDescription:
    "Elegí un plan para continuar registrando movimientos sin límites.",

  paymentDisclaimer:
    "El plan se activará después de verificar el comprobante de pago.",
};

export const DEFAULT_COMMERCIAL_PLANS = [
  {
    id: "free",
    name: "Gratuito",
    subtitle: "Para comenzar",
    duration: "Sin vencimiento",
    price: 0,
    priceSuffix: "sin vencimiento",
    description:
      "Las herramientas esenciales para organizar tus finanzas.",
    badge: "",
    buttonText: "",
    features: [
      "100 movimientos por mes",
      "Ingresos y gastos",
      "Reportes PDF y Excel",
      "Objetivos y categorías",
      "Todos los gráficos y filtros",
    ],
    isVisible: true,
    sortOrder: 1,
  },

  {
    id: "monthly",
    name: "Premium mensual",
    subtitle: "Movimientos ilimitados",
    duration: "1 mes",
    price: 6000,
    priceSuffix: "por mes",
    description:
      "Movimientos ilimitados durante un mes.",
    badge: "",
    buttonText: "Solicitar Premium mensual",
    features: [
      "Movimientos ilimitados",
      "Todas las funciones del plan gratuito",
      "Reportes PDF y Excel",
      "Filtros y estadísticas completas",
      "Activación manual por WhatsApp",
    ],
    isVisible: true,
    sortOrder: 2,
  },

  {
    id: "annual",
    name: "Premium anual",
    subtitle: "Movimientos ilimitados",
    duration: "12 meses",
    price: 60000,
    priceSuffix: "por año",
    description:
      "Movimientos ilimitados durante doce meses.",
    badge: "2 meses bonificados",
    buttonText: "Solicitar Premium anual",
    features: [
      "Movimientos ilimitados",
      "Todas las funciones del plan gratuito",
      "Reportes PDF y Excel",
      "Filtros y estadísticas completas",
      "Activación manual por WhatsApp",
    ],
    isVisible: true,
    sortOrder: 3,
  },
];

export const PREMIUM_PLANS = Object.fromEntries(
  DEFAULT_COMMERCIAL_PLANS.filter(
    (plan) => plan.id !== "free"
  ).map((plan) => [plan.id, plan])
);

export const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export const isPromotionCurrentlyActive = (
  promotion
) => {
  if (!promotion?.isActive) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (promotion.startsOn) {
    const startsOn = new Date(
      `${promotion.startsOn}T00:00:00`
    );

    if (startsOn > today) {
      return false;
    }
  }

  if (promotion.endsOn) {
    const endsOn = new Date(
      `${promotion.endsOn}T23:59:59`
    );

    if (endsOn < today) {
      return false;
    }
  }

  return true;
};

export const getCommercialPlanName = (
  planMap,
  planId,
  fallback = "Premium"
) =>
  planMap?.[planId]?.name ||
  PREMIUM_PLANS?.[planId]?.name ||
  fallback;

export function buildWhatsAppPremiumRequest({
  user,
  plan,
  settings = DEFAULT_COMMERCIAL_SETTINGS,
  promotion = null,
}) {
  const whatsappNumber =
    settings?.whatsappNumber || "";

  const cleanNumber = String(
    whatsappNumber
  ).replace(/\D/g, "");

  const finalPrice = promotion
    ? Number(promotion.promotionalPrice)
    : Number(plan?.price);

  const requestedPlanName = promotion
    ? `${plan?.name || "Premium"} - ${
        promotion.title
      }`
    : plan?.name || "Premium";

  const message = [
    "Hola, quiero solicitar MoneyTrack Premium.",
    "",
    `Nombre: ${
      user?.name || "Sin especificar"
    }`,
    `Email: ${
      user?.email || "Sin especificar"
    }`,
    `ID de usuario: ${
      user?.id || "Sin especificar"
    }`,
    `Plan solicitado: ${requestedPlanName}`,
    `Duración: ${
      plan?.duration || "Sin especificar"
    }`,
    `Precio: ${formatCurrency(finalPrice)}`,
  ].join("\n");

  const isConfigured =
    /^\d{10,15}$/.test(cleanNumber);

  return {
    message,
    isConfigured,

    url: isConfigured
      ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(
          message
        )}`
      : "",
  };
}