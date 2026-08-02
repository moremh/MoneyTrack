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

const formatCurrency = (value) =>
  `$ ${Number(value || 0).toLocaleString(
    "es-AR"
  )}`;

function CategoryTooltip({
  active,
  payload,
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  const item =
    payload[0]?.payload;

  if (!item) {
    return null;
  }

  return (
    <div
      className={
        styles.tooltip
      }
    >
      <strong>
        {item.category}
      </strong>

      <span>
        Total:{" "}
        {formatCurrency(
          item.total
        )}
      </span>
    </div>
  );
}

function ExpenseCategoriesChart({
  expenses = [],
}) {
  const grouped =
    expenses.reduce(
      (accumulator, expense) => {
        const category =
          expense.category ||
          "General";

        if (
          !accumulator[
            category
          ]
        ) {
          accumulator[
            category
          ] = 0;
        }

        accumulator[
          category
        ] += Number(
          expense.amount
        );

        return accumulator;
      },
      {}
    );

  const data =
    Object.entries(grouped)
      .map(
        (
          [category, total],
          index
        ) => ({
          category,
          total,

          color:
            CATEGORY_COLORS[
              category
            ] ||
            FALLBACK_COLORS[
              index %
                FALLBACK_COLORS.length
            ],
        })
      )
      .sort(
        (first, second) =>
          second.total -
          first.total
      );

  if (data.length === 0) {
    return (
      <div
        className={
          styles.emptyState
        }
      >
        Todavía no hay gastos
        cargados para mostrar por
        categoría.
      </div>
    );
  }

  return (
    <div
      className={
        styles.chartWrapper
      }
    >
      <ResponsiveContainer
        width="100%"
        height={320}
      >
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 10,
            right: 20,
            left: 10,
            bottom: 10,
          }}
        >
          <CartesianGrid
            stroke="var(--chart-grid)"
            strokeDasharray="3 3"
          />

          <XAxis
            type="number"
            tick={{
              fill:
                "var(--text-light)",
            }}
            tickFormatter={
              formatCurrency
            }
          />

          <YAxis
            type="category"
            dataKey="category"
            width={110}
            tick={{
              fill:
                "var(--text-light)",
            }}
          />

          <Tooltip
            content={
              <CategoryTooltip />
            }
            cursor={{
              fill:
                "rgba(148, 163, 184, 0.12)",
            }}
          />

          <Bar
            dataKey="total"
            radius={[
              0,
              8,
              8,
              0,
            ]}
          >
            {data.map(
              (
                entry,
                index
              ) => (
                <Cell
                  key={
                    entry.category ||
                    index
                  }
                  fill={
                    entry.color
                  }
                />
              )
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ExpenseCategoriesChart;
