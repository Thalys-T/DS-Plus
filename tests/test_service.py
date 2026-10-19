from datetime import date

import pytest

from dsplus.database import Database
from dsplus.service import (
    DSPlusService,
    OrderItemInput,
    STATUS_CANCELED,
    STATUS_COMPLETED,
    STATUS_PENDING,
    ValidationError,
)


@pytest.fixture
def service(tmp_path):
    db = Database(tmp_path / "test.db")
    db.init_db()
    return DSPlusService(db)


def test_calcula_total_do_pedido(service):
    p1 = service.add_product("Xis", "Lanche", 1500)
    p2 = service.add_product("Refri", "Bebida", 700)

    order_id, created = service.create_order(
        items=[OrderItemInput(product_id=p1, quantity=2), OrderItemInput(product_id=p2, quantity=1)],
        payment_method="pix",
        status=STATUS_PENDING,
    )

    assert created is True
    orders = service.list_orders(date(2000, 1, 1), date(2100, 1, 1))
    order = next(o for o in orders if o["id"] == order_id)
    assert order["total_cents"] == 3700


def test_valida_quantidade_maior_que_zero(service):
    p1 = service.add_product("Xis", "Lanche", 1500)

    with pytest.raises(ValidationError):
        service.create_order(
            items=[OrderItemInput(product_id=p1, quantity=0)],
            payment_method="dinheiro",
            status=STATUS_PENDING,
        )


def test_preserva_preco_historico(service):
    product_id = service.add_product("Café", "Bebida", 500)

    order_id, _ = service.create_order(
        items=[OrderItemInput(product_id=product_id, quantity=1)],
        payment_method="debito",
        status=STATUS_COMPLETED,
    )

    service.update_product(product_id, "Café", "Bebida", 900, True)

    orders = service.list_orders(date(2000, 1, 1), date(2100, 1, 1))
    order = next(o for o in orders if o["id"] == order_id)
    item = order["items"][0]
    assert item["unit_price_cents"] == 500
    assert item["subtotal_cents"] == 500


def test_cancelado_nao_entra_nos_indicadores(service):
    product_id = service.add_product("Coxinha", "Salgado", 800)

    completed_id, _ = service.create_order(
        items=[OrderItemInput(product_id=product_id, quantity=1)],
        payment_method="credito",
        status=STATUS_COMPLETED,
    )
    canceled_id, _ = service.create_order(
        items=[OrderItemInput(product_id=product_id, quantity=2)],
        payment_method="credito",
        status=STATUS_CANCELED,
    )

    summary = service.summary(date(2000, 1, 1), date(2100, 1, 1))
    assert summary["revenue_cents"] == 800
    assert summary["completed_orders"] == 1
    assert summary["average_ticket_cents"] == 800

    orders = service.list_orders(date(2000, 1, 1), date(2100, 1, 1))
    assert any(o["id"] == completed_id and o["status"] == STATUS_COMPLETED for o in orders)
    assert any(o["id"] == canceled_id and o["status"] == STATUS_CANCELED for o in orders)
