/**
 * local server entry file, for local development
 */
import app from './app.js';
import { healthCheckService } from './services/HealthCheckService.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`Server ready on port ${PORT}`);
  healthCheckService.startScheduledCheck();
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  healthCheckService.stopScheduledCheck();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  healthCheckService.stopScheduledCheck();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;