import { ipcMain } from 'electron';
import type { WorkersService } from '@flowtrace/api';

const CHANNELS = [
  'workers:getAll',
  'workers:getById',
  'workers:getHealth',
  'workers:getStats',
  'workers:spawn',
  'get-workers',
  'get-worker-stats',
];

export function registerWorkersIpcHandlers(s: WorkersService): void {
  ipcMain.handle('workers:getAll', () => s.getWorkers());
  ipcMain.handle('workers:getById', (_, a: { workerId: string }) =>
    s.getWorkerById(a.workerId)
  );
  ipcMain.handle('workers:getHealth', (_, a: { workerId: string }) =>
    s.getWorkerHealth(a.workerId)
  );
  ipcMain.handle('workers:getStats', () => s.getWorkerStats());
  // Note: Workers are auto-spawned on app start via WorkerPoolPort.initialize()
  // Manual spawn is not supported in current architecture
  ipcMain.handle('workers:spawn', () => ({
    success: false,
    message:
      'Manual worker spawn not supported. Workers are auto-managed on app start.',
    workerId: null,
  }));
  ipcMain.handle('get-workers', () => s.getWorkers());
  ipcMain.handle('get-worker-stats', () => s.getWorkerStats());
}

export function unregisterWorkersIpcHandlers(): void {
  CHANNELS.forEach((c) => ipcMain.removeHandler(c));
}
