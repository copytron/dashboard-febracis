/**
 * Sincronização Windsor.ai → Postgres via MCP Client local.
 *
 * Usa o MCP Server Windsor in-process para buscar dados do Salesforce,
 * transformar e inserir no banco. Chamado via RPC (windsor.sync.ts) ou cron.
 */
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { planilhaImports } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getWindsorClient } from "./mcp/windsor/client.js";

// ─── Campos Salesforce ──────────────────────────────────────────────────────

const SALESFORCE_ACCOUNT = "felipemelare@febracis.com.br";

/** Todos os campos de oportunidade extraídos do Salesforce (42 campos da planilha) */
const OPPORTUNITY_FIELDS = [
  "opportunity_id",
  "opportunity_name",
  "opportunity_stage_name",
  "opportunity_amount",
  "opportunity_valorfinal__c",
  "opportunity_currency",
  "opportunity_nome__c",
  "opportunity_clienteemail__c",
  "opportunity_clientecelular__c",
  "opportunity_clientetelefone__c",
  "opportunity_clienteestado__c",
  "opportunity_clientecidade__c",
  "opportunity_cliente__c",
  "opportunity_turma__c",
  "opportunity_nomecurso__c",
  "opportunity_c_digo_do_curso__c",
  "opportunity_promocoes__c",
  "opportunity_pacote_comp__c",
  "opportunity_canal_venda__c",
  "opportunity_modalidade__c",
  "opportunity_tipoorigem__c",
  "opportunity_contato__c",
  "opportunity_unidade__c",
  "opportunity_codigodaunidadegeradora__c",
  "opportunity_codigounidaderealizadora__c",
  "opportunity_unidade_geradora_venda__c",
  "opportunity_aprovador_da_venda__c",
  "opportunity_quantidadeparcelas__c",
  "opportunity_quantidadepessoas__c",
  "opportunity_email_indicador__c",
  "opportunity_mesvenda__c",
  "opportunity_hora_da_criacao__c",
  "opportunity_leadorigem__c",
  "opportunity_lead_source",
  "opportunity_ultimaorigemlead__c",
  "opportunity_utm_source__c",
  "opportunity_utm_medium__c",
  "opportunity_utm_campaign__c",
  "opportunity_utm_content__c",
  "opportunity_utm_term__c",
  "opportunity_utm_src__c",
  "opportunity_created_date",
  "opportunity_data_de_aprova_o__c",
  "opportunity_close_date",
  "opportunity_last_activity_date",
  "opportunity_account_name",
];

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
];

// ─── Mapeadores de campo ────────────────────────────────────────────────────

function cleanSfNumeric(val: any): string | null {
  const s = (val ?? "").toString().trim().replace(/\.0$/, "");
  return s && s !== "0" ? s : null;
}

function mapOpportunity(opp: any): any {
  const valor = Number(opp.opportunity_amount ?? 0) || 0;
  const valorFinal = Number(opp.opportunity_valorfinal__c ?? 0) || 0;
  const unidadeGeradora = cleanSfNumeric(opp.opportunity_codigodaunidadegeradora__c);

  return {
    id_venda:                opp.opportunity_id,
    nome_venda:              opp.opportunity_name,
    email:                   opp.opportunity_clienteemail__c ?? null,
    nome_cliente:            opp.opportunity_nome__c ?? null,
    telefone:                opp.opportunity_clientecelular__c ?? null,
    telefone_fixo:           opp.opportunity_clientetelefone__c ?? null,
    estado:                  opp.opportunity_clienteestado__c ?? null,
    cidade:                  opp.opportunity_clientecidade__c ?? null,
    cliente_id:              opp.opportunity_cliente__c ?? null,
    turma:                   opp.opportunity_turma__c ?? null,
    curso:                   opp.opportunity_nomecurso__c ?? null,
    codigo_curso:            opp.opportunity_c_digo_do_curso__c ?? null,
    fase:                    opp.opportunity_stage_name ?? null,
    valor:                   valor,
    valor_convertido:        valorFinal > 0 ? valorFinal : valor,
    moeda:                   opp.opportunity_currency ?? null,
    canal_venda:             opp.opportunity_canal_venda__c ?? null,
    modalidade:              opp.opportunity_modalidade__c ?? null,
    tipo_origem:             opp.opportunity_tipoorigem__c ?? null,
    contato:                 opp.opportunity_contato__c ?? null,
    promocao:                opp.opportunity_promocoes__c ?? null,
    pacote:                  opp.opportunity_pacote_comp__c ?? null,
    unidade:                 opp.opportunity_unidade__c ?? null,
    unidade_geradora:        unidadeGeradora,
    codigo_unidade_realizadora: cleanSfNumeric(opp.opportunity_codigounidaderealizadora__c),
    unidade_geradora_venda:  opp.opportunity_unidade_geradora_venda__c ?? null,
    conta:                   opp.opportunity_account_name ?? null,
    aprovador_venda:         opp.opportunity_aprovador_da_venda__c ?? null,
    quantidade_parcelas:     opp.opportunity_quantidadeparcelas__c ?? null,
    quantidade_pessoas:      opp.opportunity_quantidadepessoas__c ?? null,
    email_indicador:         opp.opportunity_email_indicador__c ?? null,
    mes_venda:               opp.opportunity_mesvenda__c ?? null,
    hora_criacao:            opp.opportunity_hora_da_criacao__c ?? null,
    lead_origem:             opp.opportunity_leadorigem__c ?? null,
    origem_lead:             opp.opportunity_lead_source ?? null,
    ultima_origem_lead:      opp.opportunity_ultimaorigemlead__c ?? null,
    utm_source:              opp.opportunity_utm_source__c ?? null,
    utm_medium:              opp.opportunity_utm_medium__c ?? null,
    utm_campaign:            opp.opportunity_utm_campaign__c ?? null,
    utm_content:             opp.opportunity_utm_content__c ?? null,
    utm_term:                opp.opportunity_utm_term__c ?? null,
    utm_src:                 opp.opportunity_utm_src__c ?? null,
    data_matricula:          opp.opportunity_close_date ?? null,
    data_criacao:            opp.opportunity_created_date ?? null,
    data_aprovacao:          opp.opportunity_data_de_aprova_o__c ?? null,
    ultima_atividade:        opp.opportunity_last_activity_date ?? null,
    source:                  "windsor_salesforce",
  };
}

function mapLead(lead: any): any {
  const unidadeGeradora = cleanSfNumeric(lead.lead_codigounidadegeradora__c);

  return {
    id_lead:          lead.lead_id,
    nome:             lead.lead_last_name ?? null,
    email:            lead.lead_email ?? null,
    status:           lead.lead_status ?? null,
    origem_lead:      lead.lead_lead_source ?? null,
    data_lead:        lead.lead_created_date ?? null,
    estado:           lead.lead_estado__c ?? null,
    cidade:           lead.lead_cidade_de_resid_ncia__c ?? null,
    telefone:         lead.lead_celular__c ?? null,
    utm_source:       lead.lead_utm_source__c ?? null,
    utm_medium:       lead.lead_utm_medium__c ?? null,
    utm_campaign:     lead.lead_utm_campaign__c ?? null,
    utm_content:      lead.lead_utm_content__c ?? null,
    utm_term:         lead.lead_utm_term__c ?? null,
    url_cadastro:     lead.lead_page_url__c ?? null,
    utm_src:          lead.lead_utm_src__c ?? null,
    unidade_geradora: unidadeGeradora,
    source:           "windsor_salesforce",
  };
}

// ─── Sync principal via MCP ─────────────────────────────────────────────────

const CHUNK = 100;

export async function runWindsorSync(input: { dateFrom: string; dateTo?: string }) {
  const windsor = getWindsorClient();
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
    const opps = await windsor.getData({
      connector: "salesforce",
      fields: OPPORTUNITY_FIELDS,
      accounts: [SALESFORCE_ACCOUNT],
      date_from: dateFrom,
      date_to: dateTo,
    });

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
    const leads = await windsor.getData({
      connector: "salesforce",
      fields: LEAD_FIELDS,
      accounts: [SALESFORCE_ACCOUNT],
      date_from: dateFrom,
      date_to: dateTo,
    });

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

  // ── 3. Auto-popular turma_lookup para SF IDs sem mapeamento ────────────────
  try {
    await db.execute(sql`
      INSERT INTO turma_lookup (sf_id, codigo_turma, codigo_curso)
      SELECT DISTINCT
        data->>'turma' AS sf_id,
        data->>'turma' AS codigo_turma,
        COALESCE(data->>'codigo_curso', data->>'curso') AS codigo_curso
      FROM rd_vendas
      WHERE data->>'turma' IS NOT NULL
        AND data->>'turma' <> ''
        AND NOT EXISTS (
          SELECT 1 FROM turma_lookup tl WHERE tl.sf_id = data->>'turma'
        )
      ON CONFLICT (sf_id) DO NOTHING
    `);
  } catch (_err) {
    // Non-critical — don't block sync
  }

  // ── 4. Atualizar lookup de unidades geradoras ──────────────────────────────
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
