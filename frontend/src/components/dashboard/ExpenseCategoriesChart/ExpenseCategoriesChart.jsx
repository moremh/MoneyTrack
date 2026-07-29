import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import styles from "./ExpenseCategoriesChart.module.css";

const CATEGORY_COLORS = {
  Colectivo: "#8b5cf6",
  Comida: "#2563eb",
  Compras: "#ef4444",
  IA: "#f59e0b",
  Martin: "#06b6d4",
  Uber: "#22c55e",
};

const FALLBACK_COLORS = [
  "#2563eb",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
];

function ExpenseCategoriesChart({ expenses = [] }) {
  const grouped = expenses.reduce((acc, expense) => {
    const category = expense.category || "General";

    if (!acc[category]) {
      acc[category] = 0;
    }

    acc[category] += Number(expense.amount);

    return acc;
  }, {});

  const data = Object.entries(grouped)
    .map(([category, total], index) => ({
      category,
      total,
      color:
        CATEGORY_COLORS[category] ||
        FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    }))
    .sort((a, b) => b.total - a.total);

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        Todavía no hay gastos cargados para mostrar por categoría.
      </div>
    );
  }

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
        >
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />

          <XAxis
            type="number"
            tick={{ fill: "var(--text-light)" }}
            tickFormatter={(value) => `$ ${value.toLocaleString("es-AR")}`}
          />

          <YAxis
            type="category"
            dataKey="category"
            width={110}
            tick={{ fill: "var(--text-light)" }}
          />

          <Tooltip
            formatter={(value) => `$ ${Number(value).toLocaleString("es-AR")}`}
            contentStyle={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
              borderRadius: "12px",
            }}
          />

          <Bar dataKey="total" radius={[0, 8, 8, 0]}>
            {data.map((entry, index) => (
              <Cell key={entry.category || index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ExpenseCategoriesChart;