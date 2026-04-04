import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Home, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface AuthPageProps {
  onBack?: () => void;
}

export default function AuthPage({ onBack }: AuthPageProps) {
  const tg = (window as any).Telegram?.WebApp;
  const hasTelegram = !!tg?.initData;
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleWebLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast.error("Ошибка входа", { description: err.message || "Неверный логин или пароль" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl border-border/50 relative">
        {onBack && (
          <Button variant="ghost" size="icon" className="absolute top-3 left-3 h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Home className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">
            Управление бронями
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {hasTelegram ? (
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>Ваш аккаунт не имеет доступа к системе</span>
            </div>
          ) : (
            <form onSubmit={handleWebLogin} className="space-y-3 text-left">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Логин</label>
                <Input
                  type="email"
                  placeholder="admin@elkihome.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Пароль</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Войти
              </Button>
              <p className="text-xs text-muted-foreground/70 text-center">
                Доступ только для администраторов
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
