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
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function getDateParts(
  dateValue
) {
  const parts = String(
    dateValue || ""
  ).split("-");

  if (parts.length !== 3) {
    return null;
  }

  const year =
    Number(parts[0]);

  const month =
    Number(parts[1]);

  const day =
    Number(parts[2]);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
  };
}

function buildDailyData({
  incomes,
  expenses,
  goalMovements,
  fromDate,
  toDate,
}) {
  const from =
    getDateParts(fromDate);

  const to =
    getDateParts(toDate);

  if (!from || !to) {
    return [];
  }

  const grouped = {};

  const getDayData = (
    day
  ) => {
    if (!grouped[day]) {
      grouped[day] = {
        ingresos: 0,
        gastos: 0,
        ahorro: 0,
      };
    }

    return grouped[day];
  };

  incomes.forEach(
    (income) => {
      const parts =
        getDateParts(
          income.date
        );

      if (
        !parts ||
        parts.year !==
          from.year ||
        parts.month !==
          from.month
      ) {
        return;
      }

      getDayData(
        parts.day
      ).ingresos +=
        Number(
          income.amount
        ) || 0;
    }
  );

  expenses.forEach(
    (expense) => {
      const parts =
        getDateParts(
          expense.date
        );

      if (
        !parts ||
        parts.year !==
          from.year ||
        parts.month !==
          from.month
      ) {
        return;
      }

      getDayData(
        parts.day
      ).gastos +=
        Number(
          expense.amount
        ) || 0;
    }
  );

  goalMovements.forEach(
    (movement) => {
      if (
        movement.isOpeningBalance ||
        movement.description ===
          "Saldo inicial del objetivo"
      ) {
        return;
      }

      const parts =
        getDateParts(
          movement.date
        );

      if (
        !parts ||
        parts.year !==
          from.year ||
        parts.month !==
          from.month
      ) {
        return;
      }

      const amount =
        Number(
          movement.amount
        ) || 0;

      /*
       * Depósito:
       * reduce dinero disponible.
       *
       * Retiro:
       * devuelve dinero disponible.
       */
      getDayData(
        parts.day
      ).ahorro +=
        movement.type ===
        "withdrawal"
          ? -amount
          : amount;
    }
  );

  const data = [];

  let accumulatedBalance = 0;

  for (
    let day = from.day;
    day <= to.day;
    day += 1
  ) {
    const ingresos =
      grouped[day]
        ?.ingresos || 0;

    const gastos =
      grouped[day]
        ?.gastos || 0;

    const ahorro =
      grouped[day]
        ?.ahorro || 0;

    accumulatedBalance +=
      ingresos -
      gastos -
      ahorro;

    data.push({
      periodo:
        String(day),

      ingresos,

      gastos,

      balance:
        accumulatedBalance,
    });
  }

  return data;
}

function buildMonthlyData({
  incomes,
  expenses,
  goalMovements,
}) {
  const grouped = {};

  const getMonthData = (
    parts
  ) => {
    const key =
      `${parts.year}-${String(
        parts.month
      ).padStart(2, "0")}`;

    if (!grouped[key]) {
      grouped[key] = {
        year:
          parts.year,

        month:
          parts.month,

        ingresos: 0,

        gastos: 0,

        ahorro: 0,
      };
    }

    return grouped[key];
  };

  incomes.forEach(
    (income) => {
      const parts =
        getDateParts(
          income.date
        );

      if (!parts) {
        return;
      }

      getMonthData(
        parts
      ).ingresos +=
        Number(
          income.amount
        ) || 0;
    }
  );

  expenses.forEach(
    (expense) => {
      const parts =
        getDateParts(
          expense.date
        );

      if (!parts) {
        return;
      }

      getMonthData(
        parts
      ).gastos +=
        Number(
          expense.amount
        ) || 0;
    }
  );

  goalMovements.forEach(
    (movement) => {
      if (
        movement.isOpeningBalance ||
        movement.description ===
          "Saldo inicial del objetivo"
      ) {
        return;
      }

      const parts =
        getDateParts(
          movement.date
        );

      if (!parts) {
        return;
      }

      const amount =
        Number(
          movement.amount
        ) || 0;

      getMonthData(
        parts
      ).ahorro +=
        movement.type ===
        "withdrawal"
          ? -amount
          : amount;
    }
  );

  return Object.values(
    grouped
  )
    .sort((a, b) => {
      if (
        a.year !== b.year
      ) {
        return (
          a.year -
          b.year
        );
      }

      return (
        a.month -
        b.month
      );
    })
    .map((item) => ({
      periodo:
        `${MONTHS[
          item.month - 1
        ]} ${item.year}`,

      ingresos:
        item.ingresos,

      gastos:
        item.gastos,

      balance:
        item.ingresos -
        item.gastos -
        item.ahorro,
    }));
}

function BalanceChart({
  incomes = [],
  expenses = [],
  goalMovements = [],
  mode = "monthly",
  fromDate = "",
  toDate = "",
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
        });

  return (
    <div
      style={{
        width: "100%",
        height: 350,
      }}
    >
      <ResponsiveContainer>
        <LineChart
          data={data}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="periodo"
            tick={{
              fill:
                "var(--text-light)",
            }}
          />

          <YAxis
            tick={{
              fill:
                "var(--text-light)",
            }}
          />

          <Tooltip
            formatter={(value) =>
              `$ ${Number(
                value
              ).toLocaleString(
                "es-AR"
              )}`
            }
            labelFormatter={(
              value
            ) =>
              mode === "daily"
                ? `Día ${value}`
                : value
            }
            contentStyle={{
              backgroundColor:
                "var(--surface)",
              border:
                "1px solid var(--border)",
              color:
                "var(--text)",
              borderRadius:
                "12px",
            }}
            labelStyle={{
              color:
                "var(--text)",
            }}
            itemStyle={{
              color:
                "var(--text)",
            }}
          />

          <Legend
            wrapperStyle={{
              color:
                "var(--text)",
            }}
          />

          <Line
            type="monotone"
            dataKey="ingresos"
            stroke="#22c55e"
            strokeWidth={3}
            name="Ingresos"
          />

          <Line
            type="monotone"
            dataKey="gastos"
            stroke="#ef4444"
            strokeWidth={3}
            name="Gastos"
          />

          <Line
            type="monotone"
            dataKey="balance"
            stroke="#2563eb"
            strokeWidth={3}
            name="Balance"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BalanceChart;