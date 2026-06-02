import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { api } from '../lib/api';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { STAGES, STAGE_COLOR, type Stage } from '../lib/types';

type Bucket = 'week' | 'month';
type Series = { key: string; [k: string]: string | number }[];

export default function AnalyticsPage() {
  const [bucket, setBucket] = useState<Bucket>('week');
  const [bidders, setBidders] = useState<{ week: Series; month: Series }>({
    week: [],
    month: [],
  });
  const [interviewers, setInterviewers] = useState<{
    week: Series;
    month: Series;
    stages: Stage[];
  }>({ week: [], month: [], stages: [...STAGES] });
  const [brokers, setBrokers] = useState<{ week: Series; month: Series }>({
    week: [],
    month: [],
  });

  useEffect(() => {
    api.get('/analytics/bidders').then((r) => setBidders(r.data)).catch(() => {});
    api.get('/analytics/interviewers').then((r) => setInterviewers(r.data)).catch(() => {});
    api.get('/analytics/brokers').then((r) => setBrokers(r.data)).catch(() => {});
  }, []);

  const bidderRows = bidders[bucket];
  const bidderKeys = useMemo(() => collectKeys(bidderRows), [bidderRows]);

  const interviewerRows = interviewers[bucket];
  const interviewerKeys = useMemo(
    () => collectKeys(interviewerRows).filter((k) => k !== '__stageTotals'),
    [interviewerRows]
  );

  const interviewerStageTotals = useMemo(() => {
    return interviewerRows.map((row: any) => ({
      key: row.key,
      ...row.__stageTotals,
    }));
  }, [interviewerRows]);

  const brokerRows = brokers[bucket];
  const brokerKeys = useMemo(() => collectKeys(brokerRows), [brokerRows]);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Aggregate counts of scheduled interviews, successful interviews and won opportunities."
        actions={
          <div className="inline-flex rounded-md border border-slate-200 bg-white overflow-hidden">
            {(['week', 'month'] as Bucket[]).map((b) => (
              <button
                key={b}
                onClick={() => setBucket(b)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  bucket === b
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Per {b}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4">
        <ChartCard
          title="Bidder analysis"
          subtitle="Number of scheduled interviews per bidder."
        >
          {bidderRows.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bidderRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {bidderKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={palette(i)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Interviewer analysis"
          subtitle="Successful (done) interviews per interviewer, colored by process stage."
        >
          {interviewerStageTotals.length === 0 ? (
            <Empty />
          ) : (
            <div className="grid lg:grid-cols-5 gap-4">
              <div className="lg:col-span-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Stage totals
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={interviewerStageTotals}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {STAGES.map((s) => (
                      <Bar key={s} dataKey={s} stackId="a" fill={STAGE_COLOR[s]} name={s} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="lg:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  By interviewer & stage
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={interviewerRows} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="key" type="category" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip />
                    {interviewerKeys.map((k) => (
                      <Bar key={k} dataKey={k} stackId="a" fill={stageColorForKey(k)} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Broker analysis"
          subtitle="Number of successful (onboarded) opportunities per broker."
        >
          {brokerRows.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={brokerRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="key" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                {brokerKeys.map((k, i) => (
                  <Line
                    key={k}
                    dataKey={k}
                    stroke={palette(i)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-[200px] grid place-items-center text-sm text-slate-400">
      No data in this range yet.
    </div>
  );
}

function collectKeys(rows: Series): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) if (k !== 'key') set.add(k);
  return [...set];
}

function stageColorForKey(k: string): string {
  const m = k.match(/\(([^)]+)\)$/);
  const stage = (m?.[1] || 'intro') as Stage;
  return STAGE_COLOR[stage] || '#94a3b8';
}

const PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
function palette(i: number) {
  return PALETTE[i % PALETTE.length];
}
