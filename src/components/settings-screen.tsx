import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { ChevronLeft, Copy, LogOut } from "lucide-react";
import { fetchMembers, fetchMyHousehold, type Household, type MemberProfile } from "@/lib/grocery";

export function SettingsScreen() {
  const navigate = useNavigate();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const h = await fetchMyHousehold();
    setHousehold(h);
    setName(h?.name ?? "");
    if (h) setMembers(await fetchMembers(h.id));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveName() {
    if (!household || !name.trim() || name === household.name) return;
    const { error } = await supabase.from("households").update({ name: name.trim() }).eq("id", household.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    load();
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function leaveHousehold() {
    if (!household) return;
    const uid = (await supabase.auth.getUser()).data.user!.id;
    const { error } = await supabase.from("household_members").delete().eq("household_id", household.id).eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success("Left household");
    navigate({ to: "/app" });
  }

  function copyCode() {
    if (!household) return;
    navigator.clipboard.writeText(household.invite_code);
    toast.success("Invite code copied");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Toaster />
      <header className="sticky top-0 z-20 bg-background/85 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-2">
          <Link to="/app">
            <Button variant="ghost" size="icon" className="rounded-xl"><ChevronLeft className="h-5 w-5" /></Button>
          </Link>
          <h1 className="font-semibold">Settings</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {household ? (
          <>
            <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Household</h2>
              <div className="space-y-1.5">
                <Label>Name</Label>
                <div className="flex gap-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
                  <Button onClick={saveName} disabled={!name.trim() || name === household.name} className="rounded-xl">Save</Button>
                </div>
              </div>
            </section>

            <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Invite code</h2>
              <button onClick={copyCode} className="w-full flex items-center justify-between rounded-xl bg-muted px-4 py-3 active:scale-[0.99] transition">
                <span className="font-mono text-2xl tracking-widest font-semibold">{household.invite_code}</span>
                <Copy className="h-5 w-5 text-muted-foreground" />
              </button>
              <p className="text-xs text-muted-foreground">Share this code so others can join your household.</p>
            </section>

            <section className="bg-card border rounded-2xl shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Members · {members.length}</h2>
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
              <Button variant="outline" onClick={leaveHousehold} className="w-full rounded-xl">Leave household</Button>
              <Button variant="destructive" onClick={signOut} className="w-full rounded-xl">
                <LogOut className="h-4 w-4 mr-2" /> Sign out
              </Button>
            </section>
          </>
        ) : (
          <section className="bg-card border rounded-2xl shadow-sm p-4">
            <Button variant="destructive" onClick={signOut} className="w-full rounded-xl">
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}