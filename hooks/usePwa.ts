import { useCallback, useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type IosNavigator = Navigator & { standalone?: boolean };

const isStandaloneDisplay = () => (
  window.matchMedia('(display-mode: standalone)').matches
  || (navigator as IosNavigator).standalone === true
);

const getIosBrowser = () => {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/i.test(userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = isIos
    && /Safari/i.test(userAgent)
    && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  return { isIos, isIosSafari: isSafari };
};

const getFreshAppUrl = (reason: 'repaired' | 'updated') => {
  const appUrl = new URL(import.meta.env.BASE_URL, window.location.href);
  appUrl.searchParams.set(reason, String(Date.now()));
  return appUrl.toString();
};

const reloadWithoutStuckAppCache = async (registration: ServiceWorkerRegistration) => {
  try {
    const cleanup = async () => {
      await registration.unregister();
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames
          .filter(cacheName => cacheName.startsWith('piplate-'))
          .map(cacheName => caches.delete(cacheName)));
      }
    };
    await Promise.race([
      cleanup(),
      new Promise<void>(resolve => window.setTimeout(resolve, 4_000)),
    ]);
  } catch (error) {
    console.error('PiPlate could not clear the stuck update cache:', error);
  } finally {
    window.location.replace(getFreshAppUrl('repaired'));
  }
};

const waitForWaitingWorker = async (registration: ServiceWorkerRegistration) => {
  if (registration.waiting) return registration.waiting;

  try {
    await registration.update();
  } catch (error) {
    console.error('PiPlate could not recheck the pending patch:', error);
  }
  if (registration.waiting) return registration.waiting;

  const installingWorker = registration.installing;
  if (!installingWorker) return null;
  if (installingWorker.state === 'installed') return registration.waiting ?? installingWorker;

  return new Promise<ServiceWorker | null>(resolve => {
    const timeout = window.setTimeout(() => resolve(null), 12_000);
    installingWorker.addEventListener('statechange', () => {
      if (installingWorker.state === 'installed') {
        window.clearTimeout(timeout);
        resolve(registration.waiting ?? installingWorker);
      } else if (installingWorker.state === 'redundant') {
        window.clearTimeout(timeout);
        resolve(null);
      }
    });
  });
};

export const usePwa = () => {
  const { isIos, isIosSafari } = getIosBrowser();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneDisplay);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const reloadForNewWorker = useRef(false);
  const fallbackReloadTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || window.location.protocol === 'file:' || !('serviceWorker' in navigator)) return;

    let disposed = false;
    let updateTimer: number | undefined;

    const watchWorker = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateAvailable(true);
        }
      });
    };

    const handleControllerChange = () => {
      if (!reloadForNewWorker.current) return;
      reloadForNewWorker.current = false;
      if (fallbackReloadTimer.current !== undefined) {
        window.clearTimeout(fallbackReloadTimer.current);
        fallbackReloadTimer.current = undefined;
      }
      window.location.replace(getFreshAppUrl('updated'));
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then(nextRegistration => {
      if (disposed) return;
      setRegistration(nextRegistration);
      if (nextRegistration.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true);
      }
      watchWorker(nextRegistration.installing);
      nextRegistration.addEventListener('updatefound', () => watchWorker(nextRegistration.installing));
      void nextRegistration.update();
      updateTimer = window.setInterval(() => void nextRegistration.update(), 15 * 60 * 1000);
    }).catch(error => {
      console.error('PiPlate update service could not start:', error);
    });

    return () => {
      disposed = true;
      if (updateTimer !== undefined) window.clearInterval(updateTimer);
      if (fallbackReloadTimer.current !== undefined) window.clearTimeout(fallbackReloadTimer.current);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installPrompt) return false;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstallPrompt(null);
    return choice.outcome === 'accepted';
  }, [installPrompt]);

  const applyUpdate = useCallback(async () => {
    setIsUpdating(true);
    reloadForNewWorker.current = true;

    const activeRegistration = registration
      ?? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);

    if (!activeRegistration) {
      reloadForNewWorker.current = false;
      setUpdateAvailable(false);
      setIsUpdating(false);
      return;
    }

    const waitingWorker = await waitForWaitingWorker(activeRegistration);
    if (!waitingWorker) {
      reloadForNewWorker.current = false;
      await reloadWithoutStuckAppCache(activeRegistration);
      return;
    }

    const reloadWhenActivated = () => {
      if (waitingWorker.state !== 'activated' || !reloadForNewWorker.current) return;
      reloadForNewWorker.current = false;
      if (fallbackReloadTimer.current !== undefined) window.clearTimeout(fallbackReloadTimer.current);
      window.location.replace(getFreshAppUrl('updated'));
    };

    waitingWorker.addEventListener('statechange', reloadWhenActivated);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    fallbackReloadTimer.current = window.setTimeout(() => {
      if (!reloadForNewWorker.current) return;
      reloadForNewWorker.current = false;
      void reloadWithoutStuckAppCache(activeRegistration);
    }, 15_000);
  }, [registration]);

  return {
    applyUpdate,
    canInstall: Boolean(installPrompt),
    install,
    isInstalled,
    isIos,
    isIosSafari,
    isUpdating,
    updateAvailable,
  };
};
