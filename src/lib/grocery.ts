import { supabase } from "@/integrations/supabase/client";

export type GroceryItem = {
  id: string;
  household_id: string;
  name: string;
  quantity: string | null;
  category: string;
  store: string | null;
  notes: string | null;
  checked: boolean;
  added_by: string;
  checked_by: string | null;
  checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
};

export type MemberProfile = {
  user_id: string;
  name: string;
  email: string;
  joined_at: string;
};

export async function fetchMyHousehold(): Promise<Household | null> {
  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return null;
  const { data, error } = await supabase
    .from("households")
    .select("*")
    .eq("id", membership.household_id)
    .single();
  if (error) throw error;
  return data as Household;
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