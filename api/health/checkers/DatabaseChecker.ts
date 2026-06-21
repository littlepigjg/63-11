import { IHealthChecker, CheckContext } from '../HealthChecker.js';
import type { CheckerType, HealthCheckResult } from '../../../shared/types.js';
import net from 'net';
import { URL } from 'url';

interface ConnectionInfo {
  host: string;
  port: number;
}

function parseConnectionString(value: string): ConnectionInfo | null {
  try {
    if (value.startsWith('mysql://') || value.startsWith('postgres://') || 
        value.startsWith('mongodb://') || value.startsWith('redis://') ||
        value.startsWith('mssql://')) {
      const url = new URL(value);
      return {
        host: url.hostname,
        port: parseInt(url.port) || getDefaultPort(url.protocol),
      };
    }

    const hostPortMatch = value.match(/host=([^\s;]+).*?port=(\d+)/i);
    if (hostPortMatch) {
      return { host: hostPortMatch[1], port: parseInt(hostPortMatch[2]) };
    }

    const serverMatch = value.match(/server=([^\s;,]+)[,;]?.*?port=(\d+)/i);
    if (serverMatch) {
      return { host: serverMatch[1], port: parseInt(serverMatch[2]) };
    }

    const simpleMatch = value.match(/([a-zA-Z0-9.-]+):(\d+)/);
    if (simpleMatch) {
      return { host: simpleMatch[1], port: parseInt(simpleMatch[2]) };
    }
  } catch {
    return null;
  }
  return null;
}

function getDefaultPort(protocol: string): number {
  const ports: Record<string, number> = {
    'mysql:': 3306,
    'postgres:': 5432,
    'mongodb:': 27017,
    'redis:': 6379,
    'mssql:': 1433,
  };
  return ports[protocol] || 0;
}

export class DatabaseChecker implements IHealthChecker {
  readonly type: CheckerType = 'database';

  canHandle(key: string, value: string): boolean {
    const dbKeywords = ['DB', 'DATABASE', 'CONN', 'CONNECTION', 'MYSQL', 'POSTGRES', 'MONGODB', 'REDIS', 'MSSQL'];
    const keyUpper = key.toUpperCase();
    
    if (dbKeywords.some(kw => keyUpper.includes(kw))) {
      return parseConnectionString(value) !== null;
    }
    
    if (parseConnectionString(value) !== null) {
      return true;
    }
    
    return false;
  }

  async check(context: CheckContext): Promise<HealthCheckResult> {
    const timeout = context.config.timeout || 5000;
    
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

    const connInfo = parseConnectionString(actualValue);
    if (!connInfo) {
      return {
        status: 'unhealthy',
        error: '无法解析数据库连接字符串',
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
      };
    }

    if (connInfo.port === 0) {
      return {
        status: 'unhealthy',
        error: '无法确定数据库端口',
        checkedAt: new Date().toISOString(),
        checkerType: this.type,
      };
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      const startTime = Date.now();

      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve({
          status: 'healthy',
          checkedAt: new Date().toISOString(),
          checkerType: this.type,
          responseTime: Date.now() - startTime,
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: 'unhealthy',
          error: `连接超时 (${timeout}ms)`,
          checkedAt: new Date().toISOString(),
          checkerType: this.type,
          responseTime: Date.now() - startTime,
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          status: 'unhealthy',
          error: `连接失败: ${err.message}`,
          checkedAt: new Date().toISOString(),
          checkerType: this.type,
          responseTime: Date.now() - startTime,
        });
      });

      socket.connect(connInfo.port, connInfo.host);
    });
  }
}

export const databaseChecker = new DatabaseChecker();
