import { useCallback, useState } from "react";

export type DungeonLoadingState = {
  list: boolean;
  session: boolean;
  sync: boolean;
  room: boolean;
  combat: boolean;
};

type LoadingKey = keyof DungeonLoadingState;

type UseDungeonLoadingResult = {
  loadingState: DungeonLoadingState;
  loading: boolean;
  withLoading: <T>(key: LoadingKey, task: () => Promise<T>) => Promise<T>;
};

export function useDungeonLoading(): UseDungeonLoadingResult {
  const [loadingState, setLoadingState] = useState<DungeonLoadingState>({
    list: false,
    session: false,
    sync: false,
    room: false,
    combat: false,
  });

  const withLoading = useCallback(
    async <T,>(key: LoadingKey, task: () => Promise<T>): Promise<T> => {
      setLoadingState((current) => ({ ...current, [key]: true }));
      try {
        return await task();
      } finally {
        setLoadingState((current) => ({ ...current, [key]: false }));
      }
    },
    []
  );

  const loading = Object.values(loadingState).some(Boolean);

  return {
    loadingState,
    loading,
    withLoading,
  };
}
