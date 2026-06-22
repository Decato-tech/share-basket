import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Plus, Search, Settings, ShoppingBasket, Store, Tag, ListChecks, X, Undo2 } from "lucide-react";
import { CATEGORIES, STORES, suggestCategory } from "@/lib/categories";
import { fetchItems, fetchMyHousehold, type GroceryItem, type Household } from "@/lib/grocery";
import { Onboarding } from "@/components/onboarding";
import { ItemEditDialog, type EditDraft } from "@/components/item-edit-dialog";

type ViewMode = "all" | "category" | "store";

export function AppShell() {
  const [loading, setLoading] = useState(true);
  const [household, setHousehold] = useState<Household | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [view, setView] = useState<ViewMode>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // quick add
  const [qName, setQName] = useState("");
  const [qQty, setQQty] = useState("");
  const [qStore, setQStore] = useState<string>("__none");
  const [qCustomStore, setQCustomStore] = useState("");
  const [qCategory, setQCategory] = useState<string>("Other");
  const [qCategoryTouched, setQCategoryTouched] = useState(false);

  useEffect(() => {
    if (!qCategoryTouched) setQCategory(suggestCategory(qName));
  }, [qName, qCategoryTouched]);

  const refresh = useCallback(async () => {
    try {
      const h = await fetchMyHousehold();
      setHousehold(h);
      if (h) setItems(await fetchItems(h.id));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime
  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel(`items-${household.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_items", filter: `household_id=eq.${household.id}` },
        () => fetchItems(household.id).then(setItems).catch(() => {}),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [household]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.notes ?? "").toLowerCase().includes(q) ||
      (i.store ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const active = filtered.filter((i) => !i.checked);
  const done = filtered.filter((i) => i.checked);

  async function quickAdd() {
    if (!household || !qName.trim()) return;
    if (qStore === "Other" && !qCustomStore.trim()) {
      toast.error("Please enter a custom store name");
      return;
    }
    const name = qName.trim();
    const category = qCategory;
    const store =
      qStore === "__none" ? null : qStore === "Other" ? qCustomStore.trim() : qStore;
    const { error } = await supabase.from("grocery_items").insert({
      household_id: household.id,
      name,
      quantity: qQty.trim() || null,
      category,
      store,
      added_by: (await supabase.auth.getUser()).data.user!.id,
    });
    if (error) return toast.error(error.message);
    setQName(""); setQQty(""); setQCustomStore("");
    setQCategoryTouched(false);
  }

  async function toggleCheck(item: GroceryItem) {
    const uid = (await supabase.auth.getUser()).data.user!.id;
    const next = !item.checked;
    const { error } = await supabase.from("grocery_items").update({
      checked: next,
      checked_by: next ? uid : null,
      checked_at: next ? new Date().toISOString() : null,
    }).eq("id", item.id);
    if (error) return toast.error(error.message);
    if (next) {
      toast("Checked off", {
        action: {
          label: "Undo",
          onClick: async () => {
            await supabase.from("grocery_items").update({ checked: false, checked_by: null, checked_at: null }).eq("id", item.id);
          },
        },
        icon: <Undo2 className="h-4 w-4" />,
      });
    }
  }

  async function saveDraft(draft: EditDraft) {
    if (!household) return;
    const store = draft.store === "Other" ? (draft.custom_store.trim() || "Other") : (draft.store || null);
    if (draft.id) {
      const { error } = await supabase.from("grocery_items").update({
        name: draft.name.trim(),
        quantity: draft.quantity.trim() || null,
        category: draft.category,
        store,
        notes: draft.notes.trim() || null,
      }).eq("id", draft.id);
      if (error) toast.error(error.message);
    } else {
      const uid = (await supabase.auth.getUser()).data.user!.id;
      const { error } = await supabase.from("grocery_items").insert({
        household_id: household.id,
        name: draft.name.trim(),
        quantity: draft.quantity.trim() || null,
        category: draft.category,
        store,
        notes: draft.notes.trim() || null,
        added_by: uid,
      });
      if (error) toast.error(error.message);
    }
  }

  async function deleteItem(id: string) {
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== id));
    const { error } = await supabase.from("grocery_items").delete().eq("id", id);
    if (error) {
      setItems(prev);
      toast.error(error.message);
    }
  }

  async function clearCompleted() {
    if (!household) return;
    const { error } = await supabase.from("grocery_items").delete().eq("household_id", household.id).eq("checked", true);
    if (error) toast.error(error.message);
    else toast.success("Completed items cleared");
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  if (!household) {
    return <Onboarding onDone={refresh} />;
  }

  // grouping
  const groups: Record<string, GroceryItem[]> = {};
  if (view !== "all") {
    const key = view === "category" ? "category" : "store";
    for (const it of active) {
      const k = (it[key] as string) || (view === "store" ? "Any store" : "Other");
      (groups[k] ||= []).push(it);
    }
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <Toaster />
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <ShoppingBasket className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-semibold leading-tight">{household.name}</h1>
              <p className="text-xs text-muted-foreground">{active.length} to buy · {done.length} done</p>
            </div>
          </div>
          <Link to="/settings">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Quick add card */}
        <div className="bg-card rounded-2xl border shadow-sm p-3 space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Add an item…"
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }}
              className="h-11 rounded-xl"
            />
            <Button onClick={quickAdd} disabled={!qName.trim()} className="h-11 w-11 rounded-xl p-0">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Qty"
              value={qQty}
              onChange={(e) => setQQty(e.target.value)}
              className="h-10 rounded-xl flex-1"
            />
            <Select value={qStore} onValueChange={setQStore}>
              <SelectTrigger className="h-10 rounded-xl flex-1"><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Any store</SelectItem>
                {STORES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {qStore === "Other" && (
            <Input
              placeholder="Custom store name"
              value={qCustomStore}
              onChange={(e) => setQCustomStore(e.target.value)}
              className="h-10 rounded-xl"
            />
          )}
          {qName.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground px-1 shrink-0">Category</span>
              <Select
                value={qCategory}
                onValueChange={(v) => { setQCategory(v); setQCategoryTouched(true); }}
              >
                <SelectTrigger className="h-9 rounded-xl flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_items")} className="pl-9 h-10 rounded-xl" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {([
            { v: "all", l: t("all_items"), i: ListChecks },
            { v: "category", l: t("by_category"), i: Tag },
            { v: "store", l: t("by_store"), i: Store },
          ] as const).map(({ v, l, i: Icon }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${view === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Icon className="h-4 w-4" /> {l}
            </button>
          ))}
        </div>

        {/* Items */}
        {active.length === 0 && done.length === 0 ? (
          <EmptyState
            title={t("list_empty_title")}
            desc={t("list_empty_desc")}
          />
        ) : view === "all" ? (
          <ItemList items={active} onToggle={toggleCheck} onEdit={(i) => { setEditing(i); setDialogOpen(true); }} />
        ) : (
          <div className="space-y-4">
            {Object.keys(groups).sort().map((g) => (
              <div key={g}>
                <div className="flex items-center justify-between px-1 mb-1.5">
                  <h2 className="text-sm font-semibold">
                    {view === "category"
                      ? catLabel(g)
                      : g === "__any_store__" ? t("any_store") : storeLabel(g)}
                  </h2>
                  <span className="text-xs text-muted-foreground">{groups[g].length}</span>
                </div>
                <ItemList items={groups[g]} onToggle={toggleCheck} onEdit={(i) => { setEditing(i); setDialogOpen(true); }} />
              </div>
            ))}
          </div>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <h2 className="text-sm font-semibold text-muted-foreground">{t("completed")} · {done.length}</h2>
              <Button variant="ghost" size="sm" onClick={clearCompleted} className="text-xs h-8 rounded-lg">{t("clear_completed")}</Button>
            </div>
            <ItemList items={done} onToggle={toggleCheck} onEdit={(i) => { setEditing(i); setDialogOpen(true); }} faded />
          </div>
        )}
      </main>

      {/* Floating add */}
      <button
        onClick={() => { setEditing(null); setDialogOpen(true); }}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition"
        aria-label={t("new_item")}
      >
        <Plus className="h-6 w-6" />
      </button>

      <ItemEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSave={saveDraft}
        onDelete={editing ? deleteItem : undefined}
      />
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-3">
        <ShoppingBasket className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1">{desc}</p>
    </div>
  );
}

function ItemList({
  items, onToggle, onEdit, faded = false,
}: {
  items: GroceryItem[];
  onToggle: (i: GroceryItem) => void;
  onEdit: (i: GroceryItem) => void;
  faded?: boolean;
}) {
  const { t } = useT();
  const catLabel = useCategoryLabel();
  const storeLabel = useStoreLabel();
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">{t("no_items")}</p>;
  }
  return (
    <ul className="bg-card rounded-2xl border shadow-sm divide-y overflow-hidden">
      {items.map((it) => (
        <li key={it.id} className={`flex items-center gap-3 p-3 ${faded ? "opacity-60" : ""}`}>
          <button
            onClick={() => onToggle(it)}
            className={`h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center transition ${it.checked ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30"}`}
            aria-label={it.checked ? "Uncheck" : "Check"}
          >
            {it.checked && <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12 15.3 5.3a1 1 0 011.4 0z" /></svg>}
          </button>
          <button onClick={() => onEdit(it)} className="flex-1 text-left min-w-0">
            <div className={`font-medium truncate ${it.checked ? "line-through" : ""}`}>{it.name}</div>
            <div className="text-xs text-muted-foreground truncate flex gap-1.5">
              {it.quantity && <span>{it.quantity}</span>}
              {it.quantity && (it.category || it.store) && <span>·</span>}
              {it.category && <span>{catLabel(it.category)}</span>}
              {it.store && <span>· {storeLabel(it.store)}</span>}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}