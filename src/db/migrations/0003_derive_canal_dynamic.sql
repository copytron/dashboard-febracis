-- Função dinâmica de derivação de canal que lê regras da tabela regras_classificacao.
-- Fallback para derive_canal_v2() quando nenhuma regra customizada match.

CREATE OR REPLACE FUNCTION derive_canal_dynamic(
  p_ultima_origem text,
  p_origem text,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  regra RECORD;
  cond  jsonb;
  campo_val text;
  cond_match boolean;
  all_matched boolean;
  any_matched boolean;
  op text;
  val text;
  is_or boolean;
BEGIN
  -- Iterar regras ativas em ordem de prioridade
  FOR regra IN
    SELECT canal, config
    FROM regras_classificacao
    WHERE ativo = true
      AND config IS NOT NULL
      AND config->'condicoes' IS NOT NULL
      AND jsonb_array_length(config->'condicoes') > 0
    ORDER BY prioridade ASC
  LOOP
    is_or := (regra.config->>'logica') = 'OR';
    all_matched := true;
    any_matched := false;

    FOR cond IN SELECT * FROM jsonb_array_elements(regra.config->'condicoes')
    LOOP
      -- Determinar o valor do campo
      campo_val := lower(COALESCE(
        CASE cond->>'campo'
          WHEN 'ultima_origem_lead' THEN p_ultima_origem
          WHEN 'origem_lead'        THEN p_origem
          WHEN 'utm_source'         THEN p_utm_source
          WHEN 'utm_medium'         THEN p_utm_medium
          WHEN 'utm_campaign'       THEN p_utm_campaign
          ELSE ''
        END,
        ''
      ));

      op  := cond->>'operador';
      val := lower(COALESCE(cond->>'valor', ''));

      cond_match := CASE op
        WHEN 'contem'     THEN campo_val LIKE '%' || val || '%'
        WHEN 'nao_contem' THEN campo_val NOT LIKE '%' || val || '%'
        WHEN 'igual'      THEN campo_val = val
        WHEN 'comeca_com' THEN campo_val LIKE val || '%'
        WHEN 'regex'      THEN campo_val ~ val
        ELSE false
      END;

      IF is_or THEN
        any_matched := any_matched OR cond_match;
      ELSE
        all_matched := all_matched AND cond_match;
      END IF;
    END LOOP;

    IF (is_or AND any_matched) OR (NOT is_or AND all_matched) THEN
      RETURN regra.canal;
    END IF;
  END LOOP;

  -- Fallback: regex hardcoded
  RETURN derive_canal_v2(p_ultima_origem, p_origem);
END;
$$;

-- ─── Atualizar view vendas_atribuidas para usar derive_canal_dynamic ──────────
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
FROM rd_vendas;

-- ─── Atualizar view jornada_normalizada para usar derive_canal_dynamic ────────
CREATE OR REPLACE VIEW jornada_normalizada AS
WITH lead_ranked AS (
  SELECT
    pl.id                              AS lead_row_id,
    pl.data->>'email'                  AS email,
    lower(pl.data->>'email')           AS email_lower,
    pl.data->>'utm_source'             AS utm_source,
    pl.data->>'utm_medium'             AS utm_medium,
    pl.data->>'utm_campaign'           AS utm_campaign,
    pl.data->>'utm_content'            AS utm_content,
    pl.data->>'origem_lead'            AS origem_lead,
    pl.data->>'ultima_origem_lead'     AS ultima_origem_lead,
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
  derive_canal_dynamic(
    lr.ultima_origem_lead,
    lr.origem_lead,
    lr.utm_source,
    lr.utm_medium,
    lr.utm_campaign
  )                                    AS canal_normalizado,
  lr.utm_campaign                      AS utm_campanha,
  lr.utm_content                       AS utm_conteudo,
  lr.utm_source                        AS utm_origem
FROM lead_ranked lr
JOIN venda_ref vr ON vr.email_lower = lr.email_lower;
