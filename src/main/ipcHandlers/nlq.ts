import type { IpcMain } from 'electron';

import { NlqIpcChannel, type NlqQuerySpec } from '../../shared/nlq/constants';
import { queryNlq } from '../nlq/engine';
import { getNlqModelState, publishNlqDraft, saveNlqDraft } from '../nlq/modelStore';
import { validateNlqPhysicalSchema } from '../nlq/modelValidation';
import { inspectNlqSchema, sqlServerStatus, validateNlqRelationKeys } from '../nlq/sqlServerRunner';

export function registerNlqIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(NlqIpcChannel.Status, () => sqlServerStatus());
  ipcMain.handle(NlqIpcChannel.Schema, () => inspectNlqSchema());
  ipcMain.handle(NlqIpcChannel.Model, () => getNlqModelState());
  ipcMain.handle(NlqIpcChannel.SaveDraft, (_event, input: unknown) => saveNlqDraft(input));
  ipcMain.handle(NlqIpcChannel.Preview, (_event, spec: NlqQuerySpec) =>
    queryNlq(spec, undefined, getNlqModelState().draft));
  ipcMain.handle(NlqIpcChannel.Publish, async () => {
    const { draft } = getNlqModelState();
    validateNlqPhysicalSchema(draft, await inspectNlqSchema());
    await validateNlqRelationKeys(draft);
    return publishNlqDraft();
  });
}
