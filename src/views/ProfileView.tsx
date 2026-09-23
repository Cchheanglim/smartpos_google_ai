import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatShiftTime } from '../utils/crm';

export const ProfileView: React.FC = () => {
  const { currentUser, users, updateStaff, updateUserAvatar, showFlash, requestLogout, hasPermission } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.profile_picture || 'admin.png');
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showFullPicModal, setShowFullPicModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarWrapperRef = useRef<HTMLDivElement>(null);

  // Close avatar popup menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        avatarWrapperRef.current &&
        !avatarWrapperRef.current.contains(e.target as Node)
      ) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Admin image moderation state
  const isAdmin = currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_users');
  const [targetUserId, setTargetUserId] = useState<number>(users[0]?.id || currentUser.id);
  const targetUser = users.find(u => u.id === targetUserId) || currentUser;
  const [adminTargetAvatar, setAdminTargetAvatar] = useState<string>(targetUser.profile_picture || 'cashier.png');

  const getAvatarSrc = (pic?: string) => {
    if (!pic) return '';
    if (pic.startsWith('data:') || pic.startsWith('http') || pic.startsWith('/')) return pic;
    return `/uploads/avatars/${pic}`;
  };

  const handleCustomAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showFlash('Image file too large (max 2MB).', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setSelectedAvatar(result);
      setShowAvatarMenu(false);
      showFlash('Custom profile picture loaded! Click "Save Profile Changes" to apply.', 'info');
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting same file triggers change
    e.target.value = '';
  };

  const handleAdminAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showFlash('Image file too large (max 2MB).', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAdminTargetAvatar(result);
      showFlash(`Replacement image loaded for ${targetUser.name}. Click "Apply Avatar" to commit.`, 'info');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();

    let wantsPasswordChange = false;
    if (currentPassword || password || confirmPassword) {
      wantsPasswordChange = true;
      if (!currentPassword) {
        showFlash('Security requirement: Please enter your current password to authorize this password change.', 'warning');
        return;
      }

      // Check current password against stored password_hash (fallback to default 'password')
      const actualCurrentPassword = currentUser.password_hash || 'password';
      if (currentPassword !== actualCurrentPassword) {
        showFlash('Current password is incorrect. Identity verification failed.', 'error');
        return;
      }

      if (!password) {
        showFlash('Please enter your new password.', 'warning');
        return;
      }

      if (password.length < 4) {
        showFlash('New password must be at least 4 characters long.', 'warning');
        return;
      }

      if (password !== confirmPassword) {
        showFlash('New passwords do not match.', 'error');
        return;
      }

      if (password === actualCurrentPassword) {
        showFlash('New password cannot be identical to your current password.', 'warning');
        return;
      }
    }

    updateStaff(currentUser.id, {
      name,
      phone,
      profile_picture: selectedAvatar,
      ...(wantsPasswordChange ? { password_hash: password } : {})
    });
    updateUserAvatar(currentUser.id, selectedAvatar);

    if (wantsPasswordChange) {
      showFlash('Profile details and password successfully updated!', 'success');
      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');
    } else {
      showFlash('Profile details saved successfully.', 'success');
    }
  };

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '30px' }}>
      {/* Hidden file input for Change Picture */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleCustomAvatarUpload}
        style={{ display: 'none' }}
      />

      {/* Main Profile Card (Centered Layout) */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 28px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px' }}>My Account Profile</h1>
        <p className="subtitle" style={{ margin: '0 auto 28px', maxWidth: '480px' }}>
          Manage your personal staff credentials, profile avatar photo, and account security.
        </p>

        {/* Centered Large Profile Picture Section with Interactive Click Options */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ position: 'relative', display: 'inline-block' }} ref={avatarWrapperRef}>
            {/* Big Avatar Button */}
            <div
              onClick={() => setShowAvatarMenu(prev => !prev)}
              style={{
                width: '130px',
                height: '130px',
                borderRadius: '50%',
                cursor: 'pointer',
                position: 'relative',
                margin: '0 auto',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                border: '4px solid var(--primary)',
                background: 'var(--bg-color)',
                overflow: 'hidden',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
              }}
              title="Click to view full picture or change picture"
            >
              {selectedAvatar ? (
                <img
                  src={getAvatarSrc(selectedAvatar)}
                  alt="Account Avatar"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block'
                  }}
                  onError={e => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, var(--primary) 0%, #0d9488 100%)',
                    color: '#ffffff',
                    fontSize: '44px',
                    fontWeight: 700
                  }}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Camera Hover Overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0, 0, 0, 0.38)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  opacity: showAvatarMenu ? 1 : 0,
                  transition: 'opacity 0.2s ease'
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                onMouseLeave={e => {
                  if (!showAvatarMenu) {
                    (e.currentTarget as HTMLElement).style.opacity = '0';
                  }
                }}
              >
                <i className="fa-solid fa-camera" style={{ fontSize: '24px', marginBottom: '4px' }}></i>
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Options</span>
              </div>
            </div>

            {/* Badge Indicator in Bottom Corner */}
            <div
              onClick={() => setShowAvatarMenu(prev => !prev)}
              style={{
                position: 'absolute',
                bottom: '4px',
                right: '4px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                border: '2px solid #ffffff',
                cursor: 'pointer'
              }}
              title="Click to manage photo"
            >
              <i className="fa-solid fa-camera" style={{ fontSize: '14px' }}></i>
            </div>

            {/* POPUP MENU NEXT TO PICTURE */}
            {showAvatarMenu && (
              <div
                ref={menuRef}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '145px',
                  transform: 'translateY(-50%)',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                  padding: '8px',
                  width: '210px',
                  zIndex: 100,
                  textAlign: 'left'
                }}
              >
                {/* Arrow pointing to avatar */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '-8px',
                    transform: 'translateY(-50%) rotate(45deg)',
                    width: '14px',
                    height: '14px',
                    background: 'var(--card-bg)',
                    borderLeft: '1px solid var(--border-color)',
                    borderBottom: '1px solid var(--border-color)'
                  }}
                />

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 10px 4px', letterSpacing: '0.5px' }}>
                  Photo Options
                </div>

                {/* Option 1: View Full Picture */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAvatarMenu(false);
                    setShowFullPicModal(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-dark)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-color)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <i className="fa-solid fa-eye" style={{ color: 'var(--primary)', width: '18px', textAlign: 'center' }}></i>
                  <span>View Full picture</span>
                </button>

                {/* Option 2: Change Picture */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAvatarMenu(false);
                    fileInputRef.current?.click();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-dark)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-color)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <i className="fa-solid fa-arrow-up-from-bracket" style={{ color: 'var(--success)', width: '18px', textAlign: 'center' }}></i>
                  <span>Upload Picture</span>
                </button>

                {/* Option 3: Remove Picture */}
                {selectedAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarMenu(false);
                      setSelectedAvatar('');
                      showFlash('Avatar removed. Initials badge will be used.', 'info');
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--danger)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--bg-color)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    <i className="fa-solid fa-trash-can" style={{ color: 'var(--danger)', width: '18px', textAlign: 'center' }}></i>
                    <span>Remove Picture</span>
                  </button>
                )}

                {/* Option 4: Reset to Default */}
                <button
                  type="button"
                  onClick={() => {
                    setShowAvatarMenu(false);
                    const defaultPic = (currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin') ? 'admin.png' : 'cashier.png';
                    setSelectedAvatar(defaultPic);
                    showFlash('Profile avatar reset to standard icon. Click "Save Profile Changes" to apply.', 'info');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    transition: 'background 0.15s',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: '4px',
                    paddingTop: '8px'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--bg-color)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--danger)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  }}
                >
                  <i className="fa-solid fa-rotate-left" style={{ width: '18px', textAlign: 'center' }}></i>
                  <span>Reset to Default</span>
                </button>
              </div>
            )}
          </div>

          {/* User Subtitle under the big photo */}
          <div style={{ marginTop: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '20px' }}>{currentUser.name}</h2>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', marginTop: '6px' }}>
              <span className="badge badge-ok" style={{ textTransform: 'capitalize' }}>
                {currentUser.role_name.replace('_', ' ')}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>&bull;</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {currentUser.email}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '4px', cursor: 'pointer', fontWeight: 600 }} onClick={() => setShowAvatarMenu(true)}>
              <i className="fa-solid fa-arrow-pointer" style={{ marginRight: '4px' }}></i>
              Click photo to View Full picture or Change picture
            </div>

            {/* Quick Avatar Preset & Remove Bar */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Select Avatar Preset or Upload
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                {['admin.png', 'assistant.png', 'cashier.png', 'inventory.png'].map(av => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => {
                      setSelectedAvatar(av);
                      showFlash(`Selected "${av.replace('.png', '')}" avatar. Save profile to apply.`, 'info');
                    }}
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      padding: '2px',
                      border: selectedAvatar === av ? '2px solid var(--primary)' : '2px solid transparent',
                      background: 'var(--bg-color)',
                      cursor: 'pointer',
                      boxShadow: selectedAvatar === av ? '0 0 0 2px rgba(99, 102, 241, 0.25)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                    title={av}
                  >
                    <img
                      src={`/uploads/avatars/${av}`}
                      alt={av}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  </button>
                ))}

                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ fontSize: '11.5px', height: '32px', padding: '0 10px' }}
                >
                  <i className="fa-solid fa-arrow-up-from-bracket" style={{ marginRight: '4px' }}></i> Upload
                </button>

                {selectedAvatar && (
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      setSelectedAvatar('');
                      showFlash('Avatar removed. Initials badge will be used.', 'info');
                    }}
                    style={{ fontSize: '11.5px', height: '32px', padding: '0 10px' }}
                  >
                    <i className="fa-solid fa-trash-can" style={{ marginRight: '4px' }}></i> Remove
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Profile Information Form */}
        <form onSubmit={handleSaveProfile} style={{ textAlign: 'left' }}>
          <div className="form-row">
            <div>
              <label>Full Name:</label>
              <input
                type="text"
                required
                placeholder="e.g. Sokha Meng"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label>Phone Number:</label>
              <input
                type="text"
                placeholder="e.g. +855 12 345 678"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div>
              <label>Role:</label>
              <input
                type="text"
                disabled
                value={currentUser.role_name.replace('_', ' ').toUpperCase()}
                style={{ background: 'var(--bg-color)', cursor: 'not-allowed' }}
              />
            </div>
            <div>
              <label>Assigned Shift:</label>
              <input
                type="text"
                disabled
                value={`${currentUser.shift_name || 'Standard'} (${formatShiftTime(currentUser.shift_start)} – ${formatShiftTime(currentUser.shift_end)})`}
                style={{ background: 'var(--bg-color)', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px' }}>Account Security: Change Password</h3>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Current password is required to authorize setting a new password.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowPasswords(!showPasswords)}
                style={{ fontSize: '11.5px', padding: '4px 9px' }}
              >
                <i className={`fa-solid ${showPasswords ? 'fa-eye-slash' : 'fa-eye'}`} style={{ marginRight: '5px' }}></i>
                {showPasswords ? 'Hide Passwords' : 'Show Passwords'}
              </button>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontWeight: 600, fontSize: '13px' }}>
                Current Password <span style={{ color: 'var(--danger)' }}>*</span>
                <span style={{ fontWeight: 'normal', color: 'var(--text-muted)', fontSize: '11.5px', marginLeft: '6px' }}>
                  (Required to authorize change)
                </span>
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                placeholder="Enter your existing current password (default: password)"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="form-row">
              <div>
                <label style={{ fontWeight: 600, fontSize: '13px' }}>New Password:</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="Enter new password (min. 4 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label style={{ fontWeight: 600, fontSize: '13px' }}>Confirm New Password:</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  placeholder="Re-type new password to confirm"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={requestLogout}
              style={{ color: 'var(--danger)' }}
            >
              <i className="fa-solid fa-lock"></i> Lock Register &amp; Sign Out
            </button>
            <button type="submit" className="btn btn-primary">
              <i className="fa-solid fa-floppy-disk"></i> Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* FULL PICTURE MODAL (When "View Full picture" is clicked) */}
      {showFullPicModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowFullPicModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--card-bg)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '440px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              position: 'relative'
            }}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowFullPicModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'var(--bg-color)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'var(--text-dark)'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>Staff Profile Picture</h3>

            {/* Large Full Image Display */}
            <div
              style={{
                width: '280px',
                height: '280px',
                margin: '0 auto 18px',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '3px solid var(--border-color)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                background: 'var(--bg-color)'
              }}
            >
              <img
                src={getAvatarSrc(selectedAvatar)}
                alt="Full Profile"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            </div>

            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '4px' }}>
              {currentUser.name}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
              {currentUser.role_name.replace('_', ' ').toUpperCase()} &bull; {currentUser.email}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setShowFullPicModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => {
                  setShowFullPicModal(false);
                  fileInputRef.current?.click();
                }}
              >
                <i className="fa-solid fa-camera"></i> Change Picture
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin User Image Moderation Panel */}
      {isAdmin && (
        <div className="card" style={{ border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-user-shield" style={{ color: 'var(--primary)' }}></i>
                Admin User Image Moderation &amp; Management
              </h2>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                As an Administrator, you can view and edit any user's profile image to ensure compliance, or immediately reset inappropriate or sensitive images.
              </p>
            </div>
            <span className="badge badge-ok">Administrator Control</span>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, fontSize: '13px' }}>Select Staff Member to Inspect / Edit:</label>
            <select
              value={targetUserId}
              onChange={e => {
                const id = Number(e.target.value);
                setTargetUserId(id);
                const userObj = users.find(u => u.id === id);
                if (userObj) {
                  setAdminTargetAvatar(userObj.profile_picture || 'cashier.png');
                }
              }}
              style={{ maxWidth: '360px' }}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role_name.replace('_', ' ')}) - {u.email}
                </option>
              ))}
            </select>
          </div>

          {targetUser && (
            <div style={{ padding: '16px', background: 'var(--bg-color)', borderRadius: '10px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
              <img
                src={getAvatarSrc(adminTargetAvatar)}
                alt={targetUser.name}
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--primary)',
                  boxShadow: 'var(--shadow-soft)'
                }}
                onError={e => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              <div style={{ flex: 1, minWidth: '260px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px' }}>{targetUser.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Role: <strong style={{ textTransform: 'capitalize' }}>{targetUser.role_name.replace('_', ' ')}</strong> &bull; Email: {targetUser.email}
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => {
                      const safeDefault = (targetUser.role_name === 'super_admin' || targetUser.role_name === 'admin') ? 'admin.png' : 'cashier.png';
                      setAdminTargetAvatar(safeDefault);
                      updateUserAvatar(targetUser.id, safeDefault);
                      showFlash(`Reset ${targetUser.name}'s image to safe default (${safeDefault}). Sensitive image removed.`, 'warning');
                    }}
                  >
                    <i className="fa-solid fa-ban"></i> Reset Sensitive Image to Safe Default
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      updateUserAvatar(targetUser.id, adminTargetAvatar);
                      showFlash(`Updated avatar photo for ${targetUser.name}.`, 'success');
                    }}
                  >
                    <i className="fa-solid fa-check"></i> Apply Selected Avatar
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, fontSize: '12px' }}>
                    <i className="fa-solid fa-upload"></i> Upload Admin-Approved Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAdminAvatarUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Max file size 2MB (JPEG, PNG, WebP)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

