const { io } = require('socket.io-client');
const os = require('os');

const backendUrl = process.env.WS_BACKEND_URL || 'http://localhost:3000';
const socketPath = process.env.WS_SOCKET_PATH || '/computer-socket';
const connectionToken =
  process.env.WS_CONNECTION_TOKEN || 'test-client-token';

const socket = io(backendUrl, {
  path: socketPath,
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 5000,
});

function buildCapabilities() {
  return {
    cpu_cores: os.cpus()?.length || 1,
    ram_gb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
    storage_gb: 100,
    os: os.platform(),
  };
}

socket.on('connect', () => {
  console.log(`[ws-test] Connected with socket id ${socket.id}`);

  const payload = {
    action: 'client_connected',
    hostname: os.hostname(),
    connection_token: connectionToken,
    capabilities: buildCapabilities(),
  };

  console.log('[ws-test] Emitting client_connected:', payload);
  socket.emit('client_connected', payload);
});

socket.on('connection_acknowledged', (payload) => {
  console.log('[ws-test] connection_acknowledged:', payload);
});

socket.on('provision_vm', (payload) => {
  console.log('[ws-test] provision_vm received:', payload);
});

socket.on('execute_file', (payload) => {
  console.log('[ws-test] execute_file received:', payload);
});

socket.on('stop_vm', (payload) => {
  console.log('[ws-test] stop_vm received:', payload);
});

socket.on('destroy_vm', (payload) => {
  console.log('[ws-test] destroy_vm received:', payload);
});

socket.on('error', (payload) => {
  console.error('[ws-test] error event:', payload);
});

socket.on('disconnect', (reason) => {
  console.log(`[ws-test] Disconnected: ${reason}`);
});

socket.io.on('reconnect_attempt', (attempt) => {
  console.log(`[ws-test] Reconnect attempt ${attempt}`);
});

socket.io.on('error', (error) => {
  console.error('[ws-test] socket.io manager error:', error.message);
});

setInterval(() => {
  if (!socket.connected) {
    return;
  }

  const payload = {
    action: 'heartbeat',
    timestamp: new Date().toISOString(),
    status: 'healthy',
    active_vms: [],
  };

  socket.emit('heartbeat', payload);
  console.log('[ws-test] heartbeat sent');
}, 30000);
