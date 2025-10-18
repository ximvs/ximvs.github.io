// Enhanced event system with dynamic functionality
const db = window.db;
const eventsRef = db.collection('events').doc('activeEvents');
const MAX_EVENTS = 6;

// Modal system
window.modal = {
  show: (title, content, type = 'info') => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    if (modal && modalTitle && modalContent) {
      modalTitle.textContent = title;
      modalContent.innerHTML = content;
      modal.style.display = 'flex';
    }
  },
  
  hide: () => {
    const modal = document.getElementById('custom-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  },
  
  showInput: (title, placeholder, callback, defaultValue = '') => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    if (modal && modalTitle && modalContent) {
      modalTitle.textContent = title;
      modalContent.innerHTML = `
        <input type="text" id="modal-input" class="modal-input" placeholder="${placeholder}" value="${defaultValue}" autofocus>
        <div class="modal-buttons">
          <button class="modal-btn modal-btn-secondary" onclick="window.modal.hide()">Cancel</button>
          <button class="modal-btn modal-btn-primary" onclick="window.modal.submitInput()">OK</button>
        </div>
      `;
      modal.style.display = 'flex';
      
      window.modal.currentCallback = callback;
      
      setTimeout(() => {
        const input = document.getElementById('modal-input');
        if (input) input.focus();
      }, 100);
    }
  },
  
  submitInput: () => {
    const input = document.getElementById('modal-input');
    if (input && window.modal.currentCallback) {
      const value = input.value.trim();
      window.modal.currentCallback(value);
      window.modal.hide();
    }
  },
  
  showPassword: (title, callback) => {
    window.modal.showInput(title, 'Enter password', callback);
  },
  
  showMessage: (title, message, type = 'info') => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    if (modal && modalTitle && modalContent) {
      modalTitle.textContent = title;
      modalContent.innerHTML = `
        <div class="modal-message ${type}">${message}</div>
        <div class="modal-buttons">
          <button class="modal-btn modal-btn-primary" onclick="window.modal.hide()">OK</button>
        </div>
      `;
      modal.style.display = 'flex';
    }
  },
  
  showComplex: (title, htmlContent) => {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    if (modal && modalTitle && modalContent) {
      modalTitle.textContent = title;
      modalContent.innerHTML = htmlContent;
      modal.style.display = 'flex';
    }
  }
};

async function loadEvents() {
  try {
    const doc = await eventsRef.get();
    if (doc.exists) {
      const data = doc.data().events || [];
      return Array.isArray(data) ? data : [];
    } else {
      const initialData = { events: [] };
      await eventsRef.set(initialData);
      return [];
    }
  } catch (e) {
    console.error('Error loading events:', e);
    window.modal.showMessage('Error', 'Failed to load events. Please refresh the page.', 'error');
    return [];
  }
}

async function saveEvents(events) {
  try {
    const result = await eventsRef.set({ events: Array.isArray(events) ? events : [] });
    
    if (window.refreshAllPages) {
      window.refreshAllPages();
    }
    return { success: true };
  } catch (e) {
    console.error('Error saving events:', e);
    window.modal.showMessage('Error', 'Error saving events: ' + e.message, 'error');
    return { success: false, error: e };
  }
}

function formatLastVisitedTime(timestamp) {
  if (!timestamp) return 'Never visited';
  
  const date = new Date(parseInt(timestamp));
  const options = { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true 
  };
  return date.toLocaleDateString('en-US', options);
}

async function render(isAdmin = false) {
  const grid = document.getElementById('event-grid');
  if (!grid) return;
  
  grid.innerHTML = '';
  const events = await loadEvents();
  
  // Remove empty state message - just show empty grid
  if (events.length === 0) {
    return;
  }
  
  events.forEach((ev, i) => {
    const card = document.createElement('div');
    card.className = 'event-card';
    
    const lastVisited = localStorage.getItem(`lastVisited_${ev.id}`);
    const lastVisitedText = formatLastVisitedTime(lastVisited);
    
    card.innerHTML = `
      <span class="event-title">${escapeHtml(ev.title)}</span>
      <div class="event-last-visited">Last visited: ${lastVisitedText}</div>
    `;
    
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => openEvent(i));
    
    if (isAdmin) {
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit Event';
      editBtn.className = 'event-edit-btn';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editEvent(i);
      });
      card.appendChild(editBtn);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.className = 'event-delete-btn';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmation(i, ev.title);
      });
      card.appendChild(deleteBtn);
    }
    grid.appendChild(card);
  });
}

function showDeleteConfirmation(index, title) {
  window.modal.showComplex('Confirm Delete', `
    <div class="modal-message">Are you sure you want to delete "${title}"?</div>
    <div class="modal-buttons">
      <button class="modal-btn modal-btn-secondary" onclick="window.modal.hide()">Cancel</button>
      <button class="modal-btn modal-btn-primary" onclick="performDelete(${index})">Delete</button>
    </div>
  `);
}

window.performDelete = async (index) => {
  window.modal.hide();
  
  try {
    let currentEvents = await loadEvents();
    
    if (index < 0 || index >= currentEvents.length) {
      window.modal.showMessage('Error', 'Event not found.', 'error');
      return;
    }
    
    const eventTitle = currentEvents[index].title;
    currentEvents.splice(index, 1);
    
    const result = await saveEvents(currentEvents);
    
    if (result.success) {
      const user = window.customAuth.getUser();
      const isAdmin = user && user.role === 'admin';
      render(isAdmin);
      
      window.modal.showMessage('Success', `"${eventTitle}" deleted successfully!`, 'success');
    }
  } catch (error) {
    window.modal.showMessage('Error', 'Failed to delete event: ' + error.message, 'error');
  }
};

function escapeHtml(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[&<>"']/g, m => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[m]));
}

async function openEvent(index) {
  const events = await loadEvents();
  const ev = events[index];
  if (!ev) return;
  
  // Check if event has password
  if (ev.password && ev.password.trim() !== '') {
    window.modal.showPassword(`Enter password for "${ev.title}"`, (password) => {
      if (password === ev.password) {
        localStorage.setItem(`lastVisited_${ev.id}`, Date.now().toString());
        window.location.href = `event.html?id=${ev.id}`;
      } else {
        window.modal.showMessage('Error', 'Incorrect password.', 'error');
      }
    });
  } else {
    // No password required
    localStorage.setItem(`lastVisited_${ev.id}`, Date.now().toString());
    window.location.href = `event.html?id=${ev.id}`;
  }
}

async function editEvent(index) {
  const events = await loadEvents();
  const ev = events[index];
  if (!ev) return;
  
  window.modal.showComplex(`Edit Event: "${ev.title}"`, `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <label>Event Title:</label>
      <input type="text" id="edit-title" class="modal-input" value="${escapeHtml(ev.title)}" placeholder="Event title">
      <label>Password (optional, leave empty for no password):</label>
      <input type="password" id="edit-password" class="modal-input" value="${ev.password || ''}" placeholder="Event password">
    </div>
    <div class="modal-buttons">
      <button class="modal-btn modal-btn-secondary" onclick="window.modal.hide()">Cancel</button>
      <button class="modal-btn modal-btn-primary" onclick="saveEventEdit(${index})">Save</button>
    </div>
  `);
}

window.saveEventEdit = async (index) => {
  const titleInput = document.getElementById('edit-title');
  const passwordInput = document.getElementById('edit-password');
  
  if (!titleInput || !passwordInput) return;
  
  const newTitle = titleInput.value.trim();
  const newPassword = passwordInput.value.trim();
  
  if (newTitle === '') {
    window.modal.showMessage('Error', 'Event title cannot be empty.', 'error');
    return;
  }
  
  try {
    const events = await loadEvents();
    events[index].title = newTitle;
    events[index].password = newPassword;
    
    const result = await saveEvents(events);
    
    if (result.success) {
      window.modal.hide();
      window.modal.showMessage('Success', 'Event updated successfully!', 'success');
      
      const user = window.customAuth.getUser();
      const isAdmin = user && user.role === 'admin';
      render(isAdmin);
    }
  } catch (error) {
    window.modal.showMessage('Error', 'Failed to update event: ' + error.message, 'error');
  }
};

async function createEventFlow(isAdmin) {
  if (!isAdmin) {
    window.modal.showMessage('Access Denied', 'You must be an approved admin to create events.', 'error');
    return;
  }

  const events = await loadEvents();
  
  if (events.length >= MAX_EVENTS) {
    window.modal.showMessage('Limit Reached', `Maximum ${MAX_EVENTS} events allowed. Please delete an event first.`, 'error');
    return;
  }

  window.modal.showComplex('Create New Event', `
    <div style="display: flex; flex-direction: column; gap: 10px;">
      <label>Event Title:</label>
      <input type="text" id="create-title" class="modal-input" placeholder="Enter event title" autofocus>
      <label>Password (optional, leave empty for no password):</label>
      <input type="password" id="create-password" class="modal-input" placeholder="Event password">
    </div>
    <div class="modal-buttons">
      <button class="modal-btn modal-btn-secondary" onclick="window.modal.hide()">Cancel</button>
      <button class="modal-btn modal-btn-primary" onclick="createNewEvent()">Create</button>
    </div>
  `);
}

window.createNewEvent = async () => {
  const titleInput = document.getElementById('create-title');
  const passwordInput = document.getElementById('create-password');
  
  if (!titleInput) return;
  
  const title = titleInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (title === '') {
    window.modal.showMessage('Error', 'Event title cannot be empty.', 'error');
    return;
  }
  
  try {
    const events = await loadEvents();
    
    // Generate unique ID for event
    const eventId = 'event_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const newEvent = {
      id: eventId,
      title: title,
      password: password,
      createdAt: new Date().toISOString(),
      functions: {
        currencyConverter: true,
        map: false,
        voting: false,
        comments: false
      }
    };
    
    events.push(newEvent);
    const result = await saveEvents(events);
    
    if (result.success) {
      window.modal.hide();
      window.modal.showMessage('Success', 'Event created successfully!', 'success');
      
      const user = window.customAuth.getUser();
      const isAdmin = user && user.role === 'admin';
      render(isAdmin);
    }
  } catch (error) {
    window.modal.showMessage('Error', 'Failed to create event: ' + error.message, 'error');
  }
};

async function logout() {
  window.customAuth.logout();
  window.location.href = 'index.html';
}

function createUserDropdown(user, currentPage) {
  const isAdminPage = currentPage === 'admin.html';
  const dropdown = document.createElement('div');
  dropdown.className = 'user-dropdown';
  dropdown.innerHTML = `
    <button class="user-btn" id="user-dropdown-btn">
      <img src="admin.png" alt="User" class="user-avatar">
      <span class="username">${user.username}</span>
    </button>
    <div class="dropdown-menu" id="dropdown-menu">
      <a href="profile.html" class="dropdown-item">Profile</a>
      ${isAdminPage 
        ? '<a href="index.html" class="dropdown-item">View Site</a>' 
        : '<a href="admin.html" class="dropdown-item">Admin Panel</a>'
      }
      <a href="#" class="dropdown-item" id="logout-dropdown">Logout</a>
    </div>
  `;
  return dropdown;
}

async function updateAuthUI() {
  const authDiv = document.querySelector('.auth');
  const createBtn = document.getElementById('create-event-btn');
  
  if (!authDiv) return;
  
  const user = window.customAuth.getUser();
  const isAdmin = user && user.role === 'admin';
  
  if (user) {
    authDiv.innerHTML = '';
    const currentPage = window.location.pathname.split('/').pop();
    const dropdown = createUserDropdown(user, currentPage);
    authDiv.appendChild(dropdown);
    
    const dropdownBtn = document.getElementById('user-dropdown-btn');
    const dropdownMenu = document.getElementById('dropdown-menu');
    
    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });
    
    document.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
    });
    
    document.getElementById('logout-dropdown').addEventListener('click', (e) => {
      e.preventDefault();
      logout();
    });
    
    if (createBtn) {
      createBtn.style.display = isAdmin ? 'block' : 'none';
    }
  } else {
    authDiv.innerHTML = `
      <a href="signup.html">Sign Up</a> | 
      <a href="login.html">Log In</a>
    `;
    if (createBtn) {
      createBtn.style.display = 'none';
    }
  }
  
  const userForRender = window.customAuth.getUser();
  const isAdminForRender = userForRender && userForRender.role === 'admin';
  render(isAdminForRender);
}

window.refreshAllPages = () => {
  if (window.render) {
    const user = window.customAuth.getUser();
    const isAdmin = user && user.role === 'admin';
    window.render(isAdmin);
  }
};

async function initializeEvents() {
  try {
    const events = await loadEvents();
    if (!Array.isArray(events)) {
      await saveEvents([]);
    }
  } catch (error) {
    console.error('Error initializing events:', error);
  }
}

// Only run on pages that have the event grid
if (document.getElementById('event-grid')) {
  document.addEventListener('DOMContentLoaded', async () => {
    await initializeEvents();
    updateAuthUI();

    const createBtn = document.getElementById('create-event-btn');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const user = window.customAuth.getUser();
        if (!user) return;
        const isAdmin = user.role === 'admin';
        createEventFlow(isAdmin);
      });
    }
  });
}

// Make functions globally available
window.render = render;
window.loadEvents = loadEvents;
window.saveEvents = saveEvents;
window.createEventFlow = createEventFlow;