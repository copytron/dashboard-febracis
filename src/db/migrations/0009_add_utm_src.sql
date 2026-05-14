-- Adiciona campo utm_src à view vendas_atribuidas
-- SRC é um campo separado de utm_source, usado para "setor de interesse" do lead
DROP VIEW IF EXISTS vendas_atribuidas CASCADE;
CREATE VIEW vendas_atribuidas AS
SELECT
  COALESCE(data->>'id_venda', id::text)                       AS id,
  data->>'nome_cliente'                                        AS nome,
  data->>'email'                                               AS email,
  COALESCE(tl.codigo_turma, data->>'turma')                    AS turma,
  COALESCE(data->>'codigo_curso', tl.codigo_curso, data->>'curso') AS curso,
  (NULLIF(data->>'valor', ''))::numeric                        AS valor,
  (NULLIF(data->>'valor_convertido', ''))::numeric             AS valor_convertido,
  data->>'estado'                                              AS estado,
  data->>'cidade'                                              AS cidade,
  data->>'fase'                                                AS fase,
  data->>'promocao'                                            AS promocao,
  data->>'pacote'                                              AS pacote,
  data->>'canal_venda'                                         AS canal_venda,
  data->>'unidade_geradora'                                    AS unidade_geradora,
  data->>'utm_source'                                          AS utm_origem,
  data->>'utm_medium'                                          AS utm_midia,
  data->>'utm_campaign'                                        AS utm_campanha,
  data->>'utm_content'                                         AS utm_conteudo,
  data->>'utm_term'                                            AS utm_termo,
  data->>'utm_src'                                             AS utm_src,
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
  derive_canal_dynamic(
    data->>'ultima_origem_lead',
    data->>'origem_lead',
    data->>'utm_source',
    data->>'utm_medium',
    data->>'utm_campaign'
  )                                                            AS canal,
  'Sem Atribuição'::text                                       AS tipo_atribuicao,
  NULL::text                                                   AS tipo_match,
  NULL::numeric                                                AS match_score,
  NULL::integer                                                AS match_lag_days,
  NULL::text                                                   AS fonte_atribuicao
FROM rd_vendas
LEFT JOIN turma_lookup tl ON tl.sf_id = data->>'turma';

-- Recriar jornada_normalizada (DROP necessário porque nova coluna unidade_geradora muda posição)
DROP VIEW IF EXISTS jornada_normalizada CASCADE;
CREATE VIEW jornada_normalizada AS
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
    data->>'unidade_geradora'          AS unidade_geradora,
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
  vr.unidade_geradora,
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
