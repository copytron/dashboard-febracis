-- Tabelas para dados de gasto em anúncios (Meta Ads e Google Ads via Windsor.ai)

CREATE TABLE IF NOT EXISTS meta_ads_spend (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  campaign_name TEXT,
  campaign_id TEXT,
  adset_name TEXT,
  ad_name TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, campaign_id, adset_name, ad_name)
);

CREATE TABLE IF NOT EXISTS google_ads_spend (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  campaign_name TEXT,
  campaign_id TEXT,
  ad_group_name TEXT,
  spend NUMERIC NOT NULL DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, campaign_id, ad_group_name)
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_spend_date ON meta_ads_spend (date);
CREATE INDEX IF NOT EXISTS idx_meta_ads_spend_campaign ON meta_ads_spend (campaign_name);
CREATE INDEX IF NOT EXISTS idx_google_ads_spend_date ON google_ads_spend (date);
CREATE INDEX IF NOT EXISTS idx_google_ads_spend_campaign ON google_ads_spend (campaign_name);
