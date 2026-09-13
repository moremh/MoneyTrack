import { useContext } from "react";

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

import { FinanceContext } from "../../../context/FinanceContext";

import {
  getCategoryDisplayColor,
  getCategoryDisplayIcon,
  getContrastTextColor,
} from "../../../utils/categoryCustomization";

import styles from "./ExpenseCategoriesChart.module.css";

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
    <div className={styles.tooltip}>
      <div className={styles.tooltipTitle}>
        <span
          className={styles.tooltipIcon}
          style={{
            "--category-color": item.color,
            "--category-text":
              getContrastTextColor(
                item.color
              ),
          }}
        >
          <i className={item.icon}></i>
        </span>

        <strong>
          {item.category}
        </strong>
      </div>

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
  const financeContext =
    useContext(FinanceContext);

  const categoryRecords =
    financeContext?.categoryRecords || [];

  const categoryByName =
    new Map(
      categoryRecords
        .filter(
          (category) =>
            category.type === "expense"
        )
        .map((category) => [
          category.name.toLowerCase(),
          category,
        ])
    );

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
        ([category, total]) => {
          const savedCategory =
            categoryByName.get(
              category.toLowerCase()
            ) || {
              name: category,
              type: "expense",
            };

          return {
            category,
            total,
            color:
              getCategoryDisplayColor(
                savedCategory
              ),
            icon:
              getCategoryDisplayIcon(
                savedCategory,
                "expense"
              ),
          };
        }
      )
      .sort(
        (first, second) =>
          second.total -
          first.total
      );

  const chartHeight = Math.max(
    320,
    data.length * 44
  );

  if (data.length === 0) {
    return (
      <div className={styles.emptyState}>
        Todavía no hay gastos
        cargados para mostrar por
        categoría.
      </div>
    );
  }

  return (
    <div className={styles.chartWrapper}>
      <ResponsiveContainer
        width="100%"
        height={chartHeight}
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
            width={120}
            interval={0}
            tick={{
              fill:
                "var(--text-light)",
              fontSize: 14,
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
              (entry, index) => (
                <Cell
                  key={
                    entry.category ||
                    index
                  }
                  fill={entry.color}
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
