# DS+

Desenvolver uma solução de Ciência de Dados e Business Intelligence para auxiliar uma pequena empreendedora na organização, acompanhamento e análise das vendas de lanches, utilizando os dados gerados pelos pedidos para facilitar a gestão do negócio e apoiar a tomada de decisões.

## Protótipo em React e TypeScript

Interface responsiva em português com visão geral, **painel de análises (BI)**, cadastro de produtos, novo pedido e histórico de vendas. Desenvolvido com React, TypeScript e Vite. Ícones: Lucide. Fontes: DM Sans e Manrope, carregadas do Google Fonts com alternativa local sans-serif.

### Executar

Requer Node.js 22.12+ (testado com Node.js 24) e npm.

```sh
npm install
npm run dev
```

Abra o endereço local exibido no terminal, normalmente http://127.0.0.1:5173.

```sh
npm run build   # valida TypeScript e gera dist/
npm run preview # serve a versão de produção localmente
npm test        # verifica regras de negócio
```

### Experimentar

1. Clique em **Experimentar demonstração** para visualizar produtos e vendas fictícios. Este modo usa apenas memória, fica sinalizado na interface e não altera seus dados reais. Recarregar a página encerra a demonstração.
2. Clique em **Voltar aos meus dados** para começar seu próprio cadastro.
3. Em **Produtos**, adicione dois produtos com preços e categorias.
4. Em **Novo pedido**, adicione os itens, ajuste as quantidades, escolha o pagamento e registre como concluído ou pendente.
5. Consulte o histórico, abra os detalhes para concluir um pedido pendente ou cancelar um pedido. Cancelamentos preservam o registro e não podem ser reabertos nesta versão.
6. Edite o preço ou desative um produto. Os pedidos anteriores preservam nome, categoria e preço da venda.
7. Selecione o período e exporte um CSV. O arquivo contém uma linha por item e apenas vendas concluídas que atendem aos filtros.
8. Recarregue a página para verificar a persistência dos dados reais.

### Painel de análises (BI)

A página **Análises** recalcula os indicadores a cada pedido registrado, sempre sobre as vendas concluídas do período escolhido (atalhos: Hoje, 7, 30 e 90 dias):

- Faturamento, pedidos e ticket médio comparados ao período anterior de mesma duração.
- **O que os dados dizem**: conclusões automáticas em linguagem simples (horário de pico, melhor dia, produtos-chave, menos vendidos, pagamento preferido, variação e cancelamentos).
- Faturamento por dia, pedidos por horário, faturamento médio por dia da semana e mapa de movimento (dia da semana × hora).
- Participação das formas de pagamento e das categorias.
- **Curva ABC**: classe A = produtos que somam 80% do faturamento, B = até 95%, C = restante (inclui produtos ativos sem venda).
- **Sugestão de produção para amanhã**: média vendida de cada produto nos mesmos dias da semana das últimas 4 semanas.

A demonstração gera 60 dias de vendas fictícias com padrões plausíveis (picos no café da manhã, almoço e noite; sábado reduzido; domingo fechado), sempre iguais por usar semente fixa.

### Regras e armazenamento

- Valores armazenados como centavos inteiros; quantidades inteiras positivas.
- Faturamento, quantidade e ticket médio consideram somente pedidos concluídos do período. Filtros adicionais de status/pagamento afetam a tabela e o CSV, não os cartões de resumo.
- Datas apresentadas e filtradas no fuso America/Sao_Paulo.
- Pagamentos são apenas registrados, sem cobrança ou integração bancária.
- Dados reais são gravados em um único documento no **localStorage**, chave `ds-plus-v1`. Pedido e itens são salvos juntos; a interface confirma o registro apenas se a gravação for bem-sucedida.
- O modo demonstração é separado e começa somente mediante ação explícita.
- Não há dados pessoais ou credenciais nos exemplos.

### Limitações desta versão

Este é um esboço funcional local, sem backend, banco compartilhado ou autenticação. Os dados pertencem ao navegador e à origem usada para abrir a aplicação (endereço e porta). Limpar o armazenamento remove os registros. Abas simultâneas e múltiplos usuários não são suportados; use uma única aba para registrar vendas. O CSV exporta vendas, mas não substitui um backup completo do cadastro. Não usar como sistema definitivo de produção antes de implementar banco, backup, autenticação e controle de concorrência.

### Organização

- `src/App.tsx`: telas e fluxo de uso.
- `src/domain.ts`: tipos, cálculos, CSV e dados fictícios.
- `src/analytics.ts`: indicadores do painel de análises, curva ABC, sugestão de produção e conclusões automáticas.
- `src/Dashboard.tsx` e `src/charts.tsx`: página de análises e gráficos em SVG/HTML, sem bibliotecas externas.
- `src/styles.css`: identidade visual e adaptação para celular.
- `tests/domain.test.ts` e `tests/analytics.test.ts`: testes das regras de cálculo, validação, histórico, indicadores, análises, CSV e fuso horário.

## Alternativa local em Python + Streamlit

Também há uma implementação local em Python/Streamlit com SQLite nos arquivos:

- `app.py`
- `dsplus/database.py`
- `dsplus/service.py`
- `tests/test_service.py`

Execução:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## Próximas etapas

API e banco de dados persistente, autenticação da empreendedora, backup/restauração e publicação para uso no celular. Validar o fluxo presencialmente com a parceira antes de ampliar o escopo.

## Publicação na Vercel

O arquivo `vercel.json` configura a publicação da aplicação React/Vite: instalação com `npm ci`, compilação com `npm run build` e saída estática em `dist`. O projeto usa Node.js 24.x. Não são necessárias variáveis de ambiente ou banco de dados para esta demonstração. A alternativa Python/Streamlit não é publicada neste site.

Importe o repositório `Thalys-T/DS-Plus` na Vercel, mantenha a pasta raiz e o framework Vite e publique. Cada visitante começa com seus dados locais vazios e pode clicar em **Experimentar demonstração**. Os dados fictícios ficam separados dos cadastros do navegador.

O roteiro para apresentar e validar os fluxos com o vendedor está em [docs/APRESENTACAO.md](docs/APRESENTACAO.md). A publicação não adiciona sincronização entre aparelhos ou backup em nuvem.
