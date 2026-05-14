// Atribuição v2: a ÚLTIMA ORIGEM decide o canal.
// Origem original é fallback. UTM nunca decide — apenas evidência.
// Espelho exato de public.derive_canal_v2(p_ultima_origem, p_origem).

export type CanalInput = {
  ultima_origem_lead?: string | null;
  origem_lead?: string | null;
  // mantidos por compatibilidade com chamadores antigos — ignorados
  utm_source?: string | null;
  utm_medium?: string | null;
};

const norm = (s?: string | null) => (s ?? "").toString().trim();

export function deriveCanal(input: CanalInput): string {
  const fonte = norm(input.ultima_origem_lead) || norm(input.origem_lead);
  if (!fonte) return "Outros";
  const f = fonte.toLowerCase();

  if (/(youtube|\[yt\]|\byt\b|iex app)/.test(f)) return "YouTube";
  if (/(email|e-mail|mailchimp|rdstation|whats|wpp|whatsapp|sz chat|sz_chat|disparo marketing|hotmart|emkt|email mkt)/.test(f)) return "CRM";
  if (/(social seller|\bss\b|ss mcis|ss pv|ss cv|indica|indicação|aluno cis|ex-aluno|ex aluno|stand cis|ativação comercial|avalon - social|cliente base)/.test(f)) return "Redes";
  if (/(\[fb\]|\[go\]|\[cm\]|\[ck\]|\[lp\]|\[vsl\]|\[pgven\]|form - meta|meta lead ads|tráfego|trafego|lead tra|\bads\b|typeform|^lp |lp -|masterclass|meteorico|meteórico|mulheres experience|ia mcis|ia avalon|black november|black friday|pre-venda|live pv|fbcis)/.test(f)) return "Mídia";
  if (/(\[org\]|orgânico|organico|organic|\bseo\b|\bsite\b)/.test(f)) return "Orgânicos";
  if (/(pedido|cortesia|bonux|bônus|bonus|transferido|checkout|base dksoft|lista de espera)/.test(f)) return "Outros";
  return "Outros";
}
