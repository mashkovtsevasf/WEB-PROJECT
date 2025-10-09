(function(){
	const STORAGE_KEYS = {
		users: 'tracker_users',
		tasks: 'tracker_tasks',
		currentUserId: 'tracker_current_user_id'
	};

	function load(key, fallback) {
		try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
		catch { return fallback; }
	}
	function save(key, value) {
		localStorage.setItem(key, JSON.stringify(value));
	}

	function uid() { return Math.random().toString(36).slice(2, 10); }
	function todayISO() { return new Date().toISOString().slice(0,10); }

	function ensureSeed() {
		let users = load(STORAGE_KEYS.users, null);
		if (!users || users.length === 0) {
			users = [
				{ id: uid(), name: 'Адмін', role: 'admin' },
				{ id: uid(), name: 'Учасник', role: 'member' }
			];
			save(STORAGE_KEYS.users, users);
			save(STORAGE_KEYS.currentUserId, users[0].id);
		}

		let tasks = load(STORAGE_KEYS.tasks, null);
		if (!tasks || tasks.length === 0) {
			const assignee = users[1] ?? users[0];
			tasks = [
				{ id: uid(), title: 'Приклад: Спланувати спринт', description: 'Оцінити задачі', assigneeId: assignee.id, deadline: todayISO(), priority: 'medium', status: 'todo', createdAt: Date.now() },
				{ id: uid(), title: 'Приклад: Верстка сторінки', description: 'Головна сторінка', assigneeId: assignee.id, deadline: todayISO(), priority: 'high', status: 'in_progress', createdAt: Date.now() },
				{ id: uid(), title: 'Приклад: Ревʼю коду', description: '', assigneeId: assignee.id, deadline: todayISO(), priority: 'low', status: 'done', createdAt: Date.now() }
			];
			save(STORAGE_KEYS.tasks, tasks);
		}
	}

	function getUsers() { return load(STORAGE_KEYS.users, []); }
	function setUsers(users) { save(STORAGE_KEYS.users, users); }
	function getTasks() { return load(STORAGE_KEYS.tasks, []); }
	function setTasks(tasks) { save(STORAGE_KEYS.tasks, tasks); }
	function getCurrentUser() {
		const id = load(STORAGE_KEYS.currentUserId, null);
		return getUsers().find(u => u.id === id) || getUsers()[0] || null;
	}

	function findUserName(id) {
		const u = getUsers().find(x => x.id === id);
		return u ? u.name : '—';
	}

	function isAdmin(user) { return user?.role === 'admin'; }

	const modal = {
		el: null,
		open() { if (this.el) this.el.setAttribute('aria-hidden', 'false'); },
		close() { if (this.el) this.el.setAttribute('aria-hidden', 'true'); },
		bind() {
			this.el = document.getElementById('task-modal');
			if (this.el) {
				this.el.addEventListener('click', (e) => {
					const target = e.target;
					if (target.matches('[data-close]')) this.close();
				});
			}

			['auth-register-modal','auth-login-modal'].forEach(id => {
				const m = document.getElementById(id);
				if (!m) return;
				m.addEventListener('click', (e)=>{
					const target = e.target;
					if (target.matches('[data-close]')) m.setAttribute('aria-hidden','true');
				});
			});
		}
	};

	function fillAssigneeSelect(select) {
		if (!select) return;
		const users = getUsers();
		select.innerHTML = '';
		for (const u of users) {
			const opt = document.createElement('option');
			opt.value = u.id; opt.textContent = `${u.name} (${u.role === 'admin' ? 'адмін' : 'учасник'})`;
			select.appendChild(opt);
		}
	}

	function readTaskForm() {
		return {
			id: document.getElementById('task-id').value || uid(),
			title: document.getElementById('task-title').value.trim(),
			description: document.getElementById('task-desc').value.trim(),
			assigneeId: document.getElementById('task-assignee').value || null,
			deadline: document.getElementById('task-deadline').value || '',
			priority: document.getElementById('task-priority').value || 'medium',
			status: document.getElementById('task-status').value || 'todo',
			createdAt: Number(document.getElementById('task-id').value ? document.getElementById('task-createdAt')?.value : Date.now())
		};
	}

	function writeTaskForm(task) {
		document.getElementById('task-id').value = task?.id || '';
		document.getElementById('task-title').value = task?.title || '';
		document.getElementById('task-desc').value = task?.description || '';
		document.getElementById('task-assignee').value = task?.assigneeId || (getUsers()[0]?.id || '');
		document.getElementById('task-deadline').value = task?.deadline || '';
		document.getElementById('task-priority').value = task?.priority || 'medium';
		document.getElementById('task-status').value = task?.status || 'todo';
	}

	function upsertTask(task) {
		const tasks = getTasks();
		const idx = tasks.findIndex(t => t.id === task.id);
		if (idx >= 0) tasks[idx] = task; else tasks.push(task);
		setTasks(tasks);
	}
	function deleteTask(id) {
		const currentUser = getCurrentUser();
		if (!isAdmin(currentUser)) {
			alert('Лише адміністратор може видаляти завдання.');
			return false;
		}
		setTasks(getTasks().filter(t => t.id !== id));
		return true;
	}

	function renderKanban() {
		const board = document.getElementById('kanban-board');
		if (!board) return;
		const tasks = getTasks();
		const columns = {
			'todo': document.getElementById('col-todo'),
			'in_progress': document.getElementById('col-in_progress'),
			'done': document.getElementById('col-done')
		};
		Object.values(columns).forEach(col => col.innerHTML = '');
		for (const task of tasks) {
			const el = document.createElement('article');
			el.className = 'card-task';
			el.draggable = true;
			el.dataset.id = task.id;
			el.style.opacity = '0';
			el.style.transform = 'translateY(20px)';
			el.innerHTML = `
				<div class="title">${escapeHtml(task.title)}</div>
				<div class="meta">
					<span>Виконавець: ${escapeHtml(findUserName(task.assigneeId))}</span>
					<span>Дедлайн: ${task.deadline || '—'}</span>
				</div>
				<div class="tags">
					<span class="tag ${task.priority}">Пріоритет: ${priorityLabel(task.priority)}</span>
				</div>
				<div class="card-actions">
					<button class="btn-secondary" data-edit>Редагувати</button>
					<button class="btn-secondary" data-delete>Видалити</button>
				</div>
			`;
			
			// Add staggered animation
			setTimeout(() => {
				el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
				el.style.opacity = '1';
				el.style.transform = 'translateY(0)';
			}, Math.random() * 200);
			el.addEventListener('dragstart', (e)=>{
				e.dataTransfer.setData('text/plain', task.id);
			});
			el.querySelector('[data-edit]').addEventListener('click', ()=>{
				openEditTask(task.id);
			});
			el.querySelector('[data-delete]').addEventListener('click', ()=>{
				if (confirm('Видалити завдання?')) {
					if (deleteTask(task.id)) {
						renderAll();
					}
				}
			});
			columns[task.status]?.appendChild(el);
		}

		for (const status of Object.keys(columns)) {
			const list = columns[status];
			list.addEventListener('dragover', (e)=>{ e.preventDefault(); list.classList.add('drag-over'); });
			list.addEventListener('dragleave', ()=> list.classList.remove('drag-over'));
			list.addEventListener('drop', (e)=>{
				e.preventDefault(); list.classList.remove('drag-over');
				const id = e.dataTransfer.getData('text/plain');
				const tasks = getTasks();
				const t = tasks.find(x=>x.id===id);
				if (t && t.status !== status) { t.status = status; setTasks(tasks); renderAll(); }
			});
		}
	}

	function priorityLabel(p) {
		return p === 'high' ? 'Високий' : p === 'low' ? 'Низький' : 'Середній';
	}

	function escapeHtml(s) {
		return (s||'').replace(/[&<>"']/g, (ch)=>({
			'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'
		}[ch]));
	}

	function openNewTask() {
		fillAssigneeSelect(document.getElementById('task-assignee'));
		writeTaskForm({ status: 'todo', priority: 'medium' });
		modal.open();
	}
	function openEditTask(id) {
		const task = getTasks().find(t=>t.id===id);
		if (!task) return;
		fillAssigneeSelect(document.getElementById('task-assignee'));
		writeTaskForm(task);
		modal.open();
	}

	function bindGlobalButtons() {
		const btnNew = document.getElementById('btn-new-task');
		if (btnNew) btnNew.addEventListener('click', openNewTask);

		const r = document.getElementById('btn-register');
		const l = document.getElementById('btn-login');
		if (r) r.addEventListener('click', ()=> document.getElementById('auth-register-modal')?.setAttribute('aria-hidden','false'));
		if (l) l.addEventListener('click', ()=> document.getElementById('auth-login-modal')?.setAttribute('aria-hidden','false'));
		
		// Мобільні кнопки авторизації
		const rMobile = document.getElementById('btn-register-mobile');
		const lMobile = document.getElementById('btn-login-mobile');
		if (rMobile) rMobile.addEventListener('click', ()=> {
			document.getElementById('auth-register-modal')?.setAttribute('aria-hidden','false');
			// Закриваємо бургер-меню після кліку
			mobileMenuToggle.classList.remove('active');
			topNav.classList.remove('active');
		});
		if (lMobile) lMobile.addEventListener('click', ()=> {
			document.getElementById('auth-login-modal')?.setAttribute('aria-hidden','false');
			// Закриваємо бургер-меню після кліку
			mobileMenuToggle.classList.remove('active');
			topNav.classList.remove('active');
		});
		
		// Mobile menu toggle
		const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
		const topNav = document.getElementById('top-nav');
		
		if (mobileMenuToggle && topNav) {
			mobileMenuToggle.addEventListener('click', () => {
				mobileMenuToggle.classList.toggle('active');
				topNav.classList.toggle('active');
			});
			
			// Close menu when clicking on links
			topNav.addEventListener('click', (e) => {
				if (e.target.tagName === 'A') {
					mobileMenuToggle.classList.remove('active');
					topNav.classList.remove('active');
				}
			});
			
			// Close menu when clicking outside
			document.addEventListener('click', (e) => {
				if (!mobileMenuToggle.contains(e.target) && !topNav.contains(e.target)) {
					mobileMenuToggle.classList.remove('active');
					topNav.classList.remove('active');
				}
			});
			
			// Close menu when pressing Escape key
			document.addEventListener('keydown', (e) => {
				if (e.key === 'Escape' && topNav.classList.contains('active')) {
					mobileMenuToggle.classList.remove('active');
					topNav.classList.remove('active');
				}
			});
		}
	}

	function bindTaskForm() {
		const form = document.getElementById('task-form');
		if (!form) return;
		form.addEventListener('submit', (e)=>{
			e.preventDefault();
			const data = readTaskForm();
			if (!data.title) { alert('Вкажіть назву'); return; }
			upsertTask(data);
			modal.close();
			renderAll();
		});
	}

	function renderTasksTable() {
		const tbody = document.querySelector('#tasks-table tbody');
		if (!tbody) return;
		const filters = readFilters();
		const users = getUsers();
		const rows = filterTasks(getTasks(), filters);
		tbody.innerHTML = '';
		for (const t of rows) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td data-label="Назва">${escapeHtml(t.title)}</td>
				<td data-label="Виконавець">${escapeHtml(findUserName(t.assigneeId))}</td>
				<td data-label="Пріоритет">${priorityLabel(t.priority)}</td>
				<td data-label="Дедлайн">${t.deadline || '—'}</td>
				<td data-label="Статус">${statusLabel(t.status)}</td>
				<td data-label="Дії" style="text-align:right">
					<button class="btn-secondary" data-edit data-id="${t.id}">Редагувати</button>
					<button class="btn-secondary" data-del data-id="${t.id}">Видалити</button>
				</td>
			`;
			tr.querySelector('[data-edit]').addEventListener('click', ()=> openEditTask(t.id));
			tr.querySelector('[data-del]').addEventListener('click', ()=>{ if (confirm('Видалити завдання?')) { if (deleteTask(t.id)) renderAll(); } });
			tbody.appendChild(tr);
		}

		const assSel = document.getElementById('filter-assignee');
		if (assSel && assSel.options.length === 0) {
			const def = document.createElement('option'); def.value=''; def.textContent = 'Виконавець: всі'; assSel.appendChild(def);
			for (const u of users) { const o=document.createElement('option'); o.value=u.id; o.textContent=u.name; assSel.appendChild(o); }
		}
	}

	function statusLabel(s) { return s==='todo'?'To Do':s==='in_progress'?'In Progress':'Done'; }

	function readFilters() {
		return {
			text: document.getElementById('filter-text')?.value.trim().toLowerCase() || '',
			status: document.getElementById('filter-status')?.value || '',
			priority: document.getElementById('filter-priority')?.value || '',
			assigneeId: document.getElementById('filter-assignee')?.value || '',
			from: document.getElementById('filter-from')?.value || '',
			to: document.getElementById('filter-to')?.value || ''
		};
	}
	function filterTasks(tasks, f) {
		return tasks.filter(t=>{
			if (f.text && !(t.title.toLowerCase().includes(f.text) || t.description.toLowerCase().includes(f.text))) return false;
			if (f.status && t.status !== f.status) return false;
			if (f.priority && t.priority !== f.priority) return false;
			if (f.assigneeId && t.assigneeId !== f.assigneeId) return false;
			if (f.from && (!t.deadline || t.deadline < f.from)) return false;
			if (f.to && (!t.deadline || t.deadline > f.to)) return false;
			return true;
		});
	}
	function bindFilters() {
		const ids = ['filter-text','filter-status','filter-priority','filter-assignee','filter-from','filter-to'];
		ids.forEach(id=>{
			const el = document.getElementById(id);
			if (el) el.addEventListener('input', renderTasksTable);
		});
		const clear = document.getElementById('btn-clear-filters');
		if (clear) clear.addEventListener('click', ()=>{
			ids.forEach(id=>{ const el=document.getElementById(id); if (el) el.value=''; });
			renderTasksTable();
		});
	}

	function renderUsers() {
		const tbody = document.querySelector('#users-table tbody');
		if (!tbody) return;
		const users = getUsers();
		tbody.innerHTML = '';
		for (const u of users) {
			const tr = document.createElement('tr');
			tr.innerHTML = `
				<td data-label="Ім'я">${escapeHtml(u.name)}</td>
				<td data-label="Роль">
					<select data-role value="${u.role}">
						<option value="member">Учасник</option>
						<option value="admin">Адміністратор</option>
					</select>
				</td>
				<td data-label="Дії" style="text-align:left">
					<button class="btn-secondary" data-del>Видалити</button>
				</td>
			`;
			tr.querySelector('[data-role]').addEventListener('change', (e)=>{
				u.role = e.target.value; setUsers(users); renderAll();
			});
			tr.querySelector('[data-del]').addEventListener('click', ()=>{
				if (!confirm('Видалити користувача?')) return;
				const rest = users.filter(x=>x.id!==u.id);
				setUsers(rest);
				const tasks = getTasks().map(t=> t.assigneeId===u.id ? { ...t, assigneeId: (rest[0]?.id || null) } : t);
				setTasks(tasks);
				renderAll();
			});
			tbody.appendChild(tr);
		}

		const addBtn = document.getElementById('btn-add-user');
		const nameInput = document.getElementById('new-user-name');
		const roleSel = document.getElementById('new-user-role');
		if (addBtn) addBtn.addEventListener('click', ()=>{
			const name = nameInput.value.trim();
			if (!name) { alert('Вкажіть ім\'я'); return; }
			const users = getUsers();
			users.push({ id: uid(), name, role: roleSel.value });
			setUsers(users);
			nameInput.value = '';
			renderAll();
		});
	}

	function renderStats() {
		const elTotal = document.getElementById('stat-total');
		if (!elTotal) return;
		const tasks = getTasks();
		const counts = {
			total: tasks.length,
			todo: tasks.filter(t=>t.status==='todo').length,
			inprogress: tasks.filter(t=>t.status==='in_progress').length,
			done: tasks.filter(t=>t.status==='done').length
		};
		elTotal.textContent = String(counts.total);
		document.getElementById('stat-todo').textContent = String(counts.todo);
		document.getElementById('stat-inprogress').textContent = String(counts.inprogress);
		document.getElementById('stat-done').textContent = String(counts.done);

		const canvas = document.getElementById('chart-status');
		if (canvas?.getContext) {
			const ctx = canvas.getContext('2d');
			ctx.clearRect(0,0,canvas.width,canvas.height);
			const data = [counts.todo, counts.inprogress, counts.done];
			const labels = ['To Do','In Progress','Done'];
			const colors = ['#f7b955','#4f8cff','#3ccf91'];
			const max = Math.max(1, ...data);
			const barW = 120; const gap = 40; const x0 = 40; const baseY = canvas.height - 30;
			ctx.fillStyle = '#9aa4b2';
			ctx.font = '12px system-ui';
			for (let i=0;i<data.length;i++) {
				const h = Math.round((data[i]/max) * (canvas.height - 80));
				const x = x0 + i*(barW+gap);
				const y = baseY - h;
				ctx.fillStyle = colors[i];
				ctx.fillRect(x, y, barW, h);
				ctx.fillStyle = '#e8ecf1';
				ctx.fillText(labels[i], x, baseY + 16);
				ctx.fillText(String(data[i]), x + barW/2 - 6, y - 6);
			}
		}
	}

	function bindAuthButtons() {
		const regForm = document.getElementById('register-form');
		if (regForm) regForm.addEventListener('submit', (e)=>{ e.preventDefault(); alert('Реєстрація: демо-форма (без бекенду)'); document.getElementById('auth-register-modal')?.setAttribute('aria-hidden','true'); });
		const logForm = document.getElementById('login-form');
		if (logForm) logForm.addEventListener('submit', (e)=>{ e.preventDefault(); alert('Вхід: демо-форма (без бекенду)'); document.getElementById('auth-login-modal')?.setAttribute('aria-hidden','true'); });
	}

	function renderAll() {
		renderKanban();
		renderTasksTable();
		renderUsers();
		renderStats();
	}

	function init() {
		ensureSeed();
		modal.bind();
		bindGlobalButtons();
		bindTaskForm();
		bindFilters();
		bindAuthButtons();
		renderAll();
	}

	document.addEventListener('DOMContentLoaded', init);
})();
