'use client';

/** Lớp gọi API thiên hà — cái nền mà các world nằm lên trên. */

import { request } from './browser-api';

import type { components } from './api-types';

export type Galaxy = components['schemas']['GalaxyOut'];
export type GalaxyUpdatePayload = components['schemas']['GalaxyUpdate'];

export const listGalaxies = () => request<Galaxy[]>('/galaxies');

export const updateGalaxy = (id: string, payload: GalaxyUpdatePayload) =>
  request<Galaxy>(`/galaxies/${id}`, { method: 'PATCH', body: payload });
