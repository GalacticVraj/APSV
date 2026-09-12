import React from 'react';
import AIInsightButton from './AIInsightButton';

export default function GlobalAIButton() {
  return (
    <div className="fixed bottom-6 left-6 z-[9999]">
      <AIInsightButton
        id="global-ai-insight"
        templateKey="value_flow"
        dataPackage={{ context: "Global page context requested by user" }}
        placement="popover"
      />
    </div>
  );
}
