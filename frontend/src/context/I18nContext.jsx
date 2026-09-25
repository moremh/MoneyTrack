import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  FinanceContext,
} from "./FinanceContext";

import {
  useAuth,
} from "./AuthContext";

import {
  getLocale,
} from "../utils/regionalSettings";

import {
  getStoredUiLanguage,
  normalizeUiLanguage,
  translateInterfaceText,
} from "../i18n/translationCatalog";

import {
  translateOverride,
} from "../i18n/translationOverrides";

const I18nContext =
  createContext({
    language: "es",
    t: (value) => value,
  });

const STORAGE_KEY =
  "moneytrack-ui-language";

const ATTRIBUTES = [
  "placeholder",
  "title",
  "aria-label",
];

const normalize =
  (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

const getSpacing =
  (value) => {
    const text =
      String(value || "");

    return {
      leading:
        text.match(
          /^\s*/
        )?.[0] || "",
      trailing:
        text.match(
          /\s*$/
        )?.[0] || "",
    };
  };

export function I18nProvider({
  children,
}) {
  const {
    currentUser,
  } = useAuth();

  const {
    settings,
  } = useContext(
    FinanceContext
  );

  const textMemory =
    useRef(
      new WeakMap()
    );

  const leafMemory =
    useRef(
      new WeakMap()
    );

  const attributeMemory =
    useRef(
      new WeakMap()
    );

  const applying =
    useRef(false);

  const language =
    normalizeUiLanguage(
      currentUser
        ? settings?.language ||
            currentUser?.language ||
            "es"
        : getStoredUiLanguage()
    );

  const locale =
    getLocale(
      language,
      settings?.region
    );

  const translate =
    useCallback(
      (value) => {
        const source =
          normalize(value);

        if (
          !source ||
          language === "es"
        ) {
          return source;
        }

        const override =
          translateOverride(
            source,
            language
          );

        if (override) {
          return override;
        }

        return translateInterfaceText(
          source,
          language
        );
      },
      [
        language,
      ]
    );

  const t =
    translate;

  const translateTextNode =
    useCallback(
      (node) => {
        if (
          !node ||
          node.nodeType !==
            Node.TEXT_NODE
        ) {
          return;
        }

        const raw =
          node.nodeValue || "";

        const current =
          normalize(raw);

        if (!current) {
          return;
        }

        const remembered =
          textMemory
            .current
            .get(node);

        let source =
          current;

        if (remembered) {
          if (
            current ===
              remembered.output ||
            current ===
              remembered.source
          ) {
            source =
              remembered.source;
          } else {
            textMemory
              .current
              .delete(node);
          }
        }

        if (!source) {
          return;
        }

        const output =
          translate(source);

        if (
          !output ||
          output === source
        ) {
          return;
        }

        const {
          leading,
          trailing,
        } =
          getSpacing(raw);

        textMemory
          .current
          .set(
            node,
            {
              source,
              output,
            }
          );

        node.nodeValue =
          `${leading}${output}${trailing}`;
      },
      [
        translate,
      ]
    );

  const translateLeafElement =
    useCallback(
      (element) => {
        if (
          !element ||
          element.nodeType !==
            Node.ELEMENT_NODE ||
          element.children.length >
            0
        ) {
          return;
        }

        const raw =
          element.textContent || "";

        const current =
          normalize(raw);

        if (!current) {
          return;
        }

        const remembered =
          leafMemory
            .current
            .get(element);

        let source =
          current;

        if (remembered) {
          if (
            current ===
              remembered.output ||
            current ===
              remembered.source
          ) {
            source =
              remembered.source;
          } else {
            leafMemory
              .current
              .delete(element);
          }
        }

        const output =
          translate(source);

        if (
          !output ||
          output === source
        ) {
          return;
        }

        leafMemory
          .current
          .set(
            element,
            {
              source,
              output,
            }
          );

        element.textContent =
          output;
      },
      [
        translate,
      ]
    );

  const translateAttribute =
    useCallback(
      (
        element,
        attribute
      ) => {
        if (
          !element?.hasAttribute?.(
            attribute
          )
        ) {
          return;
        }

        const current =
          element.getAttribute(
            attribute
          ) || "";

        if (!current) {
          return;
        }

        let records =
          attributeMemory
            .current
            .get(element);

        if (!records) {
          records =
            new Map();

          attributeMemory
            .current
            .set(
              element,
              records
            );
        }

        const remembered =
          records.get(
            attribute
          );

        let source =
          current;

        if (remembered) {
          if (
            current ===
              remembered.output ||
            current ===
              remembered.source
          ) {
            source =
              remembered.source;
          } else {
            records.delete(
              attribute
            );
          }
        }

        const output =
          translate(source);

        if (
          !output ||
          output === source
        ) {
          return;
        }

        records.set(
          attribute,
          {
            source,
            output,
          }
        );

        element.setAttribute(
          attribute,
          output
        );
      },
      [
        translate,
      ]
    );

  const translateElement =
    useCallback(
      (element) => {
        if (
          !element ||
          element.nodeType !==
            Node.ELEMENT_NODE
        ) {
          return;
        }

        if (
          element.closest?.(
            "[data-i18n-ignore='true']"
          )
        ) {
          return;
        }

        for (
          const attribute of
          ATTRIBUTES
        ) {
          translateAttribute(
            element,
            attribute
          );
        }

        if (
          element.tagName ===
            "INPUT" &&
          element.getAttribute(
            "type"
          ) === "date"
        ) {
          element.setAttribute(
            "lang",
            locale
          );
        }

        translateLeafElement(
          element
        );

        for (
          const child of
          element.childNodes
        ) {
          if (
            child.nodeType ===
              Node.TEXT_NODE
          ) {
            translateTextNode(
              child
            );
          }
        }
      },
      [
        locale,
        translateAttribute,
        translateLeafElement,
        translateTextNode,
      ]
    );

  const translateTree =
    useCallback(
      (root) => {
        if (
          !root ||
          typeof document ===
            "undefined"
        ) {
          return;
        }

        applying.current =
          true;

        try {
          if (
            root.nodeType ===
              Node.TEXT_NODE
          ) {
            translateTextNode(
              root
            );
            return;
          }

          translateElement(
            root
          );

          const walker =
            document.createTreeWalker(
              root,
              NodeFilter.SHOW_ELEMENT
            );

          let element =
            walker.nextNode();

          while (element) {
            translateElement(
              element
            );

            element =
              walker.nextNode();
          }
        } finally {
          applying.current =
            false;
        }
      },
      [
        translateElement,
        translateTextNode,
      ]
    );

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEY,
      language
    );

    document.documentElement.lang =
      locale;

    const originalConfirm =
      window.confirm;

    const originalAlert =
      window.alert;

    window.confirm =
      (message) =>
        originalConfirm(
          translate(message)
        );

    window.alert =
      (message) =>
        originalAlert(
          translate(message)
        );

    const frame =
      window.requestAnimationFrame(
        () =>
          translateTree(
            document.body
          )
      );

    const observer =
      new MutationObserver(
        (mutations) => {
          if (
            applying.current
          ) {
            return;
          }

          for (
            const mutation of
            mutations
          ) {
            if (
              mutation.type ===
              "characterData"
            ) {
              translateTextNode(
                mutation.target
              );

              const parent =
                mutation.target
                  .parentElement;

              if (parent) {
                translateLeafElement(
                  parent
                );
              }

              continue;
            }

            if (
              mutation.type ===
              "attributes"
            ) {
              translateAttribute(
                mutation.target,
                mutation.attributeName
              );
              continue;
            }

            for (
              const node of
              mutation.addedNodes
            ) {
              translateTree(
                node
              );
            }
          }
        }
      );

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter:
          ATTRIBUTES,
      }
    );

    return () => {
      window.cancelAnimationFrame(
        frame
      );

      observer.disconnect();

      window.confirm =
        originalConfirm;

      window.alert =
        originalAlert;
    };
  }, [
    language,
    locale,
    translate,
    translateAttribute,
    translateLeafElement,
    translateTextNode,
    translateTree,
  ]);

  const value =
    useMemo(
      () => ({
        language,
        locale,
        t,
      }),
      [
        language,
        locale,
        t,
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
