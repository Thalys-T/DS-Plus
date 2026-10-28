export type Product = { id: string; name: string; category: string; price: number; active: boolean };
export type Item = { productId: string; name: string; category: string; price: number; quantity: number };
export type Status = 'Pendente' | 'Concluído' | 'Cancelado';
export type Order = { id: string; createdAt: string; items: Item[]; payment: string; status: Status; note: string };
export type Database = { products: Product[]; orders: Order[] };
export const payments = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito'];
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
export const day = (date: string) => dayFormat.format(new Date(date));
export const dateLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(date));
export function total(items: Item[]): number {
  if (items.some(i => !Number.isInteger(i.quantity) || i.quantity <= 0 || !Number.isSafeInteger(i.price) || i.price < 0)) throw new Error('Confira os valores e as quantidades dos itens.');
  const value = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  if (!Number.isSafeInteger(value)) throw new Error('O valor do pedido excede o limite permitido.');
  return value;
}
export function summary(orders: Order[]) {
  const completed = orders.filter(o => o.status === 'Concluído');
  const revenue = completed.reduce((sum, o) => sum + total(o.items), 0);
  return { revenue, count: completed.length, average: completed.length ? Math.round(revenue / completed.length) : 0 };
}
export function createOrder(items: Item[], payment: string, status: Status, note: string): Order {
  if (!items.length) throw new Error('Adicione pelo menos um produto ao pedido.');
  total(items);
  if (!payments.includes(payment)) throw new Error('Selecione uma forma de pagamento válida.');
  return { id: crypto.randomUUID(), createdAt: new Date().toISOString(), items: items.map(i => ({ ...i })), payment, status, note: note.trim() };
}
export function csv(orders: Order[]) {
  const cell = (v: unknown) => '"' + String(v).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""') + '"';
  const rows: unknown[][] = [['Pedido', 'Data e hora (America/Sao_Paulo)', 'ID produto', 'Produto', 'Categoria', 'Quantidade', 'Preço unitário (R$)', 'Subtotal (R$)', 'Pagamento']];
  orders.filter(o => o.status === 'Concluído').forEach(o => o.items.forEach(i => rows.push([o.id, new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), i.productId, i.name, i.category, i.quantity, (i.price / 100).toFixed(2).replace('.', ','), (i.price * i.quantity / 100).toFixed(2).replace('.', ','), o.payment])));
  return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
}
/**
 * Dados fictícios para demonstração: `days` dias de vendas com padrões plausíveis para um ponto de lanches
 * em frente a uma escola técnica (picos no café da manhã, almoço e intervalo da noite; sábado reduzido; domingo fechado).
 * Usa gerador pseudoaleatório com semente fixa para que os mesmos dados se repitam a cada execução.
 */
export function demo(now = new Date(), days = 60): Database {
  const products: Product[] = [
    { id: 'demo-1', name: 'Sanduíche natural', category: 'Lanches', price: 1200, active: true },
    { id: 'demo-2', name: 'X-salada', category: 'Lanches', price: 1500, active: true },
    { id: 'demo-3', name: 'Hambúrguer artesanal', category: 'Lanches', price: 1800, active: true },
    { id: 'demo-4', name: 'Pão de queijo', category: 'Salgados', price: 500, active: true },
    { id: 'demo-5', name: 'Coxinha de frango', category: 'Salgados', price: 800, active: true },
    { id: 'demo-6', name: 'Pastel de carne', category: 'Salgados', price: 900, active: true },
    { id: 'demo-7', name: 'Café coado', category: 'Bebidas', price: 400, active: true },
    { id: 'demo-8', name: 'Suco de laranja', category: 'Bebidas', price: 700, active: true },
    { id: 'demo-9', name: 'Refrigerante lata', category: 'Bebidas', price: 600, active: true },
    { id: 'demo-10', name: 'Bolo de cenoura', category: 'Doces', price: 650, active: true },
    { id: 'demo-11', name: 'Brigadeiro', category: 'Doces', price: 300, active: true },
    { id: 'demo-12', name: 'Torta de limão', category: 'Doces', price: 750, active: true },
  ];
  let seed = 2026;
  const random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = <T,>(options: T[], weights: number[]) => { let r = random() * weights.reduce((s, w) => s + w, 0); return options[weights.findIndex(w => (r -= w) < 0)] ?? options[0]; };
  const baseWeights = [5, 4, 3, 7, 8, 5, 6, 4, 6, 3, 2, 0.4];
  const hourWeights: Record<number, number> = { 7: 4, 8: 6, 9: 3, 10: 3, 11: 5, 12: 8, 13: 5, 14: 2, 15: 3, 16: 3, 17: 4, 18: 9, 19: 7, 20: 3 };
  const dailyOrders = [0, 26, 28, 30, 28, 36, 14]; // domingo a sábado
  const hours = Object.keys(hourWeights).map(Number);
  const today = day(now.toISOString());
  const orders: Order[] = [];
  for (let n = days - 1; n >= 0; n--) {
    const date = new Date(Date.parse(today + 'T12:00:00Z') - n * 86400000).toISOString().slice(0, 10);
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    const count = Math.round(dailyOrders[weekday] * (0.8 + random() * 0.4));
    for (let k = 0; k < count; k++) {
      const hour = pick(hours, hours.map(h => weekday === 6 && h > 13 ? 0 : hourWeights[h]));
      const createdAt = new Date(`${date}T${String(hour).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00-03:00`);
      if (createdAt > now) continue;
      const weights = baseWeights.map((w, i) => w * (hour < 10 ? [0.5, 0.3, 0.2, 2.5, 1, 0.6, 3, 1.2, 0.3, 1.5, 0.5, 0.5][i] : hour >= 17 ? [0.8, 1.6, 2, 0.8, 1.2, 1.3, 0.5, 0.8, 1.5, 0.6, 1, 1][i] : 1));
      const items: Item[] = [];
      for (let c = 0, size = 1 + Math.floor(random() * random() * 3); c < size; c++) {
        const p = pick(products, weights);
        const existing = items.find(i => i.productId === p.id);
        if (existing) existing.quantity++;
        else items.push({ productId: p.id, name: p.name, category: p.category, price: p.price, quantity: random() < 0.15 ? 2 : 1 });
      }
      orders.push({ id: crypto.randomUUID(), createdAt: createdAt.toISOString(), items, payment: pick(payments, [50, 20, 18, 12]), status: random() < 0.03 ? 'Cancelado' : 'Concluído', note: 'Pedido fictício para demonstração.' });
    }
  }
  orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (orders[0]) orders[0].status = 'Pendente';
  return { products, orders };
}
