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
      const apiKey = process.env.WINDSOR_API_KEY;
      if (!apiKey) {
        console.warn("[cron] WINDSOR_API_KEY não configurada, pulando sync");
        return;
      }
      const { runWindsorSync } = await import("./windsor.sync.pure");
      const result = await runWindsorSync({ dateFrom: "2020-01-01" });
      console.log("[cron] Sync completo:", JSON.stringify(result));
    } catch (err) {
      console.error("[cron] Sync Windsor falhou:", err);
    }
  });

  console.log("[cron] Agendado: Windsor sync a cada 12h (00:00 e 12:00)");
}
