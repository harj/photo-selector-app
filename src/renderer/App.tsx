import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useIpc, IPC_CHANNELS } from './hooks/useIpc';

// Pages
import Setup from './pages/Setup';
import ProjectList from './pages/ProjectList';
import ProjectView from './pages/ProjectView';
import PhotoDetail from './pages/PhotoDetail';
import SimilarGroup from './pages/SimilarGroup';
import Settings from './pages/Settings';

// Components
import Layout from './components/Layout';

function AppRoutes() {
  const { invoke } = useIpc();

  // Check if app is configured
  const { data: isConfigured, isLoading } = useQuery({
    queryKey: ['isConfigured'],
    queryFn: () => invoke<boolean>(IPC_CHANNELS.SETTINGS_IS_CONFIGURED),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Redirect to setup if not configured
  if (!isConfigured) {
    return (
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Setup wizard - accessible even when configured */}
      <Route path="/setup" element={<Setup />} />

      {/* Main app routes */}
      <Route path="/" element={<Layout />}>
        <Route index element={<ProjectList />} />
        <Route path="projects/:id" element={<ProjectView />} />
        <Route path="projects/:projectId/photos/:photoId" element={<PhotoDetail />} />
        <Route path="projects/:projectId/photos/:photoId/group" element={<SimilarGroup />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
