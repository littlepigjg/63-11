import { IHealthChecker, CheckContext } from '../HealthChecker.js';
import type { CheckerType, HealthCheckResult } from '../../../shared/types.js';
import { URL } from 'url';

export class UrlChecker implements IHealthChecker {
  readonly type: CheckerType = 'url';

  canHandle(key: string, value: string): boolean {
    const urlKeywords = ['URL', 'LINK', 'ADDRESS', 'BASEURL', 'BASE_URL'];
    const keyUpper = key.toUpperCase();
    
    if (urlKeywords.some(kw => keyUpper.includes(kw))) {
      return true;
    }
    
    if (this.isValidUrl(value)) {
      return true;
    }
    
    return false;
  }

  private isValidUrl(value: string): boolean {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  async check(context: CheckContext): Promise<HealthCheckResult> {
    const allowedProtocols = context.config.customParams?.allowedProtocols
      ? context.config.customParams.allowedProtocols.split(',')
      : ['http:', 'https:'];
    
    let actualValue = context.value;
    if (context.encrypted && context.decrypt && context.iv && context.tag) {
      try {
        actualValue = await context.decrypt(context.value, context.iv, context.tag);
      } catch {
        return {
          status: 'unhealthy',
          error: '无法解密配置值',
          checkedAt: new Date().toISOString(),
          checkerType: this.type,
        };
      }
    }

    const startTime = Date.now();

    try {
      const url = new URL(actualValue.trim());
      
      if (!allowedProtocols.includes(url.protocol)) {
        return {
          status: 'unhealthy',
          error: `不支持的协议: ${url.protocol}，仅支持: ${allowedProtocols.join(', ')}`,
          checkedAt: new Date().toISOString(),
          checkerType: this.type,
          responseTime: Date.now() - startTime,
        };
      }

      if (!url.hostname) {
        return {
          status: 'unhealthy',
          error: 'URL 缺少主机名',
          checkedAt: new Date().toISOString(),
          checkerType: this.type,
          responseTime: Date.now() - startTime,
        };
      }

      return {
        status: 'healthy',
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
        responseTime: Date.now() - startTime,
      };
    } catch {
      return {
        status: 'unhealthy',
        error: '无效的 URL 格式',
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
        responseTime: Date.now() - startTime,
      };
    }
  }
}

export const urlChecker = new UrlChecker();
