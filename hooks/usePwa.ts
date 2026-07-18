import { useCallback, useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const isStandaloneDisplay = () => window.matchMedia('(display-mode: standalone)').matches;

export const usePwa = () => {
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
      window.location.reload();
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

    if (!activeRegistration.waiting) {
      try {
        await activeRegistration.update();
      } catch (error) {
        console.error('PiPlate could not recheck the pending patch:', error);
      }
    }

    const waitingWorker = activeRegistration.waiting;
    if (!waitingWorker) {
      reloadForNewWorker.current = false;
      setUpdateAvailable(false);
      setIsUpdating(false);
      return;
    }

    const reloadWhenActivated = () => {
      if (waitingWorker.state !== 'activated' || !reloadForNewWorker.current) return;
      reloadForNewWorker.current = false;
      if (fallbackReloadTimer.current !== undefined) window.clearTimeout(fallbackReloadTimer.current);
      window.location.reload();
    };

    waitingWorker.addEventListener('statechange', reloadWhenActivated);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });

    fallbackReloadTimer.current = window.setTimeout(() => {
      if (reloadForNewWorker.current) window.location.reload();
    }, 5_000);
  }, [registration]);

  return {
    applyUpdate,
    canInstall: Boolean(installPrompt),
    install,
    isInstalled,
    isUpdating,
    updateAvailable,
  };
};
