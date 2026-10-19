# DS+

Primeira etapa funcional do DS+: aplicação local para cadastro de produtos, registro de pedidos e consulta de vendas para uma operação de lanches.

## Tecnologias

- Python 3.11+
- Streamlit (interface)
- SQLite (persistência local)
- Pytest (testes de regras principais)

## Estrutura

- `/app.py`: interface Streamlit com as telas **Produtos**, **Novo pedido** e **Histórico de vendas**.
- `/dsplus/database.py`: criação e inicialização do SQLite.
- `/dsplus/service.py`: regras de negócio (validações, totais, status, resumo e exportação CSV).
- `/tests/test_service.py`: testes unitários das regras principais.
- `/data/`: pasta usada para o banco local (`dsplus.db`), gerado em execução.

Separação adotada:
- Interface: Streamlit (`app.py`)
- Regras de negócio: `DSPlusService`
- Acesso a dados: `Database` + SQL em transações

## Instalação

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Execução

```bash
streamlit run app.py
```

A aplicação abre no navegador local.

## Roteiro de uso

1. Acesse **Produtos** e cadastre pelo menos 2 produtos.
2. Vá em **Novo pedido**, selecione itens e quantidades, escolha forma de pagamento e salve.
3. Em **Histórico de vendas**, filtre período/status/pagamento, conclua ou cancele pedidos pendentes e veja os indicadores.
4. Use o botão de exportação CSV para baixar vendas concluídas do período selecionado.

## Regras implementadas

- Produtos: cadastrar, listar, editar e desativar.
- Preço e quantidade validados (sem negativo e quantidade > 0).
- Pedidos sem itens são bloqueados.
- Pedido + itens salvos em transação única.
- Preço, nome e categoria do produto são gravados no item para preservar histórico.
- Produtos inativos não aparecem para novos pedidos.
- Prevenção de duplicidade por clique repetido no salvar pedido via `request_key` único.
- Resumo considera somente pedidos concluídos.
- Fuso de apresentação/filtro: `America/Sao_Paulo`.

## Exportação CSV

Exporta apenas pedidos concluídos do período selecionado, com uma linha por item contendo:

- ID do pedido
- Data e horário
- ID e nome do produto
- Categoria
- Quantidade
- Preço unitário praticado
- Subtotal do item
- Forma de pagamento

## Testes

```bash
pytest -q
```

Cobertura do escopo solicitado:
- cálculo de totais,
- validação de quantidades,
- preservação de preço histórico,
- exclusão de pedidos cancelados dos indicadores.

## Limitações desta etapa

- Não inclui loja virtual, delivery, integração com WhatsApp, pagamentos online, estoque, IA preditiva ou dashboard avançado.
- Uso local sem autenticação.
- Publicação com acesso via internet exige etapa própria de autenticação e implantação.
