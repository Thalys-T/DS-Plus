import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOrder, day, demo, type Item, type Order, type Product, type Status } from '../src/domain.ts';
import { addDays, analyze, daysBetween, hourOf, insights, previousPeriod, suggestion, variation, weekdayOfDay } from '../src/analytics.ts';

const products: Product[] = [
  { id: 'a', name: 'Coxinha', category: 'Salgados', price: 1000, active: true },
  { id: 'b', name: 'Café', category: 'Bebidas', price: 500, active: true },
  { id: 'c', name: 'Torta', category: 'Doces', price: 700, active: true },
  { id: 'd', name: 'Antigo', category: 'Outros', price: 100, active: false },
];
const item = (p: Product, quantity: number): Item => ({ productId: p.id, name: p.name, category: p.category, price: p.price, quantity });
const order = (createdAt: string, items: Item[], payment = 'Pix', status: Status = 'Concluído'): Order => ({ ...createOrder(items, payment, status, ''), createdAt });

test('datas civis e horas são calculadas no fuso de São Paulo', () => {
  assert.equal(hourOf('2026-10-20T15:30:00Z'), 12);
  assert.equal(hourOf('2026-10-20T02:59:00Z'), 23);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(weekdayOfDay('2026-10-19'), 1);
  assert.deepEqual(daysBetween('2026-10-30', '2026-11-02'), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  assert.deepEqual(previousPeriod('2026-10-01', '2026-10-07'), { from: '2026-09-24', to: '2026-09-30' });
});

test('variação percentual trata período anterior vazio', () => {
  assert.equal(variation(150, 100), 0.5);
  assert.equal(variation(50, 0), null);
});

test('analisa faturamento por dia, hora, dia da semana, pagamento e categoria', () => {
  const orders = [
    order('2026-10-19T15:00:00Z', [item(products[0], 2)]), // segunda, 12h
    order('2026-10-20T21:00:00Z', [item(products[1], 1)], 'Dinheiro'), // terça, 18h
    order('2026-10-20T21:30:00Z', [item(products[0], 5)], 'Pix', 'Cancelado'),
  ];
  const a = analyze(orders, products, '2026-10-19', '2026-10-21');
  assert.equal(a.revenue, 2500); assert.equal(a.count, 2); assert.equal(a.items, 3); assert.equal(a.average, 1250);
  assert.deepEqual(a.daily.map(d => d.revenue), [2000, 500, 0]);
  assert.equal(a.hours[12].count, 1); assert.equal(a.hours[18].revenue, 500);
  assert.equal(a.heat[1][12], 1); assert.equal(a.heat[2][18], 1);
  assert.equal(a.weekday[1].averageRevenue, 2000); assert.equal(a.weekday[3].days, 1); assert.equal(a.weekday[3].averageRevenue, 0);
  assert.deepEqual(a.payments.map(p => [p.name, p.share]), [['Pix', 0.8], ['Dinheiro', 0.2]]);
  assert.deepEqual(a.categories.map(c => [c.name, c.count]), [['Salgados', 2], ['Bebidas', 1]]);
  assert.equal(a.cancelled, 1); assert.equal(a.cancelRate, 1 / 3);
});

test('curva ABC inclui produtos ativos sem venda e ignora inativos', () => {
  const a = analyze([order('2026-10-19T15:00:00Z', [item(products[0], 2), item(products[1], 1)])], products);
  assert.deepEqual(a.ranking.map(p => [p.id, p.abc]), [['a', 'A'], ['b', 'B'], ['c', 'C']]);
  assert.equal(a.ranking[1].cumulative, 1);
  assert.deepEqual(a.daily.map(d => d.day), ['2026-10-19']);
});

test('período sem vendas não gera erro nem conclusões', () => {
  const a = analyze([], products, '2026-10-01', '2026-10-07');
  assert.equal(a.revenue, 0); assert.equal(a.daily.length, 7);
  assert.deepEqual(insights(a, null), []);
});

test('sugestão de produção usa a média dos mesmos dias da semana', () => {
  const orders = [
    order('2026-10-19T15:00:00Z', [item(products[0], 2)]),
    order('2026-10-12T15:00:00Z', [item(products[0], 3), item(products[1], 1)]),
    order('2026-10-12T16:00:00Z', [item(products[0], 1)]),
    order('2026-10-20T15:00:00Z', [item(products[2], 9)]), // terça: não entra
  ];
  const s = suggestion(orders, '2026-10-26');
  assert.equal(s.weekday, 1); assert.equal(s.days, 2);
  assert.deepEqual(s.products.map(p => [p.name, p.average, p.suggested]), [['Coxinha', 3, 3], ['Café', 0.5, 1]]);
});

test('conclusões automáticas citam horário de pico e comparação', () => {
  const current = analyze([order('2026-10-19T15:00:00Z', [item(products[0], 2)])], products);
  const before = analyze([order('2026-10-12T15:00:00Z', [item(products[0], 1)])], products);
  const text = insights(current, before).join(' ');
  assert.match(text, /12h às 13h/);
  assert.match(text, /100% acima/);
});

test('dados de demonstração são válidos e seguem o funcionamento do negócio', () => {
  const now = new Date('2026-10-27T20:00:00Z');
  const db = demo(now);
  assert.ok(db.orders.length > 1000);
  assert.ok(db.orders.every(o => new Date(o.createdAt) <= now && o.items.length > 0));
  assert.ok(db.orders.every(o => weekdayOfDay(day(o.createdAt)) !== 0), 'domingo fechado');
  assert.equal(db.orders.filter(o => o.status === 'Pendente').length, 1);
  assert.equal(demo(now).orders.length, db.orders.length, 'mesma semente gera os mesmos dados');
  assert.ok(insights(analyze(db.orders, db.products), null).length >= 4);
});
