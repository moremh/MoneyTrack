import { useContext, useMemo, useState } from "react";
import { FinanceContext } from "../../context/FinanceContext";
import styles from "./Reports.module.css";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

const MONTH_LABELS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

const PIE_COLORS = [
  "#2563eb",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#f97316",
];

function Reports() {
  const { incomes, expenses } = useContext(FinanceContext);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredIncomes = useMemo(() => {
    return incomes.filter((item) => {
      if (fromDate && item.date < fromDate) return false;
      if (toDate && item.date > toDate) return false;
      return true;
    });
  }, [incomes, fromDate, toDate]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      if (fromDate && item.date < fromDate) return false;
      if (toDate && item.date > toDate) return false;
      return true;
    });
  }, [expenses, fromDate, toDate]);

  const totalIncome = filteredIncomes.reduce(
    (acc, item) => acc + Number(item.amount),
    0
  );

  const totalExpenses = filteredExpenses.reduce(
    (acc, item) => acc + Number(item.amount),
    0
  );

  const balance = totalIncome - totalExpenses;
  const totalMovements = filteredIncomes.length + filteredExpenses.length;

  const monthlyData = useMemo(() => {
    const grouped = {};

    filteredIncomes.forEach((item) => {
      const monthIndex = Number(item.date.split("-")[1]) - 1;
      const monthLabel = MONTH_LABELS[monthIndex];

      if (!grouped[monthLabel]) {
        grouped[monthLabel] = { ingresos: 0, gastos: 0 };
      }

      grouped[monthLabel].ingresos += Number(item.amount);
    });

    filteredExpenses.forEach((item) => {
      const monthIndex = Number(item.date.split("-")[1]) - 1;
      const monthLabel = MONTH_LABELS[monthIndex];

      if (!grouped[monthLabel]) {
        grouped[monthLabel] = { ingresos: 0, gastos: 0 };
      }

      grouped[monthLabel].gastos += Number(item.amount);
    });

    return MONTH_LABELS.map((month) => ({
      mes: month,
      ingresos: grouped[month]?.ingresos || 0,
      gastos: grouped[month]?.gastos || 0,
    }));
  }, [filteredIncomes, filteredExpenses]);

  const expenseCategoriesData = useMemo(() => {
    const grouped = {};

    filteredExpenses.forEach((item) => {
      const category = item.category || "General";

      if (!grouped[category]) {
        grouped[category] = 0;
      }

      grouped[category] += Number(item.amount);
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredExpenses]);

  const clearFilters = () => {
    setFromDate("");
    setToDate("");
  };

  const formatCurrency = (value) =>
    `$ ${Number(value).toLocaleString("es-AR")}`;

  const formatDate = (date) => date.split("-").reverse().join("/");

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const summaryData = [
      { Métrica: "Desde", Valor: fromDate ? formatDate(fromDate) : "Sin filtro" },
      { Métrica: "Hasta", Valor: toDate ? formatDate(toDate) : "Sin filtro" },
      { Métrica: "Ingresos del período", Valor: totalIncome },
      { Métrica: "Gastos del período", Valor: totalExpenses },
      { Métrica: "Balance del período", Valor: balance },
      { Métrica: "Movimientos analizados", Valor: totalMovements },
    ];

    const incomesData = filteredIncomes.map((item) => ({
      Descripción: item.description,
      Categoría: item.category || "General",
      Fecha: formatDate(item.date),
      Monto: Number(item.amount),
    }));

    const expensesData = filteredExpenses.map((item) => ({
      Descripción: item.description,
      Categoría: item.category || "General",
      Fecha: formatDate(item.date),
      Monto: Number(item.amount),
    }));

    const categoriesData = expenseCategoriesData.map((item) => ({
      Categoría: item.name,
      Total: Number(item.value),
    }));

    const monthlySheetData = monthlyData.map((item) => ({
      Mes: item.mes,
      Ingresos: Number(item.ingresos),
      Gastos: Number(item.gastos),
    }));

    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    const incomesSheet = XLSX.utils.json_to_sheet(incomesData);
    const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
    const categoriesSheet = XLSX.utils.json_to_sheet(categoriesData);
    const monthlySheet = XLSX.utils.json_to_sheet(monthlySheetData);

    summarySheet["!cols"] = [{ wch: 24 }, { wch: 18 }];
    incomesSheet["!cols"] = [
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
    ];
    expensesSheet["!cols"] = [
      { wch: 28 },
      { wch: 20 },
      { wch: 14 },
      { wch: 16 },
    ];
    categoriesSheet["!cols"] = [{ wch: 24 }, { wch: 18 }];
    monthlySheet["!cols"] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 16 },
    ];

    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumen");
    XLSX.utils.book_append_sheet(workbook, incomesSheet, "Ingresos");
    XLSX.utils.book_append_sheet(workbook, expensesSheet, "Gastos");
    XLSX.utils.book_append_sheet(workbook, categoriesSheet, "Categorias");
    XLSX.utils.book_append_sheet(workbook, monthlySheet, "Mensual");

    XLSX.writeFile(workbook, "reporte-moneytrack.xlsx");
  };

  const addPdfHeader = (doc, title, subtitle = "") => {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(title, 14, 16);

    if (subtitle) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(subtitle, 14, 23);
    }

    doc.setTextColor(33, 37, 41);
  };

  const addPdfFooter = (doc) => {
    const pageCount = doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i += 1) {
      doc.setPage(i);
      doc.setDrawColor(220, 220, 220);
      doc.line(14, 287, 196, 287);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`MoneyTrack · Página ${i} de ${pageCount}`, 14, 292);
    }
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString("es-AR");

    addPdfHeader(
      doc,
      "Reporte financiero",
      `Generado el ${generatedAt}`
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(70, 70, 70);
    doc.text(
      `Período: ${fromDate ? formatDate(fromDate) : "Sin filtro"} a ${
        toDate ? formatDate(toDate) : "Sin filtro"
      }`,
      14,
      38
    );

    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 46, 182, 34, 4, 4, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Resumen general", 18, 55);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Ingresos: ${formatCurrency(totalIncome)}`, 18, 64);
    doc.text(`Gastos: ${formatCurrency(totalExpenses)}`, 78, 64);
    doc.text(`Balance: ${formatCurrency(balance)}`, 132, 64);
    doc.text(`Movimientos: ${totalMovements}`, 18, 73);

    autoTable(doc, {
      startY: 90,
      head: [["Métrica", "Valor"]],
      body: [
        ["Desde", fromDate ? formatDate(fromDate) : "Sin filtro"],
        ["Hasta", toDate ? formatDate(toDate) : "Sin filtro"],
        ["Ingresos del período", formatCurrency(totalIncome)],
        ["Gastos del período", formatCurrency(totalExpenses)],
        ["Balance del período", formatCurrency(balance)],
        ["Movimientos analizados", String(totalMovements)],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 40,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [["Categoría", "Total"]],
      body:
        expenseCategoriesData.length > 0
          ? expenseCategoriesData.map((item) => [
              item.name,
              formatCurrency(item.value),
            ])
          : [["Sin datos", "-"]],
      theme: "grid",
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 40,
      },
      alternateRowStyles: {
        fillColor: [255, 251, 235],
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
    });

    doc.addPage();
    addPdfHeader(doc, "Ingresos filtrados");

    autoTable(doc, {
      startY: 36,
      head: [["Descripción", "Categoría", "Fecha", "Monto"]],
      body:
        filteredIncomes.length > 0
          ? filteredIncomes.map((item) => [
              item.description,
              item.category || "General",
              formatDate(item.date),
              formatCurrency(item.amount),
            ])
          : [["Sin ingresos", "-", "-", "-"]],
      theme: "grid",
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 40,
      },
      alternateRowStyles: {
        fillColor: [240, 253, 244],
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
    });

    doc.addPage();
    addPdfHeader(doc, "Gastos filtrados");

    autoTable(doc, {
      startY: 36,
      head: [["Descripción", "Categoría", "Fecha", "Monto"]],
      body:
        filteredExpenses.length > 0
          ? filteredExpenses.map((item) => [
              item.description,
              item.category || "General",
              formatDate(item.date),
              formatCurrency(item.amount),
            ])
          : [["Sin gastos", "-", "-", "-"]],
      theme: "grid",
      headStyles: {
        fillColor: [239, 68, 68],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        textColor: 40,
      },
      alternateRowStyles: {
        fillColor: [254, 242, 242],
      },
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
    });

    addPdfFooter(doc);
    doc.save("reporte-moneytrack.pdf");
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Reportes</h1>
        <p className={styles.subtitle}>
          Analiza tus ingresos, gastos y resultados según el período elegido.
        </p>
      </div>

      <section className={styles.filtersCard}>
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label>Desde</label>
            <input
              className={styles.filterInput}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div className={styles.filterGroup}>
            <label>Hasta</label>
            <input
              className={styles.filterInput}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div className={styles.filterActions}>
            <button
              className={styles.clearButton}
              type="button"
              onClick={clearFilters}
            >
              Limpiar filtros
            </button>

            <button
              className={styles.exportButton}
              type="button"
              onClick={exportToExcel}
            >
              <i className="bi bi-file-earmark-excel"></i>
              Exportar Excel
            </button>

            <button
              className={`${styles.exportButton} ${styles.pdfButton}`}
              type="button"
              onClick={exportToPDF}
            >
              <i className="bi bi-file-earmark-pdf"></i>
              Exportar PDF
            </button>
          </div>
        </div>
      </section>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.label}>Ingresos del período</span>
          <h3 className={styles.value}>{formatCurrency(totalIncome)}</h3>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.label}>Gastos del período</span>
          <h3 className={styles.value}>{formatCurrency(totalExpenses)}</h3>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.label}>Balance del período</span>
          <h3 className={styles.value}>{formatCurrency(balance)}</h3>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.label}>Movimientos analizados</span>
          <h3 className={styles.value}>{totalMovements}</h3>
        </article>
      </section>

      <section className={styles.chartCard}>
        <h2 className={styles.cardTitle}>Ingresos vs gastos por mes</h2>

        <div className={styles.chartBox}>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar
                dataKey="ingresos"
                name="Ingresos"
                fill="#22c55e"
                radius={[8, 8, 0, 0]}
              />

              <Bar
                dataKey="gastos"
                name="Gastos"
                fill="#ef4444"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Distribución de gastos por categoría</h2>

          {expenseCategoriesData.length === 0 ? (
            <div className={styles.emptyState}>
              No hay gastos en el período seleccionado.
            </div>
          ) : (
            <div className={styles.chartBox}>
              <ResponsiveContainer
  width="100%"
  height={340}
>
  <PieChart>
    <Pie
      data={
        expenseCategoriesData
      }
      dataKey="value"
      nameKey="name"
      cx="50%"
      cy="50%"
      outerRadius={110}
      label={false}
      labelLine={false}
    >
      {expenseCategoriesData.map(
        (entry, index) => (
          <Cell
            key={entry.name}
            fill={
              PIE_COLORS[
                index %
                  PIE_COLORS.length
              ]
            }
          />
        )
      )}
    </Pie>

    <Tooltip
      formatter={(
        value,
        name,
        item
      ) => [
        formatCurrency(value),
        item?.payload?.name ||
          name,
      ]}
    />

    <Legend />
  </PieChart>
</ResponsiveContainer>
            </div>
          )}
        </article>

        <article className={styles.chartCard}>
          <h2 className={styles.cardTitle}>Resumen por categoría</h2>

          {expenseCategoriesData.length === 0 ? (
            <div className={styles.emptyState}>
              No hay categorías para mostrar.
            </div>
          ) : (
            <div className={styles.categoryList}>
              {expenseCategoriesData.map((item) => (
                <div key={item.name} className={styles.categoryItem}>
                  <span className={styles.categoryName}>{item.name}</span>
                  <span className={styles.categoryValue}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

export default Reports;