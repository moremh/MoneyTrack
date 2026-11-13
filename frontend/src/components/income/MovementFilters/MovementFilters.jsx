import styles from "./MovementFilters.module.css";
export const EMPTY_MOVEMENT_FILTERS = {
  query: "", category: "", accountId: "", fromDate: "", toDate: "",
  minAmount: "", maxAmount: "", tag: "", order: "recent",
};
export default function MovementFilters({ filters, onChange, categories=[], accounts=[], tags=[] }) {
  const set = (key,value) => onChange(old => ({ ...old, [key]: value }));
  return <div className={styles.filters} aria-label="Filtros de movimientos">
    <label className={styles.wide}>Buscar movimientos
      <input type="search" value={filters.query} onChange={e => set("query",e.target.value)}
        placeholder="Nombre, comercio, importe, nota..." />
    </label>
    <label>Categoría
      <select value={filters.category} onChange={e => set("category",e.target.value)}>
        <option value="">Todas</option>
        {categories.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label>Cuenta
      <select value={filters.accountId} onChange={e => set("accountId",e.target.value)}>
        <option value="">Todas</option><option value="__none__">Sin cuenta (saldo general)</option>
        {accounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
    </label>
    <label>Etiqueta
      <select value={filters.tag} onChange={e => set("tag",e.target.value)}>
        <option value="">Todas</option>
        {tags.map(value => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label>Desde<input type="date" value={filters.fromDate} onChange={e => set("fromDate",e.target.value)} /></label>
    <label>Hasta<input type="date" value={filters.toDate} onChange={e => set("toDate",e.target.value)} /></label>
    <label>Monto mínimo<input type="number" min="0" step="0.01" inputMode="decimal" value={filters.minAmount} onChange={e => set("minAmount",e.target.value)} placeholder="0" /></label>
    <label>Monto máximo<input type="number" min="0" step="0.01" inputMode="decimal" value={filters.maxAmount} onChange={e => set("maxAmount",e.target.value)} placeholder="Sin límite" /></label>
    <label>Ordenar por
      <select value={filters.order} onChange={e => set("order",e.target.value)}>
        <option value="recent">Más recientes</option><option value="oldest">Más antiguos</option>
        <option value="amount-desc">Mayor monto</option><option value="amount-asc">Menor monto</option>
      </select>
    </label>
    <button type="button" onClick={() => onChange({...EMPTY_MOVEMENT_FILTERS})}>Limpiar filtros</button>
  </div>;
}
