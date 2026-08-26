// RestroVico Production API Client - Cache-busting build v1.0.4
const API_BASE = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:4000/api/v1'
    : 'https://restrovico-api-production.up.railway.app/api/v1'
);

function getAuthHeader() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const config = {
    mode: 'cors',
    ...options,
    headers
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.message || 'An API error occurred.');
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    if (!err.status) {
      err.message = err.message || 'Network error / Unable to connect to backend server.';
    }
    throw err;
  }
}

export const api = {
  setTokens(accessToken, refreshToken) {
    if (accessToken) localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
  },

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  auth: {
    signup(data) {
      return request('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    verifyEmail(token) {
      return request('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
    },

    resendVerification(email) {
      return request('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },

    login(identifier, password) {
      return request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password })
      });
    },

    forgotPassword(email) {
      return request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },

    resetPassword(token, newPassword, confirmPassword) {
      return request('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword, confirmPassword })
      });
    },

    async logout() {
      const refreshToken = localStorage.getItem('refresh_token');
      try {
        await request('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken })
        });
      } catch (e) {
        // ignore logout network errors
      }
      api.clearTokens();
    }
  },

  owner: {
    getProfile() {
      return request('/me');
    },

    updateProfile(data) {
      return request('/me', {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },

    changePassword(data) {
      return request('/me/change-password', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    }
  },

  restaurants: {
    list(params = {}) {
      const query = new URLSearchParams();
      if (params.search) query.append('search', params.search);
      if (params.status) query.append('status', params.status);
      const queryString = query.toString() ? `?${query.toString()}` : '';
      return request(`/restaurants${queryString}`);
    },

    create(data) {
      return request('/restaurants', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },

    get(id) {
      return request(`/restaurants/${id}`);
    },

    update(id, data) {
      return request(`/restaurants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    },

    updateStatus(id, status) {
      return request(`/restaurants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
    }
  }
};
