import { z } from 'zod';

/** The five things the player (human or Jev) can do on any given tick. */
export const actionSchema = z.enum(['left', 'right', 'jump', 'roll', 'none']);

export type Action = z.infer<typeof actionSchema>;

export const ACTIONS: readonly Action[] = actionSchema.options;
