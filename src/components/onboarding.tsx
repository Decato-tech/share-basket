import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Home, Users } from "lucide-react";
import { toast } from "sonner";

export function Onboarding({ onDone }: { onDone: () => void }) {
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
    toast.success("Household created");
    onDone();
  }
  async function join() {
    if (!code.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("join_household_by_code", { _code: code.trim().toUpperCase() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Joined household");
    onDone();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome</h1>
          <p className="text-sm text-muted-foreground mt-1">Create a household or join one to get started.</p>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border p-6">
          <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5">
            <button
              onClick={() => setTab("create")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${tab === "create" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Home className="h-4 w-4" /> Create
            </button>
            <button
              onClick={() => setTab("join")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition flex items-center justify-center gap-2 ${tab === "join" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
            >
              <Users className="h-4 w-4" /> Join
            </button>
          </div>

          {tab === "create" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hname">Household name</Label>
                <Input id="hname" placeholder="e.g. The Smith family" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <Button onClick={create} disabled={loading || !name.trim()} className="w-full h-11 rounded-xl">
                Create household
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="hcode">Invite code</Label>
                <Input id="hcode" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} className="uppercase tracking-widest text-center text-lg" />
              </div>
              <Button onClick={join} disabled={loading || !code.trim()} className="w-full h-11 rounded-xl">
                Join household
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}