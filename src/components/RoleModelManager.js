import React, { useState, useEffect, useRef } from 'react';
import { AI_ROLES } from '../utils/roles';
import { getCurrentLanguage } from '../utils/language';
import { dbManager, getAllRoles } from '../utils/database';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './RoleModelManager.css';

const SortableRoleCard = ({ role, loading, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: role.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="role-card">
      <div className="role-info">
        <div className="drag-handle" {...attributes} {...listeners}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </div>
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
        <button
          className="edit-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEdit(role);
          }}
          disabled={loading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          className="delete-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(role.id);
          }}
          disabled={loading}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14zM10 11v6M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

// 常用emoji选项
const EMOJI_OPTIONS = [
  '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
  '🙂', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋',
  '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳',
  '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖',
  '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯',
  '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔',
  '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦',
  '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴',
  '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿',
  '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖',
  '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾',
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
  '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔',
  '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺',
  '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟',
  '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑',
  '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈',
  '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪',
  '🐫', '🦒', '🦘', '🦬', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏',
  '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐈', '🐓', '🦃', '🦚',
  '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥',
  '🐁', '🐀', '🐿️', '🦔', '🐾', '🐉', '🐲', '🌵', '🎄', '🌲',
  '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂',
  '🍁', '🍄', '🐚', '🌾', '💐', '🌷', '🌹', '🥀', '🌺', '🌸',
  '🌼', '🌻', '🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗',
  '🌘', '🌑', '🌒', '🌓', '🌔', '⭐', '🌟', '💫', '✨', '☄️',
  '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '❄️',
  '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌊', '💧', '💦', '☔',
  '👨‍💼', '👩‍💼', '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '👨‍🏭', '👩‍🏭', '👨‍💻', '👩‍💻',
  '👨‍🎤', '👩‍🎤', '👨‍🎧', '👩‍🎧', '👨‍🎭', '👩‍🎭', '👨‍🏫', '👩‍🏫', '👨‍🏢', '👩‍🏢',
  '👨‍🌾', '👩‍🌾', '👨‍🍳', '👩‍🍳', '👨‍🔧', '👩‍🔧', '👨‍🔨', '👩‍🔨', '👨‍⚖️', '👩‍⚖️',
  '👨‍✈️', '👩‍✈️', '👨‍🚀', '👩‍🚀', '👨‍⚕️', '👩‍⚕️', '👨‍🌾', '👩‍🌾', '👨‍🎯', '👩‍🎯',
  '🧑', '👨', '👩', '🧔', '👱', '👨‍🦰', '👩‍🦰', '👨‍🦱', '👩‍🦱', '👨‍🦲',
  '👩‍🦲', '👨‍🦳', '👩‍🦳', '🦱', '🦲', '🦳', '👨‍🦼', '👩‍🦼', '👨‍🦽', '👩‍🦽',
  '🦵', '🦿', '🦶', '👣', '👂', '🦻', '👃', '🧠', '🦷', '🦴',
  '👀', '👁️', '👅', '👄', '💋', '🩸', '💌', '👤', '👥', '🫂'
];

// Emoji选择器组件
const EmojiSelector = ({ value, onChange, currentLanguage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selectorRef = useRef(null);

  // 过滤emoji选项
  const filteredEmojis = EMOJI_OPTIONS.filter(emoji =>
    emoji.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="emoji-selector" ref={selectorRef}>
      <div
        className="emoji-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="emoji-display">{value || '😀'}</span>
        <span className="emoji-arrow">▼</span>
      </div>

      {isOpen && (
        <div className="emoji-dropdown">
          <div className="emoji-search">
            <input
              type="text"
              placeholder={currentLanguage === 'zh' ? '搜索emoji...' : 'Search emoji...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="emoji-grid">
            {filteredEmojis.map((emoji, index) => (
              <div
                key={index}
                className="emoji-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(emoji);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
  const [loading, setLoading] = useState(true);

  const currentLanguage = getCurrentLanguage();

  // 拖拽传感器配置 - 优化移动端触摸支持
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 需要移动8px才开始拖拽，避免误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 角色编辑相关函数
  const handleEditRole = (role) => {
      setEditingRole({ ...role });
  };

  const handleSaveRole = async () => {
    if (editingRole) {
      // 验证输入参数
      const validationErrors = validateRoleInput(editingRole);
      if (validationErrors.length > 0) {
        alert(currentLanguage === 'zh' ?
          `输入验证失败:\n${validationErrors.join('\n')}` :
          `Input validation failed:\n${validationErrors.join('\n')}`
        );
        return;
      }

      try {
        setLoading(true);

        // 更新状态
        const updatedRoles = roles.map(role =>
          role.id === editingRole.id ? editingRole : role
        );
        setRoles(updatedRoles);
        setEditingRole(null);
        setIsAddingRole(false);

        // 保存到localStorage
        localStorage.setItem('custom-roles', JSON.stringify(updatedRoles));
        updateGlobalRoles(updatedRoles);

        // 保存到数据库
        await saveRolesToDatabase(updatedRoles);

        setLoading(false);

      } catch (error) {
        console.error('保存角色失败:', error);
        setLoading(false);
      }
    }
  };

  // 验证角色输入参数
  const validateRoleInput = (role) => {
    const errors = [];

    // 验证角色名称
    if (!role.name || role.name.trim().length === 0) {
      errors.push(currentLanguage === 'zh' ? '角色名称不能为空' : 'Role name cannot be empty');
    }

    // 验证Temperature
    if (typeof role.temperature !== 'number' || isNaN(role.temperature)) {
      errors.push(currentLanguage === 'zh' ? 'Temperature必须是数字' : 'Temperature must be a number');
    } else if (role.temperature < 0 || role.temperature > 2) {
      errors.push(currentLanguage === 'zh' ? 'Temperature必须在0到2之间' : 'Temperature must be between 0 and 2');
    }

    // 验证Top P
    if (typeof role.topP !== 'number' || isNaN(role.topP)) {
      errors.push(currentLanguage === 'zh' ? 'Top P必须是数字' : 'Top P must be a number');
    } else if (role.topP < 0 || role.topP > 1) {
      errors.push(currentLanguage === 'zh' ? 'Top P必须在0到1之间' : 'Top P must be between 0 and 1');
    }

    // 验证头像
    if (!role.avatar || role.avatar.trim().length === 0) {
      errors.push(currentLanguage === 'zh' ? '头像不能为空' : 'Avatar cannot be empty');
    }

    // 验证系统提示词
    if (!role.systemPrompt || role.systemPrompt.trim().length === 0) {
      errors.push(currentLanguage === 'zh' ? '系统提示词不能为空' : 'System prompt cannot be empty');
    }

    return errors;
  };

  // 拖拽结束处理
  const handleDragEnd = (event) => {
    const { active, over } = event;

    // 恢复页面滚动
    document.body.style.overflow = '';

    if (active.id !== over.id) {
      setRoles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // 立即保存到localStorage和数据库
        localStorage.setItem('custom-roles', JSON.stringify(newItems));
        updateGlobalRoles(newItems);

        // 异步保存到数据库
        saveRolesToDatabase(newItems);

        return newItems;
      });
    }
  };

  // 保存角色到数据库
  const saveRolesToDatabase = async (rolesToSave) => {
    try {
      // 清空现有角色并重新插入
      await dbManager.clearRoles();
      for (const role of rolesToSave) {
        await dbManager.saveRole(role);
      }
    } catch (error) {
      console.error('保存角色到数据库失败:', error);
    }
  };

  // 更新全局角色列表
  const updateGlobalRoles = (updatedRoles) => {
    // 这里需要更新utils/roles.js中的AI_ROLES数组
    // 由于ES6模块的限制，我们需要通过修改全局对象来实现
    try {
      // 将更新后的角色信息保存到localStorage，供其他组件使用
      localStorage.setItem('ai-roles-updated', JSON.stringify(updatedRoles));
      // 触发自定义事件通知其他组件角色已更新
      window.dispatchEvent(new CustomEvent('rolesUpdated', { detail: updatedRoles }));
    } catch (error) {
      console.error('更新全局角色列表失败:', error);
    }
  };

  const handleDeleteRole = (roleId) => {
    console.log('删除角色被点击:', roleId); // 调试日志
    if (window.confirm(currentLanguage === 'zh' ? '确定要删除这个角色吗？' : 'Are you sure you want to delete this role?')) {
      const updatedRoles = roles.filter(role => role.id !== roleId);
      setRoles(updatedRoles);
      localStorage.setItem('custom-roles', JSON.stringify(updatedRoles));
      updateGlobalRoles(updatedRoles);
      console.log('角色删除成功'); // 调试日志
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
      topP: 1.0,
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
      localStorage.removeItem('ai-roles-updated');
      // 触发重置事件
      window.dispatchEvent(new CustomEvent('rolesReset'));
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

  // 从数据库加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // 初始化数据库
        await dbManager.init();

        // 加载角色数据
        const savedRoles = await getAllRoles();
        if (savedRoles && savedRoles.length > 0) {
          setRoles(savedRoles);
        }

        // 加载模型设置（仍然使用localStorage作为备选）
        const savedModels = localStorage.getItem('model-settings');
        if (savedModels) {
          try {
            const parsedModels = JSON.parse(savedModels);
            setModels(parsedModels);
          } catch (error) {
            console.error('加载模型设置失败:', error);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('加载数据失败:', error);
        setLoading(false);

        // 降级到localStorage
        const savedRoles = localStorage.getItem('custom-roles');
        if (savedRoles) {
          try {
            const parsedRoles = JSON.parse(savedRoles);
            setRoles(parsedRoles);
          } catch (error) {
            console.error('加载自定义角色失败:', error);
          }
        }
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);


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

              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>{currentLanguage === 'zh' ? '加载中...' : 'Loading...'}</p>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  onDragStart={() => {
                    // 拖拽开始时禁用页面滚动
                    document.body.style.overflow = 'hidden';
                  }}
                  onDragCancel={() => {
                    // 拖拽取消时恢复页面滚动
                    document.body.style.overflow = '';
                  }}
                >
                  <SortableContext items={roles.map(role => role.id)} strategy={verticalListSortingStrategy}>
                <div className="roles-grid">
                      {roles.map((role, index) => (
                        <SortableRoleCard
                          key={role.id}
                          role={role}
                          loading={loading}
                          onEdit={handleEditRole}
                          onDelete={handleDeleteRole}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
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
              <div className="form-container">
                <div className="form-group">
                  <label>{currentLanguage === 'zh' ? '角色名称' : 'Role Name'}</label>
                  <input
                    type="text"
                    value={editingRole.name}
                    onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                  />
                </div>

                <div className="form-row-double">
                  <div className="form-group">
                    <label>{currentLanguage === 'zh' ? '头像' : 'Avatar'}</label>
                    <EmojiSelector
                      value={editingRole.avatar}
                      onChange={(avatar) => setEditingRole({...editingRole, avatar})}
                      currentLanguage={currentLanguage}
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
                </div>

                <div className="form-row-double">
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
                    <label>{currentLanguage === 'zh' ? 'Top P' : 'Top P'}</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={editingRole.topP || 1.0}
                      onChange={(e) => setEditingRole({...editingRole, topP: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>{currentLanguage === 'zh' ? '描述' : 'Description'}</label>
                  <textarea
                    value={editingRole.description}
                    style={{minHeight: '40px', maxHeight: '140px'}}
                    onChange={(e) => setEditingRole({...editingRole, description: e.target.value})}
                  />
                </div>

                <div className="form-group">
                  <label>{currentLanguage === 'zh' ? '系统提示词' : 'System Prompt'}</label>
                  <textarea
                    className="system-prompt"
                    style={{minHeight: '120px', maxHeight: '140px'}}
                    value={editingRole.systemPrompt}
                    onChange={(e) => setEditingRole({...editingRole, systemPrompt: e.target.value})}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button className="cancel-button" onClick={() => setEditingRole(null)}>
                  {currentLanguage === 'zh' ? '取消' : 'Cancel'}
                </button>
                <button className="save-button" onClick={() => {
                  console.log('保存按钮被点击'); // 调试日志
                  handleSaveRole();
                }}>
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