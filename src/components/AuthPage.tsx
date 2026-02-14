import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AuthPage() {
  const tg = (window as any).Telegram?.WebApp;
  const hasTelegram = !!tg?.initData;

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
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {hasTelegram ? (
            <div className="flex items-center gap-2 justify-center text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span>Ваш аккаунт не имеет доступа к системе</span>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Для доступа откройте приложение через Telegram
              </p>
              <a
                href="https://t.me/ElkiHome24_Bot/app"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full">
                  Открыть в Telegram
                </Button>
              </a>
              <p className="text-xs text-muted-foreground/70">
                Доступ только для авторизованных пользователей
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
