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

function getMonthFromDateString(dateValue) {
  const dateParts = String(
    dateValue || ""
  ).split("-");

  const monthIndex =
    Number(dateParts[1]) - 1;

  if (
    !Number.isInteger(
      monthIndex
    ) ||
    monthIndex < 0 ||
    monthIndex >
      MONTHS.length - 1
  ) {
    return null;
  }

  return MONTHS[monthIndex];
}

function BalanceChart({
  incomes = [],
  expenses = [],
}) {
  const grouped = {};

  incomes.forEach((income) => {
    const month =
      getMonthFromDateString(
        income.date
      );

    if (!month) {
      return;
    }

    if (!grouped[month]) {
      grouped[month] = {
        ingresos: 0,
        gastos: 0,
      };
    }

    grouped[month].ingresos +=
      Number(income.amount) || 0;
  });

  expenses.forEach((expense) => {
    const month =
      getMonthFromDateString(
        expense.date
      );

    if (!month) {
      return;
    }

    if (!grouped[month]) {
      grouped[month] = {
        ingresos: 0,
        gastos: 0,
      };
    }

    grouped[month].gastos +=
      Number(expense.amount) || 0;
  });

  const data = MONTHS.map(
    (month) => {
      const ingresos =
        grouped[month]?.ingresos ||
        0;

      const gastos =
        grouped[month]?.gastos ||
        0;

      return {
        mes: month,
        ingresos,
        gastos,
        balance:
          ingresos - gastos,
      };
    }
  );

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
            dataKey="mes"
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