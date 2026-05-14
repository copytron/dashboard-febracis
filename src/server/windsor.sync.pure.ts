/**
 * Lógica pura de sincronização Windsor.ai → Postgres.
 * Extraída do createServerFn para poder ser chamada tanto
 * via RPC (windsor.sync.ts) quanto via cron (cron.ts).
 */
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { planilhaImports } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─── Windsor.ai REST API ─────────────────────────────────────────────────────

const WINDSOR_BASE = "https://connectors.windsor.ai";

const OPP_FIELDS = [
  "opportunity_id",
  "opportunity_name",
  "opportunity_stage_name",
  "opportunity_amount",
  "opportunity_valorfinal__c",
  "opportunity_nome__c",
  "opportunity_clienteemail__c",
  "opportunity_clientecelular__c",
  "opportunity_clienteestado__c",
  "opportunity_clientecidade__c",
  "opportunity_turma__c",
  "opportunity_utm_source__c",
  "opportunity_utm_medium__c",
  "opportunity_utm_campaign__c",
  "opportunity_utm_content__c",
  "opportunity_utm_term__c",
  "opportunity_lead_source",
  "opportunity_ultimaorigemlead__c",
  "opportunity_created_date",
  "opportunity_data_de_aprova_o__c",
  "opportunity_close_date",
  "opportunity_canal_venda__c",
  "opportunity_promocoes__c",
  "opportunity_pacote_comp__c",
  "opportunity_nomecurso__c",
  "opportunity_leadorigem__c",
  "opportunity_c_digo_do_curso__c",
  "opportunity_account_name",
  "opportunity_codigodaunidadegeradora__c",
  "opportunity_unidade_geradora_venda__c",
  "opportunity_utm_src__c",
].join(",");

const LEAD_FIELDS = [
  "lead_id",
  "lead_last_name",
  "lead_email",
  "lead_status",
  "lead_lead_source",
  "lead_created_date",
  "lead_estado__c",
  "lead_cidade_de_resid_ncia__c",
  "lead_celular__c",
  "lead_utm_source__c",
  "lead_utm_medium__c",
  "lead_utm_campaign__c",
  "lead_utm_content__c",
  "lead_utm_term__c",
  "lead_page_url__c",
  "lead_utm_src__c",
  "lead_codigounidadegeradora__c",
  "lead_unidadegeradora__c",
].join(",");

async function fetchWindsorData(
  apiKey: string,
  connector: string,
  fields: string,
  dateFrom: string,
  dateTo: string,
): Promise<any[]> {
  const url = new URL(`${WINDSOR_BASE}/${connector}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", fields);
  url.searchParams.set("date_from", dateFrom);
  url.searchParams.set("date_to", dateTo);

  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Windsor.ai erro ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  return Array.isArray(json) ? json : (json?.data ?? []);
}

// ─── Mapeadores de campo ──────────────────────────────────────────────────────

function mapOpportunity(opp: any): any {
  const valor = Number(opp.opportunity_amount ?? 0) || 0;
  const valorFinal = Number(opp.opportunity_valorfinal__c ?? 0) || 0;

  // Código numérico da unidade geradora (limpar ".0" do Salesforce)
  const ugCodigo = (opp.opportunity_codigodaunidadegeradora__c ?? "").toString().trim().replace(/\.0$/, "");
  const unidadeGeradora = ugCodigo && ugCodigo !== "0" ? ugCodigo : null;

  return {
    id_venda:         opp.opportunity_id,
    nome_venda:       opp.opportunity_name,
    email:            opp.opportunity_clienteemail__c ?? null,
    nome_cliente:     opp.opportunity_nome__c ?? null,
    telefone:         opp.opportunity_clientecelular__c ?? null,
    estado:           opp.opportunity_clienteestado__c ?? null,
    cidade:           opp.opportunity_clientecidade__c ?? null,
    turma:            opp.opportunity_turma__c ?? null,
    curso:            opp.opportunity_nomecurso__c ?? null,
    codigo_curso:     opp.opportunity_c_digo_do_curso__c ?? null,
    fase:             opp.opportunity_stage_name ?? null,
    valor:            valor,
    valor_convertido: valorFinal > 0 ? valorFinal : valor,
    canal_venda:      opp.opportunity_canal_venda__c ?? null,
    promocao:         opp.opportunity_promocoes__c ?? null,
    pacote:           opp.opportunity_pacote_comp__c ?? null,
    lead_origem:      opp.opportunity_leadorigem__c ?? null,
    origem_lead:      opp.opportunity_lead_source ?? null,
    ultima_origem_lead: opp.opportunity_ultimaorigemlead__c ?? null,
    utm_source:       opp.opportunity_utm_source__c ?? null,
    utm_medium:       opp.opportunity_utm_medium__c ?? null,
    utm_campaign:     opp.opportunity_utm_campaign__c ?? null,
    utm_content:      opp.opportunity_utm_content__c ?? null,
    utm_term:         opp.opportunity_utm_term__c ?? null,
    utm_src:          opp.opportunity_utm_src__c ?? null,
    data_matricula:   opp.opportunity_close_date ?? null,
    data_criacao:     opp.opportunity_created_date ?? null,
    data_aprovacao:   opp.opportunity_data_de_aprova_o__c ?? null,
    unidade_geradora: unidadeGeradora,
    source:           "windsor_salesforce",
  };
}

function mapLead(lead: any): any {
  // Código numérico da unidade geradora (limpar ".0" do Salesforce)
  const ugCodigo = (lead.lead_codigounidadegeradora__c ?? "").toString().trim().replace(/\.0$/, "");
  const unidadeGeradora = ugCodigo && ugCodigo !== "0" ? ugCodigo : null;

  return {
    id_lead:     lead.lead_id,
    nome:        lead.lead_last_name ?? null,
    email:       lead.lead_email ?? null,
    status:      lead.lead_status ?? null,
    origem_lead: lead.lead_lead_source ?? null,
    data_lead:   lead.lead_created_date ?? null,
    estado:      lead.lead_estado__c ?? null,
    cidade:      lead.lead_cidade_de_resid_ncia__c ?? null,
    telefone:    lead.lead_celular__c ?? null,
    utm_source:  lead.lead_utm_source__c ?? null,
    utm_medium:  lead.lead_utm_medium__c ?? null,
    utm_campaign: lead.lead_utm_campaign__c ?? null,
    utm_content: lead.lead_utm_content__c ?? null,
    utm_term:    lead.lead_utm_term__c ?? null,
    url_cadastro: lead.lead_page_url__c ?? null,
    utm_src:     lead.lead_utm_src__c ?? null,
    unidade_geradora: unidadeGeradora,
    source:      "windsor_salesforce",
  };
}

// ─── Sync principal ──────────────────────────────────────────────────────────

const CHUNK = 100;

export async function runWindsorSync(input: { dateFrom: string; dateTo?: string }) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) throw new Error("WINDSOR_API_KEY não configurada no servidor.");
  const dateTo   = input.dateTo ?? new Date().toISOString().slice(0, 10);
  const dateFrom = input.dateFrom;

  let oppInserted  = 0;
  let oppSkipped   = 0;
  let leadInserted = 0;
  let leadSkipped  = 0;

  // ── 1. Oportunidades (rd_vendas) ─────────────────────────────────────────
  const [batchOpp] = await db
    .insert(planilhaImports)
    .values({
      tipo:        "windsor_oportunidades",
      url:         `windsor:salesforce:opps:${dateFrom}:${dateTo}`,
      status:      "running",
      totalRows:   0,
      importedRows: 0,
    })
    .returning({ id: planilhaImports.id });

  if (!batchOpp) throw new Error("Falha ao criar batch de oportunidades.");

  try {
    const opps = await fetchWindsorData(apiKey, "salesforce", OPP_FIELDS, dateFrom, dateTo);

    await db
      .update(planilhaImports)
      .set({ totalRows: opps.length })
      .where(eq(planilhaImports.id, batchOpp.id));

    for (let i = 0; i < opps.length; i += CHUNK) {
      const chunk = opps.slice(i, i + CHUNK);
      for (const opp of chunk) {
        const mapped = mapOpportunity(opp);
        if (!mapped.id_venda) { oppSkipped++; continue; }

        await db.execute(sql`
          INSERT INTO rd_vendas (import_id, data)
          VALUES (${batchOpp.id}, ${JSON.stringify(mapped)}::jsonb)
          ON CONFLICT ((data->>'id_venda')) DO UPDATE
            SET data = ${JSON.stringify(mapped)}::jsonb,
                import_id = ${batchOpp.id}
        `);
        oppInserted++;
      }
      await db
        .update(planilhaImports)
        .set({ importedRows: oppInserted })
        .where(eq(planilhaImports.id, batchOpp.id));
    }

    await db
      .update(planilhaImports)
      .set({ status: "success", importedRows: oppInserted })
      .where(eq(planilhaImports.id, batchOpp.id));
  } catch (err: any) {
    await db
      .update(planilhaImports)
      .set({ status: "error" })
      .where(eq(planilhaImports.id, batchOpp.id));
    throw new Error(`Erro ao sincronizar oportunidades: ${err?.message ?? err}`);
  }

  // ── 2. Leads (planilha_leads) ────────────────────────────────────────────
  const [batchLead] = await db
    .insert(planilhaImports)
    .values({
      tipo:        "windsor_leads",
      url:         `windsor:salesforce:leads:${dateFrom}:${dateTo}`,
      status:      "running",
      totalRows:   0,
      importedRows: 0,
    })
    .returning({ id: planilhaImports.id });

  if (!batchLead) throw new Error("Falha ao criar batch de leads.");

  try {
    const leads = await fetchWindsorData(apiKey, "salesforce", LEAD_FIELDS, dateFrom, dateTo);

    await db
      .update(planilhaImports)
      .set({ totalRows: leads.length })
      .where(eq(planilhaImports.id, batchLead.id));

    for (let i = 0; i < leads.length; i += CHUNK) {
      const chunk = leads.slice(i, i + CHUNK);
      for (const lead of chunk) {
        const mapped = mapLead(lead);
        if (!mapped.email && !mapped.telefone) { leadSkipped++; continue; }
        if (!mapped.id_lead) { leadSkipped++; continue; }

        await db.execute(sql`
          INSERT INTO planilha_leads (import_id, data)
          VALUES (${batchLead.id}, ${JSON.stringify(mapped)}::jsonb)
          ON CONFLICT ((data->>'id_lead')) DO UPDATE
            SET data = ${JSON.stringify(mapped)}::jsonb,
                import_id = ${batchLead.id}
        `);
        leadInserted++;
      }
      await db
        .update(planilhaImports)
        .set({ importedRows: leadInserted })
        .where(eq(planilhaImports.id, batchLead.id));
    }

    await db
      .update(planilhaImports)
      .set({ status: "success", importedRows: leadInserted })
      .where(eq(planilhaImports.id, batchLead.id));
  } catch (err: any) {
    await db
      .update(planilhaImports)
      .set({ status: "error" })
      .where(eq(planilhaImports.id, batchLead.id));
    throw new Error(`Erro ao sincronizar leads: ${err?.message ?? err}`);
  }

  // ── 3. Atualizar lookup de unidades geradoras ──────────────────────────────
  try {
    await db.execute(sql`
      INSERT INTO unidade_geradora_lookup (codigo, sf_id, updated_at)
      SELECT DISTINCT
        data->>'unidade_geradora' AS codigo,
        COALESCE(
          (SELECT data->>'unidade_geradora' FROM rd_vendas rv2
           WHERE rv2.data->>'unidade_geradora' = rv.data->>'unidade_geradora'
           LIMIT 1),
          ''
        ) AS sf_id,
        now()
      FROM rd_vendas rv
      WHERE data->>'unidade_geradora' IS NOT NULL
        AND data->>'unidade_geradora' <> ''
      ON CONFLICT (codigo) DO UPDATE
        SET updated_at = now()
    `);
  } catch (_err) {
    // Tabela pode não existir ainda (migration pendente) — não bloquear o sync
  }

  return {
    ok: true,
    oppInserted,
    oppSkipped,
    leadInserted,
    leadSkipped,
    dateFrom,
    dateTo,
  };
}
