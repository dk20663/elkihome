import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trash2, Save, RefreshCw, MessageSquare, ListChecks, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VkAccount {
  id: string;
  group_id: number | null;
  group_screen_name: string | null;
  access_token: string | null;
  confirmation_string: string | null;
  callback_secret: string | null;
  api_version: string;
  webhook_registered_at: string | null;
}
interface Chain { id: string; name: string; is_active: boolean; retrigger_after_days: number | null; }
interface Step { id: string; chain_id: string; order_index: number; text: string; delay_minutes: number; keyword_triggers: string[]; stop_on_client_reply: boolean; keywordsRaw?: string; }
interface LogRow { id: string; peer_id: number; chain_id: string | null; step_index: number | null; text: string; status: string; error: string | null; sent_at: string; }

async function callAdmin(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vk-admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, ...body }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || j?.body || `HTTP ${r.status}`);
  return j;
}

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export default function VkAutoreply() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background mx-auto max-w-5xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Автоответы ВКонтакте</h1>
      </div>

      <Tabs defaultValue="chains">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chains"><MessageSquare className="h-4 w-4 mr-1" />Цепочки</TabsTrigger>
          <TabsTrigger value="logs"><ListChecks className="h-4 w-4 mr-1" />Журнал</TabsTrigger>
          <TabsTrigger value="connect"><SettingsIcon className="h-4 w-4 mr-1" />Подключение</TabsTrigger>
        </TabsList>
        <TabsContent value="chains"><ChainsTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="connect"><ConnectTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────────────────────── Подключение ─────────────────────────── */

function ConnectTab() {
  const qc = useQueryClient();
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vk-webhook`;

  const { data: status, refetch, isFetching } = useQuery({
    queryKey: ["vk-status"],
    queryFn: () => callAdmin("status"),
  });

  const acc: VkAccount | null = status?.account ?? null;
  const empty: VkAccount = {
    id: "",
    group_id: null,
    group_screen_name: null,
    access_token: "",
    confirmation_string: "",
    callback_secret: "",
    api_version: "5.199",
    webhook_registered_at: null,
  };
  const [local, setLocal] = useState<VkAccount>(empty);
  useEffect(() => { if (acc) setLocal(acc); }, [acc?.id, acc?.access_token, acc?.confirmation_string, acc?.callback_secret, acc?.api_version, acc?.group_id]);

  const dirty = !eq(
    { t: local.access_token, c: local.confirmation_string, s: local.callback_secret, v: local.api_version },
    { t: acc?.access_token ?? "", c: acc?.confirmation_string ?? "", s: acc?.callback_secret ?? "", v: acc?.api_version ?? "5.199" },
  );

  const save = async () => {
    const payload = {
      access_token: local.access_token,
      confirmation_string: local.confirmation_string,
      callback_secret: local.callback_secret,
      api_version: local.api_version || "5.199",
    };
    if (acc?.id) {
      const { error } = await supabase.from("vk_account").update(payload).eq("id", acc.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("vk_account").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Сохранено");
    qc.invalidateQueries({ queryKey: ["vk-status"] });
  };

  const test = useMutation({
    mutationFn: () => callAdmin("test_connection"),
    onSuccess: (d: any) => {
      toast.success(`Подключено: ${d.group?.name ?? d.group?.screen_name ?? "ok"} (id ${d.group?.id})`);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Шаг 1 · Токен сообщества</h2>
        <p className="text-xs text-muted-foreground">
          VK → Управление сообществом → Работа с API → Ключи доступа → Создать ключ с правами <code>сообщения</code>.
        </p>
        <Label className="text-xs">Access Token сообщества</Label>
        <Input
          type="password"
          value={local.access_token ?? ""}
          onChange={(e) => setLocal({ ...local, access_token: e.target.value })}
          placeholder="vk1.a...."
          className="font-mono text-xs"
        />
        <Label className="text-xs">Версия API</Label>
        <Input
          value={local.api_version}
          onChange={(e) => setLocal({ ...local, api_version: e.target.value })}
          className="font-mono text-xs w-32"
        />
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Шаг 2 · Callback API</h2>
        <p className="text-xs text-muted-foreground">
          В VK: Управление → Работа с API → Callback API. Вставьте URL ниже, скопируйте строку для подтверждения и (опц.) секретный ключ обратно сюда.
        </p>
        <Label className="text-xs">URL для VK (вставьте в Callback API)</Label>
        <Input value={webhookUrl} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Label className="text-xs">Строка подтверждения (VK покажет её)</Label>
        <Input
          value={local.confirmation_string ?? ""}
          onChange={(e) => setLocal({ ...local, confirmation_string: e.target.value })}
          placeholder="abc12345"
          className="font-mono text-xs"
        />
        <Label className="text-xs">Секретный ключ (опц., если включили в VK)</Label>
        <Input
          type="password"
          value={local.callback_secret ?? ""}
          onChange={(e) => setLocal({ ...local, callback_secret: e.target.value })}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          В типах событий включите: <code>Входящее сообщение</code>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={save}
          variant={dirty ? "default" : "secondary"}
          disabled={!dirty}
        >
          <Save className="h-4 w-4 mr-1" />
          {dirty ? "Сохранить" : "Сохранено"}
        </Button>
        <Button variant="outline" onClick={() => test.mutate()} disabled={!acc?.access_token || test.isPending}>
          <RefreshCw className="h-4 w-4 mr-1" /> Проверить подключение
        </Button>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>Обновить статус</Button>
      </div>

      {acc && (
        <div className="rounded-2xl border p-3 text-xs space-y-1">
          <div>Группа: <code>{acc.group_screen_name ?? "—"}</code> (id {acc.group_id ?? "—"})</div>
          <div>Webhook подтверждён: {acc.webhook_registered_at ? new Date(acc.webhook_registered_at).toLocaleString("ru") : "—"}</div>
        </div>
      )}

      <div className="rounded-2xl border p-3 text-xs text-muted-foreground">
        <strong>Ограничения VK vs Авито:</strong>
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          <li>Нельзя инициировать диалог первым — VK разрешает писать пользователю только после его сообщения сообществу (24 ч).</li>
          <li>Аналога «объявлений» нет: на одно сообщество — одна активная цепочка. Маршрутизация делается через keyword-шаги внутри неё.</li>
          <li>Триггера «новое бронирование» нет в природе VK.</li>
        </ul>
      </div>
    </div>
  );
}

/* ─────────────────────────── Цепочки ─────────────────────────── */

function ChainsTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: chains = [] } = useQuery({
    queryKey: ["vk-chains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vk_autoreply_chains").select("*").order("name");
      if (error) throw error;
      return data as Chain[];
    },
  });

  const createChain = useMutation({
    mutationFn: async () => {
      // Auto-deactivate others — only one active chain per community.
      await supabase.from("vk_autoreply_chains").update({ is_active: false }).neq("id", "00000000-0000-0000-0000-000000000000");
      const { data, error } = await supabase
        .from("vk_autoreply_chains")
        .insert({ name: "Новая цепочка", is_active: true })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["vk-chains"] }); setSelected(d.id); },
  });

  const deleteChain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vk_autoreply_chains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vk-chains"] }); setSelected(null); },
  });

  return (
    <div className="mt-4 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4">
      <div className="space-y-2">
        <Button size="sm" className="w-full" onClick={() => createChain.mutate()}>
          <Plus className="h-4 w-4 mr-1" /> Новая цепочка
        </Button>
        <div className="space-y-1">
          {chains.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-left rounded-xl border p-2 text-sm ${selected === c.id ? "border-primary bg-accent" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{c.name}</span>
                {c.is_active ? <Badge variant="default" className="text-[10px]">on</Badge> : <Badge variant="outline" className="text-[10px]">off</Badge>}
              </div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Активной может быть только одна цепочка на сообщество.
        </p>
      </div>
      <div>
        {(() => {
          const current = selected ? chains.find((c) => c.id === selected) : undefined;
          return current ? (
            <ChainEditor
              key={current.id}
              chain={current}
              onDelete={() => deleteChain.mutate(current.id)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Выберите или создайте цепочку.</p>
          );
        })()}
      </div>
    </div>
  );
}

function ChainEditor({ chain, onDelete }: { chain: Chain; onDelete: () => void }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState(chain);
  useEffect(() => setLocal(chain), [chain.id]);

  const dirty = !eq(
    { n: local.name, a: local.is_active, r: local.retrigger_after_days },
    { n: chain.name, a: chain.is_active, r: chain.retrigger_after_days },
  );

  const { data: steps = [] } = useQuery({
    queryKey: ["vk-steps", chain.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vk_autoreply_steps")
        .select("*")
        .eq("chain_id", chain.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Step[];
    },
  });

  const saveChain = async () => {
    // If turning this chain on, turn off the others (one active per community).
    if (local.is_active && !chain.is_active) {
      await supabase.from("vk_autoreply_chains").update({ is_active: false }).neq("id", chain.id);
    }
    const { error } = await supabase.from("vk_autoreply_chains").update({
      name: local.name,
      is_active: local.is_active,
      retrigger_after_days: local.retrigger_after_days,
    }).eq("id", chain.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vk-chains"] });
    toast.success("Сохранено");
  };

  const addStep = async () => {
    const nextIdx = steps.length;
    const { error } = await supabase.from("vk_autoreply_steps").insert({
      chain_id: chain.id,
      order_index: nextIdx,
      text: "",
      delay_minutes: nextIdx === 0 ? 0 : 60,
      keyword_triggers: [],
      stop_on_client_reply: true,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vk-steps", chain.id] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} />
          <Button variant="destructive" size="icon" className="h-9 w-9" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2 mt-5">
            <Switch checked={local.is_active} onCheckedChange={(v) => setLocal({ ...local, is_active: v })} />
            <Label className="text-sm">Активна</Label>
          </div>
          <div>
            <Label className="text-xs">Повтор через N дней молчания</Label>
            <Input
              type="number"
              min={0}
              value={local.retrigger_after_days ?? ""}
              onChange={(e) => setLocal({ ...local, retrigger_after_days: e.target.value ? Number(e.target.value) : null })}
              placeholder="не повторять"
            />
          </div>
        </div>
        <Button
          size="sm"
          onClick={saveChain}
          variant={dirty ? "default" : "secondary"}
          disabled={!dirty}
        >
          <Save className="h-4 w-4 mr-1" />
          {dirty ? "Сохранить настройки" : "Сохранено"}
        </Button>
      </div>

      <div className="space-y-3">
        {steps.map((s, idx) => (
          <StepEditor key={s.id} step={s} index={idx} />
        ))}
        <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-4 w-4 mr-1" /> Добавить шаг</Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Подсказка: в тексте шага можно задать варианты через <code>|||</code> — система выберет случайный.
      </p>
    </div>
  );
}

function StepEditor({ step, index }: { step: Step; index: number }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<Step>(step);
  useEffect(() => setLocal(step), [step.id]);

  const parsedKeywords = local.keywordsRaw !== undefined
    ? local.keywordsRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : local.keyword_triggers;

  const dirty = !eq(
    { t: local.text, d: local.delay_minutes, k: parsedKeywords, s: local.stop_on_client_reply },
    { t: step.text, d: step.delay_minutes, k: step.keyword_triggers, s: step.stop_on_client_reply },
  );

  const save = async () => {
    const payload = {
      text: local.text,
      delay_minutes: local.delay_minutes,
      keyword_triggers: parsedKeywords,
      stop_on_client_reply: local.stop_on_client_reply,
    };
    const { error } = await supabase.from("vk_autoreply_steps").update(payload).eq("id", step.id);
    if (error) return toast.error(error.message);
    setLocal({ ...local, keyword_triggers: parsedKeywords, keywordsRaw: parsedKeywords.join(", ") });
    qc.invalidateQueries({ queryKey: ["vk-steps", step.chain_id] });
    toast.success("Шаг сохранён");
  };
  const remove = async () => {
    const { error } = await supabase.from("vk_autoreply_steps").delete().eq("id", step.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["vk-steps", step.chain_id] });
  };

  return (
    <div className="rounded-2xl border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Шаг {index + 1}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
      </div>
      <Textarea
        rows={3}
        value={local.text}
        onChange={(e) => setLocal({ ...local, text: e.target.value })}
        placeholder="Текст сообщения"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Задержка от прошлого шага (минут)</Label>
          <Input type="number" min={0} value={local.delay_minutes}
            onChange={(e) => setLocal({ ...local, delay_minutes: Number(e.target.value) || 0 })}/>
        </div>
        <div>
          <Label className="text-xs">Ключевые слова (через запятую, опц.)</Label>
          <Input
            value={local.keywordsRaw ?? local.keyword_triggers.join(", ")}
            onChange={(e) => setLocal({ ...local, keywordsRaw: e.target.value })}
            onBlur={() => {
              const parsed = (local.keywordsRaw ?? "")
                .split(",")
                .map((s) => s.trim().toLowerCase())
                .filter(Boolean);
              setLocal({ ...local, keyword_triggers: parsed, keywordsRaw: parsed.join(", ") });
            }}
            placeholder="цена, скидк, заезд, бронь"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Через запятую. Сравнение по подстроке без регистра.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={local.stop_on_client_reply} onCheckedChange={(v) => setLocal({ ...local, stop_on_client_reply: v })} />
        <Label className="text-xs">Останавливать цепочку, если клиент ответил</Label>
      </div>
      <Button
        size="sm"
        onClick={save}
        variant={dirty ? "default" : "secondary"}
        disabled={!dirty}
      >
        <Save className="h-4 w-4 mr-1" />
        {dirty ? "Сохранить шаг" : "Сохранено"}
      </Button>
    </div>
  );
}

/* ─────────────────────────── Журнал ─────────────────────────── */

function LogsTab() {
  const [status, setStatus] = useState<string>("all");
  const { data: logs = [], refetch, isFetching } = useQuery({
    queryKey: ["vk-logs", status],
    queryFn: async () => {
      let q = supabase.from("vk_message_log").select("*").order("sent_at", { ascending: false }).limit(200);
      if (status !== "all") q = q.eq("status", status as "sent" | "error" | "skipped" | "blocked");
      const { data, error } = await q;
      if (error) throw error;
      return data as LogRow[];
    },
  });

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все</SelectItem>
            <SelectItem value="sent">Отправлено</SelectItem>
            <SelectItem value="error">Ошибка</SelectItem>
            <SelectItem value="skipped">Входящие/пропуски</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className="h-4 w-4 mr-1" /> Обновить
        </Button>
      </div>
      <div className="space-y-1">
        {logs.length === 0 && <p className="text-sm text-muted-foreground">Пусто.</p>}
        {logs.map((l) => (
          <div key={l.id} className="rounded-xl border p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono">{new Date(l.sent_at).toLocaleString("ru")}</span>
              <Badge variant={l.status === "error" ? "destructive" : l.status === "sent" ? "default" : "outline"}>
                {l.status}{l.step_index != null ? ` · шаг ${l.step_index + 1}` : ""}
              </Badge>
            </div>
            <div className="text-muted-foreground">peer: {l.peer_id}</div>
            <div className="whitespace-pre-wrap mt-1">{l.text}</div>
            {l.error && <div className="text-destructive mt-1">{l.error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
