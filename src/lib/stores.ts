import { STORES } from "./categories.ts";

type StoreDraft = {
  store: string;
  custom_store?: string | null;
};

type StoreNormalizationResult =
  | { store: string | null; error?: never }
  | { store?: never; error: "custom_store_required" };

export function isCustomStore(store: string | null | undefined) {
  return Boolean(store && !STORES.includes(store as (typeof STORES)[number]));
}

export function normalizeStoreDraft({ store, custom_store }: StoreDraft): StoreNormalizationResult {
  if (!store || store === "__none") return { store: null };

  if (store === "Other") {
    const customStore = (custom_store ?? "").trim();
    if (!customStore) return { error: "custom_store_required" };
    return { store: customStore };
  }

  return { store };
}
