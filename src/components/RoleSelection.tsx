import { Home, Users, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  onSelectRole: (role: "guest" | "admin") => void;
}

export default function RoleSelection({ onSelectRole }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">ЁлкиHome</h1>
          <p className="text-sm text-muted-foreground">Бронирование посуточно</p>
        </div>
        <div className="space-y-3">
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/30 hover:border-primary"
            onClick={() => onSelectRole("guest")}
          >
            <CardContent className="flex flex-col items-center py-8 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Home className="h-7 w-7 text-primary" />
              </div>
              <span className="text-lg font-semibold">Я гость</span>
              <span className="text-sm text-muted-foreground">Посмотреть календарь и цены</span>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-lg transition-shadow border border-border/50 hover:border-border"
            onClick={() => onSelectRole("admin")}
          >
            <CardContent className="flex flex-col items-center py-8 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Settings className="h-7 w-7 text-muted-foreground" />
              </div>
              <span className="text-lg font-semibold">Я администратор</span>
              <span className="text-sm text-muted-foreground">Управление бронями и ценами</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
