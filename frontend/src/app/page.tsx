'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Plus, Trash, Globe, Shield, RefreshCw, Upload, Terminal, BarChart2 } from 'lucide-react';
import ResultsTable, { HistoryItem } from '../components/ResultsTable';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

interface UrlRow {
  id: string;
  url: string;
  isValid: boolean;
  status: 'IDLE' | 'PENDING' | 'RUNNING' | 'SUCCESS' | 'PARTIALLY_LOADED' | 'FAILED' | 'TIMEOUT';
  progressMessage: string;
}

export default function Home() {
  const [rows, setRows] = useState<UrlRow[]>([
    { id: '1', url: '', isValid: true, status: 'IDLE', progressMessage: '' },
  ]);
  const [bulkText, setBulkText] = useState('');
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null);
  const [auditProgress, setAuditProgress] = useState<number>(0);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch History on Load
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${BACKEND_URL}/audit/history`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Failed to fetch audit history:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const addRow = () => {
    if (rows.length >= 20) return;
    setRows([
      ...rows,
      { id: crypto.randomUUID(), url: '', isValid: true, status: 'IDLE', progressMessage: '' },
    ]);
  };

  const removeRow = (id: string) => {
    if (rows.length === 1) {
      setRows([{ id: '1', url: '', isValid: true, status: 'IDLE', progressMessage: '' }]);
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  const updateUrl = (id: string, val: string) => {
    setRows(
      rows.map((r) => {
        if (r.id !== id) return r;
        let isValid = true;
        if (val.trim()) {
          try {
            new URL(val);
            isValid = true;
          } catch (_) {
            isValid = false;
          }
        }
        return { ...r, url: val, isValid };
      })
    );
  };

  // Bulk paste handler
  const handleBulkPaste = () => {
    const urls = bulkText
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    const newRows = urls.slice(0, 20).map((url) => {
      let isValid = true;
      try {
        new URL(url);
      } catch (_) {
        isValid = false;
      }
      return {
        id: crypto.randomUUID(),
        url,
        isValid,
        status: 'IDLE' as const,
        progressMessage: '',
      };
    });

    if (newRows.length > 0) {
      setRows(newRows);
      setIsBulkMode(false);
      setBulkText('');
    }
  };

  // CSV file upload handler
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const urls = text
        .split(/[\n,]/)
        .map((u) => u.trim().replace(/^["']|["']$/g, ''))
        .filter((u) => u.startsWith('http://') || u.startsWith('https://'));

      const newRows = urls.slice(0, 20).map((url) => ({
        id: crypto.randomUUID(),
        url,
        isValid: true,
        status: 'IDLE' as const,
        progressMessage: '',
      }));

      if (newRows.length > 0) {
        setRows(newRows);
      }
    };
    reader.readAsText(file);
  };

  // Start Audit
  const handleStartAudit = async () => {
    const activeUrls = rows.map((r) => r.url.trim()).filter((u) => u.length > 0);
    const validUrls = rows.filter((r) => r.url.trim() && r.isValid).map((r) => r.url.trim());

    if (validUrls.length === 0) {
      alert('Please enter at least one valid URL.');
      return;
    }

    // Clear previous stream / logs
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    setConsoleLogs([]);
    setAuditProgress(0);

    // Update state to pending for processing URLs
    setRows(
      rows.map((r) => (r.url.trim() && r.isValid ? { ...r, status: 'PENDING' } : r))
    );

    try {
      const response = await fetch(`${BACKEND_URL}/audit/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: validUrls }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Server rejected audit request.');
      }

      const { auditId } = await response.json();
      setCurrentAuditId(auditId);
      
      // Subscribe to Server-Sent Events for live progress logs
      subscribeToProgress(auditId);
    } catch (e: any) {
      alert(`Failed to start audit: ${e.message}`);
      setRows(rows.map((r) => (r.status === 'PENDING' ? { ...r, status: 'IDLE' } : r)));
    }
  };

  const subscribeToProgress = (auditId: string) => {
    const sse = new EventSource(`${BACKEND_URL}/audit/${auditId}/stream`);
    eventSourceRef.current = sse;

    const logToTerminal = (text: string) => {
      setConsoleLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${text}`]);
    };

    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'connected') {
        logToTerminal('Connected to SSE queue channel. Waiting for audit workers...');
      } else if (data.type === 'status') {
        logToTerminal(`Audit status changed: ${data.status}`);
      } else if (data.type === 'url_progress') {
        logToTerminal(`[${data.url}] ${data.step} - ${data.message}`);
        
        // Update URL message
        setRows((prevRows) =>
          prevRows.map((r) =>
            r.url === data.url ? { ...r, status: 'RUNNING', progressMessage: data.message } : r
          )
        );

        if (data.percentage) {
          setAuditProgress(data.percentage);
        }
      } else if (data.type === 'url_complete') {
        logToTerminal(`Completed: ${data.url} with status ${data.status}`);
        
        setRows((prevRows) =>
          prevRows.map((r) =>
            r.url === data.url ? { ...r, status: data.status, progressMessage: `Completed: ${data.status}` } : r
          )
        );

        setAuditProgress(Math.round((data.completedCount / data.totalCount) * 100));
      }

      // If finished, close connections and refresh
      if (data.type === 'status' && data.status === 'COMPLETED') {
        logToTerminal('Audit completed successfully! Closing stream.');
        sse.close();
        setCurrentAuditId(null);
        fetchHistory();
      }
    };

    sse.onerror = () => {
      logToTerminal('Warning: Connection interrupted. Reconnecting...');
    };
  };

  // Delete Audit
  const handleDeleteAudit = async (auditId: string) => {
    if (!confirm('Are you sure you want to delete this audit history?')) return;
    try {
      const res = await fetch(`${BACKEND_URL}/audit/${auditId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12">
      {/* SaaS App Title Banner */}
      <div className="relative text-center max-w-2xl mx-auto space-y-4 pt-8">
        <span className="text-xs font-semibold px-3 py-1 bg-indigo-950 text-indigo-400 border border-indigo-500/20 rounded-full uppercase tracking-wider">
          Enterprise Audit Engine
        </span>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mt-3">
          Performance <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">Audit Hub</span>
        </h1>
        <p className="text-slate-400 text-sm md:text-base leading-relaxed">
          Validate uptime, loading statuses, device performance diagnostics and generate full cover-page PDF reports across 20 websites concurrently.
        </p>
      </div>

      {/* Inputs Panel Container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side Url Box */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <h2 className="font-bold text-white text-lg flex items-center gap-2">
              <Globe className="h-5 w-5 text-indigo-400" /> Target Website Audit Rows
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsBulkMode(!isBulkMode)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition-colors"
              >
                {isBulkMode ? 'URL Field Rows' : 'Bulk Paste'}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition-colors flex items-center gap-1"
              >
                <Upload className="h-3.5 w-3.5" /> CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </div>
          </div>

          {isBulkMode ? (
            <div className="space-y-4">
              <textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Paste URLs here, one per line (Max 20)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all font-mono"
              />
              <button
                onClick={handleBulkPaste}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-500 transition-colors"
              >
                Parse and Load URLs
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {rows.map((row, index) => (
                <div key={row.id} className="flex gap-2 items-center">
                  <div className="flex-1 relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-slate-500 font-mono">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={row.url}
                      onChange={(e) => updateUrl(row.id, e.target.value)}
                      placeholder="https://example.com"
                      className={`w-full bg-slate-950 border rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-700 focus:outline-none transition-all ${
                        !row.isValid ? 'border-rose-500/50' : 'border-slate-800 focus:border-indigo-500'
                      }`}
                    />
                  </div>

                  {/* Status Indicator pill */}
                  {row.status !== 'IDLE' && (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      row.status === 'PENDING' ? 'bg-amber-950 text-amber-400 border border-amber-500/20' :
                      row.status === 'RUNNING' ? 'bg-indigo-950 text-indigo-400 border border-indigo-500/20' :
                      row.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20' :
                      row.status === 'PARTIALLY_LOADED' ? 'bg-yellow-950 text-yellow-400 border border-yellow-500/20' :
                      'bg-rose-950 text-rose-400 border border-rose-500/20'
                    }`}>
                      {row.status}
                    </span>
                  )}

                  <button
                    onClick={() => removeRow(row.id)}
                    className="p-2.5 rounded-xl border border-slate-800 hover:border-rose-500/40 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!isBulkMode && rows.length < 20 && (
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Row
            </button>
          )}

          {/* Trigger Audit Action button */}
          <button
            onClick={handleStartAudit}
            disabled={!!currentAuditId}
            className={`w-full py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/10 ${
              currentAuditId ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {currentAuditId ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" /> Processing Audit...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" /> Trigger Audit Batch
              </>
            )}
          </button>
        </div>

        {/* Right Side console logging screen */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col h-[480px]">
          <h2 className="font-bold text-white text-lg flex items-center gap-2 border-b border-slate-800 pb-4 mb-4">
            <Terminal className="h-5 w-5 text-indigo-400" /> Audit Log Console
          </h2>
          
          <div className="flex-1 bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-xs text-slate-400 space-y-2 overflow-y-auto max-h-[300px]">
            {consoleLogs.length === 0 ? (
              <div className="text-slate-700 italic">Console output is currently idle. Trigger an audit to stream live logs.</div>
            ) : (
              consoleLogs.map((log, index) => (
                <div key={index} className="leading-relaxed whitespace-pre-wrap">{log}</div>
              ))
            )}
          </div>

          {currentAuditId && (
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-400">
                <span>Progress</span>
                <span>{auditProgress}%</span>
              </div>
              <div className="w-full bg-slate-950 h-2 border border-slate-900 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${auditProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Results Grid List Section */}
      <div className="space-y-6">
        <h2 className="font-bold text-white text-xl flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-indigo-400" /> Advanced Comparison Grid
        </h2>
        {isLoadingHistory ? (
          <div className="text-center py-12 text-slate-500">Loading audit database records...</div>
        ) : (
          <ResultsTable items={history} backendUrl={BACKEND_URL} onDelete={handleDeleteAudit} />
        )}
      </div>
    </div>
  );
}
