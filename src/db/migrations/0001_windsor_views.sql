-- ─── Índices funcionais para dedup ─────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS rd_vendas_id_venda_uidx
  ON rd_vendas ((data->>'id_venda'))
  WHERE data->>'id_venda' IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS planilha_leads_id_lead_uidx
  ON planilha_leads ((data->>'id_lead'))
  WHERE data->>'id_lead' IS NOT NULL;

-- Índices de busca por email (usados em JOINs e filtros)
CREATE INDEX IF NOT EXISTS rd_vendas_email_idx ON rd_vendas ((lower(data->>'email')));
CREATE INDEX IF NOT EXISTS planilha_leads_email_idx ON planilha_leads ((lower(data->>'email')));

-- ─── Função: derive_canal_v2 ────────────────────────────────────────────────────
-- Espelho da lógica TypeScript em src/lib/canal.ts
-- A ÚLTIMA ORIGEM decide o canal; origem original é fallback.
CREATE OR REPLACE FUNCTION derive_canal_v2(p_ultima_origem text, p_origem text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  fonte text;
  f     text;
BEGIN
  fonte := COALESCE(
    NULLIF(TRIM(COALESCE(p_ultima_origem, '')), ''),
    NULLIF(TRIM(COALESCE(p_origem, '')), '')
  );
  IF fonte IS NULL THEN RETURN 'Sem Atribuição'; END IF;
  f := lower(fonte);

  IF f ~ 'youtube|\[yt\]|\yyt\y|iex app'
    THEN RETURN 'YouTube'; END IF;

  IF f ~ 'email|e-mail|mailchimp|rdstation|whats|wpp|whatsapp|sz chat|sz_chat|disparo marketing|hotmart|emkt|email mkt'
    THEN RETURN 'CRM'; END IF;

  IF f ~ 'social seller|\yss\y|ss mcis|ss pv|ss cv|indica|aluno cis|ex-aluno|ex aluno|stand cis|ativacao comercial|ativação comercial|avalon - social|cliente base'
    THEN RETURN 'Redes'; END IF;

  IF f ~ '\[fb\]|\[go\]|\[cm\]|\[ck\]|\[lp\]|\[vsl\]|\[pgven\]|form - meta|meta lead ads|trafego|tráfego|lead tra|\yads\y|typeform|masterclass|meteorico|meteórico|mulheres experience|ia mcis|ia avalon|black november|black friday|pre-venda|live pv|fbcis|^lp |lp -'
    THEN RETURN 'Mídia'; END IF;

  IF f ~ '\[org\]|organico|orgânico|organic|\yseo\y|\ysite\y'
    THEN RETURN 'Orgânicos'; END IF;

  IF f ~ 'pedido|cortesia|bonux|bonus|bônus|transferido|checkout|base dksoft|lista de espera'
    THEN RETURN 'Operacional'; END IF;

  RETURN 'Outros';
END;
$$;

-- ─── View: vendas_atribuidas ────────────────────────────────────────────────────
-- Lê direto de rd_vendas (JSONB). Canal derivado pela função acima.
-- tipo_atribuicao = 'Sem Atribuição' até que o pipeline de bridge seja executado.
CREATE OR REPLACE VIEW vendas_atribuidas AS
SELECT
  COALESCE(data->>'id_venda', id::text)                       AS id,
  data->>'nome_cliente'                                        AS nome,
  data->>'email'                                               AS email,
  data->>'turma'                                               AS turma,
  data->>'curso'                                               AS curso,
  (NULLIF(data->>'valor', ''))::numeric                        AS valor,
  (NULLIF(data->>'valor_convertido', ''))::numeric             AS valor_convertido,
  data->>'estado'                                              AS estado,
  data->>'cidade'                                              AS cidade,
  data->>'fase'                                                AS fase,
  data->>'promocao'                                            AS promocao,
  data->>'pacote'                                              AS pacote,
  data->>'canal_venda'                                         AS canal_venda,
  data->>'utm_source'                                          AS utm_origem,
  data->>'utm_medium'                                          AS utm_midia,
  data->>'utm_campaign'                                        AS utm_campanha,
  data->>'utm_content'                                         AS utm_conteudo,
  data->>'utm_term'                                            AS utm_termo,
  data->>'origem_lead'                                         AS origem_lead,
  data->>'ultima_origem_lead'                                  AS ultima_origem_lead,
  COALESCE(data->>'ultima_origem_lead', data->>'origem_lead')  AS origem_principal,
  CASE
    WHEN data->>'data_matricula' ~ '^\d{4}-\d{2}-\d{2}'
    THEN SUBSTRING(data->>'data_matricula', 1, 10)::date
    ELSE NULL
  END                                                          AS data_matricula,
  CASE
    WHEN data->>'data_criacao' ~ '^\d{4}-\d{2}-\d{2}'
    THEN (data->>'data_criacao')::timestamptz
    ELSE NULL
  END                                                          AS data_criacao,
  CASE
    WHEN data->>'data_aprovacao' ~ '^\d{4}-\d{2}-\d{2}'
    THEN (data->>'data_aprovacao')::timestamptz
    ELSE NULL
  END                                                          AS data_aprovacao,
  derive_canal_v2(data->>'ultima_origem_lead', data->>'origem_lead') AS canal,
  'Sem Atribuição'::text                                       AS tipo_atribuicao,
  NULL::text                                                   AS tipo_match,
  NULL::numeric                                                AS match_score,
  NULL::integer                                                AS match_lag_days,
  NULL::text                                                   AS fonte_atribuicao
FROM rd_vendas;

-- ─── View: jornada_normalizada ──────────────────────────────────────────────────
-- Jornada de leads por email: um registro por toque de lead × venda.
-- Usado na aba Vendas para expandir detalhes de lead.
CREATE OR REPLACE VIEW jornada_normalizada AS
WITH lead_ranked AS (
  SELECT
    pl.id                              AS lead_row_id,
    pl.data->>'email'                  AS email,
    lower(pl.data->>'email')           AS email_lower,
    pl.data->>'utm_source'             AS utm_source,
    pl.data->>'utm_campaign'           AS utm_campaign,
    pl.data->>'utm_content'            AS utm_content,
    pl.data->>'origem_lead'            AS origem_lead,
    pl.data->>'data_lead'              AS data_lead,
    ROW_NUMBER() OVER (
      PARTITION BY lower(pl.data->>'email')
      ORDER BY (pl.data->>'data_lead') ASC NULLS LAST, pl.id ASC
    )                                  AS rn,
    COUNT(*) OVER (
      PARTITION BY lower(pl.data->>'email')
    )                                  AS cnt_leads
  FROM planilha_leads pl
  WHERE pl.data->>'email' IS NOT NULL
    AND pl.data->>'email' <> ''
),
venda_ref AS (
  SELECT DISTINCT ON (lower(data->>'email'), data->>'turma')
    lower(data->>'email')              AS email_lower,
    data->>'turma'                     AS turma,
    CASE
      WHEN data->>'data_matricula' ~ '^\d{4}-\d{2}-\d{2}'
      THEN SUBSTRING(data->>'data_matricula', 1, 10)::date
      ELSE NULL
    END                                AS data_matricula
  FROM rd_vendas
  WHERE data->>'email' IS NOT NULL
    AND data->>'email' <> ''
  ORDER BY lower(data->>'email'), data->>'turma', id DESC
)
SELECT
  COALESCE(lr.email, lr.email_lower)   AS email,
  vr.turma,
  lr.rn::integer                       AS toque_num,
  CASE
    WHEN lr.cnt_leads = 1              THEN 'Único'
    WHEN lr.rn = 1                     THEN 'Primeiro Toque'
    WHEN lr.rn = lr.cnt_leads          THEN 'Último Toque'
    ELSE                                    'Intermediário'
  END                                  AS tipo,
  lr.data_lead,
  CASE
    WHEN vr.data_matricula IS NOT NULL
      AND lr.data_lead ~ '^\d{4}-\d{2}-\d{2}'
    THEN (vr.data_matricula - SUBSTRING(lr.data_lead, 1, 10)::date)
    ELSE NULL
  END                                  AS dias_antes_compra,
  derive_canal_v2(lr.utm_source, lr.origem_lead) AS canal_normalizado,
  lr.utm_campaign                      AS utm_campanha,
  lr.utm_content                       AS utm_conteudo,
  lr.utm_source                        AS utm_origem
FROM lead_ranked lr
JOIN venda_ref vr ON vr.email_lower = lr.email_lower;
