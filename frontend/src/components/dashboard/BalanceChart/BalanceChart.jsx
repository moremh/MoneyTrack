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

function BalanceChart({ incomes = [], expenses = [] }) {
  const grouped = {};

  incomes.forEach((inc) => {
    const date = new Date(inc.date);
    const month = date
      .toLocaleString("es-AR", { month: "short" })
      .replace(".", "");

    if (!grouped[month]) {
      grouped[month] = { ingresos: 0, gastos: 0 };
    }

    grouped[month].ingresos += Number(inc.amount);
  });

  expenses.forEach((exp) => {
    const date = new Date(exp.date);
    const month = date
      .toLocaleString("es-AR", { month: "short" })
      .replace(".", "");

    if (!grouped[month]) {
      grouped[month] = { ingresos: 0, gastos: 0 };
    }

    grouped[month].gastos += Number(exp.amount);
  });

  const months = [
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

  const data = months.map((month) => {
    const ingresos = grouped[month]?.ingresos || 0;
    const gastos = grouped[month]?.gastos || 0;

    return {
      mes: month,
      ingresos,
      gastos,
      balance: ingresos - gastos,
    };
  });

  return (
    <div style={{ width: "100%", height: 350 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={{ fill: "var(--text-light)" }} />
          <YAxis tick={{ fill: "var(--text-light)" }} />
          <Tooltip
            formatter={(value) =>
              `$ ${Number(value).toLocaleString("es-AR")}`
            }
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "12px",
            }}
          />
          <Legend wrapperStyle={{ color: "var(--text)" }} />

          <Line
            type="monotone"
            dataKey="ingresos"
            stroke="#22c55e"
            strokeWidth={3}
            name="ingresos"
          />

          <Line
            type="monotone"
            dataKey="gastos"
            stroke="#ef4444"
            strokeWidth={3}
            name="gastos"
          />

          <Line
            type="monotone"
            dataKey="balance"
            stroke="#2563eb"
            strokeWidth={3}
            name="balance"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BalanceChart;