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
    this.listQuery = ''; // search box on the users list
    this.listRole = 'all'; // all | user | admin

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

    // Users list: search, role filter, tap a row to edit
    document.getElementById('umSearch')?.addEventListener('input', (e) => {
      this.listQuery = e.target.value.trim().toLowerCase();
      this.renderUsers();
    });
    document.getElementById('umRoleFilter')?.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-role]');
      if (!btn) return;
      this.listRole = btn.dataset.role;
      document.querySelectorAll('#umRoleFilter button').forEach(b =>
        b.classList.toggle('active', b === btn));
      this.renderUsers();
    });
    const list = document.getElementById('usersTableBody');
    list?.addEventListener('click', (e) => {
      if (e.target.closest('button, a')) return; // Edit/Delete have their own handlers
      const row = e.target.closest('.um-row[data-edit]');
      if (row) this.editUser(row.dataset.edit);
    });
    list?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('.um-row[data-edit]');
      if (row && e.target === row) {
        e.preventDefault();
        this.editUser(row.dataset.edit);
      }
    });

    // Dialog: role cards drive the hidden #userRole select
    document.querySelectorAll('input[name="umRoleChoice"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const select = document.getElementById('userRole');
        if (!select || !radio.checked) return;
        select.value = radio.value;
        select.dispatchEvent(new Event('change'));
      });
    });

    // Dialog: property filter + select all/none (visible rows only)
    document.getElementById('umPropertySearch')?.addEventListener('input', () => this.filterPropertyList());
    document.getElementById('umPropertySelectAllBtn')?.addEventListener('click', () => this.setVisibleProperties(true));
    document.getElementById('umPropertySelectNoneBtn')?.addEventListener('click', () => this.setVisibleProperties(false));
    document.getElementById('umGeneratePasswordBtn')?.addEventListener('click', () => this.generatePassword());

    // Live "x of y" counters
    document.getElementById('userForm')?.addEventListener('change', () => this.updateAccessCounters());

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
        <div class="um-empty text-danger">
          <i class="bi bi-exclamation-triangle text-danger"></i>
          Failed to load users. Please try again.
        </div>
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
      this.updateAccessCounters();
      return;
    }

    // Only one property to grant: tick it for new users so it isn't missed.
    // Existing users keep exactly what they were given.
    const autoSelectSole = this.properties.length === 1 && !this.editingUserId;

    container.innerHTML = this.properties.map(property => {
      const isChecked = autoSelectSole || selectedProperties.includes(property.propertyId);
      const address = [property.address || 'N/A', property.unit].filter(Boolean).join(' ');
      return `
        <label class="um-prop-item" for="property-${property.propertyId}">
          <input
            class="form-check-input property-access-checkbox"
            type="checkbox"
            value="${property.propertyId}"
            id="property-${property.propertyId}"
            ${isChecked ? 'checked' : ''}
          />
          <span class="um-prop-id">${this.escapeHtml(String(property.propertyId))}</span>
          <span class="um-prop-addr" title="${this.escapeHtml(address)}">${this.escapeHtml(address)}</span>
        </label>
      `;
    }).join('');
    this.filterPropertyList();
    this.updateAccessCounters();
  }

  // Hide property rows that don't match the dialog's filter box
  filterPropertyList() {
    const words = (document.getElementById('umPropertySearch')?.value || '')
      .trim().toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll('#propertyAccessContainer .um-prop-item').forEach(item => {
      const text = item.textContent.toLowerCase();
      item.hidden = !words.every(w => text.includes(w));
    });
  }

  setVisibleProperties(checked) {
    document.querySelectorAll('#propertyAccessContainer .um-prop-item:not([hidden]) .property-access-checkbox')
      .forEach(cb => { cb.checked = checked; });
    this.updateAccessCounters();
  }

  updateAccessCounters() {
    const count = (selector) => document.querySelectorAll(selector).length;
    const modules = document.getElementById('umModuleCount');
    if (modules) {
      const total = count('.module-access-checkbox');
      modules.textContent = total ? `${count('.module-access-checkbox:checked')} of ${total}` : '';
    }
    const props = document.getElementById('umPropertyCount');
    if (props) {
      const total = count('.property-access-checkbox');
      props.textContent = total ? `${count('.property-access-checkbox:checked')} of ${total}` : '';
    }
  }

  // Strong random password, shown so it can be copied to the new user
  generatePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(12);
    crypto.getRandomValues(bytes);
    const password = Array.from(bytes, b => chars[b % chars.length]).join('');
    const input = document.getElementById('userPassword');
    if (!input) return;
    input.value = password;
    if (input.type === 'password') this.togglePasswordVisibility();
    input.focus();
    input.select();
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

    // Toggle tiles (Bootstrap btn-check): the inputs are still the
    // .module-access-checkbox checkboxes the submit reads
    container.innerHTML = Object.entries(groups).map(([group, modules]) => `
      <div class="um-mod-group">
        <div class="um-mod-group-title">${group}</div>
        <div class="um-mod-grid">
          ${modules.map(module => `
            <input
              class="btn-check module-access-checkbox"
              type="checkbox"
              value="${module.key}"
              id="module-${module.key}"
              autocomplete="off"
              ${selectedModules.includes(module.key) ? 'checked' : ''}
              ${this.canGrantModule(module.key) ? '' : 'disabled'}
            />
            <label class="btn" for="module-${module.key}">
              <i class="bi ${module.icon}"></i>${module.label}
              <i class="bi bi-check-circle-fill um-check"></i>
            </label>
          `).join('')}
        </div>
      </div>
    `).join('');

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

    this.syncRoleCards();
    this.updateAccessCounters();
  }

  syncPasswordRequired() {
    const star = document.getElementById('umPasswordRequired');
    if (star) star.hidden = !document.getElementById('userPassword')?.required;
  }

  // Mirror the hidden #userRole select onto the role cards
  syncRoleCards() {
    const select = document.getElementById('userRole');
    if (!select) return;
    document.querySelectorAll('.um-role-card').forEach(card => {
      const option = select.querySelector(`option[value="${card.dataset.role}"]`);
      const radio = card.querySelector('input');
      card.hidden = !option || option.disabled;
      const active = select.value === card.dataset.role;
      card.classList.toggle('is-active', active);
      if (radio) radio.checked = active;
    });
  }

  setAllModules(checked) {
    document.querySelectorAll('.module-access-checkbox:not(:disabled)').forEach(cb => {
      cb.checked = checked;
    });
    this.updateAccessCounters();
  }

  // Module access for the list: count + a row of module icons
  renderModuleSummary(user) {
    if (user.role === 'admin') {
      return '<span class="um-modules-label">All modules</span>';
    }
    const granted = APP_MODULES.filter(m => getModuleAccess(user).includes(m.key));
    if (granted.length === 0) {
      return '<span class="um-modules-label none">No modules</span>';
    }
    const shown = granted.slice(0, 8);
    const names = this.escapeHtml(granted.map(m => m.label).join(', '));
    return `
      <span class="um-modules-label">${granted.length} of ${APP_MODULES.length} modules</span>
      <span class="um-icons" title="${names}">
        ${shown.map(m => `<span class="um-icon"><i class="bi ${m.icon}"></i></span>`).join('')}
        ${granted.length > shown.length ? `<span class="um-icon more">+${granted.length - shown.length}</span>` : ''}
      </span>`;
  }

  renderPropertySummary(user) {
    if (user.role === 'admin') {
      return '<span class="um-props"><i class="bi bi-buildings"></i>All properties</span>';
    }
    const n = user.propertyAccess?.length || 0;
    if (n === 0) return '<span class="um-props none"><i class="bi bi-buildings"></i>No properties</span>';
    return `<span class="um-props" title="Property IDs: ${this.escapeHtml(user.propertyAccess.join(', '))}">
      <i class="bi bi-buildings"></i>${n} ${n === 1 ? 'property' : 'properties'}</span>`;
  }

  renderUsers() {
    const list = document.getElementById('usersTableBody');
    if (!list) return;

    // Role filter counts
    const counts = {
      all: this.users.length,
      user: this.users.filter(u => u.role !== 'admin').length,
      admin: this.users.filter(u => u.role === 'admin').length,
    };
    document.querySelectorAll('#umRoleFilter [data-count]').forEach(el => {
      el.textContent = counts[el.dataset.count] ?? '';
    });

    if (this.users.length === 0) {
      list.innerHTML = `
        <div class="um-empty">
          <i class="bi bi-people"></i>
          No users yet. Click "Add user" to create one.
        </div>
      `;
      return;
    }

    const users = this.users.filter(user =>
      (this.listRole === 'all' || (this.listRole === 'admin') === (user.role === 'admin')) &&
      (!this.listQuery || user.username.toLowerCase().includes(this.listQuery)));

    if (users.length === 0) {
      list.innerHTML = `
        <div class="um-empty">
          <i class="bi bi-search"></i>
          No users match your search.
        </div>
      `;
      return;
    }

    list.innerHTML = users.map(user => {
      const canEdit = !(user.role === 'admin' && !isAdmin());
      const name = this.escapeHtml(user.username);
      const hue = [...user.username].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
      const created = new Date(user.createdAt).toLocaleDateString(undefined, {
        day: 'numeric', month: 'short', year: 'numeric',
      });
      return `
      <div class="um-row${canEdit ? ' is-clickable' : ''}"
        ${canEdit ? `data-edit="${user._id}" tabindex="0" role="button" aria-label="Edit ${name}"` : ''}>
        <div class="um-avatar" style="--h:${hue}" aria-hidden="true">${this.escapeHtml(user.username.charAt(0))}</div>
        <div class="um-main">
          <div class="um-name">
            <span>${name}</span>
            <span class="um-role um-role-${user.role === 'admin' ? 'admin' : 'user'}">${user.role}</span>
          </div>
          <div class="um-meta">Added ${created}</div>
        </div>
        <div class="um-access">
          <div class="um-modules">${this.renderModuleSummary(user)}</div>
          ${this.renderPropertySummary(user)}
        </div>
        <div class="um-actions">
          ${canEdit ? `
          <button
            class="btn btn-sm btn-outline-primary"
            onclick="userManagement.editUser('${user._id}')"
            title="Edit"
            aria-label="Edit ${name}"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button
            class="btn btn-sm btn-outline-danger"
            onclick="userManagement.deleteUser('${user._id}', '${name}')"
            title="Delete"
            aria-label="Delete ${name}"
          >
            <i class="bi bi-trash"></i>
          </button>` : '<span class="um-locked"><i class="bi bi-lock me-1"></i>Admin only</span>'}
        </div>
      </div>`;
    }).join('');
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
    this.syncPasswordRequired();

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
    this.syncPasswordRequired();

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

    const propertySearch = document.getElementById('umPropertySearch');
    if (propertySearch) propertySearch.value = '';

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
