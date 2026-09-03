import { useSyncExternalStore } from 'react';
import { demoStore, type DemoState } from '@/services/platform/demoStore';

/**
 * Assina o estado do modo demo. Usa useSyncExternalStore para manter as telas
 * (area do cliente, fila de compra, admin) em sincronia quando algo muda em
 * outra aba ou em outro componente.
 */
export function useDemoState(): DemoState {
  return useSyncExternalStore(
    (listener) => demoStore.subscribe(listener),
    () => demoStore.getState(),
    () => demoStore.getState(),
  );
}
