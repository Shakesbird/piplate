import { useState } from 'react';
import type { HouseholdSyncController } from './useHouseholdSync';

// UI-only adapter used by the mandatory mobile browser suite. It is compiled
// out of production behavior because the wrapper only selects it in Vite dev.
export const useMockHouseholdSync = (): HouseholdSyncController => {
  const [phase, setPhase] = useState<HouseholdSyncController['phase']>('signed-out');
  const [email, setEmail] = useState('');
  const [householdId, setHouseholdId] = useState('');

  const createSession = async (nextEmail: string) => {
    setEmail(nextEmail);
    setPhase('account-ready');
  };

  return {
    phase,
    activity: 'idle',
    configured: true,
    email,
    householdId,
    pendingChanges: 0,
    error: '',
    createAccount: (nextEmail: string) => createSession(nextEmail),
    signIn: (nextEmail: string) => createSession(nextEmail),
    signOut: async () => {
      setEmail('');
      setHouseholdId('');
      setPhase('signed-out');
    },
    createHousehold: async () => {
      setHouseholdId('TESTHOUSEHOLD2');
      setPhase('connected');
    },
    joinHousehold: async (code: string) => {
      setHouseholdId(code);
      setPhase('connected');
    },
    connectExistingHousehold: async () => setPhase('connected'),
    retry: async () => undefined,
  };
};
