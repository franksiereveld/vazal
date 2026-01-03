import logging
import json
import os
from datetime import datetime

# Ensure the logs directory exists
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

# Configure the debug logger
debug_logger = logging.getLogger("vazal_debug")
debug_logger.setLevel(logging.DEBUG)

# Create a file handler (always write to file)
log_file = os.path.join(LOG_DIR, f"debug_trace_{datetime.now().strftime('%Y%m%d')}.log")
file_handler = logging.FileHandler(log_file, encoding='utf-8')
file_handler.setLevel(logging.DEBUG)

# Create a formatter
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)

# Add the file handler to the logger
if not debug_logger.handlers:
    debug_logger.addHandler(file_handler)

# Console handler (only added if verbose mode is enabled)
console_handler = None
VERBOSE_MODE = os.environ.get("VAZAL_VERBOSE", "false").lower() == "true"

def enable_console_logging():
    """Enable console output for debug logs (called when --verbose flag is used)."""
    global console_handler, VERBOSE_MODE
    if console_handler is None:
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.DEBUG)
        console_handler.setFormatter(formatter)
        debug_logger.addHandler(console_handler)
        VERBOSE_MODE = True
        os.environ["VAZAL_VERBOSE"] = "true"

def log_llm_interaction(messages, response):
    """Log LLM input messages and output response."""
    try:
        log_entry = {
            "type": "LLM_INTERACTION",
            "timestamp": datetime.now().isoformat(),
            "input_messages": messages,
            "output_response": response
        }
        debug_logger.debug(json.dumps(log_entry, indent=2, ensure_ascii=False))
    except Exception as e:
        debug_logger.error(f"Failed to log LLM interaction: {e}")
        pass

def log_tool_execution(tool_name, arguments, result):
    """Log tool execution details."""
    try:
        log_entry = {
            "type": "TOOL_EXECUTION",
            "timestamp": datetime.now().isoformat(),
            "tool": tool_name,
            "arguments": arguments,
            "result": result
        }
        debug_logger.debug(json.dumps(log_entry, indent=2, ensure_ascii=False))
    except Exception as e:
        debug_logger.error(f"Failed to log tool execution: {e}")
        pass
