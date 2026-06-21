import { useState, useCallback, useRef, useEffect } from 'react';
import { api } from '@/utils/api';
import { useSSE } from './useSSE';
import { useDocumentVisibility } from './useDocumentVisibility';
import type { ConfigItem, HealthCheckResult, CheckerType } from '../../shared/types';

interface UseConfigsOptions {
  projectId: string | null;
  envName: string | null;
  autoRefresh?: boolean;
  refreshOnVisible?: boolean;
  withHealth?: boolean;
}

export function useConfigs(options: UseConfigsOptions) {
  const { projectId, envName, autoRefresh = true, refreshOnVisible = true, withHealth = true } = options;
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingKeys, setCheckingKeys] = useState<Set<string>>(new Set());
  const { isVisible } = useDocumentVisibility();
  const lastFetchRef = useRef<number>(0);
  const MIN_REFRESH_INTERVAL = 2000;

  const fetchConfigs = useCallback(async () => {
    if (!projectId || !envName) {
      setConfigs([]);
      return;
    }

    const now = Date.now();
    if (now - lastFetchRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }
    lastFetchRef.current = now;

    setLoading(true);
    setError(null);
    try {
      const url = withHealth
        ? `/projects/${projectId}/envs/${envName}?withHealth=true`
        : `/projects/${projectId}/envs/${envName}`;
      const res = await api.get<ConfigItem[]>(url);
      if (res.success && res.data) {
        setConfigs(res.data);
      } else {
        setConfigs([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch configs');
      setConfigs([]);
    } finally {
      setLoading(false);
    }
  }, [projectId, envName, withHealth]);

  const runHealthCheck = useCallback(async (key: string, force: boolean = true): Promise<HealthCheckResult | null> => {
    if (!projectId || !envName) return null;

    setCheckingKeys(prev => new Set(prev).add(key));

    try {
      const url = `/health-check/projects/${projectId}/envs/${envName}/configs/${key}/check${force ? '?force=true' : ''}`;
      const res = await api.post<HealthCheckResult>(url);
      if (res.success && res.data) {
        setConfigs(prev => prev.map(c =>
          c.key === key ? { ...c, healthStatus: res.data! } : c
        ));
        return res.data;
      }
      return null;
    } catch (err) {
      console.error('Health check failed:', err);
      return null;
    } finally {
      setCheckingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }, [projectId, envName]);

  const runAllHealthChecks = useCallback(async (force: boolean = true) => {
    if (!projectId || !envName) return;

    const targetConfigs = configs.filter(c => c.key !== '_init');
    for (const config of targetConfigs) {
      if (config.healthCheck?.enabled) {
        await runHealthCheck(config.key, force);
      }
    }
  }, [projectId, envName, configs, runHealthCheck]);

  const enableHealthCheck = useCallback(async (key: string, checkerType?: CheckerType) => {
    if (!projectId || !envName) return null;

    try {
      const res = await api.post<ConfigItem>(
        `/health-check/projects/${projectId}/envs/${envName}/configs/${key}/enable`,
        { checkerType }
      );
      if (res.success && res.data) {
        setConfigs(prev => prev.map(c =>
          c.key === key ? res.data! : c
        ));
        setImmediate(() => runHealthCheck(key, true));
        return res.data;
      }
      return null;
    } catch (err) {
      console.error('Enable health check failed:', err);
      return null;
    }
  }, [projectId, envName, runHealthCheck]);

  const disableHealthCheck = useCallback(async (key: string) => {
    if (!projectId || !envName) return null;

    try {
      const res = await api.post<ConfigItem>(
        `/health-check/projects/${projectId}/envs/${envName}/configs/${key}/disable`
      );
      if (res.success && res.data) {
        setConfigs(prev => prev.map(c => {
          if (c.key === key) {
            const { healthStatus, ...rest } = res.data!;
            return rest;
          }
          return c;
        }));
        return res.data;
      }
      return null;
    } catch (err) {
      console.error('Disable health check failed:', err);
      return null;
    }
  }, [projectId, envName]);

  const addConfig = useCallback(async (key: string, value: string, description?: string, encrypted?: boolean) => {
    if (!projectId || !envName) return null;
    const res = await api.post<ConfigItem>(`/projects/${projectId}/envs/${envName}`, {
      key,
      value,
      description,
      encrypted,
    });
    if (res.success && res.data) {
      lastFetchRef.current = 0;
      await fetchConfigs();
      return res.data;
    }
    return null;
  }, [projectId, envName, fetchConfigs]);

  const updateConfig = useCallback(async (key: string, updates: Partial<ConfigItem>) => {
    if (!projectId || !envName) return null;
    const res = await api.put<ConfigItem>(`/projects/${projectId}/envs/${envName}/${key}`, updates);
    if (res.success && res.data) {
      lastFetchRef.current = 0;
      await fetchConfigs();
      return res.data;
    }
    return null;
  }, [projectId, envName, fetchConfigs]);

  const deleteConfig = useCallback(async (key: string) => {
    if (!projectId || !envName) return false;
    const res = await api.delete(`/projects/${projectId}/envs/${envName}/${key}`);
    if (res.success) {
      lastFetchRef.current = 0;
      await fetchConfigs();
      return true;
    }
    return false;
  }, [projectId, envName, fetchConfigs]);

  const encryptConfig = useCallback(async (key: string) => {
    if (!projectId || !envName) return null;
    const res = await api.post<ConfigItem>(`/encryption/${projectId}/${envName}/${key}`);
    if (res.success && res.data) {
      lastFetchRef.current = 0;
      await fetchConfigs();
      return res.data;
    }
    return null;
  }, [projectId, envName, fetchConfigs]);

  const decryptConfig = useCallback(async (key: string) => {
    if (!projectId || !envName) return null;
    const res = await api.post<ConfigItem>(`/encryption/${projectId}/${envName}/${key}/decrypt`);
    if (res.success && res.data) {
      lastFetchRef.current = 0;
      await fetchConfigs();
      return res.data;
    }
    return null;
  }, [projectId, envName, fetchConfigs]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  useEffect(() => {
    if (!refreshOnVisible || !isVisible) return;

    const timer = setTimeout(() => {
      fetchConfigs();
    }, 100);

    return () => clearTimeout(timer);
  }, [isVisible, refreshOnVisible, fetchConfigs]);

  useSSE({
    enabled: autoRefresh,
    filter: { project: projectId, environment: envName, eventTypes: ['config_changed', 'connected'] },
    onConfigChanged: () => {
      lastFetchRef.current = 0;
      fetchConfigs();
    },
    onRefresh: () => {
      lastFetchRef.current = 0;
      fetchConfigs();
    },
  });

  return {
    configs,
    loading,
    error,
    checkingKeys,
    fetchConfigs,
    addConfig,
    updateConfig,
    deleteConfig,
    encryptConfig,
    decryptConfig,
    runHealthCheck,
    runAllHealthChecks,
    enableHealthCheck,
    disableHealthCheck,
  };
}
