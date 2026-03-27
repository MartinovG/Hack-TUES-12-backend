// Client → Server Events

export interface ClientConnectedEvent {
  action: 'client_connected';
  hostname: string;
  connection_token: string;
  capabilities: {
    cpu_cores: number;
    ram_gb: number;
    storage_gb: number;
    os: string;
  };
}

export interface VMProvisioningStartedEvent {
  action: 'vm_provisioning_started';
  vm_id: string;
  status: 'building';
  message: string;
}

export interface VMProvisionedEvent {
  action: 'vm_provisioned';
  vm_id: string;
  status: 'running';
  vm_info: {
    ip_address: string;
    ssh_port: number;
    ssh_username: string;
  };
}

export interface VMProvisioningFailedEvent {
  action: 'vm_provisioning_failed';
  vm_id: string;
  status: 'failed';
  error: string;
}

export interface ExecutionStartedEvent {
  action: 'execution_started';
  job_id: string;
  vm_id: string;
  status: 'running';
  message: string;
}

export interface ExecutionCompletedEvent {
  action: 'execution_completed';
  job_id: string;
  vm_id: string;
  status: 'completed';
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time: number;
}

export interface ExecutionFailedEvent {
  action: 'execution_failed';
  job_id: string;
  vm_id: string;
  status: 'failed';
  error: string;
  exit_code?: number;
  stderr?: string;
}

export interface VMStoppedEvent {
  action: 'vm_stopped';
  vm_id: string;
  status: 'stopped';
}

export interface VMDestroyedEvent {
  action: 'vm_destroyed';
  vm_id: string;
  status: 'destroyed';
}

export interface HeartbeatEvent {
  action: 'heartbeat';
  timestamp: string;
  status: 'healthy';
  active_vms: string[];
}

export interface VMMetricsEvent {
  action: 'vm_metrics';
  vm_id: string;
  metrics: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    network_in: number;
    network_out: number;
  };
  timestamp: string;
}

export interface ErrorOccurredEvent {
  action: 'error_occurred';
  error_type: string;
  vm_id?: string;
  message: string;
  recoverable: boolean;
}

// Server → Client Events

export interface ProvisionVMEvent {
  action: 'provision_vm';
  vm_id: string;
  rental_id: string;
  os_choice: string;
  specs: {
    memory: number;
    cpus: number;
    disk?: number;
  };
}

export interface ExecuteFileEvent {
  action: 'execute_file';
  vm_id: string;
  job_id: string;
  exec_file: string; // base64 encoded
  exec_filename: string;
  exec_command: string;
  working_directory: string;
  timeout: number;
}

export interface StopVMEvent {
  action: 'stop_vm';
  vm_id: string;
  reason: string;
}

export interface DestroyVMEvent {
  action: 'destroy_vm';
  vm_id: string;
}

export interface ConnectionAcknowledgedEvent {
  action: 'connection_acknowledged';
  computer_id: string;
  vm_id: string;
  status: string;
  message: string;
}
