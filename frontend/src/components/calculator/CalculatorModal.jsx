import {
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "./CalculatorModal.module.css";

const HISTORY_KEY =
  "moneytrack-calculator-history-v1";

const MAX_HISTORY_ITEMS = 8;

const OPERATOR_LABELS = {
  "+": "+",
  "-": "−",
  "*": "×",
  "/": "÷",
};

const sanitizeNumber = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(
    numericValue.toFixed(10)
  );
};

const formatDisplayNumber = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Error";
  }

  return new Intl.NumberFormat(
    "es-AR",
    {
      maximumFractionDigits: 10,
      useGrouping: true,
    }
  ).format(numericValue);
};

const formatInputDisplay = (value) => {
  const rawValue = String(
    value ?? "0"
  );

  const isNegative =
    rawValue.startsWith("-");

  const unsignedValue =
    isNegative
      ? rawValue.slice(1)
      : rawValue;

  const [
    integerPart = "0",
    decimalPart,
  ] = unsignedValue.split(".");

  const integerNumber = Number(
    integerPart || "0"
  );

  const formattedInteger =
    Number.isFinite(integerNumber)
      ? new Intl.NumberFormat(
          "es-AR",
          {
            maximumFractionDigits: 0,
            useGrouping: true,
          }
        ).format(integerNumber)
      : "0";

  const sign =
    isNegative ? "-" : "";

  if (!unsignedValue.includes(".")) {
    return `${sign}${formattedInteger}`;
  }

  return `${sign}${formattedInteger},${
    decimalPart ?? ""
  }`;
};

const readHistory = () => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(
        HISTORY_KEY
      ) || "[]"
    );

    return Array.isArray(parsed)
      ? parsed.slice(
          0,
          MAX_HISTORY_ITEMS
        )
      : [];
  } catch {
    return [];
  }
};

const saveHistory = (history) => {
  try {
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(history)
    );
  } catch {
    // La calculadora sigue funcionando aunque
    // el navegador no permita guardar historial.
  }
};

function CalculatorModal({
  onUseResult,
}) {
  const [display, setDisplay] =
    useState("0");

  const [storedValue, setStoredValue] =
    useState(null);

  const [operator, setOperator] =
    useState(null);

  const [waitingForOperand, setWaitingForOperand] =
    useState(false);

  const [expression, setExpression] =
    useState("");

  const [error, setError] =
    useState("");

  const [copied, setCopied] =
    useState(false);

  const [history, setHistory] =
    useState(readHistory);

  const numericResult = useMemo(
    () => Number(display),
    [display]
  );

  const canUseResult =
    !error &&
    Number.isFinite(numericResult) &&
    numericResult > 0;

  const clearCalculator = () => {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setExpression("");
    setError("");
    setCopied(false);
  };

  const inputDigit = (digit) => {
    setError("");
    setCopied(false);

    if (waitingForOperand) {
      setDisplay(String(digit));
      setWaitingForOperand(false);
      return;
    }

    setDisplay((current) => {
      const digitCount =
        current.replace(
          /[^0-9]/g,
          ""
        ).length;

      if (digitCount >= 15) {
        return current;
      }

      return current === "0"
        ? String(digit)
        : `${current}${digit}`;
    });
  };

  const inputDecimal = () => {
    setError("");
    setCopied(false);

    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }

    setDisplay((current) =>
      current.includes(".")
        ? current
        : `${current}.`
    );
  };

  const backspace = () => {
    if (waitingForOperand || error) {
      return;
    }

    setCopied(false);

    setDisplay((current) => {
      if (
        current.length <= 1 ||
        (current.length === 2 &&
          current.startsWith("-"))
      ) {
        return "0";
      }

      return current.slice(0, -1);
    });
  };

  const toggleSign = () => {
    if (error) {
      return;
    }

    setCopied(false);

    setDisplay((current) => {
      const value = Number(current);

      if (!Number.isFinite(value) || value === 0) {
        return "0";
      }

      return String(
        sanitizeNumber(value * -1)
      );
    });
  };

  const applyPercent = () => {
    if (error) {
      return;
    }

    setCopied(false);

    setDisplay((current) =>
      String(
        sanitizeNumber(
          Number(current) / 100
        )
      )
    );
  };

  const calculate = (
    left,
    right,
    selectedOperator
  ) => {
    switch (selectedOperator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        if (right === 0) {
          throw new Error(
            "No se puede dividir por cero."
          );
        }

        return left / right;
      default:
        return right;
    }
  };

  const chooseOperator = (
    nextOperator
  ) => {
    if (error) {
      clearCalculator();
      return;
    }

    const inputValue =
      Number(display);

    if (!Number.isFinite(inputValue)) {
      return;
    }

    if (
      operator &&
      storedValue !== null &&
      !waitingForOperand
    ) {
      try {
        const result = sanitizeNumber(
          calculate(
            storedValue,
            inputValue,
            operator
          )
        );

        setDisplay(String(result));
        setStoredValue(result);
        setExpression(
          `${formatDisplayNumber(result)} ${OPERATOR_LABELS[nextOperator]}`
        );
      } catch (calculationError) {
        setError(
          calculationError.message
        );
        setDisplay("0");
        setStoredValue(null);
        setOperator(null);
        setWaitingForOperand(false);
        return;
      }
    } else {
      setStoredValue(inputValue);
      setExpression(
        `${formatDisplayNumber(inputValue)} ${OPERATOR_LABELS[nextOperator]}`
      );
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
    setCopied(false);
  };

  const addHistoryItem = (
    historyExpression,
    result
  ) => {
    const nextItem = {
      id: `${Date.now()}-${Math.random()}`,
      expression:
        historyExpression,
      result,
    };

    setHistory((current) => {
      const nextHistory = [
        nextItem,
        ...current,
      ].slice(
        0,
        MAX_HISTORY_ITEMS
      );

      saveHistory(nextHistory);

      return nextHistory;
    });
  };

  const equals = () => {
    if (
      error ||
      operator === null ||
      storedValue === null
    ) {
      return;
    }

    const inputValue =
      Number(display);

    if (!Number.isFinite(inputValue)) {
      return;
    }

    try {
      const result = sanitizeNumber(
        calculate(
          storedValue,
          inputValue,
          operator
        )
      );

      const historyExpression =
        `${formatDisplayNumber(
          storedValue
        )} ${OPERATOR_LABELS[operator]} ${formatDisplayNumber(
          inputValue
        )}`;

      setDisplay(String(result));
      setExpression(
        `${historyExpression} =`
      );
      setStoredValue(null);
      setOperator(null);
      setWaitingForOperand(true);
      setCopied(false);

      addHistoryItem(
        historyExpression,
        result
      );
    } catch (calculationError) {
      setError(
        calculationError.message
      );
      setDisplay("0");
      setStoredValue(null);
      setOperator(null);
      setWaitingForOperand(false);
    }
  };

  const useHistoryResult = (
    result
  ) => {
    const value = Number(result);

    if (!Number.isFinite(value)) {
      return;
    }

    setDisplay(String(value));
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
    setExpression("Resultado recuperado");
    setError("");
    setCopied(false);
  };

  const clearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const copyResult = async () => {
    if (!Number.isFinite(numericResult)) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        String(numericResult)
      );

      setCopied(true);

      window.setTimeout(
        () => setCopied(false),
        1500
      );
    } catch {
      setCopied(false);
    }
  };

  const handleUseResult = (
    type
  ) => {
    if (!canUseResult) {
      return;
    }

    onUseResult?.(
      type,
      sanitizeNumber(numericResult)
    );
  };

  useEffect(() => {
    const handleKeyDown = (
      event
    ) => {
      const targetTag =
        event.target?.tagName?.toLowerCase();

      if (
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select"
      ) {
        return;
      }

      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        inputDigit(event.key);
        return;
      }

      if (
        event.key === "." ||
        event.key === ","
      ) {
        event.preventDefault();
        inputDecimal();
        return;
      }

      if (["+", "-", "*", "/"].includes(event.key)) {
        event.preventDefault();
        chooseOperator(event.key);
        return;
      }

      if (
        event.key === "Enter" ||
        event.key === "="
      ) {
        event.preventDefault();
        equals();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        clearCalculator();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  });

  return (
    <div
      className={styles.calculator}
    >
      <div
        className={
          styles.calculatorHeader
        }
      >
        <div>
          <h2
            className={styles.title}
          >
            Calculadora
          </h2>

          <p
            className={styles.subtitle}
          >
            Calculá un importe y registralo directamente en MoneyTrack.
          </p>
        </div>
      </div>

      <div
        className={styles.display}
        aria-live="polite"
      >
        <div
          className={styles.expression}
        >
          {error || expression || "Listo para calcular"}
        </div>

        <div
          className={`${styles.result} ${
            error
              ? styles.resultError
              : ""
          }`}
        >
          {error
            ? "Error"
            : `$ ${formatInputDisplay(
                display
              )}`}
        </div>
      </div>

      <div
        className={styles.copyRow}
      >
        <button
          type="button"
          className={styles.copyButton}
          onClick={() =>
            void copyResult()
          }
          disabled={
            !Number.isFinite(
              numericResult
            )
          }
        >
          <i
            className={`bi ${
              copied
                ? "bi-check2"
                : "bi-copy"
            }`}
          ></i>
          {copied
            ? "Copiado"
            : "Copiar resultado"}
        </button>
      </div>

      <div
        className={styles.keypad}
        aria-label="Teclado de calculadora"
      >
        <button
          type="button"
          className={`${styles.key} ${styles.utilityKey}`}
          onClick={clearCalculator}
        >
          AC
        </button>

        <button
          type="button"
          className={`${styles.key} ${styles.utilityKey}`}
          onClick={toggleSign}
        >
          +/−
        </button>

        <button
          type="button"
          className={`${styles.key} ${styles.utilityKey}`}
          onClick={applyPercent}
        >
          %
        </button>

        <button
          type="button"
          className={`${styles.key} ${styles.operatorKey}`}
          onClick={() =>
            chooseOperator("/")
          }
          aria-label="Dividir"
        >
          ÷
        </button>

        {[7, 8, 9].map(
          (digit) => (
            <button
              key={digit}
              type="button"
              className={styles.key}
              onClick={() =>
                inputDigit(digit)
              }
            >
              {digit}
            </button>
          )
        )}

        <button
          type="button"
          className={`${styles.key} ${styles.operatorKey}`}
          onClick={() =>
            chooseOperator("*")
          }
          aria-label="Multiplicar"
        >
          ×
        </button>

        {[4, 5, 6].map(
          (digit) => (
            <button
              key={digit}
              type="button"
              className={styles.key}
              onClick={() =>
                inputDigit(digit)
              }
            >
              {digit}
            </button>
          )
        )}

        <button
          type="button"
          className={`${styles.key} ${styles.operatorKey}`}
          onClick={() =>
            chooseOperator("-")
          }
          aria-label="Restar"
        >
          −
        </button>

        {[1, 2, 3].map(
          (digit) => (
            <button
              key={digit}
              type="button"
              className={styles.key}
              onClick={() =>
                inputDigit(digit)
              }
            >
              {digit}
            </button>
          )
        )}

        <button
          type="button"
          className={`${styles.key} ${styles.operatorKey}`}
          onClick={() =>
            chooseOperator("+")
          }
          aria-label="Sumar"
        >
          +
        </button>

        <button
          type="button"
          className={styles.key}
          onClick={() =>
            inputDigit(0)
          }
        >
          0
        </button>

        <button
          type="button"
          className={styles.key}
          onClick={inputDecimal}
          aria-label="Separador decimal"
        >
          ,
        </button>

        <button
          type="button"
          className={styles.key}
          onClick={backspace}
          aria-label="Borrar último dígito"
        >
          <i className="bi bi-backspace"></i>
        </button>

        <button
          type="button"
          className={`${styles.key} ${styles.equalsKey}`}
          onClick={equals}
        >
          =
        </button>
      </div>

      <section
        className={styles.useResult}
      >
        <div
          className={styles.sectionHeading}
        >
          <div>
            <strong>
              Usar este importe
            </strong>
            <span>
              Se abrirá el formulario correspondiente con el monto ya cargado.
            </span>
          </div>
        </div>

        <div
          className={styles.resultActions}
        >
          <button
            type="button"
            className={`${styles.resultAction} ${styles.incomeAction}`}
            onClick={() =>
              handleUseResult(
                "income"
              )
            }
            disabled={!canUseResult}
          >
            <i className="bi bi-plus-circle"></i>
            Ingreso
          </button>

          <button
            type="button"
            className={`${styles.resultAction} ${styles.expenseAction}`}
            onClick={() =>
              handleUseResult(
                "expense"
              )
            }
            disabled={!canUseResult}
          >
            <i className="bi bi-dash-circle"></i>
            Gasto
          </button>

          <button
            type="button"
            className={`${styles.resultAction} ${styles.savingsAction}`}
            onClick={() =>
              handleUseResult(
                "savings"
              )
            }
            disabled={!canUseResult}
          >
            <i className="bi bi-piggy-bank"></i>
            Ahorro
          </button>
        </div>

        {!canUseResult && (
          <p
            className={styles.resultHint}
          >
            El resultado debe ser mayor a $ 0 para registrarlo.
          </p>
        )}
      </section>

      <section
        className={styles.historySection}
      >
        <div
          className={styles.sectionHeading}
        >
          <div>
            <strong>
              Últimos cálculos
            </strong>
            <span>
              Tocá un resultado para volver a usarlo.
            </span>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              className={
                styles.clearHistoryButton
              }
              onClick={clearHistory}
            >
              Limpiar
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div
            className={styles.emptyHistory}
          >
            <i className="bi bi-clock-history"></i>
            <span>
              Todavía no hay cálculos guardados.
            </span>
          </div>
        ) : (
          <div
            className={styles.historyList}
          >
            {history.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.historyItem}
                onClick={() =>
                  useHistoryResult(
                    item.result
                  )
                }
              >
                <span>
                  {item.expression}
                </span>
                <strong>
                  $ {formatDisplayNumber(
                    item.result
                  )}
                </strong>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default CalculatorModal;
