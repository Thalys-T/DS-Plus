from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from dsplus.database import Database

STATUS_PENDING = "pendente"
STATUS_COMPLETED = "concluido"
STATUS_CANCELED = "cancelado"

PAYMENT_METHODS = ["dinheiro", "pix", "debito", "credito"]
VALID_STATUSES = [STATUS_PENDING, STATUS_COMPLETED, STATUS_CANCELED]
SAO_PAULO_TZ = ZoneInfo("America/Sao_Paulo")


class ValidationError(ValueError):
    pass


@dataclass(frozen=True)
class OrderItemInput:
    product_id: int
    quantity: int


def cents_to_brl(cents: int) -> str:
    value = cents / 100
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def brl_to_cents(value: float) -> int:
    if value < 0:
        raise ValidationError("Preço não pode ser negativo.")
    return int(round(value * 100))


def now_utc_iso() -> str:
    return datetime.now(UTC).isoformat()


def utc_to_sao_paulo(utc_iso: str) -> datetime:
    dt = datetime.fromisoformat(utc_iso)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(SAO_PAULO_TZ)


class DSPlusService:
    def __init__(self, db: Database):
        self.db = db

    def add_product(self, name: str, category: str, price_cents: int) -> int:
        name = (name or "").strip()
        category = (category or "").strip()
        if not name:
            raise ValidationError("Nome do produto é obrigatório.")
        if not category:
            raise ValidationError("Categoria é obrigatória.")
        if price_cents < 0:
            raise ValidationError("Preço não pode ser negativo.")

        now = now_utc_iso()
        with self.db.get_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO products (name, category, price_cents, active, created_at_utc, updated_at_utc)
                VALUES (?, ?, ?, 1, ?, ?)
                """,
                (name, category, price_cents, now, now),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def list_products(self, include_inactive: bool = True) -> list[dict]:
        query = "SELECT * FROM products"
        params: tuple = ()
        if not include_inactive:
            query += " WHERE active = 1"
        query += " ORDER BY name COLLATE NOCASE"

        with self.db.get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]

    def update_product(self, product_id: int, name: str, category: str, price_cents: int, active: bool) -> None:
        name = (name or "").strip()
        category = (category or "").strip()
        if not name:
            raise ValidationError("Nome do produto é obrigatório.")
        if not category:
            raise ValidationError("Categoria é obrigatória.")
        if price_cents < 0:
            raise ValidationError("Preço não pode ser negativo.")

        with self.db.get_connection() as conn:
            conn.execute(
                """
                UPDATE products
                SET name = ?, category = ?, price_cents = ?, active = ?, updated_at_utc = ?
                WHERE id = ?
                """,
                (name, category, price_cents, 1 if active else 0, now_utc_iso(), product_id),
            )
            conn.commit()

    def deactivate_product(self, product_id: int) -> None:
        with self.db.get_connection() as conn:
            conn.execute(
                "UPDATE products SET active = 0, updated_at_utc = ? WHERE id = ?",
                (now_utc_iso(), product_id),
            )
            conn.commit()

    def create_order(
        self,
        items: list[OrderItemInput],
        payment_method: str,
        status: str,
        note: str = "",
        request_key: str | None = None,
    ) -> tuple[int, bool]:
        if payment_method not in PAYMENT_METHODS:
            raise ValidationError("Forma de pagamento inválida.")
        if status not in VALID_STATUSES:
            raise ValidationError("Status inválido.")
        if not items:
            raise ValidationError("Pedido deve ter ao menos um item.")

        qty_by_product: dict[int, int] = {}
        for item in items:
            if item.quantity <= 0:
                raise ValidationError("Quantidade deve ser inteira maior que zero.")
            qty_by_product[item.product_id] = qty_by_product.get(item.product_id, 0) + int(item.quantity)

        product_ids = list(qty_by_product.keys())
        placeholders = ",".join("?" for _ in product_ids)
        with self.db.get_connection() as conn:
            products = conn.execute(
                f"SELECT id, name, category, price_cents, active FROM products WHERE id IN ({placeholders})",
                tuple(product_ids),
            ).fetchall()

            if len(products) != len(product_ids):
                raise ValidationError("Um ou mais produtos não existem.")

            product_map = {row["id"]: row for row in products}
            for pid in product_ids:
                if product_map[pid]["active"] != 1:
                    raise ValidationError("Não é permitido vender produto inativo.")

            order_items: list[dict] = []
            total_cents = 0
            for pid, qty in qty_by_product.items():
                row = product_map[pid]
                unit = int(row["price_cents"])
                subtotal = unit * qty
                total_cents += subtotal
                order_items.append(
                    {
                        "product_id": pid,
                        "product_name": row["name"],
                        "product_category": row["category"],
                        "quantity": qty,
                        "unit_price_cents": unit,
                        "subtotal_cents": subtotal,
                    }
                )

            if total_cents < 0:
                raise ValidationError("Total inválido.")

            try:
                conn.execute("BEGIN")
                cursor = conn.execute(
                    """
                    INSERT INTO orders (created_at_utc, status, payment_method, note, total_cents, request_key)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (now_utc_iso(), status, payment_method, (note or "").strip() or None, total_cents, request_key),
                )
                order_id = int(cursor.lastrowid)

                conn.executemany(
                    """
                    INSERT INTO order_items (
                        order_id, product_id, product_name, product_category,
                        quantity, unit_price_cents, subtotal_cents
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            order_id,
                            item["product_id"],
                            item["product_name"],
                            item["product_category"],
                            item["quantity"],
                            item["unit_price_cents"],
                            item["subtotal_cents"],
                        )
                        for item in order_items
                    ],
                )
                conn.commit()
                return order_id, True
            except Exception as exc:
                conn.rollback()
                if request_key and "UNIQUE constraint failed: orders.request_key" in str(exc):
                    row = conn.execute("SELECT id FROM orders WHERE request_key = ?", (request_key,)).fetchone()
                    if row:
                        return int(row["id"]), False
                raise

    def list_orders(
        self,
        start_date: date,
        end_date: date,
        status: str | None = None,
        payment_method: str | None = None,
    ) -> list[dict]:
        filters = []
        params: list = []
        if status:
            filters.append("status = ?")
            params.append(status)
        if payment_method:
            filters.append("payment_method = ?")
            params.append(payment_method)

        query = "SELECT * FROM orders"
        if filters:
            query += " WHERE " + " AND ".join(filters)
        query += " ORDER BY created_at_utc DESC, id DESC"

        with self.db.get_connection() as conn:
            orders = [dict(row) for row in conn.execute(query, tuple(params)).fetchall()]
            items = [dict(row) for row in conn.execute("SELECT * FROM order_items ORDER BY id").fetchall()]

        item_map: dict[int, list[dict]] = {}
        for item in items:
            item_map.setdefault(item["order_id"], []).append(item)

        filtered_orders = []
        for order in orders:
            local_dt = utc_to_sao_paulo(order["created_at_utc"])
            if not (start_date <= local_dt.date() <= end_date):
                continue
            order["created_at_local"] = local_dt
            order["items"] = item_map.get(order["id"], [])
            filtered_orders.append(order)

        return filtered_orders

    def update_order_status(self, order_id: int, new_status: str) -> None:
        if new_status not in VALID_STATUSES:
            raise ValidationError("Status inválido.")

        with self.db.get_connection() as conn:
            row = conn.execute("SELECT status FROM orders WHERE id = ?", (order_id,)).fetchone()
            if not row:
                raise ValidationError("Pedido não encontrado.")
            current = row["status"]

            if current == STATUS_CANCELED:
                raise ValidationError("Pedido cancelado não pode ser reaberto.")
            if current == STATUS_PENDING and new_status in {STATUS_COMPLETED, STATUS_CANCELED}:
                conn.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
            elif current == STATUS_COMPLETED and new_status == STATUS_CANCELED:
                conn.execute("UPDATE orders SET status = ? WHERE id = ?", (new_status, order_id))
            elif current == new_status:
                pass
            else:
                raise ValidationError("Transição de status não permitida.")
            conn.commit()

    def summary(self, start_date: date, end_date: date) -> dict:
        orders = self.list_orders(start_date, end_date, status=STATUS_COMPLETED)
        revenue = sum(order["total_cents"] for order in orders)
        count = len(orders)
        average = revenue // count if count else 0
        return {
            "revenue_cents": revenue,
            "completed_orders": count,
            "average_ticket_cents": average,
        }

    def export_concluded_csv(self, start_date: date, end_date: date) -> bytes:
        orders = self.list_orders(start_date, end_date, status=STATUS_COMPLETED)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "id_pedido",
                "data_hora",
                "id_produto",
                "nome_produto",
                "categoria",
                "quantidade",
                "preco_unitario",
                "subtotal_item",
                "forma_pagamento",
            ]
        )

        for order in orders:
            local_ts = order["created_at_local"].strftime("%Y-%m-%d %H:%M:%S")
            for item in order["items"]:
                writer.writerow(
                    [
                        order["id"],
                        local_ts,
                        item["product_id"],
                        item["product_name"],
                        item["product_category"],
                        item["quantity"],
                        item["unit_price_cents"] / 100,
                        item["subtotal_cents"] / 100,
                        order["payment_method"],
                    ]
                )

        return output.getvalue().encode("utf-8")
