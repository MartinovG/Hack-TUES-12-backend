import os
import sys
from pathlib import Path

from agent_lifecycle_debug import main


def _bootstrap_desktop_defaults():
    script_dir = Path(__file__).resolve().parent
    config_path = script_dir / "connector-config.json"
    explicit_config_requested = any(
        argument == "--config" or argument.startswith("--config=")
        for argument in sys.argv[1:]
    )

    if config_path.exists() and not explicit_config_requested and not os.getenv("HIVE_CONNECTOR_CONFIG"):
        sys.argv.extend(["--config", str(config_path)])

    if config_path.exists() and not os.getenv("HIVE_JSON_LOGS"):
        os.environ["HIVE_JSON_LOGS"] = "true"


if __name__ == "__main__":
    _bootstrap_desktop_defaults()
    main()
