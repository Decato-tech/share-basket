import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, STORES, suggestCategory } from "@/lib/categories";
import type { GroceryItem } from "@/lib/grocery";
import { useT, useCategoryLabel, useStoreLabel } from "@/lib/i18n";
import { toast } from "sonner";

export type EditDraft = {
  id?: string;
  name: string;
  quantity: string;
  category: string;
  store: string;
  custom_store: string;
  notes: string;
};

export function ItemEditDialog({
  open,
  onOpenChange,
  item,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: GroceryItem | null;
  onSave: (draft: EditDraft) => Promise<boolean>;
  onDelete?: (id: string) => Promise<boolean>;
}) {
  const { t } = useT();
  const catLabel = useCategoryLabel();
  const storeLabel = useStoreLabel();
  const [draft, setDraft] = useState<EditDraft>({
    name: "", quantity: "", category: "Other", store: "", custom_store: "", notes: "",
  });
  const [touchedCategory, setTouchedCategory] = useState(false);
  const [pendingAction, setPendingAction] = useState<"save" | "delete" | null>(null);

  useEffect(() => {
    if (item) {
      const isCustom = item.store && !STORES.includes(item.store as never);
      setDraft({
        id: item.id,
        name: item.name,
        quantity: item.quantity ?? "",
        category: item.category,
        store: isCustom ? "Other" : (item.store ?? ""),
        custom_store: isCustom ? item.store! : "",
        notes: item.notes ?? "",
      });
      setTouchedCategory(true);
    } else {
      setDraft({ name: "", quantity: "", category: "Other", store: "", custom_store: "", notes: "" });
      setTouchedCategory(false);
    }
  }, [item, open]);

  function changeName(name: string) {
    setDraft((d) => ({ ...d, name, category: touchedCategory ? d.category : suggestCategory(name) }));
  }

  async function save() {
    if (pendingAction) return;
    setPendingAction("save");
    try {
      if (await onSave(draft)) onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingAction(null);
    }
  }

  async function remove() {
    if (!item || !onDelete || pendingAction) return;
    setPendingAction("delete");
    try {
      if (await onDelete(item.id)) onOpenChange(false);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!pendingAction) onOpenChange(nextOpen); }}>
      <DialogContent className="rounded-2xl sm:max-w-md" aria-busy={pendingAction !== null}>
        <DialogHeader>
          <DialogTitle>{item ? t("edit_item") : t("new_item")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("product")}</Label>
            <Input value={draft.name} onChange={(e) => changeName(e.target.value)} placeholder={t("product_placeholder")} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("qty")}</Label>
              <Input value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} placeholder={t("qty_placeholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("category")}</Label>
              <Select value={draft.category} onValueChange={(v) => { setDraft({ ...draft, category: v }); setTouchedCategory(true); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{catLabel(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("store")}</Label>
            <Select value={draft.store || "__none"} onValueChange={(v) => setDraft({ ...draft, store: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder={t("any_store")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("any_store")}</SelectItem>
                {STORES.map((s) => <SelectItem key={s} value={s}>{storeLabel(s)}</SelectItem>)}
              </SelectContent>
            </Select>
            {draft.store === "Other" && (
              <Input className="mt-2" placeholder={t("custom_store")} value={draft.custom_store} onChange={(e) => setDraft({ ...draft, custom_store: e.target.value })} />
            )}
          </div>
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder={t("optional")} rows={2} />
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          {item && onDelete && (
            <Button variant="destructive" onClick={remove} disabled={pendingAction !== null} className="rounded-xl">
              {pendingAction === "delete" ? t("please_wait") : t("delete")}
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pendingAction !== null} className="rounded-xl">{t("cancel")}</Button>
          <Button onClick={save} disabled={!draft.name.trim() || pendingAction !== null} className="rounded-xl">
            {pendingAction === "save" ? t("please_wait") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}