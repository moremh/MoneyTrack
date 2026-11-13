import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

// Anotaciones independientes de la sincronización offline de los movimientos.
export default function useTransactionAnnotations() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id;
  const [annotations, setAnnotations] = useState({});
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!userId) { setAnnotations({}); return; }
    const { data, error: dbError } = await supabase
      .from("transaction_annotations")
      .select("transaction_id,notes,tags")
      .eq("user_id", userId);
    if (dbError) { setError("No se pudieron cargar las notas y etiquetas."); return; }
    setError("");
    setAnnotations(Object.fromEntries((data || []).map(entry => [entry.transaction_id, {
      notes: entry.notes || "", tags: Array.isArray(entry.tags) ? entry.tags : [],
    }])));
  }, [userId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const reload = () => { void load(); };
    window.addEventListener("moneytrack:annotations-changed", reload);
    return () => window.removeEventListener("moneytrack:annotations-changed", reload);
  }, [load]);
  const save = async (id, notes, rawTags) => {
    if (!userId || !id || id.startsWith("offline-")) {
      return { success: false, message: "El movimiento debe estar sincronizado para guardar notas." };
    }
    const tags = [...new Set(rawTags.split(",").map(tag => tag.trim()).filter(Boolean))].slice(0, 12);
    const { error: dbError } = await supabase.from("transaction_annotations").upsert({
      transaction_id: id, user_id: userId,
      notes: notes.trim().slice(0, 2000), tags,
      updated_at: new Date().toISOString(),
    }, { onConflict: "transaction_id" });
    if (dbError) return { success: false, message: "No se pudieron guardar las notas y etiquetas." };
    setAnnotations(old => ({ ...old, [id]: { notes: notes.trim(), tags } }));
    window.dispatchEvent(new Event("moneytrack:annotations-changed"));
    return { success: true };
  };
  return { annotations, saveAnnotation: save, annotationsError: error };
}
