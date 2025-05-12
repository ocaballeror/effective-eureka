let jobs = [], filtered = [];
const listEl = document.getElementById('list'),
    detailsEl = document.getElementById('details'),
    searchEl = document.getElementById('search'),
    clearBtn = document.getElementById('clear-btn');


function load() {
    fetch('/api/job')
        .then(r => r.json())
        .then(data => {
            jobs = data;
            filtered = jobs;
            renderList();

            // ← auto-select the first job on initial load
            if (filtered.length > 0) {
                const firstEl = listEl.querySelector('.job-item');
                firstEl.classList.add('active');
                showDetails(filtered[0]);
            }
        });
}

function renderList() {
    listEl.innerHTML = '';
    filtered.forEach(job => {
        const el = document.createElement('div');
        el.className = 'job-item';
        el.innerHTML = `
      <div class="job-actions">
          <button class="del"><span class="material-symbols-outlined">close</span></button>
          <button class="view-btn" data-id=${job.id}><span class="material-symbols-outlined">visibility</span></button>
          <button class="apply-btn" data-id=${job.id}><span class="material-symbols-outlined">outgoing_mail</span></button>
      </div>
      <div class="job-content">
          <h3>${job.title}</h3>
          <div class="meta">${job.company} · ${job.location}</div>
      </div>
    `;
        if (job.viewed) {
            el.classList.add('viewed');
            el.querySelector('.view-btn span').textContent = 'visibility_off';
        }
        if (job.applied) {
            el.classList.add('applied');
        }


        el.onclick = e => {
            if (e.target.closest('.job-actions button')) return;
            viewJob(el, job, false);
            console.log('on click ' + e);

            document.querySelectorAll('.job-item').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            showDetails(job);
        };

        const del = el.querySelector('.del');
        del.onclick = () => {
            if (!confirm('Delete this job?')) return;
            fetch('/api/job/' + job.id, { method: 'DELETE' })
                .then(res => {
                    if (res.status === 200) {
                        jobs = jobs.filter(j => j.id !== job.id);
                        applyFilter();
                        if (filtered.length > 0) {
                            const firstEl = listEl.querySelector('.job-item');
                            firstEl.classList.add('active');
                            showDetails(filtered[0]);
                        }
                    }
                });
        };
        // del.addEventListener('mouseenter', () => del.querySelector('span').textContent = 'delete');
        // del.addEventListener('mouseleave', () => del.querySelector('span').textContent = 'delete_outline');

        const applied = el.querySelector('.apply-btn');
        applied.onclick = () => {
            // pop animation
            applied.classList.add('clicked');
            setTimeout(() => applied.classList.remove('clicked'), 300);

            const url = `/api/job/${job.id}/${el.classList.contains('applied') ? 'unapply' : 'apply'}`;
            fetch(url).then(res => {
                if (res.status === 200) {
                    job.applied = !job.applied;
                    el.classList.toggle('applied', job.applied);
                }
            });
        };

        const viewbtn = el.querySelector('.view-btn');
        viewbtn.onclick = () => viewJob(el, job, true);
        listEl.appendChild(el);
    });
}

function viewJob(el, job, cycle = false) {
    if (el.classList.contains('viewed') && cycle) {
        console.log("marking unviewed");
        fetch('/api/job/' + job.id + '/unview')
            .then(res => {
                if (res.status === 200) {
                    el.querySelector('.view-btn span').textContent = 'visibility';
                    job.viewed = false;
                    el.classList.remove('viewed');
                }
            });
    } else {
        console.log("marking viewed");
        fetch('/api/job/' + job.id + '/view')
            .then(res => {
                if (res.status === 200) {
                    el.querySelector('.view-btn span').textContent = 'visibility_off';
                    job.viewed = true;
                    el.classList.add('viewed');
                }
            });
    }
}

function showDetails(job) {
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
    filtered = jobs.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
    );
    renderList();
}

searchEl.addEventListener('input', () => {
    applyFilter();
    clearBtn.style.display = searchEl.value ? 'block' : 'none';
});

clearBtn.addEventListener('click', () => {
    searchEl.value = '';
    applyFilter();
    clearBtn.style.display = 'none';
    searchEl.focus();
});

load();
