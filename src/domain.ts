export type Product = { id: string; name: string; category: string; price: number; active: boolean };
export type Item = { productId: string; name: string; category: string; price: number; quantity: number };
export type Status = 'Pendente' | 'Concluído' | 'Cancelado';
export type Order = { id: string; createdAt: string; items: Item[]; payment: string; status: Status; note: string };
export type Database = { products: Product[]; orders: Order[] };
export const payments = ['Pix', 'Dinheiro', 'Cartão de débito', 'Cartão de crédito'];
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export const day = (date: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
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
export function demo(): Database {
  const products: Product[] = [
    { id: 'demo-1', name: 'Sanduíche natural', category: 'Lanches', price: 1200, active: true },
    { id: 'demo-2', name: 'Pão de queijo', category: 'Salgados', price: 500, active: true },
    { id: 'demo-3', name: 'Café coado', category: 'Bebidas', price: 400, active: true },
    { id: 'demo-4', name: 'Suco de laranja', category: 'Bebidas', price: 700, active: true },
    { id: 'demo-5', name: 'Bolo de cenoura', category: 'Doces', price: 650, active: true },
    { id: 'demo-6', name: 'Coxinha de frango', category: 'Salgados', price: 800, active: true },
  ];
  const orders = Array.from({ length: 7 }, (_, n): Order => {
    const p = products[n % products.length];
    return { id: crypto.randomUUID(), createdAt: new Date(Date.now() - n * 25 * 60000).toISOString(), items: [{ productId: p.id, name: p.name, category: p.category, price: p.price, quantity: n % 2 + 1 }], payment: payments[n % 4], status: n === 0 ? 'Pendente' : 'Concluído', note: 'Pedido fictício para demonstração.' };
  });
  return { products, orders };
}
