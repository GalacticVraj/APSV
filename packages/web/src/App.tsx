import { useEffect, useState } from 'react';
import { RouterProvider, useRouter } from './router.tsx';
import { TwinProvider, useTwin } from './store.tsx';
import { Shell } from './components/Shell.tsx';
import { DemoBar, useDemo } from './components/DemoBar.tsx';

import Overview from './pages/Overview.tsx';
import MapPage from './pages/MapPage.tsx';
import Sources from './pages/Sources.tsx';
import Facilities from './pages/Facilities.tsx';
import Optimization from './pages/Optimization.tsx';
import Scenarios from './pages/Scenarios.tsx';
import Carbon from './pages/Carbon.tsx';
import CarbonLedger from './pages/CarbonLedger.tsx';
import CarbonPathways from './pages/CarbonPathways.tsx';
import CarbonFacilities from './pages/CarbonFacilities.tsx';
import CarbonEvidence from './pages/CarbonEvidence.tsx';
import CarbonOpportunities from './pages/CarbonOpportunities.tsx';
import CarbonScenarios from './pages/CarbonScenarios.tsx';
import CarbonReport from './pages/CarbonReport.tsx';
import Economics from './pages/Economics.tsx';
import Logistics from './pages/Logistics.tsx';
import Bottlenecks from './pages/Bottlenecks.tsx';
import Activity from './pages/Activity.tsx';
import System from './pages/System.tsx';
import Copilot from './pages/Copilot.tsx';

const ROUTES: Record<string, () => JSX.Element | null> = {
  '/': Overview,
  '/map': MapPage,
  '/sources': Sources,
  '/facilities': Facilities,
  '/optimization': Optimization,
  '/scenarios': Scenarios,
  '/carbon': Carbon,
  '/carbon/ledger': CarbonLedger,
  '/carbon/pathways': CarbonPathways,
  '/carbon/facilities': CarbonFacilities,
  '/carbon/evidence': CarbonEvidence,
  '/carbon/opportunities': CarbonOpportunities,
  '/carbon/scenarios': CarbonScenarios,
  '/carbon/report': CarbonReport,
  '/economics': Economics,
  '/logistics': Logistics,
  '/bottlenecks': Bottlenecks,
  '/activity': Activity,
  '/system': System,
  '/copilot': Copilot,
  '/demo': Overview,
};

function Routed() {
  const { path } = useRouter();
  const Page = ROUTES[path] ?? NotFound;
  return <Page />;
}

function NotFound() {
  const { navigate } = useRouter();
  return (
    <div className="section">
      <div className="empty" style={{ marginTop: 24 }}>
        <h4>No such screen</h4>
        <p>
          This URL does not correspond to a section of the application. Everything lives in the
          rail on the left.
        </p>
        <p style={{ marginTop: 10 }}>
          <button className="btn" onClick={() => navigate('/')}>
            Go to Overview
          </button>
        </p>
      </div>
    </div>
  );
}

function Boot() {
  const { boot, bootError } = useTwin();
  const demo = useDemo();
  const { path } = useRouter();

  // Entering /demo starts the guided walkthrough and hands control back to the
  // route the current step names.
  useEffect(() => {
    if (path === '/demo' && !demo.active) demo.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (bootError) {
    return (
      <div style={{ padding: 40, maxWidth: 660 }}>
        <h1 style={{ fontSize: 18, marginBottom: 8 }}>TERRAFLUX could not start</h1>
        <div className="empty">
          <h4>The engine is not responding</h4>
          <p>{bootError}</p>
          <div className="why">
            From the repository root, run <code>npm run dev</code>. That starts the API on port
            5174 and this client on port 5173.
          </div>
        </div>
      </div>
    );
  }

  if (!boot) {
    return (
      <div style={{ padding: 40 }}>
        <div className="loadstate">
          <div className="msg">Loading network topology and reference data…</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Shell demoActive={demo.active}>
        <Routed />
      </Shell>
      {demo.active && <DemoBar demo={demo} />}
    </>
  );
}

export default function App() {
  return (
    <RouterProvider>
      <TwinProvider>
        <Boot />
      </TwinProvider>
    </RouterProvider>
  );
}
