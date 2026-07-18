import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from 'firebase/auth';
import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import {
  firebaseAuth,
  firestore,
  isFirebaseConfigured,
  prepareFirebaseAuth,
} from '../firebase';
import { queuePlannerUpsert, queueRecipeUpsert } from '../services/localSyncQueue';
import { Recipe, WeeklyPlan } from '../types';
import { useMockHouseholdSync } from './useMockHouseholdSync';

type SyncPhase = 'loading' | 'unconfigured' | 'signed-out' | 'account-ready' | 'needs-merge' | 'connected';
type SyncActivity = 'idle' | 'syncing' | 'offline' | 'error';

type RemoteRecipe = Omit<Recipe, 'imageUri' | 'syncedImagePath'> & {
  imageUri?: string;
  imagePath?: string;
  imageContentType?: string;
  deleted?: boolean;
  updatedBy: string;
};

const readyKey = (uid: string, householdId: string) => `piplate-sync-ready:${uid}:${householdId}`;

const makeHouseholdCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
};

const normalizeCode = (value: string) => value.trim().toUpperCase().replace(/[^A-Z2-9]/g, '');

const recipeComparable = (recipe: Recipe) => JSON.stringify({
  title: recipe.title,
  ingredients: recipe.ingredients,
  instructions: recipe.instructions,
  portions: recipe.portions,
  nutrition: recipe.nutrition,
  imageUri: recipe.imageUri.startsWith('data:') ? 'local-image' : recipe.imageUri,
});

const mergePlans = (remote: WeeklyPlan, local: WeeklyPlan, remappedIds: Map<string, string> = new Map()) => {
  const result: WeeklyPlan = {};
  const days = new Set([...Object.keys(remote), ...Object.keys(local)]);
  days.forEach(day => {
    const localIds = (local[day] || []).map(id => remappedIds.get(id) || id);
    result[day] = [...new Set([...(remote[day] || []), ...localIds])];
  });
  return result;
};

const cleanRemoteRecipe = (data: RemoteRecipe): Recipe => ({
  id: data.id,
  title: data.title,
  ingredients: data.ingredients,
  instructions: data.instructions,
  portions: data.portions,
  nutrition: data.nutrition,
  imageUri: data.imageUri || '',
  createdAt: data.createdAt,
  updatedAt: data.updatedAt,
});

export type HouseholdSyncController = {
  phase: SyncPhase;
  activity: SyncActivity;
  configured: boolean;
  email: string;
  householdId: string;
  pendingChanges: number;
  error: string;
  createAccount: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: () => Promise<void>;
  joinHousehold: (code: string) => Promise<void>;
  connectExistingHousehold: () => Promise<void>;
  retry: () => Promise<void>;
};

const useFirebaseHouseholdSync = (): HouseholdSyncController => {
  const [phase, setPhase] = useState<SyncPhase>(isFirebaseConfigured ? 'loading' : 'unconfigured');
  const [activity, setActivity] = useState<SyncActivity>(navigator.onLine ? 'idle' : 'offline');
  const [user, setUser] = useState<User | null>(null);
  const [householdId, setHouseholdId] = useState('');
  const [pendingChanges, setPendingChanges] = useState(0);
  const [error, setError] = useState('');
  const flushInProgress = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    const operations = await db.syncQueue.toArray();
    setPendingChanges(operations.filter(item => !householdId || !item.householdId || item.householdId === householdId).length);
  }, [householdId]);

  const setConnected = useCallback((uid: string, nextHouseholdId: string) => {
    localStorage.setItem(readyKey(uid, nextHouseholdId), 'true');
    setHouseholdId(nextHouseholdId);
    setPhase('connected');
  }, []);

  const remoteRecipeToLocal = useCallback(async (data: RemoteRecipe) => cleanRemoteRecipe(data), []);

  const uploadRecipe = useCallback(async (nextHouseholdId: string, recipe: Recipe, uid: string) => {
    if (!firestore) throw new Error('sync/not-configured');
    let imageUri = recipe.imageUri;
    // Firestore documents are limited to 1 MiB. Newly uploaded pictures are
    // compressed below this threshold in DishModal; skip legacy oversized data
    // URIs so they never block the rest of a household sync.
    if (imageUri.startsWith('data:') && imageUri.length > 650_000) imageUri = '';

    const remote: RemoteRecipe = {
      id: recipe.id,
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      portions: recipe.portions,
      nutrition: recipe.nutrition,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt || recipe.createdAt,
      updatedBy: uid,
      ...(imageUri ? { imageUri } : {}),
    };
    await setDoc(doc(firestore, 'households', nextHouseholdId, 'recipes', recipe.id), {
      ...remote,
      deleted: false,
      serverUpdatedAt: serverTimestamp(),
    });
  }, []);

  const flushQueue = useCallback(async () => {
    if (!user || !householdId || phase !== 'connected' || !firestore || flushInProgress.current) return;
    if (!navigator.onLine) {
      setActivity('offline');
      return;
    }

    flushInProgress.current = true;
    setActivity('syncing');
    setError('');
    try {
      const operations = (await db.syncQueue.orderBy('createdAt').toArray())
        .filter(operation => !operation.householdId || operation.householdId === householdId);
      for (const operation of operations) {
        if (operation.type === 'recipe-upsert' && operation.payload) {
          await uploadRecipe(householdId, operation.payload as Recipe, user.uid);
        } else if (operation.type === 'recipe-delete') {
          await setDoc(doc(firestore, 'households', householdId, 'recipes', operation.entityId), {
            id: operation.entityId,
            deleted: true,
            updatedAt: operation.createdAt,
            updatedBy: user.uid,
            serverUpdatedAt: serverTimestamp(),
          }, { merge: true });
        } else if (operation.type === 'planner-upsert' && operation.payload) {
          await setDoc(doc(firestore, 'households', householdId, 'planner', 'current'), {
            days: operation.payload,
            updatedAt: operation.createdAt,
            updatedBy: user.uid,
            serverUpdatedAt: serverTimestamp(),
          });
        }
        if (operation.id !== undefined) await db.syncQueue.delete(operation.id);
      }
      setActivity('idle');
      await refreshPendingCount();
    } catch (caught) {
      console.error('PiPlate sync retry is pending:', caught);
      setError(caught instanceof Error ? caught.message : 'sync/failed');
      setActivity(navigator.onLine ? 'error' : 'offline');
    } finally {
      flushInProgress.current = false;
    }
  }, [householdId, phase, refreshPendingCount, uploadRecipe, user]);

  const mergeHousehold = useCallback(async (nextHouseholdId: string, includeStarterRecipes: boolean) => {
    if (!user || !firestore) throw new Error('sync/not-signed-in');
    setActivity('syncing');
    await db.settings.put({ key: 'activeSyncHouseholdId', value: nextHouseholdId });
    const [localRecipes, localPlanRecord, remoteRecipeSnapshot, remotePlanSnapshot] = await Promise.all([
      db.recipes.toArray(),
      db.settings.get('weeklyPlan'),
      getDocs(collection(firestore, 'households', nextHouseholdId, 'recipes')),
      getDoc(doc(firestore, 'households', nextHouseholdId, 'planner', 'current')),
    ]);

    const remappedIds = new Map<string, string>();
    const localById = new Map(localRecipes.map(recipe => [recipe.id, recipe]));
    const remoteIds = new Set<string>();

    for (const snapshot of remoteRecipeSnapshot.docs) {
      const remote = snapshot.data() as RemoteRecipe;
      remoteIds.add(snapshot.id);
      const local = localById.get(snapshot.id);
      if (remote.deleted) {
        if (local?.updatedAt) {
          const copy = { ...local, id: uuidv4(), title: `${local.title} (local copy)`, updatedAt: Date.now() };
          remappedIds.set(local.id, copy.id);
          await db.recipes.put(copy);
          await queueRecipeUpsert(copy);
        }
        await db.recipes.delete(snapshot.id);
        continue;
      }

      const incoming = await remoteRecipeToLocal(remote);
      if (local && local.updatedAt && recipeComparable(local) !== recipeComparable(incoming)) {
        const copy = { ...local, id: uuidv4(), title: `${local.title} (local copy)`, updatedAt: Date.now() };
        remappedIds.set(local.id, copy.id);
        await db.recipes.put(copy);
        await queueRecipeUpsert(copy);
      }
      await db.recipes.put(incoming);
    }

    const remotePlan = remotePlanSnapshot.exists()
      ? (remotePlanSnapshot.data().days as WeeklyPlan || {})
      : {};
    const localPlan = (localPlanRecord?.value || {}) as WeeklyPlan;
    const mergedPlan = mergePlans(remotePlan, localPlan, remappedIds);
    const mergeTime = Date.now();
    await db.settings.put({ key: 'weeklyPlan', value: mergedPlan });
    await db.settings.put({ key: 'weeklyPlanUpdatedAt', value: mergeTime });

    const locallyPlannedIds = new Set(Object.values(localPlan).flat());
    const finalRecipes = await db.recipes.toArray();
    for (const recipe of finalRecipes) {
      const isUntouchedStarter = !recipe.updatedAt
        && !includeStarterRecipes
        && !remoteIds.has(recipe.id)
        && !locallyPlannedIds.has(recipe.id);
      if (!isUntouchedStarter && !remoteIds.has(recipe.id)) {
        const prepared = { ...recipe, updatedAt: recipe.updatedAt || mergeTime };
        await db.recipes.put(prepared);
        await queueRecipeUpsert(prepared);
      }
    }
    await queuePlannerUpsert(mergedPlan, mergeTime);
    setConnected(user.uid, nextHouseholdId);
    setActivity('idle');
  }, [remoteRecipeToLocal, setConnected, user]);

  useEffect(() => {
    if (!isFirebaseConfigured || !firebaseAuth || !firestore) return undefined;
    const activeFirestore = firestore;
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async nextUser => {
      if (!active) return;
      setUser(nextUser);
      setError('');
      if (!nextUser) {
        setHouseholdId('');
        setPhase('signed-out');
        return;
      }
      try {
        const profile = await getDoc(doc(activeFirestore, 'users', nextUser.uid));
        const nextHouseholdId = profile.exists() ? String(profile.data().householdId || '') : '';
        setHouseholdId(nextHouseholdId);
        if (!nextHouseholdId) setPhase('account-ready');
        else if (localStorage.getItem(readyKey(nextUser.uid, nextHouseholdId)) === 'true') {
          await db.settings.put({ key: 'activeSyncHouseholdId', value: nextHouseholdId });
          setPhase('connected');
        }
        else setPhase('needs-merge');
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'sync/profile-failed');
        setPhase('account-ready');
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setActivity('idle');
      void flushQueue();
    };
    const handleOffline = () => setActivity('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    void refreshPendingCount();
    if (phase !== 'connected') return undefined;
    void flushQueue();
    const interval = window.setInterval(() => {
      void refreshPendingCount();
      void flushQueue();
    }, 4000);
    return () => window.clearInterval(interval);
  }, [flushQueue, phase, refreshPendingCount]);

  useEffect(() => {
    if (phase !== 'connected' || !householdId || !firestore) return undefined;
    const recipeUnsubscribe = onSnapshot(
      collection(firestore, 'households', householdId, 'recipes'),
      snapshot => {
        void (async () => {
          for (const change of snapshot.docChanges()) {
            const remote = change.doc.data() as RemoteRecipe;
            const local = await db.recipes.get(change.doc.id);
            const pending = await db.syncQueue.where('entityId').equals(change.doc.id).first();
            const remoteUpdatedAt = Number(remote.updatedAt || 0);
            const localUpdatedAt = Number(local?.updatedAt || local?.createdAt || 0);

            if (remote.deleted) {
              if (!local || (!pending && remoteUpdatedAt >= localUpdatedAt)) {
                await db.recipes.delete(change.doc.id);
                const planRecord = await db.settings.get('weeklyPlan');
                const plan = (planRecord?.value || {}) as WeeklyPlan;
                const cleaned = Object.fromEntries(Object.entries(plan).map(([day, ids]) => [day, ids.filter(id => id !== change.doc.id)]));
                await db.settings.put({ key: 'weeklyPlan', value: cleaned });
              }
              continue;
            }

            if (!local || remoteUpdatedAt > localUpdatedAt) {
              if (local && pending && recipeComparable(local) !== recipeComparable(cleanRemoteRecipe(remote))) {
                const copy = { ...local, id: uuidv4(), title: `${local.title} (conflict copy)`, updatedAt: Date.now() };
                await db.recipes.put(copy);
                await queueRecipeUpsert(copy);
                if (pending.type === 'recipe-upsert' && pending.id !== undefined) await db.syncQueue.delete(pending.id);
              }
              await db.recipes.put(await remoteRecipeToLocal(remote));
            }
          }
        })().catch(caught => console.error('Failed to apply shared recipes:', caught));
      },
      caught => {
        setError(caught.message);
        setActivity('error');
      },
    );

    const plannerUnsubscribe = onSnapshot(
      doc(firestore, 'households', householdId, 'planner', 'current'),
      snapshot => {
        if (!snapshot.exists()) return;
        void (async () => {
          const remotePlan = (snapshot.data().days || {}) as WeeklyPlan;
          const remoteUpdatedAt = Number(snapshot.data().updatedAt || 0);
          const localUpdatedAt = Number((await db.settings.get('weeklyPlanUpdatedAt'))?.value || 0);
          if (remoteUpdatedAt <= localUpdatedAt) return;
          const pending = await db.syncQueue.where('entityId').equals('current').first();
          const localPlan = ((await db.settings.get('weeklyPlan'))?.value || {}) as WeeklyPlan;
          if (pending) {
            const merged = mergePlans(remotePlan, localPlan);
            const updatedAt = Date.now();
            await db.settings.put({ key: 'weeklyPlan', value: merged });
            await db.settings.put({ key: 'weeklyPlanUpdatedAt', value: updatedAt });
            await queuePlannerUpsert(merged, updatedAt);
          } else {
            await db.settings.put({ key: 'weeklyPlan', value: remotePlan });
            await db.settings.put({ key: 'weeklyPlanUpdatedAt', value: remoteUpdatedAt });
          }
        })().catch(caught => console.error('Failed to apply the shared planner:', caught));
      },
      caught => {
        setError(caught.message);
        setActivity('error');
      },
    );
    return () => {
      recipeUnsubscribe();
      plannerUnsubscribe();
    };
  }, [householdId, phase, remoteRecipeToLocal]);

  const run = async (action: () => Promise<void>) => {
    setActivity('syncing');
    setError('');
    try {
      await action();
      if (navigator.onLine) setActivity('idle');
    } catch (caught) {
      console.error('PiPlate account action failed:', caught);
      setError(caught instanceof Error ? caught.message : 'sync/failed');
      setActivity(navigator.onLine ? 'error' : 'offline');
      throw caught;
    }
  };

  return {
    phase,
    activity,
    configured: isFirebaseConfigured,
    email: user?.email || '',
    householdId,
    pendingChanges,
    error,
    createAccount: (email, password) => run(async () => {
      const auth = await prepareFirebaseAuth();
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    }),
    signIn: (email, password) => run(async () => {
      const auth = await prepareFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim(), password);
    }),
    signOut: () => run(async () => {
      if (firebaseAuth) await signOut(firebaseAuth);
    }),
    createHousehold: () => run(async () => {
      if (!user || !firestore) throw new Error('sync/not-signed-in');
      const code = makeHouseholdCode();
      await setDoc(doc(firestore, 'households', code), {
        ownerId: user.uid,
        memberIds: [user.uid],
        joinEnabled: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(firestore, 'users', user.uid), { householdId: code, updatedAt: serverTimestamp() });
      await mergeHousehold(code, true);
    }),
    joinHousehold: code => run(async () => {
      if (!user || !firestore) throw new Error('sync/not-signed-in');
      const normalized = normalizeCode(code);
      if (normalized.length !== 14) throw new Error('sync/invalid-code');
      const householdRef = doc(firestore, 'households', normalized);
      const household = await getDoc(householdRef);
      if (!household.exists() || !household.data().joinEnabled) throw new Error('sync/household-not-found');
      await updateDoc(householdRef, { memberIds: arrayUnion(user.uid), updatedAt: serverTimestamp() });
      await setDoc(doc(firestore, 'users', user.uid), { householdId: normalized, updatedAt: serverTimestamp() });
      await mergeHousehold(normalized, false);
    }),
    connectExistingHousehold: () => run(async () => {
      if (!householdId) throw new Error('sync/household-not-found');
      await mergeHousehold(householdId, false);
    }),
    retry: () => flushQueue(),
  };
};

export const useHouseholdSync = (): HouseholdSyncController => {
  const firebaseController = useFirebaseHouseholdSync();
  const mockController = useMockHouseholdSync();
  const useTestController = import.meta.env.DEV
    && typeof window !== 'undefined'
    && Boolean((window as Window & { __PIPLATE_SYNC_TEST__?: boolean }).__PIPLATE_SYNC_TEST__);
  return useTestController ? mockController : firebaseController;
};
