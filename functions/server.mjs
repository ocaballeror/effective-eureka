const express = require('express');
const fs = require('fs');
const path = require('path');
const serverless = require('serverless-http');
const app = express();
const router = express.Router();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA = path.resolve('./data/jobs.json');

function readJobs() {
  return JSON.parse(fs.readFileSync(DATA, 'utf8'));
}

function writeJobs(arr) {
  fs.writeFileSync(DATA, JSON.stringify(arr, null,2));
}

router.get('/jobs', (req, res) => {
  const jobs = readJobs().map((job, i) => ({ id: i, ...job }));
  res.json(jobs);
});

router.delete('/jobs/:id', (req, res) => {
  const id = parseInt(req.params.id,10);
  let jobs = readJobs();
  if (id < 0 || id >= jobs.length) return res.status(404).send();
  jobs.splice(id,1);
  writeJobs(jobs);
  res.sendStatus(204);
});

app.use("/api", router);
export const handler = serverless(app);
