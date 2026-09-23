import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, RoleName, PermissionName, Task, TaskPriority } from '../types';
import { ROLE_PERMISSIONS } from '../data/seedData';
import { formatShiftTime } from '../utils/crm';
import { TasksView } from './TasksView';

export const StaffView: React.FC = () => {
  const {
    users,
    currentUser,
    attendance,
    tasks,
    shifts,
    addStaff,
    updateStaff,
    deactivateStaff,
    reactivateStaff,
    deleteStaff,
    forceCloseShift,
    createTask,
    completeTask,
    deleteTask,
    testServerPermission,
    updateUserAvatar,
    showFlash,
    hasPermission,
    roles,
    permissionsList,
    rolePermissions,
    createRole,
    updateRole,
    deleteRole,
    createPermission,
    updatePermission,
    deletePermission,
    toggleRolePermission,
    saveRolePermissionsMatrix,
    updateUserRole,
    setUserExtraPermissions,
    adminResetPassword
  } = useApp();

  const [staffTab, setStaffTab] = useState<'directory' | 'attendance' | 'tasks' | 'shifts' | 'permissions'>('directory');

  // RBAC view state & modals
  const [rbacViewMode, setRbacViewMode] = useState<'matrix' | 'roles' | 'permissions' | 'staff'>('matrix');
  const [showNewRoleModal, setShowNewRoleModal] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ name: '', description: '' });
  const [editingRole, setEditingRole] = useState<{ id: number; name: string } | null>(null);

  const [showNewPermModal, setShowNewPermModal] = useState(false);
  const [newPermForm, setNewPermForm] = useState({ name: '', description: '' });
  const [newPermInheritRoles, setNewPermInheritRoles] = useState<string[]>(['admin']);
  const [permRegistrySearch, setPermRegistrySearch] = useState<string>('');
  const [editingPerm, setEditingPerm] = useState<{ id: number; name: string; description: string } | null>(null);

  // Add/Edit staff modal with individual permission overrides
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [staffExtraPermissions, setStaffExtraPermissions] = useState<string[]>([]);
  const [staffPermFilter, setStaffPermFilter] = useState<string>('');

  // Staff Deactivation / Resignation state
  const [deactivatingStaff, setDeactivatingStaff] = useState<User | null>(null);
  const [deactivationReason, setDeactivationReason] = useState<string>('');
  const [reactivatingStaff, setReactivatingStaff] = useState<User | null>(null);
  const [staffDirectoryFilter, setStaffDirectoryFilter] = useState<'all' | 'active' | 'resigned'>('all');
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

  // Admin password reset modal state
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState<string>('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string>('');

  // Permission grant confirmation modal state (Role capabilities double-check)
  const [pendingPermissionGrant, setPendingPermissionGrant] = useState<{
    roleName: string;
    roleDisplayName: string;
    permissionName: string;
    permissionDisplayName: string;
    permissionDescription?: string;
    isCurrentlyGranted: boolean;
    isHighPrivilege: boolean;
  } | null>(null);
  const [grantDoubleCheckConfirmed, setGrantDoubleCheckConfirmed] = useState(false);

  // Role Promotion / Reassignment confirmation modal state (Rule 4: role changes are only way to change access)
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    userId: number;
    userName: string;
    currentRole: string;
    newRole: string;
  } | null>(null);
  const [roleChangeDoubleCheckConfirmed, setRoleChangeDoubleCheckConfirmed] = useState(false);

  // Server-Side RBAC Live Tester State
  const [testResult, setTestResult] = useState<{
    permission: string;
    loading: boolean;
    allowed?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  const handleInitiateRolePermissionToggle = (
    roleName: string,
    roleDisplayName: string,
    perm: { name: string; display_name?: string; description?: string },
    isCurrentlyGranted: boolean
  ) => {
    // Lockout protection: at least one role must maintain manage_roles
    if (isCurrentlyGranted && (roleName === 'admin' || roleName === 'super_admin') && perm.name === 'manage_roles') {
      const totalAdminRoles = Object.values(rolePermissions).filter(p => p.includes('manage_roles')).length;
      if (totalAdminRoles <= 1) {
        showFlash('Security Lockout Protection: At least one role must maintain the "manage_roles" permission.', 'error');
        return;
      }
    }

    const isHighPrivilege = [
      'manage_roles',
      'manage_users',
      'delete_sale',
      'process_refund',
      'export_reports',
      'manage_inventory',
      'manage_cashier_accounts'
    ].includes(perm.name);

    setPendingPermissionGrant({
      roleName,
      roleDisplayName,
      permissionName: perm.name,
      permissionDisplayName: perm.display_name || perm.name.replace(/_/g, ' '),
      permissionDescription: perm.description,
      isCurrentlyGranted,
      isHighPrivilege
    });
    setGrantDoubleCheckConfirmed(false);
  };

  const handleExecutePermissionGrantToggle = () => {
    if (!pendingPermissionGrant) return;

    const { roleName, roleDisplayName, permissionName, permissionDisplayName, isCurrentlyGranted } = pendingPermissionGrant;

    toggleRolePermission(roleName, permissionName);
    showFlash(
      `Permission "${permissionDisplayName}" successfully ${isCurrentlyGranted ? 'revoked from' : 'granted to'} ${roleDisplayName || roleName}.`,
      isCurrentlyGranted ? 'warning' : 'success'
    );

    setPendingPermissionGrant(null);
    setGrantDoubleCheckConfirmed(false);
  };

  const handleInitiateRoleChange = (user: User, newRole: string) => {
    if (user.role_name === newRole) return;
    setPendingRoleChange({
      userId: user.id,
      userName: user.name,
      currentRole: user.role_name,
      newRole
    });
    setRoleChangeDoubleCheckConfirmed(false);
  };

  const handleExecuteRoleChange = () => {
    if (!pendingRoleChange) return;
    updateUserRole(pendingRoleChange.userId, pendingRoleChange.newRole);
    setPendingRoleChange(null);
    setRoleChangeDoubleCheckConfirmed(false);
  };

  const handleRunServerPermissionTest = async (permName: string) => {
    setTestResult({ permission: permName, loading: true });
    try {
      const res = await testServerPermission(permName);
      setTestResult({
        permission: permName,
        loading: false,
        allowed: res.allowed,
        message: res.message,
        error: res.error
      });
    } catch (err: any) {
      setTestResult({
        permission: permName,
        loading: false,
        allowed: false,
        error: err.message || 'Server request failed'
      });
    }
  };
  const [staffForm, setStaffForm] = useState({
    name: '',
    email: '',
    phone: '',
    role_name: 'cashier' as RoleName,
    shift_name: 'Morning',
    is_active: true
  });

  // Moderating user image state (Admin capability)
  const [moderatingUser, setModeratingUser] = useState<User | null>(null);
  const [moderationAvatarUrl, setModerationAvatarUrl] = useState<string>('');

  // Assign task modal (By User to User)
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState<{
    title: string;
    description: string;
    assigned_to: number;
    assigned_by: number;
    priority: TaskPriority;
    due_date: string;
  }>({
    title: '',
    description: '',
    assigned_to: users.find(u => u.id !== currentUser.id)?.id || users[0]?.id || 1,
    assigned_by: currentUser.id,
    priority: 'medium',
    due_date: ''
  });

  // Task filter states
  const [taskFilterStatus, setTaskFilterStatus] = useState<'all' | 'pending' | 'completed'>('all');
  const [taskFilterAssignee, setTaskFilterAssignee] = useState<string>('all');
  const [taskFilterAssigner, setTaskFilterAssigner] = useState<string>('all');
  const [taskFilterPriority, setTaskFilterPriority] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState<string>('');

  // Selected staff profile view modal
  const [viewingStaff, setViewingStaff] = useState<User | null>(null);

  const getAvatarSrc = (pic?: string) => {
    if (!pic) return '';
    if (pic.startsWith('data:') || pic.startsWith('http') || pic.startsWith('/')) return pic;
    return `/uploads/avatars/${pic}`;
  };

  const openAddStaff = () => {
    setEditingStaff(null);
    setStaffForm({
      name: '',
      email: '',
      phone: '',
      role_name: 'cashier',
      shift_name: 'Morning',
      is_active: true
    });
    setStaffExtraPermissions([]);
    setStaffPermFilter('');
    setShowStaffModal(true);
  };

  const openEditStaff = (u: User) => {
    setEditingStaff(u);
    setStaffForm({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      role_name: u.role_name,
      shift_name: u.shift_name || 'Morning',
      is_active: u.is_active
    });
    setStaffExtraPermissions(u.extra_permissions ? [...u.extra_permissions] : []);
    setStaffPermFilter('');
    setShowStaffModal(true);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const shift = shifts.find(s => s.name === staffForm.shift_name);
    const matchedRole = roles.find(r => r.name === staffForm.role_name);
    const roleId = matchedRole ? matchedRole.id : (staffForm.role_name === 'super_admin' ? 1 : staffForm.role_name === 'admin' ? 2 : staffForm.role_name === 'inventory_manager' ? 3 : 4);

    if (editingStaff) {
      updateStaff(editingStaff.id, {
        name: staffForm.name,
        email: staffForm.email,
        phone: staffForm.phone,
        role_name: staffForm.role_name,
        role_id: roleId,
        shift_name: staffForm.shift_name,
        shift_start: shift?.start_time,
        shift_end: shift?.end_time,
        is_active: staffForm.is_active,
        extra_permissions: staffExtraPermissions
      });
      setUserExtraPermissions(editingStaff.id, staffExtraPermissions);
      showFlash(`Updated ${staffForm.name} with ${staffExtraPermissions.length} individual permission override(s).`, 'success');
    } else {
      addStaff({
        name: staffForm.name,
        email: staffForm.email,
        phone: staffForm.phone,
        role_name: staffForm.role_name,
        role_id: roleId,
        shift_name: staffForm.shift_name,
        shift_start: shift?.start_time,
        shift_end: shift?.end_time,
        is_active: staffForm.is_active,
        extra_permissions: staffExtraPermissions
      });
      showFlash(`Staff member ${staffForm.name} created.`, 'success');
    }
    setShowStaffModal(false);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    createTask(
      taskForm.title.trim(),
      taskForm.description.trim(),
      Number(taskForm.assigned_to),
      Number(taskForm.assigned_by),
      taskForm.priority,
      taskForm.due_date.trim() || undefined
    );
    setTaskForm({
      title: '',
      description: '',
      assigned_to: users.find(u => u.id !== currentUser.id)?.id || users[0]?.id || 1,
      assigned_by: currentUser.id,
      priority: 'medium',
      due_date: ''
    });
    setShowTaskModal(false);
  };

  const filteredTasks = tasks.filter(t => {
    if (taskFilterStatus !== 'all' && t.status !== taskFilterStatus) return false;
    if (taskFilterAssignee !== 'all' && t.assigned_to !== Number(taskFilterAssignee)) return false;
    if (taskFilterAssigner !== 'all' && t.assigned_by !== Number(taskFilterAssigner)) return false;
    if (taskFilterPriority !== 'all' && (t.priority || 'medium') !== taskFilterPriority) return false;
    if (taskSearch.trim()) {
      const q = taskSearch.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      const matchTo = t.assigned_to_name.toLowerCase().includes(q);
      const matchBy = t.assigned_by_name.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchTo && !matchBy) return false;
    }
    return true;
  });

  const allPermissionsList = permissionsList.map(p => p.name);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Staff &amp; Workforce Management</h1>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>
            Manage staff accounts, shifts, attendance logs, cash reconciliation, and dynamic role permissions.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`category-pill ${staffTab === 'directory' ? 'active' : ''}`}
            onClick={() => setStaffTab('directory')}
          >
            <i className="fa-solid fa-users" style={{ marginRight: '6px' }}></i>
            Staff Directory ({users.length})
          </button>
          <button
            className={`category-pill ${staffTab === 'attendance' ? 'active' : ''}`}
            onClick={() => setStaffTab('attendance')}
          >
            <i className="fa-solid fa-user-clock" style={{ marginRight: '6px' }}></i>
            Attendance ({attendance.length})
          </button>
          <button
            className={`category-pill ${staffTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setStaffTab('tasks')}
          >
            <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i>
            Tasks ({tasks.length})
          </button>
          <button
            className={`category-pill ${staffTab === 'shifts' ? 'active' : ''}`}
            onClick={() => setStaffTab('shifts')}
          >
            <i className="fa-solid fa-business-time" style={{ marginRight: '6px' }}></i>
            Shifts ({shifts.length})
          </button>
          <button
            className={`category-pill ${staffTab === 'permissions' ? 'active' : ''}`}
            onClick={() => setStaffTab('permissions')}
          >
            <i className="fa-solid fa-shield-halved" style={{ marginRight: '6px' }}></i>
            Roles &amp; Permissions ({roles.length})
          </button>
        </div>
      </div>

      {/* 1. DIRECTORY */}
      {staffTab === 'directory' && (() => {
        const activeStaffCount = users.filter(u => u.is_active !== false).length;
        const resignedStaffCount = users.filter(u => u.is_active === false).length;
        const filteredStaffUsers = users.filter(u => {
          if (staffDirectoryFilter === 'active' && u.is_active === false) return false;
          if (staffDirectoryFilter === 'resigned' && u.is_active !== false) return false;
          if (staffSearchQuery.trim()) {
            const q = staffSearchQuery.toLowerCase();
            const matchName = u.name.toLowerCase().includes(q);
            const matchEmail = u.email.toLowerCase().includes(q);
            const matchPhone = u.phone?.toLowerCase().includes(q) || false;
            const matchRole = u.role_name.toLowerCase().includes(q);
            if (!matchName && !matchEmail && !matchPhone && !matchRole) return false;
          }
          return true;
        });

        return (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users" style={{ color: 'var(--primary)' }}></i>
                  Staff Team Directory
                </h2>
                <p className="subtitle" style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Manage employee profiles, role assignments, lifecycle activation, and credentials.
                </p>
              </div>
              <button className="btn btn-primary" onClick={openAddStaff}>
                <i className="fa-solid fa-user-plus"></i> Add Staff Member
              </button>
            </div>

            {/* Directory Filters & Search */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 14px',
                background: 'var(--bg-secondary)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`category-pill ${staffDirectoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setStaffDirectoryFilter('all')}
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                >
                  All Staff ({users.length})
                </button>
                <button
                  type="button"
                  className={`category-pill ${staffDirectoryFilter === 'active' ? 'active' : ''}`}
                  onClick={() => setStaffDirectoryFilter('active')}
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                >
                  <i className="fa-solid fa-circle-check" style={{ color: 'var(--success)', marginRight: '5px' }}></i>
                  Active ({activeStaffCount})
                </button>
                <button
                  type="button"
                  className={`category-pill ${staffDirectoryFilter === 'resigned' ? 'active' : ''}`}
                  onClick={() => setStaffDirectoryFilter('resigned')}
                  style={{ fontSize: '12px', padding: '5px 12px' }}
                >
                  <i className="fa-solid fa-user-slash" style={{ color: '#ef4444', marginRight: '5px' }}></i>
                  Resigned / Deactivated ({resignedStaffCount})
                </button>
              </div>

              <div style={{ position: 'relative', minWidth: '220px', flex: '0 1 280px' }}>
                <input
                  type="text"
                  placeholder="Search staff name, email, role..."
                  value={staffSearchQuery}
                  onChange={e => setStaffSearchQuery(e.target.value)}
                  style={{ padding: '6px 10px 6px 30px', fontSize: '12.5px', width: '100%' }}
                />
                <i
                  className="fa-solid fa-magnifying-glass"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '11px' }}
                ></i>
              </div>
            </div>

            {/* Hint when viewing active staff while inactive staff exist */}
            {staffDirectoryFilter === 'active' && resignedStaffCount > 0 && (
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  marginBottom: '14px',
                  padding: '8px 12px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-info" style={{ color: 'var(--primary)' }}></i>
                  <span>
                    {resignedStaffCount} inactive/resigned staff account{resignedStaffCount > 1 ? 's are' : ' is'} currently hidden from this active view.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStaffDirectoryFilter('resigned')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline'
                  }}
                >
                  View Inactive Staff ({resignedStaffCount})
                </button>
              </div>
            )}

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Assigned Shift</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No staff members found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredStaffUsers.map(u => {
                      const isDeactivated = u.is_active === false;

                      return (
                        <tr key={u.id} style={{ opacity: isDeactivated ? 0.72 : 1, background: isDeactivated ? 'rgba(239, 68, 68, 0.02)' : undefined }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {u.profile_picture ? (
                                <img
                                  src={`/uploads/avatars/${u.profile_picture}`}
                                  alt={u.name}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    filter: isDeactivated ? 'grayscale(100%)' : 'none'
                                  }}
                                  onError={e => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: isDeactivated ? '#9ca3af' : 'var(--primary)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 600,
                                    fontSize: '12px'
                                  }}
                                >
                                  {u.name.charAt(0)}
                                </div>
                              )}
                              <div>
                                <span style={{ fontWeight: 600, color: isDeactivated ? 'var(--text-muted)' : 'var(--text-primary)' }}>
                                  {u.name}
                                </span>
                                {isDeactivated && (
                                  <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 600 }}>
                                    (Resigned)
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>{u.email}</td>
                          <td>{u.phone || '—'}</td>
                          <td>
                            <span className="badge badge-ok" style={{ textTransform: 'capitalize' }}>
                              {u.role_name.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {u.shift_name ? (
                              <span>
                                {u.shift_name} ({formatShiftTime(u.shift_start)} – {formatShiftTime(u.shift_end)})
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            {u.is_active ? (
                              <span className="badge badge-ok">
                                <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Active
                              </span>
                            ) : (
                              <div>
                                <span
                                  className="badge"
                                  style={{
                                    background: 'rgba(239, 68, 68, 0.12)',
                                    color: '#dc2626',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    fontWeight: 600
                                  }}
                                >
                                  <i className="fa-solid fa-user-slash" style={{ marginRight: '4px' }}></i> Resigned
                                </span>
                                {u.deactivation_reason && (
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={u.deactivation_reason}>
                                    {u.deactivation_reason}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                className="btn-icon btn-icon-view"
                                onClick={() => setViewingStaff(u)}
                                title="View Profile Details"
                              >
                                <i className="fa-solid fa-eye"></i>
                              </button>
                              <button
                                className="btn-icon btn-icon-muted"
                                onClick={() => openEditStaff(u)}
                                title="Edit Staff Member"
                              >
                                <i className="fa-solid fa-pen-to-square"></i>
                              </button>
                              {(currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_users')) && (
                                <>
                                  <button
                                    className="btn-icon"
                                    style={{ color: '#0284c7' }}
                                    onClick={() => {
                                      setModeratingUser(u);
                                      setModerationAvatarUrl(u.profile_picture || 'cashier.png');
                                    }}
                                    title="Edit / Reset User Avatar (Admin Moderation)"
                                  >
                                    <i className="fa-solid fa-image"></i>
                                  </button>
                                  <button
                                    className="btn-icon"
                                    style={{ color: '#f59e0b' }}
                                    onClick={() => {
                                      setResetPasswordUser(u);
                                      setResetPasswordInput('');
                                      setResetSuccessMessage('');
                                    }}
                                    title="Admin Password Reset"
                                  >
                                    <i className="fa-solid fa-key"></i>
                                  </button>
                                </>
                              )}

                              {/* Deactivate / Reactivate Staff Action */}
                              {(currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_users') || hasPermission('delete_staff')) && (
                                <>
                                  {u.is_active ? (
                                    <button
                                      className="btn-icon"
                                      style={{ color: '#ef4444' }}
                                      disabled={u.id === currentUser.id}
                                      onClick={() => {
                                        setDeactivatingStaff(u);
                                        setDeactivationReason('');
                                      }}
                                      title={u.id === currentUser.id ? 'Cannot deactivate your own account' : 'Deactivate Staff Account (Resigned)'}
                                    >
                                      <i className="fa-solid fa-user-slash"></i>
                                    </button>
                                  ) : (
                                    <button
                                      className="btn-icon"
                                      style={{ color: '#10b981' }}
                                      onClick={() => {
                                        setReactivatingStaff(u);
                                      }}
                                      title="Reactivate Staff Account"
                                    >
                                      <i className="fa-solid fa-user-check"></i>
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 2. ATTENDANCE LOG */}
      {staffTab === 'attendance' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Attendance &amp; Register Log</h2>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Full audit trail of clock ins, clock outs, duration, and cash reconciliation differences.
              </p>
            </div>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Cash Difference</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.user_name}</td>
                    <td style={{ fontSize: '12.5px' }}>{r.clock_in}</td>
                    <td style={{ fontSize: '12.5px' }}>{r.clock_out || '—'}</td>
                    <td>{r.duration_hours}h</td>
                    <td>
                      {r.is_open ? (
                        <span className="badge badge-ok">In Progress</span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--bg-color)', color: 'var(--text-muted)' }}>
                          Completed
                        </span>
                      )}
                    </td>
                    <td>
                      {r.cash_difference !== undefined && r.cash_difference !== null ? (
                        r.cash_difference === 0 ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Matched ($0.00)</span>
                        ) : r.cash_difference > 0 ? (
                          <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                            +${r.cash_difference.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--danger)', fontWeight: 600 }}>
                            -${(-r.cash_difference).toFixed(2)}
                          </span>
                        )
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.is_open && hasPermission('manage_users') && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            forceCloseShift(r.id);
                            showFlash(`Active shift for ${r.user_name} force closed.`, 'info');
                          }}
                          title="Force close if staff forgot to clock out"
                        >
                          Force Close
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. TASKS */}
      {staffTab === 'tasks' && (
        <TasksView embedded={true} />
      )}
      {false && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>
                <i className="fa-solid fa-list-check" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                Team Task Assignments ({tasks.filter(t => t.status === 'pending').length} pending)
              </h2>
              <p className="subtitle" style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Assign and track operational duties delegated from supervisors to staff members.
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowTaskModal(true)}>
              <i className="fa-solid fa-plus"></i> Assign New Task
            </button>
          </div>

          {/* Task Filters Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              padding: '12px',
              background: 'var(--bg-color)',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              marginBottom: '18px',
              alignItems: 'center'
            }}
          >
            {/* Search */}
            <div style={{ flex: '1 1 180px', minWidth: '160px' }}>
              <input
                type="text"
                placeholder="Search title, staff..."
                value={taskSearch}
                onChange={e => setTaskSearch(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '12.5px', width: '100%' }}
              />
            </div>

            {/* Status filter */}
            <div style={{ flex: '0 0 auto' }}>
              <select
                value={taskFilterStatus}
                onChange={e => setTaskFilterStatus(e.target.value as any)}
                style={{ padding: '7px 10px', fontSize: '12.5px' }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending ({tasks.filter(t => t.status === 'pending').length})</option>
                <option value="completed">Completed ({tasks.filter(t => t.status === 'completed').length})</option>
              </select>
            </div>

            {/* Assigner filter */}
            <div style={{ flex: '0 0 auto' }}>
              <select
                value={taskFilterAssigner}
                onChange={e => setTaskFilterAssigner(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '12.5px' }}
              >
                <option value="all">Assigned By: Anyone</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    By: {u.name} ({u.role_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee filter */}
            <div style={{ flex: '0 0 auto' }}>
              <select
                value={taskFilterAssignee}
                onChange={e => setTaskFilterAssignee(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '12.5px' }}
              >
                <option value="all">Assigned To: All Staff</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    To: {u.name} ({u.role_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Priority filter */}
            <div style={{ flex: '0 0 auto' }}>
              <select
                value={taskFilterPriority}
                onChange={e => setTaskFilterPriority(e.target.value)}
                style={{ padding: '7px 10px', fontSize: '12.5px' }}
              >
                <option value="all">All Priorities</option>
                <option value="urgent">🔥 Urgent</option>
                <option value="high">⚡ High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {(taskSearch || taskFilterStatus !== 'all' || taskFilterAssigner !== 'all' || taskFilterAssignee !== 'all' || taskFilterPriority !== 'all') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setTaskSearch('');
                  setTaskFilterStatus('all');
                  setTaskFilterAssigner('all');
                  setTaskFilterAssignee('all');
                  setTaskFilterPriority('all');
                }}
                style={{ fontSize: '11px', padding: '6px 10px' }}
              >
                Reset Filters
              </button>
            )}
          </div>

          {filteredTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-clipboard-check" style={{ fontSize: '36px', marginBottom: '12px', opacity: 0.4 }}></i>
              <p style={{ margin: '0 0 12px', fontSize: '14px' }}>No tasks found matching your filter criteria.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTaskModal(true)}>
                <i className="fa-solid fa-plus"></i> Assign New Task
              </button>
            </div>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Task &amp; Details</th>
                    <th>Assignment Flow (By &rarr; To)</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(t => {
                    const assigner = users.find(u => u.id === t.assigned_by);
                    const assignee = users.find(u => u.id === t.assigned_to);

                    const priorityColor =
                      t.priority === 'urgent'
                        ? { bg: 'rgba(239, 68, 68, 0.12)', text: 'var(--danger)', label: '🔥 Urgent' }
                        : t.priority === 'high'
                        ? { bg: 'rgba(245, 158, 11, 0.14)', text: '#D97706', label: '⚡ High' }
                        : t.priority === 'low'
                        ? { bg: 'rgba(107, 114, 128, 0.12)', text: 'var(--text-muted)', label: 'Low' }
                        : { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563EB', label: 'Medium' };

                    return (
                      <tr key={t.id}>
                        <td style={{ maxWidth: '300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span
                              style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 700,
                                background: priorityColor.bg,
                                color: priorityColor.text,
                                textTransform: 'uppercase'
                              }}
                            >
                              {priorityColor.label}
                            </span>
                            {t.due_date && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <i className="fa-regular fa-clock"></i> {t.due_date}
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text-dark)' }}>
                            {t.title}
                          </div>
                          {t.description && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.4' }}>
                              {t.description}
                            </div>
                          )}
                        </td>

                        {/* Assignment Flow (By User ➔ To User) */}
                        <td>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '6px 10px',
                              background: 'var(--bg-color)',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            {/* Assigner */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <img
                                src={getAvatarSrc(assigner?.profile_picture)}
                                alt={t.assigned_by_name}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1.5px solid var(--border-color)'
                                }}
                                onError={e => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)', lineHeight: 1.1 }}>
                                  {t.assigned_by_name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                  {assigner?.role_name || 'Staff'} (by)
                                </div>
                              </div>
                            </div>

                            {/* Arrow */}
                            <div style={{ color: 'var(--primary)', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                              <i className="fa-solid fa-arrow-right"></i>
                            </div>

                            {/* Assignee */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <img
                                src={getAvatarSrc(assignee?.profile_picture)}
                                alt={t.assigned_to_name}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1.5px solid var(--primary)'
                                }}
                                onError={e => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div>
                                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', lineHeight: 1.1 }}>
                                  {t.assigned_to_name}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                                  {assignee?.role_name || 'Staff'} (to)
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {t.created_at.slice(0, 16)}
                        </td>

                        <td>
                          {t.status === 'completed' ? (
                            <span className="badge badge-ok" title={t.completed_at ? `Completed: ${t.completed_at}` : undefined}>
                              ✓ Completed
                            </span>
                          ) : (
                            <span className="badge badge-low">
                              ⏳ Pending
                            </span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {t.status === 'pending' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => completeTask(t.id)}
                                title="Mark completed"
                                style={{ padding: '5px 10px', fontSize: '12px' }}
                              >
                                <i className="fa-solid fa-check"></i> Complete
                              </button>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                deleteTask(t.id);
                                showFlash(`Task "${t.title}" deleted.`, 'info');
                              }}
                              title="Delete task"
                              style={{ padding: '5px 8px', fontSize: '12px', color: 'var(--danger)' }}
                            >
                              <i className="fa-solid fa-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4. SHIFTS */}
      {staffTab === 'shifts' && (
        <div className="card">
          <h2 style={{ margin: '0 0 16px' }}>Shift Schedules &amp; Templates</h2>
          <div className="card-grid">
            {shifts.map(s => (
              <div key={s.id} className="stat-card">
                <div className="stat-label">
                  <i className="fa-solid fa-clock"></i> {s.name} Shift
                </div>
                <div className="stat-value" style={{ fontSize: '20px', marginTop: '10px' }}>
                  {formatShiftTime(s.start_time)} – {formatShiftTime(s.end_time)}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Assigned Staff:{' '}
                  {users.filter(u => u.shift_name === s.name).map(u => u.name).join(', ') || 'None'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. DYNAMIC RBAC GOVERNANCE */}
      {staffTab === 'permissions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top RBAC Header Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-shield-halved" style={{ color: 'var(--primary)' }}></i>
                  Role-Based Access Control (RBAC) Governance
                </h2>
                <p className="subtitle" style={{ margin: '6px 0 0' }}>
                  Manage dynamic roles, permission registry, role capability matrices, and employee assignments in real time with zero code redeployments.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setNewRoleForm({ name: '', description: '' });
                    setShowNewRoleModal(true);
                  }}
                >
                  <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                  New Role
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setNewPermForm({ name: '', description: '' });
                    setShowNewPermModal(true);
                  }}
                >
                  <i className="fa-solid fa-key" style={{ marginRight: '6px' }}></i>
                  New Permission
                </button>
              </div>
            </div>

            {/* Quick Stat Cards */}
            <div className="card-grid" style={{ marginBottom: '20px' }}>
              <div className="stat-card">
                <div className="stat-label">
                  <i className="fa-solid fa-user-shield"></i> Total Roles
                </div>
                <div className="stat-value">{roles.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {roles.filter(r => !r.is_system).length} custom dynamic roles
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <i className="fa-solid fa-lock"></i> Registered Permissions
                </div>
                <div className="stat-value">{permissionsList.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {permissionsList.filter(p => !p.is_system).length} custom dynamic permissions
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <i className="fa-solid fa-users"></i> Staff Members
                </div>
                <div className="stat-value">{users.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Assigned across {roles.length} role tiers
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">
                  <i className="fa-solid fa-shield-check"></i> Security Guard
                </div>
                <div className="stat-value" style={{ fontSize: '18px', color: 'var(--success)' }}>
                  Active Lockout Protection
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Admin role &amp; manage_roles safeguarded
                </div>
              </div>
            </div>

            {/* RBAC View Mode Switcher */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button
                type="button"
                className={`category-pill ${rbacViewMode === 'matrix' ? 'active' : ''}`}
                onClick={() => setRbacViewMode('matrix')}
              >
                <i className="fa-solid fa-table-cells" style={{ marginRight: '6px' }}></i>
                Security Capability Matrix
              </button>
              <button
                type="button"
                className={`category-pill ${rbacViewMode === 'roles' ? 'active' : ''}`}
                onClick={() => setRbacViewMode('roles')}
              >
                <i className="fa-solid fa-id-badge" style={{ marginRight: '6px' }}></i>
                Manage Roles ({roles.length})
              </button>
              <button
                type="button"
                className={`category-pill ${rbacViewMode === 'permissions' ? 'active' : ''}`}
                onClick={() => setRbacViewMode('permissions')}
              >
                <i className="fa-solid fa-list-check" style={{ marginRight: '6px' }}></i>
                Permissions Catalog ({permissionsList.length})
              </button>
              <button
                type="button"
                className={`category-pill ${rbacViewMode === 'staff' ? 'active' : ''}`}
                onClick={() => setRbacViewMode('staff')}
              >
                <i className="fa-solid fa-user-gear" style={{ marginRight: '6px' }}></i>
                Staff Role Assignments &amp; Server RBAC
              </button>
            </div>
          </div>

          {/* VIEW 1: ROLE X PERMISSION CAPABILITY MATRIX */}
          {rbacViewMode === 'matrix' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Role x Permission Capability Matrix</h3>
                  <p className="subtitle" style={{ margin: '4px 0 0' }}>
                    Click any checkbox to grant or revoke capabilities. Every grant or revocation prompts for double-check confirmation.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '4px 10px' }}>
                    <i className="fa-solid fa-shield-check"></i> Double-Check Confirmation Active
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-lock" style={{ marginRight: '3px' }}></i> Lockout protection active
                  </span>
                </div>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '220px' }}>Permission / Capability</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Scope</th>
                      {roles.map(r => {
                        const count = (rolePermissions[r.name] || []).length;
                        return (
                          <th key={r.id} style={{ textAlign: 'center', minWidth: '110px' }}>
                            <div style={{ fontWeight: 600 }}>{r.display_name || r.name}</div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                              {count} grant{count === 1 ? '' : 's'}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {permissionsList.map(perm => {
                      return (
                        <tr key={perm.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>
                              {perm.display_name || perm.name.replace(/_/g, ' ')}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              {perm.name}
                            </div>
                            {perm.description && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {perm.description}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className={`badge ${perm.is_system ? 'badge-info' : 'badge-ok'}`}
                              style={{ fontSize: '10px' }}
                            >
                              {perm.is_system ? 'System' : 'Custom'}
                            </span>
                          </td>
                          {roles.map(role => {
                            const isGranted = (rolePermissions[role.name] || []).includes(perm.name);
                            const isProtectedAdminRole = role.name === 'admin' && perm.name === 'manage_roles';

                            return (
                              <td key={role.id} style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isGranted}
                                  onChange={() => handleInitiateRolePermissionToggle(role.name, role.display_name || role.name, perm, isGranted)}
                                  disabled={isProtectedAdminRole && isGranted && Object.values(rolePermissions).filter(p => p.includes('manage_roles')).length <= 1}
                                  title={
                                    isProtectedAdminRole
                                      ? 'Core security lock: At least one role must retain manage_roles'
                                      : `Click to ${isGranted ? 'revoke' : 'grant'} ${perm.name} for ${role.display_name || role.name}`
                                  }
                                  style={{
                                    cursor: isProtectedAdminRole ? 'not-allowed' : 'pointer',
                                    width: '18px',
                                    height: '18px',
                                    accentColor: 'var(--primary)'
                                  }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 2: MANAGE ROLES */}
          {rbacViewMode === 'roles' && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Roles Management</h3>
                  <p className="subtitle" style={{ margin: '4px 0 0' }}>
                    Create custom organizational roles, rename them, and manage role lifecycles.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setNewRoleForm({ name: '', description: '' });
                    setShowNewRoleModal(true);
                  }}
                >
                  <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                  Create Role
                </button>
              </div>

              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>Role Name</th>
                      <th>Identifier</th>
                      <th>Description</th>
                      <th>Assigned Staff</th>
                      <th>Capabilities</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roles.map(role => {
                      const assignedUsers = users.filter(u => u.role_name === role.name || u.role_id === role.id);
                      const grantedPermsCount = (rolePermissions[role.name] || []).length;
                      const isSystemAdmin = role.name === 'admin';

                      return (
                        <tr key={role.id}>
                          <td>#{role.id}</td>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{role.display_name || role.name}</span>
                              {role.is_system ? (
                                <span className="badge badge-info" style={{ fontSize: '10px' }}>System</span>
                              ) : (
                                <span className="badge badge-ok" style={{ fontSize: '10px' }}>Dynamic</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <code style={{ fontSize: '12px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                              {role.name}
                            </code>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {role.description || '—'}
                          </td>
                          <td>
                            {assignedUsers.length > 0 ? (
                              <div>
                                <span className="badge badge-ok" style={{ fontSize: '11px' }}>
                                  {assignedUsers.length} staff
                                </span>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {assignedUsers.map(u => u.name).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>0 assigned</span>
                            )}
                          </td>
                          <td>
                            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                              {grantedPermsCount} permission{grantedPermsCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={isSystemAdmin}
                                title={isSystemAdmin ? 'The root admin role cannot be renamed' : 'Rename Role'}
                                onClick={() => setEditingRole({ id: role.id, name: role.display_name || role.name })}
                              >
                                <i className="fa-solid fa-pen"></i>
                              </button>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                disabled={isSystemAdmin || assignedUsers.length > 0}
                                title={
                                  isSystemAdmin
                                    ? 'The root admin role cannot be deleted'
                                    : assignedUsers.length > 0
                                    ? `Cannot delete role while ${assignedUsers.length} staff member(s) are assigned`
                                    : 'Delete Role'
                                }
                                onClick={() => {
                                  deleteRole(role.id);
                                }}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 3: MANAGE PERMISSIONS (2-COLUMN REGISTRY & CREATION) */}
          {rbacViewMode === 'permissions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Header */}
              <div className="card" style={{ padding: '16px 20px', marginBottom: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-shield-halved" style={{ color: 'var(--primary)' }}></i>
                      Permission registry
                    </h3>
                    <p className="subtitle" style={{ margin: '4px 0 0', fontSize: '12.5px' }}>
                      Inspect granular security capability tokens used for server-side endpoint protection.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-info" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                      {permissionsList.length} Total Capabilities
                    </span>
                    <span className="badge badge-neutral" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                      {permissionsList.filter(p => p.is_system).length} System Core
                    </span>
                  </div>
                </div>
              </div>

              {/* 2-Column Grid: Left = Table Registry, Right = + New Permission Card */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 340px',
                  gap: '16px',
                  alignItems: 'start'
                }}
              >
                {/* Left Column: Permission Registry Table */}
                <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                      <input
                        type="text"
                        placeholder="Search capability tokens or descriptions..."
                        value={permRegistrySearch}
                        onChange={e => setPermRegistrySearch(e.target.value)}
                        style={{ paddingLeft: '32px', fontSize: '12.5px' }}
                      />
                      <i
                        className="fa-solid fa-magnifying-glass"
                        style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }}
                      ></i>
                    </div>
                    {permRegistrySearch && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setPermRegistrySearch('')}
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>ID</th>
                          <th>Permission code</th>
                          <th>Description</th>
                          <th>Inherited by roles</th>
                          <th style={{ textAlign: 'right', width: '90px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permissionsList
                          .filter(p => {
                            if (!permRegistrySearch) return true;
                            const query = permRegistrySearch.toLowerCase();
                            return (
                              p.name.toLowerCase().includes(query) ||
                              (p.display_name && p.display_name.toLowerCase().includes(query)) ||
                              (p.description && p.description.toLowerCase().includes(query))
                            );
                          })
                          .map(perm => {
                            const rolesHolding = roles.filter(r => (rolePermissions[r.name] || []).includes(perm.name));
                            const isLocked = perm.is_system || perm.name === 'manage_roles';

                            return (
                              <tr key={perm.id}>
                                <td style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600 }}>
                                  #{perm.id}
                                </td>
                                <td>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 600 }}>
                                    <i className="fa-regular fa-eye" style={{ color: 'var(--primary)', fontSize: '11px' }}></i>
                                    <span>{perm.name}</span>
                                  </div>
                                </td>
                                <td style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                                  {perm.description || '—'}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {rolesHolding.map(r => (
                                      <span
                                        key={r.id}
                                        className="badge badge-neutral"
                                        style={{ fontSize: '10px', textTransform: 'capitalize' }}
                                      >
                                        {r.display_name || r.name}
                                      </span>
                                    ))}
                                    {rolesHolding.length === 0 && (
                                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                        None (unassigned)
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {isLocked ? (
                                    <span
                                      className="badge badge-neutral"
                                      style={{ fontSize: '10px', color: 'var(--text-muted)' }}
                                      title="System Core protected capability token"
                                    >
                                      <i className="fa-solid fa-lock" style={{ marginRight: '3px' }}></i> Core
                                    </span>
                                  ) : (
                                    <div style={{ display: 'inline-flex', gap: '5px' }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        title="Edit Permission"
                                        onClick={() => setEditingPerm({ id: perm.id, name: perm.name, description: perm.description || '' })}
                                        style={{ padding: '3px 7px', fontSize: '11px' }}
                                      >
                                        <i className="fa-solid fa-pen"></i>
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-danger btn-sm"
                                        title="Delete Permission"
                                        onClick={() => {
                                          deletePermission(perm.id);
                                        }}
                                        style={{ padding: '3px 7px', fontSize: '11px' }}
                                      >
                                        <i className="fa-solid fa-trash-can"></i>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right Column: "+ New permission" Card matching Image 1 */}
                <div className="card" style={{ padding: '20px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-plus-circle" style={{ color: 'var(--primary)', fontSize: '15px' }}></i>
                      + New permission
                    </h3>
                    <p className="subtitle" style={{ margin: '3px 0 0', fontSize: '12px' }}>
                      Register capability token for endpoint authorization.
                    </p>
                  </div>

                  <form
                    onSubmit={e => {
                      e.preventDefault();
                      if (!newPermForm.name.trim()) return;
                      try {
                        createPermission(newPermForm.name.trim(), newPermForm.description.trim(), newPermInheritRoles);
                        setNewPermForm({ name: '', description: '' });
                        setNewPermInheritRoles(['admin']);
                      } catch (err: any) {
                        // Handled in createPermission
                      }
                    }}
                  >
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                        Permission code <span style={{ color: 'var(--danger)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. pos.sales.discounts, inventory.bulk_import"
                        value={newPermForm.name}
                        onChange={e => setNewPermForm({ ...newPermForm, name: e.target.value })}
                        style={{ width: '100%', fontFamily: 'monospace', fontSize: '13px' }}
                      />
                      {newPermForm.name.trim() ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Normalized code: <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{newPermForm.name.trim().toLowerCase().replace(/\s+/g, '_')}</code>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Use dot or underscore naming (e.g. <code>pos.discounts</code>, <code>report.export</code>).
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                        Description
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Describe exact business capability (e.g. Authorizes staff to approve custom price markdowns, issue manual vouchers, or audit financial ledgers)..."
                        value={newPermForm.description}
                        onChange={e => setNewPermForm({ ...newPermForm, description: e.target.value })}
                        style={{ width: '100%', resize: 'vertical', fontSize: '12.5px' }}
                      />
                    </div>

                    {/* Role Classes Inheritance */}
                    <div style={{ marginBottom: '18px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>
                        <i className="fa-solid fa-sitemap" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
                        Role Classes Inheritance
                      </label>
                      <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        Select which role classes automatically inherit this capability token upon registration:
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {roles.map(r => {
                          const isAdmin = r.name === 'admin';
                          const isChecked = isAdmin || newPermInheritRoles.includes(r.name);

                          return (
                            <label
                              key={r.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                fontSize: '12.5px',
                                cursor: isAdmin ? 'not-allowed' : 'pointer',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                margin: 0,
                                background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--card-bg)',
                                border: isChecked ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid var(--border-color)',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <input
                                type="checkbox"
                                disabled={isAdmin}
                                checked={isChecked}
                                onChange={e => {
                                  if (isAdmin) return;
                                  if (e.target.checked) {
                                    setNewPermInheritRoles(prev => [...prev, r.name]);
                                  } else {
                                    setNewPermInheritRoles(prev => prev.filter(name => name !== r.name));
                                  }
                                }}
                                style={{ width: '16px', height: '16px', flexShrink: 0, margin: 0 }}
                              />
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                                {r.display_name || r.name.replace(/_/g, ' ')}
                              </span>
                              {isAdmin ? (
                                <span className="badge badge-neutral" style={{ fontSize: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                  <i className="fa-solid fa-lock" style={{ marginRight: '4px' }}></i> Always
                                </span>
                              ) : isChecked ? (
                                <span className="badge badge-ok" style={{ fontSize: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                  Inherited
                                </span>
                              ) : null}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '10px 14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <i className="fa-solid fa-plus"></i>
                      Register permission
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: STAFF ROLE ASSIGNMENTS & SERVER RBAC ENFORCEMENT */}
          {rbacViewMode === 'staff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* RBAC Core Principles Banner */}
              <div
                className="card"
                style={{
                  background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05), rgba(79, 70, 229, 0.03))',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  padding: '20px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'var(--primary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0
                    }}
                  >
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
                      Enterprise Server-Side RBAC Architecture
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                      Access control is enforced strictly on the server: <code>user → role → permissions</code>. The UI reflects permissions for convenience only.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'var(--card-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--primary)', marginBottom: '4px' }}>
                      <i className="fa-solid fa-server" style={{ marginRight: '6px' }}></i>1. Server-Side Checks
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Protected API endpoints call <code>requirePermission(...)</code>. Unauthorized requests return HTTP 403 Forbidden.
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--primary)', marginBottom: '4px' }}>
                      <i className="fa-solid fa-diagram-project" style={{ marginRight: '6px' }}></i>2. Roles Map to Permissions
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Permissions are assigned exclusively to roles. Roles specify exactly which capabilities their members inherit.
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--primary)', marginBottom: '4px' }}>
                      <i className="fa-solid fa-user-tag" style={{ marginRight: '6px' }}></i>3. Users Map to Roles Only
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      No per-user permission overrides. Users hold a <code>role_name</code>, and permissions resolve automatically.
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--primary)', marginBottom: '4px' }}>
                      <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '6px' }}></i>4. Role Updates Only
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                      Promoting or reassigning a user's role is the only valid mechanism to alter capabilities.
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Server-Side RBAC Enforcement Tester */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <i className="fa-solid fa-terminal" style={{ color: 'var(--primary)' }}></i>
                      Server-Side RBAC Live Endpoint Tester
                    </h3>
                    <p className="subtitle" style={{ margin: '4px 0 0', fontSize: '12.5px' }}>
                      Verify server-side enforcement right now. Tests fire real HTTP requests with your active token (<strong>{currentUser.name}</strong> &bull; Role: <code>{currentUser.role_name}</code>).
                    </p>
                  </div>
                  <span className="badge badge-ok" style={{ fontSize: '12px', padding: '4px 10px' }}>
                    Active User Role: {currentUser.role_name}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                  {[
                    { code: 'process_sales', label: 'process_sales (Cashier/Admin)' },
                    { code: 'view_products', label: 'view_products (All)' },
                    { code: 'manage_products', label: 'manage_products (Admin/Mgr)' },
                    { code: 'adjust_stock', label: 'adjust_stock (Admin/Mgr)' },
                    { code: 'process_refund', label: 'process_refund (Admin/Mgr)' },
                    { code: 'manage_users', label: 'manage_users (Admin only)' },
                    { code: 'manage_roles', label: 'manage_roles (Admin only)' },
                    { code: 'view_reports', label: 'view_reports (Admin/Mgr)' }
                  ].map(item => (
                    <button
                      key={item.code}
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '12px', padding: '6px 12px' }}
                      disabled={testResult?.loading}
                      onClick={() => handleRunServerPermissionTest(item.code)}
                    >
                      <i className="fa-solid fa-paper-plane" style={{ marginRight: '6px', opacity: 0.7 }}></i>
                      Test <code>{item.code}</code>
                    </button>
                  ))}
                </div>

                {testResult && (
                  <div
                    style={{
                      background: testResult.loading
                        ? 'var(--bg-secondary)'
                        : testResult.allowed
                        ? 'rgba(16, 185, 129, 0.08)'
                        : 'rgba(239, 68, 68, 0.08)',
                      border: `1px solid ${
                        testResult.loading
                          ? 'var(--border-color)'
                          : testResult.allowed
                          ? 'rgba(16, 185, 129, 0.3)'
                          : 'rgba(239, 68, 68, 0.3)'
                      }`,
                      borderRadius: '8px',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '18px',
                        color: testResult.loading
                          ? 'var(--text-muted)'
                          : testResult.allowed
                          ? 'var(--success)'
                          : 'var(--danger)'
                      }}
                    >
                      {testResult.loading ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                      ) : testResult.allowed ? (
                        <i className="fa-solid fa-circle-check"></i>
                      ) : (
                        <i className="fa-solid fa-circle-xmark"></i>
                      )}
                    </div>
                    <div style={{ flex: 1, fontSize: '13px' }}>
                      <div style={{ fontWeight: 600 }}>
                        Endpoint Test: <code>requirePermission('{testResult.permission}')</code>
                      </div>
                      <div style={{ color: testResult.allowed ? 'var(--success)' : 'var(--danger)', marginTop: '2px' }}>
                        {testResult.loading
                          ? 'Dispatching request to server...'
                          : testResult.allowed
                          ? testResult.message
                          : testResult.error}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Role Assignments Table */}
              <div className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Staff Role Assignments &amp; Inherited Capabilities</h3>
                    <p className="subtitle" style={{ margin: '4px 0 0', fontSize: '12.5px' }}>
                      Change a staff member's role to alter their capabilities. All role promotions trigger a double-check confirmation alert.
                    </p>
                  </div>
                  <span className="badge badge-ok" style={{ fontSize: '11.5px', padding: '4px 10px' }}>
                    <i className="fa-solid fa-check-double" style={{ marginRight: '4px' }}></i> Double-Check Promotion Active
                  </span>
                </div>

                <div className="table-responsive">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ minWidth: '180px' }}>Staff Member</th>
                        <th style={{ minWidth: '160px' }}>Assigned Role</th>
                        <th style={{ minWidth: '320px' }}>Resolved Capabilities via Role</th>
                        <th style={{ textAlign: 'center', width: '130px' }}>Access Model</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => {
                        const inheritedPerms = rolePermissions[u.role_name] || [];
                        const roleObj = roles.find(r => r.name === u.role_name);

                        return (
                          <tr key={u.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '34px',
                                    height: '34px',
                                    borderRadius: '50%',
                                    background: 'var(--primary)',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '13px'
                                  }}
                                >
                                  {u.avatar_url ? (
                                    <img
                                      src={u.avatar_url}
                                      alt={u.name}
                                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                    />
                                  ) : (
                                    u.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <select
                                value={u.role_name}
                                onChange={e => handleInitiateRoleChange(u, e.target.value)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  borderRadius: '6px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-input)',
                                  color: 'var(--text-primary)',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {roles.map(r => (
                                  <option key={r.id} value={r.name}>
                                    {r.display_name || r.name.replace(/_/g, ' ')}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '420px' }}>
                                {inheritedPerms.map(pCode => (
                                  <span
                                    key={pCode}
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 8px',
                                      background: 'var(--bg-secondary)',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-color)',
                                      fontFamily: 'monospace',
                                      color: 'var(--text-primary)'
                                    }}
                                  >
                                    {pCode}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                className="badge badge-ok"
                                style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              >
                                <i className="fa-solid fa-shield"></i> Role-Inherited
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREATE NEW ROLE */}
      {showNewRoleModal && (
        <div className="modal-overlay" onClick={() => setShowNewRoleModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-user-shield" style={{ color: 'var(--primary)' }}></i>
                Create New Role
              </h3>
              <button className="qty-remove" onClick={() => setShowNewRoleModal(false)}>&times;</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!newRoleForm.name.trim()) return;
                try {
                  createRole(newRoleForm.name.trim(), newRoleForm.description.trim());
                  setShowNewRoleModal(false);
                  setNewRoleForm({ name: '', description: '' });
                } catch (err: any) {
                  // Error flash handled in createRole
                }
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  Role Name: <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supervisor, Auditor, Head Chef"
                  value={newRoleForm.name}
                  onChange={e => setNewRoleForm({ ...newRoleForm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Identifier preview: <code>{newRoleForm.name.trim().toLowerCase().replace(/\s+/g, '_') || 'role_code'}</code>
                </div>
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  Description:
                </label>
                <textarea
                  rows={3}
                  placeholder="Role responsibilities and operational scope..."
                  value={newRoleForm.description}
                  onChange={e => setNewRoleForm({ ...newRoleForm, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewRoleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                  Create Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT / RENAME ROLE */}
      {editingRole && (
        <div className="modal-overlay" onClick={() => setEditingRole(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0 }}>Rename Role</h3>
              <button className="qty-remove" onClick={() => setEditingRole(null)}>&times;</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!editingRole.name.trim()) return;
                updateRole(editingRole.id, editingRole.name.trim());
                setEditingRole(null);
              }}
            >
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  New Role Name:
                </label>
                <input
                  type="text"
                  required
                  value={editingRole.name}
                  onChange={e => setEditingRole({ ...editingRole, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingRole(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE NEW PERMISSION */}
      {showNewPermModal && (
        <div className="modal-overlay" onClick={() => setShowNewPermModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-key" style={{ color: 'var(--primary)' }}></i>
                Register New Permission
              </h3>
              <button className="qty-remove" onClick={() => setShowNewPermModal(false)}>&times;</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!newPermForm.name.trim()) return;
                try {
                  createPermission(newPermForm.name.trim(), newPermForm.description.trim(), newPermInheritRoles);
                  setShowNewPermModal(false);
                  setNewPermForm({ name: '', description: '' });
                  setNewPermInheritRoles(['admin']);
                } catch (err: any) {
                  // Error handled in createPermission
                }
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  Permission code: <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. pos.sales.discounts, inventory.bulk_import"
                  value={newPermForm.name}
                  onChange={e => setNewPermForm({ ...newPermForm, name: e.target.value })}
                  style={{ width: '100%', fontFamily: 'monospace' }}
                />
                {newPermForm.name.trim() ? (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Normalized code: <code style={{ color: 'var(--primary)', fontWeight: 700 }}>{newPermForm.name.trim().toLowerCase().replace(/\s+/g, '_')}</code>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Use dot or underscore naming (e.g. <code>pos.discounts</code>, <code>report.export</code>).
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  Description:
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe exact business capability (e.g. Authorizes staff to approve custom price markdowns, issue manual vouchers, or audit financial ledgers)..."
                  value={newPermForm.description}
                  onChange={e => setNewPermForm({ ...newPermForm, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              {/* Role Classes Inheritance */}
              <div style={{ marginBottom: '16px', padding: '14px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px', color: 'var(--text-primary)' }}>
                  <i className="fa-solid fa-sitemap" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
                  Role Classes Inheritance
                </label>
                <p style={{ margin: '0 0 10px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Select role classes that will immediately inherit this permission:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {roles.map(r => {
                    const isAdmin = r.name === 'admin';
                    const isChecked = isAdmin || newPermInheritRoles.includes(r.name);

                    return (
                      <label
                        key={r.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '12.5px',
                          cursor: isAdmin ? 'not-allowed' : 'pointer',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          margin: 0,
                          background: isChecked ? 'rgba(99, 102, 241, 0.08)' : 'var(--card-bg)',
                          border: isChecked ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid var(--border-color)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          disabled={isAdmin}
                          checked={isChecked}
                          onChange={e => {
                            if (isAdmin) return;
                            if (e.target.checked) {
                              setNewPermInheritRoles(prev => [...prev, r.name]);
                            } else {
                              setNewPermInheritRoles(prev => prev.filter(name => name !== r.name));
                            }
                          }}
                          style={{ width: '16px', height: '16px', flexShrink: 0, margin: 0 }}
                        />
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                          {r.display_name || r.name.replace(/_/g, ' ')}
                        </span>
                        {isAdmin ? (
                          <span className="badge badge-neutral" style={{ fontSize: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            <i className="fa-solid fa-lock" style={{ marginRight: '4px' }}></i> Always
                          </span>
                        ) : isChecked ? (
                          <span className="badge badge-ok" style={{ fontSize: '10px', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                            Inherited
                          </span>
                        ) : null}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewPermModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
                  Register permission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT PERMISSION */}
      {editingPerm && (
        <div className="modal-overlay" onClick={() => setEditingPerm(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0 }}>Edit Permission</h3>
              <button className="qty-remove" onClick={() => setEditingPerm(null)}>&times;</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!editingPerm.name.trim()) return;
                updatePermission(editingPerm.id, editingPerm.name.trim(), editingPerm.description.trim());
                setEditingPerm(null);
              }}
            >
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  Permission Name / Code:
                </label>
                <input
                  type="text"
                  required
                  value={editingPerm.name}
                  onChange={e => setEditingPerm({ ...editingPerm, name: e.target.value })}
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px' }}>
                  Description:
                </label>
                <textarea
                  rows={3}
                  value={editingPerm.description}
                  onChange={e => setEditingPerm({ ...editingPerm, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditingPerm(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Add/Edit Modal */}
      {showStaffModal && (
        <div className="modal-overlay" onClick={() => setShowStaffModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>{editingStaff ? 'Edit Staff Member' : 'New Staff Member'}</h2>
                <p className="subtitle" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                  Configure account credentials, base role, and custom individual permission grants.
                </p>
              </div>
              <button className="qty-remove" onClick={() => setShowStaffModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveStaff}>
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Full Name:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sokha Meng"
                  value={staffForm.name}
                  onChange={e => setStaffForm({ ...staffForm, name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Email:</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. sokha.meng@retailpos.com"
                    value={staffForm.email}
                    onChange={e => setStaffForm({ ...staffForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Phone:</label>
                  <input
                    type="text"
                    placeholder="e.g. +855 12 345 678"
                    value={staffForm.phone}
                    onChange={e => setStaffForm({ ...staffForm, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Base Role:</label>
                  <select
                    value={staffForm.role_name}
                    onChange={e => setStaffForm({ ...staffForm, role_name: e.target.value as RoleName })}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.name}>
                        {r.display_name || r.name.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Assigned Shift:</label>
                  <select
                    value={staffForm.shift_name}
                    onChange={e => setStaffForm({ ...staffForm, shift_name: e.target.value })}
                  >
                    {shifts.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Account Employment Status:
                </label>
                <select
                  value={staffForm.is_active ? 'active' : 'inactive'}
                  onChange={e => setStaffForm({ ...staffForm, is_active: e.target.value === 'active' })}
                  disabled={editingStaff?.id === currentUser.id}
                  style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                >
                  <option value="active">Active (Employed &amp; Access Enabled)</option>
                  <option value="inactive">Deactivated / Resigned (Login &amp; Operations Disabled)</option>
                </select>
                {editingStaff?.id === currentUser.id && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                    You cannot deactivate your own currently active account.
                  </div>
                )}
              </div>

              {/* DEDICATED INDIVIDUAL PERMISSION GRANTS SECTION */}
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <i className="fa-solid fa-user-shield" style={{ color: 'var(--primary)' }}></i>
                      Individual Permission Overrides &amp; Grants
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      Grant specific security capabilities directly to this individual user on top of their role (<code>{staffForm.role_name}</code>).
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => {
                        const allPermNames = permissionsList.map(p => p.name);
                        setStaffExtraPermissions(allPermNames);
                      }}
                    >
                      Grant All
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                      onClick={() => setStaffExtraPermissions([])}
                    >
                      Reset Overrides
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '10px' }}>
                  <div style={{ fontSize: '11.5px' }}>
                    {staffExtraPermissions.length > 0 ? (
                      <span className="badge badge-ok" style={{ fontSize: '11px' }}>
                        <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i>
                        {staffExtraPermissions.length} individual override grant{staffExtraPermissions.length === 1 ? '' : 's'} active
                      </span>
                    ) : (
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        No user-specific overrides (strictly inherits {staffForm.role_name} permissions)
                      </span>
                    )}
                  </div>
                  <div style={{ position: 'relative', width: '220px' }}>
                    <input
                      type="text"
                      placeholder="Filter by name or token..."
                      value={staffPermFilter}
                      onChange={e => setStaffPermFilter(e.target.value)}
                      style={{ padding: '4px 8px 4px 24px', fontSize: '11.5px', borderRadius: '4px' }}
                    />
                    <i
                      className="fa-solid fa-magnifying-glass"
                      style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', color: 'var(--text-muted)' }}
                    ></i>
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '6px',
                    background: 'var(--bg-secondary)'
                  }}
                >
                  {permissionsList
                    .filter(p => !staffPermFilter || p.name.toLowerCase().includes(staffPermFilter.toLowerCase()) || (p.display_name && p.display_name.toLowerCase().includes(staffPermFilter.toLowerCase())))
                    .map(perm => {
                      const isRoleInherited = (rolePermissions[staffForm.role_name] || []).includes(perm.name);
                      const isIndividuallyGranted = staffExtraPermissions.includes(perm.name);
                      const isEffective = isRoleInherited || isIndividuallyGranted;

                      return (
                        <label
                          key={perm.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            margin: '2px 0',
                            cursor: 'pointer',
                            background: isIndividuallyGranted
                              ? 'rgba(16, 185, 129, 0.12)'
                              : isRoleInherited
                              ? 'rgba(59, 130, 246, 0.05)'
                              : 'transparent',
                            border: isIndividuallyGranted
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : '1px solid transparent'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <input
                              type="checkbox"
                              checked={isEffective}
                              onChange={() => {
                                if (isIndividuallyGranted) {
                                  setStaffExtraPermissions(prev => prev.filter(p => p !== perm.name));
                                } else {
                                  setStaffExtraPermissions(prev => [...prev, perm.name]);
                                }
                              }}
                              style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {perm.display_name || perm.name.replace(/_/g, ' ')}
                              </div>
                              <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {perm.name}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {isRoleInherited && (
                              <span className="badge badge-info" style={{ fontSize: '10px' }} title={`Base role ${staffForm.role_name} grants this`}>
                                Role: {staffForm.role_name}
                              </span>
                            )}
                            {isIndividuallyGranted && (
                              <span className="badge badge-ok" style={{ fontSize: '10px', fontWeight: 700 }} title="Granted directly to this user">
                                ⭐ Individual Grant
                              </span>
                            )}
                            {!isRoleInherited && !isIndividuallyGranted && (
                              <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                                Not Granted
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStaffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff View Profile Modal */}
      {viewingStaff && (
        <div className="modal-overlay" onClick={() => setViewingStaff(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Staff Profile</h2>
              <button className="qty-remove" onClick={() => setViewingStaff(null)}>&times;</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              {viewingStaff.profile_picture ? (
                <img
                  src={`/uploads/avatars/${viewingStaff.profile_picture}`}
                  alt={viewingStaff.name}
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    fontWeight: 700
                  }}
                >
                  {viewingStaff.name.charAt(0)}
                </div>
              )}
              <div>
                <h3 style={{ margin: 0 }}>{viewingStaff.name}</h3>
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{viewingStaff.email}</div>
                <span className="badge badge-ok" style={{ textTransform: 'capitalize', marginTop: '4px' }}>
                  {viewingStaff.role_name.replace('_', ' ')}
                </span>
              </div>
            </div>

            <dl className="info-grid">
              <dt>Phone:</dt>
              <dd>{viewingStaff.phone || '—'}</dd>
              <dt>Shift:</dt>
              <dd>
                {viewingStaff.shift_name} ({formatShiftTime(viewingStaff.shift_start)} – {formatShiftTime(viewingStaff.shift_end)})
              </dd>
              <dt>Status:</dt>
              <dd>
                {viewingStaff.is_active ? (
                  <span className="badge badge-ok">
                    <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Active
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(239, 68, 68, 0.12)',
                        color: '#dc2626',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                      }}
                    >
                      <i className="fa-solid fa-user-slash" style={{ marginRight: '4px' }}></i> Resigned / Deactivated
                    </span>
                    {(currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_users')) && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 8px', fontSize: '11px', color: '#10b981', borderColor: '#10b981' }}
                        onClick={() => {
                          reactivateStaff(viewingStaff.id);
                          setViewingStaff({ ...viewingStaff, is_active: true, deactivation_reason: undefined, deactivated_at: undefined });
                        }}
                      >
                        <i className="fa-solid fa-user-check" style={{ marginRight: '4px' }}></i>
                        Reactivate Now
                      </button>
                    )}
                  </div>
                )}
              </dd>
              <dt>Total Shifts:</dt>
              <dd>{attendance.filter(a => a.user_id === viewingStaff.id).length} recorded shifts</dd>
              <dt>Open Tasks:</dt>
              <dd>{tasks.filter(t => t.assigned_to === viewingStaff.id && t.status === 'pending').length} pending</dd>
            </dl>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setViewingStaff(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEACTIVATE STAFF CONFIRMATION MODAL */}
      {deactivatingStaff && (
        <div className="modal-overlay" onClick={() => setDeactivatingStaff(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}
                >
                  <i className="fa-solid fa-user-slash"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#dc2626' }}>Deactivate Staff Account</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Staff Resignation &amp; Lifecycle Termination
                  </div>
                </div>
              </div>
              <button className="qty-remove" onClick={() => setDeactivatingStaff(null)}>&times;</button>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                marginBottom: '16px',
                fontSize: '13px',
                lineHeight: 1.45
              }}
            >
              <div style={{ fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
                Are you sure you want to deactivate {deactivatingStaff.name}?
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                Deactivating immediately disables this employee&apos;s ability to log into the terminal, process sales, or receive new delegated tasks. All historical transactions, shifts, and audit logs are safely kept for business compliance.
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                Resignation / Deactivation Reason (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Resigned on notice, Contract ended, Relocated..."
                value={deactivationReason}
                onChange={e => setDeactivationReason(e.target.value)}
                style={{ width: '100%', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeactivatingStaff(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
                onClick={() => {
                  deactivateStaff(deactivatingStaff.id, deactivationReason.trim() || undefined);
                  setDeactivatingStaff(null);
                  setDeactivationReason('');
                }}
              >
                <i className="fa-solid fa-user-slash"></i>
                Deactivate &amp; Mark Resigned
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REACTIVATE STAFF CONFIRMATION MODAL */}
      {reactivatingStaff && (
        <div className="modal-overlay" onClick={() => setReactivatingStaff(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}
                >
                  <i className="fa-solid fa-user-check"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', color: '#10b981' }}>Reactivate Staff Account</h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Restore Employment &amp; Access Privileges
                  </div>
                </div>
              </div>
              <button className="qty-remove" onClick={() => setReactivatingStaff(null)}>&times;</button>
            </div>

            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                marginBottom: '16px',
                fontSize: '13px',
                lineHeight: 1.45
              }}
            >
              <div style={{ fontWeight: 600, color: '#059669', marginBottom: '4px' }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
                Restore access for {reactivatingStaff.name}?
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12.5px' }}>
                Reactivating this employee will restore their login access, enable them to process sales, perform assigned duties for the <strong>{reactivatingStaff.role_name.replace('_', ' ')}</strong> role, and clock into shifts.
              </div>
            </div>

            {reactivatingStaff.deactivation_reason && (
              <div style={{ marginBottom: '16px', fontSize: '12.5px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <strong>Previous Resignation Note:</strong> {reactivatingStaff.deactivation_reason}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setReactivatingStaff(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{
                  background: '#10b981',
                  borderColor: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
                onClick={() => {
                  reactivateStaff(reactivatingStaff.id);
                  setReactivatingStaff(null);
                }}
              >
                <i className="fa-solid fa-user-check"></i>
                Confirm &amp; Reactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Modal (Assign By Which User to Which User) */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>
                  <i className="fa-solid fa-list-check" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                  Assign Team Task
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Delegate operational duties between staff members
                </div>
              </div>
              <button className="qty-remove" onClick={() => setShowTaskModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveTask}>
              {/* User Selection: By User ➔ To User */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    <i className="fa-solid fa-user-tie" style={{ marginRight: '5px', color: 'var(--primary)' }}></i>
                    Assigned By (Originator):
                  </label>
                  <select
                    value={taskForm.assigned_by}
                    onChange={e => setTaskForm({ ...taskForm, assigned_by: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role_name}) {u.id === currentUser.id ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px', display: 'block' }}>
                    <i className="fa-solid fa-user-check" style={{ marginRight: '5px', color: 'var(--success)' }}></i>
                    Assigned To (Assignee):
                  </label>
                  <select
                    value={taskForm.assigned_to}
                    onChange={e => setTaskForm({ ...taskForm, assigned_to: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role_name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Assignment Flow Preview Visual */}
              {(() => {
                const assigner = users.find(u => u.id === taskForm.assigned_by);
                const assignee = users.find(u => u.id === taskForm.assigned_to);
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'var(--bg-color)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      marginBottom: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={getAvatarSrc(assigner?.profile_picture)}
                        alt={assigner?.name}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--border-color)' }}
                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-dark)' }}>{assigner?.name || 'Assigner'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{assigner?.role_name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--primary)', padding: '0 10px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>delegates</span>
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: '16px' }}></i>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'right' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>{assignee?.name || 'Assignee'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{assignee?.role_name}</div>
                      </div>
                      <img
                        src={getAvatarSrc(assignee?.profile_picture)}
                        alt={assignee?.name}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }}
                        onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Priority and Due Date Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Priority Level:
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  >
                    <option value="medium">Medium Priority</option>
                    <option value="high">⚡ High Priority</option>
                    <option value="urgent">🔥 Urgent Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                    Target / Due (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. End of shift / 18:00"
                    value={taskForm.due_date}
                    onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Task Title */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Task Title <span style={{ color: 'var(--danger)' }}>*</span>:
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Deep clean beverage display cooler"
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '13.5px' }}
                />
              </div>

              {/* Task Description */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                  Instructions / Description:
                </label>
                <textarea
                  rows={3}
                  placeholder="Specific details, safety instructions, or expected check-off steps..."
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', fontSize: '13px' }}
                ></textarea>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTaskModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-paper-plane"></i>
                  Assign Task &amp; Notify
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin User Avatar Moderation Modal */}
      {moderatingUser && (
        <div className="modal-overlay" onClick={() => setModeratingUser(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px' }}>
                  <i className="fa-solid fa-shield-halved" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
                  Moderate User Avatar
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  User: <strong>{moderatingUser.name}</strong> ({moderatingUser.role_name})
                </div>
              </div>
              <button className="qty-remove" onClick={() => setModeratingUser(null)}>&times;</button>
            </div>

            <div style={{ padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', color: '#92400e', fontSize: '12px', marginBottom: '16px' }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
              <strong>Admin Safety Control:</strong> If this staff member uploaded an inappropriate or sensitive image, you can reset it immediately to a safe default preset avatar or upload an approved company image.
            </div>

            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px' }}>
              {moderationAvatarUrl ? (
                <img
                  src={getAvatarSrc(moderationAvatarUrl)}
                  alt="Avatar Preview"
                  style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--primary)',
                    boxShadow: 'var(--shadow-soft)'
                  }}
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>
                  {moderatingUser.name.charAt(0)}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Active Image Source:</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                  {moderationAvatarUrl ? (moderationAvatarUrl.startsWith('data:') ? 'Custom Upload (Data Image)' : moderationAvatarUrl) : 'Default letter icon'}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '8px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={() => {
                    const fallback = (moderatingUser.role_name === 'super_admin' || moderatingUser.role_name === 'admin') ? 'admin.png' : 'cashier.png';
                    setModerationAvatarUrl(fallback);
                    updateUserAvatar(moderatingUser.id, fallback);
                    setModeratingUser(null);
                    showFlash(`Reset ${moderatingUser.name}'s image to safe default (${fallback}).`, 'warning');
                  }}
                >
                  <i className="fa-solid fa-ban"></i> Reset Sensitive Image to Safe Default
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Select Safe Preset Avatar:</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                {['admin.png', 'assistant.png', 'cashier.png', 'inventory.png'].map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setModerationAvatarUrl(av)}
                    style={{
                      padding: '2px',
                      borderRadius: '50%',
                      background: 'none',
                      border: moderationAvatarUrl === av ? '2px solid var(--primary)' : '2px solid transparent',
                      cursor: 'pointer'
                    }}
                    title={av}
                  >
                    <img
                      src={`/uploads/avatars/${av}`}
                      alt={av}
                      style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Or Upload Replacement Image for User:</label>
              <input
                type="file"
                accept="image/*"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 2 * 1024 * 1024) {
                    showFlash('Image file too large (max 2MB).', 'warning');
                    return;
                  }
                  const reader = new FileReader();
                  reader.onload = () => {
                    const result = reader.result as string;
                    setModerationAvatarUrl(result);
                    showFlash('Replacement image loaded into preview.', 'info');
                  };
                  reader.readAsDataURL(file);
                }}
                style={{ fontSize: '12px', marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModeratingUser(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  updateUserAvatar(moderatingUser.id, moderationAvatarUrl);
                  setModeratingUser(null);
                }}
              >
                <i className="fa-solid fa-check"></i> Save Avatar for User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. ADMIN PASSWORD RESET MODAL */}
      {resetPasswordUser && (
        <div
          className="modal-overlay"
          onClick={() => {
            setResetPasswordUser(null);
            setResetPasswordInput('');
            setResetSuccessMessage('');
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#fef3c7',
                    color: '#d97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}
                >
                  <i className="fa-solid fa-key"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Admin Password Reset</h3>
                  <p className="subtitle" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                    Reset staff login credentials directly
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setResetPasswordUser(null);
                  setResetPasswordInput('');
                  setResetSuccessMessage('');
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Target Staff Member Card */}
            <div
              style={{
                background: 'var(--bg-color)',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '15px'
                }}
              >
                {resetPasswordUser.name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{resetPasswordUser.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {resetPasswordUser.email} • {resetPasswordUser.phone || 'No phone'}
                </div>
              </div>
              <span className="badge badge-ok" style={{ textTransform: 'capitalize' }}>
                {resetPasswordUser.role_name.replace('_', ' ')}
              </span>
            </div>

            {resetSuccessMessage ? (
              <div
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #6ee7b7',
                  color: '#065f46',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginBottom: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-circle-check" style={{ color: '#10b981' }}></i>
                <span>{resetSuccessMessage}</span>
              </div>
            ) : null}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                New Password / Access PIN
              </label>
              <input
                type="text"
                placeholder="Enter temporary password or 6-digit PIN (e.g. Pass@2025 or 849201)"
                value={resetPasswordInput}
                onChange={e => setResetPasswordInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '14px',
                  background: 'var(--card-bg)'
                }}
              />
            </div>

            {/* Quick action buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
                  setResetPasswordInput(randomPin);
                }}
              >
                <i className="fa-solid fa-dice" style={{ marginRight: '6px' }}></i>
                Generate 6-digit PIN
              </button>
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setResetPasswordInput('password')}
              >
                <i className="fa-solid fa-rotate-left" style={{ marginRight: '6px' }}></i>
                Default "password"
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setResetPasswordUser(null);
                  setResetPasswordInput('');
                  setResetSuccessMessage('');
                }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!resetPasswordInput.trim()) {
                    showFlash('Please provide a new password or PIN.', 'warning');
                    return;
                  }
                  adminResetPassword(resetPasswordUser.id, resetPasswordInput.trim());
                  setResetSuccessMessage(`Password updated to "${resetPasswordInput.trim()}". Staff member can now log in with this new password.`);
                }}
              >
                <i className="fa-solid fa-check" style={{ marginRight: '6px' }}></i>
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. CONFIRM PERMISSION GRANT / REVOCATION MODAL (DOUBLE-CHECK ALERT) */}
      {pendingPermissionGrant && (
        <div
          className="modal-overlay"
          onClick={() => {
            setPendingPermissionGrant(null);
            setGrantDoubleCheckConfirmed(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28)',
              padding: '24px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: pendingPermissionGrant.isCurrentlyGranted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: pendingPermissionGrant.isCurrentlyGranted ? '#dc2626' : '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}
                >
                  <i className={`fa-solid ${pendingPermissionGrant.isCurrentlyGranted ? 'fa-shield-halved' : 'fa-shield-check'}`}></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    {pendingPermissionGrant.isCurrentlyGranted ? 'Confirm Permission Revocation' : 'Confirm Permission Grant'}
                  </h3>
                  <p className="subtitle" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                    Double-check access privileges before applying changes
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setPendingPermissionGrant(null);
                  setGrantDoubleCheckConfirmed(false);
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Prominent Double-Check Alert Banner */}
            <div
              style={{
                background: pendingPermissionGrant.isCurrentlyGranted ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.1)',
                border: `1px solid ${pendingPermissionGrant.isCurrentlyGranted ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '18px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ fontSize: '18px', color: pendingPermissionGrant.isCurrentlyGranted ? '#dc2626' : '#d97706', marginTop: '1px' }}>
                <i className={`fa-solid ${pendingPermissionGrant.isCurrentlyGranted ? 'fa-triangle-exclamation' : 'fa-shield-exclamation'}`}></i>
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '13.5px',
                    color: pendingPermissionGrant.isCurrentlyGranted ? '#b91c1c' : '#b45309',
                    marginBottom: '4px'
                  }}
                >
                  Double-Check Required Before Confirming
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  You are about to{' '}
                  <strong style={{ color: pendingPermissionGrant.isCurrentlyGranted ? '#dc2626' : '#059669', textTransform: 'uppercase' }}>
                    {pendingPermissionGrant.isCurrentlyGranted ? 'REVOKE' : 'GRANT'}
                  </strong>{' '}
                  the <strong>{pendingPermissionGrant.permissionDisplayName}</strong> capability{' '}
                  {pendingPermissionGrant.isCurrentlyGranted ? 'from' : 'to'}{' '}
                  <strong>
                    the "{pendingPermissionGrant.roleDisplayName || pendingPermissionGrant.roleName}" role
                  </strong>
                  .
                </div>
              </div>
            </div>

            {/* Target & Permission Details Card */}
            <div
              style={{
                background: 'var(--bg-color)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                padding: '14px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
                    Target Role
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginTop: '2px' }}>
                    {pendingPermissionGrant.roleDisplayName || pendingPermissionGrant.roleName}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.5px' }}>
                    Capability Action
                  </div>
                  <div style={{ marginTop: '2px' }}>
                    <span
                      className={`badge ${pendingPermissionGrant.isCurrentlyGranted ? 'badge-danger' : 'badge-ok'}`}
                      style={{ fontSize: '11px', fontWeight: 600 }}
                    >
                      {pendingPermissionGrant.isCurrentlyGranted ? 'Revoke Access' : 'Grant Access'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{pendingPermissionGrant.permissionDisplayName}</span>
                  <code style={{ fontSize: '11px', background: 'var(--card-bg)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                    {pendingPermissionGrant.permissionName}
                  </code>
                </div>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {pendingPermissionGrant.permissionDescription || 'Enables operations and access controls governed by this capability.'}
                </p>
              </div>
            </div>

            {/* High Privilege Security Notice */}
            {pendingPermissionGrant.isHighPrivilege && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.06)',
                  borderLeft: '4px solid #ef4444',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)'
                }}
              >
                <div style={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  <i className="fa-solid fa-lock"></i> High-Security Capability Notice
                </div>
                This permission grants sensitive administrative or financial power. Please verify authorization under the principle of least privilege.
              </div>
            )}

            {/* Double Check Verification Toggle */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                marginBottom: '20px',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                id="double-check-confirm-checkbox"
                checked={grantDoubleCheckConfirmed}
                onChange={e => setGrantDoubleCheckConfirmed(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                I have double-checked and confirm this {pendingPermissionGrant.isCurrentlyGranted ? 'revocation' : 'grant'}
              </span>
            </label>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPendingPermissionGrant(null);
                  setGrantDoubleCheckConfirmed(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-permission-grant-btn"
                className={`btn ${pendingPermissionGrant.isCurrentlyGranted ? 'btn-danger' : 'btn-primary'}`}
                disabled={!grantDoubleCheckConfirmed}
                onClick={handleExecutePermissionGrantToggle}
                style={{
                  opacity: grantDoubleCheckConfirmed ? 1 : 0.6,
                  cursor: grantDoubleCheckConfirmed ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                <i className={`fa-solid ${pendingPermissionGrant.isCurrentlyGranted ? 'fa-ban' : 'fa-check'}`}></i>
                <span>
                  {pendingPermissionGrant.isCurrentlyGranted ? 'Confirm Revoke' : 'Confirm Grant'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. CONFIRM ROLE REASSIGNMENT / PROMOTION MODAL (DOUBLE-CHECK ALERT - RULE 4) */}
      {pendingRoleChange && (
        <div
          className="modal-overlay"
          onClick={() => {
            setPendingRoleChange(null);
            setRoleChangeDoubleCheckConfirmed(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '500px',
              background: 'var(--card-bg)',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28)',
              padding: '24px'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: 'rgba(37, 99, 235, 0.15)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px'
                  }}
                >
                  <i className="fa-solid fa-user-gear"></i>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                    Confirm Role Reassignment / Promotion
                  </h3>
                  <p className="subtitle" style={{ margin: '2px 0 0', fontSize: '12px' }}>
                    RBAC Rule 4: Role updates are the sole mechanism to alter user access
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setPendingRoleChange(null);
                  setRoleChangeDoubleCheckConfirmed(false);
                }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Alert Banner */}
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '12px',
                padding: '14px 16px',
                marginBottom: '16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start'
              }}
            >
              <div style={{ fontSize: '18px', color: '#d97706', marginTop: '1px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#b45309', marginBottom: '4px' }}>
                  Double-Check Required Before Confirming
                </div>
                <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  You are reassigning <strong>{pendingRoleChange.userName}</strong> from{' '}
                  <code style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                    {pendingRoleChange.currentRole}
                  </code>{' '}
                  to{' '}
                  <strong style={{ color: 'var(--primary)', textTransform: 'uppercase' }}>
                    {pendingRoleChange.newRole}
                  </strong>
                  . All server-side API permissions will immediately update to match this role's capability profile.
                </div>
              </div>
            </div>

            {/* Role Change Summary */}
            <div
              style={{
                background: 'var(--bg-color)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                padding: '14px',
                marginBottom: '16px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Current Role
                </div>
                <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px', color: 'var(--text-secondary)' }}>
                  {pendingRoleChange.currentRole}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>
                  New Assigned Role
                </div>
                <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '2px', color: 'var(--primary)' }}>
                  {pendingRoleChange.newRole}
                </div>
              </div>
            </div>

            {/* Double Check Verification Toggle */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                marginBottom: '20px',
                userSelect: 'none'
              }}
            >
              <input
                type="checkbox"
                id="role-change-double-check-confirm"
                checked={roleChangeDoubleCheckConfirmed}
                onChange={e => setRoleChangeDoubleCheckConfirmed(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                I have double-checked and confirm this role promotion / reassignment
              </span>
            </label>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setPendingRoleChange(null);
                  setRoleChangeDoubleCheckConfirmed(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-role-change-btn"
                className="btn btn-primary"
                disabled={!roleChangeDoubleCheckConfirmed}
                onClick={handleExecuteRoleChange}
                style={{
                  opacity: roleChangeDoubleCheckConfirmed ? 1 : 0.6,
                  cursor: roleChangeDoubleCheckConfirmed ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600
                }}
              >
                <i className="fa-solid fa-check"></i>
                <span>Confirm Role Change</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
