let filterTimer;
let jobs = [], filtered = [];
let currentPage = 0;
let isLoading = false;
let hasMore = true;
let currentProfile = localStorage.getItem('selectedProfile') || 'pm';
let searchTimeout;

let verifyAbort = new AbortController();

const listEl = document.getElementById('list'),
    listContainer = document.getElementById('list-container'),
    detailsEl = document.getElementById('job-details'),
    detailsErrorEl = document.getElementById('details-error'),
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
    locationDropdown = document.getElementById('location-dropdown'),
    viewedDropdownContainer = document.getElementById('viewed-dropdown-container'),
    appliedDropdownContainer = document.getElementById('applied-dropdown-container'),
    locationDropdownContainer = document.getElementById('location-dropdown-container'),
    jobsCountEl = document.getElementById('jobs-count'),
    summarizeBtn = document.getElementById('summarize-btn');

let appliedState = 0; // 0: Show All, 1: Hide Applied, 2: Show Only Applied
let viewedState = 0; // 0: Show All, 1: Hide Applied, 2: Show Only Applied
let locationState = 0; // 0: Show All, 1: Hide Applied, 2: Show Only Applied

const endpoints = {
    list: () => `/api/job`,
    verify: (id) => `/api/job/${id}/verify`,
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

async function load(append = false) {
    if (isLoading || (!append && !hasMore)) return;
    
    isLoading = true;
    try {
        const q = searchEl.value.toLowerCase();
        const viewedState = parseInt(viewedDropdown.value, 10);
        const appliedState = parseInt(appliedDropdown.value, 10);
        const locationState = locationDropdown.value;

        const params = new URLSearchParams({
            profile: currentProfile,
            page: append ? currentPage : 0,
            limit: 20,
            search: q
        });

        const response = await api(endpoints.list() + '?' + params.toString());
        
        if (!append) {
            jobs = [];
            filtered = [];
            currentPage = 0;
        }

        const newJobs = response.items;
        jobs = [...jobs, ...newJobs];
        hasMore = response.hasMore;
        currentPage++;

        // Apply filters to new jobs
        const newFiltered = newJobs.filter(j => {
            const matchesViewed = viewedState === 0 ||
                (viewedState === 1 && !j.viewed) ||
                (viewedState === 2 && j.viewed);

            const matchesApplied = appliedState === 0 ||
                (appliedState === 1 && !j.applied) ||
                (appliedState === 2 && j.applied);

            let matchesLocation = true;
            if (locationState !== "all") {
                const location = j.location.toLowerCase();
                if (locationState === "remote") {
                    matchesLocation = location.includes('remote');
                } else {
                    matchesLocation = location.includes(locationState);
                }
            }

            return matchesViewed && matchesApplied && matchesLocation;
        });

        filtered = [...filtered, ...newFiltered];
        renderList(append);
        updateJobsCount(response.total);
        
        if (!append) {
            selectFirstJob();
        }
    } catch (err) {
        console.error("Failed to load jobs:", err);
        showToast("Couldn't load jobs. Try again later.");
        showDetailsError("Couldn't load jobs. Try again later.");
        jobsCountEl.textContent = "Showing 0 jobs";
    } finally {
        isLoading = false;
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
    
    const logo = document.createElement('img');
    logo.className = 'company-logo';
    logo.src = job.logo || 'default-logo.png';
    logo.alt = `${job.company} logo`;
    content.appendChild(logo);

    const textContent = document.createElement('div');
    textContent.className = 'job-text-content';
    textContent.innerHTML = `<h3>${job.title}</h3>
                       <div class="meta">${job.company} · ${job.location}</div>`;
    content.appendChild(textContent);

    el.appendChild(content);

    if (job.viewed) el.classList.add('viewed');
    if (job.applied) el.classList.add('applied');

    return el;
}

function renderList(append = false) {
    if (!append) {
        listEl.innerHTML = '';
    }

    // Update the job count display
    updateJobsCount();

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="no-results">No jobs found</div>';
        return;
    }

    const frag = document.createDocumentFragment();
    const startIdx = append ? listEl.children.length : 0;
    const endIdx = Math.min(startIdx + 20, filtered.length);
    
    for (let i = startIdx; i < endIdx; i++) {
        frag.appendChild(createJobEl(filtered[i]));
    }
    
    listEl.appendChild(frag);
}

function updateJobsCount(totalJobs) {
    const filteredJobs = filtered.length;

    if (totalJobs === filteredJobs) {
        jobsCountEl.textContent = `Showing all ${totalJobs} jobs`;
    } else {
        jobsCountEl.textContent = `Showing ${filteredJobs} of ${totalJobs} jobs`;
    }
}

async function verifyJob(job) {
    const statusEl = document.querySelector('span.job-status');
    statusEl.classList.add('spinner');
    statusEl.classList.remove('ok');
    statusEl.classList.remove('fail');

    try {
        const { active } = await api(endpoints.verify(job.id), { signal: verifyAbort.signal });
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
    detailsEl.classList.add('hidden');
    detailsErrorEl.classList.remove('hidden');
    detailsErrorEl.innerHTML = `<em>${content}</em>`;
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

    detailsEl.classList.remove('hidden');
    detailsErrorEl.classList.add('hidden');

    detailsEl.querySelector('h2').innerText = job.title;
    detailsEl.querySelector('div.info').innerText = `${job.company} · ${job.location}`;
    detailsEl.querySelector('a.apply-btn').href = job.link;
    
    // Show/hide summarize button based on summary availability
    summarizeBtn.style.display = job.summary ? 'inline-flex' : 'none';
    
    // Restore summarize state from localStorage
    const isSummarized = localStorage.getItem('summarizeEnabled') === 'true';
    summarizeBtn.classList.toggle('active', isSummarized);
    
    const descriptionEl = detailsEl.querySelector('div.description');
    
    if (isSummarized && job.summary) {
        // Convert markdown to HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = marked.parse(job.summary);
        updateDescription(descriptionEl, tempDiv.innerHTML, true);
    } else {
        updateDescription(descriptionEl, job.html || job.description, false);
    }

    verifyAbort.abort();
    verifyAbort = new AbortController();

    verifyJob(job);
}

function applyFilter() {
    const q = searchEl.value.toLowerCase();
    const viewedState = parseInt(viewedDropdown.value, 10);
    const appliedState = parseInt(appliedDropdown.value, 10);
    const locationState = locationDropdown.value;

    localStorage.setItem('viewedFilter', viewedDropdown.value);
    localStorage.setItem('appliedFilter', appliedDropdown.value);
    localStorage.setItem('locationFilter', locationDropdown.value);

    // Reset pagination and reload
    currentPage = 0;
    hasMore = true;
    load();
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
    clearTimeout(searchTimeout);
    clearBtn.style.display = searchEl.value ? 'block' : 'none';
    
    searchTimeout = setTimeout(() => {
        // Reset pagination and reload
        currentPage = 0;
        hasMore = true;
        load();
        localStorage.setItem('searchQuery', searchEl.value);
    }, 500); // 500ms debounce delay
});

clearBtn.addEventListener('click', () => {
    searchEl.value = '';
    clearBtn.style.display = 'none';
    // Reset pagination and reload
    currentPage = 0;
    hasMore = true;
    load();
    localStorage.removeItem('searchQuery');
    searchEl.focus();
});

viewedDropdown.addEventListener('change', applyFilter);
appliedDropdown.addEventListener('change', applyFilter);
locationDropdown.addEventListener('change', applyFilter);

function switchProfile(profile) {
    if (!profile || profile === currentProfile) return;

    currentProfile = profile;
    localStorage.setItem('selectedProfile', profile);

    // Update profile menu selection
    document.querySelectorAll('.profile-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.profile === profile);
    });

    profileMenu.classList.add('hidden');
    load();

    const nameMap = { pm: "Hüh", py: "Nerfleisch" };
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

// Initialize custom dropdowns
function initializeCustomDropdowns() {
    // Setup each dropdown
    setupCustomDropdown(viewedDropdownContainer, viewedDropdown);
    setupCustomDropdown(appliedDropdownContainer, appliedDropdown);
    setupCustomDropdown(locationDropdownContainer, locationDropdown);

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
        viewedDropdown.value = viewedFilter;
        updateDropdownActiveItem(viewedDropdownContainer, viewedFilter);
    }

    const appliedFilter = localStorage.getItem('appliedFilter');
    if (appliedFilter) {
        appliedDropdown.value = appliedFilter;
        updateDropdownActiveItem(appliedDropdownContainer, appliedFilter);
    }

    const locationFilter = localStorage.getItem('locationFilter');
    if (locationFilter) {
        locationDropdown.value = locationFilter;
        updateDropdownActiveItem(locationDropdownContainer, locationFilter);
    }

    // Restore search query
    const searchQuery = localStorage.getItem('searchQuery');
    if (searchQuery) {
        searchEl.value = searchQuery;
        clearBtn.style.display = 'block';
    }
}

initializeProfile();
initializeCustomDropdowns();

// Add scroll event listener for infinite scrolling
listContainer.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = listContainer;
    if (scrollHeight - scrollTop <= clientHeight * 1.5) {
        load(true);
    }
});

summarizeBtn.addEventListener('click', async () => {
    const job = getJobFromEl(document.querySelector('.job-item.active'));
    if (!job) return;

    summarizeBtn.classList.toggle('active');
    const isSummarized = summarizeBtn.classList.contains('active');
    localStorage.setItem('summarizeEnabled', isSummarized);
    
    const descriptionEl = detailsEl.querySelector('div.description');
    
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
