const GROUP_SEPARATOR = ".";
const DECIMAL_SEPARATOR = ",";
const MAX_DECIMAL_DIGITS = 2;

function countCharacter(value, character) {
  return String(value)
    .split(character)
    .length - 1;
}

export function formatAmountInput(
  nextValue,
  previousValue = ""
) {
  let cleanValue = String(
    nextValue ?? ""
  )
    .replace(/\s/g, "")
    .replace(/[^\d.,]/g, "");

  if (!cleanValue) {
    return "";
  }

  const nextDotCount =
    countCharacter(
      cleanValue,
      GROUP_SEPARATOR
    );

  const previousDotCount =
    countCharacter(
      previousValue,
      GROUP_SEPARATOR
    );

  const typedDecimalPoint =
    !cleanValue.includes(
      DECIMAL_SEPARATOR
    ) &&
    cleanValue.endsWith(
      GROUP_SEPARATOR
    ) &&
    nextDotCount >
      previousDotCount;

  if (typedDecimalPoint) {
    cleanValue = `${cleanValue.slice(
      0,
      -1
    )}${DECIMAL_SEPARATOR}`;
  }

  const decimalSeparatorIndex =
    cleanValue.indexOf(
      DECIMAL_SEPARATOR
    );

  const hasDecimalSeparator =
    decimalSeparatorIndex >= 0;

  const rawIntegerPart =
    hasDecimalSeparator
      ? cleanValue.slice(
          0,
          decimalSeparatorIndex
        )
      : cleanValue;

  const rawDecimalPart =
    hasDecimalSeparator
      ? cleanValue.slice(
          decimalSeparatorIndex + 1
        )
      : "";

  let integerPart =
    rawIntegerPart
      .replace(/[.,]/g, "")
      .replace(/^0+(?=\d)/, "");

  const decimalPart =
    rawDecimalPart
      .replace(/\D/g, "")
      .slice(
        0,
        MAX_DECIMAL_DIGITS
      );

  if (
    !integerPart &&
    hasDecimalSeparator
  ) {
    integerPart = "0";
  }

  const formattedInteger =
    integerPart.replace(
      /\B(?=(\d{3})+(?!\d))/g,
      GROUP_SEPARATOR
    );

  if (hasDecimalSeparator) {
    return `${formattedInteger}${DECIMAL_SEPARATOR}${decimalPart}`;
  }

  return formattedInteger;
}

export function parseAmountInput(value) {
  const cleanValue = String(
    value ?? ""
  ).trim();

  if (!cleanValue) {
    return Number.NaN;
  }

  const normalizedValue =
    cleanValue
      .replace(/\./g, "")
      .replace(",", ".");

  const numericValue = Number(
    normalizedValue
  );

  return Number.isFinite(
    numericValue
  )
    ? numericValue
    : Number.NaN;
}

export function formatStoredAmount(value) {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return "";
  }

  const numericValue = Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return "";
  }

  return numericValue.toLocaleString(
    "es-AR",
    {
      useGrouping: true,
      maximumFractionDigits:
        MAX_DECIMAL_DIGITS,
    }
  );
}

export function normalizeAmountOnBlur(
  value
) {
  const numericValue =
    parseAmountInput(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return value;
  }

  return formatStoredAmount(
    numericValue
  );
}
