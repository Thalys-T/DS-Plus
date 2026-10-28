import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, csv, day, summary, total, type Item } from '../src/domain.ts';
const item: Item = { productId: 'p1', name: 'Café', category: 'Bebidas', price: 450, quantity: 2 };
test('soma valores em centavos sem erros de ponto flutuante', () => {
  assert.equal(total([item, { ...item, price: 1250, quantity: 3 }]), 4650);
});
test('rejeita pedidos vazios, quantidades inválidas e preços negativos', () => {
  assert.throws(() => createOrder([], 'Pix', 'Concluído', ''));
  for (const quantity of [0, -1, 1.5, NaN]) assert.throws(() => total([{ ...item, quantity }]));
  assert.throws(() => total([{ ...item, price: -1 }]));
  assert.throws(() => createOrder([item], 'Inválido', 'Concluído', ''));
});
test('salva uma cópia dos dados históricos do item', () => {
  const source = { ...item }; const order = createOrder([source], 'Pix', 'Concluído', '');
  source.price = 1000; source.name = 'Outro nome'; source.category = 'Outros';
  assert.equal(order.items[0].price, 450); assert.equal(order.items[0].name, 'Café');
  assert.equal(order.items[0].category, 'Bebidas');
});
test('indicadores excluem pendentes e cancelados e tratam período vazio', () => {
  const orders = [createOrder([item], 'Pix', 'Concluído', ''), createOrder([{ ...item, price: 500 }], 'Pix', 'Concluído', ''), createOrder([item], 'Pix', 'Pendente', ''), createOrder([item], 'Pix', 'Cancelado', '')];
  assert.deepEqual(summary(orders), { revenue: 1900, count: 2, average: 950 });
  assert.deepEqual(summary([]), { revenue: 0, count: 0, average: 0 });
});
test('CSV exporta apenas concluídos com uma linha por item e escapa conteúdo', () => {
  const complete = createOrder([item, { ...item, name: '=SOMA(1;2)', quantity: 1 }], 'Pix', 'Concluído', '');
  const result = csv([complete, createOrder([item], 'Pix', 'Cancelado', '')]);
  assert.equal(result.split('\r\n').length, 3);
  assert.ok(result.includes('"4,50"')); assert.ok(result.includes('"9,00"'));
  assert.ok(result.includes("'=SOMA(1;2)"));
});
test('filtros de data respeitam a virada do dia em São Paulo', () => {
  assert.equal(day('2026-10-20T01:00:00Z'), '2026-10-19');
  assert.equal(day('2026-10-20T03:00:00Z'), '2026-10-20');
});
