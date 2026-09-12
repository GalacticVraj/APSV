import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, RefreshCw, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';

import type { InsightTemplateKey, StructuredInsight } from '../../ai-insights/types';
import { getCached, setCached, clearCached } from '../../ai-insights/insightCache';

export type InsightPlacement = 'popover' | 'fixed-center';

interface Props {
  templateKey: InsightTemplateKey;
  dataPackage: Record<string, unknown>;
  /** Unique ID per instance — used for aria-controls and test targeting. */
  id: string;
  /**
   * 'popover' (default): panel anchored relative to the button using absolute positioning.
   * 'fixed-center': panel fixed to viewport bottom-center. Use inside Leaflet popups to
   *   avoid the insight card being clipped by the popup container.
   */
  placement?: InsightPlacement;
}

type PanelState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'open'; insight: StructuredInsight; provider?: string; fromCache: boolean };

export default function AIInsightButton({
  templateKey,
  dataPackage,
  id,
  placement = 'popover',
}: Props) {
  const [panel, setPanel] = useState<PanelState>({ phase: 'idle' });
  const [detailOpen, setDetailOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Close on outside click or Escape ────────────────────────────────────────
  useEffect(() => {
    if (panel.phase !== 'open' && panel.phase !== 'error') return;

    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPanel({ phase: 'idle' });
        setDetailOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPanel({ phase: 'idle' });
        setDetailOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [panel.phase]);

  // ── Fetch insight from API ────────────────────────────────────────────────
  const fetchInsight = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCached(templateKey, dataPackage);
      if (cached) {
        setPanel({
          phase: 'open',
          insight: cached.insight,
          provider: cached.provider,
          fromCache: true,
        });
        setDetailOpen(false);
        return;
      }
    }

    setPanel({ phase: 'loading' });

    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateKey,
          dataPackage,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setPanel({ phase: 'error', message: data.error || 'Failed to fetch' });
        return;
      }

      const insight: StructuredInsight = data.insight;
      setCached(templateKey, dataPackage, insight, data.provider);
      setPanel({ phase: 'open', insight, provider: data.provider, fromCache: false });
      setDetailOpen(false);
    } catch (err: unknown) {
      const axiosErr = err as { code?: string; response?: { status?: number } };
      if (axiosErr?.response?.status === 429) {
        setPanel({ phase: 'error', message: 'AI rate limit reached. Wait a moment and try again.' });
      } else if (axiosErr?.code === 'ECONNABORTED' || axiosErr?.code === 'ERR_NETWORK') {
        setPanel({ phase: 'error', message: 'Could not reach the AI service. Check your connection.' });
      } else {
        setPanel({ phase: 'error', message: 'Something went wrong fetching the insight.' });
      }
    }
  }, [templateKey, dataPackage]);

  const handleRefresh = useCallback(() => {
    clearCached(templateKey, dataPackage);
    fetchInsight(true);
  }, [templateKey, dataPackage, fetchInsight]);

  const handleClose = () => {
    setPanel({ phase: 'idle' });
    setDetailOpen(false);
  };

  const isOpen = panel.phase === 'open';
  const isError = panel.phase === 'error';
  const isLoading = panel.phase === 'loading';
  const isFromCache = isOpen && (panel as { fromCache: boolean }).fromCache;

  // ── Popover positioning ───────────────────────────────────────────────────
  const panelClass =
    placement === 'fixed-center'
      ? 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]'
      : 'absolute right-0 top-full mt-1.5 z-50';

  return (
    <div ref={wrapperRef} className="relative inline-flex" id={`${id}-wrapper`}>
      {/* ── Trigger button ── */}
      <button
        id={id}
        type="button"
        aria-expanded={isOpen}
        aria-controls={`${id}-panel`}
        title="AI Insight"
        onClick={() => {
          if (isOpen || isError) {
            setPanel({ phase: 'idle' });
            setDetailOpen(false);
          } else {
            fetchInsight(false);
          }
        }}
        className={`
          inline-flex items-center justify-center w-10 h-10 rounded-full border shadow-md transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-forest-700 focus:ring-offset-1
          ${isError
            ? 'border-red-300 text-red-600 bg-red-50 hover:bg-red-100'
            : isOpen
              ? 'border-forest-700 text-white bg-forest-800'
              : 'border-transparent text-white bg-forest-600 hover:bg-forest-700'
          }
        `}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isError ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Sparkles className="w-5 h-5" />
        )}
      </button>

      {/* ── Error tooltip ── */}
      {isError && (
        <div
          id={`${id}-panel`}
          className={`${panelClass} w-72 bg-white border border-red-200 rounded-sm shadow-panel`}
        >
          <div className="flex items-start gap-2.5 p-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-red-700 mb-0.5">Insight unavailable</p>
              <p className="text-xs text-charcoal-600">{(panel as { message: string }).message}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-charcoal-400 hover:text-charcoal-600 flex-shrink-0 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-3 pb-3">
            <button
              type="button"
              onClick={() => fetchInsight(true)}
              className="text-xs font-semibold text-forest-700 hover:text-forest-900 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" /> Try again
            </button>
          </div>
        </div>
      )}

      {/* ── Insight panel ── */}
      {isOpen && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-label="AI Insight"
          className={`${panelClass} w-80 bg-white border border-charcoal-200 rounded-sm shadow-panel animate-fade-in`}
          style={{ animationDuration: '0.18s' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-charcoal-100 bg-charcoal-50 rounded-t-sm">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-forest-700" />
              <span className="text-[10px] font-bold text-charcoal-700 uppercase tracking-wider">AI Insight</span>
              {isFromCache && (
                <span className="text-[9px] text-charcoal-400 font-medium ml-0.5">(cached)</span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleRefresh}
                title="Refresh insight"
                className="p-1 rounded text-charcoal-400 hover:text-forest-700 hover:bg-forest-50 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={handleClose}
                title="Close"
                className="p-1 rounded text-charcoal-400 hover:text-charcoal-700 hover:bg-charcoal-100 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {/* Section 1: Critical Finding */}
            <div className="px-3 py-2.5 bg-forest-50 border-b border-forest-100">
              <p className="text-[9px] font-bold text-forest-700 uppercase tracking-wider mb-1">
                Critical Finding
              </p>
              <p className="text-xs font-semibold text-charcoal-900 leading-relaxed">
                {(panel as { insight: StructuredInsight }).insight.finding}
              </p>
            </div>

            {/* Section 2: Carbon & Economic Framing */}
            <div className="px-3 py-2 border-b border-charcoal-100">
              <p className="text-[9px] font-bold text-charcoal-500 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <span>🌱</span> Carbon &amp; Economic
              </p>
              <p className="text-xs text-charcoal-700 leading-relaxed">
                {(panel as { insight: StructuredInsight }).insight.carbonEconomicFraming}
              </p>
            </div>

            {/* Section 3: Recommended Action */}
            <div className="px-3 py-2 border-b border-charcoal-100">
              <p className="text-[9px] font-bold text-charcoal-500 uppercase tracking-wider mb-0.5">
                → Action
              </p>
              <p className={`text-xs leading-relaxed ${
                (panel as { insight: StructuredInsight }).insight.action.toLowerCase().startsWith('no action')
                  ? 'text-charcoal-400 italic'
                  : 'text-charcoal-800 font-medium'
              }`}>
                {(panel as { insight: StructuredInsight }).insight.action}
              </p>
            </div>

            {/* Section 4: Supporting Detail (collapsible) */}
            <div className="px-3 py-1.5">
              <button
                type="button"
                onClick={() => setDetailOpen(!detailOpen)}
                className="flex items-center gap-1 text-[9px] font-bold text-charcoal-400 hover:text-charcoal-600 uppercase tracking-wider transition-colors w-full"
              >
                {detailOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Supporting Detail
              </button>
              {detailOpen && (
                <p className="text-[10px] text-charcoal-500 leading-relaxed mt-1.5 pl-4 border-l-2 border-charcoal-100">
                  {(panel as { insight: StructuredInsight }).insight.supportingDetail}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
