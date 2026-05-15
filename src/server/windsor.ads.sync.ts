/**
 * Sincronização de dados de anúncios (Meta Ads + Google Ads) via MCP Windsor.
 */
import { db } from "@/db/client";
import { sql } from "drizzle-orm";
import { getWindsorClient } from "./mcp/windsor/client.js";

const META_FIELDS = [
  "date",
  "campaign",
  "campaign_id",
  "adset_name",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "conversions",
  // Campos expandidos (migration 0011)
  "account_id",
  "adset_id",
  "ad_id",
  "reach",
  "unique_clicks",
  "ctr",
  "cpc",
  "cpm",
  "leads",
  "cost_per_lead",
  "conversion_value",
  "roas",
  "frequency",
  "video_views",
  "objective",
  "placement",
  "utm_campaign",
  "utm_content",
];

const GOOGLE_FIELDS = [
  "date",
  "campaign",
  "campaign_id",
  "ad_group_name",
  "spend",
  "impressions",
  "clicks",
  "conversions",
  // Campos expandidos (migration 0011)
  "customer_id",
  "customer_name",
  "campaign_type",
  "adgroup_id",
  "keyword",
  "keyword_match_type",
  "cost",
  "ctr",
  "average_cpc",
  "conversion_value",
  "cost_per_conversion",
  "roas",
  "search_impression_share",
  "quality_score",
  "utm_campaign",
  "utm_content",
];

export async function syncMetaAds(dateFrom: string, dateTo: string) {
  const windsor = getWindsorClient();

  const rows = await windsor.getData({
    connector: "facebook",
    fields: META_FIELDS,
    date_from: dateFrom,
    date_to: dateTo,
  });

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const spend = Number(row.spend ?? 0);
    if (!row.date || spend === 0) { skipped++; continue; }

    await db.execute(sql`
      INSERT INTO meta_ads_spend (
        date, campaign_name, campaign_id, adset_name, ad_name,
        spend, impressions, clicks, conversions,
        account_id, adset_id, ad_id, reach, unique_clicks,
        ctr, cpc, cpm, leads, cost_per_lead,
        conversion_value, roas, frequency, video_views,
        objective, placement, utm_campaign, utm_content,
        data
      )
      VALUES (
        ${row.date}::date,
        ${row.campaign ?? null},
        ${row.campaign_id ?? null},
        ${row.adset_name ?? null},
        ${row.ad_name ?? null},
        ${spend},
        ${Number(row.impressions ?? 0)},
        ${Number(row.clicks ?? 0)},
        ${Number(row.conversions ?? 0)},
        ${row.account_id ?? null},
        ${row.adset_id ?? null},
        ${row.ad_id ?? null},
        ${row.reach != null ? Number(row.reach) : null},
        ${row.unique_clicks != null ? Number(row.unique_clicks) : null},
        ${row.ctr != null ? Number(row.ctr) : null},
        ${row.cpc != null ? Number(row.cpc) : null},
        ${row.cpm != null ? Number(row.cpm) : null},
        ${row.leads != null ? Number(row.leads) : null},
        ${row.cost_per_lead != null ? Number(row.cost_per_lead) : null},
        ${row.conversion_value != null ? Number(row.conversion_value) : null},
        ${row.roas != null ? Number(row.roas) : null},
        ${row.frequency != null ? Number(row.frequency) : null},
        ${row.video_views != null ? Number(row.video_views) : null},
        ${row.objective ?? null},
        ${row.placement ?? null},
        ${row.utm_campaign ?? null},
        ${row.utm_content ?? null},
        ${JSON.stringify(row)}::jsonb
      )
      ON CONFLICT (date, campaign_id, adset_name, ad_name) DO UPDATE SET
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        reach = EXCLUDED.reach,
        unique_clicks = EXCLUDED.unique_clicks,
        ctr = EXCLUDED.ctr,
        cpc = EXCLUDED.cpc,
        cpm = EXCLUDED.cpm,
        leads = EXCLUDED.leads,
        cost_per_lead = EXCLUDED.cost_per_lead,
        conversion_value = EXCLUDED.conversion_value,
        roas = EXCLUDED.roas,
        frequency = EXCLUDED.frequency,
        video_views = EXCLUDED.video_views,
        objective = EXCLUDED.objective,
        placement = EXCLUDED.placement,
        utm_campaign = EXCLUDED.utm_campaign,
        utm_content = EXCLUDED.utm_content,
        data = EXCLUDED.data
    `);
    inserted++;
  }

  return { connector: "facebook", inserted, skipped, total_fetched: rows.length };
}

export async function syncGoogleAds(dateFrom: string, dateTo: string) {
  const windsor = getWindsorClient();

  const rows = await windsor.getData({
    connector: "google_ads",
    fields: GOOGLE_FIELDS,
    date_from: dateFrom,
    date_to: dateTo,
  });

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const spend = Number(row.cost ?? row.spend ?? 0);
    if (!row.date || spend === 0) { skipped++; continue; }

    await db.execute(sql`
      INSERT INTO google_ads_spend (
        date, campaign_name, campaign_id, ad_group_name,
        spend, impressions, clicks, conversions,
        customer_id, customer_name, campaign_type, adgroup_id,
        keyword, keyword_match_type, cost,
        ctr, average_cpc, conversion_value, cost_per_conversion,
        roas, search_impression_share, quality_score,
        utm_campaign, utm_content,
        data
      )
      VALUES (
        ${row.date}::date,
        ${row.campaign ?? null},
        ${row.campaign_id ?? null},
        ${row.ad_group_name ?? null},
        ${spend},
        ${Number(row.impressions ?? 0)},
        ${Number(row.clicks ?? 0)},
        ${Number(row.conversions ?? 0)},
        ${row.customer_id ?? null},
        ${row.customer_name ?? null},
        ${row.campaign_type ?? null},
        ${row.adgroup_id ?? null},
        ${row.keyword ?? null},
        ${row.keyword_match_type ?? null},
        ${row.cost != null ? Number(row.cost) : null},
        ${row.ctr != null ? Number(row.ctr) : null},
        ${row.average_cpc != null ? Number(row.average_cpc) : null},
        ${row.conversion_value != null ? Number(row.conversion_value) : null},
        ${row.cost_per_conversion != null ? Number(row.cost_per_conversion) : null},
        ${row.roas != null ? Number(row.roas) : null},
        ${row.search_impression_share != null ? Number(row.search_impression_share) : null},
        ${row.quality_score != null ? Number(row.quality_score) : null},
        ${row.utm_campaign ?? null},
        ${row.utm_content ?? null},
        ${JSON.stringify(row)}::jsonb
      )
      ON CONFLICT (date, campaign_id, ad_group_name) DO UPDATE SET
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        customer_id = EXCLUDED.customer_id,
        customer_name = EXCLUDED.customer_name,
        campaign_type = EXCLUDED.campaign_type,
        adgroup_id = EXCLUDED.adgroup_id,
        keyword = EXCLUDED.keyword,
        keyword_match_type = EXCLUDED.keyword_match_type,
        cost = EXCLUDED.cost,
        ctr = EXCLUDED.ctr,
        average_cpc = EXCLUDED.average_cpc,
        conversion_value = EXCLUDED.conversion_value,
        cost_per_conversion = EXCLUDED.cost_per_conversion,
        roas = EXCLUDED.roas,
        search_impression_share = EXCLUDED.search_impression_share,
        quality_score = EXCLUDED.quality_score,
        utm_campaign = EXCLUDED.utm_campaign,
        utm_content = EXCLUDED.utm_content,
        data = EXCLUDED.data
    `);
    inserted++;
  }

  return { connector: "google_ads", inserted, skipped, total_fetched: rows.length };
}
