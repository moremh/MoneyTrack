import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";

// Solo lectura: la búsqueda global también descubre servicios que aún no tienen gastos.
export default function SubscriptionGlobalSearch({ query, onSelect }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const [items, setItems] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    if (!userId) return undefined;
    supabase.from("recurring_expenses").select("id,name,category_name,tags,amount")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (!active) return;
        // Si aún no se aplicó la migración 030, se omiten los servicios.
        setItems(error ? [] : (data || []));
      });
    return () => { active = false; };
  }, [userId]);
  const results = useMemo(() => {
    const needle = String(query || "").trim().toLocaleLowerCase("es-AR");
    if (!needle) return [];
    return items.filter(item => `${item.name} ${item.category_name} ${(item.tags || []).join(" ")} ${item.amount}`
      .toLocaleLowerCase("es-AR").includes(needle)).slice(0, 10);
  }, [items, query]);
  if (!results.length) return null;
  return <>
    <p>Suscripciones</p>
    {results.map(item => <button key={`recurring-${item.id}`} type="button" onClick={() => {
      navigate(`/subscriptions?q=${encodeURIComponent(item.name)}`);
      onSelect?.();
    }}>
      <span>{item.name}<small>Suscripción · {item.category_name}</small></span>
      <strong>{Number(item.amount).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
    </button>)}
  </>;
}
