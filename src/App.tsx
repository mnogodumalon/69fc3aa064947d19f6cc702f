import '@/lib/sentry';
import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorBusProvider } from '@/components/ErrorBus';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import { WorkflowPlaceholders } from '@/components/WorkflowPlaceholders';
import AdminPage from '@/pages/AdminPage';
import KundenverwaltungPage from '@/pages/KundenverwaltungPage';
import KatzenverwaltungPage from '@/pages/KatzenverwaltungPage';
import ZimmerverwaltungPage from '@/pages/ZimmerverwaltungPage';
import LeistungsverwaltungPage from '@/pages/LeistungsverwaltungPage';
import BuchungsverwaltungPage from '@/pages/BuchungsverwaltungPage';
import GesundheitsprotokollPage from '@/pages/GesundheitsprotokollPage';
import PublicFormKundenverwaltung from '@/pages/public/PublicForm_Kundenverwaltung';
import PublicFormKatzenverwaltung from '@/pages/public/PublicForm_Katzenverwaltung';
import PublicFormZimmerverwaltung from '@/pages/public/PublicForm_Zimmerverwaltung';
import PublicFormLeistungsverwaltung from '@/pages/public/PublicForm_Leistungsverwaltung';
import PublicFormBuchungsverwaltung from '@/pages/public/PublicForm_Buchungsverwaltung';
import PublicFormGesundheitsprotokoll from '@/pages/public/PublicForm_Gesundheitsprotokoll';
// <public:imports>
// </public:imports>
// <custom:imports>
// </custom:imports>

export default function App() {
  return (
    <ErrorBoundary>
      <ErrorBusProvider>
        <HashRouter>
          <ActionsProvider>
            <Routes>
              <Route path="public/69fc3a6bc81a2ab1ef2c08f9" element={<PublicFormKundenverwaltung />} />
              <Route path="public/69fc3a757c67e99597072cbc" element={<PublicFormKatzenverwaltung />} />
              <Route path="public/69fc3a76a7c5acf5e5c9e86e" element={<PublicFormZimmerverwaltung />} />
              <Route path="public/69fc3a7710f4bd409d73e421" element={<PublicFormLeistungsverwaltung />} />
              <Route path="public/69fc3a7752bee1ca7e1bd833" element={<PublicFormBuchungsverwaltung />} />
              <Route path="public/69fc3a78c4fa4f3030d5c2e1" element={<PublicFormGesundheitsprotokoll />} />
              {/* <public:routes> */}
              {/* </public:routes> */}
              <Route element={<Layout />}>
                <Route index element={<><div className="mb-8"><WorkflowPlaceholders /></div><DashboardOverview /></>} />
                <Route path="kundenverwaltung" element={<KundenverwaltungPage />} />
                <Route path="katzenverwaltung" element={<KatzenverwaltungPage />} />
                <Route path="zimmerverwaltung" element={<ZimmerverwaltungPage />} />
                <Route path="leistungsverwaltung" element={<LeistungsverwaltungPage />} />
                <Route path="buchungsverwaltung" element={<BuchungsverwaltungPage />} />
                <Route path="gesundheitsprotokoll" element={<GesundheitsprotokollPage />} />
                <Route path="admin" element={<AdminPage />} />
                {/* <custom:routes> */}
                {/* </custom:routes> */}
              </Route>
            </Routes>
          </ActionsProvider>
        </HashRouter>
      </ErrorBusProvider>
    </ErrorBoundary>
  );
}
