import { Router } from 'express';
import { healthCheckService } from '../services/HealthCheckService.js';
import { healthCheckerRegistry } from '../health/index.js';
import type { CheckerType } from '../../shared/types.js';

const router = Router();

router.get('/projects/:projectId/envs/:envName/configs', async (req, res) => {
  try {
    const { projectId, envName } = req.params;
    const configs = await healthCheckService.getConfigWithHealthStatus(projectId, envName);
    res.json({ success: true, data: configs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch configs with health status' });
  }
});

router.get('/projects/:projectId/envs/:envName/configs/:key', async (req, res) => {
  try {
    const { projectId, envName, key } = req.params;
    const result = healthCheckService.getCachedResult(projectId, envName, key);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Health check result not found' });
      return;
    }
    
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch health check result' });
  }
});

router.post('/projects/:projectId/envs/:envName/configs/:key/check', async (req, res) => {
  try {
    const { projectId, envName, key } = req.params;
    const force = req.query.force === 'true';
    
    const result = await healthCheckService.checkConfigItem(projectId, envName, key, force);
    
    if (!result) {
      res.status(404).json({ success: false, error: 'Config not found or health check not enabled' });
      return;
    }
    
    res.json({ success: true, data: result });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to run health check' });
  }
});

router.post('/projects/:projectId/envs/:envName/check', async (req, res) => {
  try {
    const { projectId, envName } = req.params;
    const force = req.query.force === 'true';
    
    const results = await healthCheckService.checkEnvironmentConfigs(projectId, envName, force);
    const data = Object.fromEntries(results);
    
    res.json({ success: true, data, checkedCount: results.size });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to run environment health checks' });
  }
});

router.post('/check-all', async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const checkedCount = await healthCheckService.checkAllConfigs(force);
    res.json({ success: true, data: { checkedCount } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to run all health checks' });
  }
});

router.post('/projects/:projectId/envs/:envName/configs/:key/enable', async (req, res) => {
  try {
    const { projectId, envName, key } = req.params;
    const { checkerType } = req.body;
    
    const updated = await healthCheckService.enableHealthCheck(
      projectId,
      envName,
      key,
      checkerType as CheckerType
    );
    
    if (!updated) {
      res.status(404).json({ success: false, error: 'Config not found or cannot detect checker type' });
      return;
    }
    
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to enable health check' });
  }
});

router.post('/projects/:projectId/envs/:envName/configs/:key/disable', async (req, res) => {
  try {
    const { projectId, envName, key } = req.params;
    
    const updated = await healthCheckService.disableHealthCheck(projectId, envName, key);
    
    if (!updated) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }
    
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to disable health check' });
  }
});

router.put('/projects/:projectId/envs/:envName/configs/:key/config', async (req, res) => {
  try {
    const { projectId, envName, key } = req.params;
    
    const updated = await healthCheckService.updateHealthCheckConfig(
      projectId,
      envName,
      key,
      req.body
    );
    
    if (!updated) {
      res.status(404).json({ success: false, error: 'Config not found' });
      return;
    }
    
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update health check config' });
  }
});

router.get('/checkers', async (req, res) => {
  try {
    const checkers = healthCheckerRegistry.getAll().map(c => ({
      type: c.type,
    }));
    res.json({ success: true, data: checkers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch checkers' });
  }
});

router.get('/projects/overview', async (req, res) => {
  try {
    const projects = await healthCheckService.getAllProjectsWithHealth();
    res.json({ success: true, data: projects });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch health overview' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = healthCheckService.getCacheStats();
    res.json({ success: true, data: stats });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch health check stats' });
  }
});

router.post('/cache/clear', async (req, res) => {
  try {
    healthCheckService.clearCache();
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to clear health check cache' });
  }
});

export default router;
