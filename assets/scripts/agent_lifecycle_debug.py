import argparse
import asyncio
import base64
import datetime
import json
import os
import platform
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path

import psutil
import socketio

DEFAULT_BACKEND_URL = os.getenv(
    "HIVE_BACKEND_URL",
    os.getenv("API_URL", "https://dev.hack-tues-12.innovatebulgaria.com"),
).strip()
DEFAULT_SOCKET_PATH = os.getenv("HIVE_SOCKET_PATH", "/computer-socket")
DEFAULT_CONNECTION_TOKEN = os.getenv("HIVE_CONNECTION_TOKEN", "").strip()
DEFAULT_HEARTBEAT_INTERVAL = int(os.getenv("HIVE_HEARTBEAT_INTERVAL", "30"))
DEFAULT_RECONNECT_DELAY_SECONDS = int(os.getenv("HIVE_RECONNECT_DELAY", "5"))
DEFAULT_JSON_LOGS = os.getenv("HIVE_JSON_LOGS", "").strip().lower() in {"1", "true", "yes", "on"}

BACKEND_URL = DEFAULT_BACKEND_URL
SOCKET_PATH = DEFAULT_SOCKET_PATH
CONNECTION_TOKEN = DEFAULT_CONNECTION_TOKEN
HEARTBEAT_INTERVAL = DEFAULT_HEARTBEAT_INTERVAL
RECONNECT_DELAY_SECONDS = DEFAULT_RECONNECT_DELAY_SECONDS
JSON_LOGS = DEFAULT_JSON_LOGS
CONFIG_PATH = ""

current_vm_id = None
heartbeat_task = None
registration_confirmed = False

sio = socketio.AsyncClient(
    reconnection=True,
    reconnection_attempts=0,
    reconnection_delay=DEFAULT_RECONNECT_DELAY_SECONDS,
    reconnection_delay_max=DEFAULT_RECONNECT_DELAY_SECONDS,
)


def emit_event(event_type: str, message: str, *, level: str = "INFO", **payload):
    timestamp = datetime.datetime.now(datetime.UTC).isoformat()
    data = {
        "timestamp": timestamp,
        "type": event_type,
        "level": level,
        "message": message,
        **payload,
    }

    if JSON_LOGS:
        print(json.dumps(data, ensure_ascii=True), flush=True)
        return

    print(f"[{timestamp}] [{level}] {message}", flush=True)


def log(level: str, message: str, **payload):
    emit_event("log", message, level=level, **payload)


def set_stage(stage: str, status: str, message: str, **payload):
    emit_event("stage", message, level="INFO", stage=stage, status=status, **payload)


def load_config_file(path: str):
    config_path = Path(path).expanduser()
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with config_path.open("r", encoding="utf-8") as file:
        return json.load(file)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Hive provider connector agent. Supports both terminal and desktop-sidecar execution.",
    )
    parser.add_argument("legacy_setup_key", nargs="?", help="Legacy positional setup key support")
    parser.add_argument("--setup-key", dest="setup_key", help="Provider setup key / connection token")
    parser.add_argument("--backend-url", dest="backend_url", help="Backend base URL")
    parser.add_argument("--socket-path", dest="socket_path", help="Socket.IO path")
    parser.add_argument("--config", dest="config_path", help="Path to connector JSON config file")
    parser.add_argument("--json-logs", action="store_true", help="Emit JSON lines for desktop-sidecar IPC")
    parser.add_argument("--once-check", action="store_true", help="Run dependency checks and exit")
    parser.add_argument("--print-effective-config", action="store_true", help="Print resolved runtime config and exit")
    return parser.parse_args()


def resolve_runtime_settings(args):
    config = {}
    config_path = args.config_path or os.getenv("HIVE_CONNECTOR_CONFIG", "").strip()
    if config_path:
        config = load_config_file(config_path)

    setup_key = (
        args.setup_key
        or args.legacy_setup_key
        or os.getenv("HIVE_CONNECTION_TOKEN", "").strip()
        or str(config.get("connectionToken", "")).strip()
    )
    backend_url = (
        args.backend_url
        or os.getenv("HIVE_BACKEND_URL", "").strip()
        or os.getenv("API_URL", "").strip()
        or str(config.get("backendUrl", DEFAULT_BACKEND_URL)).strip()
        or DEFAULT_BACKEND_URL
    )
    socket_path = (
        args.socket_path
        or os.getenv("HIVE_SOCKET_PATH", "").strip()
        or str(config.get("socketPath", DEFAULT_SOCKET_PATH)).strip()
        or DEFAULT_SOCKET_PATH
    )
    heartbeat_interval = int(
        os.getenv("HIVE_HEARTBEAT_INTERVAL", "").strip()
        or config.get("heartbeatInterval", DEFAULT_HEARTBEAT_INTERVAL)
        or DEFAULT_HEARTBEAT_INTERVAL
    )
    reconnect_delay = int(
        os.getenv("HIVE_RECONNECT_DELAY", "").strip()
        or config.get("reconnectDelay", DEFAULT_RECONNECT_DELAY_SECONDS)
        or DEFAULT_RECONNECT_DELAY_SECONDS
    )
    json_logs = args.json_logs or DEFAULT_JSON_LOGS or bool(config.get("jsonLogs", False))

    return {
        "setup_key": setup_key,
        "backend_url": backend_url.rstrip("/") if backend_url else "",
        "socket_path": socket_path or DEFAULT_SOCKET_PATH,
        "heartbeat_interval": heartbeat_interval,
        "reconnect_delay": reconnect_delay,
        "json_logs": json_logs,
        "config_path": config_path,
        "raw_config": config,
    }


def apply_runtime_settings(settings):
    global BACKEND_URL, SOCKET_PATH, CONNECTION_TOKEN, HEARTBEAT_INTERVAL
    global RECONNECT_DELAY_SECONDS, JSON_LOGS, CONFIG_PATH, sio

    BACKEND_URL = settings["backend_url"]
    SOCKET_PATH = settings["socket_path"]
    CONNECTION_TOKEN = settings["setup_key"]
    HEARTBEAT_INTERVAL = settings["heartbeat_interval"]
    RECONNECT_DELAY_SECONDS = settings["reconnect_delay"]
    JSON_LOGS = settings["json_logs"]
    CONFIG_PATH = settings["config_path"]

    sio = socketio.AsyncClient(
        reconnection=True,
        reconnection_attempts=0,
        reconnection_delay=RECONNECT_DELAY_SECONDS,
        reconnection_delay_max=RECONNECT_DELAY_SECONDS,
    )
    register_socket_handlers()


def run_command_in_vm(command: str) -> dict:
    try:
        result = subprocess.run(
            ["vagrant", "ssh", "-c", command],
            capture_output=True,
            text=True,
            check=True,
        )
        return {
            "success": True,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except subprocess.CalledProcessError as error:
        return {
            "success": False,
            "stdout": error.stdout.strip() if error.stdout else "",
            "stderr": error.stderr.strip() if error.stderr else "",
            "code": error.returncode,
        }
    except Exception as error:
        return {"success": False, "stdout": "", "stderr": str(error)}


def _os_options_map(is_arm: bool):
    if is_arm:
        return {
            "1": "generic/alpine316",
            "2": "perk/ubuntu-2204-arm64",
            "3": "bento/debian-12-arm64",
            "alpine linux (arm64)": "generic/alpine316",
            "ubuntu (arm64)": "perk/ubuntu-2204-arm64",
            "ubuntu 24.04 lts": "perk/ubuntu-2204-arm64",
            "debian 12 (arm64)": "bento/debian-12-arm64",
        }
    return {
        "1": "generic/alpine316",
        "2": "gusztavvargadr/windows-10",
        "3": "generic/ubuntu2204",
        "alpine linux": "generic/alpine316",
        "windows 10": "gusztavvargadr/windows-10",
        "windows 11 pro": "gusztavvargadr/windows-10",
        "linux (ubuntu)": "generic/ubuntu2204",
        "ubuntu 24.04 lts": "generic/ubuntu2204",
        "linux mint 22": "generic/ubuntu2204",
        "fedora workstation 41": "generic/ubuntu2204",
    }


def _resolve_box_choice(choice, is_arm: bool):
    if isinstance(choice, int):
        choice = str(choice)
    if not choice:
        return None
    mapping = _os_options_map(is_arm)
    if isinstance(choice, str) and choice in mapping:
        return mapping[choice]
    if isinstance(choice, str):
        normalized_choice = choice.strip().lower()
        if normalized_choice in mapping:
            return mapping[normalized_choice]
    if isinstance(choice, str) and "/" in choice:
        return choice
    return None


def get_vagrant_ssh_info():
    info = {
        "ip_address": "127.0.0.1",
        "ssh_port": 2222,
        "ssh_username": "vagrant",
        "ssh_private_key_path": "",
    }
    try:
        result = subprocess.run(
            ["vagrant", "ssh-config"],
            capture_output=True,
            text=True,
            check=True,
        )
        for line in result.stdout.split("\n"):
            line = line.strip()
            if line.startswith("HostName "):
                info["ip_address"] = line.split()[1]
            elif line.startswith("Port "):
                info["ssh_port"] = int(line.split()[1])
            elif line.startswith("User "):
                info["ssh_username"] = line.split()[1]
            elif line.startswith("IdentityFile "):
                info["ssh_private_key_path"] = line.split(maxsplit=1)[1]
    except Exception:
        pass
    return info


def get_system_info():
    os_type = platform.system()
    arch = platform.machine().lower()
    is_arm = "arm" in arch or "aarch64" in arch
    return os_type, is_arm


def get_hardware_profile():
    total_ram_gb = psutil.virtual_memory().total / (1024**3)
    cpu_cores = psutil.cpu_count(logical=False) or 1

    if total_ram_gb >= 16:
        vm_mem, vm_cpu = 4096, max(1, cpu_cores - 2)
    else:
        vm_mem, vm_cpu = 1024, max(1, cpu_cores - 1)

    log(
        "INFO",
        f"Hardware profile selected {vm_mem}MB RAM and {vm_cpu} CPU core(s) for the guest VM.",
        allocated_memory_mb=vm_mem,
        allocated_cpus=vm_cpu,
    )
    return {"memory": vm_mem, "cpus": vm_cpu}


def build_capabilities():
    return {
        "cpu_cores": psutil.cpu_count(logical=False) or 1,
        "ram_gb": max(1, int(psutil.virtual_memory().total / (1024**3))),
        "storage_gb": max(1, int(shutil.disk_usage("/").free / (1024**3))),
        "os": platform.system(),
    }


def resolve_connection_token():
    if CONNECTION_TOKEN:
        return CONNECTION_TOKEN

    if not sys.stdin.isatty():
        raise RuntimeError(
            "No setup key was provided. Pass --setup-key, set HIVE_CONNECTION_TOKEN, or use a connector config file."
        )

    log("INFO", "No setup key provided via config or CLI. Waiting for manual input.")
    print("[*] Paste the VM setup key shown in the frontend under Your VMs.", flush=True)

    while True:
        provided = input("Setup key: ").strip()
        if provided:
            return provided
        print("[!] A setup key is required to register this provider machine.", flush=True)


def require_backend_url():
    if BACKEND_URL:
        return BACKEND_URL.rstrip("/")

    raise RuntimeError(
        "HIVE_BACKEND_URL is not configured and no default backend URL is available."
    )


async def heartbeat_loop():
    global current_vm_id, registration_confirmed
    while True:
        await asyncio.sleep(HEARTBEAT_INTERVAL)
        if not sio.connected or not registration_confirmed:
            continue

        payload = {
            "action": "heartbeat",
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "status": "healthy",
            "active_vms": [current_vm_id] if current_vm_id else [],
        }

        try:
            await sio.emit("heartbeat", payload)
            set_stage(
                "heartbeat",
                "ok",
                f"Heartbeat sent. Active VM: {current_vm_id or 'none'}",
                active_vm_id=current_vm_id,
            )
        except Exception as error:
            log("ERROR", f"Heartbeat error: {error}")


def _run_subprocess(command, *, check=False):
    log("INFO", f"Running command: {' '.join(command)}", command=command)
    return subprocess.run(command, check=check)


def check_and_install_dependencies():
    os_type, is_arm = get_system_info()
    set_stage("dependencies", "running", f"Checking local dependencies for {os_type}...")

    if not shutil.which("vagrant"):
        log("WARN", "Vagrant is missing. Attempting to install it automatically...")
        if os_type == "Darwin":
            _run_subprocess(["brew", "install", "hashicorp/tap/hashicorp-vagrant"], check=False)
        elif os_type == "Linux":
            _run_subprocess(["sudo", "apt-get", "update"], check=False)
            _run_subprocess(["sudo", "apt-get", "install", "-y", "vagrant"], check=False)
        elif os_type == "Windows":
            log("INFO", "Attempting to install Vagrant via winget. An administrator prompt may appear.")
            _run_subprocess(
                [
                    "powershell",
                    "-Command",
                    "Start-Process winget -ArgumentList 'install Hashicorp.Vagrant --accept-package-agreements --accept-source-agreements' -Verb RunAs -Wait",
                ],
                check=False,
            )

    if is_arm:
        if not shutil.which("qemu-system-aarch64") and not shutil.which("qemu-system-arm"):
            log("WARN", "QEMU is missing. Attempting to install it automatically...")
            if os_type == "Darwin":
                _run_subprocess(["brew", "install", "qemu"], check=False)
            elif os_type == "Linux":
                _run_subprocess(["sudo", "apt-get", "install", "-y", "qemu-system", "qemu-utils"], check=False)

        if shutil.which("vagrant"):
            try:
                plugins = subprocess.check_output(["vagrant", "plugin", "list"]).decode(errors="ignore")
                if "vagrant-qemu" not in plugins:
                    log("INFO", "Installing the vagrant-qemu plugin...")
                    _run_subprocess(["vagrant", "plugin", "install", "vagrant-qemu"], check=False)
            except Exception as error:
                log("WARN", f"Could not check or install vagrant-qemu: {error}")
    else:
        if os_type == "Windows":
            log("INFO", "Ensuring Hyper-V is enabled on Windows for Vagrant.")
            _run_subprocess(
                [
                    "powershell",
                    "-Command",
                    "Start-Process powershell -ArgumentList 'Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart' -Verb RunAs -Wait",
                ],
                check=False,
            )
        elif os_type == "Linux":
            if not shutil.which("virsh"):
                log("WARN", "libvirt is missing. Attempting to install KVM/libvirt support...")
                _run_subprocess(
                    [
                        "sudo",
                        "apt-get",
                        "install",
                        "-y",
                        "qemu-kvm",
                        "libvirt-daemon-system",
                        "libvirt-clients",
                        "bridge-utils",
                    ],
                    check=False,
                )

            if shutil.which("vagrant"):
                try:
                    plugins = subprocess.check_output(["vagrant", "plugin", "list"]).decode(errors="ignore")
                    if "vagrant-libvirt" not in plugins:
                        log("INFO", "Installing the vagrant-libvirt plugin...")
                        _run_subprocess(["vagrant", "plugin", "install", "vagrant-libvirt"], check=False)
                except Exception as error:
                    log("WARN", f"Could not check or install vagrant-libvirt: {error}")
        elif os_type == "Darwin":
            if not shutil.which("vboxmanage") and not shutil.which("VBoxManage"):
                log("WARN", "VirtualBox is missing. Attempting to install it automatically...")
                _run_subprocess(["brew", "install", "--cask", "virtualbox"], check=False)

    set_stage(
        "dependencies",
        "completed",
        "Dependency checks completed.",
        detected_os=os_type,
        detected_architecture=platform.machine(),
    )


def run_vagrant(specs, box_name):
    os_type, is_arm = get_system_info()

    env = os.environ.copy()
    env["HIVE_VM_MEM"] = str(specs["memory"])
    env["HIVE_VM_CPU"] = str(specs["cpus"])
    env["HIVE_VM_BOX"] = box_name

    if is_arm:
        provider = "qemu"
    else:
        if os_type == "Windows":
            provider = "hyperv"
        elif os_type == "Linux":
            provider = "libvirt"
        else:
            provider = "virtualbox"

    vagrant_cmd = shutil.which("vagrant") or "vagrant"

    try:
        status_output = subprocess.check_output([vagrant_cmd, "status"], text=True)
        normalized_status = status_output.lower()
        if any(state in normalized_status for state in ("running", "poweroff", "saved", "aborted")):
            log("WARN", "Existing Vagrant environment detected. Destroying it for a clean provisioning cycle.")
            subprocess.run([vagrant_cmd, "destroy", "-f"], env=env, check=True)

        set_stage(
            "provisioning",
            "running",
            f"Provisioning box {box_name or 'default'} using provider {provider}.",
            provider=provider,
            box_name=box_name,
            specs=specs,
        )
        subprocess.run([vagrant_cmd, "up", f"--provider={provider}"], env=env, check=True)
        set_stage("provisioning", "completed", "Vagrant reported the VM is live.", provider=provider)
        return True
    except subprocess.CalledProcessError as error:
        log("ERROR", f"Vagrant process returned non-zero exit status: {error.returncode}", provider=provider)
        return False
    except Exception as error:
        log("ERROR", f"Provisioning target error: {error}", provider=provider)
        if os_type == "Windows":
            log("INFO", "Hint: You may need to restart your terminal or run it as Administrator.")
        return False


def register_socket_handlers():
    @sio.event
    async def connect():
        global registration_confirmed
        registration_confirmed = False
        set_stage("connection", "connected", "Connected to backend. Sending registration payload...")

        await sio.emit(
            "client_connected",
            {
                "action": "client_connected",
                "hostname": platform.node(),
                "connection_token": CONNECTION_TOKEN,
                "capabilities": build_capabilities(),
            },
        )

    @sio.event
    def disconnect():
        global registration_confirmed
        registration_confirmed = False
        set_stage("connection", "disconnected", "Disconnected from backend.")

    @sio.on("connection_acknowledged")
    def on_connection_acknowledged(payload):
        global heartbeat_task, registration_confirmed, current_vm_id
        registration_confirmed = True
        current_vm_id = payload.get("vm_id") or current_vm_id
        set_stage(
            "registration",
            "completed",
            "Registration acknowledged by backend.",
            vm_id=current_vm_id,
            payload=payload,
        )

        if heartbeat_task is None or heartbeat_task.done():
            heartbeat_task = asyncio.create_task(heartbeat_loop())
            log("INFO", "Heartbeat loop started after successful registration acknowledgment.")

    @sio.on("error")
    def on_error(payload):
        log("ERROR", f"Backend error event: {payload}", payload=payload)

    @sio.on("provision_vm")
    async def on_provision_vm(data):
        global current_vm_id
        current_vm_id = data.get("vm_id")
        set_stage("provisioning", "queued", "Provision request received from backend.", payload=data)

        await sio.emit(
            "vm_provisioning_started",
            {
                "action": "vm_provisioning_started",
                "vm_id": current_vm_id,
                "status": "building",
                "message": "Starting Vagrant up...",
            },
        )

        is_arm = "arm" in platform.machine().lower() or "aarch64" in platform.machine().lower()
        box_name = _resolve_box_choice(data.get("os_choice"), is_arm)
        if not box_name:
            log("ERROR", f"Could not resolve a Vagrant box from os_choice={data.get('os_choice')}")
            await sio.emit(
                "vm_provisioning_failed",
                {
                    "action": "vm_provisioning_failed",
                    "vm_id": current_vm_id,
                    "status": "failed",
                    "error": "Unsupported OS choice for provisioning",
                },
            )
            return

        specs = data.get("specs", {})
        if not specs.get("memory"):
            host_specs = get_hardware_profile()
            specs["memory"] = host_specs["memory"]
            specs["cpus"] = host_specs["cpus"]

        loop = asyncio.get_running_loop()
        success = await loop.run_in_executor(None, run_vagrant, specs, box_name)

        if success:
            ssh_info = await asyncio.to_thread(get_vagrant_ssh_info)
            log("INFO", f"Provisioning succeeded for VM {current_vm_id}. SSH info: {ssh_info}", ssh_info=ssh_info)
            await sio.emit(
                "vm_provisioned",
                {
                    "action": "vm_provisioned",
                    "vm_id": current_vm_id,
                    "status": "running",
                    "vm_info": ssh_info,
                },
            )
        else:
            log("ERROR", f"Provisioning failed for VM {current_vm_id}", vm_id=current_vm_id)
            await sio.emit(
                "vm_provisioning_failed",
                {
                    "action": "vm_provisioning_failed",
                    "vm_id": current_vm_id,
                    "status": "failed",
                    "error": "Vagrant provisioning returned exit code 1",
                },
            )

    @sio.on("execute_file")
    async def on_execute_file(data):
        log("INFO", f"Received execute_file event for job {data.get('job_id')}", payload=data)
        vm_id = data.get("vm_id")
        job_id = data.get("job_id")
        filename = data.get("exec_filename", "payload.bin")
        content_b64 = data.get("exec_file", "")
        exec_command = data.get(
            "exec_command",
            f"chmod +x /home/vagrant/{filename} && /home/vagrant/{filename}",
        )

        await sio.emit(
            "execution_started",
            {
                "action": "execution_started",
                "job_id": job_id,
                "vm_id": vm_id,
                "status": "running",
                "message": f"File uploaded, preparing to execute {filename}...",
            },
        )

        try:
            file_content = base64.b64decode(content_b64)
            local_path = os.path.join(os.getcwd(), filename)
            remote_path = data.get("working_directory", "/home/vagrant") + f"/{filename}"

            with open(local_path, "wb") as file:
                file.write(file_content)

            subprocess.run(
                ["vagrant", "upload", local_path, remote_path],
                capture_output=True,
                text=True,
                check=False,
            )

            start_time = time.time()
            result = await asyncio.to_thread(run_command_in_vm, exec_command)
            exec_time = time.time() - start_time

            if os.path.exists(local_path):
                os.remove(local_path)

            if result.get("success"):
                await sio.emit(
                    "execution_completed",
                    {
                        "action": "execution_completed",
                        "job_id": job_id,
                        "vm_id": vm_id,
                        "status": "completed",
                        "exit_code": 0,
                        "stdout": result.get("stdout", ""),
                        "stderr": result.get("stderr", ""),
                        "execution_time": round(exec_time, 2),
                    },
                )
            else:
                await sio.emit(
                    "execution_failed",
                    {
                        "action": "execution_failed",
                        "job_id": job_id,
                        "vm_id": vm_id,
                        "status": "failed",
                        "error": "Command failed",
                        "exit_code": result.get("code", 1),
                        "stderr": result.get("stderr", ""),
                    },
                )
        except Exception as error:
            await sio.emit(
                "execution_failed",
                {
                    "action": "execution_failed",
                    "job_id": job_id,
                    "vm_id": vm_id,
                    "status": "failed",
                    "error": str(error),
                    "exit_code": -1,
                    "stderr": "",
                },
            )

    @sio.on("stop_vm")
    async def on_stop_vm(data):
        global current_vm_id
        vm_id = data.get("vm_id")
        set_stage("vm_control", "running", f"Stopping VM {vm_id}...", vm_id=vm_id)
        subprocess.run(["vagrant", "halt"], check=False)
        current_vm_id = None
        await sio.emit(
            "vm_stopped",
            {"action": "vm_stopped", "vm_id": vm_id, "status": "stopped"},
        )

    @sio.on("destroy_vm")
    async def on_destroy_vm(data):
        global current_vm_id
        vm_id = data.get("vm_id")
        set_stage("vm_control", "running", f"Destroying VM {vm_id}...", vm_id=vm_id)
        subprocess.run(["vagrant", "destroy", "-f"], check=False)
        current_vm_id = None
        await sio.emit(
            "vm_destroyed",
            {"action": "vm_destroyed", "vm_id": vm_id, "status": "destroyed"},
        )

    @sio.on("upload_file_to_vm")
    async def on_upload_file_to_vm(data):
        vm_id = data.get("vm_id")
        file_id = data.get("file_id")
        content_b64 = data.get("file_content", "")
        dest_path = data.get("destination_path", "/home/vagrant/uploaded_file")

        try:
            local_tmp = f"tmp_upload_{uuid.uuid4().hex}"
            with open(local_tmp, "wb") as file:
                file.write(base64.b64decode(content_b64))
            subprocess.run(["vagrant", "upload", local_tmp, dest_path], check=True)
            os.remove(local_tmp)

            perms = data.get("permissions")
            if perms:
                await asyncio.to_thread(run_command_in_vm, f"chmod {perms} {dest_path}")

            await sio.emit(
                "file_uploaded",
                {
                    "file_id": file_id,
                    "vm_id": vm_id,
                    "status": "success",
                    "path": dest_path,
                },
            )
        except Exception as error:
            await sio.emit(
                "error_occurred",
                {
                    "action": "error_occurred",
                    "error_type": "upload_failed",
                    "vm_id": vm_id,
                    "message": str(error),
                    "recoverable": True,
                },
            )

    @sio.on("download_file_from_vm")
    async def on_download_file_from_vm(data):
        vm_id = data.get("vm_id")
        file_id = data.get("file_id")
        source_path = data.get("source_path")
        result = await asyncio.to_thread(run_command_in_vm, f"base64 {source_path}")

        if result.get("success"):
            chunk = result["stdout"].replace("\n", "").replace("\r", "")
            await sio.emit(
                "file_downloaded",
                {
                    "file_id": file_id,
                    "vm_id": vm_id,
                    "file_content": chunk,
                    "file_size": len(base64.b64decode(chunk)),
                },
            )
        else:
            await sio.emit(
                "error_occurred",
                {
                    "action": "error_occurred",
                    "error_type": "download_failed",
                    "vm_id": vm_id,
                    "message": result.get("stderr", "Unknown error"),
                    "recoverable": True,
                },
            )


async def connect_to_backend():
    while True:
        try:
            set_stage(
                "connection",
                "connecting",
                f"Attempting to connect to {BACKEND_URL} using path {SOCKET_PATH}...",
                backend_url=BACKEND_URL,
                socket_path=SOCKET_PATH,
            )
            await sio.connect(
                BACKEND_URL,
                socketio_path=SOCKET_PATH.lstrip("/"),
                transports=["websocket"],
            )
            await sio.wait()
        except Exception as error:
            log(
                "ERROR",
                f"Connection failed: {error}. Retrying in {RECONNECT_DELAY_SECONDS} seconds...",
            )
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)


def print_effective_config():
    payload = {
        "backendUrl": BACKEND_URL,
        "socketPath": SOCKET_PATH,
        "connectionTokenPresent": bool(CONNECTION_TOKEN),
        "heartbeatInterval": HEARTBEAT_INTERVAL,
        "reconnectDelay": RECONNECT_DELAY_SECONDS,
        "jsonLogs": JSON_LOGS,
        "configPath": CONFIG_PATH or None,
    }
    print(json.dumps(payload, indent=2), flush=True)


def main():
    global CONNECTION_TOKEN, BACKEND_URL

    args = parse_args()
    settings = resolve_runtime_settings(args)
    apply_runtime_settings(settings)

    try:
        CONNECTION_TOKEN = resolve_connection_token()
        BACKEND_URL = require_backend_url()

        set_stage(
            "startup",
            "completed",
            "Connector runtime initialized.",
            backend_url=BACKEND_URL,
            socket_path=SOCKET_PATH,
            config_path=CONFIG_PATH or None,
            connection_token_present=bool(CONNECTION_TOKEN),
        )

        if args.print_effective_config:
            print_effective_config()
            return

        check_and_install_dependencies()

        if args.once_check:
            set_stage("startup", "completed", "Dependency check finished. Exiting because --once-check was requested.")
            return

        log("INFO", "Starting Hive connector agent...")
        asyncio.run(connect_to_backend())
    except KeyboardInterrupt:
        log("WARN", "Operation cancelled by user.")
        sys.exit(0)
    except Exception as error:
        set_stage("startup", "failed", f"Connector failed to start: {error}", error=str(error))
        raise


if __name__ == "__main__":
    main()
