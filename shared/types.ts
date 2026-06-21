export type HealthStatus = 'healthy' | 'unhealthy' | 'pending' | 'checking';

export type CheckerType = 'database' | 'http' | 'file' | 'url' | 'custom';

export interface HealthCheckResult {
  status: HealthStatus;
  error?: string;
  checkedAt: string;
  checkerType: CheckerType;
  responseTime?: number;
}

export interface HealthCheckConfig {
  enabled: boolean;
  checkerType: CheckerType;
  checkInterval?: number;
  timeout?: number;
  customParams?: Record<string, string>;
}

export interface ConfigItem {
  key: string;
  value: string;
  description: string;
  encrypted: boolean;
  iv?: string;
  tag?: string;
  updatedAt: string;
  updatedBy: string;
  healthCheck?: HealthCheckConfig;
  healthStatus?: HealthCheckResult;
}

export interface Environment {
  name: string;
  configs: ConfigItem[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  environments: Environment[];
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: 'pull' | 'change' | 'encrypt' | 'decrypt' | 'client_register' | 'notify';
  clientIp: string;
  clientName: string;
  project: string;
  environment: string;
  detail: string;
}

export interface ClientInfo {
  id: string;
  name: string;
  ip: string;
  token: string;
  lastHeartbeat: string;
  online: boolean;
}

export interface ConfigData {
  encryptionKey: string;
  projects: Project[];
}

export interface LogsData {
  logs: LogEntry[];
}

export interface ClientsData {
  clients: ClientInfo[];
}

export interface PullResponse {
  configs: Record<string, string>;
  version: string;
  pulledAt: string;
}

export type LogType = LogEntry['type'];
