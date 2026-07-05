import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ShoppingBasket } from "lucide-react";
import { useT, type Lang } from "@/lib/i18n";
import { getSignupNextStep } from "@/lib/auth";
import { PENDING_INVITE_KEY } from "./join";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Household Groceries" },
      {
        name: "description",
        content: "Sign in or create an account to share grocery lists with your household.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  function consumePendingInviteRedirect(): boolean {
    try {
      const pending = window.localStorage.getItem(PENDING_INVITE_KEY);
      if (pending) {
        window.localStorage.removeItem(PENDING_INVITE_KEY);
        navigate({ to: "/join", search: { code: pending } });
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        if (!consumePendingInviteRedirect()) navigate({ to: "/app" });
      }
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setConfirmationEmail(null);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        if (getSignupNextStep(data) === "confirm_email") {
          setConfirmationEmail(email.trim());
          toast.success(t("check_email_to_confirm"));
          return;
        }
        toast.success(t("account_created"));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      if (!consumePendingInviteRedirect()) navigate({ to: "/app" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
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
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <ShoppingBasket className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">{t("app_name")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("app_tagline")}</p>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border p-6">
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${mode === "signin" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              {t("sign_in")}
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${mode === "signup" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              {t("sign_up")}
            </button>
          </div>
          {confirmationEmail && (
            <div className="mb-5 rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm">
              <p className="font-medium">{t("check_email_title")}</p>
              <p className="mt-1 text-muted-foreground">
                {t("check_email_desc")}{" "}
                <span className="font-medium text-foreground">{confirmationEmail}</span>
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("name")}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t("your_name")}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full h-11 rounded-xl" disabled={loading}>
              {loading ? t("please_wait") : mode === "signin" ? t("sign_in") : t("create_account")}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
