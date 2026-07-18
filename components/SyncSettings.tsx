import React, { FormEvent, useState } from 'react';
import { Check, Cloud, CloudOff, Copy, LoaderCircle, Users } from 'lucide-react';
import { HouseholdSyncController } from '../hooks/useHouseholdSync';
import { useLanguage } from '../i18n';

type PendingAction = 'none' | 'create' | 'join' | 'connect';

const SyncSettings: React.FC<{ sync: HouseholdSyncController }> = ({ sync }) => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdCode, setHouseholdCode] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [pendingAction, setPendingAction] = useState<PendingAction>('none');
  const [copied, setCopied] = useState(false);
  const busy = sync.activity === 'syncing';

  const submitAccount = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (authMode === 'signup') await sync.createAccount(email, password);
      else await sync.signIn(email, password);
      setPassword('');
    } catch {
      // The hook exposes a localized-safe error state below.
    }
  };

  const confirmMerge = async () => {
    try {
      if (pendingAction === 'create') await sync.createHousehold();
      if (pendingAction === 'join') await sync.joinHousehold(householdCode);
      if (pendingAction === 'connect') await sync.connectExistingHousehold();
      setPendingAction('none');
    } catch {
      // Keep the confirmation open so the user can retry.
    }
  };

  const friendlyError = () => {
    if (!sync.error) return '';
    if (sync.error.includes('invalid-credential')) return t('syncInvalidLogin');
    if (sync.error.includes('email-already-in-use')) return t('syncEmailInUse');
    if (sync.error.includes('weak-password')) return t('syncWeakPassword');
    if (sync.error.includes('invalid-code') || sync.error.includes('household-not-found')) return t('syncInvalidCode');
    if (sync.error.includes('permission-denied')) return t('syncPermissionDenied');
    return t('syncGenericError');
  };

  const activityLabel = sync.activity === 'syncing'
    ? t('syncing')
    : sync.activity === 'offline'
      ? t('syncOffline')
      : sync.activity === 'error'
        ? t('syncProblem')
        : t('syncCurrent');

  return (
    <section className="mt-4 rounded-[2rem] border border-[#DED8CD] bg-white/80 p-5 sm:p-6 shadow-[0_18px_60px_rgba(47,43,37,0.06)]" data-testid="sync-settings">
      <div className="flex items-start gap-4">
        <span className="h-12 w-12 shrink-0 rounded-2xl bg-[#E8F1E8] text-[#4E6B4E] grid place-items-center">
          <Users size={23} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl">{t('syncTitle')}</h2>
          <p className="mt-1 text-sm text-[#756E64] max-w-lg">{t('syncDescription')}</p>
        </div>
      </div>

      {!sync.configured && (
        <div className="mt-5 rounded-2xl bg-[#F5F0E7] p-4 text-sm text-[#756E64]" role="status">
          {t('syncUnavailable')}
        </div>
      )}

      {sync.configured && sync.phase === 'loading' && (
        <div className="mt-5 flex items-center gap-2 text-sm text-[#756E64]" role="status">
          <LoaderCircle className="animate-spin" size={18} /> {t('syncing')}
        </div>
      )}

      {sync.configured && sync.phase === 'signed-out' && (
        <form className="mt-5 space-y-3" onSubmit={submitAccount}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold text-[#4F4941]">
              {t('email')}
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="mt-1.5 h-12 w-full rounded-2xl border border-[#D8D0C4] bg-[#FFFDF8] px-4 font-normal outline-none focus:border-[#D95D39] focus:ring-4 focus:ring-[#D95D39]/10"
              />
            </label>
            <label className="text-sm font-semibold text-[#4F4941]">
              {t('password')}
              <input
                type="password"
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                minLength={6}
                required
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-1.5 h-12 w-full rounded-2xl border border-[#D8D0C4] bg-[#FFFDF8] px-4 font-normal outline-none focus:border-[#D95D39] focus:ring-4 focus:ring-[#D95D39]/10"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={busy} type="submit" className="min-h-11 rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white disabled:opacity-60">
              {authMode === 'signup' ? t('createAccount') : t('signIn')}
            </button>
            <button
              type="button"
              onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}
              className="min-h-11 rounded-full bg-[#EEE8DD] px-5 text-sm font-semibold text-[#4F4941]"
            >
              {authMode === 'signin' ? t('needAccount') : t('haveAccount')}
            </button>
          </div>
        </form>
      )}

      {sync.configured && sync.phase === 'account-ready' && pendingAction === 'none' && (
        <div className="mt-5">
          <p className="text-sm text-[#756E64]">{t('signedInAs', { email: sync.email })}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <button onClick={() => setPendingAction('create')} className="min-h-12 rounded-2xl bg-[#2D2A26] px-4 text-sm font-semibold text-white">
              {t('createHousehold')}
            </button>
            <button onClick={() => setPendingAction('join')} className="min-h-12 rounded-2xl bg-[#EEE8DD] px-4 text-sm font-semibold text-[#4F4941]">
              {t('joinHousehold')}
            </button>
          </div>
          <button onClick={() => void sync.signOut()} className="mt-3 min-h-11 text-sm font-semibold text-[#756E64]">{t('signOut')}</button>
        </div>
      )}

      {sync.configured && sync.phase === 'needs-merge' && pendingAction === 'none' && (
        <div className="mt-5 rounded-2xl bg-[#F5F0E7] p-4">
          <p className="font-semibold">{t('connectThisDevice')}</p>
          <p className="mt-1 text-sm text-[#756E64]">{t('connectThisDeviceDescription')}</p>
          <button onClick={() => setPendingAction('connect')} className="mt-4 min-h-11 rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white">
            {t('continue')}
          </button>
        </div>
      )}

      {sync.configured && pendingAction !== 'none' && (
        <div className="mt-5 rounded-2xl border border-[#D9CDBD] bg-[#FFF9EF] p-4" role="group" aria-label={t('mergeConfirmation')}>
          <p className="font-semibold">{t('mergeConfirmation')}</p>
          <p className="mt-1 text-sm text-[#756E64]">
            {pendingAction === 'create' ? t('createMergeDescription') : t('joinMergeDescription')}
          </p>
          {pendingAction === 'join' && (
            <label className="mt-4 block text-sm font-semibold text-[#4F4941]">
              {t('householdCode')}
              <input
                value={householdCode}
                onChange={event => setHouseholdCode(event.target.value.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={14}
                placeholder="XXXXXXXXXXXXXX"
                className="mt-1.5 h-12 w-full rounded-2xl border border-[#D8D0C4] bg-white px-4 font-mono tracking-[0.16em] uppercase outline-none focus:border-[#D95D39] focus:ring-4 focus:ring-[#D95D39]/10"
              />
            </label>
          )}
          <p className="mt-3 flex items-start gap-2 text-xs text-[#756E64]"><Check size={16} className="mt-0.5 shrink-0 text-[#4E6B4E]" /> {t('localDataSafe')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busy || (pendingAction === 'join' && householdCode.trim().length < 14)} onClick={() => void confirmMerge()} className="min-h-11 rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? t('syncing') : t('confirmAndConnect')}
            </button>
            <button disabled={busy} onClick={() => setPendingAction('none')} className="min-h-11 rounded-full bg-[#EEE8DD] px-5 text-sm font-semibold text-[#4F4941]">
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {sync.configured && sync.phase === 'connected' && (
        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#F5F0E7] p-4">
            <div className="flex min-w-0 items-center gap-3">
              {sync.activity === 'offline' ? <CloudOff size={21} className="shrink-0 text-[#9E4938]" /> : <Cloud size={21} className="shrink-0 text-[#4E6B4E]" />}
              <div className="min-w-0">
                <p className="font-semibold">{activityLabel}</p>
                <p className="truncate text-xs text-[#756E64]">{sync.email}</p>
              </div>
            </div>
            {sync.pendingChanges > 0 && <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#756E64]">{t('pendingChanges', { count: sync.pendingChanges })}</span>}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8E887E]">{t('householdCode')}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-2xl bg-[#2D2A26] px-4 py-3 font-mono text-sm tracking-[0.12em] text-white">{sync.householdId}</code>
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(sync.householdId);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
                className="touch-button shrink-0 bg-[#EEE8DD] text-[#4F4941]"
                aria-label={t('copyHouseholdCode')}
              >
                {copied ? <Check size={19} /> : <Copy size={19} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-[#756E64]">{t('shareHouseholdCode')}</p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {sync.activity === 'error' && <button onClick={() => void sync.retry()} className="min-h-11 rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white">{t('retrySync')}</button>}
            <button onClick={() => void sync.signOut()} className="min-h-11 rounded-full bg-[#EEE8DD] px-5 text-sm font-semibold text-[#4F4941]">{t('signOut')}</button>
          </div>
        </div>
      )}

      {friendlyError() && <p className="mt-4 rounded-2xl bg-[#F8E9E4] p-3 text-sm text-[#9E4938]" role="alert">{friendlyError()}</p>}
    </section>
  );
};

export default SyncSettings;
