import { DocHubApi } from '../../main/preload';

declare global {
  interface Window {
    docHub: DocHubApi;
  }
}

export {};
