// Cálculos do painel de análises (BI). Funções puras: recebem pedidos e devolvem indicadores.
import { day, money, total, type Order, type Product } from './domain.ts';

export type Bucket = { revenue: number; count: number };
export type Share = { name: string; revenue: number; count: number; share: number };
export type Abc = 'A' | 'B' | 'C';
export type ProductStat = { id: string; name: string; category: string; quantity: number; revenue: number; share: number; cumulative: number; abc: Abc };
export type DayStat = Bucket & { day: string };
export type WeekdayStat = Bucket & { days: number; averageRevenue: number; averageCount: number };
export type Analysis = ReturnType<typeof analyze>;

export const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const weekdayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const weekdayPlurals = ['domingos', 'segundas-feiras', 'terças-feiras', 'quartas-feiras', 'quintas-feiras', 'sextas-feiras', 'sábados'];
const hourFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' });
export const hourOf = (date: string) => Number(hourFormat.format(new Date(date))) % 24;
export const pct = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 }).format(value);

// Datas como 'AAAA-MM-DD' (dia civil em São Paulo). Meio-dia UTC evita erros na virada do dia.
export const addDays = (date: string, n: number) => new Date(Date.parse(date + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
export const weekdayOfDay = (date: string) => new Date(date + 'T12:00:00Z').getUTCDay();
export function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to && days.length < 1000; d = addDays(d, 1)) days.push(d);
  return days;
}
export function previousPeriod(from: string, to: string) {
  const length = daysBetween(from, to).length;
  return { from: addDays(from, -length), to: addDays(from, -1) };
}
export function variation(current: number, previous: number): number | null {
  return previous > 0 ? (current - previous) / previous : null;
}

function shares(map: Map<string, Bucket>, totalRevenue: number): Share[] {
  return [...map].map(([name, b]) => ({ name, ...b, share: totalRevenue ? b.revenue / totalRevenue : 0 })).sort((a, b) => b.revenue - a.revenue);
}
function add(map: Map<string, Bucket>, key: string, revenue: number, count: number) {
  const b = map.get(key) ?? { revenue: 0, count: 0 };
  b.revenue += revenue; b.count += count; map.set(key, b);
}

/** Indicadores do período. Sem `from`/`to`, o período vai do primeiro ao último pedido. */
export function analyze(orders: Order[], products: Product[], from = '', to = '') {
  const completed = orders.filter(o => o.status === 'Concluído');
  const orderDays = completed.map(o => day(o.createdAt)).sort();
  const start = from || orderDays[0] || '';
  const end = to || orderDays[orderDays.length - 1] || '';
  const daily: DayStat[] = start && end ? daysBetween(start, end).map(d => ({ day: d, revenue: 0, count: 0 })) : [];
  const dayIndex = new Map(daily.map((d, i) => [d.day, i]));
  const hours: Bucket[] = Array.from({ length: 24 }, () => ({ revenue: 0, count: 0 }));
  const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  const byWeekday: Bucket[] = Array.from({ length: 7 }, () => ({ revenue: 0, count: 0 }));
  const payments = new Map<string, Bucket>();
  const categories = new Map<string, Bucket>();
  const byProduct = new Map<string, { name: string; category: string; quantity: number; revenue: number }>();
  let revenue = 0, items = 0;

  for (const o of completed) {
    const value = total(o.items), d = day(o.createdAt), h = hourOf(o.createdAt), w = weekdayOfDay(d);
    revenue += value;
    const slot = dayIndex.get(d);
    if (slot !== undefined) { daily[slot].revenue += value; daily[slot].count++; }
    hours[h].revenue += value; hours[h].count++;
    byWeekday[w].revenue += value; byWeekday[w].count++;
    heat[w][h]++;
    add(payments, o.payment, value, 1);
    for (const i of o.items) {
      items += i.quantity;
      add(categories, i.category, i.price * i.quantity, i.quantity);
      const p = byProduct.get(i.productId) ?? { name: i.name, category: i.category, quantity: 0, revenue: 0 };
      p.quantity += i.quantity; p.revenue += i.price * i.quantity; byProduct.set(i.productId, p);
    }
  }
  // Produtos ativos sem venda também aparecem: são os "menos vendidos".
  for (const p of products) if (p.active && !byProduct.has(p.id)) byProduct.set(p.id, { name: p.name, category: p.category, quantity: 0, revenue: 0 });

  // Curva ABC: A = produtos que somam os primeiros 80% do faturamento, B = até 95%, C = restante.
  let cumulative = 0;
  const ranking: ProductStat[] = [...byProduct].sort(([, a], [, b]) => b.revenue - a.revenue || b.quantity - a.quantity).map(([id, p]) => {
    const share = revenue ? p.revenue / revenue : 0;
    const before = cumulative;
    cumulative += share;
    return { id, ...p, share, cumulative, abc: p.revenue === 0 ? 'C' : before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C' };
  });

  // Média por dia da semana: divide pelo número de vezes que aquele dia aparece no período.
  const occurrences = Array(7).fill(0);
  daily.forEach(d => occurrences[weekdayOfDay(d.day)]++);
  const weekday: WeekdayStat[] = byWeekday.map((b, w) => ({ ...b, days: occurrences[w], averageRevenue: occurrences[w] ? Math.round(b.revenue / occurrences[w]) : 0, averageCount: occurrences[w] ? b.count / occurrences[w] : 0 }));

  const cancelled = orders.filter(o => o.status === 'Cancelado').length;
  return {
    revenue, count: completed.length, items, average: completed.length ? Math.round(revenue / completed.length) : 0,
    cancelled, cancelRate: orders.length ? cancelled / orders.length : 0,
    daily, hours, heat, weekday, ranking,
    payments: shares(payments, revenue), categories: shares(categories, revenue),
  };
}

/** Sugestão de produção: média vendida de cada produto nos mesmos dias da semana das últimas `weeks` semanas. */
export function suggestion(orders: Order[], target: string, weeks = 4) {
  const sameDays = Array.from({ length: weeks }, (_, n) => addDays(target, -7 * (n + 1)));
  const quantities = new Map<string, { name: string; quantity: number }>();
  const daysWithSales = new Set<string>();
  for (const o of orders) {
    if (o.status !== 'Concluído') continue;
    const d = day(o.createdAt);
    if (!sameDays.includes(d)) continue;
    daysWithSales.add(d);
    for (const i of o.items) {
      const q = quantities.get(i.productId) ?? { name: i.name, quantity: 0 };
      q.quantity += i.quantity; quantities.set(i.productId, q);
    }
  }
  const n = daysWithSales.size;
  return {
    weekday: weekdayOfDay(target), days: n,
    products: n ? [...quantities.values()].map(q => ({ name: q.name, average: q.quantity / n, suggested: Math.ceil(q.quantity / n) })).sort((a, b) => b.average - a.average) : [],
  };
}

const hourRange = (h: number) => `${h}h às ${h + 1}h`;
/** Frases curtas e explicáveis para a empreendedora, geradas a partir dos indicadores. */
export function insights(a: Analysis, previous: Analysis | null): string[] {
  if (!a.count) return [];
  const list: string[] = [];
  const peak = a.hours.reduce((best, b, h) => b.count > a.hours[best].count ? h : best, 0);
  list.push(`O horário de maior movimento é das ${hourRange(peak)}, com ${pct(a.hours[peak].count / a.count)} dos pedidos.`);
  const bestDay = a.weekday.reduce((best, w, i) => w.averageRevenue > a.weekday[best].averageRevenue ? i : best, 0);
  if (a.weekday.filter(w => w.days).length > 1) list.push(`${weekdayNames[bestDay][0].toUpperCase() + weekdayNames[bestDay].slice(1)} é o dia com maior faturamento médio (${money(a.weekday[bestDay].averageRevenue)} por dia).`);
  const classA = a.ranking.filter(p => p.abc === 'A');
  if (classA.length) list.push(`${classA.length} de ${a.ranking.length} produtos (classe A) geram cerca de 80% do faturamento: ${classA.slice(0, 3).map(p => p.name).join(', ')}${classA.length > 3 ? '…' : ''}. Evite que faltem.`);
  const unsold = a.ranking.filter(p => p.quantity === 0);
  const sold = a.ranking.filter(p => p.quantity > 0);
  if (unsold.length) list.push(`${unsold.length === 1 ? 'Um produto ativo não teve' : `${unsold.length} produtos ativos não tiveram`} vendas no período: ${unsold.slice(0, 3).map(p => p.name).join(', ')}.`);
  else if (sold.length > 3) { const last = sold[sold.length - 1]; list.push(`O produto menos vendido foi ${last.name} (${last.quantity} un.). Avalie promoção, combo ou retirada do cardápio.`); }
  if (a.payments[0]) list.push(`${a.payments[0].name} é a forma de pagamento mais usada (${pct(a.payments[0].share)} do faturamento).`);
  const change = previous ? variation(a.revenue, previous.revenue) : null;
  if (change !== null && Math.abs(change) < 0.01) list.push('O faturamento ficou praticamente igual ao do período anterior de mesma duração.');
  else if (change !== null) list.push(`O faturamento ficou ${pct(Math.abs(change))} ${change >= 0 ? 'acima' : 'abaixo'} do período anterior de mesma duração.`);
  if (a.cancelRate >= 0.05) list.push(`${pct(a.cancelRate)} dos pedidos foram cancelados. Vale entender os motivos.`);
  return list;
}
