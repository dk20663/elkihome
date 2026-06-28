import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ChevronLeft, Plus, Trash2, Save, RefreshCw, Link2, MessageSquare, ListChecks, Settings as SettingsIcon } from "lucide-react";
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

type Category = "realty" | "services";

interface Chain { id: string; name: string; category: Category; is_active: boolean; retrigger_after_days: number | null; trigger_on_booking: boolean; }
interface Step { id: string; chain_id: string; order_index: number; text: string; delay_minutes: number; keyword_triggers: string[]; stop_on_client_reply: boolean; }
interface Ad { id: string; item_id: number; title: string; category: Category; chain_id: string | null; url: string | null; }
interface LogRow { id: string; chat_id: string; item_id: number | null; chain_id: string | null; step_index: number | null; text: string; status: string; error: string | null; sent_at: string; }

const FORBIDDEN_PATTERNS = [
  { re: /https?:\/\/|www\.|t\.me|wa\.me|vk\.com|telegram|whatsapp/i, label: "ссылка/мессенджер" },
  { re: /[+]?[\s(]?\d[\s\d()\-]{8,}/, label: "номер телефона" },
  { re: /@[a-zA-Z0-9_]{3,}/, label: "@username" },
];
function lintText(text: string, category: Category): string[] {
  if (category !== "realty") return [];
  const issues: string[] = [];
  for (const { re, label } of FORBIDDEN_PATTERNS) if (re.test(text)) issues.push(label);
  return issues;
}

async function callAdmin(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/avito-admin`, {
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

export default function AvitoAutoreply() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background mx-auto max-w-5xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-bold">Автоответы Авито</h1>
      </div>

      <Tabs defaultValue="ads">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ads"><ListChecks className="h-4 w-4 mr-1" />Объявления</TabsTrigger>
          <TabsTrigger value="chains"><MessageSquare className="h-4 w-4 mr-1" />Цепочки</TabsTrigger>
          <TabsTrigger value="logs"><ListChecks className="h-4 w-4 mr-1" />Журнал</TabsTrigger>
          <TabsTrigger value="connect"><SettingsIcon className="h-4 w-4 mr-1" />Подключение</TabsTrigger>
        </TabsList>
        <TabsContent value="ads"><AdsTab /></TabsContent>
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
  const [webhookUrl, setWebhookUrl] = useState(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/avito-webhook`,
  );
  const { data: status, refetch, isFetching } = useQuery({
    queryKey: ["avito-status"],
    queryFn: () => callAdmin("status"),
  });

  const subscribe = useMutation({
    mutationFn: () => callAdmin("subscribe", { webhook_url: webhookUrl }),
    onSuccess: () => { toast.success("Webhook зарегистрирован"); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const refreshSelf = useMutation({
    mutationFn: () => callAdmin("self"),
    onSuccess: (d: any) => { toast.success(`Avito user_id: ${d.avito_user_id}`); refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const loadAds = useMutation({
    mutationFn: () => callAdmin("load_ads"),
    onSuccess: (d: any) => { toast.success(`Загружено объявлений: ${d.count}`); qc.invalidateQueries({ queryKey: ["avito-ads"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const acc = status?.account;
  const hasSecrets = status?.has_secrets;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Шаг 1 · Секреты API</h2>
        {hasSecrets ? (
          <Badge variant="secondary">AVITO_CLIENT_ID и AVITO_CLIENT_SECRET сохранены</Badge>
        ) : (
          <p className="text-sm text-destructive">
            Не настроены секреты <code>AVITO_CLIENT_ID</code> и <code>AVITO_CLIENT_SECRET</code>.
            Получите их в личном кабинете Авито (avito.ru/professionals/api) и попросите меня добавить — сохраню в безопасные секреты проекта.
          </p>
        )}
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Шаг 2 · Свой Avito user_id</h2>
        <p className="text-sm text-muted-foreground">
          Текущий: <code>{acc?.avito_user_id ?? "не определён"}</code>
        </p>
        <Button onClick={() => refreshSelf.mutate()} disabled={!hasSecrets || refreshSelf.isPending}>
          <RefreshCw className="h-4 w-4 mr-2" /> Узнать / обновить user_id
        </Button>
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Шаг 3 · Webhook (одноразово)</h2>
        <Label className="text-xs text-muted-foreground">URL приёма событий</Label>
        <Input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} className="font-mono text-xs" />
        {acc?.webhook_registered_at && (
          <p className="text-xs text-muted-foreground">
            Зарегистрирован: {new Date(acc.webhook_registered_at).toLocaleString("ru")}
          </p>
        )}
        <Button onClick={() => subscribe.mutate()} disabled={!hasSecrets || subscribe.isPending}>
          <Link2 className="h-4 w-4 mr-2" /> Зарегистрировать webhook
        </Button>
      </div>

      <div className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Шаг 4 · Загрузить объявления</h2>
        <Button onClick={() => loadAds.mutate()} disabled={!hasSecrets || loadAds.isPending}>
          <RefreshCw className="h-4 w-4 mr-2" /> Загрузить из Авито
        </Button>
        <p className="text-xs text-muted-foreground">
          После загрузки перейдите на вкладку «Объявления» и проставьте каждой её категорию и цепочку.
        </p>
      </div>

      <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
        Обновить статус
      </Button>
    </div>
  );
}

/* ─────────────────────────── Объявления ─────────────────────────── */

function AdsTab() {
  const qc = useQueryClient();
  const { data: ads = [] } = useQuery({
    queryKey: ["avito-ads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("avito_ads").select("*").order("title");
      if (error) throw error;
      return data as Ad[];
    },
  });
  const { data: chains = [] } = useQuery({
    queryKey: ["chains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("autoreply_chains").select("*").order("name");
      if (error) throw error;
      return data as Chain[];
    },
  });

  const updateAd = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Ad> }) => {
      const { error } = await supabase.from("avito_ads").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["avito-ads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [bulkChain, setBulkChain] = useState<string>("");
  const [bulkFilter, setBulkFilter] = useState<Category | "all">("all");

  const filteredAds = useMemo(
    () => bulkFilter === "all" ? ads : ads.filter((a) => a.category === bulkFilter),
    [ads, bulkFilter],
  );

  const applyBulk = async () => {
    if (!bulkChain) return;
    for (const a of filteredAds) {
      await supabase.from("avito_ads").update({ chain_id: bulkChain }).eq("id", a.id);
    }
    qc.invalidateQueries({ queryKey: ["avito-ads"] });
    toast.success(`Цепочка назначена ${filteredAds.length} объявлениям`);
  };

  if (ads.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        Объявлений нет. Перейдите на вкладку «Подключение» и нажмите «Загрузить из Авито».
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border p-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Групповое назначение:</span>
        <Select value={bulkFilter} onValueChange={(v) => setBulkFilter(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все объявления</SelectItem>
            <SelectItem value="realty">Только «Недвижимость»</SelectItem>
            <SelectItem value="services">Только «Отдых»</SelectItem>
          </SelectContent>
        </Select>
        <Select value={bulkChain} onValueChange={setBulkChain}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Выбрать цепочку" /></SelectTrigger>
          <SelectContent>
            {chains.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={applyBulk} disabled={!bulkChain}>Применить</Button>
      </div>

      <div className="space-y-2">
        {ads.map((ad) => (
          <div key={ad.id} className="rounded-2xl border p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{ad.title || `Объявление #${ad.item_id}`}</div>
                <div className="text-xs text-muted-foreground">item_id: {ad.item_id}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Категория</Label>
                <Select value={ad.category} onValueChange={(v) => updateAd.mutate({ id: ad.id, patch: { category: v as Category } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realty">Недвижимость (фильтр)</SelectItem>
                    <SelectItem value="services">Организация отдыха</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Цепочка</Label>
                <Select
                  value={ad.chain_id ?? "__none"}
                  onValueChange={(v) => updateAd.mutate({ id: ad.id, patch: { chain_id: v === "__none" ? null : v } })}
                >
                  <SelectTrigger><SelectValue placeholder="Без цепочки" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— без автоответов —</SelectItem>
                    {chains.filter((c) => c.category === ad.category).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── Цепочки ─────────────────────────── */

function ChainsTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: chains = [] } = useQuery({
    queryKey: ["chains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("autoreply_chains").select("*").order("name");
      if (error) throw error;
      return data as Chain[];
    },
  });

  const createChain = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("autoreply_chains")
        .insert({ name: "Новая цепочка", category: "services" as Category, is_active: true })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ["chains"] }); setSelected(d.id); },
  });

  const deleteChain = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("autoreply_chains").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["chains"] }); setSelected(null); },
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
                {!c.is_active && <Badge variant="outline" className="text-[10px]">off</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {c.category === "realty" ? "Недвижимость" : "Отдых"}
              </div>
            </button>
          ))}
        </div>
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

  const { data: steps = [] } = useQuery({
    queryKey: ["steps", chain.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("autoreply_steps")
        .select("*")
        .eq("chain_id", chain.id)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as Step[];
    },
  });

  const saveChain = async () => {
    const { error } = await supabase.from("autoreply_chains").update({
      name: local.name,
      category: local.category,
      is_active: local.is_active,
      retrigger_after_days: local.retrigger_after_days,
      trigger_on_booking: local.trigger_on_booking,
    }).eq("id", chain.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["chains"] });
    toast.success("Сохранено");
  };

  const addStep = async () => {
    const nextIdx = steps.length;
    const { error } = await supabase.from("autoreply_steps").insert({
      chain_id: chain.id,
      order_index: nextIdx,
      text: "",
      delay_minutes: nextIdx === 0 ? 0 : 60,
      keyword_triggers: [],
      stop_on_client_reply: true,
    });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["steps", chain.id] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Input value={local.name} onChange={(e) => setLocal({ ...local, name: e.target.value })} />
          <Button variant="destructive" size="icon" className="h-9 w-9" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Категория</Label>
            <Select value={local.category} onValueChange={(v) => setLocal({ ...local, category: v as Category })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="realty">Недвижимость</SelectItem>
                <SelectItem value="services">Отдых</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
        {local.category === "realty" && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <Switch
              checked={local.trigger_on_booking}
              onCheckedChange={(v) => setLocal({ ...local, trigger_on_booking: v })}
            />
            <div className="text-sm">
              <div className="font-medium">Отправлять первое сообщение сразу после создания заявки на бронирование</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Когда клиент нажимает «Забронировать» на Авито, система сама находит чат и шлёт первый шаг цепочки (без ожидания сообщения клиента). Проверка идёт каждые 2 минуты.
              </div>
            </div>
          </div>
        )}
        <Button size="sm" onClick={saveChain}><Save className="h-4 w-4 mr-1" />Сохранить настройки</Button>
      </div>

      <div className="space-y-3">
        {steps.map((s, idx) => (
          <StepEditor key={s.id} step={s} index={idx} category={local.category} />
        ))}
        <Button variant="outline" size="sm" onClick={addStep}><Plus className="h-4 w-4 mr-1" /> Добавить шаг</Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Подсказка: в тексте шага можно задать варианты через <code>|||</code> — система выберет случайный, это снижает риск бан-фильтра.
      </p>
    </div>
  );
}

function StepEditor({ step, index, category }: { step: Step; index: number; category: Category }) {
  const qc = useQueryClient();
  const [local, setLocal] = useState(step);
  useEffect(() => setLocal(step), [step.id]);

  const issues = lintText(local.text, category);

  const save = async () => {
    const { error } = await supabase.from("autoreply_steps").update({
      text: local.text,
      delay_minutes: local.delay_minutes,
      keyword_triggers: local.keyword_triggers,
      stop_on_client_reply: local.stop_on_client_reply,
    }).eq("id", step.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["steps", step.chain_id] });
    toast.success("Шаг сохранён");
  };
  const remove = async () => {
    const { error } = await supabase.from("autoreply_steps").delete().eq("id", step.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["steps", step.chain_id] });
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
      {issues.length > 0 && (
        <p className="text-[11px] text-amber-600">
          ⚠ Для «Недвижимости» Авито может заблокировать: {issues.join(", ")}. Сохранить можно — но сообщение рискует не дойти.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Задержка от прошлого шага (минут)</Label>
          <Input type="number" min={0} value={local.delay_minutes}
            onChange={(e) => setLocal({ ...local, delay_minutes: Number(e.target.value) || 0 })}/>
        </div>
        <div>
          <Label className="text-xs">Ключевые слова (через запятую, опц.)</Label>
          <Input
            value={local.keyword_triggers.join(", ")}
            onChange={(e) => setLocal({ ...local, keyword_triggers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            placeholder="цена, скидка, заезд"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={local.stop_on_client_reply} onCheckedChange={(v) => setLocal({ ...local, stop_on_client_reply: v })} />
        <Label className="text-xs">Останавливать цепочку, если клиент ответил</Label>
      </div>
      <Button size="sm" onClick={save}><Save className="h-4 w-4 mr-1" /> Сохранить шаг</Button>
    </div>
  );
}

/* ─────────────────────────── Журнал ─────────────────────────── */

function LogsTab() {
  const [status, setStatus] = useState<string>("all");
  const { data: logs = [], refetch, isFetching } = useQuery({
    queryKey: ["avito-logs", status],
    queryFn: async () => {
      let q = supabase.from("avito_message_log").select("*").order("sent_at", { ascending: false }).limit(200);
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
            <div className="text-muted-foreground">chat: {l.chat_id}{l.item_id ? ` · ad ${l.item_id}` : ""}</div>
            <div className="whitespace-pre-wrap mt-1">{l.text}</div>
            {l.error && <div className="text-destructive mt-1">{l.error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
