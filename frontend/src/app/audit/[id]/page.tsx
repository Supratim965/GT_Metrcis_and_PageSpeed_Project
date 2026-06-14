'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, RefreshCw, BarChart2 } from 'lucide-react';
import ReportDashboard, { AuditReport } from '../../../components/ReportDashboard';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function AuditReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [selectedReportIndex, setSelectedReportIndex] = useState(0);

  useEffect(() => {
    if (id) {
      fetchReportDetails();
    }
  }, [id]);

  const fetchReportDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/audit/${id}`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (!data.reports || data.reports.length === 0) {
        throw new Error('This audit run contains no URL reports.');
      }
      setReports(data.reports);
      setSelectedReportIndex(0);
    } catch (e: any) {
      setError(e.message || 'Failed to retrieve report data.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 pt-24 text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-sm font-semibold">Retrieving audit results...</span>
      </div>
    );
  }

  if (error || reports.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4 pt-24">
        <div className="text-rose-500 text-lg font-bold">Error Loading Report</div>
        <p className="text-slate-400 text-sm leading-relaxed">{error || 'Unknown error occurred.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-semibold text-sm transition-colors text-white"
        >
          Go Back Dashboard
        </button>
      </div>
    );
  }

  const selectedReport = reports[selectedReportIndex];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      {/* Navigation and Actions Row */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        <div className="flex gap-3 items-center">
          <span className="text-xs font-semibold text-slate-500">View Audited URL:</span>
          <select
            value={selectedReportIndex}
            onChange={(e) => setSelectedReportIndex(Number(e.target.value))}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors max-w-xs md:max-w-md truncate"
          >
            {reports.map((r, idx) => (
              <option key={r.id} value={idx}>
                {r.url}
              </option>
            ))}
          </select>

          <a
            href={`${BACKEND_URL}/audit/report/${id}/pdf`}
            download
            className="inline-flex items-center gap-1.5 text-sm font-semibold px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors"
          >
            <Download className="h-4 w-4" /> Download Report PDF
          </a>
        </div>
      </div>

      {/* Main visual layout */}
      <ReportDashboard report={selectedReport} />
    </div>
  );
}
