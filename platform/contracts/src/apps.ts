import { z } from 'zod';
import { LocalizedTextSchema } from './common.js';

export const AvailabilitySchema = z.enum(['available', 'under_development', 'disabled']);
export type Availability = z.infer<typeof AvailabilitySchema>;

export const NavItemSchema = z.strictObject({
  path: z.string(),
  label: LocalizedTextSchema,
  permission: z.string(),
});
export type NavItem = z.infer<typeof NavItemSchema>;

export const ApplicationDefinitionSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  displayName: LocalizedTextSchema,
  description: LocalizedTextSchema,
  icon: z.string(),
  route: z.string(),
  permission: z.string(),
  module: z.string(),
  availability: AvailabilitySchema,
  order: z.number().int(),
  navigation: z.array(NavItemSchema).optional(),
});
export type ApplicationDefinition = z.infer<typeof ApplicationDefinitionSchema>;

export const ApplicationsResponseSchema = z.strictObject({
  apps: z.array(ApplicationDefinitionSchema),
});
export type ApplicationsResponse = z.infer<typeof ApplicationsResponseSchema>;
