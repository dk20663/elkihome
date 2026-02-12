import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Home, LogIn } from "lucide-react";

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password);
        toast.success("Проверьте почту для подтверждения регистрации");
      } else {
        await signIn(email, password);
        toast.success("Добро пожаловать!");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl border-border/50">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Home className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">
            Управление бронями
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? "Создайте аккаунт" : "Войдите в систему"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
            <Input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11"
            />
            <Button type="submit" className="w-full h-11" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? "..." : isSignUp ? "Зарегистрироваться" : "Войти"}
            </Button>
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
