import React, { useState, useEffect } from 'react';
import { Download, FileText, Filter, Calendar, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import AppLayout from '../components/layout/AppLayout';
import apiClient from '../api/client';
import { useAuthStore } from '../stores/authStore';

interface Report {
  id: string;
  type: string;
  status: string;
  date_range_start: string;
  date_range_end: string;
  file_url: string;
  created_at: string;
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [formatType, setFormatType] = useState('csv');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/api/reports');
      setReports(data.reports);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      // Start of month to today for default quick generation
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);

      await apiClient.post('/api/reports', {
        type: 'impact',
        format: formatType,
        dateRangeStart: start.toISOString(),
        dateRangeEnd: end.toISOString(),
      });
      toast.success(`Report generation started (${formatType.toUpperCase()})`);
      fetchData();
    } catch {
      toast.error('Failed to start report generation');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">Reports & Exports</h1>
            <p className="page-subtitle">Generate impact reports for compliance and ESG tracking</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="card md:col-span-1 h-fit">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-forest-700" />
              Generate New Report
            </h2>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="label">Report Type</label>
                <select className="select" disabled>
                  <option>Impact Summary</option>
                  <option>Pickup Ledger (Coming soon)</option>
                </select>
              </div>
              <div>
                <label className="label">Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormatType('csv')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                      formatType === 'csv'
                        ? 'border-forest-600 bg-forest-50 text-forest-800'
                        : 'border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50'
                    }`}
                  >
                    CSV Data
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatType('pdf')}
                    className={`py-2 px-3 text-sm font-medium rounded-lg border transition-colors ${
                      formatType === 'pdf'
                        ? 'border-forest-600 bg-forest-50 text-forest-800'
                        : 'border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50'
                    }`}
                  >
                    PDF Document
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Date Range</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal-400" />
                    <input type="date" className="input pl-8 py-1.5 text-xs" />
                  </div>
                  <span className="text-charcoal-400 text-xs">to</span>
                  <div className="relative flex-1">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-charcoal-400" />
                    <input type="date" className="input pl-8 py-1.5 text-xs" />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={generating}
                className="btn-primary w-full mt-2"
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </button>
            </form>
          </div>

          <div className="card md:col-span-2">
            <h2 className="text-sm font-bold text-charcoal-900 mb-4">Report History</h2>
            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 skeleton rounded-xl" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-10 h-10 text-charcoal-300 mx-auto mb-3" />
                <p className="text-sm text-charcoal-500">No reports generated yet</p>
              </div>
            ) : (
              <div className="divide-y divide-charcoal-100">
                {reports.map((report) => (
                  <div key={report.id} className="py-3 flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      report.file_url?.endsWith('.pdf') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                    }`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-charcoal-900 capitalize">
                        {report.type} Report
                      </p>
                      <p className="text-xs text-charcoal-500">
                        {format(new Date(report.date_range_start), 'MMM d, yyyy')} - {format(new Date(report.date_range_end), 'MMM d, yyyy')}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          report.status === 'completed' ? 'bg-forest-100 text-forest-800' :
                          report.status === 'failed' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {report.status}
                        </span>
                        <span className="text-[10px] text-charcoal-400">
                          {format(new Date(report.created_at), 'dd MMM yyyy HH:mm')}
                        </span>
                      </div>
                    </div>
                    {report.status === 'completed' && report.file_url && (
                      <a
                        href={report.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl border border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50 hover:text-charcoal-900 transition-colors"
                        title="Download report"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
