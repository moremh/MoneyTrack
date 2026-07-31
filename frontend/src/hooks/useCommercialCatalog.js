import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  DEFAULT_COMMERCIAL_PLANS,
  DEFAULT_COMMERCIAL_SETTINGS,
} from "../config/premiumConfig";

const CATALOG_UPDATED_EVENT =
  "moneytrack-commercial-catalog-updated";

const catalogCache = new Map();
const catalogRequests = new Map();

const fallbackCatalog = {
  settings: DEFAULT_COMMERCIAL_SETTINGS,
  plans: DEFAULT_COMMERCIAL_PLANS,
  promotions: [],
};

const normalizeSettings = (row) => ({
  id: row?.id || "main",

  whatsappNumber:
    row?.whatsapp_number ??
    DEFAULT_COMMERCIAL_SETTINGS.whatsappNumber,

  plansEyebrow:
    row?.plans_eyebrow ??
    DEFAULT_COMMERCIAL_SETTINGS.plansEyebrow,

  plansTitle:
    row?.plans_title ??
    DEFAULT_COMMERCIAL_SETTINGS.plansTitle,

  plansDescription:
    row?.plans_description ??
    DEFAULT_COMMERCIAL_SETTINGS.plansDescription,

  activationTitle:
    row?.activation_title ??
    DEFAULT_COMMERCIAL_SETTINGS.activationTitle,

  activationDescription:
    row?.activation_description ??
    DEFAULT_COMMERCIAL_SETTINGS.activationDescription,

  modalEyebrow:
    row?.modal_eyebrow ??
    DEFAULT_COMMERCIAL_SETTINGS.modalEyebrow,

  modalTitle:
    row?.modal_title ??
    DEFAULT_COMMERCIAL_SETTINGS.modalTitle,

  modalLimitTitle:
    row?.modal_limit_title ??
    DEFAULT_COMMERCIAL_SETTINGS.modalLimitTitle,

  modalDescription:
    row?.modal_description ??
    DEFAULT_COMMERCIAL_SETTINGS.modalDescription,

  modalLimitDescription:
    row?.modal_limit_description ??
    DEFAULT_COMMERCIAL_SETTINGS.modalLimitDescription,

  paymentDisclaimer:
    row?.payment_disclaimer ??
    DEFAULT_COMMERCIAL_SETTINGS.paymentDisclaimer,
});

const normalizePlan = (row) => ({
  id: row.id,
  name: row.title,
  subtitle: row.subtitle || "",
  duration: row.duration || "",
  price: Number(row.price) || 0,
  priceSuffix: row.price_suffix || "",
  description: row.description || "",
  badge: row.badge || "",
  buttonText: row.button_text || "",
  features: Array.isArray(row.features)
    ? row.features
    : [],
  isVisible: Boolean(row.is_visible),
  sortOrder: Number(row.sort_order) || 0,
});

const normalizePromotion = (row) => ({
  id: row.id,
  planId: row.plan_id,
  title: row.title,
  description: row.description || "",
  badge: row.badge || "",

  promotionalPrice:
    Number(row.promotional_price) || 0,

  previousPrice:
    row.previous_price === null
      ? null
      : Number(row.previous_price),

  buttonText:
    row.button_text || "Solicitar promoción",

  details: Array.isArray(row.details)
    ? row.details
    : [],

  startsOn: row.starts_on || "",
  endsOn: row.ends_on || "",

  isActive: Boolean(row.is_active),
  showOnPlans: Boolean(row.show_on_plans),
  showOnModal: Boolean(row.show_on_modal),

  sortOrder: Number(row.sort_order) || 0,
});

async function getCacheKey() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || "anonymous";
}

async function requestCommercialCatalog(
  force = false
) {
  const cacheKey = await getCacheKey();

  if (
    !force &&
    catalogCache.has(cacheKey)
  ) {
    return catalogCache.get(cacheKey);
  }

  if (
    !force &&
    catalogRequests.has(cacheKey)
  ) {
    return catalogRequests.get(cacheKey);
  }

  const request = Promise.all([
    supabase
      .from("commercial_settings")
      .select("*")
      .eq("id", "main")
      .maybeSingle(),

    supabase
      .from("commercial_plans")
      .select("*")
      .order("sort_order", {
        ascending: true,
      }),

    supabase
      .from("commercial_promotions")
      .select("*")
      .order("sort_order", {
        ascending: true,
      }),
  ])
    .then(
      ([
        settingsResponse,
        plansResponse,
        promotionsResponse,
      ]) => {
        const firstError =
          settingsResponse.error ||
          plansResponse.error ||
          promotionsResponse.error;

        if (firstError) {
          throw firstError;
        }

        const normalizedPlans =
          plansResponse.data?.length
            ? plansResponse.data.map(
                normalizePlan
              )
            : DEFAULT_COMMERCIAL_PLANS;

        const catalog = {
          settings: normalizeSettings(
            settingsResponse.data
          ),

          plans: normalizedPlans,

          promotions: (
            promotionsResponse.data || []
          ).map(normalizePromotion),
        };

        catalogCache.set(
          cacheKey,
          catalog
        );

        return catalog;
      }
    )
    .finally(() => {
      catalogRequests.delete(cacheKey);
    });

  catalogRequests.set(
    cacheKey,
    request
  );

  return request;
}

export function notifyCommercialCatalogUpdated() {
  catalogCache.clear();
  catalogRequests.clear();

  window.dispatchEvent(
    new CustomEvent(
      CATALOG_UPDATED_EVENT
    )
  );
}

export function useCommercialCatalog() {
  const [catalog, setCatalog] =
    useState(fallbackCatalog);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadCatalog = useCallback(
    async (force = false) => {
      setLoading(true);
      setError("");

      try {
        const result =
          await requestCommercialCatalog(
            force
          );

        setCatalog(result);

        return {
          success: true,
          catalog: result,
        };
      } catch (loadError) {
        console.error(
          "No se pudo cargar el catálogo comercial:",
          loadError
        );

        setCatalog(fallbackCatalog);

        setError(
          "No se pudo cargar la configuración comercial."
        );

        return {
          success: false,
          message:
            "No se pudo cargar el catálogo comercial.",
        };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadCatalog();

    const handleCatalogUpdated = () => {
      void loadCatalog(true);
    };

    window.addEventListener(
      CATALOG_UPDATED_EVENT,
      handleCatalogUpdated
    );

    return () => {
      window.removeEventListener(
        CATALOG_UPDATED_EVENT,
        handleCatalogUpdated
      );
    };
  }, [loadCatalog]);

  const planMap = useMemo(() => {
    const fallbackMap =
      Object.fromEntries(
        DEFAULT_COMMERCIAL_PLANS.map(
          (plan) => [plan.id, plan]
        )
      );

    catalog.plans.forEach((plan) => {
      fallbackMap[plan.id] = plan;
    });

    return fallbackMap;
  }, [catalog.plans]);

  const visiblePlans = useMemo(
    () =>
      catalog.plans.filter(
        (plan) => plan.isVisible
      ),
    [catalog.plans]
  );

  const premiumPlans = useMemo(
    () =>
      visiblePlans.filter(
        (plan) =>
          plan.id === "monthly" ||
          plan.id === "annual"
      ),
    [visiblePlans]
  );

  return {
    ...catalog,
    planMap,
    visiblePlans,
    premiumPlans,
    loading,
    error,
    refresh: () => loadCatalog(true),
  };
}