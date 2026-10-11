import { useState, useEffect, useCallback, useRef } from "react";
import { useBackend } from "./useBackend";

interface UseBackendPackOptions {
  enabled?: boolean;
  errorMessage?: string;
}

export function useBackendPack<T>(
  method: string,
  args: Record<string, any> = {},
  options: UseBackendPackOptions = {}
) {
  const { call } = useBackend();
  const callRef = useRef(call);
  callRef.current = call;

  const argsRef = useRef(args);
  argsRef.current = args;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { enabled = true, errorMessage } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const result = await callRef.current<T>(method, argsRef.current);
      setData(result);
      setError(null);
    } catch (err) {
      setError(errorMessage || "Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [method, enabled, errorMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
