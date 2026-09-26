import {
  createContext,
  useContext,
  useMemo,
} from "react";

import {
  FinanceContext,
} from "./FinanceContext";

import {
  getLocale,
} from "../utils/regionalSettings";

const I18nContext =
  createContext({
    language: "es",
    locale: "es-AR",
    t: (value) => value,
  });

export function I18nProvider({
  children,
}) {
  const {
    settings,
  } = useContext(
    FinanceContext
  );

  /*
   * Traducción automática pausada.
   *
   * La interfaz queda estable en español hasta
   * implementar una internacionalización por
   * componentes/catálogos, sin MutationObserver.
   */
  const language = "es";

  const locale =
    getLocale(
      language,
      settings?.region
    );

  const value =
    useMemo(
      () => ({
        language,
        locale,
        t: (value) => value,
      }),
      [
        locale,
      ]
    );

  return (
    <I18nContext.Provider
      value={value}
    >
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n =
  () =>
    useContext(
      I18nContext
    );

export default I18nProvider;
