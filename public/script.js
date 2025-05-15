let filterTimer;
let jobs = [], filtered = [];
let currentProfile = 'pm';

const listEl = document.getElementById('list'),
    detailsEl = document.getElementById('details'),
    searchEl = document.getElementById('search'),
    clearBtn = document.getElementById('clear-btn'),
    toastContainer = document.getElementById('toast-container'),
    confirmOverlay = document.getElementById('confirm-overlay'),
    confirmMessageEl = document.getElementById('confirm-message'),
    confirmOkBtn = document.getElementById('confirm-ok'),
    confirmCancelBtn = document.getElementById('confirm-cancel'),
    profileBtn = document.getElementById('profile-btn'),
    profileMenu = document.getElementById('profile-menu'),
    viewedDropdown = document.getElementById('viewed-dropdown'),
    appliedDropdown = document.getElementById('applied-dropdown'),
    locationDropdown = document.getElementById('location-dropdown');

let appliedState = 0; // 0: Show All, 1: Hide Applied, 2: Show Only Applied
let viewedState = 0; // 0: Show All, 1: Hide Applied, 2: Show Only Applied
let locationState = 0; // 0: Show All, 1: Hide Applied, 2: Show Only Applied

const endpoints = {
    list: (profile) => `/api/job?profile=${profile}`,
    view: (id) => `/api/job/${id}/view`,
    unview: (id) => `/api/job/${id}/unview`,
    apply: (id) => `/api/job/${id}/apply`,
    unapply: (id) => `/api/job/${id}/unapply`,
    delete: (id) => `/api/job/${id}`,
};


function showToast(title, body = '', duration = 8000) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML =
        `<button class="toast-close"><span class="material-symbols-outlined">close</span></button>` +
        `<div class="toast-title">${title}</div>` +
        (body ? `<div class="toast-body">${body}</div>` : '');
    
    const closeToast = () => {
        t.classList.remove('show');
        t.addEventListener('transitionend', () => t.remove(), { once: true });
    };
    
    t.querySelector('.toast-close').addEventListener('click', closeToast);
    
    toastContainer.append(t);
    requestAnimationFrame(() => t.classList.add('show'));
    if (duration > 0) {
        setTimeout(closeToast, duration);
    }
}

function showConfirm(message) {
    return new Promise(resolve => {
        confirmMessageEl.textContent = message;
        confirmOverlay.classList.remove('hidden');

        const cleanUp = result => {
            confirmOverlay.classList.add('hidden');
            confirmOkBtn.removeEventListener('click', onOk);
            confirmCancelBtn.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk = () => cleanUp(true);
        const onCancel = () => cleanUp(false);

        confirmOkBtn.addEventListener('click', onOk);
        confirmCancelBtn.addEventListener('click', onCancel);
    });
}

async function api(path, opts = {}) {
    const res = await fetch(path, opts);
    if (!res.ok) throw new Error(res.statusText);
    if (opts.method === 'DELETE' || res.status === 204) return;
    return await res.json();
}

async function markViewed(el, job, cycle = false) {
    if (!el || !job) return;
    
    try {
        if (el.classList.contains('viewed')) {
            if (cycle) {
                await api(endpoints.unview(job.id));
                el.querySelector('.view-btn span').textContent = 'visibility';
                job.viewed = false;
                el.classList.remove('viewed');
            }
        } else {
            await api(endpoints.view(job.id));
            el.querySelector('.view-btn span').textContent = 'visibility_off';
            job.viewed = true;
            el.classList.add('viewed');
        }
    } catch (e) {
        showToast('Failed to update viewed status :(');
    }
}

async function deleteJob(jobEl, job) {
    if (!await showConfirm('Delete this job?')) return;
    console.log("Deleting job", job.id);
    
    const btn = jobEl.querySelector('.del');
    btn.disabled = true;
    
    try {
        await api(endpoints.delete(job.id), { method: 'DELETE' });
        jobs = jobs.filter(j => j.id !== job.id);
        showToast("Deleted job", job.title);
        applyFilter();
        selectFirstJob();
    } catch (e) {
        showToast("Failed to delete job :(");
    } finally {
        btn.disabled = false;
    }
}

async function toggleApply(jobEl, job) {
    const applied = jobEl.querySelector('.apply-btn');
    applied.disabled = true;
    
    try {
        applied.classList.add('clicked');
        setTimeout(() => applied.classList.remove('clicked'), 300);

        await api(jobEl.classList.contains('applied') 
            ? endpoints.unapply(job.id) 
            : endpoints.apply(job.id));
            
        job.applied = !job.applied;
        jobEl.classList.toggle('applied', job.applied);
    } catch (e) {
        showToast("Failed to update application status");
    } finally {
        applied.disabled = false;
    }
}

async function load() {
    try {
        jobs = await api(endpoints.list(currentProfile));
        filtered = jobs;
        applyFilter();
        selectFirstJob();
    } catch (err) {
        console.error("Failed to load jobs:", err);
        detailsEl.innerHTML = "<div class='error'>Couldn't load jobs. Try again later.</div>";
    }
}

function getJobFromEl(jobItem) {
    const id = jobItem.querySelector('.view-btn').dataset.id;
    return jobs.find(j => j.id == id);
}

function selectFirstJob() {
    if (filtered.length === 0) {
        showDetails(null);
        return;
    }
    
    const job = filtered[0];
    const jobEl = listEl.querySelector('.job-item');
    
    if (jobEl) {
        selectJob(jobEl, job);
    }
}

function selectJob(jobEl, job) {
    if (!jobEl || !job) return;
    
    document.querySelectorAll('.job-item').forEach(x => x.classList.remove('active'));
    jobEl.classList.add('active');
    markViewed(jobEl, job, false);
    showDetails(job);
}

function createJobEl(job) {
    const el = document.createElement('div');
    el.className = 'job-item';

    const actions = document.createElement('div');
    actions.className = 'job-actions';
    
    ['del', 'view-btn', 'apply-btn'].forEach(cls => {
        const btn = document.createElement('button');
        btn.className = cls;
        btn.dataset.id = job.id;
        
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        
        if (cls === 'del') {
            icon.textContent = 'close';
        } else if (cls === 'view-btn') {
            icon.textContent = job.viewed ? 'visibility_off' : 'visibility';
        } else {
            icon.textContent = 'outgoing_mail';
        }

        btn.appendChild(icon);
        actions.appendChild(btn);
    });

    el.appendChild(actions);

    const content = document.createElement('div');
    content.className = 'job-content';
    content.innerHTML = `<h3>${job.title}</h3>
                       <div class="meta">${job.company} · ${job.location}</div>`;
    
    el.appendChild(content);
    
    if (job.viewed) el.classList.add('viewed');
    if (job.applied) el.classList.add('applied');
    
    return el;
}

function renderList() {
    listEl.innerHTML = '';
    
    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="no-results">No jobs found</div>';
        return;
    }
    
    const frag = document.createDocumentFragment();
    filtered.forEach(job => frag.appendChild(createJobEl(job)));
    listEl.appendChild(frag);
}

function showDetails(job) {
    if (!job) {
        detailsEl.innerHTML = '<em>Select a job…</em>';
        return;
    }
    
    detailsEl.innerHTML = `
    <h2>${job.title}</h2>
    <div class="info">${job.company} · ${job.location}</div>
    <a href="${job.link}" target="_blank" class="apply-btn">
      <img src="linkedin.svg" alt="LinkedIn logo">
      View on LinkedIn
    </a>
    <div class="description">${job.html || job.description}</div>
  `;
}

function applyFilter() {
    const q = searchEl.value.toLowerCase();
    const viewedState = parseInt(viewedDropdown.value, 10);
    const appliedState = parseInt(appliedDropdown.value, 10);
    const locationState = parseInt(locationDropdown.value, 10);

    filtered = jobs.filter(j => {
        const matchesSearch = j.title.toLowerCase().includes(q) ||
            j.company.toLowerCase().includes(q) ||
            j.location.toLowerCase().includes(q) ||
            j.description.toLowerCase().includes(q);
            
        const matchesViewed = viewedState === 0 || 
            (viewedState === 1 && !j.viewed) || 
            (viewedState === 2 && j.viewed);
            
        const matchesApplied = appliedState === 0 || 
            (appliedState === 1 && !j.applied) || 
            (appliedState === 2 && j.applied);
            
        const matchesLocation = locationState === 0 ||
            (locationState === 1 && (j.location.toLowerCase().includes('berlin') || 
                                   j.location.toLowerCase().includes('germany'))) ||
            (locationState === 2 && (!j.location.toLowerCase().includes('berlin') && 
                                   !j.location.toLowerCase().includes('germany')));

        return matchesSearch && matchesViewed && matchesApplied && matchesLocation;
    });
    
    renderList();
}

listEl.addEventListener('click', async e => {
    const jobEl = e.target.closest('.job-item');
    if (!jobEl) return;

    const job = getJobFromEl(jobEl);
    if (!job) return;

    if (e.target.closest('.del')) return await deleteJob(jobEl, job);
    if (e.target.closest('.apply-btn')) return await toggleApply(jobEl, job);
    if (e.target.closest('.view-btn')) return await markViewed(jobEl, job, true);

    selectJob(jobEl, job);
});

searchEl.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
        applyFilter();
        clearBtn.style.display = searchEl.value ? 'block' : 'none';
    }, 150);
});

clearBtn.addEventListener('click', () => {
    searchEl.value = '';
    applyFilter();
    clearBtn.style.display = 'none';
    searchEl.focus();
});

viewedDropdown.addEventListener('change', applyFilter);
appliedDropdown.addEventListener('change', applyFilter);
locationDropdown.addEventListener('change', applyFilter);

function switchProfile(profile) {
    if (!profile || profile === currentProfile) return;
    
    currentProfile = profile;
    
    document.querySelectorAll('.profile-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.profile === profile);
    });
    
    const profileIconClass = profile === 'pm' ? 'top-half' : 'bottom-half';
    const currentIcon = profileBtn.querySelector('span, .profile-image');
    
    if (currentIcon) {
        currentIcon.remove();
    }
    
    const newIcon = document.createElement('div');
    newIcon.className = `profile-image ${profileIconClass}`;
    profileBtn.prepend(newIcon);
    
    profileMenu.classList.add('hidden');
    load();

    const nameMap = { pm: "Hüh", python: "Nerfleisch" };
    showToast(`Switched to ${nameMap[profile]}`);
}

profileBtn.addEventListener('click', () => {
    profileMenu.classList.toggle('hidden');
});

document.querySelectorAll('.profile-option').forEach(btn => {
    btn.addEventListener('click', () => switchProfile(btn.dataset.profile));
});

document.addEventListener('click', (e) => {
    if (!profileBtn.contains(e.target) && !profileMenu.contains(e.target)) {
        profileMenu.classList.add('hidden');
    }
});

load();
