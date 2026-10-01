const USERS_KEY = 'tms_users';
const SESSION_KEY = 'tms_session';
const TASKS_KEY = 'tms_tasks';

let currentUser = null;
let tasks = [];
let selectedCategory = 'All';
let taskModal = null;

document.addEventListener('DOMContentLoaded', () => {
  taskModal = new bootstrap.Modal(document.getElementById('taskModal'));
  UserModule.checkSession();
});

/* ==================== USER MODULE (LOGIN VALIDATION & REGISTRATION) ==================== */
const UserModule = (() => {
  let isSignUp = false;

  function toggleMode(e) {
    if (e) e.preventDefault();
    isSignUp = !isSignUp;

    const authTitle = document.getElementById('authTitle');
    const authSubtitle = document.getElementById('authSubtitle');
    const authBtn = document.getElementById('authBtn');
    const nameGroup = document.getElementById('nameGroup');
    const toggleText = document.getElementById('toggleText');
    const toggleLink = document.getElementById('toggleLink');

    document.getElementById('authAlert').classList.add('d-none');
    document.getElementById('authForm').reset();
    document.getElementById('authForm').classList.remove('was-validated');

    if (isSignUp) {
      authTitle.innerHTML = '<i class="bi bi-person-plus"></i> Create Account';
      authSubtitle.textContent = 'Register to start creating and tracking your tasks';
      authBtn.textContent = 'Register';
      nameGroup.classList.remove('d-none');
      document.getElementById('authName').required = true;
      toggleText.textContent = 'Already have an account? ';
      toggleLink.textContent = 'Login';
    } else {
      authTitle.innerHTML = '<i class="bi bi-check2-square"></i> Task System';
      authSubtitle.textContent = 'Please log in to manage your daily tasks';
      authBtn.textContent = 'Login';
      nameGroup.classList.add('d-none');
      document.getElementById('authName').required = false;
      toggleText.textContent = "Don't have an account? ";
      toggleLink.textContent = 'Sign Up';
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('authForm');

    if (!form.checkValidity()) {
      e.stopPropagation();
      form.classList.add('was-validated');
      return;
    }

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value.trim();

    const users = JSON.parse(localStorage.getItem(USERS_KEY)) || {};

    if (isSignUp) {
      if (users[email]) {
        showAlert('User with this email already exists.');
        return;
      }
      users[email] = { name: name || 'User', password };
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

      loginSuccess({ email, name: users[email].name });
    } else {
      if (!users[email] || users[email].password !== password) {
        showAlert('Invalid email address or password.');
        return;
      }
      loginSuccess({ email, name: users[email].name });
    }
  }

  function showAlert(msg) {
    const alertEl = document.getElementById('authAlert');
    alertEl.textContent = msg;
    alertEl.classList.remove('d-none');
  }

  function loginSuccess(user) {
    currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));

    document.getElementById('authSection').style.display = 'none';
    document.getElementById('appSection').classList.add('active');

    document.getElementById('userNameDisplay').textContent = currentUser.name;
    document.getElementById('userEmailDisplay').textContent = currentUser.email;
    document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();

    TaskManagementModule.init();
    NotificationModule.checkNotifications();
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    document.getElementById('appSection').classList.remove('active');
    document.getElementById('authSection').style.display = 'flex';
    document.getElementById('authForm').reset();
    document.getElementById('authForm').classList.remove('was-validated');
  }

  function checkSession() {
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      loginSuccess(JSON.parse(savedSession));
    }
  }

  return { toggleMode, handleSubmit, logout, checkSession, loginSuccess };
})();

/* ==================== PROJECT / CATEGORY MODULE ==================== */
const CategoryModule = (() => {
  function filterCategory(cat, e) {
    if (e) e.preventDefault();
    selectedCategory = cat;

    document.getElementById('currentCategoryTitle').textContent = cat === 'All' ? 'All Projects' : cat;

    const navLinks = document.querySelectorAll('#categoryList .nav-link');
    navLinks.forEach(link => {
      if (link.textContent.trim().includes(cat === 'All' ? 'All Projects' : cat)) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    TaskManagementModule.renderTasks();
  }

  return { filterCategory };
})();

/* ==================== TASK CREATION & EDITING MODULE ==================== */
const TaskCreationModule = (() => {
  function openModal(taskId = null) {
    const form = document.getElementById('taskForm');
    form.reset();

    if (taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitleInput').value = task.title;
        document.getElementById('taskDescInput').value = task.description || '';
        document.getElementById('taskCategoryInput').value = task.category;
        document.getElementById('taskPriorityInput').value = task.priority;
        document.getElementById('taskDeadlineInput').value = task.deadline;
        document.getElementById('modalTitle').textContent = 'Edit Task';
      }
    } else {
      document.getElementById('taskId').value = '';
      document.getElementById('modalTitle').textContent = 'Create New Task';
    }

    taskModal.show();
  }

  function saveTask(e) {
    e.preventDefault();
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitleInput').value.trim();
    const description = document.getElementById('taskDescInput').value.trim();
    const category = document.getElementById('taskCategoryInput').value;
    const priority = document.getElementById('taskPriorityInput').value;
    const deadline = document.getElementById('taskDeadlineInput').value;

    if (id) {
      const task = tasks.find(t => t.id === id);
      if (task) {
        task.title = title;
        task.description = description;
        task.category = category;
        task.priority = priority;
        task.deadline = deadline;
      }
    } else {
      tasks.push({
        id: Date.now().toString(),
        userEmail: currentUser.email,
        title,
        description,
        category,
        priority,
        deadline,
        status: 'todo'
      });
    }

    TaskManagementModule.persistTasks();
    TaskManagementModule.renderTasks();
    NotificationModule.checkNotifications();
    taskModal.hide();
  }

  return { openModal, saveTask };
})();

/* ==================== TASK MANAGEMENT & DRAG-AND-DROP MODULE ==================== */
const TaskManagementModule = (() => {
  const defaultTasks = [
    { id: '101', userEmail: 'user@example.com', title: 'Design homepage UI', description: 'Create responsive mockup using Bootstrap', category: 'Website Redesign', priority: 'High', deadline: '2026-10-05', status: 'completed' },
    { id: '102', userEmail: 'user@example.com', title: 'Fix login validation bug', description: 'Ensure user input fields throw validation errors correctly', category: 'Mobile App', priority: 'High', deadline: '2026-10-02', status: 'in-progress' },
    { id: '103', userEmail: 'user@example.com', title: 'Prepare client report', description: 'Compile weekly analytics into presentation slides', category: 'Marketing', priority: 'Medium', deadline: '2026-09-30', status: 'todo' }
  ];

  function init() {
    loadTasks();
    renderTasks();
  }

  function loadTasks() {
    const saved = localStorage.getItem(TASKS_KEY);
    tasks = saved ? JSON.parse(saved) : defaultTasks;
  }

  function persistTasks() {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  }

  function renderTasks() {
    const userTasks = tasks.filter(t => !t.userEmail || t.userEmail === currentUser.email);
    const filteredTasks = selectedCategory === 'All' 
      ? userTasks 
      : userTasks.filter(t => t.category === selectedCategory);

    ['todo', 'in-progress', 'completed'].forEach(status => {
      const container = document.getElementById(`${status}-list`);
      container.innerHTML = '';

      const columnTasks = filteredTasks.filter(t => t.status === status);
      document.getElementById(`${status}-badge`).textContent = columnTasks.length;

      columnTasks.forEach(task => {
        container.appendChild(createCard(task));
      });
    });

    DashboardModule.updateMetrics(userTasks);
  }

  function createCard(task) {
    const card = document.createElement('div');
    card.className = 'card task-card p-3';
    card.draggable = true;
    card.dataset.id = task.id;

    const today = new Date();
    today.setHours(0,0,0,0);
    const deadlineDate = new Date(task.deadline);
    const isOverdue = deadlineDate < today && task.status !== 'completed';

    const priorityClass = `badge-${task.priority.toLowerCase()}`;

    card.innerHTML = `
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h6 class="fw-bold mb-0 text-dark">${task.title}</h6>
        <span class="badge ${isOverdue ? 'bg-danger' : priorityClass}">${isOverdue ? 'Overdue' : task.priority}</span>
      </div>
      ${task.description ? `<p class="text-muted fs-7 mb-2">${task.description}</p>` : ''}
      <div class="d-flex justify-content-between align-items-center fs-8 text-muted mb-2">
        <span><i class="bi bi-folder me-1"></i>${task.category}</span>
        <span class="${isOverdue ? 'text-danger fw-bold' : ''}"><i class="bi bi-calendar me-1"></i>${task.deadline}</span>
      </div>
      <div class="d-flex justify-content-end gap-1 border-top pt-2">
        <button class="btn btn-sm btn-light text-primary py-0 px-2" onclick="TaskCreationModule.openModal('${task.id}')" title="Edit"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-light text-danger py-0 px-2" onclick="TaskManagementModule.deleteTask('${task.id}')" title="Delete"><i class="bi bi-trash"></i></button>
      </div>
    `;

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => card.classList.remove('dragging'));

    return card;
  }

  function deleteTask(id) {
    if (confirm('Are you sure you want to delete this task?')) {
      tasks = tasks.filter(t => t.id !== id);
      persistTasks();
      renderTasks();
      NotificationModule.checkNotifications();
    }
  }

  function allowDrop(e) { e.preventDefault(); }

  function drop(e, newStatus) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.status = newStatus;
      persistTasks();
      renderTasks();
      NotificationModule.checkNotifications();
    }
  }

  return { init, renderTasks, persistTasks, deleteTask, allowDrop, drop };
})();

/* ==================== DASHBOARD & PROGRESS MODULE ==================== */
const DashboardModule = (() => {
  function updateMetrics(userTasks) {
    const total = userTasks.length;
    const completed = userTasks.filter(t => t.status === 'completed').length;
    const pending = userTasks.filter(t => t.status === 'in-progress' || t.status === 'todo').length;

    const today = new Date();
    today.setHours(0,0,0,0);
    const overdue = userTasks.filter(t => new Date(t.deadline) < today && t.status !== 'completed').length;

    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('totalTasksCount').textContent = total;
    document.getElementById('completedTasksCount').textContent = completed;
    document.getElementById('pendingTasksCount').textContent = pending;
    document.getElementById('overdueTasksCount').textContent = overdue;

    document.getElementById('progressPercent').textContent = `${percent}%`;
    document.getElementById('overallProgressBar').style.width = `${percent}%`;
  }

  return { updateMetrics };
})();

/* ==================== DEADLINE & NOTIFICATION MODULE ==================== */
const NotificationModule = (() => {
  function checkNotifications() {
    const container = document.getElementById('toastContainer');
    container.innerHTML = '';

    const today = new Date();
    today.setHours(0,0,0,0);

    let overdueCount = 0;
    let dueSoonCount = 0;

    tasks.filter(t => !t.userEmail || t.userEmail === currentUser.email).forEach(task => {
      if (task.status === 'completed') return;

      const deadline = new Date(task.deadline);
      const diffDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        overdueCount++;
      } else if (diffDays >= 0 && diffDays <= 2) {
        dueSoonCount++;
      }
    });

    if (overdueCount > 0) {
      showToast(`⚠️ You have ${overdueCount} overdue task(s)!`, 'danger');
    }
    if (dueSoonCount > 0) {
      showToast(`🔔 ${dueSoonCount} task(s) are due within the next 48 hours.`, 'warning');
    }
  }

  function showToast(msg, bgType) {
    const container = document.getElementById('toastContainer');
    const toastEl = document.createElement('div');
    toastEl.className = `toast align-items-center text-white bg-${bgType} border-0 show mb-2`;
    toastEl.setAttribute('role', 'alert');

    toastEl.innerHTML = `
      <div class="d-flex">
        <div class="toast-body fw-semibold">${msg}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    container.appendChild(toastEl);

    setTimeout(() => {
      toastEl.remove();
    }, 5000);
  }

  return { checkNotifications };
})();