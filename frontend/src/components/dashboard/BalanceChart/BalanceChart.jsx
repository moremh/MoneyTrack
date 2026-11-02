import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  ComposedChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatRegionalCurrency } from "../../../utils/regionalSettings";
import styles from "./BalanceChart.module.css";
import { buildFinanceSeries, attachAvailableBalances, attachSavingsBalances } from "../../../utils/dashboardFinance";

function compactAmount(value) {
  const number = Number(value) || 0;
  const absolute = Math.abs(number);
  const sign = number < 0 ? "−" : "";
  if (absolute >= 1000000) return `${sign}${(absolute / 1000000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (absolute >= 1000) return `${sign}${(absolute / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}k`;
  return `${sign}${absolute.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}

function CustomTooltip({ active, payload, settings, showCumulative }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row || row.esExtremoVisual) return null;

  return (
    <div className={styles.tooltip}>
      <strong>{row.etiquetaCompleta}</strong>
      {showCumulative ? (
        <>
          <div className={styles.tooltipLine}>
            <span>Saldo general al cierre</span>
            <strong className={row.saldoDisponible < 0 ? styles.negative : styles.positive}>
              {formatRegionalCurrency(row.saldoDisponible, settings)}
            </strong>
          </div>
          <div className={styles.tooltipLine}>
            <span>Resultado del día/mes</span>
            <strong>{formatRegionalCurrency(row.resultado, settings)}</strong>
          </div>
          <div className={styles.tooltipLine}>
            <span>Ahorro neto apartado</span>
            <strong>{formatRegionalCurrency(row.ahorroApartado - row.ahorroRetirado, settings)}</strong>
          </div>
        </>
      ) : (
        <>
          <div className={styles.tooltipLine}>
            <span className={styles.incomeLegend}>Ingresos</span>
            <strong>{formatRegionalCurrency(row.ingresos, settings)}</strong>
          </div>
          <div className={styles.tooltipLine}>
            <span className={styles.expenseLegend}>Gastos</span>
            <strong>{formatRegionalCurrency(row.gastos, settings)}</strong>
          </div>
          <div className={styles.tooltipLine}>
            <span className={styles.savingsLegend}>Ahorros acumulados</span>
            <strong>{formatRegionalCurrency(row.ahorrosAcumulados, settings)}</strong>
          </div>
          {row.ahorroApartado > 0 && (
            <div className={styles.tooltipLine}>
              <span>Agregaste al ahorro</span>
              <strong>{formatRegionalCurrency(row.ahorroApartado, settings)}</strong>
            </div>
          )}
          {row.ahorroRetirado > 0 && (
            <div className={styles.tooltipLine}>
              <span>Retiraste del ahorro</span>
              <strong>{formatRegionalCurrency(row.ahorroRetirado, settings)}</strong>
            </div>
          )}
          <div className={styles.tooltipDivider} />
          <div className={styles.tooltipLine}>
            <span>Cambio del saldo disponible</span>
            <strong className={row.variacionDisponible < 0 ? styles.negative : styles.positive}>
              {formatRegionalCurrency(row.variacionDisponible, settings)}
            </strong>
          </div>
        </>
      )}
    </div>
  );
}

function BalanceChart({
  incomes = [],
  expenses = [],
  savingsEvents = [],
  savingsHistory = [],
  currentSavings = 0,
  availableChanges = [],
  currentAvailable = 0,
  mode = "monthly",
  fromDate = "",
  toDate = "",
  settings = {},
}) {
  const [visible, setVisible] = useState({ ingresos: true, gastos: true, ahorros: true });

  const data = useMemo(() => {
    const series = buildFinanceSeries({ incomes, expenses, savingsEvents, mode, fromDate, toDate });
    const balances = attachAvailableBalances(series, availableChanges, currentAvailable, fromDate, toDate, mode);
    return attachSavingsBalances(balances, savingsHistory, currentSavings, fromDate, toDate, mode);
  }, [incomes, expenses, savingsEvents, savingsHistory, currentSavings, availableChanges, currentAvailable, mode, fromDate, toDate]);

  // Recharts no puede dibujar una linea con un unico dato.
  // Agregamos extremos SOLO PARA EL RENDER: son el mismo saldo de ese dia,
  // sin fechas ficticias, ingresos, gastos, retiros ni aportes nuevos.
  const chartData = useMemo(() => {
    if (data.length !== 1) return data;
    const saldo = data[0];
    const extremo = () => ({
      ...saldo,
      periodo: "",
      etiquetaCompleta: "",
      ingresos: null,
      gastos: null,
      gastosBarra: null,
      esExtremoVisual: true,
    });
    return [extremo(), saldo, extremo()];
  }, [data]);

  const hasMovements = data.some((row) =>
    row.ingresos || row.gastos || row.ahorroApartado || row.ahorroRetirado || row.ahorrosAcumulados || row.saldoDisponible
  );
  // Cada punto tiene espacio propio. En móvil se desplaza SOLO el gráfico.
  // En rangos con pocos puntos se adapta al ancho disponible sin scroll innecesario.
  const chartMinWidth = Math.max(280, data.length * (mode === "daily" ? 74 : 118));
  const showMobileScrollHint = data.length > (mode === "daily" ? 6 : 2);
  const lastBalance = data.length ? data[data.length - 1].saldoDisponible : currentAvailable;
  // Dos escalas con el cero alineado al centro: así el ahorro positivo
  // SIEMPRE se dibuja arriba de la línea cero de ingresos/gastos.
  const flowScale = Math.max(1, ...data.map((row) =>
    Math.max(Math.abs(row.ingresos), Math.abs(row.gastosBarra))
  ));
  const savingsScale = Math.max(1, ...data.map((row) => row.ahorrosAcumulados));

  if (!hasMovements || data.length === 0) {
    return (
      <div className={styles.empty} role="status">
        <i className="bi bi-bar-chart" aria-hidden="true" />
        <strong>No hay movimientos en este período.</strong>
        <span>Los gráficos se actualizarán cuando registres ingresos, gastos o ahorros.</span>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.panel} aria-label="Ingresos, gastos y ahorros del período">
        <div className={styles.panelHeader}>
          <div>
            <h3>Ingresos, gastos y ahorros</h3>
            <p>Verde: ingresos. Rojo: gastos. La línea amarilla muestra cuánto tenés ahorrado.</p>
          </div>
          <div className={styles.legend} aria-label="Series visibles">
            <button
              type="button"
              className={`${styles.legendButton} ${!visible.ingresos ? styles.hiddenSeries : ""}`}
              aria-pressed={visible.ingresos}
              onClick={() => setVisible((current) => ({ ...current, ingresos: !current.ingresos }))}
            >
              <span className={styles.greenDot} aria-hidden="true" /> Ingresos
            </button>
            <button
              type="button"
              className={`${styles.legendButton} ${!visible.gastos ? styles.hiddenSeries : ""}`}
              aria-pressed={visible.gastos}
              onClick={() => setVisible((current) => ({ ...current, gastos: !current.gastos }))}
            >
              <span className={styles.redDot} aria-hidden="true" /> Gastos
            </button>
            <button
              type="button"
              className={`${styles.legendButton} ${!visible.ahorros ? styles.hiddenSeries : ""}`}
              aria-pressed={visible.ahorros}
              onClick={() => setVisible((current) => ({ ...current, ahorros: !current.ahorros }))}
            >
              <span className={styles.yellowDot} aria-hidden="true" /> Ahorros
            </button>
          </div>
        </div>
        <div className={styles.scrollArea} role="region" tabIndex={0} aria-label="Gráfico de ingresos, gastos y ahorros, con desplazamiento horizontal">
          <div className={styles.chart} style={{ "--mobile-chart-width": `${chartMinWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 16, bottom: 6, left: 0 }} barGap={3}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fill: "var(--text-light)", fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis yAxisId="movimientos" width={55} domain={[-flowScale, flowScale]} tickFormatter={compactAmount} tick={{ fill: "var(--text-light)", fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="ahorros"
                  orientation="right"
                  width={50}
                  domain={[-savingsScale * 1.12, savingsScale * 1.12]}
                  tickFormatter={(value) => value < 0 ? "" : compactAmount(value)}
                  tick={{ fill: "#fbbf24", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  hide={!visible.ahorros}
                />
                <ReferenceLine yAxisId="movimientos" y={0} stroke="var(--text-light)" strokeOpacity={0.65} />
                <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} content={(props) => <CustomTooltip {...props} settings={settings} />} />
                {visible.ingresos && <Bar yAxisId="movimientos" dataKey="ingresos" fill="#22c55e" name="Ingresos" maxBarSize={26} radius={[5, 5, 0, 0]} />}
                {visible.gastos && <Bar yAxisId="movimientos" dataKey="gastosBarra" fill="#ef4444" name="Gastos" maxBarSize={26} radius={[0, 0, 5, 5]} />}
                {visible.ahorros && (
                  <Line
                    yAxisId="ahorros"
                    type="linear"
                    dataKey="ahorrosAcumulados"
                    name="Ahorros acumulados"
                    stroke="#fbbf24"
                    strokeWidth={3}
                    dot={data.length === 1 ? false : (data.length <= 12 ? { r: 3, fill: "#fbbf24", strokeWidth: 0 } : false)}
                    activeDot={data.length === 1 ? false : { r: 5, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        {showMobileScrollHint && (
          <p className={styles.mobileScrollHint}>
            <i className="bi bi-arrow-left-right" aria-hidden="true" />
            Deslizá hacia los lados para ver más fechas.
          </p>
        )}
      </section>

      <section className={styles.panel} aria-label="Evolución del saldo general">
        <div className={styles.panelHeader}>
          <div>
            <h3>Evolución del saldo general</h3>
            <p>Dinero disponible a lo largo del tiempo, después de gastos y ahorros.</p>
          </div>
          <div className={styles.resultBadge}>
            <span>Saldo al cierre</span>
            <strong className={lastBalance < 0 ? styles.negative : styles.positive}>
              {formatRegionalCurrency(lastBalance, settings)}
            </strong>
          </div>
        </div>
        <div className={styles.scrollArea} role="region" tabIndex={0} aria-label="Gráfico de evolución del saldo general, con desplazamiento horizontal">
          <div className={styles.chart} style={{ "--mobile-chart-width": `${chartMinWidth}px` }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 12, right: 15, bottom: 6, left: 0 }}>
                <defs>
                  <linearGradient id="moneytrackAccumulatedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.23} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false} />
                <XAxis dataKey="periodo" tick={{ fill: "var(--text-light)", fontSize: 12 }} tickLine={false} axisLine={false} interval={0} />
                <YAxis width={55} tickFormatter={compactAmount} tick={{ fill: "var(--text-light)", fontSize: 12 }} tickLine={false} axisLine={false} />
                <ReferenceLine y={0} stroke="var(--text-light)" strokeDasharray="3 3" strokeOpacity={0.7} />
                <Tooltip content={(props) => <CustomTooltip {...props} settings={settings} showCumulative />} />
                <Area type="linear" dataKey="saldoDisponible" name="Saldo general" stroke="#3b82f6" strokeWidth={3} fill="url(#moneytrackAccumulatedGradient)" dot={data.length <= 12 ? { r: 3, fill: "#3b82f6" } : false} activeDot={{ r: 5, strokeWidth: 0 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        {showMobileScrollHint && (
          <p className={styles.mobileScrollHint}>
            <i className="bi bi-arrow-left-right" aria-hidden="true" />
            Deslizá hacia los lados para ver la evolución completa.
          </p>
        )}
      </section>
    </div>
  );
}

export default BalanceChart;