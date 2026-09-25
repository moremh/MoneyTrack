import {
  formatRegionalCurrency,
} from "../../../utils/regionalSettings";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

const MONTHS = [
  "ene","feb","mar","abr","may","jun",
  "jul","ago","sep","oct","nov","dic",
];

function getDateParts(dateValue) {
  const parts = String(dateValue || "").split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  return { year, month, day };
}

function getMonthIndex(parts) {
  return parts.year * 12 + (parts.month - 1);
}

function getPartsFromMonthIndex(monthIndex) {
  return {
    year: Math.floor(monthIndex / 12),
    month: (monthIndex % 12) + 1,
  };
}

function getMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function buildDailyData({
  incomes,
  expenses,
  goalMovements,
  fromDate,
  toDate,
}) {
  const from = getDateParts(fromDate);
  const to = getDateParts(toDate);

  if (!from || !to) return [];

  const grouped = {};

  const getDayData = (day) => {
    if (!grouped[day]) {
      grouped[day] = {
        ingresos: 0,
        gastos: 0,
        ahorro: 0,
      };
    }
    return grouped[day];
  };

  incomes.forEach((income) => {
    const parts = getDateParts(income.date);

    if (
      !parts ||
      parts.year !== from.year ||
      parts.month !== from.month
    ) {
      return;
    }

    getDayData(parts.day).ingresos +=
      Number(income.amount) || 0;
  });

  expenses.forEach((expense) => {
    const parts = getDateParts(expense.date);

    if (
      !parts ||
      parts.year !== from.year ||
      parts.month !== from.month
    ) {
      return;
    }

    getDayData(parts.day).gastos +=
      Number(expense.amount) || 0;
  });

  goalMovements.forEach((movement) => {
    if (
      movement.isOpeningBalance ||
      movement.description === "Saldo inicial del objetivo"
    ) {
      return;
    }

    const parts = getDateParts(movement.date);

    if (
      !parts ||
      parts.year !== from.year ||
      parts.month !== from.month
    ) {
      return;
    }

    const amount = Number(movement.amount) || 0;

    getDayData(parts.day).ahorro +=
      movement.type === "withdrawal"
        ? -amount
        : amount;
  });

  const data = [];
  let accumulatedBalance = 0;

  for (
    let day = from.day;
    day <= to.day;
    day += 1
  ) {
    const ingresos = grouped[day]?.ingresos || 0;
    const gastos = grouped[day]?.gastos || 0;
    const ahorro = grouped[day]?.ahorro || 0;

    accumulatedBalance +=
      ingresos - gastos - ahorro;

    data.push({
      periodo: String(day),
      ingresos,
      gastos,
      balance: accumulatedBalance,
    });
  }

  return data;
}

function buildMonthlyData({
  incomes,
  expenses,
  goalMovements,
  fromDate,
  toDate,
}) {
  const grouped = {};
  const availableDates = [];

  const rememberDate = (dateValue) => {
    const parts = getDateParts(dateValue);

    if (parts) {
      availableDates.push(parts);
    }

    return parts;
  };

  const getMonthData = (parts) => {
    const key = getMonthKey(
      parts.year,
      parts.month
    );

    if (!grouped[key]) {
      grouped[key] = {
        ingresos: 0,
        gastos: 0,
        ahorro: 0,
      };
    }

    return grouped[key];
  };

  incomes.forEach((income) => {
    const parts = rememberDate(income.date);
    if (!parts) return;

    getMonthData(parts).ingresos +=
      Number(income.amount) || 0;
  });

  expenses.forEach((expense) => {
    const parts = rememberDate(expense.date);
    if (!parts) return;

    getMonthData(parts).gastos +=
      Number(expense.amount) || 0;
  });

  goalMovements.forEach((movement) => {
    if (
      movement.isOpeningBalance ||
      movement.description === "Saldo inicial del objetivo"
    ) {
      return;
    }

    const parts = rememberDate(movement.date);
    if (!parts) return;

    const amount = Number(movement.amount) || 0;

    getMonthData(parts).ahorro +=
      movement.type === "withdrawal"
        ? -amount
        : amount;
  });

  let startParts = getDateParts(fromDate);
  let endParts = getDateParts(toDate);

  if (!startParts || !endParts) {
    if (availableDates.length === 0) {
      return [];
    }

    const indexes =
      availableDates.map(getMonthIndex);

    const firstMonthIndex = Math.min(...indexes);
    const lastMonthIndex = Math.max(...indexes);

    if (!startParts) {
      startParts =
        getPartsFromMonthIndex(firstMonthIndex);
    }

    if (!endParts) {
      endParts =
        getPartsFromMonthIndex(lastMonthIndex);
    }
  }

  const startMonthIndex =
    getMonthIndex(startParts);

  const endMonthIndex =
    getMonthIndex(endParts);

  if (endMonthIndex < startMonthIndex) {
    return [];
  }

  const data = [];
  let accumulatedBalance = 0;

  for (
    let monthIndex = startMonthIndex;
    monthIndex <= endMonthIndex;
    monthIndex += 1
  ) {
    const parts =
      getPartsFromMonthIndex(monthIndex);

    const key =
      getMonthKey(parts.year, parts.month);

    const monthData =
      grouped[key] || {
        ingresos: 0,
        gastos: 0,
        ahorro: 0,
      };

    accumulatedBalance +=
      monthData.ingresos -
      monthData.gastos -
      monthData.ahorro;

    data.push({
      periodo:
        `${MONTHS[parts.month - 1]} ${parts.year}`,
      ingresos: monthData.ingresos,
      gastos: monthData.gastos,
      balance: accumulatedBalance,
    });
  }

  return data;
}

function BalanceChart({
  incomes = [],
  expenses = [],
  goalMovements = [],
  mode = "monthly",
  fromDate = "",
  toDate = "",
  settings = {},
}) {
  const data =
    mode === "daily"
      ? buildDailyData({
          incomes,
          expenses,
          goalMovements,
          fromDate,
          toDate,
        })
      : buildMonthlyData({
          incomes,
          expenses,
          goalMovements,
          fromDate,
          toDate,
        });

  const dot =
    data.length <= 1
      ? { r: 4, strokeWidth: 2 }
      : false;

  return (
    <div
      style={{
        width: "100%",
        height: 350,
      }}
    >
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="periodo"
            tick={{
              fill: "var(--text-light)",
            }}
          />

          <YAxis
            tick={{
              fill: "var(--text-light)",
            }}
          />

          <Tooltip
            formatter={(value) =>
              formatRegionalCurrency(
                value,
                settings
              )
            }
            labelFormatter={(value) =>
              mode === "daily"
                ? `Día ${value}`
                : value
            }
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "12px",
            }}
            labelStyle={{
              color: "var(--text)",
            }}
            itemStyle={{
              color: "var(--text)",
            }}
          />

          <Legend
            wrapperStyle={{
              color: "var(--text)",
            }}
          />

          <Line
            type="monotone"
            dataKey="ingresos"
            stroke="#22c55e"
            strokeWidth={3}
            name="Ingresos"
            dot={dot}
            activeDot={{ r: 5 }}
          />

          <Line
            type="monotone"
            dataKey="gastos"
            stroke="#ef4444"
            strokeWidth={3}
            name="Gastos"
            dot={dot}
            activeDot={{ r: 5 }}
          />

          <Line
            type="monotone"
            dataKey="balance"
            stroke="#2563eb"
            strokeWidth={3}
            name="Balance"
            dot={dot}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BalanceChart;
