export const WHATSAPP_NUMBER = "5493813540133";

export const PREMIUM_PLANS = {
  monthly: {
    id: "monthly",
    name: "Premium mensual",
    duration: "1 mes",
    price: 6000,
    description: "Movimientos ilimitados durante un mes.",
  },

  annual: {
    id: "annual",
    name: "Premium anual",
    duration: "12 meses",
    price: 60000,
    description: "Movimientos ilimitados durante doce meses.",
    badge: "2 meses bonificados",
  },
};

export const formatCurrency = (amount) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

export function buildWhatsAppPremiumRequest({
  user,
  plan,
}) {
  const cleanNumber = WHATSAPP_NUMBER.replace(/\D/g, "");

  const message = [
    "Hola, quiero solicitar MoneyTrack Premium.",
    "",
    `Nombre: ${user?.name || "Sin especificar"}`,
    `Email: ${user?.email || "Sin especificar"}`,
    `ID de usuario: ${user?.id || "Sin especificar"}`,
    `Plan solicitado: ${plan.name}`,
    `Duración: ${plan.duration}`,
    `Precio: ${formatCurrency(plan.price)}`,
  ].join("\n");

  const isConfigured =
    /^\d{10,15}$/.test(cleanNumber) &&
    !WHATSAPP_NUMBER.includes("X");

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