/* Minimal in-process job scheduler.
 *
 * Deliberately not a cron library: this app runs a single PM2 process in fork
 * mode, so an interval plus a boot sweep covers everything we need without a
 * new dependency.
 *
 * !! If ecosystem.config.js is ever switched to cluster mode or instances > 1,
 * !! every job here fires once PER WORKER. Jobs are idempotent, so that is
 * !! wasteful rather than corrupting — but it must be fixed before scaling out.
 *
 * Two properties every registered job must have:
 *   1. Idempotent — a job that runs twice must not double its effect.
 *   2. Catch-up capable — state lives in the database (e.g. nextDue), not in
 *      the timer, so downtime is recovered on the next boot rather than lost.
 */
const logger = require('../utils/logger');

const jobs = [];
let started = false;
const timers = [];

/**
 * Register a job. Must be called before start().
 *
 * @param {string} name
 * @param {() => Promise<any>} handler
 * @param {number} intervalMs
 */
function register(name, handler, intervalMs) {
    jobs.push({ name, handler, intervalMs, isRunning: false });
}

async function runJob(job) {
    // A slow tick must never overlap the next one. Skipping is correct here:
    // the work is driven by database state, so the following tick picks up
    // whatever this run does not finish.
    if (job.isRunning) {
        logger.warn('Job still running, skipping this tick', { job: job.name });
        return;
    }

    job.isRunning = true;
    const startedAt = Date.now();

    try {
        const result = await job.handler();
        logger.info('Job completed', { job: job.name, ms: Date.now() - startedAt, result });
    } catch (err) {
        // A failing job must never take the server down.
        logger.error('Job failed', { job: job.name, error: err.message, stack: err.stack });
    } finally {
        job.isRunning = false;
    }
}

/**
 * Run every job once (catch-up for downtime), then on its interval.
 * Safe to call once per process; repeat calls are ignored.
 */
function start() {
    if (started) return;
    started = true;

    for (const job of jobs) {
        // Boot sweep: recovers anything that came due while the process was down.
        runJob(job);

        const timer = setInterval(() => runJob(job), job.intervalMs);
        // Never hold the event loop open on shutdown, matching the precedent in
        // middleware/validation.js.
        timer.unref();
        timers.push(timer);
    }

    logger.info('Scheduler started', { jobs: jobs.map((j) => j.name) });
}

/** Test/shutdown helper. */
function stop() {
    timers.forEach(clearInterval);
    timers.length = 0;
    started = false;
}

module.exports = { register, start, stop, runJob, jobs };
