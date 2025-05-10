import express from 'express';
import fs from 'fs';
import serverless from 'serverless-http';
import path from 'path';

const app = express();
const router = express.Router();

app.use(express.json());
app.use(express.static(path.resolve(process.cwd(), 'public')));

const DATA = path.resolve('./data/jobs.json');
const IGNORED = path.resolve('./data/ignored.json');

function readJobs() {
    const jobs = JSON.parse(fs.readFileSync(DATA, 'utf8'));
    const ignored = JSON.parse(fs.readFileSync(IGNORED, 'utf8'));

    return jobs.filter(item1 => !ignored.some(item2 => item2.id === item1.id));
}

function ignoreJob(jobid) {
    console.log('Ingoring job ' + jobid);
    var ignored = JSON.parse(fs.readFileSync(IGNORED, 'utf8'));

    if (!ignored.some(item => item.id == jobid)) {
        const alljobs = JSON.parse(fs.readFileSync(DATA, 'utf8'));
        const job = alljobs.find(job => job.id == jobid);

        ignored.push(job);
        fs.writeFileSync(IGNORED, JSON.stringify(ignored));
    }
}

router.get('/jobs', (req, res) => {
    const jobs = readJobs().map((job, i) => ({ id: i, ...job }));
    res.json(jobs);
});

router.delete('/jobs/:id', (req, res) => {
    console.log("Deletion request for job " + req.params.id);
    const id = parseInt(req.params.id, 10);
    let jobs = readJobs();
    jobs.splice(id, 1);
    ignoreJob(id);
    res.sendStatus(204);
});

app.use("/api", router);
export const handler = serverless(app);

app.listen(3000, () => console.log("Listening on http://localhost:3000"));
