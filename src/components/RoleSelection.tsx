import { Home, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  onSelectRole: (role: "guest" | "admin") => void;
}

export default function RoleSelection({ onSelectRole }: Props) {
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
        </CardContent>
      </Card>
    </div>
  );
}
