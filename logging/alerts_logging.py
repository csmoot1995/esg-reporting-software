import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            'timestamp': self.formatTime(record, self.datefmt),
            'severity': record.levelname,
            'module': record.module,
            'message': record.getMessage(),
        }
        return json.dumps(log_record)

def setup_logger():
    logger = logging.getLogger("alerts")
    handler = logging.StreamHandler()
    formatter = JSONFormatter()
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger

logger = setup_logger()
logger.info("Alerts logging initialized.")
