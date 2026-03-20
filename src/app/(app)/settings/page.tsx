"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { apiJson } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Users, UserPlus, Trash2, Shield, Eye, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline"; icon: typeof Shield; desc: string }> = {
  admin: { label: "Admin", variant: "default", icon: Shield, desc: "Full access — manage users, companies, and all settings" },
  advisor: { label: "Advisor", variant: "secondary", icon: Pencil, desc: "Create companies, generate reports, upload documents" },
  client: { label: "Client", variant: "outline", icon: Eye, desc: "View reports and deliverables for assigned companies" },
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("advisor");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (user) {
      setMembers([{ id: user.id, email: user.email, name: user.name, role: user.role || "admin", is_active: true }]);
    }
  }, [user]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    // Placeholder — actual invite API in M6
    const newMember: Member = {
      id: crypto.randomUUID(),
      email: inviteEmail,
      name: inviteName || inviteEmail.split("@")[0],
      role: inviteRole,
      is_active: true,
    };
    setMembers((prev) => [...prev, newMember]);
    toast.success(`Invited ${inviteEmail} as ${ROLE_CONFIG[inviteRole]?.label || inviteRole}`);
    setInviteEmail("");
    setInviteName("");
    setInviting(false);
  };

  const handleRemove = (memberId: string) => {
    if (memberId === user?.id) {
      toast.error("You can't remove yourself");
      return;
    }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("Member removed");
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Account and platform settings</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" /> Your Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={user?.name || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5" /> Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Role legend */}
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <div key={key} className="flex items-start gap-2 rounded-lg border px-3 py-2">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                    <p className="text-[11px] text-muted-foreground mt-1">{cfg.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Member list */}
          <div className="space-y-2">
            {members.map((m) => {
              const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.client;
              return (
                <div key={m.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                      {m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    {m.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemove(m.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                    {m.id === user?.id && (
                      <span className="text-[10px] text-muted-foreground">You</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Invite */}
          <form onSubmit={handleInvite} className="space-y-3">
            <p className="text-sm font-medium">Invite Member</p>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div className="w-32 space-y-1.5">
                <Label className="text-xs">Role</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
                >
                  <option value="admin">Admin</option>
                  <option value="advisor">Advisor</option>
                  <option value="client">Client</option>
                </select>
              </div>
              <Button type="submit" variant="outline" disabled={inviting || !inviteEmail.trim()} className="cursor-pointer gap-2">
                <UserPlus className="h-4 w-4" /> Invite
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
