/**
 * Workers Page - Worker Management UI
 *
 * Displays worker list with DataTable, detail view, and spawn form dialog.
 * Supports real-time updates via WebSocket and auto-refresh.
 *
 * Requirements: 6.1 to 8.4
 */

'use client';

import { useState, useCallback } from 'react';
import {
  WorkerList,
  WorkerDetail,
  SpawnWorkerForm,
  useWorkerWebSocket,
} from '../../features/workerManagement';
import { Button } from '../../components/ui/button';

export default function WorkersPage() {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);

  // WebSocket for real-time updates
  const { connectionState } = useWorkerWebSocket({
    enabled: true,
    onStateChanged: (workerId, state) => {
      console.log(`Worker ${workerId} state changed to ${state}`);
    },
  });

  const handleSelectWorker = useCallback((workerId: string) => {
    setSelectedWorkerId(workerId);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedWorkerId(null);
  }, []);

  const handleSpawnSuccess = useCallback((workerId: string) => {
    setShowSpawnDialog(false);
    setSelectedWorkerId(workerId);
  }, []);

  const handleShowSpawnDialog = useCallback(() => {
    setShowSpawnDialog(true);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workers</h1>
          <p className="text-muted-foreground mt-1">
            Manage worker processes and monitor health metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-green-500'
                  : connectionState === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-gray-400'
              }`}
            />
            <span className="text-muted-foreground capitalize">
              {connectionState}
            </span>
          </div>
          {/* Add Worker Button - Requirements 8.1 */}
          <Button onClick={handleShowSpawnDialog}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Worker
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Worker List - Requirements 6.1, 6.2, 6.3, 6.4 */}
        <div>
          <WorkerList
            onSelectWorker={handleSelectWorker}
            autoRefreshInterval={5000}
          />
        </div>

        {/* Worker Detail Panel - Requirements 7.1 to 7.6 */}
        <div>
          <WorkerDetail
            workerId={selectedWorkerId}
            onClose={handleCloseDetail}
            autoRefreshInterval={5000}
          />
        </div>
      </div>

      {/* Spawn Worker Dialog - Requirements 8.1, 8.2 */}
      <SpawnWorkerForm
        open={showSpawnDialog}
        onOpenChange={setShowSpawnDialog}
        onSuccess={handleSpawnSuccess}
      />
    </div>
  );
}
