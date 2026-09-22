import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Cell
} from 'recharts';
import { TrendingUp, Calendar, Zap } from 'lucide-react';
import { XHistoryRecord } from '../types';

interface WeeklyActivityChartProps {
  records: XHistoryRecord[];
}

interface DayData {
  dateStr: string;
  dayLabel: string;
  fullDate: string;
  count: number;
  isToday: boolean;
}

export const WeeklyActivityChart: React.FC<WeeklyActivityChartProps> = ({ records }) => {
  // Compute daily counts for the last 7 calendar days
  const { chartData, totalPast7Days, avgPerDay, peakDay } = useMemo(() => {
    const today = new Date();
    // Normalize to midnight
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const days: DayData[] = [];
    const dateMap: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      dateMap[key] = 0;

      const dayName = d.toLocaleDateString(undefined, { weekday: 'short' });
      const monthDay = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      days.push({
        dateStr: key,
        dayLabel: i === 0 ? 'Today' : dayName,
        fullDate: monthDay,
        count: 0,
        isToday: i === 0
      });
    }

    // Tally records collected on each of these 7 days
    records.forEach(r => {
      const timestamp = r.scannedAt || r.syncedAt || r.createdAt;
      if (!timestamp) return;
      try {
        const rDate = new Date(timestamp);
        const yyyy = rDate.getFullYear();
        const mm = String(rDate.getMonth() + 1).padStart(2, '0');
        const dd = String(rDate.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        if (dateMap[key] !== undefined) {
          dateMap[key]++;
        }
      } catch {}
    });

    let total = 0;
    let peakCount = -1;
    let peakLabel = 'None';

    days.forEach(d => {
      d.count = dateMap[d.dateStr] || 0;
      total += d.count;
      if (d.count > peakCount) {
        peakCount = d.count;
        peakLabel = `${d.dayLabel} (${d.count})`;
      }
    });

    const avg = (total / 7).toFixed(1);

    return {
      chartData: days,
      totalPast7Days: total,
      avgPerDay: avg,
      peakDay: peakCount > 0 ? peakLabel : '0'
    };
  }, [records]);

  // Calculate highest count for Y-axis scale
  const maxCount = useMemo(() => {
    const highest = Math.max(...chartData.map(d => d.count), 0);
    return Math.max(highest + 1, 4);
  }, [chartData]);

  return (
    <div id="weekly-activity-section" className="mt-5 pt-4 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800">
            <TrendingUp className="w-3.5 h-3.5 text-slate-700" />
          </div>
          <div>
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-900 font-bold flex items-center gap-1.5">
              <span>Weekly Activity</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded font-normal bg-slate-100 text-slate-600 border border-slate-200 font-sans">
                Last 7 Days
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-sans">
              Snippets collected and archived daily
            </p>
          </div>
        </div>

        {/* Quick summary stats */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Calendar className="w-3 h-3 text-slate-500" />
            <span className="text-slate-500">Total:</span>
            <strong className="text-slate-900">{totalPast7Days}</strong>
          </div>
          <div className="flex items-center gap-1 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
            <Zap className="w-3 h-3 text-amber-500" />
            <span className="text-slate-500">Daily avg:</span>
            <strong className="text-slate-900">{avgPerDay}</strong>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 sm:p-4">
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis 
                dataKey="dayLabel" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 11, fill: '#64748B', fontFamily: 'monospace' }}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                domain={[0, maxCount]}
                allowDecimals={false}
                tick={{ fontSize: 10, fill: '#94A3B8', fontFamily: 'monospace' }}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(148, 163, 184, 0.12)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as DayData;
                    return (
                      <div className="bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl border border-slate-800 text-xs font-sans">
                        <div className="font-semibold text-[11px] text-slate-300 font-mono mb-0.5">
                          {data.fullDate} ({data.dayLabel})
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                          <span>{data.count}</span>
                          <span className="text-slate-200 font-normal text-[11px]">
                            {data.count === 1 ? 'snippet collected' : 'snippets collected'}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                maxBarSize={42}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.isToday ? '#0F172A' : entry.count > 0 ? '#475569' : '#CBD5E1'} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
