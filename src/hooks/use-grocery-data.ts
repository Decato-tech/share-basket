import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  createGroceryItem,
  deleteCompletedGroceryItems,
  deleteGroceryItem,
  fetchCategoryOverrides,
  fetchItems,
  fetchMyHousehold,
  reconcileServerItem,
  removeMatchingItems,
  restoreRemovedItems,
  updateGroceryItem,
  updateGroceryItemChecked,
  updateGroceryItemStatus,
  upsertCategoryOverride,
  isItemBought,
  type GroceryItem,
  type GroceryItemDraft,
  type GroceryItemStatus,
  type Household,
} from "@/lib/grocery";
import type { CategoryOverrideMap } from "@/lib/categories";

type GroceryDataOptions = {
  onError?: (error: unknown) => void;
  onRealtimeUnavailable?: () => void;
};

export function useGroceryData({ onError, onRealtimeUnavailable }: GroceryDataOptions = {}) {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [categoryOverrides, setCategoryOverrides] = useState<CategoryOverrideMap>({});
  const itemsRequestIdRef = useRef(0);
  const categoryOverridesRequestIdRef = useRef(0);

  const reportError = useCallback(
    (error: unknown) => {
      onError?.(error);
    },
    [onError],
  );

  const syncItems = useCallback(
    async (householdId: string) => {
      const requestId = ++itemsRequestIdRef.current;
      try {
        const nextItems = await fetchItems(householdId);
        if (requestId === itemsRequestIdRef.current) setItems(nextItems);
        return true;
      } catch (error) {
        if (requestId === itemsRequestIdRef.current) reportError(error);
        return false;
      }
    },
    [reportError],
  );

  const syncCategoryOverrides = useCallback(
    async (householdId: string) => {
      const requestId = ++categoryOverridesRequestIdRef.current;
      try {
        const nextOverrides = await fetchCategoryOverrides(householdId);
        if (requestId === categoryOverridesRequestIdRef.current) {
          setCategoryOverrides(nextOverrides);
        }
        return true;
      } catch (error) {
        if (requestId === categoryOverridesRequestIdRef.current) reportError(error);
        return false;
      }
    },
    [reportError],
  );

  const applyServerItem = useCallback((item: GroceryItem) => {
    itemsRequestIdRef.current += 1;
    setItems((current) => reconcileServerItem(current, item));
  }, []);

  const removeLocalItems = useCallback((shouldRemove: (item: GroceryItem) => boolean) => {
    itemsRequestIdRef.current += 1;
    setItems((current) => removeMatchingItems(current, shouldRemove));
  }, []);

  const restoreLocalItems = useCallback((removedItems: GroceryItem[]) => {
    itemsRequestIdRef.current += 1;
    setItems((current) => restoreRemovedItems(current, removedItems));
  }, []);
  const refresh = useCallback(async () => {
    try {
      const nextHousehold = await fetchMyHousehold();
      setHousehold(nextHousehold);
      if (nextHousehold) {
        await Promise.all([syncItems(nextHousehold.id), syncCategoryOverrides(nextHousehold.id)]);
      } else {
        itemsRequestIdRef.current += 1;
        categoryOverridesRequestIdRef.current += 1;
        setItems([]);
        setCategoryOverrides({});
      }
    } catch (error) {
      reportError(error);
    } finally {
      setLoading(false);
    }
  }, [reportError, syncCategoryOverrides, syncItems]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!household) return;
    let connectionErrorShown = false;
    const channel = supabase
      .channel(`items-${household.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grocery_items",
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          void syncItems(household.id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_category_overrides",
          filter: `household_id=eq.${household.id}`,
        },
        () => {
          void syncCategoryOverrides(household.id);
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          connectionErrorShown = false;
          void syncItems(household.id);
          void syncCategoryOverrides(household.id);
          return;
        }
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !connectionErrorShown) {
          connectionErrorShown = true;
          onRealtimeUnavailable?.();
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [household, onRealtimeUnavailable, syncCategoryOverrides, syncItems]);

  const createItem = useCallback(
    async (draft: GroceryItemDraft) => {
      if (!household) return null;
      try {
        const item = await createGroceryItem(household.id, draft);
        applyServerItem(item);
        return item;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [applyServerItem, household, reportError],
  );

  const saveItem = useCallback(
    async (draft: GroceryItemDraft) => {
      if (!household) return false;
      try {
        const item = draft.id
          ? await updateGroceryItem({ ...draft, id: draft.id })
          : await createGroceryItem(household.id, draft);
        applyServerItem(item);
        return true;
      } catch (error) {
        reportError(error);
        return false;
      }
    },
    [applyServerItem, household, reportError],
  );

  const setItemChecked = useCallback(
    async (item: GroceryItem, checked: boolean) => {
      try {
        const updated = await updateGroceryItemChecked(item.id, checked);
        applyServerItem(updated);
        return updated;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [applyServerItem, reportError],
  );

  const removeItem = useCallback(
    async (id: string) => {
      const deletedItem = items.find((item) => item.id === id);
      removeLocalItems((item) => item.id === id);
      try {
        await deleteGroceryItem(id);
        return true;
      } catch (error) {
        if (deletedItem) applyServerItem(deletedItem);
        reportError(error);
        return false;
      }
    },
    [applyServerItem, items, removeLocalItems, reportError],
  );

  const setItemStatus = useCallback(
    async (item: GroceryItem, status: GroceryItemStatus, notInStockNote?: string | null) => {
      try {
        const updated = await updateGroceryItemStatus(item.id, status, notInStockNote);
        applyServerItem(updated);
        return updated;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [applyServerItem, reportError],
  );

  const learnCategory = useCallback(
    async (productName: string, category: string) => {
      if (!household) return false;
      try {
        await upsertCategoryOverride(household.id, productName, category);
        await syncCategoryOverrides(household.id);
        return true;
      } catch (error) {
        reportError(error);
        return false;
      }
    },
    [household, reportError, syncCategoryOverrides],
  );

  const clearCompletedItems = useCallback(async () => {
    if (!household) return false;
    const completedItems = items.filter(isItemBought);
    if (completedItems.length === 0) return true;

    removeLocalItems(isItemBought);
    try {
      await deleteCompletedGroceryItems(household.id);
      return true;
    } catch (error) {
      restoreLocalItems(completedItems);
      reportError(error);
      return false;
    }
  }, [household, items, removeLocalItems, reportError, restoreLocalItems]);

  return {
    loading,
    household,
    items,
    categoryOverrides,
    refresh,
    createItem,
    saveItem,
    setItemChecked,
    setItemStatus,
    learnCategory,
    removeItem,
    clearCompletedItems,
  };
}
