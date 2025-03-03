from datetime import datetime
import json


class Logger:
    def __init__(self, context):
        self.context = context

    def info(self, message):
        log_entry = {
            "type": "info",
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }
        self.context.log(json.dumps(log_entry))

    def error(self, message):
        log_entry = {
            "type": "error",
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }
        self.context.error(json.dumps(log_entry))
