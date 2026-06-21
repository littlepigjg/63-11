import { IHealthChecker, CheckContext } from '../HealthChecker.js';
import type { CheckerType, HealthCheckResult } from '../../../shared/types.js';
import http from 'http';
import https from 'https';
import { URL } from 'url';

export class HttpChecker implements IHealthChecker {
  readonly type: CheckerType = 'http';

  canHandle(key: string, value: string): boolean {
    const httpKeywords = ['API', 'URL', 'ENDPOINT', 'SERVICE', 'HOST'];
    const keyUpper = key.toUpperCase();
    
    if (httpKeywords.some(kw => keyUpper.includes(kw))) {
      return this.isHttpUrl(value);
    }
    
    if (this.isHttpUrl(value)) {
      return true;
    }
    
    return false;
  }

  private isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async check(context: CheckContext): Promise<HealthCheckResult> {
    const timeout = context.config.timeout || 5000;
    const expectedStatus = context.config.customParams?.expectedStatus 
      ? parseInt(context.config.customParams.expectedStatus) 
      : undefined;
    
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

    try {
      const url = new URL(actualValue);
      const startTime = Date.now();

      return new Promise((resolve) => {
        const client = url.protocol === 'https:' ? https : http;
        
        const req = client.get({
          hostname: url.hostname,
          port: url.port,
          path: url.pathname + url.search,
          protocol: url.protocol,
          timeout,
          method: context.config.customParams?.method || 'HEAD',
        }, (res) => {
          res.resume();
          const responseTime = Date.now() - startTime;
          
          const statusCode = res.statusCode || 0;
          const isSuccess = expectedStatus 
            ? statusCode === expectedStatus
            : statusCode >= 200 && statusCode < 500;

          if (isSuccess) {
            resolve({
              status: 'healthy',
              checkedAt: new Date().toISOString(),
              checkerType: this.type,
              responseTime,
            });
          } else {
            resolve({
              status: 'unhealthy',
              error: `HTTP 状态码: ${statusCode}`,
              checkedAt: new Date().toISOString(),
              checkerType: this.type,
              responseTime,
            });
          }
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            status: 'unhealthy',
            error: `请求超时 (${timeout}ms)`,
            checkedAt: new Date().toISOString(),
            checkerType: this.type,
            responseTime: Date.now() - startTime,
          });
        });

        req.on('error', (err) => {
          resolve({
            status: 'unhealthy',
            error: `请求失败: ${err.message}`,
            checkedAt: new Date().toISOString(),
            checkerType: this.type,
            responseTime: Date.now() - startTime,
          });
        });
      });
    } catch (error) {
      return {
        status: 'unhealthy',
        error: `URL 解析失败: ${error instanceof Error ? error.message : String(error)}`,
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
      };
    }
  }
}

export const httpChecker = new HttpChecker();
