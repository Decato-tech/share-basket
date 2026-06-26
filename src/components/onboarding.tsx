import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { Home, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { householdRpcErrorKey, householdRpcErrorMessage } from "@/lib/household-errors";
import { useT } from "@/lib/i18n";

export function Onboarding({ onDone }: { onDone: () => void | Promise<void> }) {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function showError(error: Error) {
    const key = householdRpcErrorKey(error.message);
    const message = householdRpcErrorMessage(error.message, lang);
    setErrorMessage(message);
    toast.error(message);

    if (key === "already_in_household") {
      void onDone();
    }
  }

  async function create() {
    if (!name.trim() || loading) return;
    setLoading(true);
    setErrorMessage(null);
    const { error } = await supabase.rpc("create_household", { _name: name.trim() });
    setLoading(false);
    if (error) return showError(error);
    toast.success(t("household_created"));
    await onDone();
  }

  async function join() {
    if (!code.trim() || loading) return;
    setLoading(true);
    setErrorMessage(null);
    const { error } = await supabase.rpc("join_household_by_code", {
      _code: code.trim().toUpperCase(),
    });
    setLoading(false);
    if (error) return showError(error);
    toast.success(t("joined_household"));
    await onDone();
  }

  async function signOut() {
    if (loading) return;
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Toaster />
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t("welcome")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("welcome_sub")}</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border p-6">
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5">
            <button
              onClick={() => setTab("create")}
              disabled={loading}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60 ${tab === "create" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Home className="h-4 w-4" /> {t("create")}
            </button>
            <button
              onClick={() => setTab("join")}
              disabled={loading}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 disabled:opacity-60 ${tab === "join" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Users className="h-4 w-4" /> {t("join")}
            </button>
          </div>

          {errorMessage && (
            <p
              role="alert"
              className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {errorMessage}
            </p>
          )}

          {tab === "create" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hname">{t("household_name")}</Label>
                <Input
                  id="hname"
                  placeholder={t("household_name_placeholder")}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={loading}
                />
              </div>
              <Button
                onClick={create}
                disabled={loading || !name.trim()}
                className="w-full h-11 rounded-xl"
              >
                {loading ? t("please_wait") : t("create_household")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hcode">{t("invite_code")}</Label>
                <Input
                  id="hcode"
                  placeholder="ABC123"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  maxLength={6}
                  disabled={loading}
                  className="uppercase tracking-widest text-center text-lg"
                />
              </div>
              <Button
                onClick={join}
                disabled={loading || !code.trim()}
                className="w-full h-11 rounded-xl"
              >
                {loading ? t("please_wait") : t("join_household")}
              </Button>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          onClick={signOut}
          disabled={loading}
          className="mt-4 w-full rounded-xl text-muted-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" /> {t("sign_out")}
        </Button>
      </div>
    </div>
  );
}
