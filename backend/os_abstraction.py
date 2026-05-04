"""Cross-OS normalization and simulation adapters."""
import re
import platform
from dataclasses import dataclass
from enum import Enum


class OSType(str, Enum):
    REAL = "real"
    LINUX = "linux"
    MACOS = "macos"
    WINDOWS = "windows"


CURRENT_OS = platform.system().lower()  # 'linux', 'darwin', 'windows'


@dataclass
class OSProfile:
    name: str
    path_sep: str
    root: str
    home_prefix: str
    exe_suffix: str
    tmp_dir: str
    sys_dirs: list[str]


PROFILES: dict[OSType, OSProfile] = {
    OSType.LINUX: OSProfile(
        name="Linux (Ubuntu)",
        path_sep="/",
        root="/",
        home_prefix="/home",
        exe_suffix="",
        tmp_dir="/tmp",
        sys_dirs=["/usr", "/bin", "/etc", "/var", "/opt", "/lib"],
    ),
    OSType.MACOS: OSProfile(
        name="macOS",
        path_sep="/",
        root="/",
        home_prefix="/Users",
        exe_suffix="",
        tmp_dir="/private/tmp",
        sys_dirs=["/usr", "/bin", "/etc", "/var", "/Library", "/Applications"],
    ),
    OSType.WINDOWS: OSProfile(
        name="Windows",
        path_sep="\\",
        root="C:\\",
        home_prefix="C:\\Users",
        exe_suffix=".exe",
        tmp_dir="C:\\Windows\\Temp",
        sys_dirs=["C:\\Windows", "C:\\Program Files", "C:\\Program Files (x86)"],
    ),
}


def normalize_path(path: str) -> str:
    """Convert any OS path to a normalized abstract form."""
    path = path.replace("\\", "/")
    # Strip Windows drive letters
    path = re.sub(r"^[A-Za-z]:/", "/", path)
    # Normalize home dirs
    for prefix in ["/Users/", "/home/", "/C/Users/"]:
        if path.startswith(prefix):
            parts = path[len(prefix):].split("/", 1)
            rest = "/" + parts[1] if len(parts) > 1 else ""
            return f"/home/user{rest}"
    return path


def simulate_path(normalized_path: str, target_os: OSType, username: str = "user") -> str:
    """Convert normalized abstract path to target OS equivalent."""
    if target_os == OSType.REAL:
        return normalized_path

    profile = PROFILES[target_os]

    if normalized_path.startswith("/home/user"):
        rest = normalized_path[len("/home/user"):]
        if target_os == OSType.WINDOWS:
            path = f"C:\\Users\\{username}{rest.replace('/', '\\')}"
        elif target_os == OSType.MACOS:
            path = f"/Users/{username}{rest}"
        else:
            path = f"/home/{username}{rest}"
        return path

    if target_os == OSType.WINDOWS:
        return "C:" + normalized_path.replace("/", "\\")

    return normalized_path


def simulate_process_name(name: str, target_os: OSType) -> str:
    """Apply OS-specific process naming conventions."""
    if target_os == OSType.REAL:
        return name

    profile = PROFILES[target_os]
    # Strip existing .exe if present
    base = name.replace(".exe", "")

    linux_to_windows = {
        "python3": "python.exe",
        "python": "python.exe",
        "node": "node.exe",
        "bash": "cmd.exe",
        "zsh": "powershell.exe",
        "sh": "cmd.exe",
        "vim": "notepad.exe",
        "nvim": "notepad.exe",
        "grep": "findstr.exe",
        "find": "where.exe",
        "ls": "dir.exe",
    }
    linux_to_mac = {
        "bash": "zsh",
        "python": "python3",
    }

    if target_os == OSType.WINDOWS:
        return linux_to_windows.get(base, base + profile.exe_suffix)
    if target_os == OSType.MACOS:
        return linux_to_mac.get(base, base)
    return base


def simulate_event(event: dict, target_os: OSType) -> dict:
    """Transform a real event into its OS-simulated equivalent."""
    if target_os == OSType.REAL:
        return event

    simulated = dict(event)
    simulated["simulated_os"] = target_os.value

    if "path" in simulated:
        norm = normalize_path(simulated["path"])
        simulated["original_path"] = simulated["path"]
        simulated["path"] = simulate_path(norm, target_os)

    if "process" in simulated:
        simulated["original_process"] = simulated["process"]
        simulated["process"] = simulate_process_name(simulated["process"], target_os)

    return simulated


def get_os_profile(os_type: OSType) -> dict:
    if os_type == OSType.REAL:
        return {"name": f"Real ({CURRENT_OS})", "path_sep": "/", "root": "/"}
    p = PROFILES[os_type]
    return {
        "name": p.name,
        "path_sep": p.path_sep,
        "root": p.root,
        "home_prefix": p.home_prefix,
        "sys_dirs": p.sys_dirs,
        "tmp_dir": p.tmp_dir,
    }
