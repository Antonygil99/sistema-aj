import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
export const intakeCookie = 'aj_intake_access';
export const hashSecret = (value:string) => createHash('sha256').update(value).digest('hex');
export const randomSecret = () => randomBytes(32).toString('base64url');
export const makePin = () => String(randomInt(0,100000000)).padStart(8,'0');
export const hashPin = (pin:string,salt:string) => scryptSync(pin,salt,32).toString('hex');
export function checkPin(pin:string,salt:string,expected:string){const actual=hashPin(pin,salt);return actual.length===expected.length&&timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'));}
