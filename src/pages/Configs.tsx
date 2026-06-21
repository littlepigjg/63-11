import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Lock, Download, Upload, FolderPlus, ChevronDown, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw, Activity, ShieldCheck, ShieldX } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useProjects, useConfigs } from '@/hooks';
import PageHeader from '@/components/PageHeader';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import { maskValue, envLabel } from '@/utils/format';
import type { ConfigItem, HealthCheckResult, HealthStatus, CheckerType } from '../../shared/types';

const DEFAULT_ENVS = ['development', 'testing', 'production'];

export default function Configs() {
  const { selectedProjectId, setSelectedProjectId, selectedEnv, setSelectedEnv } = useAppStore();
  const { projects, createProject } = useProjects();
  const {
    configs,
    addConfig,
    updateConfig,
    deleteConfig,
    loading,
    checkingKeys,
    runHealthCheck,
    runAllHealthChecks,
    enableHealthCheck,
    disableHealthCheck,
  } = useConfigs({
    projectId: selectedProjectId,
    envName: selectedEnv,
    withHealth: true,
  });

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null);
  const [formKey, setFormKey] = useState('');
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEncrypted, setFormEncrypted] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [envName, setEnvName] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showCheckerModal, setShowCheckerModal] = useState(false);
  const [selectedConfigForChecker, setSelectedConfigForChecker] = useState<ConfigItem | null>(null);
  const [checkerType, setCheckerType] = useState<CheckerType>('database');

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  const checkerTypes: { value: CheckerType; label: string }[] = [
    { value: 'database', label: '数据库连接' },
    { value: 'http', label: 'HTTP 接口' },
    { value: 'file', label: '文件路径' },
    { value: 'url', label: 'URL 格式' },
  ];

  const getHealthStatusIcon = (status?: HealthStatus, isChecking?: boolean) => {
    if (isChecking || status === 'checking') {
      return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
    }
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'unhealthy':
        return <XCircle className="w-4 h-4 text-rose-400" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return null;
    }
  };

  const getHealthStatusLabel = (status?: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return '正常';
      case 'unhealthy':
        return '异常';
      case 'checking':
        return '检查中';
      case 'pending':
        return '待检查';
      default:
        return '未启用';
    }
  };

  const getHealthStatusBadge = (config: ConfigItem, isChecking: boolean) => {
    if (!config.healthCheck?.enabled) {
      return <Badge variant="default">未检查</Badge>;
    }
    if (isChecking || config.healthStatus?.status === 'checking') {
      return <Badge variant="info">检查中</Badge>;
    }
    switch (config.healthStatus?.status) {
      case 'healthy':
        return <Badge variant="success">健康</Badge>;
      case 'unhealthy':
        return <Badge variant="danger">异常</Badge>;
      case 'pending':
        return <Badge variant="warning">待检查</Badge>;
      default:
        return <Badge variant="default">未检查</Badge>;
    }
  };

  const getRowClass = (config: ConfigItem, isChecking: boolean) => {
    const baseClass = 'border-b border-[#334155]/50 hover:bg-[#0F172A]/50 transition-colors';
    if (isChecking || config.healthStatus?.status === 'checking') {
      return `${baseClass} bg-blue-500/5`;
    }
    if (config.healthStatus?.status === 'unhealthy') {
      return `${baseClass} bg-rose-500/10`;
    }
    return baseClass;
  };

  const getKeyClass = (config: ConfigItem, isChecking: boolean) => {
    const baseClass = 'font-mono text-sm';
    if (config.healthStatus?.status === 'unhealthy' && !isChecking) {
      return `${baseClass} text-rose-400`;
    }
    return `${baseClass} text-emerald-400`;
  };

  const handleEnableHealthCheck = async (config: ConfigItem) => {
    setSelectedConfigForChecker(config);
    const detectedType = detectCheckerType(config.key, config.value);
    if (detectedType) {
      setCheckerType(detectedType);
    }
    setShowCheckerModal(true);
  };

  const detectCheckerType = (key: string, value: string): CheckerType | null => {
    const upperKey = key.toUpperCase();
    
    if (upperKey.includes('DB') || upperKey.includes('DATABASE') || upperKey.includes('CONN')) {
      return 'database';
    }
    if (upperKey.includes('API') || upperKey.includes('ENDPOINT') || upperKey.includes('SERVICE')) {
      return 'http';
    }
    if (upperKey.includes('PATH') || upperKey.includes('FILE') || upperKey.includes('DIR')) {
      return 'file';
    }
    if (upperKey.includes('URL') || upperKey.includes('LINK') || upperKey.includes('ADDRESS')) {
      return 'url';
    }
    
    if (value.startsWith('mysql://') || value.startsWith('postgres://') || 
        value.startsWith('mongodb://') || value.startsWith('redis://')) {
      return 'database';
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return 'http';
    }
    if (value.startsWith('/') || value.startsWith('./') || /^[a-zA-Z]:[\\/]/.test(value)) {
      return 'file';
    }
    
    return null;
  };

  const confirmEnableHealthCheck = async () => {
    if (!selectedConfigForChecker || !selectedProjectId) return;
    const result = await enableHealthCheck(selectedConfigForChecker.key, checkerType);
    if (result) {
      setShowCheckerModal(false);
      setSelectedConfigForChecker(null);
    }
  };

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, setSelectedProjectId]);

  const resetForm = () => {
    setFormKey('');
    setFormValue('');
    setFormDesc('');
    setFormEncrypted(false);
  };

  const handleAddConfig = async () => {
    if (!selectedProjectId || !formKey) return;
    const result = await addConfig(formKey, formValue, formDesc, formEncrypted);
    if (result) {
      setShowAddModal(false);
      resetForm();
    }
  };

  const handleEditConfig = async () => {
    if (!selectedProjectId || !editingConfig) return;
    const body: Partial<ConfigItem> = {};
    if (formValue !== undefined && formValue !== '') body.value = formValue;
    if (formDesc !== undefined) body.description = formDesc;
    body.encrypted = formEncrypted;
    const result = await updateConfig(editingConfig.key, body);
    if (result) {
      setShowEditModal(false);
      setEditingConfig(null);
      resetForm();
    }
  };

  const handleDeleteConfig = async (key: string) => {
    if (!confirm(`确定删除配置项 "${key}" 吗？`)) return;
    await deleteConfig(key);
  };

  const handleCreateProject = async () => {
    if (!projectName) return;
    const project = await createProject(projectName, projectDesc);
    if (project) {
      setShowProjectModal(false);
      setProjectName('');
      setProjectDesc('');
      setSelectedProjectId(project.id);
    }
  };

  const handleAddEnv = async () => {
    if (!selectedProjectId || !envName) return;
    const result = await addConfig('_init', '', 'Environment initializer', false);
    if (result) {
      setShowEnvModal(false);
      setEnvName('');
      setSelectedEnv(envName);
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(configs, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProject?.name || 'config'}_${selectedEnv}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !selectedProjectId) return;
      const text = await file.text();
      try {
        const items = JSON.parse(text);
        if (Array.isArray(items)) {
          for (const item of items) {
            await addConfig(item.key, item.value || '', item.description || '', false);
          }
        }
      } catch {
        alert('导入失败：无效的JSON文件');
      }
    };
    input.click();
  };

  const openEditModal = (config: ConfigItem) => {
    setEditingConfig(config);
    setFormValue(config.encrypted ? '' : config.value);
    setFormDesc(config.description);
    setFormEncrypted(config.encrypted);
    setShowEditModal(true);
  };

  const projectEnvs = currentProject?.environments.map((e) => e.name) || [];
  const allEnvs = [...new Set([...DEFAULT_ENVS, ...projectEnvs])];

  const hasUnhealthy = configs.some(c => c.healthStatus?.status === 'unhealthy');
  const hasHealthChecks = configs.some(c => c.healthCheck?.enabled);

  return (
    <div className="animate-slide-in">
      <PageHeader title="配置管理" subtitle="按项目和环境管理配置项" actions={
        <div className="flex items-center gap-2">
          {hasHealthChecks && (
            <button 
              onClick={() => runAllHealthChecks(true)} 
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors"
            >
              <Activity className="w-4 h-4" /> 全部检查
            </button>
          )}
          {hasUnhealthy && (
            <div className="flex items-center gap-1 px-2 py-1 text-xs bg-rose-500/15 text-rose-400 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{configs.filter(c => c.healthStatus?.status === 'unhealthy').length} 个异常</span>
            </div>
          )}
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Download className="w-4 h-4" /> 导出
          </button>
          <button onClick={handleImport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <Upload className="w-4 h-4" /> 导入
          </button>
          <button onClick={() => setShowProjectModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#94A3B8] border border-[#334155] rounded-lg hover:bg-[#334155] transition-colors">
            <FolderPlus className="w-4 h-4" /> 新建项目
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">
            <Plus className="w-4 h-4" /> 添加配置
          </button>
        </div>
      } />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative">
          <button onClick={() => setShowProjectDropdown(!showProjectDropdown)} className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] hover:border-emerald-500/30 transition-colors min-w-[200px] justify-between">
            <span>{currentProject?.name || '选择项目'}</span>
            <ChevronDown className="w-4 h-4 text-[#64748B]" />
          </button>
          {showProjectDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-20 overflow-hidden">
              {projects.map((p) => (
                <button key={p.id} onClick={() => { setSelectedProjectId(p.id); setShowProjectDropdown(false); }} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#334155] transition-colors ${p.id === selectedProjectId ? 'text-emerald-400' : 'text-[#94A3B8]'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 bg-[#1E293B] border border-[#334155] rounded-lg p-1">
          {allEnvs.map((env) => (
            <button key={env} onClick={() => setSelectedEnv(env)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              selectedEnv === env
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'text-[#64748B] hover:text-[#94A3B8]'
            }`}>
              {envLabel(env)}
            </button>
          ))}
          <button onClick={() => setShowEnvModal(true)} className="px-2 py-1.5 text-xs text-[#64748B] hover:text-emerald-400 transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-16 text-[#64748B]">
          <FolderPlus className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>请先创建或选择一个项目</p>
        </div>
      ) : (
        <div className="bg-[#1E293B] border border-[#334155] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#334155]">
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 w-8">健康</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">键名</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">值</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">描述</th>
                <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3">状态</th>
                <th className="text-right text-xs font-medium text-[#64748B] px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && configs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">加载中...</td>
                </tr>
              ) : configs.length === 0 || (configs.length === 1 && configs[0].key === '_init') ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[#64748B] text-sm">此环境下暂无配置项</td>
                </tr>
              ) : (
                configs
                  .filter((c) => c.key !== '_init')
                  .map((config) => {
                    const isChecking = checkingKeys.has(config.key);
                    return (
                  <tr key={config.key} className={getRowClass(config, isChecking)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {config.healthCheck?.enabled ? (
                          <div 
                            className="relative group cursor-help"
                            title={config.healthStatus?.error || `${getHealthStatusLabel(config.healthStatus?.status)} · ${config.healthStatus?.checkedAt ? new Date(config.healthStatus.checkedAt).toLocaleString() : '未检查'}`}
                          >
                            {getHealthStatusIcon(config.healthStatus?.status, isChecking)}
                            {config.healthStatus?.responseTime && config.healthStatus.status === 'healthy' && (
                              <span className="text-xs text-[#64748B] ml-1">{config.healthStatus.responseTime}ms</span>
                            )}
                            {config.healthStatus?.status === 'unhealthy' && (
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-10 w-64 p-2 bg-[#0F172A] border border-[#334155] rounded-lg text-xs text-rose-400 shadow-xl">
                                <div className="font-medium mb-1">检查失败</div>
                                <div className="text-[#94A3B8]">{config.healthStatus.error}</div>
                                <div className="text-[#64748B] mt-1">
                                  检查时间: {new Date(config.healthStatus.checkedAt).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEnableHealthCheck(config)}
                            className="p-1 text-[#475569] hover:text-emerald-400 rounded transition-colors"
                            title="启用健康检查"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={getKeyClass(config, isChecking)}>{config.key}</span>
                        {config.healthCheck?.enabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#334155] text-[#94A3B8]">
                            {config.healthCheck.checkerType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[#94A3B8]">
                          {config.encrypted ? maskValue(config.value) : (config.value.length > 40 ? config.value.slice(0, 40) + '...' : config.value)}
                        </span>
                        {config.encrypted && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#64748B]">{config.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {config.encrypted ? (
                          <Badge variant="warning">已加密</Badge>
                        ) : (
                          <Badge variant="success">明文</Badge>
                        )}
                        {getHealthStatusBadge(config, isChecking)}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {config.healthCheck?.enabled ? (
                          <button
                            onClick={() => runHealthCheck(config.key, true)}
                            disabled={isChecking}
                            className="p-1.5 text-[#64748B] hover:text-blue-400 rounded transition-colors disabled:opacity-50"
                            title="手动检查"
                          >
                            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                          </button>
                        ) : null}
                        {config.healthCheck?.enabled ? (
                          <button
                            onClick={() => disableHealthCheck(config.key)}
                            className="p-1.5 text-[#64748B] hover:text-amber-400 rounded transition-colors"
                            title="禁用健康检查"
                          >
                            <ShieldX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnableHealthCheck(config)}
                            className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors"
                            title="启用健康检查"
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => openEditModal(config)} className="p-1.5 text-[#64748B] hover:text-emerald-400 rounded transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteConfig(config.key)} className="p-1.5 text-[#64748B] hover:text-rose-400 rounded transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAddModal} onClose={() => { setShowAddModal(false); resetForm(); }} title="添加配置项">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">键名</label>
            <input value={formKey} onChange={(e) => setFormKey(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="例如: DB_HOST" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值</label>
            <input value={formValue} onChange={(e) => setFormValue(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="配置值" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="配置项描述" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formEncrypted} onChange={(e) => setFormEncrypted(e.target.checked)} className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50" />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowAddModal(false); resetForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleAddConfig} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">添加</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEditModal} onClose={() => { setShowEditModal(false); setEditingConfig(null); resetForm(); }} title={`编辑: ${editingConfig?.key}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">值 {editingConfig?.encrypted && '(留空保持原值)'}</label>
            <input value={formValue} onChange={(e) => setFormValue(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] font-mono focus:outline-none focus:border-emerald-500/50" placeholder="配置值" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="配置项描述" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={formEncrypted} onChange={(e) => setFormEncrypted(e.target.checked)} className="rounded border-[#334155] bg-[#0F172A] text-emerald-500 focus:ring-emerald-500/50" />
            <label className="text-sm text-[#94A3B8]">加密存储此值</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => { setShowEditModal(false); setEditingConfig(null); resetForm(); }} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleEditConfig} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">保存</button>
          </div>
        </div>
      </Modal>

      <Modal open={showProjectModal} onClose={() => setShowProjectModal(false)} title="新建项目">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">项目名称</label>
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="例如: 用户服务" />
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-1">描述</label>
            <input value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="项目描述" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowProjectModal(false)} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleCreateProject} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">创建</button>
          </div>
        </div>
      </Modal>

      <Modal open={showEnvModal} onClose={() => setShowEnvModal(false)} title="添加环境">
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-1">环境名称</label>
            <input value={envName} onChange={(e) => setEnvName(e.target.value)} className="w-full px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#F1F5F9] focus:outline-none focus:border-emerald-500/50" placeholder="例如: staging" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowEnvModal(false)} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors">取消</button>
            <button onClick={handleAddEnv} className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors">添加</button>
          </div>
        </div>
      </Modal>

      <Modal 
        open={showCheckerModal} 
        onClose={() => { setShowCheckerModal(false); setSelectedConfigForChecker(null); }} 
        title={`启用健康检查: ${selectedConfigForChecker?.key}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#64748B] mb-2">配置值</label>
            <div className="px-3 py-2 bg-[#0F172A] border border-[#334155] rounded-lg text-sm text-[#94A3B8] font-mono break-all">
              {selectedConfigForChecker?.encrypted 
                ? maskValue(selectedConfigForChecker.value) 
                : selectedConfigForChecker?.value}
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#64748B] mb-2">检查器类型</label>
            <div className="grid grid-cols-2 gap-2">
              {checkerTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setCheckerType(type.value)}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                    checkerType === type.value
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                      : 'bg-[#0F172A] text-[#94A3B8] border border-[#334155] hover:border-[#475569]'
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-xs text-[#64748B] bg-[#0F172A] rounded-lg p-3">
            <div className="font-medium text-[#94A3B8] mb-1">检查说明：</div>
            <ul className="space-y-1">
              <li>• <span className="text-emerald-400">数据库连接</span>：测试数据库服务器的 TCP 连接</li>
              <li>• <span className="text-blue-400">HTTP 接口</span>：发送 HTTP 请求验证接口可达性</li>
              <li>• <span className="text-amber-400">文件路径</span>：验证文件或目录是否存在</li>
              <li>• <span className="text-purple-400">URL 格式</span>：验证 URL 格式是否正确</li>
            </ul>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button 
              onClick={() => { setShowCheckerModal(false); setSelectedConfigForChecker(null); }} 
              className="px-4 py-2 text-sm text-[#64748B] hover:text-[#F1F5F9] transition-colors"
            >
              取消
            </button>
            <button 
              onClick={confirmEnableHealthCheck} 
              className="px-4 py-2 text-sm bg-emerald-500/15 text-emerald-400 rounded-lg hover:bg-emerald-500/25 transition-colors"
            >
              启用
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
