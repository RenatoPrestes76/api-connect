import { registerHaClusterRoutes } from './cluster.js';
import { registerHaFailoverRoutes } from './failovers.js';
import { registerHaBackupRoutes } from './backups.js';
import { registerHaRecoveryRoutes } from './recovery.js';
import { registerHaElectionRoutes } from './election.js';
import { registerHaLoadBalancerRoutes } from './load-balancer.js';

export function registerHaRoutes(router: { get: Function; post: Function }): void {
  registerHaClusterRoutes(router);
  registerHaFailoverRoutes(router);
  registerHaBackupRoutes(router);
  registerHaRecoveryRoutes(router);
  registerHaElectionRoutes(router);
  registerHaLoadBalancerRoutes(router);
}
