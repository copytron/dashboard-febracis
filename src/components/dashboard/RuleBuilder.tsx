import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { CANAIS_LIST } from "@/lib/format";
import type { CondicaoGroup, Condicao, FieldName, Operador, RegraClassificacao } from "@/lib/regras.types";
import { FIELD_LABELS, OPERADOR_LABELS } from "@/lib/regras.types";
import { deriveCanalDinamico } from "@/lib/regras.eval";
import { listRegras, upsertRegra, deleteRegra } from "@/server/regras.api";

const EMPTY_GROUP: CondicaoGroup = { logica: "OR", condicoes: [{ campo: "ultima_origem_lead", operador: "contem", valor: "" }] };

export function RuleBuilder() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<RegraClassificacao> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: regras, isLoading } = useQuery({
    queryKey: ["regras"],
    queryFn: () => listRegras(),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRegra({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra removida");
      qc.invalidateQueries({ queryKey: ["regras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  const upsertMut = useMutation({
    mutationFn: (data: Parameters<typeof upsertRegra>[0]["data"]) => upsertRegra({ data }),
    onSuccess: () => {
      toast.success("Regra salva");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["regras"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  function openNew() {
    setEditing({ nome: "", canal: "CRM", prioridade: (regras?.length ?? 0) + 1, ativo: true, config: { ...EMPTY_GROUP } });
    setOpen(true);
  }

  function openEdit(r: RegraClassificacao) {
    setEditing({ ...r, config: r.config ?? { ...EMPTY_GROUP } });
    setOpen(true);
  }

  function handleSave() {
    if (!editing) return;
    if (!editing.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!editing.canal?.trim()) { toast.error("Canal é obrigatório"); return; }
    const config = editing.config as CondicaoGroup;
    if (!config?.condicoes?.length) { toast.error("Adicione ao menos uma condição"); return; }
    for (const c of config.condicoes) {
      if (!c.valor?.trim()) { toast.error("Todas as condições precisam de um valor"); return; }
    }
    upsertMut.mutate({
      id: editing.id,
      nome: editing.nome!,
      canal: editing.canal!,
      prioridade: editing.prioridade ?? 0,
      ativo: editing.ativo ?? true,
      config,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `${regras?.length ?? 0} regra(s)`}
          <span className="ml-2 text-xs">Definem como vendas e leads são classificados em canais</span>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4 mr-1" /> Nova regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar regra" : "Nova regra de canal"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <RuleEditorForm
                value={editing}
                onChange={setEditing}
                allRegras={(regras ?? []) as RegraClassificacao[]}
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button onClick={handleSave} disabled={upsertMut.isPending}>
                {upsertMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Prior.</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Condições</TableHead>
              <TableHead className="w-[70px]">Ativo</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(regras ?? []).map((r: RegraClassificacao) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.prioridade}</TableCell>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>
                  <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary border border-primary/20">
                    {r.canal}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.config?.condicoes?.length ?? 0} condição(ões) · {r.config?.logica ?? "OR"}
                </TableCell>
                <TableCell>
                  <span className={`text-xs ${r.ativo ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {r.ativo ? "Sim" : "Não"}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { if (confirm("Remover esta regra?")) deleteMut.mutate(r.id); }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(regras?.length ?? 0) === 0 && !isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma regra criada. As vendas usam a classificação padrão (regex).
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function RuleEditorForm({
  value,
  onChange,
  allRegras,
}: {
  value: Partial<RegraClassificacao>;
  onChange: (v: Partial<RegraClassificacao>) => void;
  allRegras: RegraClassificacao[];
}) {
  const config = (value.config ?? EMPTY_GROUP) as CondicaoGroup;
  const [testValue, setTestValue] = useState("");

  function setConfig(c: CondicaoGroup) {
    onChange({ ...value, config: c });
  }

  function addCondicao() {
    setConfig({
      ...config,
      condicoes: [...config.condicoes, { campo: "ultima_origem_lead", operador: "contem", valor: "" }],
    });
  }

  function removeCondicao(idx: number) {
    setConfig({ ...config, condicoes: config.condicoes.filter((_, i) => i !== idx) });
  }

  function updateCondicao(idx: number, patch: Partial<Condicao>) {
    setConfig({
      ...config,
      condicoes: config.condicoes.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  }

  const previewCanal = testValue.trim()
    ? deriveCanalDinamico(
        { ultima_origem_lead: testValue },
        [
          { id: value.id ?? "preview", nome: value.nome ?? "", canal: value.canal ?? "?", prioridade: value.prioridade ?? 0, ativo: value.ativo ?? true, config, created_at: "" },
          ...allRegras.filter((r) => r.id !== value.id),
        ],
      )
    : null;

  return (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Nome da regra <span className="text-destructive">*</span></Label>
          <Input value={value.nome ?? ""} onChange={(e) => onChange({ ...value, nome: e.target.value })} placeholder="Ex: CRM - Email e WhatsApp" />
        </div>
        <div className="space-y-1">
          <Label>Canal atribuído <span className="text-destructive">*</span></Label>
          <Select value={value.canal ?? ""} onValueChange={(v) => onChange({ ...value, canal: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione o canal" /></SelectTrigger>
            <SelectContent>
              {CANAIS_LIST.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Prioridade</Label>
          <Input type="number" value={value.prioridade ?? 0} onChange={(e) => onChange({ ...value, prioridade: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground">Menor = avaliada primeiro</p>
        </div>
        <div className="space-y-1">
          <Label>Ativo</Label>
          <div className="pt-2">
            <Switch checked={value.ativo ?? true} onCheckedChange={(c) => onChange({ ...value, ativo: c })} />
          </div>
        </div>
      </div>

      <div className="border border-border rounded-lg p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Condições</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Combinar com:</span>
            <Select value={config.logica} onValueChange={(v) => setConfig({ ...config, logica: v as "AND" | "OR" })}>
              <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OR">OU</SelectItem>
                <SelectItem value="AND">E</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          {config.condicoes.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2">
              {idx > 0 && (
                <span className="text-[10px] text-muted-foreground w-6 text-center shrink-0">
                  {config.logica === "AND" ? "E" : "OU"}
                </span>
              )}
              {idx === 0 && <span className="w-6 shrink-0" />}

              <Select value={cond.campo} onValueChange={(v) => updateCondicao(idx, { campo: v as FieldName })}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(FIELD_LABELS) as [FieldName, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={cond.operador} onValueChange={(v) => updateCondicao(idx, { operador: v as Operador })}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(OPERADOR_LABELS) as [Operador, string][]).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={cond.valor}
                onChange={(e) => updateCondicao(idx, { valor: e.target.value })}
                placeholder="Valor..."
                className="flex-1 h-8 text-xs"
              />

              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={() => removeCondicao(idx)}
                disabled={config.condicoes.length <= 1}
              >
                <X className="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="text-xs" onClick={addCondicao}>
          <Plus className="size-3.5 mr-1" /> Adicionar condição
        </Button>
      </div>

      {/* Preview */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <Label className="text-sm">Testar regra</Label>
        <div className="flex items-center gap-2">
          <Input
            value={testValue}
            onChange={(e) => setTestValue(e.target.value)}
            placeholder="Digite um valor de ultima_origem_lead para testar..."
            className="flex-1 h-8 text-xs"
          />
          {previewCanal && (
            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
              Canal: {previewCanal}
            </span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Simula qual canal seria atribuído para um registro com esta última origem
        </p>
      </div>
    </div>
  );
}
