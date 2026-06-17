'use client';

/**
 * ResourceLoadMap.tsx
 * ─────────────────────────────────────────────────────
 * Heatmap showing each resource's load (idle / under / optimum / over)
 * across a timeline. Fetches from:
 *   GET /api/planning/revisions/{revisionId}/resource-histogram/
 *       ?granularity=day|week|month
 *
 * Place this file at:
 *   components/ResourceLoadMap.tsx
 *
 * Add page at:
 *   app/DashBoard/ResourceLoadMap/page.tsx
 *   (see companion page file)
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ZoomIn, ZoomOut, RefreshCw, ChevronDown,
  AlertTriangle, CheckCircle2, Minus, Moon,
  Info, X, Calendar, Layers, User, Clock,
} from 'lucide-react';
import { apiClient } from '../lib/api';
import { Revision, Project } from '../types/types';

// ─── Types ─────────────────────────────────────────────────────────────────

type Granularity = 'day' | 'week' | 'month';
type LoadStatus  = 'idle' | 'underload' | 'optimum' | 'overload';

interface TaskLoad {
  task_id: string;
  title:   string;
  hours:   number;
}

interface BucketLoad {
  bucket:           string;
  allocated_hours:  number;
  capacity_hours:   number;
  load_percent:     number;
  status:           LoadStatus;
  tasks:            TaskLoad[];
}

interface ResourceLoad {
  id:                      number;
  name:                    string;
  capacity_hours_per_day:  number;
  user_id:                 number | null;
  load:                    BucketLoad[];
}

interface HistogramData {
  revision_id:    string;
  granularity:    Granularity;
  buckets:        string[];
  bucket_labels:  string[];
  resources:      ResourceLoad[];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LoadStatus, {
  label: string; bg: string; border: string; text: string; ring: string; dot: string;
}> = {
  idle:      { label: 'Idle',      bg: 'bg-slate-800/60',          border: 'border-slate-700/40',   text: 'text-slate-500',   ring: 'ring-slate-600',   dot: 'bg-slate-600' },
  underload: { label: 'Underload', bg: 'bg-sky-900/50',            border: 'border-sky-700/40',     text: 'text-sky-300',     ring: 'ring-sky-500',     dot: 'bg-sky-500' },
  optimum:   { label: 'Optimum',   bg: 'bg-emerald-900/50',        border: 'border-emerald-600/40', text: 'text-emerald-300', ring: 'ring-emerald-500', dot: 'bg-emerald-500' },
  overload:  { label: 'Overload',  bg: 'bg-rose-900/60',           border: 'border-rose-600/50',    text: 'text-rose-300',    ring: 'ring-rose-500',    dot: 'bg-rose-500' },
};

// ─── Tooltip ────────────────────────────────────────────────────────────────

interface TooltipData {
  resource: ResourceLoad;
  bucket:   BucketLoad;
  label:    string;
  x: number; y: number;
}

function Tooltip({ data, onClose }: { data: TooltipData; onClose: () => void }) {
  const cfg = STATUS_CONFIG[data.bucket.status];
  return (
    <div
      className="fixed z-50 w-72 rounded-2xl border border-white/10 backdrop-blur-xl shadow-2xl p-4 text-xs"
      style={{ left: data.x, top: data.y, transform: 'translate(-50%, -110%)', backgroundColor: 'var(--bg-secondary)' }}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-semibold text-slate-100 text-sm">{data.resource.name}</div>
          <div className="text-slate-400 font-mono mt-0.5">{data.label}</div>
        </div>
        <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors mt-0.5">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* status badge */}
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border mb-3 ${cfg.bg} ${cfg.border} ${cfg.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        <span className="font-semibold uppercase tracking-wider text-[9px]">{cfg.label}</span>
        <span className="font-mono ml-1">{data.bucket.load_percent.toFixed(0)}%</span>
      </div>

      {/* bar */}
      <div className="mb-3">
        <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              data.bucket.status === 'overload'  ? 'bg-rose-500' :
              data.bucket.status === 'optimum'   ? 'bg-emerald-500' :
              data.bucket.status === 'underload' ? 'bg-sky-500' : 'bg-slate-600'
            }`}
            style={{ width: `${Math.min(data.bucket.load_percent, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[9px] font-mono text-slate-500">
          <span>{data.bucket.allocated_hours.toFixed(1)}h allocated</span>
          <span>{data.bucket.capacity_hours.toFixed(1)}h capacity</span>
        </div>
      </div>

      {/* tasks */}
      {data.bucket.tasks.length > 0 ? (
        <div className="space-y-1">
          <div className="text-[9px] uppercase tracking-widest text-slate-500 mb-1.5 font-semibold">Tasks</div>
          {data.bucket.tasks.map(t => (
            <div key={t.task_id} className="flex items-center justify-between gap-2 py-1 border-t border-white/5">
              <span className="text-slate-300 truncate flex-1">{t.title}</span>
              <span className="font-mono text-slate-400 shrink-0">{t.hours.toFixed(1)}h</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-600 italic text-[10px]">No tasks in this period.</p>
      )}
    </div>
  );
}

// ─── Heatmap Cell ───────────────────────────────────────────────────────────

function HeatCell({
  bucket, onClick, cellW,
}: {
  bucket: BucketLoad;
  onClick: (e: React.MouseEvent) => void;
  cellW: number;
}) {
  const cfg = STATUS_CONFIG[bucket.status];
  const pct = Math.min(bucket.load_percent, 150); // cap visual at 150%

  return (
    <div
      onClick={onClick}
      className={`
        relative group cursor-pointer rounded-md border transition-all duration-150
        hover:scale-[1.08] hover:z-10 hover:shadow-lg
        ${cfg.bg} ${cfg.border}
      `}
      style={{ width: cellW, height: 36, flexShrink: 0 }}
    >
      {/* fill bar from bottom */}
      <div
        className={`absolute bottom-0 left-0 right-0 rounded-b-md opacity-60 transition-all ${
          bucket.status === 'overload'  ? 'bg-rose-500' :
          bucket.status === 'optimum'   ? 'bg-emerald-500' :
          bucket.status === 'underload' ? 'bg-sky-500' : 'bg-slate-700'
        }`}
        style={{ height: `${(pct / 150) * 100}%` }}
      />

      {/* overload spike indicator */}
      {bucket.status === 'overload' && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1.5 rounded-full bg-rose-400 animate-pulse" />
      )}

      {/* percent label — shown if cell wide enough */}
      {cellW >= 32 && (
        <span className={`absolute inset-0 flex items-center justify-center text-[8px] font-mono font-bold z-10 ${cfg.text}`}>
          {bucket.load_percent > 0 ? `${Math.round(bucket.load_percent)}` : ''}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface ResourceLoadMapProps {
  revisions:         Revision[];
  projects:          Project[];
  activeRevisionId?: string | null;
}

export default function ResourceLoadMap({
  revisions,
  projects,
  activeRevisionId,
}: ResourceLoadMapProps) {
  const [selectedRevId, setSelectedRevId] = useState<string>(activeRevisionId ?? '');
  const [granularity,   setGranularity]   = useState<Granularity>('week');
  const [data,          setData]          = useState<HistogramData | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [tooltip,       setTooltip]       = useState<TooltipData | null>(null);
  const [cellSize,      setCellSize]      = useState<'sm' | 'md' | 'lg'>('md');

  const scrollRef = useRef<HTMLDivElement>(null);

  const CELL_W = { sm: 20, md: 36, lg: 52 }[cellSize];
  const ROW_H  = 36;
  const NAME_W = 180;

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!selectedRevId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/planning/revisions/${selectedRevId}/resource-histogram/?granularity=${granularity}`
      );
      setData(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Failed to load histogram data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedRevId, granularity]);

  // ── summary stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return null;
    let overloadCells = 0, optimumCells = 0, underCells = 0, idleCells = 0;
    for (const r of data.resources) {
      for (const b of r.load) {
        if (b.status === 'overload')  overloadCells++;
        else if (b.status === 'optimum')  optimumCells++;
        else if (b.status === 'underload') underCells++;
        else idleCells++;
      }
    }
    const overloadedResources = data.resources.filter(r =>
      r.load.some(b => b.status === 'overload')
    ).length;
    return { overloadCells, optimumCells, underCells, idleCells, overloadedResources };
  }, [data]);

  // ── tooltip handler ────────────────────────────────────────────────────────
  const handleCellClick = (e: React.MouseEvent, resource: ResourceLoad, bucket: BucketLoad, label: string) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltip({
      resource, bucket, label,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const revision = revisions.find(r => r.id === selectedRevId);
  const project  = revision ? projects.find(p => p.id === revision.projectId) : null;

  return (
    <div className="h-full w-full overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: "'DM Mono', 'JetBrains Mono', monospace" }}>

      {/* ── glow backdrop ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-[600px] h-[300px] bg-rose-500/4 blur-[100px] rounded-full" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[300px] bg-emerald-500/4 blur-[90px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-full px-5 py-5 space-y-5">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/5">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Resource Load Map</h1>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {project ? `${project.name} · ` : ''}
              {revision ? `Rev ${revision.number} — ${revision.description || ''}` : 'Select a revision'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Revision selector */}
            <div className="relative">
              <select
                value={selectedRevId}
                onChange={e => setSelectedRevId(e.target.value)}
                className="appearance-none bg-slate-900/70 border border-white/8 rounded-lg pl-3 pr-7 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 font-mono"
              >
                <option value="">— Select Revision —</option>
                {revisions.map(r => (
                  <option key={r.id} value={r.id}>
                    Rev {r.number} · {r.description || r.projectId}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
            </div>

            {/* Granularity tabs */}
            <div className="flex rounded-lg p-0.5 bg-slate-900/70 border border-white/8 gap-0.5">
              {(['day', 'week', 'month'] as Granularity[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest font-semibold transition-colors ${
                    granularity === g ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Cell size */}
            <div className="flex rounded-lg p-0.5 bg-slate-900/70 border border-white/8 gap-0.5">
              {(['sm', 'md', 'lg'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setCellSize(s)}
                  className={`px-2.5 py-1.5 rounded-md transition-colors ${
                    cellSize === s ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  title={s === 'sm' ? 'Compact' : s === 'md' ? 'Normal' : 'Large'}
                >
                  {s === 'sm' ? <ZoomOut className="w-3 h-3" /> : s === 'lg' ? <ZoomIn className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
                </button>
              ))}
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-900/70 border border-white/8 text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ── Summary cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: AlertTriangle, label: 'Overloaded Resources', value: stats.overloadedResources, color: 'text-rose-400',    bg: 'bg-rose-500/8',    border: 'border-rose-500/20' },
              { icon: CheckCircle2,  label: 'Optimum Slots',        value: stats.optimumCells,         color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20' },
              { icon: Minus,         label: 'Underload Slots',       value: stats.underCells,           color: 'text-sky-400',     bg: 'bg-sky-500/8',     border: 'border-sky-500/20' },
              { icon: Moon,          label: 'Idle Slots',            value: stats.idleCells,            color: 'text-slate-400',   bg: 'bg-slate-500/8',   border: 'border-slate-500/20' },
            ].map(({ icon: Icon, label, value, color, bg, border }) => (
              <div key={label} className={`rounded-xl border ${border} ${bg} p-3`}>
                <Icon className={`w-3.5 h-3.5 ${color} mb-2`} />
                <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error / loading ── */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
          </div>
        )}

        {loading && !data && (
          <div className="flex items-center justify-center py-24 gap-3">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-mono">Computing load…</span>
          </div>
        )}

        {/* ── Heatmap ── */}
        {data && data.resources.length > 0 && (
          <div className="rounded-2xl border border-white/5 bg-slate-900/40 overflow-hidden">

            {/* sticky header row */}
            <div className="flex border-b border-white/5 bg-black/30 sticky top-0 z-20">
              {/* name column */}
              <div
                className="shrink-0 px-4 py-2.5 text-[9px] uppercase tracking-widest text-slate-500 font-semibold border-r border-white/5 flex items-center gap-1.5"
                style={{ width: NAME_W }}
              >
                <User className="w-3 h-3" /> Resource
              </div>

              {/* bucket labels — scrollable in sync */}
              <div ref={scrollRef} className="flex overflow-x-auto scrollbar-none gap-1 px-2 py-1.5 flex-1">
                {data.bucket_labels.map((lbl, i) => (
                  <div
                    key={i}
                    className="text-[8px] font-mono text-slate-500 text-center shrink-0 leading-tight"
                    style={{ width: CELL_W }}
                  >
                    {lbl}
                  </div>
                ))}
              </div>
            </div>

            {/* resource rows */}
            <div className="divide-y divide-white/4">
              {data.resources.map(res => {
                const maxLoad = Math.max(...res.load.map(b => b.load_percent), 0);
                const isStressed = maxLoad > 100;

                return (
                  <div key={res.id} className={`flex group hover:bg-white/1 transition-colors ${isStressed ? 'bg-rose-500/3' : ''}`}>

                    {/* resource name */}
                    <div
                      className="shrink-0 px-4 py-2 border-r border-white/5 flex items-center gap-2.5"
                      style={{ width: NAME_W }}
                    >
                      <div className={`
                        w-7 h-7 rounded-lg flex items-center justify-center text-[9px] font-bold font-mono shrink-0
                        ${isStressed
                          ? 'bg-rose-500/15 border border-rose-500/25 text-rose-300'
                          : 'bg-slate-700/60 border border-white/8 text-slate-300'}
                      `}>
                        {res.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-200 truncate">{res.name}</div>
                        <div className="text-[9px] font-mono text-slate-500">{res.capacity_hours_per_day}h/day</div>
                      </div>
                      {isStressed && <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0 ml-auto" />}
                    </div>

                    {/* cells */}
                    <div className="flex overflow-x-auto scrollbar-none gap-1 px-2 py-1.5 flex-1 items-center">
                      {res.load.map((bucket, bi) => (
                        <HeatCell
                          key={bi}
                          bucket={bucket}
                          cellW={CELL_W}
                          onClick={e => handleCellClick(e, res, bucket, data.bucket_labels[bi])}
                        />
                      ))}
                    </div>

                    {/* max load indicator */}
                    <div className="shrink-0 px-3 flex items-center">
                      <div className={`text-[9px] font-mono font-bold ${
                        maxLoad > 100 ? 'text-rose-400' : maxLoad > 50 ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {Math.round(maxLoad)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {data && data.resources.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-white/5 flex items-center justify-center mb-4">
              <User className="w-6 h-6 text-slate-600" />
            </div>
            <p className="text-sm text-slate-400">No resources assigned in this revision.</p>
            <p className="text-xs text-slate-600 mt-1">Add resources via the Assignment panel in the Gantt view.</p>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="flex flex-wrap items-center gap-4 pt-1 border-t border-white/5 text-[9px] font-mono text-slate-500">
          <span className="text-slate-600 uppercase tracking-widest">Load status:</span>
          {(Object.entries(STATUS_CONFIG) as [LoadStatus, typeof STATUS_CONFIG[LoadStatus]][]).map(([key, cfg]) => (
            <span key={key} className={`flex items-center gap-1.5 ${cfg.text}`}>
              <span className={`w-2 h-2 rounded-sm ${cfg.dot}`} />
              {cfg.label}
            </span>
          ))}
          <span className="ml-auto text-slate-600">
            Click any cell to see task details
          </span>
        </div>
      </div>

      {/* ── Tooltip ── */}
      {tooltip && (
        <Tooltip data={tooltip} onClose={() => setTooltip(null)} />
      )}

      {/* close tooltip on bg click */}
      {tooltip && (
        <div className="fixed inset-0 z-40" onClick={() => setTooltip(null)} />
      )}
    </div>
  );
}
