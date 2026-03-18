import { useState, useCallback } from "react";

interface UseOptimisticUpdateOptions<TSnapshot, TVariables> {
  onMutate: (variables: TVariables) => TSnapshot;
  onSuccess?: (variables: TVariables) => void;
  onError: (snapshot: TSnapshot, variables: TVariables, error: Error) => void;
}

export function useOptimisticUpdate<TSnapshot, TVariables>(
  mutationFn: (variables: TVariables) => Promise<void>,
  options: UseOptimisticUpdateOptions<TSnapshot, TVariables>,
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (variables: TVariables) => {
      setIsLoading(true);
      setError(null);

      const snapshot = options.onMutate(variables);

      try {
        await mutationFn(variables);
        options.onSuccess?.(variables);
      } catch (e) {
        const normalizedError = e instanceof Error ? e : new Error("Unknown error");
        options.onError(snapshot, variables, normalizedError);
        setError(normalizedError);
      } finally {
        setIsLoading(false);
      }
    },
    [mutationFn, options],
  );

  return { mutate, isLoading, error };
}