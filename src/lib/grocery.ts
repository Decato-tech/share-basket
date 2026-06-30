import { supabase } from "../integrations/supabase/client.ts";
import type { Tables, TablesInsert, TablesUpdate } from "../integrations/supabase/types.ts";
import { categoryKeyFromStored, categoryOverrideKey, type CategoryOverrideMap } from "./categories.ts";
import { normalizeStoreDraft } from "./stores.ts";

export type GroceryItem = Tables<"grocery_items">;
export type GroceryItemInsert = TablesInsert<"grocery_items">;
export type GroceryItemUpdate = TablesUpdate<"grocery_items">;
export type Household = Tables<"households">;
export type HouseholdCategoryOverride = Tables<"household_category_overrides">;

export const GROCERY_ITEM_STATUSES = ["needed", "bought", "not_in_stock"] as const;
export type GroceryItemStatus = (typeof GROCERY_ITEM_STATUSES)[number];

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
  status?: GroceryItemStatus;
  not_in_stock_note?: string | null;
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

function isKnownStatus(status: string | null | undefined): status is GroceryItemStatus {
  return GROCERY_ITEM_STATUSES.includes(status as GroceryItemStatus);
}

export function getGroceryItemStatus(
  item: Pick<GroceryItem, "checked"> & { status?: string | null },
): GroceryItemStatus {
  if (isKnownStatus(item.status)) return item.status;
  return item.checked ? "bought" : "needed";
}

export function isItemBought(item: Pick<GroceryItem, "checked"> & { status?: string | null }) {
  return getGroceryItemStatus(item) === "bought";
}

export function isItemNeeded(item: Pick<GroceryItem, "checked"> & { status?: string | null }) {
  return getGroceryItemStatus(item) === "needed";
}

export function isItemNotInStock(item: Pick<GroceryItem, "checked"> & { status?: string | null }) {
  return getGroceryItemStatus(item) === "not_in_stock";
}

function isMissingGetMyHouseholdRpcError(error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? "").toLowerCase();
  const code = String((error as { code?: unknown })?.code ?? "").toLowerCase();

  return (
    message.includes("get_my_household") &&
    (message.includes("schema cache") ||
      message.includes("could not find the function") ||
      code === "pgrst202")
  );
}

async function fetchMyHouseholdFromTables(): Promise<Household | null> {
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

export function prepareGroceryInsert(
  householdId: string,
  userId: string,
  draft: GroceryItemDraft,
): GroceryItemInsert {
  const status = draft.status ?? "needed";
  return {
    household_id: householdId,
    added_by: userId,
    name: draft.name.trim(),
    quantity: nullableTrimmed(draft.quantity),
    category: draft.category,
    store: normalizeDraftStore(draft),
    notes: nullableTrimmed(draft.notes),
    status,
    checked: status === "bought",
    not_in_stock_note: status === "not_in_stock" ? nullableTrimmed(draft.not_in_stock_note) : null,
  };
}

export function prepareGroceryUpdate(draft: GroceryItemDraft): GroceryItemUpdate {
  const update: GroceryItemUpdate = {
    name: draft.name.trim(),
    quantity: nullableTrimmed(draft.quantity),
    category: draft.category,
    store: normalizeDraftStore(draft),
    notes: nullableTrimmed(draft.notes),
  };

  if (draft.status) {
    update.status = draft.status;
    update.checked = draft.status === "bought";
  }

  if (draft.not_in_stock_note !== undefined) {
    update.not_in_stock_note = nullableTrimmed(draft.not_in_stock_note);
  }

  return update;
}

export function prepareCheckedUpdate(checked: boolean): GroceryItemUpdate {
  return { checked, status: checked ? "bought" : "needed" };
}

export function prepareStatusUpdate(
  status: GroceryItemStatus,
  notInStockNote?: string | null,
): GroceryItemUpdate {
  const update: GroceryItemUpdate = { status, checked: status === "bought" };
  if (status === "not_in_stock") update.not_in_stock_note = nullableTrimmed(notInStockNote);
  return update;
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
      (item.not_in_stock_note ?? "").toLowerCase().includes(query) ||
      (item.store ?? "").toLowerCase().includes(query),
  );
}

export async function fetchMyHousehold(): Promise<Household | null> {
  const { data, error } = await supabase.rpc("get_my_household");
  if (error) {
    if (isMissingGetMyHouseholdRpcError(error)) return fetchMyHouseholdFromTables();
    throw error;
  }

  const household = Array.isArray(data) ? data[0] : data;
  if (!household) return null;

  return { ...household, invite_code: "" } as Household;
}

export async function fetchHouseholdInviteCode(householdId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_household_invite_code", {
    _household_id: householdId,
  });
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

export async function fetchCategoryOverrides(householdId: string): Promise<CategoryOverrideMap> {
  const { data, error } = await supabase
    .from("household_category_overrides")
    .select("normalized_name, category")
    .eq("household_id", householdId);
  if (error) throw error;

  const overrides: CategoryOverrideMap = {};
  for (const row of data ?? []) {
    overrides[row.normalized_name] = categoryKeyFromStored(row.category);
  }
  return overrides;
}

export async function upsertCategoryOverride(
  householdId: string,
  productName: string,
  category: string,
): Promise<void> {
  const normalizedName = categoryOverrideKey(productName);
  if (!normalizedName) return;

  const { error } = await supabase.from("household_category_overrides").upsert(
    {
      household_id: householdId,
      normalized_name: normalizedName,
      category: categoryKeyFromStored(category),
    },
    { onConflict: "household_id,normalized_name" },
  );
  if (error) throw error;
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

export async function updateGroceryItemStatus(
  id: string,
  status: GroceryItemStatus,
  notInStockNote?: string | null,
): Promise<GroceryItem> {
  const { data, error } = await supabase
    .from("grocery_items")
    .update(prepareStatusUpdate(status, notInStockNote))
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
