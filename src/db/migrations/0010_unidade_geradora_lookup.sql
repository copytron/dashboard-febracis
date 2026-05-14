-- Tabela de lookup para resolver códigos de unidade geradora → nomes
-- Populada automaticamente pelo sync Windsor.ai
CREATE TABLE IF NOT EXISTS unidade_geradora_lookup (
  codigo TEXT PRIMARY KEY,
  sf_id TEXT,
  nome TEXT,
  cidade TEXT,
  estado TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca por sf_id (usado na resolução de nomes)
CREATE INDEX IF NOT EXISTS idx_ug_lookup_sf_id ON unidade_geradora_lookup (sf_id);
