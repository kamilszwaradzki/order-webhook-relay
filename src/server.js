const app = require('./app');
const pool = require('./db/pool');
const { port } = require('./config');
const { startRetryWorker } = require('./workers/retryWorker');

const server = app.listen(port, () => {
    console.info(`Server listening on port ${port}`);
});

let shuttingDown = false;

const stopRetryWorker = startRetryWorker();

async function shutdown() {
    if(shuttingDown) return;
    else shuttingDown = true;
    console.info('Shutting down...');

    await stopRetryWorker();

    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);