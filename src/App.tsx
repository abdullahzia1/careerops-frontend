import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { EvaluatePage } from "./pages/EvaluatePage";
import { FollowupsPage } from "./pages/FollowupsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { JobsPage } from "./pages/JobsPage";
import { PatternsPage } from "./pages/PatternsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ScanPage } from "./pages/ScanPage";
import { SystemPage } from "./pages/SystemPage";
import { TrackerPage } from "./pages/TrackerPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="evaluate" element={<EvaluatePage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="jobs/:id" element={<JobDetailPage />} />
          <Route path="scan" element={<ScanPage />} />
          <Route path="patterns" element={<PatternsPage />} />
          <Route path="tracker" element={<TrackerPage />} />
          <Route path="followups" element={<FollowupsPage />} />
          <Route path="system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
