import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Settings,
  ShoppingBasket,
  Store,
  Tag,
  ListChecks,
  X,
  Undo2,
  MoreHorizontal,
} from "lucide-react";
import { CATEGORIES, STORES, categoryKeyFromStored, suggestCategory } from "@/lib/categories";
import {
  filterGroceryItems,
  getGroceryItemStatus,
  isGroceryValidationError,
  isItemBought,
  isItemNeeded,
  isItemNotInStock,
  type GroceryItem,
  type GroceryItemStatus,
} from "@/lib/grocery";
import { Onboarding } from "@/components/onboarding";
import { ItemEditDialog, type EditDraft } from "@/components/item-edit-dialog";
import { householdRpcErrorMessage } from "@/lib/household-errors";
import { useT, useCategoryLabel, useStoreLabel } from "@/lib/i18n";
import { useGroceryData } from "@/hooks/use-grocery-data";

type ViewMode = "all" | "category" | "store";

export function AppShell() {
  const { t, lang } = useT();
  const catLabel = useCategoryLabel();
  const storeLabel = useStoreLabel();
  const [view, setView] = useState<ViewMode>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<GroceryItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notInStockItem, setNotInStockItem] = useState<GroceryItem | null>(null);
  const [notInStockNote, setNotInStockNote] = useState("");

  // quick add
  const [qName, setQName] = useState("");
  const [qQty, setQQty] = useState("");
  const [qStore, setQStore] = useState<string>("__none");
  const [qCustomStore, setQCustomStore] = useState("");
  const [qCategory, setQCategory] = useState<string>("other");
  const [qCategoryTouched, setQCategoryTouched] = useState(false);
  const [quickAddPending, setQuickAddPending] = useState(false);

  const handleGroceryError = useCallback(
    (error: unknown) => {
      if (isGroceryValidationError(error) && error.code === "custom_store_required") {
        toast.error(t("please_enter_custom_store"));
        return;
      }
      toast.error(householdRpcErrorMessage((error as Error).message, lang));
    },
    [lang, t],
  );

  const handleRealtimeUnavailable = useCallback(() => {
    toast.error(t("live_sync_unavailable"), { id: "grocery-realtime-error" });
  }, [t]);

  const {
    loading,
    household,
    items,
    refresh,
    createItem,
    saveItem,
    setItemChecked,
    setItemStatus,
    removeItem,
    clearCompletedItems,
  } = useGroceryData({
    onError: handleGroceryError,
    onRealtimeUnavailable: handleRealtimeUnavailable,
  });

  useEffect(() => {
    if (!qName.trim()) {
      setQCategory("other");
      setQCategoryTouched(false);
      return;
    }

    if (!qCategoryTouched) setQCategory(suggestCategory(qName));
  }, [qName, qCategoryTouched]);

  const filtered = useMemo(() => filterGroceryItems(items, search), [items, search]);
  const needed = filtered.filter(isItemNeeded);
  const notInStock = filtered.filter(isItemNotInStock);
  const done = filtered.filter(isItemBought);
  const outstandingCount = needed.length + notInStock.length;

  async function quickAdd() {
    if (!household || !qName.trim() || quickAddPending) return;
    setQuickAddPending(true);
    try {
      const item = await createItem({
        name: qName,
        quantity: qQty,
        category: qCategory,
        store: qStore,
        custom_store: qCustomStore,
      });
      if (!item) return;
      setQName("");
      setQQty("");
      setQCustomStore("");
      setQCategoryTouched(false);
    } finally {
      setQuickAddPending(false);
    }
  }

  async function toggleCheck(item: GroceryItem) {
    const nextBought = getGroceryItemStatus(item) !== "bought";
    const updated = await setItemChecked(item, nextBought);
    if (!updated || getGroceryItemStatus(updated) !== "bought") return;

    toast(t("checked_off"), {
      action: {
        label: t("undo"),
        onClick: async () => {
          await setItemStatus(updated, "needed");
        },
      },
      icon: <Undo2 className="h-4 w-4" />,
    });
  }

  async function changeItemStatus(
    item: GroceryItem,
    status: GroceryItemStatus,
    note?: string | null,
  ) {
    const updated = await setItemStatus(item, status, note);
    if (updated && status === "bought") {
      toast(t("checked_off"), {
        action: {
          label: t("undo"),
          onClick: async () => {
            await setItemStatus(updated, "needed");
          },
        },
        icon: <Undo2 className="h-4 w-4" />,
      });
    }
    return updated;
  }

  function openNotInStockDialog(item: GroceryItem) {
    setNotInStockItem(item);
    setNotInStockNote(item.not_in_stock_note ?? "");
  }

  async function saveNotInStock() {
    if (!notInStockItem) return;
    const updated = await changeItemStatus(notInStockItem, "not_in_stock", notInStockNote);
    if (updated) {
      setNotInStockItem(null);
      setNotInStockNote("");
    }
  }

  async function saveDraft(draft: EditDraft) {
    return saveItem(draft);
  }

  async function deleteItem(id: string) {
    return removeItem(id);
  }

  async function clearCompleted() {
    if (await clearCompletedItems()) toast.success(t("cleared"));
  }

  function groupedItems(sectionItems: GroceryItem[]) {
    const groups: Record<string, GroceryItem[]> = {};
    for (const it of sectionItems) {
      const k =
        view === "category" ? categoryKeyFromStored(it.category) : it.store || "__any_store__";
      (groups[k] ||= []).push(it);
    }
    return groups;
  }

  function renderGroupedItems(sectionItems: GroceryItem[], faded = false) {
    const groups = groupedItems(sectionItems);
    return Object.keys(groups)
      .sort()
      .map((g) => (
        <div key={g}>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <h2 className="text-sm font-semibold">
              {view === "category"
                ? catLabel(g)
                : g === "__any_store__"
                  ? t("any_store")
                  : storeLabel(g)}
            </h2>
            <span className="text-xs text-muted-foreground">{groups[g].length}</span>
          </div>
          <ItemList
            items={groups[g]}
            onToggle={toggleCheck}
            onEdit={(i) => {
              setEditing(i);
              setDialogOpen(true);
            }}
            onStatusChange={changeItemStatus}
            onMarkNotInStock={openNotInStockDialog}
            faded={faded}
          />
        </div>
      ));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  if (!household) {
    return <Onboarding onDone={refresh} />;
  }

  const hasAnyItems = needed.length > 0 || notInStock.length > 0 || done.length > 0;

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
            <div className="min-w-0">
              <h1 className="truncate font-semibold leading-tight">{household.name}</h1>
              <p className="truncate text-xs text-muted-foreground">
                {outstandingCount} {t("to_buy")} Â· {done.length} {t("done")}
              </p>
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
              placeholder={t("add_item_placeholder")}
              value={qName}
              onChange={(e) => setQName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void quickAdd();
              }}
              className="h-11 rounded-xl"
            />
            <Button
              onClick={quickAdd}
              disabled={!qName.trim() || quickAddPending}
              aria-busy={quickAddPending}
              className="h-11 w-11 rounded-xl p-0"
            >
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("qty")}
              value={qQty}
              onChange={(e) => setQQty(e.target.value)}
              className="h-10 rounded-xl flex-1"
            />
            <Select value={qStore} onValueChange={setQStore}>
              <SelectTrigger className="h-10 rounded-xl flex-1">
                <SelectValue placeholder={t("store")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("any_store")}</SelectItem>
                {STORES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {storeLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {qStore === "Other" && (
            <Input
              placeholder={t("custom_store")}
              value={qCustomStore}
              onChange={(e) => setQCustomStore(e.target.value)}
              className="h-10 rounded-xl"
            />
          )}
          {qName.trim() && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground px-1 shrink-0">{t("category")}</span>
              <Select
                value={qCategory}
                onValueChange={(v) => {
                  setQCategory(v);
                  setQCategoryTouched(true);
                }}
              >
                <SelectTrigger className="h-9 rounded-xl flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {catLabel(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("search_items")}
            className="h-11 pl-9 pr-12 rounded-xl"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* View tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl">
          {(
            [
              { v: "all", l: t("all_items"), i: ListChecks },
              { v: "category", l: t("by_category"), i: Tag },
              { v: "store", l: t("by_store"), i: Store },
            ] as const
          ).map(({ v, l, i: Icon }) => (
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
        {!hasAnyItems ? (
          <EmptyState title={t("list_empty_title")} desc={t("list_empty_desc")} />
        ) : view === "all" ? (
          <>
            {needed.length > 0 && (
              <ItemList
                items={needed}
                onToggle={toggleCheck}
                onEdit={(i) => {
                  setEditing(i);
                  setDialogOpen(true);
                }}
                onStatusChange={changeItemStatus}
                onMarkNotInStock={openNotInStockDialog}
              />
            )}
            {notInStock.length > 0 && (
              <StatusSection title={t("not_in_stock")} count={notInStock.length}>
                <ItemList
                  items={notInStock}
                  onToggle={toggleCheck}
                  onEdit={(i) => {
                    setEditing(i);
                    setDialogOpen(true);
                  }}
                  onStatusChange={changeItemStatus}
                  onMarkNotInStock={openNotInStockDialog}
                />
              </StatusSection>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {renderGroupedItems(needed)}
            {notInStock.length > 0 && (
              <StatusSection title={t("not_in_stock")} count={notInStock.length}>
                <div className="space-y-4">{renderGroupedItems(notInStock)}</div>
              </StatusSection>
            )}
          </div>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <div className="pt-2">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("completed")} Â· {done.length}
              </h2>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="min-h-11 rounded-lg px-3 text-xs">
                    {t("clear_completed")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("confirm_clear_completed_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("confirm_clear_completed_desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        void clearCompleted();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("clear_completed")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            <ItemList
              items={done}
              onToggle={toggleCheck}
              onEdit={(i) => {
                setEditing(i);
                setDialogOpen(true);
              }}
              onStatusChange={changeItemStatus}
              onMarkNotInStock={openNotInStockDialog}
              faded
            />
          </div>
        )}
      </main>

      {/* Floating add */}
      <button
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
        className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-[calc(1.5rem+env(safe-area-inset-right))] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition"
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

      <Dialog
        open={notInStockItem !== null}
        onOpenChange={(open) => {
          if (!open) setNotInStockItem(null);
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("item_not_available")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="not-in-stock-note">
              {t("add_note")}
            </label>
            <Textarea
              id="not-in-stock-note"
              value={notInStockNote}
              onChange={(e) => setNotInStockNote(e.target.value)}
              placeholder={t("try_another_store")}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setNotInStockItem(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={saveNotInStock}>{t("mark_not_in_stock")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function StatusSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between px-1 mb-1.5">
        <h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function ItemList({
  items,
  onToggle,
  onEdit,
  onStatusChange,
  onMarkNotInStock,
  faded = false,
}: {
  items: GroceryItem[];
  onToggle: (i: GroceryItem) => void;
  onEdit: (i: GroceryItem) => void;
  onStatusChange: (i: GroceryItem, status: GroceryItemStatus) => void;
  onMarkNotInStock: (i: GroceryItem) => void;
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
      {items.map((it) => {
        const status = getGroceryItemStatus(it);
        const bought = status === "bought";
        const outOfStock = status === "not_in_stock";

        return (
          <li
            key={it.id}
            className={`flex items-center gap-2 px-3 py-2 ${faded ? "opacity-60" : ""}`}
          >
            <button
              onClick={() => onToggle(it)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition ${bought ? "bg-primary border-primary text-primary-foreground" : outOfStock ? "border-amber-500 text-amber-600" : "border-muted-foreground/30"}`}
              aria-label={bought ? t("mark_needed") : t("mark_bought")}
            >
              {bought && (
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12 15.3 5.3a1 1 0 011.4 0z" />
                </svg>
              )}
              {outOfStock && !bought && <X className="h-4 w-4" />}
            </button>
            <button onClick={() => onEdit(it)} className="min-h-11 flex-1 min-w-0 text-left">
              <div className={`font-medium truncate ${bought ? "line-through" : ""}`}>
                {it.name}
              </div>
              <div className="text-xs text-muted-foreground truncate flex gap-1.5 items-center">
                {it.quantity && <span>{it.quantity}</span>}
                {it.quantity && (it.category || it.store) && <span>Â·</span>}
                {it.category && <span>{catLabel(it.category)}</span>}
                {it.store && <span>Â· {storeLabel(it.store)}</span>}
              </div>
              {outOfStock && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="border-amber-400 text-amber-700">
                    {t("not_in_stock")}
                  </Badge>
                  {it.not_in_stock_note && <span className="truncate">{it.not_in_stock_note}</span>}
                </div>
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-xl">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{t("item_actions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {outOfStock ? (
                  <>
                    <DropdownMenuItem onClick={() => onStatusChange(it, "needed")}>
                      {t("mark_needed")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onStatusChange(it, "bought")}>
                      {t("mark_bought")}
                    </DropdownMenuItem>
                  </>
                ) : bought ? (
                  <DropdownMenuItem onClick={() => onStatusChange(it, "needed")}>
                    {t("mark_needed")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => onMarkNotInStock(it)}>
                    {t("mark_not_in_stock")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        );
      })}
    </ul>
  );
}
