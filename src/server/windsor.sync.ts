/**
 * Server function wrapper para sincronização Windsor.ai.
 * A lógica de negócio está em windsor.sync.pure.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runWindsorSync } from "./windsor.sync.pure";

const SyncInput = z.object({
  dateFrom: z.string().default("2020-01-01"),
  dateTo:   z.string().optional(),
});

export const syncWindsor = createServerFn({ method: "POST" })
  .inputValidator((d: any) => SyncInput.parse(d))
  .handler(async ({ data }) => runWindsorSync(data));
