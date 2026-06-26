import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ChevronLeft, Copy, LogOut } from "lucide-react";
import {
  fetchHouseholdInviteCode,
  fetchMembers,
  fetchMyHousehold,
  type Household,
  type MemberProfile,
} from "@/lib/grocery";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT, type Lang } from "@/lib/i18n";

export function SettingsScreen() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadedHouseholdIdRef = useRef<string | null>(null);
  const householdId = household?.id;

  const load = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        setLoadError(null);
        const h = await fetchMyHousehold();
        setHousehold(h);
        setName(h?.name ?? "");

        if (h) {
          loadedHouseholdIdRef.current = h.id;
          setMembers(await fetchMembers(h.id));
          try {
            setInviteCode(await fetchHouseholdInviteCode(h.id));
          } catch {
            setInviteCode(null);
          }
          return;
        }

        const previousHouseholdId = loadedHouseholdIdRef.current;
        loadedHouseholdIdRef.current = null;
        setMembers([]);
        setInviteCode(null);

        if (previousHouseholdId) {
          toast.error(t("household_access_removed"));
          navigate({ to: "/app" });
        }
      } catch (error) {
        const message = (error as Error).message;
        setLoadError(message);
        toast.error(message, { id: "settings-load-error" });
      } finally {
        setLoading(false);
      }
    },
    [navigate, t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!householdId) return;
    let connectionErrorShown = false;
    const channel = supabase
      .channel(`settings-${householdId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "households", filter: `id=eq.${householdId}` },
        () => {
          void load();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "household_members",
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          void load();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          connectionErrorShown = false;
          return;
        }
        if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && !connectionErrorShown) {
          connectionErrorShown = true;
          toast.error(t("live_sync_unavailable"), { id: "settings-realtime-error" });
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, load, t]);

  async function saveName() {
    if (!household || !name.trim() || name === household.name) return;
    const { error } = await supabase
      .from("households")
      .update({ name: name.trim() })
      .eq("id", household.id);
    if (error) return toast.error(error.message);
    toast.success(t("saved"));
    void load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function leaveHousehold() {
    if (!household) return;
    const { error } = await supabase.rpc("leave_current_household");
    if (error) return toast.error(error.message);
    toast.success(t("left_household"));
    loadedHouseholdIdRef.current = null;
    setHousehold(null);
    setMembers([]);
    setName("");
    navigate({ to: "/app" });
  }

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    toast.success(t("invite_copied"));
  }

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t("loading")}
      </div>
    );
  if (loadError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Toaster />
        <div className="bg-card border rounded-2xl shadow-sm p-5 max-w-sm w-full text-center space-y-3">
          <h1 className="font-semibold">{t("settings_load_failed")}</h1>
          <p className="text-sm text-muted-foreground break-words">{loadError}</p>
          <Button
            onClick={() => {
              void load(true);
            }}
            className="rounded-xl"
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Toaster />
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/app">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-semibold">{t("settings")}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t("language")}</h2>
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t("english")}</SelectItem>
              <SelectItem value="nl">{t("dutch")}</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {household ? (
          <>
            <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">{t("household")}</h2>
              <div className="space-y-1.5">
                <Label>{t("name")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-xl"
                  />
                  <Button
                    onClick={saveName}
                    disabled={!name.trim() || name === household.name}
                    className="rounded-xl"
                  >
                    {t("save")}
                  </Button>
                </div>
              </div>
            </section>

            {inviteCode ? (
              <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {t("invite_code_label")}
                </h2>
                <button
                  onClick={copyCode}
                  className="w-full flex items-center justify-between rounded-xl bg-muted px-4 py-3 active:scale-[0.99] transition"
                >
                  <span className="font-mono text-2xl tracking-widest font-semibold">
                    {inviteCode}
                  </span>
                  <Copy className="h-5 w-5 text-muted-foreground" />
                </button>
                <p className="text-xs text-muted-foreground">{t("invite_share_hint")}</p>
              </section>
            ) : null}

            <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("household_members")} · {members.length}
              </h2>
              <ul className="divide-y">
                {members.map((m) => (
                  <li key={m.user_id} className="py-2.5 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold">
                      {(m.name || m.email).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{m.name || m.email}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="min-h-11 w-full rounded-xl">
                    {t("leave_household")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("confirm_leave_household_title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("confirm_leave_household_desc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        void leaveHousehold();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("leave_household")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="destructive" onClick={signOut} className="w-full rounded-xl">
                <LogOut className="h-4 w-4 mr-2" /> {t("sign_out")}
              </Button>
            </section>
          </>
        ) : (
          <section className="bg-card border rounded-2xl shadow-sm p-4">
            <Button variant="destructive" onClick={signOut} className="w-full rounded-xl">
              <LogOut className="h-4 w-4 mr-2" /> {t("sign_out")}
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
