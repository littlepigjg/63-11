import { IHealthChecker, CheckContext } from '../HealthChecker.js';
import type { CheckerType, HealthCheckResult } from '../../../shared/types.js';
import fs from 'fs';
import path from 'path';

export class FileChecker implements IHealthChecker {
  readonly type: CheckerType = 'file';

  canHandle(key: string, value: string): boolean {
    const fileKeywords = ['PATH', 'FILE', 'DIR', 'DIRECTORY', 'LOG', 'UPLOAD'];
    const keyUpper = key.toUpperCase();
    
    if (fileKeywords.some(kw => keyUpper.includes(kw))) {
      return this.isFilePath(value);
    }
    
    if (this.isFilePath(value)) {
      return true;
    }
    
    return false;
  }

  private isFilePath(value: string): boolean {
    if (!value || value.length < 2) return false;
    
    if (value.startsWith('/') || value.startsWith('\\')) return true;
    if (/^[a-zA-Z]:[\\/]/.test(value)) return true;
    if (value.startsWith('./') || value.startsWith('../')) return true;
    if (value.includes('/') || value.includes('\\')) {
      const hasExt = /\.[a-zA-Z0-9]+$/.test(value);
      const lastPart = value.split(/[\\/]/).pop() || '';
      if (hasExt || (lastPart && !lastPart.includes('.') && value.length > 3)) {
        return true;
      }
    }
    
    return false;
  }

  async check(context: CheckContext): Promise<HealthCheckResult> {
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

    const checkType = context.config.customParams?.checkType || 'exists';
    const startTime = Date.now();

    try {
      const resolvedPath = path.resolve(actualValue);
      const stats = await fs.promises.stat(resolvedPath);
      
      let result: HealthCheckResult = {
        status: 'healthy',
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
        responseTime: Date.now() - startTime,
      };

      switch (checkType) {
        case 'exists':
          break;
        case 'file':
          if (!stats.isFile()) {
            result.status = 'unhealthy';
            result.error = '路径不是文件';
          }
          break;
        case 'directory':
          if (!stats.isDirectory()) {
            result.status = 'unhealthy';
            result.error = '路径不是目录';
          }
          break;
        case 'readable':
          try {
            await fs.promises.access(resolvedPath, fs.constants.R_OK);
          } catch {
            result.status = 'unhealthy';
            result.error = '路径不可读';
          }
          break;
        case 'writable':
          try {
            await fs.promises.access(resolvedPath, fs.constants.W_OK);
          } catch {
            result.status = 'unhealthy';
            result.error = '路径不可写';
          }
          break;
      }

      return result;
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      let errorMessage = err.message;
      
      if (err.code === 'ENOENT') {
        errorMessage = '文件或目录不存在';
      } else if (err.code === 'EACCES') {
        errorMessage = '权限不足，无法访问';
      }

      return {
        status: 'unhealthy',
        error: errorMessage,
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
        responseTime: Date.now() - startTime,
      };
    }
  }
}

export const fileChecker = new FileChecker();
