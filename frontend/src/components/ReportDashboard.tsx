'use client';

import React, { useState } from 'react';
import { ShieldCheck, Zap, Monitor, Smartphone, CheckCircle2, AlertTriangle, AlertCircle, FileText, ChevronRight } from 'lucide-react';

export interface AuditReport {
  id: string;
  url: string;
  status: string;
  load_time_ms: number;
  response_time_ms: number;
  dom_ready_ms: number;
  desktop_perf_score: number;
  desktop_acc_score: number;
  desktop_best_prac_score: number;
  desktop_seo_score: number;
  desktop_fcp_ms: number;
  desktop_lcp_ms: number;
  desktop_cls: number;
  desktop_tbt_ms: number;
  desktop_speed_index_ms: number;
  desktop_inp_ms: number;
  mobile_perf_score: number;
  mobile_acc_score: number;
  mobile_best_prac_score: number;
  mobile_seo_score: number;
  mobile_fcp_ms: number;
  mobile_lcp_ms: number;
  mobile_cls: number;
  mobile_tbt_ms: number;
  mobile_speed_index_ms: number;
  mobile_inp_ms: number;
  screenshot_desktop_full?: string;
  screenshot_mobile_full?: string;
  screenshot_desktop_above?: string;
  recommendations?: string; // stringified JSON
  error_message?: string;
}

interface ReportDashboardProps {
  report: AuditReport;
}

export default function ReportDashboard({ report }: ReportDashboardProps) {
  const [strategy, setStrategy] = useState<'desktop' | 'mobile'>('desktop');
  const [activeTab, setActiveTab] = useState<'overview' | 'recommendations' | 'screenshots'>('overview');

  const isSuccess = report.status === 'SUCCESS' || report.status === 'PARTIALLY_LOADED';
  const recommendations = isSuccess && report.recommendations ? JSON.parse(report.recommendations) : [];

  // Metrics depending on strategy
  const perf = strategy === 'desktop' ? report.desktop_perf_score : report.mobile_perf_score;
  const acc = strategy === 'desktop' ? report.desktop_acc_score : report.mobile_acc_score;
  const bestPrac = strategy === 'desktop' ? report.desktop_best_prac_score : report.mobile_best_prac_score;
  const seo = strategy === 'desktop' ? report.desktop_seo_score : report.mobile_seo_score;

  const fcp = strategy === 'desktop' ? report.desktop_fcp_ms : report.mobile_fcp_ms;
  const lcp = strategy === 'desktop' ? report.desktop_lcp_ms : report.mobile_lcp_ms;
  const cls = strategy === 'desktop' ? report.desktop_cls : report.mobile_cls;
  const tbt = strategy === 'desktop' ? report.desktop_tbt_ms : report.mobile_tbt_ms;
  const speedIdx = strategy === 'desktop' ? report.desktop_speed_index_ms : report.mobile_speed_index_ms;
  const inp = strategy === 'desktop' ? report.desktop_inp_ms : report.mobile_inp_ms;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'stroke-emerald-500 text-emerald-400';
    if (score >= 50) return 'stroke-amber-500 text-amber-400';
    return 'stroke-rose-500 text-rose-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  };

  const renderGauge = (score: number, title: string) => {
    const radius = 35;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    return (
      <div className="flex flex-col items-center p-4 bg-slate-900/60 rounded-xl border border-slate-800/80">
        <div className="relative w-24 h-24">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="48" cy="48" r={radius} className="stroke-slate-800 fill-none" strokeWidth="8" />
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={`fill-none gauge-circle ${getScoreColor(score)}`}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-slate-100">
            {score}%
          </div>
        </div>
        <div className="text-xs font-semibold text-slate-400 mt-3 uppercase tracking-wider">{title}</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">Target Webpage</span>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 break-all">{report.url}</h1>
          <div className="flex flex-wrap gap-3 mt-2 items-center text-sm text-slate-400">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              report.status === 'SUCCESS' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/20' : 'bg-rose-950/60 text-rose-400 border-rose-500/20'
            }`}>
              {report.status === 'SUCCESS' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {report.status}
            </span>
            <span>Tested: {new Date(report.created_at).toLocaleString()}</span>
          </div>
        </div>

        {/* Strategy Selector Toggle */}
        <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setStrategy('desktop')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              strategy === 'desktop' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="h-4 w-4" /> Desktop
          </button>
          <button
            onClick={() => setStrategy('mobile')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              strategy === 'mobile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="h-4 w-4" /> Mobile
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-800/80 gap-6">
        {['overview', 'recommendations', 'screenshots'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`pb-3 text-sm font-semibold border-b-2 capitalize transition-all ${
              activeTab === tab
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Failure Box */}
      {!isSuccess && (
        <div className="bg-rose-950/20 border border-rose-500/20 p-6 rounded-2xl flex gap-3 items-start">
          <AlertTriangle className="h-6 w-6 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-rose-400 text-lg">Diagnostics Execution Failed</h3>
            <p className="text-slate-300 mt-1 text-sm font-mono leading-relaxed">{report.error_message}</p>
          </div>
        </div>
      )}

      {isSuccess && activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Gauges section */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {renderGauge(perf, 'Performance')}
            {renderGauge(acc, 'Accessibility')}
            {renderGauge(bestPrac, 'Best Practices')}
            {renderGauge(seo, 'SEO')}
          </div>

          {/* Core Web Vitals Info cards */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Core Web Vitals & Key Timings</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">LCP</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{(lcp / 1000).toFixed(2)}s</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">Largest Contentful Paint</div>
              </div>
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">FCP</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{(fcp / 1000).toFixed(2)}s</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">First Contentful Paint</div>
              </div>
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">TBT</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{tbt}ms</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">Total Blocking Time</div>
              </div>
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">CLS</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{cls}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">Cumulative Layout Shift</div>
              </div>
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Speed Index</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{(speedIdx / 1000).toFixed(2)}s</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">Speed Index</div>
              </div>
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">INP</div>
                <div className="text-xl font-bold text-slate-100 mt-1">{inp}ms</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-snug">Interaction to Next Paint</div>
              </div>
            </div>
          </div>

          {/* Connection Diagnostics */}
          <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-4">Web Server Loading Diagnostics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Time to First Byte (TTFB)</div>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{report.response_time_ms}ms</div>
                </div>
                <Zap className="h-8 w-8 text-indigo-500/40" />
              </div>

              <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">DOM Interactive Ready</div>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{report.dom_ready_ms}ms</div>
                </div>
                <FileText className="h-8 w-8 text-indigo-500/40" />
              </div>

              <div className="p-4 bg-indigo-950/20 border border-indigo-500/10 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Full Load Time</div>
                  <div className="text-2xl font-bold text-indigo-400 mt-1">{(report.load_time_ms / 1000).toFixed(2)}s</div>
                </div>
                <CheckCircle2 className="h-8 w-8 text-indigo-500/40" />
              </div>
            </div>
          </div>
        </div>
      )}

      {isSuccess && activeTab === 'recommendations' && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4">Top Improvement Opportunities</h3>
          {recommendations.length === 0 ? (
            <div className="text-center p-8 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              Excellent! No high-impact performance suggestions found.
            </div>
          ) : (
            <div className="space-y-4">
              {recommendations.map((rec: any) => (
                <div key={rec.id} className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:border-slate-700/80 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${rec.score >= 0.9 ? 'bg-emerald-500' : rec.score >= 0.5 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                        {rec.title}
                      </div>
                      <p className="text-sm text-slate-400 mt-1 leading-relaxed">{rec.description}</p>
                    </div>
                    {rec.displayValue && (
                      <span className="shrink-0 text-xs font-bold px-2 py-1 bg-rose-950/60 text-rose-400 border border-rose-500/20 rounded">
                        {rec.displayValue}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isSuccess && activeTab === 'screenshots' && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4">Captured Viewport Visuals</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {report.screenshot_desktop_above && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-400">Desktop Viewport (Above the Fold)</div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <img src={`data:image/png;base64,${report.screenshot_desktop_above}`} alt="Desktop Screenshot" className="w-full object-contain max-h-[500px]" />
                </div>
              </div>
            )}
            {report.screenshot_mobile_full && (
              <div className="space-y-2">
                <div className="text-sm font-semibold text-slate-400">Mobile Emulation (Full View)</div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <img src={`data:image/png;base64,${report.screenshot_mobile_full}`} alt="Mobile Screenshot" className="w-full object-contain max-h-[500px]" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
