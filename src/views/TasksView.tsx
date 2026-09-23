import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Task, TaskPriority } from '../types';

interface TasksViewProps {
  embedded?: boolean;
}

export const TasksView: React.FC<TasksViewProps> = ({ embedded = false }) => {
  const {
    currentUser,
    users,
    tasks,
    createTask,
    updateTaskStatus,
    completeTask,
    deleteTask,
    hasPermission,
    showFlash
  } = useApp();

  // Active staff only for assignments
  const activeUsers = useMemo(() => users.filter(u => u.is_active !== false), [users]);

  // View tabs
  const [tab, setTab] = useState<'all' | 'mine' | 'assigned_by_me' | 'completed'>('mine');

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigned_to: activeUsers.find(u => u.id !== currentUser.id)?.id || currentUser.id,
    assigned_by: currentUser.id,
    priority: 'medium' as TaskPriority,
    due_date: ''
  });

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  const myPendingTasks = tasks.filter(t => t.assigned_to === currentUser.id && t.status !== 'completed' && t.status !== 'cancelled');
  const myAssignedTasks = tasks.filter(t => t.assigned_to === currentUser.id);
  const tasksAssignedByMe = tasks.filter(t => t.assigned_by === currentUser.id);

  // Quick preset suggestions
  const taskPresets = [
    { title: 'Restock Beverage Cooler', desc: 'Replenish soft drinks, water, and juices from cold storage.', priority: 'medium' as TaskPriority },
    { title: 'Expiry Date Audit', desc: 'Inspect dairy, bread, and packaged snack expiration dates.', priority: 'high' as TaskPriority },
    { title: 'POS Receipt Paper Refill', desc: 'Ensure all checkout registers have spare thermal receipt rolls.', priority: 'low' as TaskPriority },
    { title: 'Evening Cash Reconciliation', desc: 'Perform mid-shift drawer cash count and deposit drop.', priority: 'urgent' as TaskPriority },
    { title: 'Price Tag Verification', desc: 'Audit aisle 2 snack prices against POS database records.', priority: 'medium' as TaskPriority },
    { title: 'Store Front Sweep & Mop', desc: 'Clean customer entrance, checkout area, and sanitize counter.', priority: 'low' as TaskPriority }
  ];

  const applyPreset = (preset: typeof taskPresets[0]) => {
    setTaskForm(prev => ({
      ...prev,
      title: preset.title,
      description: preset.desc,
      priority: preset.priority
    }));
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title.trim()) {
      showFlash('Please enter a task title.', 'warning');
      return;
    }

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
      assigned_to: activeUsers.find(u => u.id !== currentUser.id)?.id || currentUser.id,
      assigned_by: currentUser.id,
      priority: 'medium',
      due_date: ''
    });
    setShowAssignModal(false);
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Tab filter
      if (tab === 'mine' && t.assigned_to !== currentUser.id) return false;
      if (tab === 'assigned_by_me' && t.assigned_by !== currentUser.id) return false;
      if (tab === 'completed' && t.status !== 'completed') return false;

      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;

      // Priority filter
      if (priorityFilter !== 'all' && (t.priority || 'medium') !== priorityFilter) return false;

      // Assignee filter
      if (assigneeFilter !== 'all' && t.assigned_to !== Number(assigneeFilter)) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q) || false;
        const matchAssignee = t.assigned_to_name.toLowerCase().includes(q);
        const matchAssigner = t.assigned_by_name.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee && !matchAssigner) return false;
      }

      return true;
    });
  }, [tasks, tab, statusFilter, priorityFilter, assigneeFilter, search, currentUser.id]);

  const getPriorityBadge = (priority?: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            🔥 Urgent
          </span>
        );
      case 'high':
        return (
          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            ⚡ High
          </span>
        );
      case 'low':
        return (
          <span className="badge" style={{ background: 'rgba(107, 114, 128, 0.12)', color: '#4b5563', border: '1px solid rgba(107, 114, 128, 0.25)' }}>
            Low
          </span>
        );
      case 'medium':
      default:
        return (
          <span className="badge badge-neutral">
            Medium
          </span>
        );
    }
  };

  const getStatusBadge = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="badge badge-ok">
            <i className="fa-solid fa-circle-check" style={{ marginRight: '4px' }}></i> Completed
          </span>
        );
      case 'in_progress':
        return (
          <span className="badge" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '4px' }}></i> In Progress
          </span>
        );
      case 'cancelled':
        return (
          <span className="badge badge-neutral">
            <i className="fa-solid fa-ban" style={{ marginRight: '4px' }}></i> Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="badge badge-warning">
            <i className="fa-regular fa-clock" style={{ marginRight: '4px' }}></i> Pending
          </span>
        );
    }
  };

  const canManageAllTasks = currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_tasks') || hasPermission('manage_users');

  return (
    <div style={{ maxWidth: embedded ? '100%' : '1280px', margin: '0 auto' }}>
      {/* Top Banner & Title */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          background: 'linear-gradient(135deg, var(--card-bg) 0%, rgba(99, 102, 241, 0.05) 100%)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.12)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px'
            }}
          >
            <i className="fa-solid fa-list-check"></i>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Tasks &amp; Operational Duties
            </h1>
            <p className="subtitle" style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
              Assign, delegate, and track daily store operations across team members.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {myPendingTasks.length > 0 && (
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#d97706',
                fontSize: '12.5px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-bell"></i>
              <span>{myPendingTasks.length} pending for you</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setTaskForm({
                title: '',
                description: '',
                assigned_to: activeUsers.find(u => u.id !== currentUser.id)?.id || currentUser.id,
                assigned_by: currentUser.id,
                priority: 'medium',
                due_date: ''
              });
              setShowAssignModal(true);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}
          >
            <i className="fa-solid fa-plus"></i>
            <span>Assign New Task</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: '16px',
          flexWrap: 'wrap'
        }}
      >
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={`tab-btn ${tab === 'mine' ? 'active' : ''}`}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            color: tab === 'mine' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === 'mine' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-user-check"></i>
          <span>Assigned to Me</span>
          <span
            className="badge"
            style={{
              fontSize: '11px',
              background: tab === 'mine' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: tab === 'mine' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {myAssignedTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('all')}
          className={`tab-btn ${tab === 'all' ? 'active' : ''}`}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            color: tab === 'all' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === 'all' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-table-list"></i>
          <span>All Team Tasks</span>
          <span
            className="badge"
            style={{
              fontSize: '11px',
              background: tab === 'all' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: tab === 'all' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {tasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('assigned_by_me')}
          className={`tab-btn ${tab === 'assigned_by_me' ? 'active' : ''}`}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            color: tab === 'assigned_by_me' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === 'assigned_by_me' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-paper-plane"></i>
          <span>Created by Me</span>
          <span
            className="badge"
            style={{
              fontSize: '11px',
              background: tab === 'assigned_by_me' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: tab === 'assigned_by_me' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {tasksAssignedByMe.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('completed')}
          className={`tab-btn ${tab === 'completed' ? 'active' : ''}`}
          style={{
            padding: '10px 16px',
            fontSize: '13.5px',
            fontWeight: 600,
            border: 'none',
            background: 'transparent',
            color: tab === 'completed' ? 'var(--primary)' : 'var(--text-muted)',
            borderBottom: tab === 'completed' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-circle-check"></i>
          <span>Completed History</span>
          <span
            className="badge"
            style={{
              fontSize: '11px',
              background: tab === 'completed' ? 'var(--primary)' : 'var(--bg-secondary)',
              color: tab === 'completed' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            {tasks.filter(t => t.status === 'completed').length}
          </span>
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          background: 'var(--card-bg)'
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <input
            type="text"
            placeholder="Search by task title, description, or staff member name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: '34px', fontSize: '13px', width: '100%' }}
          />
          <i
            className="fa-solid fa-magnifying-glass"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '12.5px'
            }}
          ></i>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div style={{ flex: '0 0 auto' }}>
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '8px 12px' }}
          >
            <option value="all">All Priorities</option>
            <option value="urgent">🔥 Urgent</option>
            <option value="high">⚡ High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {tab !== 'mine' && (
          <div style={{ flex: '0 0 auto' }}>
            <select
              value={assigneeFilter}
              onChange={e => setAssigneeFilter(e.target.value)}
              style={{ fontSize: '13px', padding: '8px 12px' }}
            >
              <option value="all">Assigned to: All Staff</option>
              {activeUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role_name.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>
        )}

        {(search || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all') && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
              setPriorityFilter('all');
              setAssigneeFilter('all');
            }}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '28px',
              color: 'var(--text-muted)'
            }}
          >
            <i className="fa-solid fa-clipboard-check"></i>
          </div>
          <h3 style={{ margin: '0 0 6px', fontSize: '16px', color: 'var(--text-primary)' }}>
            No tasks found
          </h3>
          <p style={{ margin: '0 0 18px', fontSize: '13px', maxWidth: '420px', marginInline: 'auto' }}>
            {tab === 'mine'
              ? 'You have no assigned tasks matching your filters. Great job keeping up with your duties!'
              : 'No team tasks match your search or filter criteria.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowAssignModal(true)}
          >
            <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> Assign New Task
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredTasks.map(t => {
            const isCompleted = t.status === 'completed';
            const isAssignedToCurrent = t.assigned_to === currentUser.id;
            const isCreatedByCurrent = t.assigned_by === currentUser.id;
            const canModify = isAssignedToCurrent || isCreatedByCurrent || canManageAllTasks;

            const assigner = users.find(u => u.id === t.assigned_by);
            const assignee = users.find(u => u.id === t.assigned_to);

            return (
              <div
                key={t.id}
                className="card"
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  borderLeft: isCompleted
                    ? '4px solid var(--success)'
                    : t.priority === 'urgent'
                    ? '4px solid #ef4444'
                    : t.priority === 'high'
                    ? '4px solid #f59e0b'
                    : '4px solid var(--primary)',
                  opacity: isCompleted ? 0.85 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                  {/* Title & Checkbox */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 300px' }}>
                    <input
                      type="checkbox"
                      checked={isCompleted}
                      disabled={!canModify}
                      onChange={e => {
                        if (e.target.checked) {
                          completeTask(t.id);
                        } else {
                          updateTaskStatus(t.id, 'pending');
                        }
                      }}
                      title={canModify ? (isCompleted ? 'Mark pending' : 'Mark completed') : 'Only assignee or manager can complete'}
                      style={{
                        width: '18px',
                        height: '18px',
                        marginTop: '3px',
                        cursor: canModify ? 'pointer' : 'not-allowed',
                        accentColor: 'var(--success)'
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          textDecoration: isCompleted ? 'line-through' : 'none',
                          lineHeight: 1.3
                        }}
                      >
                        {t.title}
                      </div>
                      {t.description && (
                        <div
                          style={{
                            fontSize: '13px',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                            lineHeight: 1.4
                          }}
                        >
                          {t.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status & Priority Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {getPriorityBadge(t.priority)}
                    {getStatusBadge(t.status)}
                  </div>
                </div>

                {/* Assignment Pathway & Metadata */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: '12.5px'
                  }}
                >
                  {/* From User ➔ To User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Assigner */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>From:</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--bg-secondary)',
                          fontWeight: 600,
                          color: 'var(--text-primary)'
                        }}
                      >
                        <i className="fa-solid fa-user-tie" style={{ color: 'var(--primary)', fontSize: '11px' }}></i>
                        {t.assigned_by_name}
                        {isCreatedByCurrent && <span style={{ color: 'var(--primary)', fontSize: '10.5px' }}>(You)</span>}
                      </span>
                    </div>

                    <i className="fa-solid fa-arrow-right" style={{ color: 'var(--text-muted)', fontSize: '11px' }}></i>

                    {/* Assignee */}
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: 600 }}>To:</span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isAssignedToCurrent ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
                          border: isAssignedToCurrent ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                          fontWeight: 600,
                          color: isAssignedToCurrent ? 'var(--primary)' : 'var(--text-primary)'
                        }}
                      >
                        <i className="fa-solid fa-user-check" style={{ color: 'var(--success)', fontSize: '11px' }}></i>
                        {t.assigned_to_name}
                        {isAssignedToCurrent && <span style={{ fontWeight: 700 }}>(You)</span>}
                      </span>
                    </div>

                    {/* Due Date */}
                    {t.due_date && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--text-muted)',
                          marginLeft: '6px'
                        }}
                      >
                        <i className="fa-regular fa-clock" style={{ color: '#d97706' }}></i>
                        <span>Due: {t.due_date}</span>
                      </span>
                    )}
                  </div>

                  {/* Status update controls & Delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
                    {canModify && (
                      <select
                        value={t.status}
                        onChange={e => updateTaskStatus(t.id, e.target.value as any)}
                        style={{
                          padding: '4px 8px',
                          fontSize: '11.5px',
                          borderRadius: '6px',
                          fontWeight: 600,
                          height: '28px'
                        }}
                      >
                        <option value="pending">Pending</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}

                    {(isCreatedByCurrent || canManageAllTasks) && (
                      <button
                        type="button"
                        className="btn-icon"
                        style={{ color: 'var(--danger)', width: '28px', height: '28px', fontSize: '12px' }}
                        onClick={() => {
                          deleteTask(t.id);
                          showFlash(`Task "${t.title}" deleted.`, 'info');
                        }}
                        title="Delete task"
                      >
                        <i className="fa-solid fa-trash-can"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Task Modal */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '580px', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-list-check" style={{ color: 'var(--primary)' }}></i>
                  Assign Team Task / Duty
                </h2>
                <p className="subtitle" style={{ margin: '3px 0 0', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Delegate operational task clearly from one team member to another.
                </p>
              </div>
              <button
                type="button"
                className="qty-remove"
                onClick={() => setShowAssignModal(false)}
                style={{ fontSize: '20px' }}
              >
                &times;
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Quick Presets (Click to autofill):
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {taskPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => applyPreset(preset)}
                    style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px' }}
                  >
                    + {preset.title}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateTask}>
              {/* Assign From ➔ Assign To Selection */}
              <div
                style={{
                  padding: '14px',
                  background: 'var(--bg-secondary)',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  marginBottom: '16px'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {/* From (Assigner) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                      <i className="fa-solid fa-user-tie" style={{ marginRight: '5px', color: 'var(--primary)' }}></i>
                      Assign From (Originator):
                    </label>
                    <select
                      value={taskForm.assigned_by}
                      onChange={e => setTaskForm({ ...taskForm, assigned_by: Number(e.target.value) })}
                      style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                    >
                      {activeUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role_name.replace('_', ' ')}) {u.id === currentUser.id ? '(You)' : ''}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                      Supervisor or team member creating duty
                    </span>
                  </div>

                  {/* To (Assignee) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '5px' }}>
                      <i className="fa-solid fa-user-check" style={{ marginRight: '5px', color: 'var(--success)' }}></i>
                      Assign To (Recipient):
                    </label>
                    <select
                      value={taskForm.assigned_to}
                      onChange={e => setTaskForm({ ...taskForm, assigned_to: Number(e.target.value) })}
                      style={{ width: '100%', fontSize: '13px', padding: '8px' }}
                    >
                      {activeUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role_name.replace('_', ' ')}) {u.id === currentUser.id ? '(Self)' : ''}
                        </option>
                      ))}
                    </select>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                      Staff member responsible for execution
                    </span>
                  </div>
                </div>

                {/* Visual Delegation Path */}
                {(() => {
                  const assigner = activeUsers.find(u => u.id === Number(taskForm.assigned_by));
                  const assignee = activeUsers.find(u => u.id === Number(taskForm.assigned_to));
                  return (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '12px',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {assigner?.name || 'Assigner'}
                      </span>
                      <i className="fa-solid fa-arrow-right" style={{ color: 'var(--primary)' }}></i>
                      <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                        {assignee?.name || 'Assignee'}
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Task Title */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Task Title <span style={{ color: 'var(--danger)' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Restock drinks cooler, Price check snack aisle, End of day cash count..."
                  value={taskForm.title}
                  onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                  style={{ width: '100%', fontSize: '13.5px' }}
                />
              </div>

              {/* Task Description */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Detailed Instructions / Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide any specific location details, quantity instructions, or checklist requirements..."
                  value={taskForm.description}
                  onChange={e => setTaskForm({ ...taskForm, description: e.target.value })}
                  style={{ width: '100%', resize: 'vertical', fontSize: '13px' }}
                />
              </div>

              {/* Priority & Due Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    Priority Level:
                  </label>
                  <select
                    value={taskForm.priority}
                    onChange={e => setTaskForm({ ...taskForm, priority: e.target.value as TaskPriority })}
                    style={{ width: '100%', fontSize: '13px' }}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">⚡ High Priority</option>
                    <option value="urgent">🔥 Urgent Priority</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    Due Target / Time:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Today by 16:00, End of shift, Tomorrow morning..."
                    value={taskForm.due_date}
                    onChange={e => setTaskForm({ ...taskForm, due_date: e.target.value })}
                    style={{ width: '100%', fontSize: '13px' }}
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  <span>Assign Task</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
