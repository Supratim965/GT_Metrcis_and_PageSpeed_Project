'use client';

import React, { useState } from 'react';
import { Download, Search, SlidersHorizontal, ArrowUpDown, ExternalLink, Image as ImageIcon, Trash2 } from 'lucide-react';

export interface HistoryItem {
  audit_id: string;
  created_at: string;
  audit_status: string;
  total_urls: number;
  report_id: string;
  url: string;
  url_status: string;
  load_time_ms: number;
  desktop_perf_score: number;
  mobile_perf_score: number;
}

interface ResultsTableProps {
  items: HistoryItem[];
  backendUrl: string;
  onDelete: (auditId: string) => void;
}

export default function ResultsTable({ items, backendUrl, onDelete }: ResultsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<keyof HistoryItem>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Filter
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.url.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || item.url_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Sort
  const sortedItems = [...filteredItems].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];

    if (typeof valA === 'string') {
      return sortOrder === 'asc'
        ? (valA as string).localeCompare(valB as string)
        : (valB as string).localeCompare(valA as string);
    }

    if (typeof valA === 'number') {
      return sortOrder === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    }

    return 0;
  });

  const handleSort = (field: keyof HistoryItem) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null || score === undefined) return 'text-slate-400 bg-slate-950 border-slate-800';
    if (score >= 90) return 'text-emerald-400 bg-emerald-950/40 border-emerald-500/20';
    if (score >= 50) return 'text-yellow-400 bg-yellow-950/40 border-yellow-500/20';
    return 'text-rose-400 bg-rose-950/40 border-rose-500/20';
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/60 p-4 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search URLs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>

        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="PARTIALLY_LOADED">Partial Load</option>
            <option value="FAILED">Failed</option>
            <option value="TIMEOUT">Timeout</option>
          </select>
        </div>
      </div>

      {/* Grid Container */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="p-4 select-none">
                  <button onClick={() => handleSort('url')} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                    Target URL <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="p-4 select-none">Status</th>
                <th className="p-4 select-none">
                  <button onClick={() => handleSort('desktop_perf_score')} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                    Desktop Score <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="p-4 select-none">
                  <button onClick={() => handleSort('mobile_perf_score')} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                    Mobile Score <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="p-4 select-none">
                  <button onClick={() => handleSort('load_time_ms')} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                    Load Duration <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="p-4 select-none">
                  <button onClick={() => handleSort('created_at')} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                    Date tested <ArrowUpDown className="h-3.5 w-3.5" />
                  </button>
                </th>
                <th className="p-4 text-right">Reports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 text-sm text-slate-300">
              {sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No matching audit runs found.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <tr key={item.report_id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="p-4 font-medium max-w-xs truncate">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-400 inline-flex items-center gap-1">
                        {item.url} <ExternalLink className="h-3 w-3 text-slate-500" />
                      </a>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                        item.url_status === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20'
                          : item.url_status === 'PARTIALLY_LOADED'
                          ? 'bg-yellow-950 text-yellow-400 border border-yellow-500/20'
                          : 'bg-rose-950/60 text-rose-400 border border-rose-500/20'
                      }`}>
                        {item.url_status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${getScoreColor(item.desktop_perf_score)}`}>
                        {item.desktop_perf_score ?? 'N/A'}{item.desktop_perf_score !== null && '%'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold border ${getScoreColor(item.mobile_perf_score)}`}>
                        {item.mobile_perf_score ?? 'N/A'}{item.mobile_perf_score !== null && '%'}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-400">
                      {item.load_time_ms ? `${(item.load_time_ms / 1000).toFixed(2)}s` : 'N/A'}
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <a
                        href={`/audit/${item.audit_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-900 transition-colors"
                      >
                        Details
                      </a>
                      <a
                        href={`${backendUrl}/audit/report/${item.audit_id}/pdf`}
                        download
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-900 hover:text-slate-200 transition-colors"
                      >
                        <Download className="h-3 w-3" /> PDF
                      </a>
                      <button
                        onClick={() => onDelete(item.audit_id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-md border border-slate-800 hover:border-rose-500/40 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Delete Audit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
