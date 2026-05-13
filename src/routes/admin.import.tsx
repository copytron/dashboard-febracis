import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader, Card } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importSheet, previewSheet, getImportHistory } from "@/server/import.functions";
import { syncWindsor } from "@/server/windsor.sync";
import { toast } from "sonner";
import { Download, Upload, RefreshCw, Zap } from "lucide-react";

export const Route = createFileRoute("/admin/import")({
  head: () => ({ meta: [{ title: "Importar planilha · Febracis MKT" }] }),
  component: ImportPage,
});

function ImportPage() {
  const previewFn  = useServerFn(previewSheet);
  const importFn   = useServerFn(importSheet);
  const syncFn     = useServerFn(syncWindsor);
  const qc         = useQueryClient();

  // ── planilha state
  const [sheetUrl,  setSheetUrl]  = useState("");
  const [gidLeads,  setGidLeads]  = useState("");
  const [gidVendas, setGidVendas] = useState("");
  const [preview,   setPreview]   = useState<any>(null);

  // ── windsor state
  const [windsorFrom, setWindsorFrom] = useState("2020-01-01");
  const [syncResult,  setSyncResult]  = useState<any>(null);

  const previewMut = useMutation({
    mutationFn: (gid: string) => previewFn({ data: { sheetUrl, gid: gid || undefined } }),
    onSuccess: (d) => setPreview(d),
    onError: (e: any) => toast.error(e?.message ?? "Erro no preview"),
  });

  const importMut = useMutation({
    mutationFn: (vars: { aba: "leads" | "vendas"; gid: string }) =>
      importFn({ data: { sheetUrl, gid: vars.gid || undefined, aba: vars.aba } }),
    onSuccess: (d, v) => {
      toast.success(`Importação ${v.aba} concluída: ${d.inseridas} linhas`);
      qc.invalidateQueries({ queryKey: ["import-history"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro na importação"),
  });

  const windsorMut = useMutation({
    mutationFn: () =>
      syncFn({ data: { dateFrom: windsorFrom } }),
    onSuccess: (d) => {
      setSyncResult(d);
      toast.success(
        `Sync concluído! ${d.oppInserted} oportunidades · ${d.leadInserted} leads`,
      );
      qc.invalidateQueries({ queryKey: ["import-history"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro no sync Windsor"),
  });

  const historyFn = useServerFn(getImportHistory);
  const history   = useQuery({
    queryKey: ["import-history"],
    queryFn:  () => historyFn({ data: undefined }),
  });

  return (
    <>
      <PageHeader
        title="Importar planilha"
        subtitle="Sincronize Leads e Vendas a partir de uma URL pública do Google Sheets ou via Windsor.ai"
        tutorialKey="import"
      />

      {/* ── Windsor.ai Sync ─────────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="size-4 text-amber-400" />
          <span className="font-semibold text-sm">Sincronizar via Windsor.ai</span>
          <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 ml-1">
            Salesforce CRM
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Importa oportunidades (vendas) e leads diretamente do Salesforce via Windsor.ai.
          A conexão é configurada no servidor — sem necessidade de API Key manual.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div>
            <Label className="text-xs">Data inicial</Label>
            <Input
              type="date"
              value={windsorFrom}
              onChange={(e) => setWindsorFrom(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => windsorMut.mutate()}
            disabled={windsorMut.isPending}
            className="gap-1.5"
          >
            <Zap className="size-3.5" />
            {windsorMut.isPending ? "Sincronizando…" : "Sincronizar agora"}
          </Button>
          {windsorMut.isPending && (
            <span className="text-xs text-muted-foreground animate-pulse">
              Buscando dados do Salesforce… pode levar alguns minutos.
            </span>
          )}
        </div>

        {syncResult && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-xs space-y-1">
            <div className="font-semibold text-emerald-400">Último sync concluído</div>
            <div className="text-muted-foreground">
              Oportunidades gravadas: <span className="text-foreground">{syncResult.oppInserted}</span>
              {syncResult.oppSkipped > 0 && ` (${syncResult.oppSkipped} ignoradas)`}
            </div>
            <div className="text-muted-foreground">
              Leads gravados: <span className="text-foreground">{syncResult.leadInserted}</span>
              {syncResult.leadSkipped > 0 && ` (${syncResult.leadSkipped} ignorados)`}
            </div>
            <div className="text-muted-foreground">
              Período: <span className="text-foreground">{syncResult.dateFrom} → {syncResult.dateTo}</span>
            </div>
          </div>
        )}
      </Card>

      {/* ── Google Sheets ────────────────────────────────────────────────── */}
      <Card className="mb-6">
        <div className="space-y-4">
          <div className="font-semibold text-sm">Importar via Google Sheets</div>
          <div>
            <Label className="text-xs">URL do Google Sheets</Label>
            <Input
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=0"
              className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              A planilha precisa estar com acesso "Qualquer pessoa com o link pode visualizar".
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="font-semibold text-sm">Aba Leads</div>
              <div>
                <Label className="text-xs">gid (opcional)</Label>
                <Input value={gidLeads} onChange={(e) => setGidLeads(e.target.value)} placeholder="Ex: 0" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={() => previewMut.mutate(gidLeads)}
                  disabled={!sheetUrl || previewMut.isPending}
                >
                  <Download className="size-3.5 mr-1.5" /> Pré-visualizar
                </Button>
                <Button
                  size="sm"
                  onClick={() => importMut.mutate({ aba: "leads", gid: gidLeads })}
                  disabled={!sheetUrl || importMut.isPending}
                >
                  <Upload className="size-3.5 mr-1.5" /> Importar Leads
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="font-semibold text-sm">Aba Vendas</div>
              <div>
                <Label className="text-xs">gid (opcional)</Label>
                <Input value={gidVendas} onChange={(e) => setGidVendas(e.target.value)} placeholder="Ex: 123456" className="mt-1" />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline"
                  onClick={() => previewMut.mutate(gidVendas)}
                  disabled={!sheetUrl || previewMut.isPending}
                >
                  <Download className="size-3.5 mr-1.5" /> Pré-visualizar
                </Button>
                <Button
                  size="sm"
                  onClick={() => importMut.mutate({ aba: "vendas", gid: gidVendas })}
                  disabled={!sheetUrl || importMut.isPending}
                >
                  <Upload className="size-3.5 mr-1.5" /> Importar Vendas
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {preview && (
        <Card className="mb-6" title={`Pré-visualização (${preview.total} linhas no total)`}>
          <div className="text-xs mb-3">
            <span className="font-semibold">Mapeamento detectado:</span>{" "}
            {Object.entries(preview.headerMap as Record<string, string>).map(([k, v]) => (
              <span key={k} className="inline-block mr-2 px-2 py-0.5 rounded bg-accent">
                {k} ← <code>{v}</code>
              </span>
            ))}
          </div>
          <div className="overflow-x-auto max-h-[400px] border border-border rounded">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {(preview.headers as string[]).map((h) => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(preview.sample as any[]).map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    {(preview.headers as string[]).map((h) => (
                      <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Histórico ───────────────────────────────────────────────────── */}
      <Card title="Histórico de importações">
        <div className="flex items-center justify-end mb-2">
          <Button variant="ghost" size="sm" onClick={() => history.refetch()}>
            <RefreshCw className="size-3.5 mr-1.5" /> Atualizar
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-4">Quando</th>
                <th className="py-2 pr-4">Tipo</th>
                <th className="py-2 pr-4 text-right">Linhas</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Fonte</th>
              </tr>
            </thead>
            <tbody>
              {(history.data ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2 pr-4">{new Date(r.created_at).toLocaleString("pt-BR")}</td>
                  <td className="py-2 pr-4">{r.aba}</td>
                  <td className="py-2 pr-4 text-right">{r.linhas_inseridas}</td>
                  <td className="py-2 pr-4">
                    <span className={
                      r.status === "success" ? "text-emerald-500" :
                      r.status === "error"   ? "text-red-500"     : "text-muted-foreground"
                    }>{r.status}</span>
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground max-w-[300px] truncate" title={r.url}>
                    {r.url?.startsWith("windsor:") ? "Windsor.ai" : "Google Sheets"}
                  </td>
                </tr>
              ))}
              {!history.data?.length && (
                <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhuma importação ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
