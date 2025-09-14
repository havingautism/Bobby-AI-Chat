// 简化版角色管理组件，用于测试编辑按钮问题
import React, { useState, useEffect, useRef } from 'react';

const TestRoleManager = ({ isOpen, onClose }) => {
  const [editingRole, setEditingRole] = useState(null);
  const [roles, setRoles] = useState([
    {
      id: 'bobby',
      name: 'Bobby',
      avatar: '🤖',
      description: 'AI助手',
      temperature: 0.7,
      color: '#6366f1'
    }
  ]);

  const handleEditRole = (role) => {
    console.log('编辑角色被点击:', role);
    setEditingRole(role);
  };

  const RoleCard = ({ role }) => {
    const editButtonRef = useRef(null);

    useEffect(() => {
      const button = editButtonRef.current;
      if (button) {
        const handleClick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('直接事件监听器: 编辑按钮被点击，角色:', role);
          handleEditRole(role);
        };

        button.addEventListener('click', handleClick);

        return () => {
          button.removeEventListener('click', handleClick);
        };
      }
    }, [role, handleEditRole]);

    return (
      <div className="role-card">
        <div className="role-info">
          <div className="role-avatar" style={{ backgroundColor: role.color }}>
            {role.avatar}
          </div>
          <div className="role-details">
            <h4>{role.name}</h4>
            <p>{role.description}</p>
          </div>
        </div>
        <div className="role-actions">
          <button
            ref={editButtonRef}
            className="edit-button"
            style={{
              padding: '8px',
              background: 'blue',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            编辑
          </button>
          <button
            onClick={() => {
              console.log('测试按钮被点击');
              handleEditRole(role);
            }}
            style={{
              padding: '8px',
              background: 'red',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: '8px'
            }}
          >
            测试
          </button>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="test-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="test-manager" style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        width: '500px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h2>角色管理测试</h2>

        <div className="roles-list">
          {roles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>

        {/* 编辑模态框 */}
        {editingRole && (
          <div className="edit-modal" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000
          }}>
            <div className="modal-content" style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              width: '400px'
            }}>
              <h3>编辑角色</h3>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px' }}>角色名称</label>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({...editingRole, name: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setEditingRole(null)}
                  style={{
                    padding: '8px 16px',
                    background: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    console.log('保存角色:', editingRole);
                    setEditingRole(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          关闭
        </button>
      </div>
    </div>
  );
};

export default TestRoleManager;