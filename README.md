# DS+
Desenvolver uma solução de Ciência de Dados e Business Intelligence para auxiliar uma pequena empreendedora na organização, acompanhamento e análise das vendas de lanches, utilizando os dados gerados pelos pedidos para facilitar a gestão do negócio e apoiar a tomada de decisões.

## Protótipo em React e TypeScript

Interface responsiva em português com visão geral, cadastro de produtos, novo pedido e histórico de vendas. Desenvolvido com React, TypeScript e Vite. Ícones: Lucide. Fontes: DM Sans e Manrope, carregadas do Google Fonts com alternativa local sans-serif.

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
- `src/styles.css`: identidade visual e adaptação para celular.
- `tests/domain.test.ts`: testes das regras de cálculo, validação, histórico, indicadores, CSV e fuso horário.

### Próximas etapas

API e banco de dados persistente, autenticação da empreendedora, backup/restauração e dashboard analítico com produtos, horários e evolução das vendas. Validar o fluxo presencialmente com a parceira antes de ampliar o escopo.
