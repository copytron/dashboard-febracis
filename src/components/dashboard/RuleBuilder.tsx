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
import { Plus, Pencil, Trash2, X, Copy } from "lucide-react";
import { CANAIS_LIST } from "@/lib/format";
import type { CondicaoGroup, CondicaoSubGroup, Condicao, FieldName, Operador, RegraClassificacao } from "@/lib/regras.types";
import { FIELD_LABELS, OPERADOR_LABELS, normalizeConfig } from "@/lib/regras.types";
import { deriveCanalDinamico } from "@/lib/regras.eval";
import { listRegras, upsertRegra, deleteRegra } from "@/server/regras.api";

const EMPTY_CONDICAO: Condicao = { campo: "ultima_origem_lead", operador: "contem", valor: "" };
const EMPTY_SUBGROUP: CondicaoSubGroup = { logica: "OR", condicoes: [{ ...EMPTY_CONDICAO }] };

function makeNewConfig(): CondicaoGroup {
  return {
    logica: "OR",
    logica_grupos: "OR",
    grupos: [{ logica: "OR", condicoes: [{ ...EMPTY_CONDICAO }] }],
  };
}

export function RuleBuilder() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<RegraClassificacao> | null>(null);
  const [open, setOpen] = useState(false);

  const { data: regras, isLoading } = useQuery({
    queryKey: ["regras"],
    queryFn: () => listRegras(),
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["regras"] });
    qc.invalidateQueries({ queryKey: ["canais"] });
    qc.invalidateQueries({ queryKey: ["overview"] });
    qc.invalidateQueries({ queryKey: ["vendas"] });
    qc.invalidateQueries({ queryKey: ["turmas"] });
    qc.invalidateQueries({ queryKey: ["utms"] });
    qc.invalidateQueries({ queryKey: ["geo"] });
  };

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRegra({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra removida — classificação atualizada");
      invalidateAll();
    },
    onError: (e: any) => toast.error("Erro ao remover regra: " + (e?.message ?? "erro desconhecido")),
  });

  const upsertMut = useMutation({
    mutationFn: (data: Parameters<typeof upsertRegra>[0]["data"]) => upsertRegra({ data }),
    onSuccess: (result: any) => {
      toast.success(`Regra "${result.nome ?? editing?.nome}" salva — canal "${result.canal ?? editing?.canal}" atualizado`);
      setOpen(false);
      setEditing(null);
      invalidateAll();
    },
    onError: (e: any) => toast.error("Erro ao salvar regra: " + (e?.message ?? "erro desconhecido")),
  });

  function openNew() {
    setEditing({ nome: "", canal: "CRM", prioridade: (regras?.length ?? 0) + 1, ativo: true, config: makeNewConfig() });
    setOpen(true);
  }

  function openEdit(r: RegraClassificacao) {
    // Normaliza para formato de grupos ao editar
    const { logica_grupos, grupos } = normalizeConfig(r.config);
    setEditing({
      ...r,
      config: { logica: r.config.logica ?? "OR", logica_grupos, grupos },
    });
    setOpen(true);
  }

  function handleSave() {
    if (!editing) return;
    if (!editing.nome?.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!editing.canal?.trim()) { toast.error("Canal é obrigatório"); return; }
    const config = editing.config as CondicaoGroup;
    const { grupos } = normalizeConfig(config);
    if (!grupos.length) { toast.error("Adicione ao menos um grupo de condições"); return; }
    for (const g of grupos) {
      if (!g.condicoes?.length) { toast.error("Cada grupo precisa de ao menos uma condição"); return; }
      for (const c of g.condicoes) {
        if (!c.valor?.trim()) { toast.error("Todas as condições precisam de um valor"); return; }
      }
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

  function describeConfig(config: CondicaoGroup): string {
    const { logica_grupos, grupos } = normalizeConfig(config);
    if (grupos.length === 1) {
      const g = grupos[0];
      return `${g.condicoes.length} condição(ões) · ${g.logica}`;
    }
    const parts = grupos.map((g) => `${g.condicoes.length}×${g.logica}`);
    return `${grupos.length} grupos (${parts.join(` ${logica_grupos} `)})`;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          {isLoading ? "Carregando..." : `${regras?.length ?? 0} regra(s)`}
          <span className="ml-2 text-xs">Regras são aplicadas em tempo real na classificação de vendas</span>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4 mr-1" /> Nova regra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
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
                  {describeConfig(r.config)}
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
  const config = value.config as CondicaoGroup;
  const { logica_grupos, grupos } = normalizeConfig(config);
  const [testValues, setTestValues] = useState<Record<string, string>>({});

  // Detecta quais campos são usados nas condições
  const usedFields = Array.from(new Set(
    grupos.flatMap((g) => g.condicoes.map((c) => c.campo))
  ));

  function setGrupos(newGrupos: CondicaoSubGroup[], newLogicaGrupos?: "AND" | "OR") {
    onChange({
      ...value,
      config: {
        ...config,
        logica_grupos: newLogicaGrupos ?? logica_grupos,
        grupos: newGrupos,
      },
    });
  }

  function updateGrupo(idx: number, patch: Partial<CondicaoSubGroup>) {
    const newGrupos = grupos.map((g, i) => (i === idx ? { ...g, ...patch } : g));
    setGrupos(newGrupos);
  }

  function addGrupo() {
    setGrupos([...grupos, { ...EMPTY_SUBGROUP, condicoes: [{ ...EMPTY_CONDICAO }] }]);
  }

  function removeGrupo(idx: number) {
    setGrupos(grupos.filter((_, i) => i !== idx));
  }

  function duplicateGrupo(idx: number) {
    const clone: CondicaoSubGroup = {
      logica: grupos[idx].logica,
      condicoes: grupos[idx].condicoes.map((c) => ({ ...c })),
    };
    const newGrupos = [...grupos];
    newGrupos.splice(idx + 1, 0, clone);
    setGrupos(newGrupos);
  }

  function addCondicao(grupoIdx: number) {
    const g = grupos[grupoIdx];
    updateGrupo(grupoIdx, {
      condicoes: [...g.condicoes, { ...EMPTY_CONDICAO }],
    });
  }

  function removeCondicao(grupoIdx: number, condIdx: number) {
    const g = grupos[grupoIdx];
    updateGrupo(grupoIdx, {
      condicoes: g.condicoes.filter((_, i) => i !== condIdx),
    });
  }

  function updateCondicao(grupoIdx: number, condIdx: number, patch: Partial<Condicao>) {
    const g = grupos[grupoIdx];
    updateGrupo(grupoIdx, {
      condicoes: g.condicoes.map((c, i) => (i === condIdx ? { ...c, ...patch } : c)),
    });
  }

  const hasTestValue = Object.values(testValues).some((v) => v.trim());
  const previewCanal = hasTestValue
    ? deriveCanalDinamico(
        {
          ultima_origem_lead: testValues.ultima_origem_lead ?? "",
          origem_lead: testValues.origem_lead ?? "",
          utm_source: testValues.utm_source ?? "",
          utm_medium: testValues.utm_medium ?? "",
          utm_campaign: testValues.utm_campaign ?? "",
        },
        [
          {
            id: value.id ?? "preview",
            nome: value.nome ?? "",
            canal: value.canal ?? "?",
            prioridade: value.prioridade ?? 0,
            ativo: value.ativo ?? true,
            config: { ...config, logica_grupos, grupos },
            created_at: "",
          },
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

      {/* Lógica entre grupos — só aparece se há mais de 1 grupo */}
      {grupos.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
          <span className="text-xs text-muted-foreground">Combinar grupos com:</span>
          <Select value={logica_grupos} onValueChange={(v) => setGrupos(grupos, v as "AND" | "OR")}>
            <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="OR">OU</SelectItem>
              <SelectItem value="AND">E</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-1">
            {logica_grupos === "OR"
              ? "Basta qualquer grupo corresponder"
              : "Todos os grupos devem corresponder"}
          </span>
        </div>
      )}

      {/* Grupos de condições */}
      <div className="space-y-3">
        {grupos.map((grupo, gIdx) => (
          <div key={gIdx}>
            {/* Separador entre grupos */}
            {gIdx > 0 && (
              <div className="flex items-center gap-2 py-2">
                <div className="flex-1 border-t border-border" />
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {logica_grupos === "OR" ? "OU" : "E"}
                </span>
                <div className="flex-1 border-t border-border" />
              </div>
            )}

            <div className="border border-border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm">
                    {grupos.length > 1 ? `Grupo ${gIdx + 1}` : "Condições"}
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Combinar com:</span>
                    <Select value={grupo.logica} onValueChange={(v) => updateGrupo(gIdx, { logica: v as "AND" | "OR" })}>
                      <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OR">OU</SelectItem>
                        <SelectItem value="AND">E</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => duplicateGrupo(gIdx)}
                    title="Duplicar grupo"
                  >
                    <Copy className="size-3.5 text-muted-foreground" />
                  </Button>
                  {grupos.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => removeGrupo(gIdx)}
                      title="Remover grupo"
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {grupo.condicoes.map((cond, cIdx) => (
                  <div key={cIdx} className="flex items-center gap-2">
                    {cIdx > 0 && (
                      <span className="text-[10px] text-muted-foreground w-6 text-center shrink-0">
                        {grupo.logica === "AND" ? "E" : "OU"}
                      </span>
                    )}
                    {cIdx === 0 && <span className="w-6 shrink-0" />}

                    <Select value={cond.campo} onValueChange={(v) => updateCondicao(gIdx, cIdx, { campo: v as FieldName })}>
                      <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(FIELD_LABELS) as [FieldName, string][]).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={cond.operador} onValueChange={(v) => updateCondicao(gIdx, cIdx, { operador: v as Operador })}>
                      <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.entries(OPERADOR_LABELS) as [Operador, string][]).map(([k, label]) => (
                          <SelectItem key={k} value={k}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      value={cond.valor}
                      onChange={(e) => updateCondicao(gIdx, cIdx, { valor: e.target.value })}
                      placeholder="Valor..."
                      className="flex-1 h-8 text-xs"
                    />

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={() => removeCondicao(gIdx, cIdx)}
                      disabled={grupo.condicoes.length <= 1}
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" className="text-xs" onClick={() => addCondicao(gIdx)}>
                <Plus className="size-3.5 mr-1" /> Adicionar condição
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" className="text-xs w-full" onClick={addGrupo}>
        <Plus className="size-3.5 mr-1" /> Adicionar grupo de condições
      </Button>

      {/* Preview */}
      <div className="border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Testar regra</Label>
          {previewCanal && (
            <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
              Canal: {previewCanal}
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {usedFields.map((field) => (
            <div key={field} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-[140px] shrink-0 text-right">
                {FIELD_LABELS[field]}
              </span>
              <Input
                value={testValues[field] ?? ""}
                onChange={(e) => setTestValues({ ...testValues, [field]: e.target.value })}
                placeholder={`Valor de teste para ${FIELD_LABELS[field]}...`}
                className="flex-1 h-8 text-xs"
              />
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Simula qual canal seria atribuído para um registro com estes valores
        </p>
      </div>
    </div>
  );
}
