-- Tabela de lookup para resolver IDs de turma do Salesforce em nomes legíveis
CREATE TABLE IF NOT EXISTS turma_lookup (
  sf_id text PRIMARY KEY,
  codigo_turma text,
  codigo_curso text,
  cidade text,
  data_inicial timestamptz
);

-- Atualizar view vendas_atribuidas para incluir turma legível
CREATE OR REPLACE VIEW vendas_atribuidas AS
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
