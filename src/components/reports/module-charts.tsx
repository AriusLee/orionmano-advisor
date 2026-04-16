'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area,
} from 'recharts';

const COLORS = ['oklch(0.75 0.15 175)', 'oklch(0.65 0.15 250)', 'oklch(0.70 0.12 140)', 'oklch(0.60 0.18 300)', 'oklch(0.55 0.15 260)', 'oklch(0.70 0.15 50)'];
const TT = { background: 'oklch(0.20 0.014 260)', border: '1px solid oklch(0.30 0.014 260)', borderRadius: 8, fontSize: 12 };

// ============ GAP ANALYSIS ============

const NASDAQ_READINESS = [
  { metric: 'Shareholders\' Equity', score: 26, threshold: 100 },
  { metric: 'Net Income', score: 95, threshold: 100 },
  { metric: 'Revenue', score: 70, threshold: 100 },
  { metric: 'Operating History', score: 100, threshold: 100 },
  { metric: 'Public Float', score: 0, threshold: 100 },
];

const GAP_CATEGORIES = [
  { category: 'Financial', gaps: 3, critical: 1, label: '3 gaps (1 critical)' },
  { category: 'Governance', gaps: 3, critical: 0, label: '3 gaps' },
  { category: 'Reporting', gaps: 2, critical: 0, label: '2 gaps' },
  { category: 'Industry', gaps: 2, critical: 1, label: '2 gaps (1 critical)' },
];

const FINANCIAL_SNAPSHOT = [
  { name: 'Equity', value: 1.31, required: 5.0 },
  { name: 'Net Income', value: 0.95, required: 0.75 },
  { name: 'Cash', value: 0.23, required: 1.35 },
];

const READINESS_RADAR = [
  { area: 'Financial Standards', score: 40 },
  { area: 'Governance', score: 20 },
  { area: 'Reporting & Disclosure', score: 15 },
  { area: 'Internal Controls', score: 30 },
  { area: 'Industry Position', score: 65 },
  { area: 'Operating History', score: 90 },
];

export function GapAnalysisCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">IPO Readiness Radar</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={READINESS_RADAR} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="oklch(0.30 0.014 260)" />
                <PolarAngleAxis dataKey="area" tick={{ fontSize: 9, fill: 'oklch(0.65 0.01 260)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Readiness" dataKey="score" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Nasdaq Financial Thresholds</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {NASDAQ_READINESS.map((r) => {
              const pct = Math.min(r.score, 100);
              const status = r.score >= 100 ? 'pass' : r.score >= 75 ? 'caution' : r.score > 0 ? 'fail' : 'missing';
              const color = status === 'pass' ? COLORS[0] : status === 'caution' ? 'oklch(0.70 0.15 85)' : status === 'fail' ? 'oklch(0.65 0.18 25)' : 'oklch(0.40 0.01 260)';
              const label = status === 'pass' ? '✅' : status === 'caution' ? '⚠️' : status === 'fail' ? '❌' : '❓';
              return (
                <div key={r.metric}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{r.metric}</span>
                    <span style={{ color }}>{label} {r.score}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Gaps by Category</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={GAP_CATEGORIES} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" horizontal={false} />
                <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category" width={80} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={TT} formatter={(_: any, __: any, entry: any) => entry.payload.label} />
                <Bar dataKey="gaps" radius={[0, 4, 4, 0]} name="Gaps">
                  {GAP_CATEGORIES.map((entry, i) => (
                    <Cell key={i} fill={entry.critical > 0 ? 'oklch(0.65 0.18 25)' : COLORS[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Financial vs Nasdaq Requirements (USD M)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FINANCIAL_SNAPSHOT}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} unit="M" />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip contentStyle={TT} formatter={(v: any) => `$${Number(v).toFixed(2)}M`} />
                <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} name="Current" />
                <Bar dataKey="required" fill="oklch(0.40 0.01 260)" radius={[4, 4, 0, 0]} name="Required" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[0] }} />Current
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'oklch(0.40 0.01 260)' }} />Nasdaq Threshold
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ INDUSTRY EXPERT ============

const MARKET_SIZE = [
  { year: '2022', value: 680 },
  { year: '2023', value: 740 },
  { year: '2024', value: 810 },
  { year: '2025E', value: 890 },
  { year: '2026E', value: 980 },
  { year: '2027E', value: 1080 },
];

const COMPETITIVE = [
  { name: 'Market Leader', share: 32 },
  { name: 'Competitor A', share: 18 },
  { name: 'Competitor B', share: 14 },
  { name: 'Competitor C', share: 9 },
  { name: 'Others', share: 27 },
];

const GROWTH_DRIVERS = [
  { driver: 'Digital Transform.', impact: 85 },
  { driver: 'Market Expansion', impact: 72 },
  { driver: 'Regulatory', impact: 60 },
  { driver: 'M&A Activity', impact: 55 },
  { driver: 'Tech Innovation', impact: 78 },
];

export function IndustryCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Market Size & Forecast (USD M)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MARKET_SIZE}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} formatter={(v) => `$${Number(v)}M`} />
                <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} name="Market Size" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-1 text-center">CAGR: 9.7% (2022-2027E)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Competitive Landscape</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={COMPETITIVE} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="share">
                  {COMPETITIVE.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v) => `${Number(v)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            {COMPETITIVE.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />{d.name} ({d.share}%)
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Growth Driver Impact Assessment</CardTitle></CardHeader>
        <CardContent>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={GROWTH_DRIVERS} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="driver" width={110} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} formatter={(v) => `${Number(v)}/100`} />
                <Bar dataKey="impact" fill={COLORS[0]} radius={[0, 4, 4, 0]} name="Impact Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ DUE DILIGENCE ============

const DD_RATIOS = [
  { name: 'Current Ratio', value: 0.60, benchmark: 1.0 },
  { name: 'D/E Ratio', value: 1.8, benchmark: 2.0 },
  { name: 'Interest Coverage', value: 3.7, benchmark: 3.0 },
  { name: 'OCF Yield', value: 0.13, benchmark: 0.10 },
];

const DD_RADAR = [
  { metric: 'Revenue Quality', score: 72 },
  { metric: 'Profitability', score: 85 },
  { metric: 'Cash Generation', score: 65 },
  { metric: 'Leverage', score: 55 },
  { metric: 'Working Capital', score: 48 },
  { metric: 'Internal Controls', score: 60 },
];

const REVENUE_QUALITY = [
  { name: 'Recurring', value: 49 },
  { name: 'Licensing', value: 35 },
  { name: 'One-off', value: 16 },
];

const CONTROL_SCORES = [
  { area: 'Fixed Assets', score: 65 },
  { area: 'IT Controls', score: 50 },
  { area: 'Treasury', score: 70 },
  { area: 'HR & Payroll', score: 55 },
  { area: 'Financial Reporting', score: 60 },
  { area: 'Revenue Cycle', score: 75 },
];

export function DDCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Financial Health Radar</CardTitle></CardHeader>
        <CardContent>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={DD_RADAR} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="oklch(0.30 0.014 260)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: 'oklch(0.65 0.01 260)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Score" dataKey="score" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue Quality Mix</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={REVENUE_QUALITY} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {REVENUE_QUALITY.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={TT} formatter={(v) => `${Number(v)}%`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-1">
            {REVENUE_QUALITY.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />{d.name} ({d.value}%)
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Key Financial Ratios vs Benchmark</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {DD_RATIOS.map((r) => {
              const pct = Math.min((r.value / (r.benchmark * 1.5)) * 100, 100);
              const isGood = r.name === 'D/E Ratio' ? r.value <= r.benchmark : r.value >= r.benchmark;
              return (
                <div key={r.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{r.name}</span>
                    <span className={isGood ? 'text-emerald-400' : 'text-amber-400'}>{r.value.toFixed(2)} <span className="text-muted-foreground/50">(benchmark: {r.benchmark})</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isGood ? COLORS[0] : 'oklch(0.70 0.15 50)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Internal Control Assessment</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={CONTROL_SCORES} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="area" width={110} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} formatter={(v) => `${Number(v)}/100`} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]} name="Score">
                  {CONTROL_SCORES.map((entry, i) => (
                    <Cell key={i} fill={entry.score >= 70 ? COLORS[0] : entry.score >= 50 ? 'oklch(0.70 0.15 50)' : 'oklch(0.65 0.18 25)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ VALUATION ============

const DCF_WATERFALL = [
  { name: 'PV of Cash Flows', value: 31665 },
  { name: 'Terminal Value', value: 57259 },
  { name: 'Enterprise Value', value: 88924 },
  { name: 'Net Debt', value: -316 },
  { name: 'Equity Value', value: 89240 },
];

const COCO_MULTIPLES = [
  { name: 'Platinum Inv.', pe: 13.0, evEbitda: 8.2 },
  { name: 'BlackRock', pe: 20.2, evEbitda: 16.1 },
  { name: 'Franklin Res.', pe: 9.2, evEbitda: 7.8 },
  { name: 'Invesco', pe: 11.7, evEbitda: 9.5 },
  { name: 'Noah Holdings', pe: 6.1, evEbitda: 4.2 },
  { name: 'Victory Cap.', pe: 7.2, evEbitda: 8.9 },
  { name: 'Median', pe: 9.4, evEbitda: 8.5 },
];

const SENSITIVITY = [
  { wacc: '11%', g2: 105200, g3: 112800, g4: 122400 },
  { wacc: '12%', g2: 95600, g3: 101500, g4: 108700 },
  { wacc: '13%', g2: 87400, g3: 91800, g4: 97200 },
  { wacc: '14%', g2: 80300, g3: 83700, g4: 87800 },
  { wacc: '15%', g2: 74100, g3: 76800, g4: 80000 },
];

const MARGIN_PROJ = [
  { year: '2024A', ebit: 39.5, net: 34.0 },
  { year: '2025E', ebit: 39.5, net: 33.9 },
  { year: '2026E', ebit: 39.5, net: 33.8 },
  { year: '2027E', ebit: 39.5, net: 33.8 },
  { year: '2028E', ebit: 39.5, net: 33.7 },
];

export function ValuationCharts() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">DCF Value Build-Up (USD&apos;000)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={DCF_WATERFALL}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={TT} formatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Value">
                  {DCF_WATERFALL.map((entry, i) => (
                    <Cell key={i} fill={entry.value < 0 ? 'oklch(0.65 0.18 25)' : i === DCF_WATERFALL.length - 1 ? COLORS[2] : COLORS[0]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">CoCo Multiples Comparison</CardTitle></CardHeader>
        <CardContent>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={COCO_MULTIPLES}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TT} formatter={(v) => `${Number(v).toFixed(1)}x`} />
                <Bar dataKey="pe" fill={COLORS[0]} name="P/E" radius={[4, 4, 0, 0]} />
                <Bar dataKey="evEbitda" fill={COLORS[1]} name="EV/EBITDA" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sensitivity: EV by WACC vs Terminal Growth</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-2 px-3 text-left text-muted-foreground font-medium">WACC</th>
                  <th className="py-2 px-3 text-right text-muted-foreground font-medium">g = 2%</th>
                  <th className="py-2 px-3 text-right font-medium" style={{ color: COLORS[0] }}>g = 3%</th>
                  <th className="py-2 px-3 text-right text-muted-foreground font-medium">g = 4%</th>
                </tr>
              </thead>
              <tbody>
                {SENSITIVITY.map((row) => (
                  <tr key={row.wacc} className={`border-b ${row.wacc === '13%' ? 'bg-primary/5' : ''}`}>
                    <td className="py-2 px-3 font-medium">{row.wacc}</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">${(row.g2 / 1000).toFixed(1)}K</td>
                    <td className="py-2 px-3 text-right font-medium" style={{ color: row.wacc === '13%' ? COLORS[0] : undefined }}>${(row.g3 / 1000).toFixed(1)}K</td>
                    <td className="py-2 px-3 text-right text-muted-foreground">${(row.g4 / 1000).toFixed(1)}K</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">Base case: WACC 13%, Terminal growth 3%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Projected Margins (%)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MARGIN_PROJ}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.30 0.014 260)" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} />
                <YAxis domain={[25, 45]} tick={{ fontSize: 10, fill: 'oklch(0.65 0.01 260)' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={TT} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Area type="monotone" dataKey="ebit" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.2} name="EBIT Margin" />
                <Area type="monotone" dataKey="net" stroke={COLORS[1]} fill={COLORS[1]} fillOpacity={0.2} name="Net Margin" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
