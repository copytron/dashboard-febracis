import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/conta")({
  head: () => ({ meta: [{ title: "Minha conta · Febracis MKT" }] }),
  component: ContaPage,
});

function ContaPage() {
  const { user, signOut } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error("Senha precisa ter ao menos 6 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    setLoading(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword: password,
      revokeOtherSessions: false,
    });
    setLoading(false);
    if (error) return toast.error(error.message ?? "Erro ao alterar senha.");
    toast.success("Senha alterada com sucesso.");
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
  };

  return (
    <>
      <PageHeader title="Minha conta" subtitle={user?.email ?? ""} />

      <Card title="Alterar senha" className="mb-6 max-w-md">
        <form onSubmit={onChangePassword} className="space-y-3">
          <div>
            <Label className="text-xs">Senha atual</Label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <Label className="text-xs">Nova senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div>
            <Label className="text-xs">Confirmar nova senha</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1"
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </Card>

      <Card title="Sessão" className="max-w-md">
        <Button variant="outline" onClick={signOut}>
          <LogOut className="size-4 mr-2" /> Sair
        </Button>
      </Card>
    </>
  );
}
