import React from 'react';
import AIInsightButton from './AIInsightButton';
import '../../styles/ai-insight.css';

export default function GlobalAIButton() {
  return (
    <div className="ai-root fixed bottom-6 left-6 z-[9999]">
      <AIInsightButton
        id="global-ai-insight"
        templateKey="value_flow"
        dataPackage={{ context: "Global page context requested by user" }}
        placement="popover"
      />
    </div>
  );
}
