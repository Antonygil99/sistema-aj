'use client';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from './modal';
export type ConfirmOptions = { title: string; message: string; confirmLabel: string; cancelLabel?: string; tone?: 'default' | 'danger' };
const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmContext);
// Promise-based confirmation: `if (await confirm({...})) { ... }`.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const confirm = useCallback((next: ConfirmOptions) => new Promise<boolean>(resolve => { resolver.current?.(false); resolver.current = resolve; setOptions(next); setOpen(true); }), []);
  const settle = (value: boolean) => { resolver.current?.(value); resolver.current = null; setOpen(false); };
  return <ConfirmContext.Provider value={confirm}>{children}
    <Modal open={open} onClose={() => settle(false)} title={options?.title ?? ''} size="sm" tone={options?.tone ?? 'default'}
      footer={<><button type="button" className="text-button" onClick={() => settle(false)}>{options?.cancelLabel ?? 'Cancelar'}</button><button type="button" className={options?.tone === 'danger' ? 'button button-danger' : 'button'} data-autofocus onClick={() => settle(true)}>{options?.confirmLabel}</button></>}>
      <p className="confirm-message">{options?.message}</p>
    </Modal>
  </ConfirmContext.Provider>;
}
