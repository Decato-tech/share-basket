import { supabase } from "../integrations/supabase/client.ts";
import type { Tables, TablesInsert, TablesUpdate } from "../integrations/supabase/types.ts";
import { normalizeStoreDraft } from "./stores.ts";

export type GroceryItem = Tables<"grocery_items">;
export type GroceryItemInsert = TablesInsert<"grocery_items">;
export type GroceryItemUpdate = TablesUpdate<"grocery_items">;
export type Household = Tables<"households">;

export type MemberProfile = {
  user_id: string;
  name: string;
  email: string;
  joined_at: string;
};

export type GroceryItemDraft = {
  id?: string;
  name: string;
  quantity: string;
  category: string;
  store: string;
  custom_store?: string | null;
  notes?: string;
};

export class GroceryValidationError extends Error {
  readonly code: "custom_store_required";

  constructor(code: "custom_store_required") {
    super(code);
    this.code = code;
    this.name = "GroceryValidationError";
  }
}

export function isGroceryValidationError(error: unknown): error is GroceryValidationError {
  return error instanceof GroceryValidationError;
}

function nullableTrimmed(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function normalizeDraftStore(draft: Pick<GroceryItemDraft, "store" | "custom_store">) {
  const normalizedStore = normalizeStoreDraft(draft);
  if (normalizedStore.error) throw new GroceryValidationError(normalizedStore.error);
  return normalizedStore.store;
}

export function prepareGroceryInsert(
  householdId: string,
  userId: string,
  draft: GroceryItemDraft,
): GroceryItemInsert {
  return {
    household_id: householdId,
    added_by: userId,
    name: draft.name.trim(),
    quantity: nullableTrimmed(draft.quantity),
    category: draft.category,
    store: normalizeDraftStore(draft),
    notes: nullableTrimmed(draft.notes),
  };
}

export function prepareGroceryUpdate(draft: GroceryItemDraft): GroceryItemUpdate {
  return {
    name: draft.name.trim(),
    quantity: nullableTrimmed(draft.quantity),
    category: draft.category,
    store: normalizeDraftStore(draft),
    notes: nullableTrimmed(draft.notes),
  };
}

export function prepareCheckedUpdate(checked: boolean): GroceryItemUpdate {
  return { checked };
}

export function sortItemsNewestFirst(items: GroceryItem[]) {
  return [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function reconcileServerItem(items: GroceryItem[], item: GroceryItem) {
  return sortItemsNewestFirst([item, ...items.filter((candidate) => candidate.id !== item.id)]);
}

export function removeMatchingItems(
  items: GroceryItem[],
  shouldRemove: (item: GroceryItem) => boolean,
) {
  return items.filter((item) => !shouldRemove(item));
}

export function restoreRemovedItems(items: GroceryItem[], removedItems: GroceryItem[]) {
  const removedIds = new Set(removedItems.map((item) => item.id));
  return sortItemsNewestFirst([
    ...removedItems,
    ...items.filter((item) => !removedIds.has(item.id)),
  ]);
}
export function filterGroceryItems(items: GroceryItem[], search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return items;
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(query) ||
      (item.notes ?? "").toLowerCase().includes(query) ||
      (item.store ?? "").toLowerCase().includes(query),
  );
}

export async function fetchMyHousehold(): Promise<Household | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;
  const { data, error } = await supabase
    .from("households")
    .select("id, name, created_by, created_at")
    .eq("id", membership.household_id)
    .single();
  if (error) throw error;
  return { ...(data as Omit<Household, "invite_code">), invite_code: "" } as Household;
}

export async function fetchHouseholdInviteCode(householdId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_household_invite_code", { _household_id: householdId });
  if (error) throw error;
  return (data as string | null) ?? null;
}

export async function fetchMembers(householdId: string): Promise<MemberProfile[]> {
  const { data: members, error } = await supabase
    .from("household_members")
    .select("user_id, joined_at")
    .eq("household_id", householdId);
  if (error) throw error;
  if (!members?.length) return [];
  const ids = members.map((m) => m.user_id);
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", ids);
  if (pErr) throw pErr;
  return members.map((m) => {
    const p = profiles?.find((x) => x.id === m.user_id);
    return {
      user_id: m.user_id,
      name: p?.name ?? "Unknown",
      email: p?.email ?? "",
      joined_at: m.joined_at,
    };
  });
}

export async function fetchItems(householdId: string): Promise<GroceryItem[]> {
  const { data, error } = await supabase
    .from("grocery_items")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GroceryItem[];
}

export async function createGroceryItem(
  householdId: string,
  draft: GroceryItemDraft,
): Promise<GroceryItem> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("grocery_items")
    .insert(prepareGroceryInsert(householdId, userData.user.id, draft))
    .select("*")
    .single();
  if (error) throw error;
  return data as GroceryItem;
}

export async function updateGroceryItem(
  draft: GroceryItemDraft & { id: string },
): Promise<GroceryItem> {
  const { data, error } = await supabase
    .from("grocery_items")
    .update(prepareGroceryUpdate(draft))
    .eq("id", draft.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as GroceryItem;
}

export async function updateGroceryItemChecked(id: string, checked: boolean): Promise<GroceryItem> {
  const { data, error } = await supabase
    .from("grocery_items")
    .update(prepareCheckedUpdate(checked))
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as GroceryItem;
}

export async function deleteGroceryItem(id: string): Promise<void> {
  const { error } = await supabase.from("grocery_items").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteCompletedGroceryItems(householdId: string): Promise<void> {
  const { error } = await supabase
    .from("grocery_items")
    .delete()
    .eq("household_id", householdId)
    .eq("checked", true);
  if (error) throw error;
}
