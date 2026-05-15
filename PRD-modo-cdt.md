# PRD: Modo CDT-Only — Sync Filtrado por Canal de Venda

## Resumo

Implementar a possibilidade de sincronizar **somente vendas do canal CDT** do Salesforce via Windsor.ai, reduzindo volume de dados e alinhando métricas com o Salesforce CDT.

## Problema

Atualmente o cron sincroniza **todas as oportunidades** do Salesforce (desde 2020-01-01), totalizando ~50.000 registros a cada 12 horas. Isso é:
- **Ineficiente**: UPSERT de 50k registros a cada 12h quando a maioria não mudou
- **Desnecessário para CDT**: CDT representa ~3% do total (~1.400 registros)
- **Lento para validação**: Difícil comparar números CDT do dashboard vs Salesforce quando há dados de todos os canais misturados

## Viabilidade Técnica

### API Windsor.ai — Suporta Filtros ✅

O MCP Server local (`src/server/mcp/windsor/types.ts`) já define:
```typescript
type WindsorFilter = Array<[string, WindsorFilterOperator, string | number | string[]]>;
// Operadores: "eq", "neq", "gt", "lt", "gte", "lte", "contains", "not_contains", "in", "not_in"
```

O campo Salesforce correspondente é `opportunity_canal_venda__c`.

### Implementação no Sync

**Arquivo**: `src/server/windsor.sync.pure.ts`

```typescript
export async function runWindsorSync(input: {
  dateFrom: string;
  dateTo?: string;
  canalVenda?: string;  // NOVO: ex "CDT"
}) {
  const filters = input.canalVenda
    ? [["opportunity_canal_venda__c", "eq", input.canalVenda]]
    : undefined;

  const opps = await windsor.getData({
    connector: "salesforce",
    fields: OPPORTUNITY_FIELDS,
    accounts: [SALESFORCE_ACCOUNT],
    date_from: dateFrom,
    date_to: dateTo,
    filters,
  });
  // ... resto do sync igual
}
```

**Arquivo**: `src/server/cron.ts`

```typescript
// Opção recomendada (C): Sync completo + CDT mais frequente
cron.schedule("0 */4 * * *", async () => {
  await runWindsorSync({ dateFrom: ninetyDaysAgo, canalVenda: "CDT" });
});
cron.schedule("0 0 * * 0", async () => {
  await runWindsorSync({ dateFrom: "2020-01-01" }); // Full sync semanal
});
```

## Opções de Implementação

### Opção A: Sync Apenas CDT
- **Prós**: Simples, rápido, dados 100% focados
- **Contras**: Perde visão de Franquias, ED, Online — dashboard fica incompleto para análises cross-canal
- **Recomendação**: ❌ Não recomendado

### Opção B: Sync Completo + Filtro CDT na UI
- **Prós**: Nenhuma mudança no backend, já funciona hoje via filtro "Canal Venda = CDT"
- **Contras**: Sync ainda puxa tudo a cada 12h (ineficiente)
- **Recomendação**: ✅ Funcional imediato (já disponível)

### Opção C: Sync Completo Semanal + CDT Frequente (Recomendada)
- **Prós**: CDT atualizado a cada 4h, outros canais atualizados semanalmente, performance otimizada
- **Contras**: Ligeiramente mais complexo no cron
- **Recomendação**: ✅✅ Melhor equilíbrio

## Impacto nos Números

| Métrica | Sync Completo | Sync CDT-Only |
|---------|--------------|---------------|
| Registros por sync | ~50.000 | ~1.400 |
| Tempo estimado | ~5-10 min | ~30 seg |
| Cobertura de canais | Todos | Apenas CDT |
| Comparabilidade com SF | Requer filtro | Direta |

## Riscos

1. **Campo `opportunity_canal_venda__c` pode ter valores inconsistentes** no Salesforce (espaços, case sensitivity)
2. **Filtro no Windsor pode não funcionar como esperado** — necessita teste com a API real
3. **Perda de dados cross-canal** se optar por sync apenas CDT

## Critérios de Aceitação

- [ ] `runWindsorSync` aceita parâmetro opcional `canalVenda`
- [ ] Quando `canalVenda = "CDT"`, apenas oportunidades CDT são sincronizadas
- [ ] Cron configurável: CDT a cada 4h, full sync semanal
- [ ] Dashboard com filtro Canal Venda = CDT mostra números alinhados com Salesforce
- [ ] Teste: `SELECT COUNT(*) FROM vendas_atribuidas WHERE canal_venda = 'CDT'` corresponde ao Salesforce

## Próximos Passos

1. Testar filtro Windsor com `opportunity_canal_venda__c` via MCP tool do Claude
2. Implementar parâmetro `canalVenda` no `runWindsorSync`
3. Configurar cron com Opção C
4. Validar números CDT vs Salesforce
