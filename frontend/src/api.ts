export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export const ARCHS = ['small', 'medium', 'tanh', 'deep'] as const
export type Arch = typeof ARCHS[number]

export const LAYERS = ['fc1', 'fc2'] as const
export type Layer = typeof LAYERS[number]
