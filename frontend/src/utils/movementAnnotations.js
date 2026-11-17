import { supabase } from "../lib/supabase";

const MAX_TAGS = 12;
const MAX_TAG_LENGTH = 40;

export function normalizeMovementTags(values = []) {
  if (!Array.isArray(values)) {
    throw new Error("Las etiquetas deben enviarse como una lista.");
  }

  const tags = [];
  const seen = new Set();

  for (const raw of values) {
    const tag = String(raw ?? "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");

    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) {
      throw new Error("Cada etiqueta puede tener hasta 40 caracteres.");
    }

    const key = tag.toLocaleLowerCase("es-AR");
    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);
    if (tags.length > MAX_TAGS) {
      throw new Error("Se permiten hasta 12 etiquetas por movimiento.");
    }
  }

  return tags;
}

/** Lee las etiquetas existentes de los movimientos del usuario autenticado. */
export async function loadMovementAnnotations(userId) {
  if (!userId) throw new Error("Falta el usuario autenticado.");

  const result = new Map();
  const size = 500;
  for (let start = 0; ; start += size) {
    const { data, error } = await supabase
      .from("transaction_annotations")
      .select("transaction_id, tags, notes")
      .eq("user_id", userId)
      .order("transaction_id", { ascending: true })
      .range(start, start + size - 1);

    if (error) throw error;
    for (const row of data || []) {
      result.set(row.transaction_id, {
        tags: Array.isArray(row.tags) ? row.tags : [],
        notes: row.notes || "",
      });
    }
    if (!data || data.length < size) break;
  }
  return result;
}

/**
 * Guarda solo `tags`, sin modificar `notes` existentes.
 * Llamar únicamente después de que la transacción tenga un ID real en Supabase.
 * Los movimientos offline necesitan sincronizarse antes de ejecutar este helper.
 */
export async function saveMovementTags({ transactionId, userId, tags }) {
  if (!transactionId || !userId) {
    throw new Error("Faltan el movimiento o el usuario para guardar etiquetas.");
  }

  const normalized = normalizeMovementTags(tags);
  const table = () => supabase.from("transaction_annotations");

  const { data: existing, error: readError } = await table()
    .select("transaction_id")
    .eq("transaction_id", transactionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    const { data, error } = await table()
      .update({ tags: normalized })
      .eq("transaction_id", transactionId)
      .eq("user_id", userId)
      .select("transaction_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se pudo actualizar las etiquetas del movimiento.");
    return normalized;
  }

  if (normalized.length === 0) return normalized;

  const { error: insertError } = await table().insert({
    transaction_id: transactionId,
    user_id: userId,
    tags: normalized,
  });

  if (insertError?.code === "23505") {
    // Otro guardado creó la anotación simultáneamente. Actualizar solo etiquetas.
    const { data, error } = await table()
      .update({ tags: normalized })
      .eq("transaction_id", transactionId)
      .eq("user_id", userId)
      .select("transaction_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("No se pudo actualizar las etiquetas del movimiento.");
    return normalized;
  }
  if (insertError) throw insertError;
  return normalized;
}
