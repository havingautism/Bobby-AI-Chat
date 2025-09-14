import React, { useState, useEffect } from 'react';
import { AI_ROLES, getRoleById } from '../utils/roles';
import { API_PROVIDERS } from '../utils/api-manager';
import { getCurrentLanguage, t } from '../utils/language';
import './RoleModelManager.css';

const RoleModelManager = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('roles'); // 'roles' or 'models'
  const [roles, setRoles] = useState([...AI_ROLES]);
  const [editingRole, setEditingRole] = useState(null);
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [models, setModels] = useState([
    { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'siliconflow', enabled: true },
    { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'siliconflow', enabled: true },
    { id: 'gpt-4', name: 'GPT-4', provider: 'openai', enabled: false },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', enabled: false },
  ]);
  const [editingModel, setEditingModel] = useState(null);
  const [isAddingModel, setIsAddingModel] = useState(false);

  const currentLanguage = getCurrentLanguage();

  // 角色编辑相关函数
  const handleEditRole = (role) => {
    setEditingRole({ ...role });
  };

  const handleSaveRole = () => {
    if (editingRole) {
      const updatedRoles = roles.map(role => 
        role.id === editingRole.id ? editingRole : role
      );
      setRoles(updatedRoles);
      setEditingRole(null);
      // 这里可以添加保存到localStorage的逻辑
      localStorage.setItem('custom-roles', JSON.stringify(updatedRoles));
    }
  };

  const handleDeleteRole = (roleId) => {
    if (window.confirm(currentLanguage === 'zh' ? '确定要删除这个角色吗？' : 'Are you sure you want to delete this role?')) {
      const updatedRoles = roles.filter(role => role.id !== roleId);
      setRoles(updatedRoles);
      localStorage.setItem('custom-roles', JSON.stringify(updatedRoles));
    }
  };

  const handleAddRole = () => {
    const newRole = {
      id: `custom-${Date.now()}`,
      name: currentLanguage === 'zh' ? '新角色' : 'New Role',
      icon: '🤖',
      avatar: '🤖',
      description: currentLanguage === 'zh' ? '自定义角色' : 'Custom role',
      temperature: 0.7,
      systemPrompt: currentLanguage === 'zh' ? '你是一个有帮助的AI助手。' : 'You are a helpful AI assistant.',
      color: '#6366f1',
    };
    setEditingRole(newRole);
    setIsAddingRole(true);
  };

  const handleResetRoles = () => {
    if (window.confirm(currentLanguage === 'zh' ? '确定要重置所有角色为默认设置吗？这将删除所有自定义角色。' : 'Are you sure you want to reset all roles to default settings? This will delete all custom roles.')) {
      // 重置为默认角色
      setRoles([...AI_ROLES]);
      // 清除localStorage中的自定义角色
      localStorage.removeItem('custom-roles');
    }
  };

  // 模型管理相关函数
  const handleToggleModel = (modelId) => {
    const updatedModels = models.map(model => 
      model.id === modelId ? { ...model, enabled: !model.enabled } : model
    );
    setModels(updatedModels);
    localStorage.setItem('model-settings', JSON.stringify(updatedModels));
  };

  const handleEditModel = (model) => {
    setEditingModel({ ...model });
  };

  const handleSaveModel = () => {
    if (editingModel) {
      const updatedModels = models.map(model => 
        model.id === editingModel.id ? editingModel : model
      );
      setModels(updatedModels);
      setEditingModel(null);
      setIsAddingModel(false);
      localStorage.setItem('model-settings', JSON.stringify(updatedModels));
    }
  };

  const handleDeleteModel = (modelId) => {
    if (window.confirm(currentLanguage === 'zh' ? '确定要删除这个模型吗？' : 'Are you sure you want to delete this model?')) {
      const updatedModels = models.filter(model => model.id !== modelId);
      setModels(updatedModels);
      localStorage.setItem('model-settings', JSON.stringify(updatedModels));
    }
  };

  const handleAddModel = () => {
    const newModel = {
      id: `custom-${Date.now()}`,
      name: currentLanguage === 'zh' ? '新模型' : 'New Model',
      provider: 'siliconflow',
      enabled: true,
    };
    setEditingModel(newModel);
    setIsAddingModel(true);
  };

  const handleResetModels = () => {
    if (window.confirm(currentLanguage === 'zh' ? '确定要重置所有模型为默认设置吗？这将删除所有自定义模型。' : 'Are you sure you want to reset all models to default settings? This will delete all custom models.')) {
      // 重置为默认模型
      const defaultModels = [
        { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'siliconflow', enabled: true },
        { id: 'deepseek-r1', name: 'DeepSeek R1', provider: 'siliconflow', enabled: true },
        { id: 'gpt-4', name: 'GPT-4', provider: 'openai', enabled: false },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai', enabled: false },
      ];
      setModels(defaultModels);
      // 清除localStorage中的模型设置
      localStorage.removeItem('model-settings');
    }
  };

  // 从localStorage加载自定义设置
  useEffect(() => {
    const savedRoles = localStorage.getItem('custom-roles');
    if (savedRoles) {
      try {
        const parsedRoles = JSON.parse(savedRoles);
        setRoles(parsedRoles);
      } catch (error) {
        console.error('加载自定义角色失败:', error);
      }
    }

    const savedModels = localStorage.getItem('model-settings');
    if (savedModels) {
      try {
        const parsedModels = JSON.parse(savedModels);
        setModels(parsedModels);
      } catch (error) {
        console.error('加载模型设置失败:', error);
      }
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="role-model-manager-overlay">
      <div className="role-model-manager">
        <div className="manager-header">
          <h2>{currentLanguage === 'zh' ? '角色与模型管理' : 'Role & Model Management'}</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="manager-tabs">
          <button 
            className={`tab-button ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            {currentLanguage === 'zh' ? '角色管理' : 'Role Management'}
          </button>
          <button 
            className={`tab-button ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            {currentLanguage === 'zh' ? '模型管理' : 'Model Management'}
          </button>
        </div>

        <div className="manager-content">
          {activeTab === 'roles' && (
            <div className="roles-section">
              <div className="section-header">
                <h3>{currentLanguage === 'zh' ? 'AI角色列表' : 'AI Roles List'}</h3>
                <div className="section-actions">
                  <button className="reset-button" onClick={handleResetRoles}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                    </svg>
                    {currentLanguage === 'zh' ? '重置' : 'Reset'}
                  </button>
                  <button className="add-button" onClick={handleAddRole}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    {currentLanguage === 'zh' ? '添加角色' : 'Add Role'}
                  </button>
                </div>
              </div>

              <div className="roles-grid">
                {roles.map((role) => (
                  <div key={role.id} className="role-card">
                    <div className="role-info">
                      <div className="role-avatar" style={{ backgroundColor: role.color }}>
                        {role.avatar}
                      </div>
                      <div className="role-details">
                        <h4>{role.name}</h4>
                        <p>{role.description}</p>
                        <div className="role-params">
                          <span>Temperature: {role.temperature}</span>
                        </div>
                      </div>
                    </div>
                    <div className="role-actions">
                      <button className="edit-button" onClick={() => handleEditRole(role)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="delete-button" onClick={() => handleDeleteRole(role.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'models' && (
            <div className="models-section">
              <div className="section-header">
                <h3>{currentLanguage === 'zh' ? '模型列表' : 'Models List'}</h3>
                <div className="section-actions">
                  <button className="reset-button" onClick={handleResetModels}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                      <path d="M3 3v5h5"/>
                    </svg>
                    {currentLanguage === 'zh' ? '重置' : 'Reset'}
                  </button>
                  <button className="add-button" onClick={handleAddModel}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M5 12h14"/>
                    </svg>
                    {currentLanguage === 'zh' ? '添加模型' : 'Add Model'}
                  </button>
                </div>
              </div>

              <div className="models-list">
                {models.map((model) => (
                  <div key={model.id} className="model-item">
                    <div className="model-info">
                      <div className="model-status">
                        <div className={`status-indicator ${model.enabled ? 'enabled' : 'disabled'}`}></div>
                      </div>
                      <div className="model-details">
                        <h4>{model.name}</h4>
                        <p>Provider: {model.provider}</p>
                      </div>
                    </div>
                    <div className="model-actions">
                      <button 
                        className={`toggle-button ${model.enabled ? 'enabled' : 'disabled'}`}
                        onClick={() => handleToggleModel(model.id)}
                      >
                        {model.enabled ? 
                          (currentLanguage === 'zh' ? '启用' : 'Enabled') : 
                          (currentLanguage === 'zh' ? '禁用' : 'Disabled')
                        }
                      </button>
                      <button className="edit-button" onClick={() => handleEditModel(model)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button className="delete-button" onClick={() => handleDeleteModel(model.id)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 角色编辑模态框 */}
        {editingRole && (
          <div className="edit-modal">
            <div className="modal-content">
              <h3>{isAddingRole ? (currentLanguage === 'zh' ? '添加角色' : 'Add Role') : (currentLanguage === 'zh' ? '编辑角色' : 'Edit Role')}</h3>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '角色名称' : 'Role Name'}</label>
                <input 
                  type="text" 
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '头像' : 'Avatar'}</label>
                <input 
                  type="text" 
                  value={editingRole.avatar}
                  onChange={(e) => setEditingRole({...editingRole, avatar: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '描述' : 'Description'}</label>
                <textarea 
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? 'Temperature' : 'Temperature'}</label>
                <input 
                  type="number" 
                  step="0.1"
                  min="0"
                  max="2"
                  value={editingRole.temperature}
                  onChange={(e) => setEditingRole({...editingRole, temperature: parseFloat(e.target.value)})}
                />
              </div>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '系统提示词' : 'System Prompt'}</label>
                <textarea 
                  className="system-prompt"
                  value={editingRole.systemPrompt}
                  onChange={(e) => setEditingRole({...editingRole, systemPrompt: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '颜色' : 'Color'}</label>
                <input 
                  type="color" 
                  value={editingRole.color}
                  onChange={(e) => setEditingRole({...editingRole, color: e.target.value})}
                />
              </div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setEditingRole(null)}>
                  {currentLanguage === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button className="save-button" onClick={handleSaveRole}>
                  {currentLanguage === 'zh' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 模型编辑模态框 */}
        {editingModel && (
          <div className="edit-modal">
            <div className="modal-content">
              <h3>{isAddingModel ? (currentLanguage === 'zh' ? '添加模型' : 'Add Model') : (currentLanguage === 'zh' ? '编辑模型' : 'Edit Model')}</h3>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '模型名称' : 'Model Name'}</label>
                <input 
                  type="text" 
                  value={editingModel.name}
                  onChange={(e) => setEditingModel({...editingModel, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>{currentLanguage === 'zh' ? '提供者' : 'Provider'}</label>
                <select 
                  value={editingModel.provider}
                  onChange={(e) => setEditingModel({...editingModel, provider: e.target.value})}
                >
                  <option value="siliconflow">SiliconFlow</option>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="cancel-button" onClick={() => {
                  setEditingModel(null);
                  setIsAddingModel(false);
                }}>
                  {currentLanguage === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button className="save-button" onClick={handleSaveModel}>
                  {currentLanguage === 'zh' ? '保存' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoleModelManager;