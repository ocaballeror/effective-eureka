const state = {
    filterTimer: null,
    jobs: [],
    filtered: [],
    currentPage: 0,
    isLoading: false,
    hasMore: true,
    currentProfile: localStorage.getItem('selectedProfile') || 'pm',
    searchTimeout: null,
    verifyAbort: new AbortController(),
    appliedState: 0, // 0: Show All, 1: Hide Applied, 2: Show Only Applied
    viewedState: 0, // 0: Show All, 1: Hide Applied, 2: Show Only Applied
    locationState: 0, // 0: Show All, 1: Hide Applied, 2: Show Only Applied
    currentJob: null // Store the currently loaded job details
};

const els = {
    list: document.getElementById('list'),
    listContainer: document.getElementById('list-container'),
    details: document.getElementById('job-details'),
    detailsError: document.getElementById('details-error'),
    search: document.getElementById('search'),
    clearBtn: document.getElementById('clear-btn'),
    toastContainer: document.getElementById('toast-container'),
    confirmOverlay: document.getElementById('confirm-overlay'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmOk: document.getElementById('confirm-ok'),
    confirmCancel: document.getElementById('confirm-cancel'),
    profileBtn: document.getElementById('profile-btn'),
    profileMenu: document.getElementById('profile-menu'),
    viewedDropdown: document.getElementById('viewed-dropdown'),
    appliedDropdown: document.getElementById('applied-dropdown'),
    locationDropdown: document.getElementById('location-dropdown'),
    viewedDropdownContainer: document.getElementById('viewed-dropdown-container'),
    appliedDropdownContainer: document.getElementById('applied-dropdown-container'),
    locationDropdownContainer: document.getElementById('location-dropdown-container'),
    jobsCount: document.getElementById('jobs-count'),
    summarizeBtn: document.getElementById('summarize-btn')
};

const endpoints = {
    list: () => `/api/job`,
    verify: (id) => `/api/job/${id}/verify`,
    view: (id) => `/api/job/${id}/view`,
    unview: (id) => `/api/job/${id}/unview`,
    apply: (id) => `/api/job/${id}/apply`,
    unapply: (id) => `/api/job/${id}/unapply`,
    delete: (id) => `/api/job/${id}`
};

function showToast(title, body = '', duration = 8000) {
    const toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.innerHTML =
        `<button class="toast-close"><span class="material-symbols-outlined">close</span></button>` +
        `<div class="toast-title">${title}</div>` +
        (body ? `<div class="toast-body">${body}</div>` : '');

    const closeToast = () => {
        toastEl.classList.remove('show');
        toastEl.addEventListener('transitionend', () => toastEl.remove(), { once: true });
    };

    toastEl.querySelector('.toast-close').addEventListener('click', closeToast);

    els.toastContainer.append(toastEl);
    requestAnimationFrame(() => toastEl.classList.add('show'));
    if (duration > 0) {
        setTimeout(closeToast, duration);
    }
}

function showConfirm(message) {
    return new Promise(resolve => {
        els.confirmMessage.textContent = message;
        els.confirmOverlay.classList.remove('hidden');

        const cleanUp = result => {
            els.confirmOverlay.classList.add('hidden');
            els.confirmOk.removeEventListener('click', onOk);
            els.confirmCancel.removeEventListener('click', onCancel);
            resolve(result);
        };

        const onOk = () => cleanUp(true);
        const onCancel = () => cleanUp(false);

        els.confirmOk.addEventListener('click', onOk);
        els.confirmCancel.addEventListener('click', onCancel);
    });
}

async function api(path, opts = {}) {
    const res = await fetch(path, { signal: AbortSignal.timeout(10000), ...opts });
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

    const btn = jobEl.querySelector('.del');
    btn.disabled = true;

    try {
        await api(endpoints.delete(job.id), { method: 'DELETE' });
        state.jobs = state.jobs.filter(j => j.id !== job.id);
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

async function load(append = false) {
    if (state.isLoading || (!append && !state.hasMore)) return;

    state.isLoading = true;

    try {
        const q = els.search.value.toLowerCase();
        const viewedState = parseInt(els.viewedDropdown.value, 10);
        const appliedState = parseInt(els.appliedDropdown.value, 10);
        const locationState = els.locationDropdown.value;

        const params = new URLSearchParams({
            profile: state.currentProfile,
            page: append ? state.currentPage : 0,
            limit: 20,
            search: q,
            viewed: viewedState,
            applied: appliedState,
            location: locationState
        });

        const response = await api(endpoints.list() + '?' + params.toString());
        if (!append) {
            state.jobs = [];
            state.filtered = [];
            state.currentPage = 0;
        }

        const newJobs = response.items;
        state.jobs = [...state.jobs, ...newJobs];
        state.filtered = [...state.filtered, ...newJobs];
        state.hasMore = response.hasMore;
        state.currentPage++;

        renderList(append);
        updateJobsCount(response.total);

        if (!append) {
            selectFirstJob();
        }
    } catch (err) {
        showToast("Couldn't load jobs. Try again later.");
        showDetailsError("Couldn't load jobs. Try again later.");
        els.jobsCount.textContent = "Showing 0 jobs";
    } finally {
        state.isLoading = false;
    }
}

function getJobFromEl(jobItem) {
    const id = jobItem.querySelector('.view-btn').dataset.id;
    return state.jobs.find(j => j.id == id);
}

function selectFirstJob() {
    if (state.filtered.length === 0) {
        showDetails(null);
        return;
    }

    // Try to restore the previously selected job
    const savedJobId = localStorage.getItem('selectedJobId');
    if (savedJobId) {
        const savedJob = state.filtered.find(j => j.id == savedJobId);
        if (savedJob) {
            const jobEl = els.list.querySelector(`[data-id="${savedJobId}"]`)?.closest('.job-item');
            if (jobEl) {
                selectJob(jobEl, savedJob);
                return;
            }
        }
    }

    // Fall back to first job if saved job not found
    const job = state.filtered[0];
    const jobEl = els.list.querySelector('.job-item');
    if (jobEl) {
        selectJob(jobEl, job);
    }
}

async function selectJob(jobEl, job) {
    if (!jobEl || !job) return;
    if (jobEl.classList.contains('active')) return;

    document.querySelectorAll('.job-item').forEach(x => x.classList.remove('active'));
    jobEl.classList.add('active');
    markViewed(jobEl, job, false);

    // Fetch job details from API
    try {
        const details = await api(`/api/job/${job.id}`);
        showDetails(details);
    } catch (e) {
        showToast('Failed to load job details');
        showDetailsError('Failed to load job details');
    }

    // Save selected job ID
    localStorage.setItem('selectedJobId', job.id);
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

    const logo = document.createElement('img');
    logo.className = 'company-logo';
    logo.src = "/.netlify/images?url=" + encodeURIComponent(job.logo || 'default-logo.png');
    logo.alt = `${job.company} logo`;
    content.appendChild(logo);

    const textContent = document.createElement('div');
    textContent.className = 'job-text-content';
    textContent.innerHTML = `<h3>${job.title}</h3>
                       <div class="meta">${job.company} · ${(Array.isArray(job.locations) ? job.locations.join(', ') : job.locations || '')}</div>`;
    content.appendChild(textContent);

    el.appendChild(content);

    if (job.viewed) el.classList.add('viewed');
    if (job.applied) el.classList.add('applied');

    return el;
}

function renderList(append = false) {
    if (!append) {
        els.list.innerHTML = '';
    }

    if (state.filtered.length === 0) {
        els.list.innerHTML = '<div class="no-results">No jobs found</div>';
        return;
    }

    const frag = document.createDocumentFragment();
    const startIdx = append ? els.list.children.length : 0;
    const endIdx = Math.min(startIdx + 20, state.filtered.length);

    for (let i = startIdx; i < endIdx; i++) {
        frag.appendChild(createJobEl(state.filtered[i]));
    }

    els.list.appendChild(frag);
}

function updateJobsCount(totalJobs) {
    els.jobsCount.textContent = `Showing ${totalJobs} jobs`;
}

async function verifyJob(job) {
    const statusEl = document.querySelector('span.job-status');
    statusEl.classList.add('spinner');
    statusEl.classList.remove('ok');
    statusEl.classList.remove('fail');

    try {
        const { active } = await api(endpoints.verify(job.id), { signal: state.verifyAbort.signal });
        statusEl.classList.remove('spinner');
        statusEl.classList.add(active === null ? 'unknown' : (active ? 'ok' : 'fail'));
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.log(err);
            statusEl.classList.remove('spinner');
            statusEl.classList.add('unknown');
        }
    }
}

function showDetailsError(content) {
    els.details.classList.add('hidden');
    els.detailsError.classList.remove('hidden');
    els.detailsError.innerHTML = `<em>${content}</em>`;
};

async function updateDescription(descriptionEl, content, isSummarized) {
    // Add fade-out class
    descriptionEl.classList.add('fade-out');

    // Wait for fade-out animation
    await new Promise(resolve => setTimeout(resolve, 300));

    // Update content and classes
    descriptionEl.innerHTML = content;
    descriptionEl.classList.toggle('summary-mode', isSummarized);

    // Remove fade-out class to trigger fade-in
    requestAnimationFrame(() => {
        descriptionEl.classList.remove('fade-out');
    });
}

function showDetails(job) {
    if (!job) {
        showDetailsError('Select a job...');
        return;
    }

    state.currentJob = job; // Store the current job details

    els.details.classList.remove('hidden');
    els.detailsError.classList.add('hidden');

    els.details.querySelector('h2').innerText = job.title;
    els.details.querySelector('div.info').innerText = `${job.company} · ${(Array.isArray(job.locations) ? job.locations.join(', ') : job.locations || '')}`;
    els.details.querySelector('a.apply-btn').href = job.link;

    // Show/hide summarize button based on summary availability
    els.summarizeBtn.style.display = job.summary ? 'inline-flex' : 'none';

    // Restore summarize state from localStorage
    const isSummarized = localStorage.getItem('summarizeEnabled') === 'true';
    els.summarizeBtn.classList.toggle('active', isSummarized);

    const descriptionEl = els.details.querySelector('div.description');

    if (isSummarized && job.summary) {
        // Convert markdown to HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = marked.parse(job.summary);
        updateDescription(descriptionEl, tempDiv.innerHTML, true);
    } else {
        updateDescription(descriptionEl, job.html || job.description, false);
    }

    state.verifyAbort.abort();
    state.verifyAbort = new AbortController();

    verifyJob(job);
}

function applyFilter() {
    const q = els.search.value.toLowerCase();
    const viewedState = parseInt(els.viewedDropdown.value, 10);
    const appliedState = parseInt(els.appliedDropdown.value, 10);
    const locationState = els.locationDropdown.value;

    localStorage.setItem('viewedFilter', els.viewedDropdown.value);
    localStorage.setItem('appliedFilter', els.appliedDropdown.value);
    localStorage.setItem('locationFilter', els.locationDropdown.value);

    // Reset pagination and reload
    state.currentPage = 0;
    state.hasMore = true;
    load();
}

els.list.addEventListener('click', async e => {
    const jobEl = e.target.closest('.job-item');
    if (!jobEl) return;

    const job = getJobFromEl(jobEl);
    if (!job) return;

    if (e.target.closest('.del')) return await deleteJob(jobEl, job);
    if (e.target.closest('.apply-btn')) return await toggleApply(jobEl, job);
    if (e.target.closest('.view-btn')) return await markViewed(jobEl, job, true);

    await selectJob(jobEl, job);
});

els.search.addEventListener('input', () => {
    clearTimeout(state.searchTimeout);
    els.clearBtn.style.display = els.search.value ? 'block' : 'none';

    state.searchTimeout = setTimeout(() => {
        // Reset pagination and reload
        state.currentPage = 0;
        state.hasMore = true;
        load();
        localStorage.setItem('searchQuery', els.search.value);
    }, 500); // 500ms debounce delay
});

els.clearBtn.addEventListener('click', () => {
    els.search.value = '';
    els.clearBtn.style.display = 'none';
    // Reset pagination and reload
    state.currentPage = 0;
    state.hasMore = true;
    load();
    localStorage.removeItem('searchQuery');
    els.search.focus();
});

els.viewedDropdown.addEventListener('change', applyFilter);
els.appliedDropdown.addEventListener('change', applyFilter);
els.locationDropdown.addEventListener('change', applyFilter);

function switchProfile(profile) {
    if (!profile || profile === state.currentProfile) return;

    state.currentProfile = profile;
    localStorage.setItem('selectedProfile', profile);
    localStorage.removeItem('selectedJobId'); // Clear selected job when switching profiles

    // Update profile menu selection
    document.querySelectorAll('.profile-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.profile === profile);
    });

    els.profileMenu.classList.add('hidden');
    load();

    const nameMap = { pm: "Hüh", py: "Nerfleisch" };
    showToast(`Switched to ${nameMap[profile]}`);
}

els.profileBtn.addEventListener('click', () => {
    els.profileMenu.classList.toggle('hidden');
});

document.querySelectorAll('.profile-option').forEach(btn => {
    btn.addEventListener('click', () => switchProfile(btn.dataset.profile));
});

document.addEventListener('click', (e) => {
    if (!els.profileBtn.contains(e.target) && !els.profileMenu.contains(e.target)) {
        els.profileMenu.classList.add('hidden');
    }
});

// Initialize custom dropdowns
function initializeCustomDropdowns() {
    // Setup each dropdown
    setupCustomDropdown(els.viewedDropdownContainer, els.viewedDropdown);
    setupCustomDropdown(els.appliedDropdownContainer, els.appliedDropdown);
    setupCustomDropdown(els.locationDropdownContainer, els.locationDropdown);

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        const dropdowns = document.querySelectorAll('.custom-dropdown');
        dropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
                dropdown.querySelector('.dropdown-menu').classList.add('hidden');
            }
        });
    });
}

function setupCustomDropdown(container, selectElement) {
    const button = container.querySelector('.dropdown-button');
    const menu = container.querySelector('.dropdown-menu');
    const items = container.querySelectorAll('.dropdown-item');
    const text = container.querySelector('.dropdown-text');

    // Set initial active state
    updateDropdownActiveItem(container, selectElement.value);

    // Toggle menu on button click
    button.addEventListener('click', () => {
        const isActive = container.classList.contains('active');

        // Close all dropdowns first
        document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
            dropdown.classList.remove('active');
            dropdown.querySelector('.dropdown-menu').classList.add('hidden');
        });

        // Toggle current dropdown
        if (!isActive) {
            container.classList.add('active');
            menu.classList.remove('hidden');
        }
    });

    // Handle item selection
    items.forEach(item => {
        item.addEventListener('click', () => {
            const value = item.dataset.value;
            text.textContent = item.textContent;

            // Update the hidden select element
            selectElement.value = value;

            // Dispatch change event to trigger any existing listeners
            selectElement.dispatchEvent(new Event('change'));

            // Update active state
            updateDropdownActiveItem(container, value);

            // Hide menu
            container.classList.remove('active');
            menu.classList.add('hidden');
        });
    });
}

function updateDropdownActiveItem(container, value) {
    const items = container.querySelectorAll('.dropdown-item');
    const text = container.querySelector('.dropdown-text');

    items.forEach(item => {
        if (item.dataset.value === value) {
            item.classList.add('active');
            text.textContent = item.textContent;
        } else {
            item.classList.remove('active');
        }
    });
}

// Initialize the correct profile and filters on page load
function initializeProfile() {
    const savedProfile = localStorage.getItem('selectedProfile');
    if (savedProfile) {
        // Set the active class on the correct profile option
        document.querySelectorAll('.profile-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.profile === savedProfile);
        });
    }

    // Restore filter selections
    const viewedFilter = localStorage.getItem('viewedFilter');
    if (viewedFilter) {
        els.viewedDropdown.value = viewedFilter;
        updateDropdownActiveItem(els.viewedDropdownContainer, viewedFilter);
    }

    const appliedFilter = localStorage.getItem('appliedFilter');
    if (appliedFilter) {
        els.appliedDropdown.value = appliedFilter;
        updateDropdownActiveItem(els.appliedDropdownContainer, appliedFilter);
    }

    const locationFilter = localStorage.getItem('locationFilter');
    if (locationFilter) {
        els.locationDropdown.value = locationFilter;
        updateDropdownActiveItem(els.locationDropdownContainer, locationFilter);
    }

    // Restore search query
    const searchQuery = localStorage.getItem('searchQuery');
    if (searchQuery) {
        els.search.value = searchQuery;
        els.clearBtn.style.display = 'block';
    }
}

initializeProfile();
initializeCustomDropdowns();

// Add scroll event listener for infinite scrolling
els.listContainer.onscroll = (() => {
    let ticking = false;
    return () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const { scrollTop, scrollHeight, clientHeight } = els.listContainer;

            // Load more when user scrolls to within 200px of the bottom
            if (scrollHeight - scrollTop - clientHeight < 200 && state.hasMore && !state.isLoading) {
                load(true);
            }
            ticking = false;
        });
    };
})();

els.summarizeBtn.addEventListener('click', async () => {
    const job = state.currentJob;
    if (!job) return;

    els.summarizeBtn.classList.toggle('active');
    const isSummarized = els.summarizeBtn.classList.contains('active');
    localStorage.setItem('summarizeEnabled', isSummarized);

    const descriptionEl = els.details.querySelector('div.description');

    if (isSummarized && job.summary) {
        // Convert markdown to HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = marked.parse(job.summary);
        await updateDescription(descriptionEl, tempDiv.innerHTML, true);
    } else {
        await updateDescription(descriptionEl, job.html || job.description, false);
    }
});

// Initial load
load();
