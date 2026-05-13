import type { RegraClassificacao, Condicao } from "./regras.types";
import { deriveCanal, type CanalInput } from "./canal";

type EvalRecord = {
  ultima_origem_lead?: string | null;
  origem_lead?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
};

function evalCondicao(cond: Condicao, record: EvalRecord): boolean {
  const val = (record[cond.campo] ?? "").toString().toLowerCase();
  const target = cond.valor.toLowerCase();
  switch (cond.operador) {
    case "contem":
      return val.includes(target);
    case "nao_contem":
      return !val.includes(target);
    case "igual":
      return val === target;
    case "comeca_com":
      return val.startsWith(target);
    case "regex":
      try { return new RegExp(cond.valor, "i").test(val); } catch { return false; }
  }
}

/**
 * Deriva o canal usando regras customizáveis.
 * Itera em ordem de prioridade (menor = primeiro).
 * Se nenhuma regra match, usa o fallback hardcoded de canal.ts.
 */
export function deriveCanalDinamico(
  record: EvalRecord,
  regras: RegraClassificacao[],
): string {
  const sorted = [...regras]
    .filter((r) => r.ativo)
    .sort((a, b) => a.prioridade - b.prioridade);

  for (const regra of sorted) {
    const group = regra.config;
    if (!group?.condicoes?.length) continue;

    const results = group.condicoes.map((c) => evalCondicao(c, record));
    const match =
      group.logica === "AND"
        ? results.every(Boolean)
        : results.some(Boolean);

    if (match) return regra.canal;
  }

  // Fallback: regex hardcoded
  return deriveCanal(record as CanalInput);
}
