-- Atualiza derive_canal_dynamic para suportar grupos de condições aninhados.
-- Formato novo: config = { logica_grupos: "AND"|"OR", grupos: [{ logica: "AND"|"OR", condicoes: [...] }] }
-- Mantém compatibilidade com formato legado: config = { logica: "AND"|"OR", condicoes: [...] }

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
  grupo jsonb;
  cond  jsonb;
  campo_val text;
  cond_match boolean;
  grupo_match boolean;
  all_groups_matched boolean;
  any_group_matched boolean;
  is_grupos_or boolean;
  is_grupo_or boolean;
  op text;
  val text;
  has_grupos boolean;
BEGIN
  FOR regra IN
    SELECT canal, config
    FROM regras_classificacao
    WHERE ativo = true
      AND config IS NOT NULL
    ORDER BY prioridade ASC
  LOOP
    -- Detectar formato: novo (grupos) ou legado (condicoes)
    has_grupos := (regra.config->'grupos' IS NOT NULL
                   AND jsonb_typeof(regra.config->'grupos') = 'array'
                   AND jsonb_array_length(regra.config->'grupos') > 0);

    IF has_grupos THEN
      -- ═══ Formato novo: grupos de condições ═══
      is_grupos_or := COALESCE(regra.config->>'logica_grupos', 'OR') = 'OR';
      all_groups_matched := true;
      any_group_matched := false;

      FOR grupo IN SELECT * FROM jsonb_array_elements(regra.config->'grupos')
      LOOP
        IF jsonb_typeof(grupo->'condicoes') <> 'array' OR jsonb_array_length(grupo->'condicoes') = 0 THEN
          CONTINUE;
        END IF;

        is_grupo_or := COALESCE(grupo->>'logica', 'OR') = 'OR';
        DECLARE
          all_cond_matched boolean := true;
          any_cond_matched boolean := false;
        BEGIN
          FOR cond IN SELECT * FROM jsonb_array_elements(grupo->'condicoes')
          LOOP
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

            IF is_grupo_or THEN
              any_cond_matched := any_cond_matched OR cond_match;
            ELSE
              all_cond_matched := all_cond_matched AND cond_match;
            END IF;
          END LOOP;

          grupo_match := CASE WHEN is_grupo_or THEN any_cond_matched ELSE all_cond_matched END;
        END;

        IF is_grupos_or THEN
          any_group_matched := any_group_matched OR grupo_match;
        ELSE
          all_groups_matched := all_groups_matched AND grupo_match;
        END IF;
      END LOOP;

      IF (is_grupos_or AND any_group_matched) OR (NOT is_grupos_or AND all_groups_matched) THEN
        RETURN regra.canal;
      END IF;

    ELSE
      -- ═══ Formato legado: condicoes flat ═══
      IF regra.config->'condicoes' IS NULL
         OR jsonb_typeof(regra.config->'condicoes') <> 'array'
         OR jsonb_array_length(regra.config->'condicoes') = 0 THEN
        CONTINUE;
      END IF;

      DECLARE
        is_or boolean := (regra.config->>'logica') = 'OR';
        all_matched boolean := true;
        any_matched boolean := false;
      BEGIN
        FOR cond IN SELECT * FROM jsonb_array_elements(regra.config->'condicoes')
        LOOP
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
      END;
    END IF;
  END LOOP;

  -- Fallback: regex hardcoded
  RETURN derive_canal_v2(p_ultima_origem, p_origem);
END;
$$;
