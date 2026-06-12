const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const jwt = require('jsonwebtoken');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const router = express.Router({ mergeParams: true });

/**
 * Git Integration Routes.
 * Simulates a standard Git workflow by syncing DB-stored files to a temporary
 * disk directory and executing standard Git CLI commands.
 */

const verifyJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.userId = decoded.id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.use(verifyJwt);

/**
 * Helper: Synchronizes database file records to a temporary disk directory.
 * Initializes a Git repository if it doesn't exist. This is required because
 * native Git commands need actual files on a file system.
 */
async function syncDbToDisk(projectId) {
  const projectDir = path.join(os.tmpdir(), `codev_project_${projectId}`);
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  if (!fs.existsSync(path.join(projectDir, '.git'))) {
    await new Promise((resolve) => exec('git init', { cwd: projectDir }, resolve));
    await new Promise((resolve) => exec('git config user.email "user@codev.local" && git config user.name "CoDev User"', { cwd: projectDir }, resolve));
  }

  const filesInDir = fs.readdirSync(projectDir);
  for (const file of filesInDir) {
    if (file !== '.git') {
      fs.rmSync(path.join(projectDir, file), { recursive: true, force: true });
    }
  }

  const files = await prisma.file.findMany({ where: { projectId } });
  const fileMap = {};
  files.forEach(f => fileMap[f.id] = f);

  const getPath = (fileId) => {
    const f = fileMap[fileId];
    if (!f) return '';
    if (!f.parentId) return f.name;
    return path.join(getPath(f.parentId), f.name);
  };

  files.filter(f => f.type === 'directory').forEach(d => {
    const dPath = path.join(projectDir, getPath(d.id));
    if (!fs.existsSync(dPath)) fs.mkdirSync(dPath, { recursive: true });
  });

  files.filter(f => f.type === 'file').forEach(f => {
    const fPath = path.join(projectDir, getPath(f.id));
    const parentDir = path.dirname(fPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fPath, f.content || '', 'utf8');
  });

  return projectDir;
}

const execGit = (cmd, cwd) => {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      resolve({ stdout: stdout || '', stderr: stderr || '', error });
    });
  });
};

/**
 * Retrieves the current working tree status (`git status -s`).
 */
router.get('/:id/git/status', async (req, res) => {
  try {
    const cwd = await syncDbToDisk(req.params.id);
    const { stdout, stderr, error } = await execGit('git status -s', cwd);
    const lines = stdout.split('\n').filter(l => l.trim().length > 0);
    const files = lines.map(line => {
      const status = line.substring(0, 2).trim();
      const file = line.substring(3).trim();
      return { status, file };
    });
    res.json({ files, rawOutput: stdout || stderr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/git/commit', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Commit message is required' });
    
    const cwd = await syncDbToDisk(req.params.id);
    await execGit('git add .', cwd);
    const escapedMessage = message.replace(/"/g, '\\"');
    const { stdout, stderr, error } = await execGit(`git commit -m "${escapedMessage}"`, cwd);
    
    if (error && stdout.includes('nothing to commit')) {
      return res.json({ success: true, output: 'Nothing to commit.' });
    }
    res.json({ success: !error, output: stdout || stderr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/git/push', async (req, res) => {
  try {
    const cwd = await syncDbToDisk(req.params.id);
    const { stdout, stderr, error } = await execGit('git push', cwd);
    res.json({ success: !error, output: stdout || stderr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/git/pull-requests', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const cwd = await syncDbToDisk(req.params.id);
    const branchName = `pr_${Date.now()}`;
    await execGit(`git checkout -b ${branchName}`, cwd);
    await execGit('git add .', cwd);
    const escapedTitle = title.replace(/"/g, '\\"');
    await execGit(`git commit -m "${escapedTitle}"`, cwd);

    const pr = await prisma.pullRequest.create({
      data: {
        projectId: req.params.id,
        title,
        description: description || '',
        branchOrCommitHash: branchName,
        authorId: req.userId
      }
    });

    res.status(201).json({ pr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/git/pull-requests', async (req, res) => {
  try {
    const prs = await prisma.pullRequest.findMany({
      where: { projectId: req.params.id },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ prs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:id/git/pull-requests/:prId', async (req, res) => {
  try {
    const { status } = req.body;
    const pr = await prisma.pullRequest.findUnique({ where: { id: req.params.prId } });
    if (!pr) return res.status(404).json({ error: 'Not found' });

    if (status === 'MERGED') {
      const cwd = await syncDbToDisk(req.params.id);
      await execGit('git checkout main || git checkout master', cwd);
      await execGit('git add .', cwd);
      const escapedTitle = pr.title.replace(/"/g, '\\"');
      await execGit(`git commit -m "Merge PR: ${escapedTitle}"`, cwd);
    }

    const updatedPr = await prisma.pullRequest.update({
      where: { id: req.params.prId },
      data: { status }
    });

    res.json({ pr: updatedPr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/git/logs', async (req, res) => {
  try {
    const cwd = await syncDbToDisk(req.params.id);
    const { stdout, error } = await execGit('git log --pretty=format:"%h|%an|%ar|%s" -n 50', cwd);
    if (error || !stdout) {
      return res.json({ logs: [] });
    }
    const logs = stdout.split('\n').filter(l => l.trim().length > 0).map(line => {
      const [hash, author, time, ...msgParts] = line.split('|');
      return { hash, author, time, message: msgParts.join('|') };
    });
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
