import { Bar, BarChart, Cell, LabelList, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '../../ui/chart';
import { deductionTrend } from '../../../utils/dashboardMetrics';

const money = (value = 0) => `₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactMoney = value => `₱${Number(value).toLocaleString('en-PH', { notation: 'compact', maximumFractionDigits: 1 })}`;

export default function MonthlyDeductionsChart({ deductions = [] }) {
  const chartData = deductionTrend(deductions);
  const first = chartData[0];
  const last = chartData.at(-1);
  const dateRangeLabel = first.fullKey.slice(0, 4) === last.fullKey.slice(0, 4)
    ? `${first.month} – ${last.month} ${last.fullKey.slice(0, 4)}`
    : `${first.month} ${first.fullKey.slice(0, 4)} – ${last.month} ${last.fullKey.slice(0, 4)}`;
  const collected = chartData.reduce((sum, row) => sum + row.deductions, 0);
  const chartConfig = { deductions: { label: 'Deductions', color: '#3E7055' } };
  return (
<section className="td-chart-panel" aria-labelledby="td-deductions-title">
          <header><h2 id="td-deductions-title">Monthly deductions</h2><p>{dateRangeLabel} · {last.month} to date.</p></header>
          <ChartContainer config={chartConfig} className="td-contribution-chart" aria-label={`Monthly deductions, ${dateRangeLabel}`}>
            <BarChart accessibilityLayer data={chartData} margin={{ top: 30, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e3e8e5" />
              <XAxis dataKey="month" tickFormatter={month => month.slice(0, 3)} tickLine={false} axisLine={false} tickMargin={12} stroke="#646C78" fontSize={13} interval={0} />
              <YAxis tickFormatter={compactMoney} tickLine={false} axisLine={false} tickMargin={8} width={57} stroke="#646C78" fontSize={12} />
              <ChartTooltip cursor={{ fill: '#F8FBF8' }} content={<ChartTooltipContent formatter={value => money(value)} />} />
              <Bar dataKey="deductions" radius={[6, 6, 0, 0]} maxBarSize={72} isAnimationActive={false}>
                {chartData.map((row, index) => <Cell key={row.fullKey} fill={index === chartData.length - 1 ? '#3E7055' : '#A8C3AF'} />)}
                <LabelList dataKey="deductions" position="top" formatter={compactMoney} fill="#101820" fontSize={12} offset={10} />
              </Bar>
            </BarChart>
          </ChartContainer>
          {!deductions.length && <p className="td-empty" role="status">No deductions processed yet.</p>}
          <footer className="td-chart-footer"><div><p>Collected in shown period</p><strong>{money(collected)}</strong></div><p>{last.month} is month to date.</p></footer>
        </section>
  );
}
