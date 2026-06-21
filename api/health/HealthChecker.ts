import type { CheckerType, HealthCheckResult, HealthCheckConfig } from '../../shared/types.js';

export interface CheckContext {
  value: string;
  config: HealthCheckConfig;
  decrypt?: (value: string, iv: string, tag: string) => Promise<string>;
  encrypted?: boolean;
  iv?: string;
  tag?: string;
}

export interface IHealthChecker {
  readonly type: CheckerType;
  check(context: CheckContext): Promise<HealthCheckResult>;
  canHandle(key: string, value: string): boolean;
}

class HealthCheckerRegistry {
  private checkers: Map<CheckerType, IHealthChecker> = new Map();
  private keyPatterns: Map<RegExp, CheckerType> = new Map();

  register(checker: IHealthChecker): void {
    this.checkers.set(checker.type, checker);
  }

  registerKeyPattern(pattern: RegExp, type: CheckerType): void {
    this.keyPatterns.set(pattern, type);
  }

  get(type: CheckerType): IHealthChecker | undefined {
    return this.checkers.get(type);
  }

  getAll(): IHealthChecker[] {
    return Array.from(this.checkers.values());
  }

  detectCheckerType(key: string, value: string): CheckerType | null {
    for (const [pattern, type] of this.keyPatterns) {
      if (pattern.test(key)) {
        return type;
      }
    }

    for (const checker of this.checkers.values()) {
      if (checker.canHandle(key, value)) {
        return checker.type;
      }
    }

    return null;
  }

  async check(type: CheckerType, context: CheckContext): Promise<HealthCheckResult> {
    const checker = this.checkers.get(type);
    if (!checker) {
      return {
        status: 'unhealthy',
        error: `No checker registered for type: ${type}`,
        checkedAt: new Date().toISOString(),
        checkerType: type,
      };
    }

    const startTime = Date.now();
    try {
      const result = await checker.check(context);
      result.responseTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
        checkedAt: new Date().toISOString(),
        checkerType: type,
        responseTime: Date.now() - startTime,
      };
    }
  }
}

export const healthCheckerRegistry = new HealthCheckerRegistry();
