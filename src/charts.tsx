// Gráficos leves em SVG/HTML, sem bibliotecas externas. Uma cor (verde) para magnitude; textos em tons neutros.
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { money } from './domain';
import { pct, weekdays, type DayStat, type Share } from './analytics';

const shortDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const compactMoney = (cents: number) => cents >= 100000 ? `R$ ${(cents / 100000).toFixed(cents >= 1000000 ? 0 : 1).replace('.', ',')} mil` : money(cents).replace(/,00$/, '');
function niceMax(value: number) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  return [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * step).find(m => m >= value) ?? value;
}
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Linha do faturamento diário com área, grade discreta e cursor com detalhes do dia. */
export function DailyChart({ data }: { data: DayStat[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const height = 230, left = 62, right = 14, top = 14, bottom = 28;
  const max = niceMax(Math.max(...data.map(d => d.revenue)));
  const x = (i: number) => left + (data.length > 1 ? i / (data.length - 1) : 0.5) * (width - left - right);
  const y = (v: number) => top + (1 - v / max) * (height - top - bottom);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.revenue).toFixed(1)}`).join('');
  const area = `${line}L${x(data.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor((width - left) / 70))));
  function move(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - box.left - left) / (width - left - right);
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  }
  const point = active !== null ? data[active] : null;
  return <div className="chart" ref={ref}>
    <svg width={width} height={height} role="img" aria-label="Faturamento por dia no período" onPointerMove={move} onPointerLeave={() => setActive(null)}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => <g key={t}><line className="grid-line" x1={left} x2={width - right} y1={y(max * t)} y2={y(max * t)} /><text className="axis-label" x={left - 8} y={y(max * t) + 3} textAnchor="end">{compactMoney(max * t)}</text></g>)}
      {data.map((d, i) => i % labelEvery === 0 && <text key={d.day} className="axis-label" x={x(i)} y={height - 8} textAnchor="middle">{shortDate(d.day)}</text>)}
      <path d={area} className="area" />
      <path d={line} className="line" />
      {data.length <= 31 && data.map((d, i) => <circle key={d.day} className="dot" cx={x(i)} cy={y(d.revenue)} r={3} />)}
      {point && active !== null && <g><line className="crosshair" x1={x(active)} x2={x(active)} y1={top} y2={height - bottom} /><circle className="dot active" cx={x(active)} cy={y(point.revenue)} r={5} /></g>}
    </svg>
    {point && active !== null && <div className="tooltip" style={{ left: Math.min(Math.max(x(active), 80), width - 80) }}><strong>{weekdays[new Date(point.day + 'T12:00:00Z').getUTCDay()]}, {shortDate(point.day)}</strong><span>{money(point.revenue)}</span><small>{point.count} pedidos</small></div>}
  </div>;
}

export type Column = { label: string; value: number; detail: string };
/** Colunas verticais (horas, dias da semana). Passar o mouse ou o foco mostra o detalhe na legenda. */
export function Columns({ items, caption }: { items: Column[]; caption: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...items.map(i => i.value));
  return <div className="columns-chart">
    <p className="chart-caption" aria-live="polite">{active !== null ? <><strong>{items[active].label}</strong> · {items[active].detail}</> : caption}</p>
    <div className="columns" onPointerLeave={() => setActive(null)}>
      {items.map((item, i) => <button key={item.label} type="button" className={`column ${active === i ? 'active' : ''}`} aria-label={`${item.label}: ${item.detail}`} onPointerEnter={() => setActive(i)} onFocus={() => setActive(i)} onBlur={() => setActive(null)}>
        <span className="column-bar" style={{ height: `${item.value / max * 100}%` }} />
        <span className="column-label">{item.label}</span>
      </button>)}
    </div>
  </div>;
}

/** Mapa de calor dia da semana × hora: mais escuro = mais pedidos. */
export function Heatmap({ heat, hours }: { heat: number[][]; hours: number[] }) {
  const [active, setActive] = useState<[number, number] | null>(null);
  const max = Math.max(1, ...heat.flat());
  const order = [1, 2, 3, 4, 5, 6, 0];
  return <div className="heatmap-wrap">
    <p className="chart-caption" aria-live="polite">{active ? <><strong>{weekdays[active[0]]}, {active[1]}h</strong> · {heat[active[0]][active[1]]} pedidos no período</> : 'Passe o mouse sobre uma célula para ver a quantidade de pedidos.'}</p>
    <div className="heatmap-scroll"><div className="heatmap" style={{ gridTemplateColumns: `38px repeat(${hours.length}, minmax(22px, 1fr))` }} onPointerLeave={() => setActive(null)}>
      <span />
      {hours.map(h => <span key={h} className="heat-hour">{h}h</span>)}
      {order.flatMap(w => [<span key={`d${w}`} className="heat-day">{weekdays[w]}</span>, ...hours.map(h => {
        const value = heat[w][h];
        return <span key={`${w}-${h}`} className={`heat-cell ${active?.[0] === w && active?.[1] === h ? 'active' : ''}`} title={`${weekdays[w]}, ${h}h: ${value} pedidos`} style={{ background: value ? `rgba(23, 103, 78, ${0.12 + 0.88 * value / max})` : undefined }} onPointerEnter={() => setActive([w, h])} />;
      })])}
    </div></div>
    <div className="heat-legend"><span>Menos</span>{[0.12, 0.34, 0.56, 0.78, 1].map(a => <i key={a} style={{ background: `rgba(23, 103, 78, ${a})` }} />)}<span>Mais pedidos</span></div>
  </div>;
}

/** Barras horizontais de participação (pagamento, categoria) com rótulo e valor. */
export function ShareBars({ items, unit }: { items: Share[]; unit: string }) {
  const max = Math.max(1, ...items.map(i => i.revenue));
  return <div className="share-list">
    {items.map(i => <div className="share-row" key={i.name}>
      <div className="share-text"><strong>{i.name}</strong><span>{money(i.revenue)} · {pct(i.share)}</span></div>
      <div className="bar"><span style={{ width: `${i.revenue / max * 100}%` }} /></div>
      <small>{i.count} {unit}</small>
    </div>)}
  </div>;
}
