import { configRepository } from '../repositories/ConfigRepository.js';
import { encryptionService } from './EncryptionService.js';
import { healthCheckerRegistry } from '../health/index.js';
import type { ConfigItem, HealthCheckResult, HealthCheckConfig, CheckerType, Project } from '../../shared/types.js';

interface CachedResult {
  result: HealthCheckResult;
  projectId: string;
  envName: string;
  key: string;
}

class HealthCheckService {
  private cache: Map<string, CachedResult> = new Map();
  private scheduledTask: NodeJS.Timeout | null = null;
  private isRunning = false;
  private readonly DEFAULT_INTERVAL = 5 * 60 * 1000;
  private readonly DEFAULT_CHECK_INTERVAL = 30 * 60 * 1000;

  private getCacheKey(projectId: string, envName: string, key: string): string {
    return `${projectId}:${envName}:${key}`;
  }

  async autoDetectConfig(key: string, value: string): Promise<HealthCheckConfig | null> {
    const checkerType = healthCheckerRegistry.detectCheckerType(key, value);
    if (!checkerType) return null;
    
    return {
      enabled: true,
      checkerType,
      checkInterval: this.DEFAULT_CHECK_INTERVAL,
      timeout: 5000,
    };
  }

  async checkConfigItem(
    projectId: string,
    envName: string,
    key: string,
    force: boolean = false
  ): Promise<HealthCheckResult | null> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return null;

    const item = configs.find(c => c.key === key);
    if (!item) return null;

    if (!item.healthCheck) {
      const detectedConfig = await this.autoDetectConfig(item.key, item.value);
      if (!detectedConfig) {
        return null;
      }
      item.healthCheck = detectedConfig;
    }

    if (!item.healthCheck.enabled) {
      return null;
    }

    const cacheKey = this.getCacheKey(projectId, envName, key);
    const cached = this.cache.get(cacheKey);
    
    if (!force && cached) {
      const checkInterval = item.healthCheck.checkInterval || this.DEFAULT_CHECK_INTERVAL;
      const lastCheckTime = new Date(cached.result.checkedAt).getTime();
      if (Date.now() - lastCheckTime < checkInterval) {
        return cached.result;
      }
    }

    const pendingResult: HealthCheckResult = {
      status: 'checking',
      checkedAt: new Date().toISOString(),
      checkerType: item.healthCheck.checkerType,
    };
    this.cache.set(cacheKey, {
      result: pendingResult,
      projectId,
      envName,
      key,
    });

    const decryptFn = async (value: string, iv: string, tag: string) => {
      return encryptionService.decrypt(value, iv, tag);
    };

    const result = await healthCheckerRegistry.check(item.healthCheck.checkerType, {
      value: item.value,
      config: item.healthCheck,
      decrypt: decryptFn,
      encrypted: item.encrypted,
      iv: item.iv,
      tag: item.tag,
    });

    this.cache.set(cacheKey, {
      result,
      projectId,
      envName,
      key,
    });

    return result;
  }

  async checkAllConfigs(force: boolean = false): Promise<number> {
    if (this.isRunning) return 0;
    
    this.isRunning = true;
    let checkedCount = 0;

    try {
      const projects = await configRepository.getAllProjects();
      
      for (const project of projects) {
        for (const env of project.environments) {
          for (const config of env.configs) {
            if (config.key === '_init') continue;
            
            const result = await this.checkConfigItem(project.id, env.name, config.key, force);
            if (result) {
              checkedCount++;
            }
          }
        }
      }
    } finally {
      this.isRunning = false;
    }

    return checkedCount;
  }

  async checkEnvironmentConfigs(
    projectId: string,
    envName: string,
    force: boolean = false
  ): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    
    if (!configs) return results;

    for (const config of configs) {
      if (config.key === '_init') continue;
      
      const result = await this.checkConfigItem(projectId, envName, config.key, force);
      if (result) {
        results.set(config.key, result);
      }
    }

    return results;
  }

  getCachedResult(projectId: string, envName: string, key: string): HealthCheckResult | null {
    const cacheKey = this.getCacheKey(projectId, envName, key);
    const cached = this.cache.get(cacheKey);
    return cached ? cached.result : null;
  }

  getEnvironmentCachedResults(projectId: string, envName: string): Map<string, HealthCheckResult> {
    const results = new Map<string, HealthCheckResult>();
    
    for (const [cacheKey, cached] of this.cache) {
      const [pid, env, key] = cacheKey.split(':');
      if (pid === projectId && env === envName) {
        results.set(key, cached.result);
      }
    }
    
    return results;
  }

  async getConfigWithHealthStatus(
    projectId: string,
    envName: string
  ): Promise<Array<ConfigItem & { healthStatus?: HealthCheckResult }>> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return [];

    const cachedResults = this.getEnvironmentCachedResults(projectId, envName);
    
    return configs.map(config => {
      const healthStatus = cachedResults.get(config.key);
      return {
        ...config,
        healthStatus,
      };
    });
  }

  async enableHealthCheck(
    projectId: string,
    envName: string,
    key: string,
    checkerType?: CheckerType
  ): Promise<ConfigItem | null> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return null;

    const item = configs.find(c => c.key === key);
    if (!item) return null;

    let type = checkerType;
    if (!type) {
      const detected = healthCheckerRegistry.detectCheckerType(item.key, item.value);
      if (!detected) return null;
      type = detected;
    }

    const healthCheck: HealthCheckConfig = {
      enabled: true,
      checkerType: type,
      checkInterval: this.DEFAULT_CHECK_INTERVAL,
      timeout: 5000,
    };

    const updated = await configRepository.updateConfigItem(projectId, envName, key, {
      healthCheck,
    });

    if (updated) {
      setImmediate(() => {
        this.checkConfigItem(projectId, envName, key, true);
      });
    }

    return updated;
  }

  async disableHealthCheck(
    projectId: string,
    envName: string,
    key: string
  ): Promise<ConfigItem | null> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return null;

    const item = configs.find(c => c.key === key);
    if (!item) return null;

    const updated = await configRepository.updateConfigItem(projectId, envName, key, {
      healthCheck: item.healthCheck ? { ...item.healthCheck, enabled: false } : undefined,
    });

    const cacheKey = this.getCacheKey(projectId, envName, key);
    this.cache.delete(cacheKey);

    return updated;
  }

  async updateHealthCheckConfig(
    projectId: string,
    envName: string,
    key: string,
    config: Partial<HealthCheckConfig>
  ): Promise<ConfigItem | null> {
    const configs = await configRepository.getEnvironmentConfigs(projectId, envName);
    if (!configs) return null;

    const item = configs.find(c => c.key === key);
    if (!item) return null;

    const existingConfig = item.healthCheck || {
      enabled: true,
      checkerType: config.checkerType || 'custom',
    };

    const updated = await configRepository.updateConfigItem(projectId, envName, key, {
      healthCheck: { ...existingConfig, ...config },
    });

    return updated;
  }

  startScheduledCheck(interval: number = this.DEFAULT_INTERVAL): void {
    if (this.scheduledTask) {
      clearInterval(this.scheduledTask);
    }

    setImmediate(() => {
      this.checkAllConfigs(true).catch(err => {
        console.error('Initial health check failed:', err);
      });
    });

    this.scheduledTask = setInterval(() => {
      this.checkAllConfigs(false).catch(err => {
        console.error('Scheduled health check failed:', err);
      });
    }, interval);

    console.log(`Health check scheduled task started, interval: ${interval / 1000}s`);
  }

  stopScheduledCheck(): void {
    if (this.scheduledTask) {
      clearInterval(this.scheduledTask);
      this.scheduledTask = null;
      console.log('Health check scheduled task stopped');
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; isRunning: boolean } {
    return {
      size: this.cache.size,
      isRunning: this.isRunning,
    };
  }

  async getAllProjectsWithHealth(): Promise<Array<Project & { environments: Array<{ name: string; healthy: number; unhealthy: number; total: number }> }>> {
    const projects = await configRepository.getAllProjects();
    
    return projects.map(project => ({
      ...project,
      environments: project.environments.map(env => {
        let healthy = 0;
        let unhealthy = 0;
        let total = 0;

        for (const config of env.configs) {
          if (config.key === '_init') continue;
          if (!config.healthCheck?.enabled) continue;

          total++;
          const cacheKey = this.getCacheKey(project.id, env.name, config.key);
          const cached = this.cache.get(cacheKey);
          
          if (cached?.result.status === 'healthy') {
            healthy++;
          } else if (cached?.result.status === 'unhealthy') {
            unhealthy++;
          }
        }

        return {
          name: env.name,
          healthy,
          unhealthy,
          total,
        };
      }),
    }));
  }
}

export const healthCheckService = new HealthCheckService();
