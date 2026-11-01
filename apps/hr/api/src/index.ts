/**
 * Public entry point of the H-HR backend module. The composition root (platform/api) imports
 * `HrModule`; nothing outside H-HR imports its application or infrastructure layers.
 */
export { HrModule } from './hr.module.js';
export { HrActorScopeService } from './application/hr-actor-scope.service.js';
export type { HrActorIdentity } from './application/hr-actor-scope.service.js';
export { buildProfile, buildReferenceIndex, summaryOf } from './application/profile-mapper.js';
export type { ManagerLookup, ProfileContext } from './application/profile-mapper.js';
