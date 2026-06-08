import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/constants';
import { SearchQuery, IndexStatus, FileInfo, Category, Rule } from '../shared/types';

const api = {
  // Invoke (renderer -> main -> response)
  search: (query: SearchQuery) => ipcRenderer.invoke(IPC.SEARCH_QUERY, query),
  listFiles: (params: { categoryId?: number | null; page?: number; pageSize?: number }) =>
    ipcRenderer.invoke(IPC.FILES_LIST, params),
  listCategories: () => ipcRenderer.invoke(IPC.CATEGORIES_LIST) as Promise<Category[]>,
  saveRules: (categoryId: number, rules: Omit<Rule, 'id' | 'categoryId'>[]) =>
    ipcRenderer.invoke(IPC.RULES_SAVE, { categoryId, rules }),
  startWatch: (directories: string[]) => ipcRenderer.invoke(IPC.WATCH_START, { directories }),
  retryFile: (fileId: number) => ipcRenderer.invoke(IPC.FILE_RETRY, { fileId }),

  // Listen (main -> renderer push)
  onStatusUpdate: (callback: (status: IndexStatus) => void) => {
    const handler = (_event: any, status: IndexStatus) => callback(status);
    ipcRenderer.on(IPC.STATUS_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC.STATUS_UPDATE, handler); };
  },
  onFileIndexed: (callback: (file: FileInfo) => void) => {
    const handler = (_event: any, file: FileInfo) => callback(file);
    ipcRenderer.on(IPC.FILE_INDEXED, handler);
    return () => { ipcRenderer.removeListener(IPC.FILE_INDEXED, handler); };
  },
};

contextBridge.exposeInMainWorld('docHub', api);

export type DocHubApi = typeof api;
