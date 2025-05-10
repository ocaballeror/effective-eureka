let jobs = [], filtered = [];
const listEl = document.getElementById('list'),
    detailsEl = document.getElementById('details'),
    searchEl = document.getElementById('search'),
    clearBtn = document.getElementById('clear-btn');


function load() {
    fetch('/api/jobs')
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
      <button class="del">X</button>
      <h3>${job.title}</h3>
      <div class="meta">${job.company} · ${job.location}</div>
    `;
        el.onclick = e => {
            if (e.target.matches('.del')) return;
            document.querySelectorAll('.job-item').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            showDetails(job);
        };
        el.querySelector('.del').onclick = () => {
            if (!confirm('Delete this job?')) return;
            fetch('/api/jobs/' + job.id, { method: 'DELETE' })
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
        listEl.appendChild(el);
    });
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
