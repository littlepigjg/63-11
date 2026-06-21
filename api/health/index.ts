import { healthCheckerRegistry } from './HealthChecker.js';
import { databaseChecker } from './checkers/DatabaseChecker.js';
import { httpChecker } from './checkers/HttpChecker.js';
import { fileChecker } from './checkers/FileChecker.js';
import { urlChecker } from './checkers/UrlChecker.js';

healthCheckerRegistry.register(databaseChecker);
healthCheckerRegistry.register(httpChecker);
healthCheckerRegistry.register(fileChecker);
healthCheckerRegistry.register(urlChecker);

healthCheckerRegistry.registerKeyPattern(/^DB_/, 'database');
healthCheckerRegistry.registerKeyPattern(/DATABASE/, 'database');
healthCheckerRegistry.registerKeyPattern(/CONN(?:ECTION)?_STRING/, 'database');
healthCheckerRegistry.registerKeyPattern(/MYSQL/, 'database');
healthCheckerRegistry.registerKeyPattern(/POSTGRES/, 'database');
healthCheckerRegistry.registerKeyPattern(/MONGODB/, 'database');
healthCheckerRegistry.registerKeyPattern(/REDIS/, 'database');
healthCheckerRegistry.registerKeyPattern(/MSSQL/, 'database');

healthCheckerRegistry.registerKeyPattern(/API_/, 'http');
healthCheckerRegistry.registerKeyPattern(/ENDPOINT/, 'http');
healthCheckerRegistry.registerKeyPattern(/SERVICE_/, 'http');
healthCheckerRegistry.registerKeyPattern(/^HTTP_/, 'http');

healthCheckerRegistry.registerKeyPattern(/PATH$/, 'file');
healthCheckerRegistry.registerKeyPattern(/FILE$/, 'file');
healthCheckerRegistry.registerKeyPattern(/DIR$/, 'file');
healthCheckerRegistry.registerKeyPattern(/DIRECTORY$/, 'file');
healthCheckerRegistry.registerKeyPattern(/^LOG_/, 'file');
healthCheckerRegistry.registerKeyPattern(/UPLOAD/, 'file');

healthCheckerRegistry.registerKeyPattern(/URL$/, 'url');
healthCheckerRegistry.registerKeyPattern(/LINK$/, 'url');
healthCheckerRegistry.registerKeyPattern(/ADDRESS$/, 'url');

export * from './HealthChecker.js';
export * from './checkers/DatabaseChecker.js';
export * from './checkers/HttpChecker.js';
export * from './checkers/FileChecker.js';
export * from './checkers/UrlChecker.js';
export { healthCheckerRegistry };
