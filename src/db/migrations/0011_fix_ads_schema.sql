-- Corrige schema de meta_ads_spend e google_ads_spend para suportar ROAS completo.
-- Adiciona campos faltantes conforme especificação do framework de atribuição.

-- ── Meta Ads ─────────────────────────────────────────────────────────────────
ALTER TABLE meta_ads_spend
  ADD COLUMN IF NOT EXISTS account_id       TEXT,
  ADD COLUMN IF NOT EXISTS adset_id         TEXT,
  ADD COLUMN IF NOT EXISTS ad_id            TEXT,
  ADD COLUMN IF NOT EXISTS reach            INTEGER,
  ADD COLUMN IF NOT EXISTS unique_clicks    INTEGER,
  ADD COLUMN IF NOT EXISTS ctr              NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS cpc              NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS cpm              NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS leads            INTEGER,
  ADD COLUMN IF NOT EXISTS cost_per_lead    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS conversions      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS conversion_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS roas             NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS frequency        NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS video_views      INTEGER,
  ADD COLUMN IF NOT EXISTS objective        TEXT,
  ADD COLUMN IF NOT EXISTS placement        TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content      TEXT;

-- Índices para join de ROAS
CREATE INDEX IF NOT EXISTS idx_meta_ads_date         ON meta_ads_spend (date);
CREATE INDEX IF NOT EXISTS idx_meta_ads_utm_campaign ON meta_ads_spend (utm_campaign);
CREATE INDEX IF NOT EXISTS idx_meta_ads_campaign_id  ON meta_ads_spend (campaign_id);

-- ── Google Ads ────────────────────────────────────────────────────────────────
ALTER TABLE google_ads_spend
  ADD COLUMN IF NOT EXISTS customer_id               TEXT,
  ADD COLUMN IF NOT EXISTS customer_name             TEXT,
  ADD COLUMN IF NOT EXISTS campaign_type             TEXT,
  ADD COLUMN IF NOT EXISTS adgroup_id                TEXT,
  ADD COLUMN IF NOT EXISTS keyword                   TEXT,
  ADD COLUMN IF NOT EXISTS keyword_match_type        TEXT,
  ADD COLUMN IF NOT EXISTS cost                      NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS ctr                       NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS average_cpc               NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS conversions               NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS conversion_value          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cost_per_conversion       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS roas                      NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS search_impression_share   NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS quality_score             INTEGER,
  ADD COLUMN IF NOT EXISTS utm_campaign              TEXT,
  ADD COLUMN IF NOT EXISTS utm_content               TEXT;

-- Renomear coluna legacy 'spend' → manter como spend (gasto Meta), Google usa 'cost'
-- google_ads: 'spend' já existe como alias de custo, manter por compatibilidade

-- Índices para join de ROAS
CREATE INDEX IF NOT EXISTS idx_google_ads_utm_campaign ON google_ads_spend (utm_campaign);
CREATE INDEX IF NOT EXISTS idx_google_ads_campaign_name ON google_ads_spend (campaign_name);
