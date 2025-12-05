import React, { useEffect } from 'react';
import { Titlebar } from './components/layout/Titlebar';
import { Sidebar } from './components/layout/Sidebar';
import { MainContent } from './components/layout/MainContent';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAppStore } from './stores/appStore';

export default function App() {
  const { initialize, selectedWorkspaceId } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-bg-primary">
        {/* Custom titlebar */}
        <Titlebar />

        {/* Main layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Workspaces */}
          <Sidebar />

          {/* Main content area */}
          <MainContent workspaceId={selectedWorkspaceId} />
        </div>
      </div>
    </ErrorBoundary>
  );
}
