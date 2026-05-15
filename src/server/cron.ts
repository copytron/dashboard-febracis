/**
 * Agendamento de tarefas recorrentes.
 * Registrado em scripts/start-server.mjs na inicialização do processo Node.js.
 *
 * NOTA: Seguro apenas com replicas: 1 no docker-compose.
 * Com mais réplicas, o cron executaria duplicado — mover para container separado.
 */
import cron from "node-cron";

let started = false;

export function startCronJobs() {
  if (started) return;
  started = true;

  // Sync Windsor.ai a cada 12 horas: meia-noite e meio-dia
  cron.schedule("0 0,12 * * *", async () => {
    console.log("[cron] Iniciando sync Windsor.ai...");
    try {
      const { runWindsorSync } = await import("./windsor.sync.pure");
      const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const result = await runWindsorSync({ dateFrom: ninetyDaysAgo });
      console.log("[cron] Sync completo:", JSON.stringify(result));
    } catch (err) {
      console.error("[cron] Sync Windsor falhou:", err);
    }
  });

  // Sync Meta Ads e Google Ads a cada 6 horas
  cron.schedule("0 3,9,15,21 * * *", async () => {
    console.log("[cron] Iniciando sync Ads (Meta + Google)...");
    try {
      const { syncMetaAds, syncGoogleAds } = await import("./windsor.ads.sync");
      const today = new Date().toISOString().slice(0, 10);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      try {
        const meta = await syncMetaAds(thirtyDaysAgo, today);
        console.log("[cron] Meta Ads sync:", JSON.stringify(meta));
      } catch (e: any) {
        console.error("[cron] Meta Ads sync falhou:", e.message);
      }

      try {
        const google = await syncGoogleAds(thirtyDaysAgo, today);
        console.log("[cron] Google Ads sync:", JSON.stringify(google));
      } catch (e: any) {
        console.error("[cron] Google Ads sync falhou:", e.message);
      }
    } catch (err) {
      console.error("[cron] Sync Ads falhou:", err);
    }
  });

  console.log("[cron] Agendado: Windsor sync a cada 12h (00:00 e 12:00)");
  console.log("[cron] Agendado: Ads sync a cada 6h (03:00, 09:00, 15:00, 21:00)");
}
