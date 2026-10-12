import 'server-only';
import { createR2, r2Configuration } from './client';
export function r2Ready() { try { r2Configuration(process.env); return true; } catch { return false; } }
export function getR2() { return createR2(process.env); }
