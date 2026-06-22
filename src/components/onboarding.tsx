import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Users } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/i18n";

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("create_household", { _name: name.trim() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("household_created"));
    onDone();
  }
  async function join() {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("join_household_by_code", { _code: code.trim().toUpperCase() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("joined_household"));
    onDone();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{t("welcome")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("welcome_sub")}</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border p-6">
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${tab === "create" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Home className="h-4 w-4" /> {t("create")}
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${tab === "join" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Users className="h-4 w-4" /> {t("join")}
            </button>
          </div>

          {tab === "create" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hname">{t("household_name")}</Label>
                <Input id="hname" placeholder={t("household_name_placeholder")} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button onClick={create} disabled={loading || !name.trim()} className="w-full h-11 rounded-xl">
                {t("create_household")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hcode">{t("invite_code")}</Label>
                <Input id="hcode" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} className="uppercase tracking-widest text-center text-lg" />
              </div>
              <Button onClick={join} disabled={loading || !code.trim()} className="w-full h-11 rounded-xl">
                {t("join_household")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}