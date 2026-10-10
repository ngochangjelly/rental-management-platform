class UserManagement {
  constructor() {
    // Singleton pattern - return existing instance if it exists
    if (window.userManagement) {
      console.log('⚠️ UserManagement already exists, returning existing instance');
      return window.userManagement;
    }

    this.users = [];
    this.properties = [];
    this.currentUser = null;
    this.editingUserId = null;
    this.userModal = null;
    this.isLoadingUsers = false; // Prevent duplicate loads

    // Set global instance immediately
    window.userManagement = this;

    this.init();
  }

  async init() {
    console.log('🔧 Initializing User Management');

    // Initialize Bootstrap modal
    const modalElement = document.getElementById('userModal');
    if (modalElement) {
      this.userModal = new bootstrap.Modal(modalElement);
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load users when section is shown
    const usersSection = document.getElementById('users-section');
    if (usersSection) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'style') {
            const isVisible = usersSection.style.display !== 'none';
            if (isVisible) {
              this.loadUsers();
            }
          }
        });
      });

      observer.observe(usersSection, {
        attributes: true,
        attributeFilter: ['style']
      });

      // Check initial state in case the section was shown before initialization
      if (usersSection.style.display !== 'none') {
        this.loadUsers();
      }
    }
  }

  setupEventListeners() {
    // Add user button
    const addUserBtn = document.getElementById('addUserBtn');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => this.showAddUserModal());
    }

    // User form submit
    const userForm = document.getElementById('userForm');
    if (userForm) {
      userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleUserSubmit();
      });
    }

    // Module access controls
    const roleSelect = document.getElementById('userRole');
    if (roleSelect) {
      roleSelect.addEventListener('change', () => this.updateModuleAccessForRole());
    }
    document.getElementById('moduleSelectAllBtn')?.addEventListener('click', () => this.setAllModules(true));
    document.getElementById('moduleSelectNoneBtn')?.addEventListener('click', () => this.setAllModules(false));

    // Toggle password visibility
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    if (togglePasswordBtn) {
      togglePasswordBtn.addEventListener('click', (e) => this.togglePasswordVisibility(e));
    }

    // Modal reset on close
    const modalElement = document.getElementById('userModal');
    if (modalElement) {
      modalElement.addEventListener('hidden.bs.modal', () => {
        this.resetForm();
      });
    }
  }

  async loadUsers() {
    if (this.isLoadingUsers) return; // Prevent concurrent loads

    try {
      this.isLoadingUsers = true;
      console.log('📋 Loading users');
      const response = await API.get(API_CONFIG.ENDPOINTS.USERS);
      const data = await response.json();

      if (data.success) {
        this.users = data.users || [];
        console.log('✅ Loaded users:', this.users.length, 'users');
        this.renderUsers();
        this.updateUsersBadge();
      } else {
        throw new Error(data.message || 'Failed to load users');
      }
    } catch (error) {
      console.error('❌ Error loading users:', error);
      this.showError('Failed to load users');
      document.getElementById('usersTableBody').innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Failed to load users. Please try again.
          </td>
        </tr>
      `;
    } finally {
      this.isLoadingUsers = false;
    }
  }

  async loadProperties() {
    try {
      console.log('📋 Loading properties for access selection');

      // Fetch all properties with pagination
      let allProperties = [];
      let currentPage = 1;
      const itemsPerPage = 50;
      let hasMorePages = true;

      while (hasMorePages) {
        const response = await API.get(`${API_CONFIG.ENDPOINTS.PROPERTIES}?page=${currentPage}&limit=${itemsPerPage}`);

        // Handle non-JSON responses (e.g., "Network unavailable" from service worker)
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          throw new Error('Network unavailable or invalid response');
        }

        if (data.success) {
          allProperties = allProperties.concat(data.properties || []);
          hasMorePages = data.pagination && currentPage < data.pagination.totalPages;
          currentPage++;
        } else {
          throw new Error(data.message || 'Failed to load properties');
        }
      }

      this.properties = allProperties;

      // Check if current user is an investor and filter properties accordingly
      await this.filterPropertiesByInvestor();

      this.renderPropertyCheckboxes();
    } catch (error) {
      console.error('❌ Error loading properties:', error);
      const container = document.getElementById('propertyAccessContainer');
      if (container) {
        container.innerHTML = `
          <div class="text-center text-danger">
            <i class="bi bi-exclamation-triangle"></i>
            <p class="mt-2 mb-0">Failed to load properties</p>
          </div>
        `;
      }
    }
  }

  async filterPropertiesByInvestor() {
    try {
      const investorPropertyIds = await getInvestorPropertyIds();

      // If null, user is not an investor - show all properties
      if (investorPropertyIds === null) {
        console.log('ℹ️ User is not an investor, showing all properties for user management');
        return;
      }

      // Filter to show only investor's properties
      console.log('🔍 Filtering user management properties for investor:', investorPropertyIds);
      const originalCount = this.properties.length;
      this.properties = this.properties.filter(property =>
        investorPropertyIds.includes(property.propertyId)
      );
      console.log(`📊 Filtered user management properties: ${originalCount} → ${this.properties.length}`);
    } catch (error) {
      console.error('❌ Error filtering user management properties by investor:', error);
      // Don't throw - just log and continue with all properties
    }
  }

  renderPropertyCheckboxes(selectedProperties = []) {
    const container = document.getElementById('propertyAccessContainer');
    if (!container) return;

    if (this.properties.length === 0) {
      container.innerHTML = `
        <div class="text-center text-muted">
          <i class="bi bi-inbox"></i>
          <p class="mt-2 mb-0">No properties available</p>
        </div>
      `;
      return;
    }

    container.innerHTML = this.properties.map(property => {
      const isChecked = selectedProperties.includes(property.propertyId);
      return `
        <div class="form-check mb-2">
          <input
            class="form-check-input property-access-checkbox"
            type="checkbox"
            value="${property.propertyId}"
            id="property-${property.propertyId}"
            ${isChecked ? 'checked' : ''}
          />
          <label class="form-check-label" for="property-${property.propertyId}">
            <strong>${property.propertyId}</strong> - ${property.address || 'N/A'}
          </label>
        </div>
      `;
    }).join('');
  }

  // Non-admins with the Users module can only grant modules they hold
  canGrantModule(key) {
    return isAdmin() || getModuleAccess().includes(key);
  }

  renderModuleCheckboxes(selectedModules = []) {
    const container = document.getElementById('moduleAccessContainer');
    if (!container) return;

    const groups = {};
    APP_MODULES.forEach(module => {
      (groups[module.group] = groups[module.group] || []).push(module);
    });

    container.innerHTML = `
      <div class="row g-3">
        ${Object.entries(groups).map(([group, modules]) => `
          <div class="col-sm-6">
            <div class="small text-uppercase text-muted fw-semibold mb-1">${group}</div>
            ${modules.map(module => `
              <div class="form-check">
                <input
                  class="form-check-input module-access-checkbox"
                  type="checkbox"
                  value="${module.key}"
                  id="module-${module.key}"
                  ${selectedModules.includes(module.key) ? 'checked' : ''}
                  ${this.canGrantModule(module.key) ? '' : 'disabled'}
                />
                <label class="form-check-label" for="module-${module.key}">
                  <i class="bi ${module.icon} me-1"></i>${module.label}
                </label>
              </div>
            `).join('')}
          </div>
        `).join('')}
      </div>
    `;

    this.updateModuleAccessForRole();
  }

  // Admins always have every module, so the picker is locked for them
  updateModuleAccessForRole() {
    const isAdminRole = document.getElementById('userRole')?.value === 'admin';
    document.querySelectorAll('.module-access-checkbox').forEach(cb => {
      if (isAdminRole) {
        cb.dataset.wasChecked = cb.checked;
        cb.checked = true;
        cb.disabled = true;
      } else {
        if (cb.dataset.wasChecked !== undefined) {
          cb.checked = cb.dataset.wasChecked === 'true';
          delete cb.dataset.wasChecked;
        }
        cb.disabled = !this.canGrantModule(cb.value);
      }
    });

    ['moduleSelectAllBtn', 'moduleSelectNoneBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = isAdminRole;
    });

    const help = document.getElementById('moduleAccessHelp');
    if (help) {
      help.textContent = isAdminRole
        ? 'Admins can access every module.'
        : 'Sidebar modules this user can open. Dashboard is always available.';
    }
  }

  setAllModules(checked) {
    document.querySelectorAll('.module-access-checkbox:not(:disabled)').forEach(cb => {
      cb.checked = checked;
    });
  }

  renderModuleSummary(user) {
    if (user.role === 'admin') {
      return '<span class="text-muted">All modules</span>';
    }
    const labels = APP_MODULES
      .filter(m => getModuleAccess(user).includes(m.key))
      .map(m => m.label);
    if (labels.length === 0) {
      return '<span class="text-muted">No access</span>';
    }
    return `<span class="small">${this.escapeHtml(labels.join(', '))}</span>`;
  }

  renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-muted">
            No users found. Click "Add User" to create one.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.users.map(user => `
      <tr>
        <td data-label="Username">
          <strong>${this.escapeHtml(user.username)}</strong>
        </td>
        <td data-label="Role">
          <span class="badge bg-${user.role === 'admin' ? 'danger' : 'primary'}">
            ${user.role.toUpperCase()}
          </span>
        </td>
        <td data-label="Modules">
          ${this.renderModuleSummary(user)}
        </td>
        <td data-label="Property Access">
          ${user.role === 'admin'
            ? '<span class="text-muted">All Properties</span>'
            : user.propertyAccess && user.propertyAccess.length > 0
              ? `<span class="badge bg-info">${user.propertyAccess.length} ${user.propertyAccess.length === 1 ? 'property' : 'properties'}</span>`
              : '<span class="text-muted">No access</span>'
          }
        </td>
        <td data-label="Created">${new Date(user.createdAt).toLocaleDateString()}</td>
        <td data-label="Actions">
          ${user.role === 'admin' && !isAdmin() ? '<span class="text-muted small">Admin only</span>' : `
          <button
            class="btn btn-sm btn-outline-primary me-1"
            onclick="userManagement.editUser('${user._id}')"
            title="Edit"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button
            class="btn btn-sm btn-outline-danger"
            onclick="userManagement.deleteUser('${user._id}', '${this.escapeHtml(user.username)}')"
            title="Delete"
          >
            <i class="bi bi-trash"></i>
          </button>`}
        </td>
      </tr>
    `).join('');
  }

  async showAddUserModal() {
    this.editingUserId = null;
    this.resetForm();

    // Update modal title
    document.getElementById('userModalLabel').textContent = 'Add User';
    document.getElementById('userSubmitText').textContent = 'Add User';

    // Password is required for new users
    const passwordInput = document.getElementById('userPassword');
    if (passwordInput) {
      passwordInput.required = true;
    }

    // New users start with no modules; the admin picks what they need
    this.restrictRoleOptions();
    this.renderModuleCheckboxes([]);

    // Load properties
    await this.loadProperties();

    // Show modal
    if (this.userModal) {
      this.userModal.show();
    }
  }

  async editUser(userId) {
    console.log('🔍 Edit user called with ID:', userId);
    console.log('🔍 Current users array:', this.users);
    const user = this.users.find(u => u._id === userId);
    if (!user) {
      console.error('❌ User not found in array. Looking for:', userId, 'Available IDs:', this.users.map(u => u._id));
      this.showError('User not found');
      return;
    }
    console.log('✅ Found user:', user);

    this.editingUserId = userId;

    // Update modal title
    document.getElementById('userModalLabel').textContent = 'Edit User';
    document.getElementById('userSubmitText').textContent = 'Update User';

    // Populate form
    document.getElementById('userUsername').value = user.username;
    document.getElementById('userPassword').value = '';
    this.restrictRoleOptions();
    document.getElementById('userRole').value = user.role;
    this.renderModuleCheckboxes(getModuleAccess(user));

    // Password is optional when editing
    const passwordInput = document.getElementById('userPassword');
    if (passwordInput) {
      passwordInput.required = false;
    }

    // Load properties and select the ones user has access to
    await this.loadProperties();
    this.renderPropertyCheckboxes(user.propertyAccess || []);

    // Show modal
    if (this.userModal) {
      this.userModal.show();
    }
  }

  async handleUserSubmit() {
    const submitBtn = document.getElementById('userSubmitBtn');
    const submitText = document.getElementById('userSubmitText');
    const originalText = submitText.textContent;

    try {
      // Disable submit button
      submitBtn.disabled = true;
      submitText.textContent = this.editingUserId ? 'Updating...' : 'Adding...';

      // Get form data
      const username = document.getElementById('userUsername').value.trim();
      const password = document.getElementById('userPassword').value;
      const role = document.getElementById('userRole').value;

      // Get selected properties
      const propertyCheckboxes = document.querySelectorAll('.property-access-checkbox:checked');
      const propertyAccess = Array.from(propertyCheckboxes).map(cb => cb.value);

      // Get selected modules (ignored by the backend for admins)
      const moduleCheckboxes = document.querySelectorAll('.module-access-checkbox:checked');
      const moduleAccess = Array.from(moduleCheckboxes).map(cb => cb.value);

      // Validate
      if (!username) {
        throw new Error('Username is required');
      }

      if (!this.editingUserId && !password) {
        throw new Error('Password is required for new users');
      }

      // Prepare data
      const userData = {
        username,
        role,
        propertyAccess,
        moduleAccess
      };

      // Only include password if provided
      if (password) {
        userData.password = password;
      }

      // Submit
      let response;
      if (this.editingUserId) {
        response = await API.put(`${API_CONFIG.ENDPOINTS.USERS}/${this.editingUserId}`, userData);
      } else {
        response = await API.post(API_CONFIG.ENDPOINTS.USERS, userData);
      }

      const data = await response.json();

      if (data.success) {
        this.showSuccess(this.editingUserId ? 'User updated successfully' : 'User created successfully');

        // Reload users first
        await this.loadUsers();

        // Then close modal
        if (this.userModal) {
          this.userModal.hide();
        }
      } else {
        throw new Error(data.message || 'Failed to save user');
      }
    } catch (error) {
      console.error('❌ Error saving user:', error);
      this.showError(error.message || 'Failed to save user');
    } finally {
      // Re-enable submit button
      submitBtn.disabled = false;
      submitText.textContent = originalText;
    }
  }

  async deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await API.delete(`${API_CONFIG.ENDPOINTS.USERS}/${userId}`);
      const data = await response.json();

      if (data.success) {
        this.showSuccess('User deleted successfully');
        await this.loadUsers();
      } else {
        throw new Error(data.message || 'Failed to delete user');
      }
    } catch (error) {
      console.error('❌ Error deleting user:', error);
      this.showError(error.message || 'Failed to delete user');
    }
  }

  // Only admins can create or promote admins
  restrictRoleOptions() {
    const adminOption = document.querySelector('#userRole option[value="admin"]');
    if (adminOption) {
      adminOption.hidden = !isAdmin();
      adminOption.disabled = !isAdmin();
    }
  }

  resetForm() {
    const form = document.getElementById('userForm');
    if (form) {
      form.reset();
    }

    this.editingUserId = null;

    // Reset password requirement
    const passwordInput = document.getElementById('userPassword');
    if (passwordInput) {
      passwordInput.required = true;
      passwordInput.type = 'password'; // Reset to hidden
    }

    // Reset password toggle icon
    const toggleIcon = document.getElementById('togglePasswordIcon');
    if (toggleIcon) {
      toggleIcon.classList.remove('bi-eye-slash');
      toggleIcon.classList.add('bi-eye');
    }

    // Clear property checkboxes
    const container = document.getElementById('propertyAccessContainer');
    if (container) {
      container.innerHTML = `
        <div class="text-center text-muted">
          <div class="spinner-border spinner-border-sm" role="status">
            <span class="visually-hidden">Loading properties...</span>
          </div>
          <p class="mt-2 mb-0">Loading properties...</p>
        </div>
      `;
    }
  }

  updateUsersBadge() {
    const badge = document.getElementById('usersBadge');
    if (badge) {
      badge.textContent = this.users.length;
    }
  }

  showSuccess(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'success');
    } else {
      alert(message);
    }
  }

  showError(message) {
    if (typeof showToast === 'function') {
      showToast(message, 'error');
    } else {
      alert(message);
    }
  }

  togglePasswordVisibility(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const passwordInput = document.getElementById('userPassword');
    const toggleIcon = document.getElementById('togglePasswordIcon');

    if (passwordInput && toggleIcon) {
      const isPassword = passwordInput.type === 'password';

      if (isPassword) {
        // Show password
        passwordInput.type = 'text';
        passwordInput.setAttribute('type', 'text');
        toggleIcon.classList.remove('bi-eye');
        toggleIcon.classList.add('bi-eye-slash');
        toggleIcon.setAttribute('aria-label', 'Hide password');
      } else {
        // Hide password
        passwordInput.type = 'password';
        passwordInput.setAttribute('type', 'password');
        toggleIcon.classList.remove('bi-eye-slash');
        toggleIcon.classList.add('bi-eye');
        toggleIcon.setAttribute('aria-label', 'Show password');
      }

      // Force a reflow
      void passwordInput.offsetHeight;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Make component globally accessible
window.UserManagement = UserManagement;
