const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const SUPPORTED_RUNNERS = {
  javascript: { ext: 'js',  buildCmd: (f) => `node "${f}"` },
  typescript: { ext: 'ts',  buildCmd: (f) => `node "${f}"` },
  python:     { ext: 'py',  buildCmd: (f) => `python "${f}"` },
};

const resolvePythonCmd = (filePath) => {
  return new Promise((resolve) => {
    exec('python3 --version', (err) => {
      resolve(err ? `python "${filePath}"` : `python3 "${filePath}"`);
    });
  });
};

const runSingleTest = (cmd, inputStr, timeoutMs) => {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = exec(cmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
      const elapsed = Date.now() - startTime;
      if (error) {
        const timedOut = error.killed || error.signal === 'SIGTERM';
        return resolve({
          stdout: '',
          stderr: timedOut ? 'Time Limit Exceeded (5000ms)' : (stderr || error.message),
          elapsedMs: elapsed,
          timedOut,
          error: true,
        });
      }
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        elapsedMs: elapsed,
        timedOut: false,
        error: false,
      });
    });

    if (child.stdin) {
      try {
        child.stdin.write(inputStr || '');
        child.stdin.end();
      } catch (_) {}
    }
  });
};

router.post('/', async (req, res) => {
  const { language, code } = req.body;

  if (!language || code === undefined || code === null) {
    return res.status(400).json({ output: 'Missing language or code in request body.', isError: true });
  }

  const lang = language.toLowerCase();
  const runner = SUPPORTED_RUNNERS[lang];
  if (!runner) {
    return res.status(400).json({
      output: `Language "${language}" is not supported. Supported: javascript, typescript, python.`,
      isError: true,
    });
  }

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `codev_exec_${Date.now()}.${runner.ext}`);

  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
  } catch (writeErr) {
    return res.status(500).json({ output: `Failed to write temp file: ${writeErr.message}`, isError: true });
  }

  let cmd;
  if (lang === 'python') {
    cmd = await resolvePythonCmd(tmpFile);
  } else {
    cmd = runner.buildCmd(tmpFile);
  }

  exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
    try { fs.unlinkSync(tmpFile); } catch (_) {}

    if (error) {
      const timedOut = error.killed || error.signal === 'SIGTERM';
      if (timedOut) {
        return res.json({ output: 'Process timed out after 5000ms.', isError: true });
      }
      return res.json({ output: stderr || error.message || 'Unknown error', isError: true });
    }

    const hasStderr = stderr && stderr.trim().length > 0;
    if (hasStderr) {
      return res.json({ output: stderr, isError: true });
    }

    res.json({ output: stdout || '', isError: false });
  });
});

router.post('/test-suite', async (req, res) => {
  const { code, language, testCases } = req.body;

  const lang = (language || 'python').toLowerCase();

  if (!code) {
    return res.status(400).json({ error: 'Missing code.' });
  }
  if (!Array.isArray(testCases) || testCases.length === 0) {
    return res.status(400).json({ error: 'testCases must be a non-empty array.' });
  }

  const runner = SUPPORTED_RUNNERS[lang];
  if (!runner) {
    return res.status(400).json({ error: `Language "${lang}" is not supported.` });
  }

  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `codev_arena_${Date.now()}.${runner.ext}`);

  try {
    fs.writeFileSync(tmpFile, code, 'utf8');
  } catch (writeErr) {
    return res.status(500).json({ error: `Failed to write temp file: ${writeErr.message}` });
  }

  let baseCmd;
  if (lang === 'python') {
    baseCmd = await resolvePythonCmd(tmpFile);
  } else {
    baseCmd = runner.buildCmd(tmpFile);
  }

  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const inputStr = tc.input || '';
    const expectedOutput = (tc.expectedOutput || '').trim();

    const result = await runSingleTest(baseCmd, inputStr, 5000);

    const actualOutput = result.stdout.trim();
    const passed = !result.error && actualOutput === expectedOutput;

    results.push({
      index: i,
      input: inputStr,
      expectedOutput,
      actualOutput: result.error ? result.stderr : result.stdout,
      passed,
      elapsedMs: result.elapsedMs,
      timedOut: result.timedOut,
      hasError: result.error,
      errorMessage: result.error ? result.stderr : null,
    });
  }

  try { fs.unlinkSync(tmpFile); } catch (_) {}

  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.length - totalPassed;

  res.json({ results, totalPassed, totalFailed, total: results.length });
});

module.exports = router;
