from __future__ import annotations

from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

import streamlit as st

from dsplus.database import Database
from dsplus.service import (
    DSPlusService,
    OrderItemInput,
    PAYMENT_METHODS,
    STATUS_CANCELED,
    STATUS_COMPLETED,
    STATUS_PENDING,
    VALID_STATUSES,
    ValidationError,
    brl_to_cents,
    cents_to_brl,
)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "dsplus.db"


def get_service() -> DSPlusService:
    db = Database(DB_PATH)
    db.init_db()
    return DSPlusService(db)


def init_order_state() -> None:
    if "order_rows" not in st.session_state:
        st.session_state.order_rows = [{"product_id": None, "quantity": 1}]
    if "order_request_key" not in st.session_state:
        st.session_state.order_request_key = str(uuid4())


def render_products(service: DSPlusService) -> None:
    st.subheader("Produtos")
    with st.form("form_produto_novo", clear_on_submit=True):
        col1, col2, col3 = st.columns([2, 2, 1])
        name = col1.text_input("Nome*")
        category = col2.text_input("Categoria*")
        price = col3.number_input("Preço (R$)*", min_value=0.0, step=0.5, format="%.2f")
        submitted = st.form_submit_button("Cadastrar produto")
        if submitted:
            try:
                service.add_product(name, category, brl_to_cents(price))
                st.success("Produto cadastrado com sucesso.")
            except ValidationError as exc:
                st.error(str(exc))

    products = service.list_products(include_inactive=True)
    if not products:
        st.info("Nenhum produto cadastrado ainda. Cadastre o primeiro produto para começar.")
        return

    st.markdown("### Lista de produtos")
    for product in products:
        with st.expander(
            f"#{product['id']} - {product['name']} ({'ativo' if product['active'] else 'inativo'})",
            expanded=False,
        ):
            with st.form(f"edit_product_{product['id']}"):
                col1, col2, col3, col4 = st.columns([2, 2, 1, 1])
                new_name = col1.text_input("Nome", value=product["name"], key=f"name_{product['id']}")
                new_category = col2.text_input(
                    "Categoria", value=product["category"], key=f"cat_{product['id']}"
                )
                new_price = col3.number_input(
                    "Preço (R$)",
                    min_value=0.0,
                    step=0.5,
                    value=product["price_cents"] / 100,
                    key=f"price_{product['id']}",
                )
                is_active = col4.checkbox("Ativo", value=bool(product["active"]), key=f"act_{product['id']}")
                save = st.form_submit_button("Salvar alterações")
                if save:
                    try:
                        service.update_product(
                            product_id=product["id"],
                            name=new_name,
                            category=new_category,
                            price_cents=brl_to_cents(new_price),
                            active=is_active,
                        )
                        st.success("Produto atualizado com sucesso.")
                        st.rerun()
                    except ValidationError as exc:
                        st.error(str(exc))

            if product["active"]:
                if st.button("Desativar produto", key=f"deactivate_{product['id']}"):
                    service.deactivate_product(product["id"])
                    st.success("Produto desativado.")
                    st.rerun()


def render_new_order(service: DSPlusService) -> None:
    st.subheader("Novo pedido")
    active_products = service.list_products(include_inactive=False)
    if not active_products:
        st.warning("Cadastre produtos ativos antes de registrar pedidos.")
        return

    init_order_state()

    product_options = {f"#{p['id']} - {p['name']} ({cents_to_brl(p['price_cents'])})": p for p in active_products}
    option_labels = list(product_options.keys())

    st.markdown("### Itens")
    remove_idx = None
    for idx, row in enumerate(st.session_state.order_rows):
        cols = st.columns([4, 1, 1])
        selected_label = cols[0].selectbox(
            f"Produto {idx + 1}",
            options=option_labels,
            key=f"order_product_{idx}",
        )
        quantity = cols[1].number_input(
            "Qtd",
            min_value=1,
            step=1,
            value=int(row.get("quantity", 1)),
            key=f"order_qty_{idx}",
        )
        if cols[2].button("Remover", key=f"remove_item_{idx}") and len(st.session_state.order_rows) > 1:
            remove_idx = idx

        st.session_state.order_rows[idx] = {
            "product_id": product_options[selected_label]["id"],
            "quantity": int(quantity),
        }

    if remove_idx is not None:
        st.session_state.order_rows.pop(remove_idx)
        st.rerun()

    col_add, _ = st.columns([1, 4])
    if col_add.button("Adicionar item"):
        st.session_state.order_rows.append({"product_id": active_products[0]["id"], "quantity": 1})
        st.rerun()

    preview_total = 0
    st.markdown("### Resumo do pedido")
    for row in st.session_state.order_rows:
        product = next(p for p in active_products if p["id"] == row["product_id"])
        subtotal = product["price_cents"] * row["quantity"]
        preview_total += subtotal
        st.write(
            f"- {product['name']} x {row['quantity']} | Unitário: {cents_to_brl(product['price_cents'])} | Subtotal: {cents_to_brl(subtotal)}"
        )
    st.markdown(f"**Total: {cents_to_brl(preview_total)}**")

    payment = st.selectbox("Forma de pagamento", PAYMENT_METHODS)
    status = st.selectbox("Status", VALID_STATUSES, index=0)
    note = st.text_area("Observação (opcional)")

    if st.button("Salvar pedido", type="primary"):
        try:
            items = [OrderItemInput(product_id=row["product_id"], quantity=row["quantity"]) for row in st.session_state.order_rows]
            order_id, created = service.create_order(
                items=items,
                payment_method=payment,
                status=status,
                note=note,
                request_key=st.session_state.order_request_key,
            )
            if created:
                st.success(f"Pedido #{order_id} salvo com sucesso.")
            else:
                st.warning(f"Pedido já havia sido salvo anteriormente (#{order_id}).")
            st.session_state.order_rows = [{"product_id": active_products[0]["id"], "quantity": 1}]
            st.session_state.order_request_key = str(uuid4())
        except ValidationError as exc:
            st.error(str(exc))


def render_history(service: DSPlusService) -> None:
    st.subheader("Histórico de vendas")
    today = date.today()

    col1, col2, col3, col4 = st.columns(4)
    start = col1.date_input("Data inicial", value=today - timedelta(days=30))
    end = col2.date_input("Data final", value=today)
    status_filter = col3.selectbox("Status", ["todos"] + VALID_STATUSES)
    payment_filter = col4.selectbox("Pagamento", ["todos"] + PAYMENT_METHODS)

    if start > end:
        st.error("Data inicial não pode ser maior que data final.")
        return

    orders = service.list_orders(
        start_date=start,
        end_date=end,
        status=None if status_filter == "todos" else status_filter,
        payment_method=None if payment_filter == "todos" else payment_filter,
    )

    summary = service.summary(start, end)
    m1, m2, m3 = st.columns(3)
    m1.metric("Faturamento", cents_to_brl(summary["revenue_cents"]))
    m2.metric("Pedidos concluídos", summary["completed_orders"])
    m3.metric("Ticket médio", cents_to_brl(summary["average_ticket_cents"]))

    csv_bytes = service.export_concluded_csv(start, end)
    st.download_button(
        "Exportar vendas concluídas (CSV)",
        data=csv_bytes,
        file_name=f"vendas_concluidas_{start}_{end}.csv",
        mime="text/csv",
    )

    if not orders:
        st.info("Nenhum pedido encontrado para os filtros selecionados.")
        return

    for order in orders:
        title = (
            f"Pedido #{order['id']} | {order['created_at_local'].strftime('%d/%m/%Y %H:%M')} | "
            f"{order['status']} | {cents_to_brl(order['total_cents'])}"
        )
        with st.expander(title):
            st.write(f"Pagamento: {order['payment_method']}")
            if order.get("note"):
                st.write(f"Observação: {order['note']}")

            for item in order["items"]:
                st.write(
                    f"- {item['product_name']} ({item['product_category']}) x {item['quantity']} | "
                    f"Unitário: {cents_to_brl(item['unit_price_cents'])} | "
                    f"Subtotal: {cents_to_brl(item['subtotal_cents'])}"
                )

            action_cols = st.columns(3)
            try:
                if order["status"] == STATUS_PENDING:
                    if action_cols[0].button("Concluir", key=f"complete_{order['id']}"):
                        service.update_order_status(order["id"], STATUS_COMPLETED)
                        st.rerun()
                    if action_cols[1].button("Cancelar", key=f"cancel_{order['id']}"):
                        service.update_order_status(order["id"], STATUS_CANCELED)
                        st.rerun()
                elif order["status"] == STATUS_COMPLETED:
                    if action_cols[0].button("Cancelar pedido", key=f"cancel_done_{order['id']}"):
                        service.update_order_status(order["id"], STATUS_CANCELED)
                        st.rerun()
            except ValidationError as exc:
                st.error(str(exc))


def main() -> None:
    st.set_page_config(page_title="DS+", layout="wide")
    st.title("DS+ | Gestão de pedidos e vendas")
    st.caption("Uso local. Publicação com acesso via internet requer autenticação e implantação em etapa futura.")

    service = get_service()

    menu = st.sidebar.radio("Navegação", ["Produtos", "Novo pedido", "Histórico de vendas"])
    if menu == "Produtos":
        render_products(service)
    elif menu == "Novo pedido":
        render_new_order(service)
    else:
        render_history(service)


if __name__ == "__main__":
    main()
