import { useCallback, useMemo, useReducer } from 'react';

export type SurfacePoolKind = 'chat' | 'menu' | 'overlay';

export type SurfaceLifecycleState = 'active' | 'warm-hidden' | 'cold-evicted';

export type SurfaceRecord = {
  id: string;
  pool: SurfacePoolKind;
  key: string;
  visible: boolean;
  mounted: boolean;
  busy: boolean;
  hasPendingBilling: boolean;
  hasUnsavedDraft: boolean;
  lastActiveAt: number;
  mountedAt: number;
  lifecycleState: SurfaceLifecycleState;
  snapshotVersion: number;
};

export type SurfacePoolLimits = Record<SurfacePoolKind, number>;

export type SurfaceCacheState = {
  records: Record<string, SurfaceRecord>;
  activeKeys: Record<SurfacePoolKind, string | null>;
  limits: SurfacePoolLimits;
};

type EnsureVisibleAction = {
  type: 'ensure-visible';
  pool: SurfacePoolKind;
  key: string;
};

type HidePoolAction = {
  type: 'hide-pool';
  pool: SurfacePoolKind;
};

type UpdateFlagsAction = {
  type: 'update-flags';
  pool: SurfacePoolKind;
  key: string;
  patch: Partial<Pick<SurfaceRecord, 'busy' | 'hasPendingBilling' | 'hasUnsavedDraft' | 'snapshotVersion'>>;
};

type ResetPoolAction = {
  type: 'reset-pool';
  pool: SurfacePoolKind;
};

type SurfaceCacheAction = EnsureVisibleAction | HidePoolAction | UpdateFlagsAction | ResetPoolAction;

export const DEFAULT_SURFACE_POOL_LIMITS: SurfacePoolLimits = {
  chat: 50,
  menu: 8,
  overlay: 5,
};

function createRecord(pool: SurfacePoolKind, key: string, now: number): SurfaceRecord {
  return {
    id: `${pool}:${key}`,
    pool,
    key,
    visible: true,
    mounted: true,
    busy: false,
    hasPendingBilling: false,
    hasUnsavedDraft: false,
    lastActiveAt: now,
    mountedAt: now,
    lifecycleState: 'active',
    snapshotVersion: 0,
  };
}

function finalizePool(state: SurfaceCacheState, pool: SurfacePoolKind): SurfaceCacheState {
  const limit = state.limits[pool];
  const poolRecords = Object.values(state.records).filter((record) => record.pool === pool && record.mounted);
  if (poolRecords.length <= limit) {
    return state;
  }

  const activeKey = state.activeKeys[pool];
  const candidates = poolRecords
    .filter((record) => record.key !== activeKey && !record.busy && !record.hasPendingBilling)
    .sort((left, right) => {
      if (left.lastActiveAt !== right.lastActiveAt) {
        return left.lastActiveAt - right.lastActiveAt;
      }
      return left.mountedAt - right.mountedAt;
    });

  if (candidates.length === 0) {
    return state;
  }

  const nextRecords = {...state.records};
  let mountedCount = poolRecords.length;
  for (const candidate of candidates) {
    if (mountedCount <= limit) {
      break;
    }
    const current = nextRecords[candidate.id];
    if (!current || !current.mounted) {
      continue;
    }
    nextRecords[candidate.id] = {
      ...current,
      visible: false,
      mounted: false,
      lifecycleState: 'cold-evicted',
      snapshotVersion: current.snapshotVersion + 1,
    };
    mountedCount -= 1;
  }

  return {
    ...state,
    records: nextRecords,
  };
}

function surfaceCacheReducer(state: SurfaceCacheState, action: SurfaceCacheAction): SurfaceCacheState {
  switch (action.type) {
    case 'ensure-visible': {
      const now = Date.now();
      const nextRecords: Record<string, SurfaceRecord> = {};
      for (const [id, record] of Object.entries(state.records)) {
        if (record.pool !== action.pool) {
          nextRecords[id] = record;
          continue;
        }
        if (!record.mounted) {
          nextRecords[id] = record;
          continue;
        }
        nextRecords[id] =
          record.key === action.key
            ? {
                ...record,
                visible: true,
                mounted: true,
                lastActiveAt: now,
                lifecycleState: 'active',
              }
            : {
                ...record,
                visible: false,
                lifecycleState: 'warm-hidden',
              };
      }

      const recordId = `${action.pool}:${action.key}`;
      const existing = nextRecords[recordId];
      nextRecords[recordId] = existing
        ? {
            ...existing,
            visible: true,
            mounted: true,
            lastActiveAt: now,
            lifecycleState: 'active',
          }
        : createRecord(action.pool, action.key, now);

      return finalizePool(
        {
          ...state,
          records: nextRecords,
          activeKeys: {
            ...state.activeKeys,
            [action.pool]: action.key,
          },
        },
        action.pool,
      );
    }
    case 'hide-pool': {
      const nextRecords: Record<string, SurfaceRecord> = {};
      for (const [id, record] of Object.entries(state.records)) {
        if (record.pool !== action.pool || !record.mounted) {
          nextRecords[id] = record;
          continue;
        }
        nextRecords[id] = {
          ...record,
          visible: false,
          lifecycleState: 'warm-hidden',
        };
      }
      return finalizePool(
        {
          ...state,
          records: nextRecords,
          activeKeys: {
            ...state.activeKeys,
            [action.pool]: null,
          },
        },
        action.pool,
      );
    }
    case 'update-flags': {
      const recordId = `${action.pool}:${action.key}`;
      const current = state.records[recordId];
      if (!current) {
        return state;
      }
      const nextState = {
        ...state,
        records: {
          ...state.records,
          [recordId]: {
            ...current,
            ...action.patch,
          },
        },
      };
      return finalizePool(nextState, action.pool);
    }
    case 'reset-pool': {
      const nextRecords: Record<string, SurfaceRecord> = {};
      for (const [id, record] of Object.entries(state.records)) {
        if (record.pool !== action.pool) {
          nextRecords[id] = record;
        }
      }
      return {
        ...state,
        records: nextRecords,
        activeKeys: {
          ...state.activeKeys,
          [action.pool]: null,
        },
      };
    }
    default:
      return state;
  }
}

export function useSurfaceCacheManager(limits: Partial<SurfacePoolLimits> = {}) {
  const resolvedLimits = useMemo(
    () => ({
      ...DEFAULT_SURFACE_POOL_LIMITS,
      ...limits,
    }),
    [limits],
  );
  const [state, dispatch] = useReducer(surfaceCacheReducer, {
    records: {},
    activeKeys: {
      chat: null,
      menu: null,
      overlay: null,
    },
    limits: resolvedLimits,
  });

  const ensureVisible = useCallback((pool: SurfacePoolKind, key: string) => {
    dispatch({
      type: 'ensure-visible',
      pool,
      key,
    });
  }, []);

  const hidePool = useCallback((pool: SurfacePoolKind) => {
    dispatch({
      type: 'hide-pool',
      pool,
    });
  }, []);

  const updateFlags = useCallback(
    (
      pool: SurfacePoolKind,
      key: string,
      patch: Partial<Pick<SurfaceRecord, 'busy' | 'hasPendingBilling' | 'hasUnsavedDraft' | 'snapshotVersion'>>,
    ) => {
      dispatch({
        type: 'update-flags',
        pool,
        key,
        patch,
      });
    },
    [],
  );

  const resetPool = useCallback((pool: SurfacePoolKind) => {
    dispatch({
      type: 'reset-pool',
      pool,
    });
  }, []);

  const getMountedKeys = useCallback(
    (pool: SurfacePoolKind): string[] =>
      Object.values(state.records)
        .filter((record) => record.pool === pool && record.mounted)
        .sort((left, right) => {
          if (left.lastActiveAt !== right.lastActiveAt) {
            return left.lastActiveAt - right.lastActiveAt;
          }
          return left.mountedAt - right.mountedAt;
        })
        .map((record) => record.key),
    [state.records],
  );

  const getRecord = useCallback(
    (pool: SurfacePoolKind, key: string): SurfaceRecord | null => state.records[`${pool}:${key}`] ?? null,
    [state.records],
  );

  const isVisible = useCallback(
    (pool: SurfacePoolKind, key: string): boolean => Boolean(getRecord(pool, key)?.visible),
    [getRecord],
  );

  return useMemo(
    () => ({
      state,
      ensureVisible,
      hidePool,
      updateFlags,
      resetPool,
      getMountedKeys,
      getRecord,
      isVisible,
    }),
    [ensureVisible, getMountedKeys, getRecord, hidePool, isVisible, resetPool, state, updateFlags],
  );
}
