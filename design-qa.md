# Design QA — Visão geral

## Referências e evidências

- Referências: `download (5).jpg`, `download (4).jpg` e `download (6).jpg`.
- Render final: `design-qa-overview.png`.
- Comparação conjunta: `design-qa-comparison.png`.

## Verificações

- Copy: títulos curtos, dados principais em primeiro plano e explicações transferidas para tooltips.
- KPIs: três cards com o mesmo padrão e a mesma altura; cada chip comunica a variação percentual contra o período anterior e usa success, danger ou default conforme a direção.
- Grade desktop: `4 + 4 + 4`, `8 + 4` e `4 + 8`, sem espaço residual na última linha.
- Tablet: dois KPIs, terceiro em largura completa; evolução e tabela completas; distribuição e turnos lado a lado.
- Mobile: uma coluna, sem overflow da página; tabela com rolagem horizontal focável.
- Visualizações: barras empilhadas com comparação anterior, donut com total central, barras horizontais por turno e tabela de projetos.
- Densidade temporal: sete rótulos no desktop e três no mobile, sem sobreposição.
- Acessibilidade: tooltips abrem por teclado, têm nomes acessíveis e os gráficos possuem resumos textuais; nenhuma informação depende apenas de cor.
- Estados e moedas: empty states permanecem sem eixos vazios e valores continuam separados por moeda.

final result: passed
