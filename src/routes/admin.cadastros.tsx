import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { RuleBuilder } from "@/components/dashboard/RuleBuilder";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/admin/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros · Febracis MKT" }] }),
  component: CadastrosPage,
});

// ---------------------------------------------------------------------------
// Server functions — CRUD genérico
// ---------------------------------------------------------------------------

type TableName = "produtos" | "contas" | "edicoes" | "orcamentos" | "regras_classificacao";

const listEntidade = createServerFn({ method: "GET" })
  .inputValidator((d: { table: TableName; orderBy: string; orderAsc: boolean }) => d)
  .handler(async ({ data }) => {
    const dir = data.orderAsc ? sql`ASC` : sql`DESC`;
    const result = await db.execute(
      sql`SELECT * FROM ${sql.identifier(data.table)} ORDER BY ${sql.identifier(data.orderBy)} ${dir}`
    );
    return result as unknown as any[];
  });

const lookupProdutos = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(
    sql`SELECT id, nome_produto FROM produtos ORDER BY nome_produto ASC`
  );
  return result as unknown as { id: string; nome_produto: string }[];
});

const lookupEdicoes = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.execute(
    sql`SELECT id, nome_edicao FROM edicoes ORDER BY nome_edicao ASC`
  );
  return result as unknown as { id: string; nome_edicao: string }[];
});

const upsertEntidade = createServerFn({ method: "POST" })
  .inputValidator((d: { table: TableName; id?: string; payload: Record<string, any> }) => d)
  .handler(async ({ data }) => {
    if (data.id) {
      const sets = Object.entries(data.payload)
        .map(([k, v]) => sql`${sql.identifier(k)} = ${v}`)
        .reduce((acc, expr, i) => (i === 0 ? expr : sql`${acc}, ${expr}`));
      await db.execute(
        sql`UPDATE ${sql.identifier(data.table)} SET ${sets} WHERE id = ${data.id}`
      );
    } else {
      const keys = Object.keys(data.payload);
      const vals = Object.values(data.payload);
      const colsSql = sql.join(keys.map((k) => sql.identifier(k)), sql`, `);
      const valsSql = sql.join(vals.map((v) => sql`${v}`), sql`, `);
      await db.execute(
        sql`INSERT INTO ${sql.identifier(data.table)} (${colsSql}) VALUES (${valsSql})`
      );
    }
    return { ok: true };
  });

const deleteEntidade = createServerFn({ method: "POST" })
  .inputValidator((d: { table: TableName; id: string }) => d)
  .handler(async ({ data }) => {
    await db.execute(
      sql`DELETE FROM ${sql.identifier(data.table)} WHERE id = ${data.id}`
    );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Types & config — Entidades genéricas
// ---------------------------------------------------------------------------

type FieldType = "text" | "number" | "date" | "color" | "boolean" | "select";
type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  optionsFrom?: "produtos" | "edicoes";
};
type EntityDef = {
  table: TableName;
  label: string;
  orderBy: string;
  orderAsc?: boolean;
  columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[];
  fields: FieldDef[];
};

const ENTITIES: EntityDef[] = [
  {
    table: "produtos",
    label: "Produtos",
    orderBy: "nome_produto",
    orderAsc: true,
    columns: [
      { key: "nome_produto", label: "Nome" },
      { key: "abreviacao", label: "Abrev." },
      {
        key: "cor_hex",
        label: "Cor",
        render: (r) => (
          <div className="flex items-center gap-2">
            <span className="size-4 rounded border border-border" style={{ background: r.cor_hex }} />
            <span className="text-xs font-mono">{r.cor_hex}</span>
          </div>
        ),
      },
      { key: "edicao_anual_unica", label: "Anual única", render: (r) => (r.edicao_anual_unica ? "Sim" : "Não") },
    ],
    fields: [
      { key: "nome_produto", label: "Nome do produto", type: "text", required: true },
      { key: "abreviacao", label: "Abreviação", type: "text", required: true },
      { key: "cor_hex", label: "Cor (hex)", type: "color", required: true },
      { key: "edicao_anual_unica", label: "Edição anual única", type: "boolean" },
    ],
  },
  {
    table: "contas",
    label: "Contas",
    orderBy: "nome_conta",
    orderAsc: true,
    columns: [
      { key: "nome_conta", label: "Nome" },
      { key: "produto_principal_id", label: "Produto principal" },
    ],
    fields: [
      { key: "nome_conta", label: "Nome da conta", type: "text", required: true },
      { key: "produto_principal_id", label: "Produto principal", type: "select", optionsFrom: "produtos" },
    ],
  },
  {
    table: "edicoes",
    label: "Edições",
    orderBy: "data_inicio",
    orderAsc: false,
    columns: [
      { key: "nome_edicao", label: "Nome" },
      { key: "produto_id", label: "Produto" },
      { key: "data_inicio", label: "Início" },
      { key: "data_fim", label: "Fim" },
      { key: "valor_aprovado", label: "Valor aprovado", render: (r) => fmtBRL(r.valor_aprovado) },
    ],
    fields: [
      { key: "nome_edicao", label: "Nome da edição", type: "text", required: true },
      { key: "produto_id", label: "Produto", type: "select", optionsFrom: "produtos", required: true },
      { key: "data_inicio", label: "Início", type: "date" },
      { key: "data_fim", label: "Fim", type: "date" },
      { key: "valor_aprovado", label: "Valor aprovado", type: "number" },
    ],
  },
  {
    table: "orcamentos",
    label: "Orçamentos",
    orderBy: "mes_referencia",
    orderAsc: false,
    columns: [
      { key: "mes_referencia", label: "Mês" },
      { key: "produto_id", label: "Produto" },
      { key: "edicao_id", label: "Edição" },
      { key: "valor_aprovado", label: "Valor aprovado", render: (r) => fmtBRL(r.valor_aprovado) },
    ],
    fields: [
      { key: "mes_referencia", label: "Mês (YYYY-MM)", type: "text", required: true },
      { key: "produto_id", label: "Produto", type: "select", optionsFrom: "produtos", required: true },
      { key: "edicao_id", label: "Edição (opcional)", type: "select", optionsFrom: "edicoes" },
      { key: "valor_aprovado", label: "Valor aprovado", type: "number", required: true },
    ],
  },
];

function fmtBRL(v: any) {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function CadastrosPage() {
  const { isAdmin } = useAuth();

  return (
    <div className="px-6 py-6 space-y-6">
      <PageHeader title="Cadastros" subtitle="Produtos, contas, edições, orçamentos e regras de classificação" tutorialKey="cadastros" />
      <Tabs defaultValue={ENTITIES[0].table}>
        <TabsList>
          {ENTITIES.map((e) => (
            <TabsTrigger key={e.table} value={e.table}>{e.label}</TabsTrigger>
          ))}
          {isAdmin && <TabsTrigger value="canais">Canais</TabsTrigger>}
        </TabsList>
        {ENTITIES.map((e) => (
          <TabsContent key={e.table} value={e.table} className="mt-4">
            <EntityCrud entity={e} />
          </TabsContent>
        ))}
        {isAdmin && (
          <TabsContent value="canais" className="mt-4">
            <Card>
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold">Regras de classificação de canal</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Configure as regras que determinam a qual canal cada venda é atribuída.
                </p>
              </div>
              <div className="p-4">
                <RuleBuilder />
              </div>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CRUD genérico (produtos, contas, edições, orçamentos)
// ---------------------------------------------------------------------------

function EntityCrud({ entity }: { entity: EntityDef }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const list = useQuery({
    queryKey: ["cadastro", entity.table],
    queryFn: () =>
      listEntidade({
        data: {
          table: entity.table,
          orderBy: entity.orderBy,
          orderAsc: !!entity.orderAsc,
        },
      }),
  });

  const produtos = useQuery({
    queryKey: ["lookup", "produtos"],
    queryFn: () => lookupProdutos(),
    enabled: entity.fields.some((f) => f.optionsFrom === "produtos"),
  });

  const edicoes = useQuery({
    queryKey: ["lookup", "edicoes"],
    queryFn: () => lookupEdicoes(),
    enabled: entity.fields.some((f) => f.optionsFrom === "edicoes"),
  });

  const lookupMap: Record<string, { id: string; label: string }[]> = {
    produtos: (produtos.data ?? []).map((p) => ({ id: p.id, label: p.nome_produto })),
    edicoes: (edicoes.data ?? []).map((e) => ({ id: e.id, label: e.nome_edicao })),
  };

  const upsertMut = useMutation({
    mutationFn: (payload: any) =>
      upsertEntidade({
        data: {
          table: entity.table,
          id: editing?.id,
          payload,
        },
      }),
    onSuccess: () => {
      toast.success("Salvo");
      setOpen(false);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["cadastro", entity.table] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      deleteEntidade({ data: { table: entity.table, id } }),
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["cadastro", entity.table] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  function openNew() {
    setEditing({});
    setOpen(true);
  }
  function openEdit(row: any) {
    setEditing({ ...row });
    setOpen(true);
  }

  function renderCell(row: any, col: EntityDef["columns"][number]) {
    if (col.render) return col.render(row);
    const v = row[col.key];
    if (col.key === "produto_id") {
      const item = lookupMap.produtos.find((x) => x.id === v);
      return item?.label ?? <span className="text-muted-foreground">—</span>;
    }
    if (col.key === "edicao_id") {
      const item = lookupMap.edicoes.find((x) => x.id === v);
      return item?.label ?? <span className="text-muted-foreground">—</span>;
    }
    if (col.key === "produto_principal_id") {
      const item = lookupMap.produtos.find((x) => x.id === v);
      return item?.label ?? <span className="text-muted-foreground">—</span>;
    }
    return v ?? <span className="text-muted-foreground">—</span>;
  }

  return (
    <Card>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="text-sm text-muted-foreground">
          {list.isLoading ? "Carregando..." : `${list.data?.length ?? 0} registro(s)`}
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4 mr-1" /> Novo
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Editar" : "Novo"} · {entity.label}</DialogTitle>
            </DialogHeader>
            <FormFields
              entity={entity}
              value={editing ?? {}}
              onChange={(v) => setEditing(v)}
              lookupMap={lookupMap}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
              <Button
                onClick={() => {
                  const payload: any = {};
                  for (const f of entity.fields) {
                    let v = editing?.[f.key];
                    if (v === "" || v === undefined) v = null;
                    if (f.type === "number" && v != null) v = Number(v);
                    if (f.required && (v === null || v === "")) {
                      toast.error(`Campo obrigatório: ${f.label}`);
                      return;
                    }
                    payload[f.key] = v;
                  }
                  upsertMut.mutate(payload);
                }}
                disabled={upsertMut.isPending}
              >
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
              {entity.columns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(list.data ?? []).map((row: any) => (
              <TableRow key={row.id}>
                {entity.columns.map((c) => (
                  <TableCell key={c.key}>{renderCell(row, c)}</TableCell>
                ))}
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Remover este registro?")) deleteMut.mutate(row.id);
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(list.data?.length ?? 0) === 0 && !list.isLoading && (
              <TableRow>
                <TableCell colSpan={entity.columns.length + 1} className="text-center text-muted-foreground py-8">
                  Nenhum registro.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function FormFields({
  entity,
  value,
  onChange,
  lookupMap,
}: {
  entity: EntityDef;
  value: any;
  onChange: (v: any) => void;
  lookupMap: Record<string, { id: string; label: string }[]>;
}) {
  return (
    <div className="space-y-3 py-2">
      {entity.fields.map((f) => {
        const v = value?.[f.key] ?? "";
        const set = (newV: any) => onChange({ ...value, [f.key]: newV });
        return (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
            {f.type === "text" && <Input value={v ?? ""} onChange={(e) => set(e.target.value)} />}
            {f.type === "number" && <Input type="number" value={v ?? ""} onChange={(e) => set(e.target.value)} />}
            {f.type === "date" && <Input type="date" value={v ?? ""} onChange={(e) => set(e.target.value)} />}
            {f.type === "color" && (
              <div className="flex gap-2">
                <Input type="color" value={v || "#1E40AF"} onChange={(e) => set(e.target.value)} className="w-16 p-1 h-10" />
                <Input value={v ?? ""} onChange={(e) => set(e.target.value)} placeholder="#000000" />
              </div>
            )}
            {f.type === "boolean" && (
              <Select value={v ? "true" : "false"} onValueChange={(x) => set(x === "true")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Não</SelectItem>
                  <SelectItem value="true">Sim</SelectItem>
                </SelectContent>
              </Select>
            )}
            {f.type === "select" && f.optionsFrom && (
              <Select value={v ?? ""} onValueChange={(x) => set(x || null)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(lookupMap[f.optionsFrom] ?? []).map((opt) => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </div>
  );
}

