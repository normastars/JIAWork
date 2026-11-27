import type { IpcMain } from 'electron';

import { NlqIpcChannel } from '../../shared/nlq/constants';
import { getNlqModelState } from '../nlq/modelStore';
import { getNlqAdminUrl, refreshPublishedNlqModel } from '../nlq/remoteModel';
import { inspectNlqSchema, sqlServerStatus } from '../nlq/sqlServerRunner';

export function registerNlqIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(NlqIpcChannel.Status, () => sqlServerStatus());
  ipcMain.handle(NlqIpcChannel.Schema, () => inspectNlqSchema());
  ipcMain.handle(NlqIpcChannel.Model, async () => {
    let syncError: string | undefined;
    try { await refreshPublishedNlqModel(); }
    catch (error) { syncError = error instanceof Error ? error.message : '读取管理平台数据模型失败'; }
    return { ...getNlqModelState(), adminUrl: getNlqAdminUrl(), syncError };
  });
}
