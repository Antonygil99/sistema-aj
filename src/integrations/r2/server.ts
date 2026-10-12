import 'server-only';
import { createR2, r2Status } from './client';
export function storageStatus() { return r2Status(process.env); }
export function getR2() { return createR2(process.env); }
