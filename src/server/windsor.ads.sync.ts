/**
 * Sincronização de dados de anúncios (Meta Ads + Google Ads) via Windsor.ai
 */
import { db } from "@/db/client";
import { sql } from "drizzle-orm";

const WINDSOR_BASE = "https://connectors.windsor.ai";

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
].join(",");

const GOOGLE_FIELDS = [
  "date",
  "campaign",
  "campaign_id",
  "ad_group_name",
  "spend",
  "impressions",
  "clicks",
  "conversions",
].join(",");

async function fetchWindsorAds(
  apiKey: string,
  connector: string,
  fields: string,
  dateFrom: string,
  dateTo: string,
): Promise<any[]> {
  const url = new URL(`${WINDSOR_BASE}/${connector}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("fields", fields);
  url.searchParams.set("date_from", dateFrom);
  url.searchParams.set("date_to", dateTo);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Windsor.ai ads erro ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  return Array.isArray(json) ? json : (json?.data ?? []);
}

export async function syncMetaAds(dateFrom: string, dateTo: string) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) throw new Error("WINDSOR_API_KEY não configurada");

  const rows = await fetchWindsorAds(apiKey, "facebook", META_FIELDS, dateFrom, dateTo);
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const spend = Number(row.spend ?? 0);
    if (!row.date || spend === 0) { skipped++; continue; }

    await db.execute(sql`
      INSERT INTO meta_ads_spend (date, campaign_name, campaign_id, adset_name, ad_name, spend, impressions, clicks, conversions, data)
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
        ${JSON.stringify(row)}::jsonb
      )
      ON CONFLICT (date, campaign_id, adset_name, ad_name) DO UPDATE SET
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        data = EXCLUDED.data
    `);
    inserted++;
  }

  return { connector: "facebook", inserted, skipped, total_fetched: rows.length };
}

export async function syncGoogleAds(dateFrom: string, dateTo: string) {
  const apiKey = process.env.WINDSOR_API_KEY;
  if (!apiKey) throw new Error("WINDSOR_API_KEY não configurada");

  const rows = await fetchWindsorAds(apiKey, "google_ads", GOOGLE_FIELDS, dateFrom, dateTo);
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const spend = Number(row.spend ?? 0);
    if (!row.date || spend === 0) { skipped++; continue; }

    await db.execute(sql`
      INSERT INTO google_ads_spend (date, campaign_name, campaign_id, ad_group_name, spend, impressions, clicks, conversions, data)
      VALUES (
        ${row.date}::date,
        ${row.campaign ?? null},
        ${row.campaign_id ?? null},
        ${row.ad_group_name ?? null},
        ${spend},
        ${Number(row.impressions ?? 0)},
        ${Number(row.clicks ?? 0)},
        ${Number(row.conversions ?? 0)},
        ${JSON.stringify(row)}::jsonb
      )
      ON CONFLICT (date, campaign_id, ad_group_name) DO UPDATE SET
        spend = EXCLUDED.spend,
        impressions = EXCLUDED.impressions,
        clicks = EXCLUDED.clicks,
        conversions = EXCLUDED.conversions,
        data = EXCLUDED.data
    `);
    inserted++;
  }

  return { connector: "google_ads", inserted, skipped, total_fetched: rows.length };
}
