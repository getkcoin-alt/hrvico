import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api.js';

function Mark() { return <div className="mark" aria-label="RestroVico"><span>R</span><i>V</i></div> }
function Icon({name}) {
  const p = {
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    store: 'M4 10h16v10H4zM3 10l2-6h14l2 6M8 20v-5h8v5',
    user: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
    plus: 'M12 5v14M5 12h14',
    arrow: 'm9 18 6-6-6-6',
    check: 'm5 12 4 4L19 6',
    logout: 'M10 17l5-5-5-5M15 12H3M21 3v18',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2l-4.35-4.35'
  }[name] || '';
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={p} /></svg>;
}

function Field({label, children, hint}) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function Button({children, onClick, kind='primary', type='button', disabled}) {
  return <button type={type} className={'button ' + kind} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Auth({ onLoginSuccess }) {
  const [screen, setScreen] = useState('login');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [resetTokenInput, setResetTokenInput] = useState('');

  // Check URL params for verification or password reset links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const path = window.location.pathname;

    if (path.includes('verify') || params.has('verify')) {
      if (token) {
        setLoading(true);
        api.auth.verifyEmail(token)
          .then(res => {
            setNotice(res.message || 'Email verified successfully! You can now log in.');
            setScreen('login');
          })
          .catch(err => {
            setError(err.message || 'Invalid or expired verification link.');
            setScreen('login');
          })
          .finally(() => setLoading(false));
      } else {
        setScreen('verify');
      }
    } else if (path.includes('reset') || params.has('reset')) {
      if (token) {
        setResetTokenInput(token);
        setScreen('reset');
      }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (screen === 'signup') {
        const res = await api.auth.signup({
          fullName,
          email,
          mobile,
          password,
          confirmPassword,
          termsAccepted: terms
        });
        setNotice(res.message);
        if (res.data && res.data.devVerificationToken) {
          setDevToken(res.data.devVerificationToken);
        }
        setScreen('verify');
      } else if (screen === 'login') {
        const res = await api.auth.login(email, password);
        api.setTokens(res.data.accessToken, res.data.refreshToken);
        onLoginSuccess(res.data.user);
      } else if (screen === 'forgot') {
        const res = await api.auth.forgotPassword(email);
        setNotice(res.message);
      } else if (screen === 'reset') {
        const res = await api.auth.resetPassword(resetTokenInput, password, confirmPassword);
        setNotice(res.message);
        setScreen('login');
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email address to resend verification link.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.auth.resendVerification(email);
      setNotice(res.message);
    } catch (err) {
      setError(err.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  const title = {
    login: ['Welcome back', 'Sign in to continue managing your restaurants.'],
    signup: ['Create your owner account', 'Start with a secure foundation for your restaurant group.'],
    forgot: ['Reset your password', 'We’ll send a secure link to your registered email.'],
    reset: ['Choose a new password', 'Use at least 8 characters, including a letter and a number.'],
    verify: ['Check your inbox', 'We sent a verification link to your email address.']
  }[screen];

  return (
    <main className="auth">
      <section className="auth-aside">
        <div className="brand"><Mark /><b>RestroVico</b></div>
        <div className="aside-copy">
          <p className="eyebrow">MULTI-OUTLET RESTAURANT CONTROL</p>
          <h1>Your restaurant group,<br />ready to grow.</h1>
          <p>Set up locations, keep ownership clear, and build operations on a dependable base.</p>
        </div>
        <div className="aside-note"><Icon name="check" /> Built for owners. Designed for what comes next.</div>
      </section>
      
      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><Mark /><b>RestroVico</b></div>
          <p className="eyebrow">OWNER WORKSPACE</p>
          <h2>{title[0]}</h2>
          <p className="muted">{title[1]}</p>
          
          {notice && <div className="notice">{notice}</div>}
          {error && <div className="notice error">{error}</div>}

          {screen === 'verify' ? (
            <>
              <div className="verify-icon"><Icon name="check" /></div>
              <p className="muted">Open the email link to verify your account, then click below to log in.</p>
              {devToken && (
                <div className="dev-token-box" style={{ background: '#f0f4ff', padding: '12px', borderRadius: '6px', margin: '12px 0', fontSize: '13px' }}>
                  <strong>[Dev Mode Helper]</strong> Instant Verification Link:<br />
                  <a href={`?verify=true&token=${devToken}`} style={{ color: '#0050EA', wordBreak: 'break-all' }}>
                    Click here to verify now
                  </a>
                </div>
              )}
              <Button onClick={() => setScreen('login')}>
                Go to Sign In <Icon name="arrow" />
              </Button>
              <button className="text-button" onClick={handleResend} disabled={loading}>
                Resend verification email
              </button>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              {screen === 'signup' && (
                <>
                  <Field label="Full name">
                    <input required minLength="2" maxLength="80" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Aditi Mehra" />
                  </Field>
                  <Field label="Mobile number">
                    <input required type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 98765 43210" />
                  </Field>
                </>
              )}

              <Field label={screen === 'forgot' ? 'Email address' : 'Email or mobile'}>
                <input
                  required
                  type={screen === 'forgot' ? 'email' : 'text'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={screen === 'forgot' ? 'you@example.com' : 'you@example.com or +91…'}
                />
              </Field>

              {screen !== 'forgot' && (
                <>
                  <Field label={screen === 'reset' ? 'New password' : 'Password'}>
                    <input required type="password" minLength="8" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                  </Field>
                  {(screen === 'signup' || screen === 'reset') && (
                    <Field label="Confirm password">
                      <input required type="password" minLength="8" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                    </Field>
                  )}
                </>
              )}

              {screen === 'signup' && (
                <label className="check">
                  <input type="checkbox" required checked={terms} onChange={e => setTerms(e.target.checked)} /> I accept the Terms of Service and Privacy Policy.
                </label>
              )}

              {screen === 'login' && (
                <div className="form-row">
                  <label className="check"><input type="checkbox" defaultChecked /> Remember me</label>
                  <button type="button" className="text-button" onClick={() => { setError(''); setNotice(''); setScreen('forgot'); }}>Forgot password?</button>
                </div>
              )}

              <Button type="submit" disabled={loading}>
                {loading ? 'Processing…' : screen === 'login' ? 'Sign in' : screen === 'signup' ? 'Create owner account' : screen === 'forgot' ? 'Send reset link' : 'Reset password'} <Icon name="arrow" />
              </Button>
            </form>
          )}

          {screen === 'login' && (
            <p className="switch">New to RestroVico? <button onClick={() => { setError(''); setNotice(''); setScreen('signup'); }}>Create owner account</button></p>
          )}
          {screen !== 'login' && screen !== 'verify' && (
            <p className="switch">Already have an account? <button onClick={() => { setError(''); setNotice(''); setScreen('login'); }}>Sign in</button></p>
          )}
        </div>
      </section>
    </main>
  );
}

function RestaurantForm({ restaurant, onSave, onCancel }) {
  const [form, setForm] = useState(restaurant ? {
    name: restaurant.name || '',
    type: restaurant.business_type || 'Restaurant',
    mobile: restaurant.mobile || '',
    email: restaurant.email || '',
    address: restaurant.address_line || '',
    city: restaurant.city || '',
    state: restaurant.state || '',
    pin: restaurant.pincode || '',
    gstin: restaurant.gstin || '',
    fssai: restaurant.fssai_no || ''
  } : {
    name: '', type: 'Restaurant', mobile: '', email: '', address: '', city: '', state: '', pin: '', gstin: '', fssai: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const upd = e => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        businessType: form.type,
        mobile: form.mobile,
        email: form.email,
        addressLine: form.address,
        city: form.city,
        state: form.state,
        pincode: form.pin,
        gstin: form.gstin,
        fssaiNo: form.fssai
      };

      let result;
      if (restaurant) {
        result = await api.restaurants.update(restaurant.id, payload);
      } else {
        result = await api.restaurants.create(payload);
      }
      onSave(result.data, restaurant ? 'updated' : 'created');
    } catch (err) {
      setError(err.message || 'Failed to save restaurant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page form-page">
      <div className="page-top">
        <div>
          <p className="eyebrow">RESTAURANTS</p>
          <h1>{restaurant ? 'Edit restaurant' : 'Add a restaurant'}</h1>
          <p className="muted">{restaurant ? 'Keep this location’s details accurate.' : 'Add the minimum details to get this location ready.'}</p>
        </div>
        <Button kind="ghost" onClick={onCancel}>Cancel</Button>
      </div>

      {error && <div className="notice error" style={{ marginBottom: '16px' }}>{error}</div>}

      <form className="card form-card" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Restaurant / outlet name">
            <input required name="name" value={form.name} onChange={upd} placeholder="e.g. Spice Garden - Noida" />
          </Field>
          <Field label="Business type">
            <select name="type" value={form.type} onChange={upd}>
              <option>Restaurant</option>
              <option>Cafe</option>
              <option>QSR</option>
              <option>Cloud Kitchen</option>
              <option>Food Court</option>
              <option>Other</option>
            </select>
          </Field>
          <Field label="Restaurant mobile">
            <input required name="mobile" value={form.mobile} onChange={upd} type="tel" placeholder="+91 98765 43210" />
          </Field>
          <Field label="Restaurant email (optional)">
            <input type="email" name="email" value={form.email} onChange={upd} placeholder="ops@example.com" />
          </Field>
          <Field label="Address">
            <input required name="address" value={form.address} onChange={upd} placeholder="Building, street, locality" />
          </Field>
          <Field label="City">
            <input required name="city" value={form.city} onChange={upd} placeholder="City" />
          </Field>
          <Field label="State">
            <input required name="state" value={form.state} onChange={upd} placeholder="State" />
          </Field>
          <Field label="PIN code">
            <input required name="pin" value={form.pin} onChange={upd} inputMode="numeric" pattern="[0-9]{6}" placeholder="6-digit PIN" />
          </Field>
          <Field label="GSTIN (optional)">
            <input name="gstin" value={form.gstin} onChange={upd} placeholder="22AAAAA0000A1Z5" />
          </Field>
          <Field label="FSSAI Number (optional)">
            <input name="fssai" value={form.fssai} onChange={upd} placeholder="14-digit FSSAI License" />
          </Field>
        </div>
        <div className="form-actions">
          <Button kind="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save restaurant'} <Icon name="arrow" />
          </Button>
        </div>
      </form>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [mode, setMode] = useState('dashboard');
  const [restaurants, setRestaurants] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, archived: 0 });
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Boot check
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api.owner.getProfile()
        .then(res => {
          setUser(res.data);
        })
        .catch(() => {
          api.clearTokens();
          setUser(null);
        })
        .finally(() => setBooting(false));
    } else {
      setBooting(false);
    }
  }, []);

  // Fetch restaurants when authenticated or filter changes
  const fetchRestaurants = async () => {
    if (!user) return;
    try {
      const res = await api.restaurants.list({ search: searchQuery, status: statusFilter });
      setRestaurants(res.data.restaurants || []);
      if (res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRestaurants();
    }
  }, [user, searchQuery, statusFilter]);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (userData.restaurantCount === 0) {
      setMode('onboarding');
    } else {
      setMode('dashboard');
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setRestaurants([]);
    setEditing(null);
    setMode('dashboard');
  };

  const handleSaveRestaurant = (record, action) => {
    setToast(`Restaurant ${action === 'created' ? 'added' : 'updated'} successfully.`);
    setEditing(null);
    fetchRestaurants();
    setMode('restaurants');
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.restaurants.updateStatus(id, newStatus);
      setToast(`Restaurant status updated to ${newStatus}.`);
      fetchRestaurants();
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  if (booting) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', fontFamily: 'sans-serif' }}>Loading RestroVico…</div>;
  }

  if (!user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  if (mode === 'onboarding' && restaurants.length === 0) {
    return (
      <main className="onboarding">
        <div className="brand"><Mark /><b>RestroVico</b></div>
        <section>
          <p className="eyebrow">STEP 1 OF 1</p>
          <h1>Let’s add your first restaurant.</h1>
          <p className="muted">This gives your workspace a home. You can add more locations any time.</p>
          <div className="onboard-actions">
            <Button onClick={() => setMode('new')}>Add first restaurant <Icon name="arrow" /></Button>
            <Button kind="ghost" onClick={() => setMode('dashboard')}>I’ll do this later</Button>
          </div>
        </section>
        <div className="onboard-progress">
          <span></span><b>Restaurant setup</b><small>Owner account complete</small>
        </div>
      </main>
    );
  }

  if (mode === 'new' || editing) {
    return (
      <Shell mode={mode} setMode={setMode} user={user} onLogout={handleLogout}>
        <RestaurantForm
          restaurant={editing}
          onSave={handleSaveRestaurant}
          onCancel={() => { setEditing(null); setMode('restaurants'); }}
        />
      </Shell>
    );
  }

  return (
    <Shell mode={mode} setMode={setMode} user={user} onLogout={handleLogout}>
      <main className="page">
        {toast && (
          <div className="toast">
            ✓ {toast}
            <button onClick={() => setToast('')}>×</button>
          </div>
        )}

        {mode === 'dashboard' ? (
          <>
            <div className="page-top">
              <div>
                <p className="eyebrow">OWNER OVERVIEW</p>
                <h1>Good morning, {user.fullName || user.full_name}.</h1>
                <p className="muted">Here’s your restaurant group at a glance.</p>
              </div>
              <Button onClick={() => setMode('new')}><Icon name="plus" /> Add restaurant</Button>
            </div>

            <div className="stats">
              <article>
                <span>Total restaurants</span>
                <strong>{summary.total || restaurants.length}</strong>
                <small>Across your restaurant group</small>
              </article>
              <article>
                <span>Active locations</span>
                <strong>{summary.active || 0}</strong>
                <small>Ready for operations</small>
              </article>
              <article>
                <span>Workspace status</span>
                <strong className="ready">Ready</strong>
                <small>Owner account verified</small>
              </article>
            </div>

            <section className="section-head">
              <div>
                <h2>Your restaurants</h2>
                <p className="muted">Manage your locations and their setup details.</p>
              </div>
              <button className="link" onClick={() => setMode('restaurants')}>View all <Icon name="arrow" /></button>
            </section>

            <RestaurantCards
              restaurants={restaurants.slice(0, 3)}
              onEdit={r => setEditing(r)}
              onStatusChange={handleStatusChange}
            />
          </>
        ) : mode === 'restaurants' ? (
          <>
            <div className="page-top">
              <div>
                <p className="eyebrow">RESTAURANTS</p>
                <h1>All locations</h1>
                <p className="muted">{summary.total || restaurants.length} locations in your restaurant group.</p>
              </div>
              <Button onClick={() => setMode('new')}><Icon name="plus" /> Add restaurant</Button>
            </div>

            <div className="toolbar">
              <input
                aria-label="Search restaurants"
                placeholder="Search by name, city or code…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                aria-label="Filter restaurant status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <RestaurantCards
              restaurants={restaurants}
              onEdit={r => setEditing(r)}
              onStatusChange={handleStatusChange}
            />
          </>
        ) : (
          <Profile user={user} setUser={setUser} setToast={setToast} />
        )}
      </main>
    </Shell>
  );
}

function RestaurantCards({ restaurants, onEdit, onStatusChange }) {
  if (!restaurants || restaurants.length === 0) {
    return <div className="card" style={{ padding: '32px', textTransform: 'none', textAlign: 'center', color: '#666' }}>No restaurants found.</div>;
  }

  return (
    <div className="restaurants">
      {restaurants.map(r => (
        <article className="restaurant" key={r.id}>
          <div className="restaurant-symbol">{r.name ? r.name.slice(0, 1) : 'R'}</div>
          <div className="restaurant-info">
            <div>
              <h3>{r.name}</h3>
              <span>{r.business_type} · {r.city}</span>
            </div>
            <p>
              <b>{r.restaurant_code}</b>
              <i className={(r.status || 'ACTIVE').toLowerCase()}></i>
              {r.status || 'ACTIVE'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button className="edit" onClick={() => onEdit(r)}>Edit <Icon name="arrow" /></button>
            {r.status === 'ACTIVE' ? (
              <button className="text-button" style={{ color: '#d97706', fontSize: '13px' }} onClick={() => onStatusChange(r.id, 'INACTIVE')}>Deactivate</button>
            ) : r.status === 'INACTIVE' ? (
              <button className="text-button" style={{ color: '#059669', fontSize: '13px' }} onClick={() => onStatusChange(r.id, 'ACTIVE')}>Activate</button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function Profile({ user, setUser, setToast }) {
  const [editingProfile, setEditingProfile] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [fullName, setFullName] = useState(user.fullName || user.full_name || '');
  const [mobile, setMobile] = useState(user.mobile || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setLoading(true);
    try {
      const res = await api.owner.updateProfile({ fullName, mobile });
      setUser({ ...user, fullName: res.data.fullName, mobile: res.data.mobile });
      setToast('Profile updated successfully.');
      setEditingProfile(false);
    } catch (error) {
      setErr(error.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setMsg(''); setErr(''); setLoading(true);
    try {
      await api.owner.changePassword({ currentPassword, newPassword, confirmPassword });
      setToast('Password changed successfully.');
      setChangingPass(false);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) {
      setErr(error.message || 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-top">
        <div>
          <p className="eyebrow">PROFILE & SETTINGS</p>
          <h1>Your owner account</h1>
          <p className="muted">Manage the details connected to your workspace.</p>
        </div>
      </div>

      {err && <div className="notice error" style={{ marginBottom: '16px' }}>{err}</div>}

      <section className="profile card">
        <div className="avatar">
          {(user.fullName || user.full_name || 'O').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2>{user.fullName || user.full_name}</h2>
          <p className="muted">Owner · {user.email} · {user.mobile}</p>
        </div>
        <Button kind="ghost" onClick={() => setEditingProfile(!editingProfile)}>
          {editingProfile ? 'Cancel' : 'Edit profile'}
        </Button>
      </section>

      {editingProfile && (
        <form className="card form-card" onSubmit={handleUpdateProfile} style={{ marginTop: '16px' }}>
          <h3>Edit Owner Details</h3>
          <div className="form-grid" style={{ margin: '16px 0' }}>
            <Field label="Full Name">
              <input required value={fullName} onChange={e => setFullName(e.target.value)} />
            </Field>
            <Field label="Mobile Number">
              <input required type="tel" value={mobile} onChange={e => setMobile(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving…' : 'Save Changes'}
          </Button>
        </form>
      )}

      <section className="settings card" style={{ marginTop: '24px' }}>
        <div>
          <h3>Sign-in & security</h3>
          <p>Update your password to keep your account protected.</p>
        </div>
        <Button kind="ghost" onClick={() => setChangingPass(!changingPass)}>
          {changingPass ? 'Cancel' : 'Change password'}
        </Button>
      </section>

      {changingPass && (
        <form className="card form-card" onSubmit={handleChangePassword} style={{ marginTop: '16px' }}>
          <h3>Change Password</h3>
          <div className="form-grid" style={{ margin: '16px 0' }}>
            <Field label="Current Password">
              <input required type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </Field>
            <Field label="New Password">
              <input required type="password" minLength="8" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </Field>
            <Field label="Confirm New Password">
              <input required type="password" minLength="8" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      )}
    </>
  );
}

function Shell({ children, mode, setMode, user, onLogout }) {
  const nav = [
    ['dashboard', 'Dashboard', 'grid'],
    ['restaurants', 'Restaurants', 'store'],
    ['profile', 'Profile & settings', 'user']
  ];

  const initials = (user.fullName || user.full_name || 'O').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Mark /><b>RestroVico</b></div>
        <nav>
          {nav.map(([id, label, icon]) => (
            <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>
              <Icon name={icon} />{label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="owner">
            <div className="avatar">{initials}</div>
            <span>
              <b>{user.fullName || user.full_name}</b>
              <small>Owner</small>
            </span>
          </div>
          <button className="logout" onClick={onLogout}><Icon name="logout" /> Log out</button>
        </div>
      </aside>

      <div className="content">{children}</div>

      <nav className="bottom-nav">
        {nav.map(([id, label, icon]) => (
          <button key={id} className={mode === id ? 'active' : ''} onClick={() => setMode(id)}>
            <Icon name={icon} /><span>{label.split(' ')[0]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
