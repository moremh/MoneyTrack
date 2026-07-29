import { useContext, useMemo, useState } from "react";
import { FinanceContext } from "../../context/FinanceContext";

import styles from "./Dashboard.module.css";

import StatCard from "../../components/dashboard/StatCard/StatCard";
import BalanceChart from "../../components/dashboard/BalanceChart/BalanceChart";
import ExpenseCategoriesChart from "../../components/dashboard/ExpenseCategoriesChart/ExpenseCategoriesChart";
import SavingsGoals from "../../components/dashboard/SavingsGoals/SavingsGoals";

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateString) {
  return dateString.split("-").reverse().join("/");
}

function getToday() {
  return formatLocalDate(new Date());
}

function getMonthStart() {
  const date = new Date();
  date.setDate(1);
  return formatLocalDate(date);
}

function getMonthsAgoStart(monthsAgo) {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - monthsAgo);
  return formatLocalDate(date);
}

function getYearStart() {
  const date = new Date();
  date.setMonth(0);
  date.setDate(1);
  return formatLocalDate(date);
}

function Dashboard() {
  const { incomes, expenses, goals, settings } = useContext(FinanceContext);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activePreset, setActivePreset] = useState("all");

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

  const totalGoalSavings = goals.reduce(
    (acc, goal) => acc + Number(goal.currentAmount || 0),
    0
  );

  const balance = totalIncome - totalExpenses;
  const totalMovements = filteredIncomes.length + filteredExpenses.length;

  const periodText = useMemo(() => {
    if (fromDate && toDate) {
      return `Período seleccionado: ${formatDisplayDate(fromDate)} - ${formatDisplayDate(toDate)}`;
    }

    if (fromDate) {
      return `Período desde: ${formatDisplayDate(fromDate)}`;
    }

    if (toDate) {
      return `Período hasta: ${formatDisplayDate(toDate)}`;
    }

    return "Mostrando todos los movimientos cargados.";
  }, [fromDate, toDate]);

  const applyPreset = (preset) => {
    const today = getToday();

    if (preset === "month") {
      setFromDate(getMonthStart());
      setToDate(today);
      setActivePreset("month");
      return;
    }

    if (preset === "quarter") {
      setFromDate(getMonthsAgoStart(2));
      setToDate(today);
      setActivePreset("quarter");
      return;
    }

    if (preset === "year") {
      setFromDate(getYearStart());
      setToDate(today);
      setActivePreset("year");
      return;
    }

    setFromDate("");
    setToDate("");
    setActivePreset("all");
  };

  const handleFromDateChange = (value) => {
    setFromDate(value);
    setActivePreset("custom");
  };

  const handleToDateChange = (value) => {
    setToDate(value);
    setActivePreset("custom");
  };

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1 className={styles.title}>Bienvenido, {settings.userName} 👋</h1>
        <p className={styles.subtitle}>
          Aquí tienes un resumen actualizado de tu actividad financiera.
        </p>
      </div>

      <section className={styles.filtersCard}>
        <div className={styles.filtersTop}>
          <div className={styles.quickFilters}>
            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset === "all" ? styles.activeFilter : ""
              }`}
              onClick={() => applyPreset("all")}
            >
              Todo
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset === "month" ? styles.activeFilter : ""
              }`}
              onClick={() => applyPreset("month")}
            >
              Este mes
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset === "quarter" ? styles.activeFilter : ""
              }`}
              onClick={() => applyPreset("quarter")}
            >
              Últimos 3 meses
            </button>

            <button
              type="button"
              className={`${styles.filterButton} ${
                activePreset === "year" ? styles.activeFilter : ""
              }`}
              onClick={() => applyPreset("year")}
            >
              Este año
            </button>
          </div>

          <div className={styles.dateFilters}>
            <div className={styles.filterGroup}>
              <label>Desde</label>
              <input
                className={styles.filterInput}
                type="date"
                value={fromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
              />
            </div>

            <div className={styles.filterGroup}>
              <label>Hasta</label>
              <input
                className={styles.filterInput}
                type="date"
                value={toDate}
                onChange={(e) => handleToDateChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        <p className={styles.periodText}>{periodText}</p>
        <p className={styles.movementsText}>
          Movimientos analizados: {totalMovements}
        </p>
      </section>

      <div className={styles.cardsGrid}>
        <StatCard
          title="Saldo Total"
          value={`$ ${balance.toLocaleString("es-AR")}`}
          icon="bi bi-wallet2"
          color="#2563eb"
        />

        <StatCard
          title="Ingresos"
          value={`$ ${totalIncome.toLocaleString("es-AR")}`}
          icon="bi bi-arrow-down-circle"
          color="#22c55e"
        />

        <StatCard
          title="Gastos"
          value={`$ ${totalExpenses.toLocaleString("es-AR")}`}
          icon="bi bi-arrow-up-circle"
          color="#ef4444"
        />

        <StatCard
          title="Ahorros"
          value={`$ ${totalGoalSavings.toLocaleString("es-AR")}`}
          icon="bi bi-piggy-bank"
          color="#f59e0b"
        />
      </div>

      <section className={styles.chartSection}>
        <h2 className={styles.chartTitle}>Balance mensual</h2>
        <BalanceChart
          incomes={filteredIncomes}
          expenses={filteredExpenses}
        />
      </section>

      <section className={styles.chartSection}>
        <h2 className={styles.chartTitle}>Gastos por categoría</h2>
        <ExpenseCategoriesChart expenses={filteredExpenses} />
      </section>

      <section className={styles.chartSection}>
        <h2 className={styles.chartTitle}>Objetivos de ahorro</h2>
        <SavingsGoals goals={goals} />
      </section>
    </div>
  );
}

export default Dashboard;