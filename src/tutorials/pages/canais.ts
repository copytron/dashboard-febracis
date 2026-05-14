import type { Tutorial } from "../types";

export const canaisTutorial: Tutorial = {
  key: "canais",
  steps: [
    {
      title: "Performance por Canal 📡",
      description:
        "Compare receita, vendas e ticket médio por canal de atribuição: Mídia, CRM, Orgânicos, Redes, YouTube, Outros, etc.",
    },
    {
      element: "[data-tour='filters']",
      title: "Combine filtros",
      description:
        "Filtre por turma para ver qual canal funciona melhor em cada produto, ou por estado para entender padrões regionais.",
      side: "bottom",
    },
    {
      title: "Cores consistentes",
      description:
        "As cores de cada canal são consistentes em todo o app — assim você reconhece visualmente Mídia, CRM, etc. em qualquer gráfico.",
    },
  ],
};
