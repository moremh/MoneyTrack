import {
  getLocale,
} from "./regionalSettings";

const MAX_DECIMAL_DIGITS = 2;

const getSeparators = (
  settings = {}
) => {
  const locale =
    getLocale(
      settings.language,
      settings.region
    );

  try {
    const parts =
      new Intl.NumberFormat(
        locale,
        {
          useGrouping: true,
          minimumFractionDigits: 1,
        }
      ).formatToParts(
        1000.1
      );

    return {
      locale,
      group:
        parts.find(
          (part) =>
            part.type === "group"
        )?.value || ".",
      decimal:
        parts.find(
          (part) =>
            part.type === "decimal"
        )?.value || ",",
    };
  } catch {
    return {
      locale: "es-AR",
      group: ".",
      decimal: ",",
    };
  }
};

const escapeRegExp = (
  value
) =>
  String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

export function formatAmountInput(
  nextValue,
  previousValue = "",
  settings = {}
) {
  const {
    group,
    decimal,
  } = getSeparators(
    settings
  );

  let cleanValue =
    String(
      nextValue ?? ""
    )
      .replace(/\s/g, "")
      .replace(/[^\d.,]/g, "");

  if (!cleanValue) {
    return "";
  }

  const alternateDecimal =
    decimal === ","
      ? "."
      : ",";

  let decimalIndex =
    cleanValue.lastIndexOf(
      decimal
    );

  if (
    decimalIndex < 0
  ) {
    const alternateIndex =
      cleanValue.lastIndexOf(
        alternateDecimal
      );

    if (
      alternateIndex >= 0
    ) {
      const digitsAfter =
        cleanValue.length -
        alternateIndex -
        1;

      const previousHadGroup =
        String(
          previousValue || ""
        ).includes(
          alternateDecimal
        );

      if (
        digitsAfter <=
          MAX_DECIMAL_DIGITS &&
        (
          cleanValue.endsWith(
            alternateDecimal
          ) ||
          !previousHadGroup
        )
      ) {
        decimalIndex =
          alternateIndex;
      }
    }
  }

  const integerSource =
    decimalIndex >= 0
      ? cleanValue.slice(
          0,
          decimalIndex
        )
      : cleanValue;

  const decimalSource =
    decimalIndex >= 0
      ? cleanValue.slice(
          decimalIndex + 1
        )
      : "";

  let integerDigits =
    integerSource
      .replace(/[.,]/g, "")
      .replace(
        /^0+(?=\d)/,
        ""
      );

  if (
    !integerDigits &&
    decimalIndex >= 0
  ) {
    integerDigits = "0";
  }

  const decimalDigits =
    decimalSource
      .replace(/\D/g, "")
      .slice(
        0,
        MAX_DECIMAL_DIGITS
      );

  const formattedInteger =
    integerDigits.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      group
    );

  if (
    decimalIndex >= 0
  ) {
    return (
      `${formattedInteger}` +
      `${decimal}` +
      `${decimalDigits}`
    );
  }

  return formattedInteger;
}

export function parseAmountInput(
  value,
  settings = {}
) {
  const cleanValue =
    String(
      value ?? ""
    ).trim();

  if (!cleanValue) {
    return Number.NaN;
  }

  const {
    group,
    decimal,
  } = getSeparators(
    settings
  );

  const groupRegex =
    new RegExp(
      escapeRegExp(
        group
      ),
      "g"
    );

  const decimalRegex =
    new RegExp(
      escapeRegExp(
        decimal
      ),
      "g"
    );

  const normalizedValue =
    cleanValue
      .replace(
        groupRegex,
        ""
      )
      .replace(
        decimalRegex,
        "."
      )
      .replace(
        /[^\d.-]/g,
        ""
      );

  const numericValue =
    Number(
      normalizedValue
    );

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : Number.NaN;
}

export function formatStoredAmount(
  value,
  settings = {}
) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "";
  }

  const locale =
    getLocale(
      settings.language,
      settings.region
    );

  return numericValue.toLocaleString(
    locale,
    {
      useGrouping: true,
      maximumFractionDigits:
        MAX_DECIMAL_DIGITS,
    }
  );
}

export function normalizeAmountOnBlur(
  value,
  settings = {}
) {
  const numericValue =
    parseAmountInput(
      value,
      settings
    );

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return value;
  }

  return formatStoredAmount(
    numericValue,
    settings
  );
}
