import type { Platform } from '../utils/platform.js';
import {
  installWindowsService, startWindowsService,
  stopWindowsService, uninstallWindowsService, windowsServiceExists,
} from './windows-service.js';
import {
  installLinuxService, startLinuxService,
  stopLinuxService, uninstallLinuxService, linuxServiceExists,
} from './linux-service.js';

export interface ServiceOptions {
  runtimeRoot: string;
  autoStart:   boolean;
  user?:       string;
}

export class ServiceManager {
  constructor(private readonly _platform: Platform) {}

  install(opts: ServiceOptions): void {
    switch (this._platform) {
      case 'windows': return installWindowsService(opts);
      case 'linux':   return installLinuxService(opts);
      default:
        throw new Error(`Service installation is not supported on ${this._platform}. Install the runtime binary manually.`);
    }
  }

  start(): void {
    switch (this._platform) {
      case 'windows': return startWindowsService();
      case 'linux':   return startLinuxService();
      default:        throw new Error(`Cannot start service on ${this._platform}`);
    }
  }

  stop(): void {
    switch (this._platform) {
      case 'windows': return stopWindowsService();
      case 'linux':   return stopLinuxService();
      default:        throw new Error(`Cannot stop service on ${this._platform}`);
    }
  }

  uninstall(): void {
    switch (this._platform) {
      case 'windows': return uninstallWindowsService();
      case 'linux':   return uninstallLinuxService();
      default:        throw new Error(`Cannot uninstall service on ${this._platform}`);
    }
  }

  exists(): boolean {
    switch (this._platform) {
      case 'windows': return windowsServiceExists();
      case 'linux':   return linuxServiceExists();
      default:        return false;
    }
  }
}
