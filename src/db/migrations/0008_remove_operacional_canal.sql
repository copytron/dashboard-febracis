-- Remove canais "Operacional" e "Sem Atribuição": ambos mapeiam para "Outros".

-- 1. Atualizar derive_canal_v2 (fallback regex)
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
  IF fonte IS NULL THEN RETURN 'Outros'; END IF;
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

  -- Operacional agora é mapeado para Outros
  RETURN 'Outros';
END;
$$;

-- 2. Atualizar regras_classificacao existentes que usam canal "Operacional" ou "Sem Atribuição"
UPDATE regras_classificacao SET canal = 'Outros' WHERE canal IN ('Operacional', 'Sem Atribuição');
