// Página "Análises": painel de BI calculado em tempo real a partir dos pedidos registrados.
import { useMemo } from 'react';
import { ArrowUpRight, CalendarDays, ChefHat, Clock, CreditCard, Layers, Lightbulb, TrendingUp } from 'lucide-react';
import { money, type Order, type Product } from './domain';
import { addDays, analyze, insights, pct, suggestion, weekdayNames, weekdayPlurals, weekdays } from './analytics';
import { Columns, DailyChart, Heatmap, ShareBars } from './charts';

type Props = { orders: Order[]; previous: Order[] | null; allOrders: Order[]; products: Product[]; from: string; to: string; today: string; demo: boolean; onDemo: () => void };

export default function Dashboard({ orders, previous, allOrders, products, from, to, today, demo, onDemo }: Props) {
  const a = useMemo(() => analyze(orders, products, from, to), [orders, products, from, to]);
  const before = useMemo(() => previous ? analyze(previous, products) : null, [previous, products]);
  const tips = useMemo(() => insights(a, before), [a, before]);
  const tomorrow = addDays(today, 1);
  const plan = useMemo(() => suggestion(allOrders, tomorrow, products), [allOrders, tomorrow, products]);

  if (!a.count) return <section className="panel empty dashboard-empty">
    <TrendingUp size={32} />
    <h3>Ainda não há vendas concluídas neste período</h3>
    <p>Os gráficos aparecem assim que houver vendas. Escolha um período maior ou explore com dados fictícios.</p>
    {!demo && <button className="primary" onClick={onDemo}>Experimentar demonstração <ArrowUpRight size={16} /></button>}
  </section>;

  const used = a.hours.map((h, i) => h.count ? i : -1).filter(i => i >= 0);
  const hours = Array.from({ length: used[used.length - 1] - used[0] + 1 }, (_, i) => used[0] + i);
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];

  return <div className="dashboard">
    <section className="panel insights-panel">
      <div className="panel-heading"><div><h2>O que os dados dizem</h2><p>Conclusões automáticas sobre o período selecionado.</p></div><span className="icon-tile"><Lightbulb size={18} /></span></div>
      <ul className="insight-list">{tips.map(t => <li key={t}>{t}</li>)}</ul>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><h2>Faturamento por dia</h2><p>{a.daily.length} dias · {money(a.revenue)} no total · {a.items} itens vendidos</p></div><span className="icon-tile"><TrendingUp size={18} /></span></div>
      <DailyChart data={a.daily} />
    </section>

    <div className="dashboard-row">
      <section className="panel">
        <div className="panel-heading"><div><h2>Pedidos por horário</h2><p>Total de pedidos concluídos em cada hora do dia.</p></div><span className="icon-tile"><Clock size={18} /></span></div>
        <Columns caption="Passe o mouse sobre uma barra para ver os detalhes." items={hours.map(h => ({ label: `${h}h`, value: a.hours[h].count, detail: `${a.hours[h].count} pedidos · ${money(a.hours[h].revenue)}` }))} />
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Faturamento médio por dia da semana</h2><p>Média por dia, considerando quantas vezes cada dia aparece no período.</p></div><span className="icon-tile"><CalendarDays size={18} /></span></div>
        <Columns caption="Passe o mouse sobre uma barra para ver os detalhes." items={weekOrder.map(w => ({ label: weekdays[w], value: a.weekday[w].averageRevenue, detail: `${money(a.weekday[w].averageRevenue)} por dia · ${a.weekday[w].averageCount.toFixed(1).replace('.', ',')} pedidos por dia` }))} />
      </section>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><h2>Mapa de movimento</h2><p>Quantidade de pedidos por dia da semana e hora. Ajuda a planejar produção e atendimento.</p></div><span className="icon-tile"><CalendarDays size={18} /></span></div>
      <Heatmap heat={a.heat} hours={hours} />
    </section>

    <div className="dashboard-row">
      <section className="panel">
        <div className="panel-heading"><div><h2>Formas de pagamento</h2><p>Participação no faturamento.</p></div><span className="icon-tile"><CreditCard size={18} /></span></div>
        <ShareBars items={a.payments} unit="pedidos" />
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Categorias</h2><p>Participação no faturamento.</p></div><span className="icon-tile"><Layers size={18} /></span></div>
        <ShareBars items={a.categories} unit="itens vendidos" />
      </section>
    </div>

    <section className="panel">
      <div className="panel-heading"><div><h2>Curva ABC dos produtos</h2><p>Classe A: produtos que somam 80% do faturamento · B: até 95% · C: restante (inclui ativos sem venda).</p></div></div>
      <div className="table-scroll"><table>
        <thead><tr><th>#</th><th>Produto</th><th>Categoria</th><th className="right">Quantidade</th><th className="right">Faturamento</th><th className="right">% do total</th><th className="right">% acumulado</th><th>Classe</th></tr></thead>
        <tbody>{a.ranking.map((p, n) => <tr key={p.id}><td>{n + 1}</td><td><strong>{p.name}</strong></td><td>{p.category}</td><td className="right">{p.quantity}</td><td className="right"><strong>{money(p.revenue)}</strong></td><td className="right">{pct(p.share)}</td><td className="right">{pct(p.cumulative)}</td><td><span className={`badge abc-${p.abc}`}>{p.abc}</span></td></tr>)}</tbody>
      </table></div>
    </section>

    <section className="panel">
      <div className="panel-heading"><div><h2>Sugestão de produção para amanhã ({weekdayNames[plan.weekday]})</h2><p>{plan.days ? `Média vendida em ${plan.days} ${plan.days > 1 ? weekdayPlurals[plan.weekday] : weekdayNames[plan.weekday]} recente${plan.days > 1 ? 's' : ''} (últimas 4 semanas). Use como ponto de partida.` : 'Sem vendas registradas neste dia da semana nas últimas 4 semanas.'}</p></div><span className="icon-tile"><ChefHat size={18} /></span></div>
      {plan.products.length > 0 && <div className="table-scroll"><table>
        <thead><tr><th>Produto</th><th className="right">Média vendida</th><th className="right">Sugestão</th></tr></thead>
        <tbody>{plan.products.map(p => <tr key={p.id}><td><strong>{p.name}</strong></td><td className="right">{p.average.toFixed(1).replace('.', ',')}</td><td className="right"><strong>{p.suggested} un.</strong></td></tr>)}</tbody>
      </table></div>}
      <div className="panel-foot">Indicadores consideram apenas pedidos concluídos e são recalculados a cada novo registro. Datas no fuso de São Paulo.</div>
    </section>
  </div>;
}
