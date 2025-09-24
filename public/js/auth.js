// JWT Authentication utility for client-side
class AuthManager {
  constructor() {
    this.refreshing = false;
    this.refreshPromise = null;
  }

  // Make authenticated API requests
  async makeRequest(url, options = {}) {
    try {
      // First attempt with current token
      let response = await fetch(url, {
        ...options,
        credentials: 'include', // Include cookies
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      // If unauthorized, try to refresh token
      if (response.status === 401 && !this.refreshing) {
        console.log('Token expired, attempting refresh...');
        
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the original request
          response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              ...options.headers
            }
          });
        }
      }

      return response;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }

  // Refresh the access token
  async refreshToken() {
    if (this.refreshing) {
      // If already refreshing, wait for that promise
      return await this.refreshPromise;
    }

    this.refreshing = true;
    this.refreshPromise = this._performRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshing = false;
      this.refreshPromise = null;
    }
  }

  async _performRefresh() {
    try {
      const response = await fetch('/auth/refresh-token', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Token refreshed successfully');
        return true;
      } else {
        console.error('Token refresh failed');
        this.logout();
        return false;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      this.logout();
      return false;
    }
  }

  // Logout and redirect
  logout() {
    window.location.href = '/auth/logout';
  }

  // Check if user is authenticated (client-side check only)
  isAuthenticated() {
    // This is a basic check - the server will verify the actual token
    return document.cookie.includes('accessToken');
  }

  // Login via API (for programmatic login)
  async login(email, password) {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Login successful');
        return { success: true, data };
      } else {
        console.error('Login failed:', data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  }

  // Setup automatic token refresh
  setupAutoRefresh() {
    // Refresh token every 14 minutes (1 minute before expiry)
    setInterval(() => {
      if (this.isAuthenticated()) {
        this.refreshToken();
      }
    }, 14 * 60 * 1000);
  }

  // Setup request interceptor for forms
  setupFormInterceptor() {
    document.addEventListener('submit', async (event) => {
      const form = event.target;
      
      // Only intercept forms with the 'jwt-form' class
      if (!form.classList.contains('jwt-form')) {
        return;
      }

      event.preventDefault();

      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      try {
        const response = await this.makeRequest(form.action, {
          method: form.method || 'POST',
          body: JSON.stringify(data)
        });

        if (response.ok) {
          const result = await response.json();
          
          // Handle successful form submission
          if (form.dataset.successRedirect) {
            window.location.href = form.dataset.successRedirect;
          } else if (form.dataset.successCallback) {
            window[form.dataset.successCallback](result);
          } else {
            console.log('Form submitted successfully:', result);
          }
        } else {
          const error = await response.json();
          console.error('Form submission failed:', error);
          
          if (form.dataset.errorCallback) {
            window[form.dataset.errorCallback](error);
          } else {
            alert('Error: ' + (error.error || 'Form submission failed'));
          }
        }
      } catch (error) {
        console.error('Form submission error:', error);
        if (form.dataset.errorCallback) {
          window[form.dataset.errorCallback]({ error: error.message });
        } else {
          alert('Network error occurred');
        }
      }
    });
  }
}

// Create global instance
const authManager = new AuthManager();

// Setup on page load
document.addEventListener('DOMContentLoaded', () => {
  authManager.setupAutoRefresh();
  authManager.setupFormInterceptor();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthManager;
}

// Global access
window.authManager = authManager;
