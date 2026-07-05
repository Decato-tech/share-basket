import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ShoppingBasket, LogOut } from "lucide-react";
import { useT, type Lang } from "@/lib/i18n";
import { fetchMyHousehold } from "@/lib/grocery";
import { householdRpcErrorMessage } from "@/lib/household-errors";

export const PENDING_INVITE_KEY = "hg.pendingInviteCode";

const searchSchema = z.object({ code: z.string().trim().min(1).optional() });

export const Route = createFileRoute("/join")({
  ssr: false,
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Join household — Household Groceries" },
      {
        name: "description",
        content: "Join a shared household grocery list using your invite link.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: JoinPage,
});

type Screen =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "sign_in" }
  | { kind: "confirm"; householdName: string | null }
  | { kind: "already_in_household" }
  | { kind: "joining" };

function JoinPage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();
  const search = Route.useSearch();
  const code = search.code?.toUpperCase() ?? null;
  const [screen, setScreen] = useState<Screen>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!code) {
        setScreen({ kind: "invalid" });
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;

      if (!sessionData.session) {
        try {
          window.localStorage.setItem(PENDING_INVITE_KEY, code);
        } catch {
          // ignore
        }
        setScreen({ kind: "sign_in" });
        return;
      }

      // Signed in — see if user already has a household
      try {
        const household = await fetchMyHousehold();
        if (cancelled) return;
        if (household) {
          setScreen({ kind: "already_in_household" });
          return;
        }
      } catch {
        // Fall through to attempting confirmation; join RPC will surface errors
      }

      // Lookup household name for confirmation (best effort)
      let householdName: string | null = null;
      try {
        const rpc = (supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: unknown; error: unknown }>);
        const { data } = await rpc("get_household_name_by_invite_code", { _code: code });
        if (typeof data === "string" && data.length > 0) householdName = data;
        else if (data === null) {
          if (!cancelled) setScreen({ kind: "invalid" });
          return;
        }
      } catch {
        // RPC may not exist yet — proceed without name
      }

      if (!cancelled) setScreen({ kind: "confirm", householdName });
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function doJoin() {
    if (!code) return;
    setScreen({ kind: "joining" });
    const { error } = await supabase.rpc("join_household_by_code", { _code: code });
    if (error) {
      const message = householdRpcErrorMessage(error.message, lang);
      toast.error(message);
      if (/already belongs to a household/i.test(error.message)) {
        setScreen({ kind: "already_in_household" });
      } else if (/invalid invite code/i.test(error.message)) {
        setScreen({ kind: "invalid" });
      } else {
        setScreen({ kind: "confirm", householdName: null });
      }
      return;
    }
    try {
      window.localStorage.removeItem(PENDING_INVITE_KEY);
    } catch {
      // ignore
    }
    toast.success(t("invite_joined_success"));
    navigate({ to: "/app" });
  }

  function goToAuth() {
    navigate({ to: "/auth" });
  }

  async function signOutKeepInvite() {
    if (code) {
      try {
        window.localStorage.setItem(PENDING_INVITE_KEY, code);
      } catch {
        // ignore
      }
    }
    await supabase.auth.signOut();
    setScreen({ kind: "sign_in" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Toaster />
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-2">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            className="text-xs rounded-lg border bg-card px-2 py-1 text-muted-foreground"
            aria-label={t("language")}
          >
            <option value="en">EN</option>
            <option value="nl">NL</option>
          </select>
        </div>
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <ShoppingBasket className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("app_name")}</h1>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-6 space-y-4">
          {screen.kind === "loading" || screen.kind === "joining" ? (
            <p className="text-center text-muted-foreground">{t("loading")}</p>
          ) : null}

          {screen.kind === "invalid" ? (
            <>
              <h2 className="text-lg font-semibold">{t("invite_invalid_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("invite_invalid_desc")}</p>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => navigate({ to: "/app" })}
                  className="w-full min-h-11 rounded-xl"
                >
                  {t("go_to_app")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="w-full min-h-11 rounded-xl"
                >
                  {t("go_back")}
                </Button>
              </div>
            </>
          ) : null}

          {screen.kind === "sign_in" ? (
            <>
              <h2 className="text-lg font-semibold">{t("invite_sign_in_title")}</h2>
              <p className="text-sm text-muted-foreground">{t("invite_sign_in_desc")}</p>
              {code ? (
                <div className="rounded-xl bg-muted px-3 py-2 text-center">
                  <div className="text-xs text-muted-foreground">{t("invite_code_label")}</div>
                  <div className="font-mono text-lg tracking-widest font-semibold">{code}</div>
                </div>
              ) : null}
              <Button onClick={goToAuth} className="w-full min-h-11 rounded-xl">
                {t("continue_to_sign_in")}
              </Button>
            </>
          ) : null}

          {screen.kind === "confirm" ? (
            <>
              <h2 className="text-lg font-semibold">
                {t("invite_confirm_title").replace(
                  "{name}",
                  screen.householdName ?? t("household").toLowerCase(),
                )}
              </h2>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => {
                    void doJoin();
                  }}
                  className="w-full min-h-11 rounded-xl"
                >
                  {t("invite_join_button")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/app" })}
                  className="w-full min-h-11 rounded-xl"
                >
                  {t("cancel")}
                </Button>
              </div>
            </>
          ) : null}

          {screen.kind === "already_in_household" ? (
            <>
              <h2 className="text-lg font-semibold">{t("invite_already_in_household_title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("invite_already_in_household_desc")}
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => navigate({ to: "/app" })}
                  className="w-full min-h-11 rounded-xl"
                >
                  {t("go_to_current_household")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    void signOutKeepInvite();
                  }}
                  className="w-full min-h-11 rounded-xl"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("sign_out")}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}