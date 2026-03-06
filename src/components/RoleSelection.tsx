import { Home, Users, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Props {
  onSelectRole: (role: "guest" | "admin") => void;
}

export default function RoleSelection({ onSelectRole }: Props) {
  const tg = (window as any).Telegram?.WebApp;
  const canAddToHome = tg && typeof tg.addToHomeScreen === "function";

  const handleAddToHome = () => {
    try {
      tg.addToHomeScreen();
    } catch {
      toast.error("Не удалось добавить ярлык");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-xl border-border/50">
        <CardHeader className="text-center space-y-3 pb-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
            <Home className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl font-bold">ЁлкиHome</CardTitle>
          <p className="text-sm text-muted-foreground">Выберите режим использования</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full h-16 text-base flex flex-col gap-1"
            onClick={() => onSelectRole("guest")}
          >
            <Users className="h-5 w-5" />
            <span>Я гость</span>
          </Button>
          <Button
            className="w-full h-16 text-base flex flex-col gap-1"
            onClick={() => onSelectRole("admin")}
          >
            <Home className="h-5 w-5" />
            <span>Я администратор</span>
          </Button>
          {canAddToHome && (
            <Button
              variant="ghost"
              className="w-full h-12 text-sm flex items-center gap-2 text-muted-foreground"
              onClick={handleAddToHome}
            >
              <Smartphone className="h-4 w-4" />
              <span>Добавить на главный экран</span>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
