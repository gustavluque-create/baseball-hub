import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook to manage realistic simulated data loading transitions
 * Allows views to showcase LoadingSkeletons with smooth latency
 */
export function useSimulatedLoad(defaultDelayMs: number = 750) {
  const [loading, setLoading] = useState<boolean>(true);
  const timeoutRef = useRef<number | null>(null);

  const startLoading = useCallback(
    (action?: () => Promise<any> | void, delayMs: number = defaultDelayMs) => {
      setLoading(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      const run = async () => {
        try {
          if (action) {
            await action();
          }
        } finally {
          timeoutRef.current = window.setTimeout(() => {
            setLoading(false);
          }, delayMs);
        }
      };

      run();
    },
    [defaultDelayMs]
  );

  const triggerSimulate = useCallback(
    (delayMs: number = 1200) => {
      setLoading(true);
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setLoading(false);
      }, delayMs);
    },
    []
  );

  const finishLoading = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    loading,
    setLoading,
    startLoading,
    triggerSimulate,
    finishLoading,
  };
}
