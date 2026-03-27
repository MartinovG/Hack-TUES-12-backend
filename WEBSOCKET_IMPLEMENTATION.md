# WebSocket VM Orchestration Implementation

## Overview

This implementation adds WebSocket-based communication between the NestJS backend and remote computers running Python client scripts. The system enables real-time VM provisioning, job execution, and monitoring.

## Architecture

### New Entities

#### PhysicalComputer (`src/entities/physical-computer.entity.ts`)

- Tracks physical computers that connect via WebSocket
- States: CONNECTED, AVAILABLE, PROVISIONING, ACTIVE, OFFLINE
- Stores computer capabilities (CPU, RAM, storage)
- Links to VirtualMachines created on this computer

#### Updated VirtualMachine Entity

- Added `physicalComputerId` - links to the physical computer
- Added `vmIpAddress`, `vmSshPort`, `vmSshUsername` - VM connection details
- Updated states: OFFLINE, BUILDING, RUNNING

#### Updated VMRental Entity

- Changed from `RentalStatus` to `RentalState`
- States: ACTIVE, NOT_ACTIVE (default: NOT_ACTIVE)

### New Modules

#### Computers Module (`src/computers/`)

- **ComputersService**: Manages physical computer registration, selection, and status
- **ComputersController**: Endpoints for listing computers and generating connection tokens
- **DTOs**: RegisterComputerDto, ComputerCapabilitiesDto

#### WebSocket Module (`src/websocket/`)

- **ComputerWebSocketGateway**: Handles all WebSocket events
- **Event DTOs**: Comprehensive event interfaces for client-server communication

## Event Flow

### 1. Connection & Registration

**Client → Server: `client_connected`**

```json
{
  "action": "client_connected",
  "hostname": "laptop-001",
  "connection_token": "abc123...",
  "capabilities": {
    "cpu_cores": 8,
    "ram_gb": 16,
    "storage_gb": 500,
    "os": "Windows 11"
  }
}
```

**Server → Client: `connection_acknowledged`**

```json
{
  "action": "connection_acknowledged",
  "computer_id": "uuid",
  "status": "available",
  "message": "Successfully registered"
}
```

### 2. VM Provisioning

**Server → Client: `provision_vm`**

```json
{
  "action": "provision_vm",
  "vm_id": "uuid",
  "rental_id": "uuid",
  "os_choice": "ubuntu/jammy64",
  "specs": {
    "memory": 4096,
    "cpus": 2
  }
}
```

**Client → Server: `vm_provisioned`**

```json
{
  "action": "vm_provisioned",
  "vm_id": "uuid",
  "status": "running",
  "vm_info": {
    "ip_address": "192.168.56.10",
    "ssh_port": 22,
    "ssh_username": "vagrant"
  }
}
```

### 3. Job Execution

**Server → Client: `execute_file`**

```json
{
  "action": "execute_file",
  "vm_id": "uuid",
  "job_id": "uuid",
  "exec_file": "base64_encoded_content",
  "exec_filename": "script.py",
  "exec_command": "python3 script.py",
  "working_directory": "/home/vagrant",
  "timeout": 300
}
```

**Client → Server: `execution_completed`**

```json
{
  "action": "execution_completed",
  "job_id": "uuid",
  "vm_id": "uuid",
  "status": "completed",
  "exit_code": 0,
  "stdout": "output...",
  "stderr": "",
  "execution_time": 45.2
}
```

### 4. Monitoring

**Client → Server: `heartbeat`** (every 30s)

```json
{
  "action": "heartbeat",
  "timestamp": "2026-03-27T09:00:00Z",
  "status": "healthy",
  "active_vms": ["vm_id_1"]
}
```

### 5. VM Lifecycle

**Server → Client: `destroy_vm`**

```json
{
  "action": "destroy_vm",
  "vm_id": "uuid"
}
```

**Client → Server: `vm_destroyed`**

```json
{
  "action": "vm_destroyed",
  "vm_id": "uuid",
  "status": "destroyed"
}
```

## API Endpoints

### Computers

- `GET /computers` - List all computers
- `GET /computers/available` - List available computers (with optional filters)
- `GET /computers/:id` - Get computer details
- `POST /computers/generate-token` - Generate connection token (requires auth)

### Existing Endpoints Updated

- Rentals, Jobs, VMs now integrate with WebSocket for real-time communication

## WebSocket Connection

**URL**: `ws://localhost:3000/computer-socket`

**Client Connection Flow**:

1. Python script connects to WebSocket
2. Sends `client_connected` event with capabilities
3. Receives `connection_acknowledged` confirmation
4. Listens for server events (`provision_vm`, `execute_file`, etc.)
5. Sends responses back to server

## Database Schema Changes

### New Table: `physical_computers`

```sql
CREATE TABLE physical_computers (
  id UUID PRIMARY KEY,
  hostname VARCHAR NOT NULL,
  connection_token VARCHAR UNIQUE NOT NULL,
  is_connected BOOLEAN DEFAULT FALSE,
  is_available BOOLEAN DEFAULT TRUE,
  status VARCHAR CHECK (status IN ('connected', 'available', 'provisioning', 'active', 'offline')),
  cpu_cores INTEGER NOT NULL,
  ram_gb INTEGER NOT NULL,
  storage_gb INTEGER NOT NULL,
  host_os VARCHAR NOT NULL,
  current_vm_id UUID NULL,
  last_heartbeat TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Updated Table: `virtual_machines`

```sql
ALTER TABLE virtual_machines
ADD COLUMN physical_computer_id UUID NULL,
ADD COLUMN vm_ip_address VARCHAR NULL,
ADD COLUMN vm_ssh_port INTEGER DEFAULT 22,
ADD COLUMN vm_ssh_username VARCHAR NULL,
ADD CONSTRAINT fk_physical_computer FOREIGN KEY (physical_computer_id)
  REFERENCES physical_computers(id);
```

### Updated Table: `vm_rentals`

```sql
ALTER TABLE vm_rentals
RENAME COLUMN status TO rental_state;

-- rental_state now uses: 'active', 'not_active'
```

## Next Steps for Integration

### 1. Update RentalsService

When a rental is created:

```typescript
// Select available computer
const computer = await this.computersService.selectBestComputer(vmRequirements);

// Link VM to computer
await this.vmService.setPhysicalComputer(vm.id, computer.id);

// Send provision_vm event via WebSocket
await this.websocketGateway.sendProvisionVM(computer.id, {
  action: 'provision_vm',
  vm_id: vm.id,
  rental_id: rental.id,
  os_choice: vm.os,
  specs: {
    memory: vm.ramGb * 1024,
    cpus: vm.cpuCores,
  },
});
```

### 2. Update JobsService

When a job is submitted:

```typescript
// Get VM and its physical computer
const vm = await this.vmService.findOne(job.vmId);

// Send execute_file event
await this.websocketGateway.sendExecuteFile(vm.physicalComputerId, {
  action: 'execute_file',
  vm_id: vm.id,
  job_id: job.id,
  exec_file: Buffer.from(execFileContent).toString('base64'),
  exec_filename: 'script.py',
  exec_command: 'python3 script.py',
  working_directory: '/home/vagrant',
  timeout: 300,
});
```

### 3. Python Client Script Updates

The Python script needs handlers for all events. See the event flow section for message formats.

## Configuration

### Environment Variables

No new environment variables required. Uses existing database configuration.

### TypeORM

- `synchronize: true` is enabled in development
- PhysicalComputer entity added to entities list

## Testing

### Test WebSocket Connection

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000/computer-socket

# Send test message
{"action":"client_connected","hostname":"test-laptop","connection_token":"test123","capabilities":{"cpu_cores":8,"ram_gb":16,"storage_gb":500,"os":"Windows 11"}}
```

### Test API Endpoints

```bash
# List available computers
curl http://localhost:3000/computers/available

# Generate connection token (requires auth)
curl -X POST http://localhost:3000/computers/generate-token \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Dependencies Installed

```json
{
  "@nestjs/websockets": "^10.x",
  "@nestjs/platform-socket.io": "^10.x",
  "socket.io": "^4.x"
}
```

## Files Created/Modified

### New Files

- `src/entities/physical-computer.entity.ts`
- `src/computers/computers.service.ts`
- `src/computers/computers.controller.ts`
- `src/computers/computers.module.ts`
- `src/computers/dto/computer-capabilities.dto.ts`
- `src/computers/dto/register-computer.dto.ts`
- `src/websocket/websocket.gateway.ts`
- `src/websocket/websocket.module.ts`
- `src/websocket/dto/websocket-events.dto.ts`

### Modified Files

- `src/entities/virtual-machine.entity.ts` - Added physical computer link
- `src/entities/vm-rental.entity.ts` - Changed to RentalState
- `src/virtual-machines/virtual-machines.service.ts` - Added system update support
- `src/rentals/rentals.service.ts` - Updated for new states
- `src/config/typeorm.config.ts` - Added PhysicalComputer entity
- `src/app.module.ts` - Added ComputersModule and WebSocketModule

## Status

✅ WebSocket infrastructure complete
✅ Computer management complete
✅ Event handling complete
✅ Database entities updated
⏳ RentalsService integration (needs WebSocket gateway injection)
⏳ JobsService integration (needs WebSocket gateway injection)
⏳ Python client script updates (needs event handlers)
