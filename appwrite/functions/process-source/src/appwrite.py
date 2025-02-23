from appwrite.client import Client
from appwrite.services.functions import Functions
import os
import json


class AppwriteClient:
    def __init__(self, context):
        self.client = Client()
        self.client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        self.client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        self.client.set_key(context.req.headers["x-appwrite-key"])
        self.functions = Functions(self.client)
        self.log = context.log
        self.error = context.error

    def trigger_function(self, job_id: str, data: dict = None) -> bool:
        """Triggers the Appwrite function for processing"""
        try:
            function_id = os.environ.get("APPWRITE_FUNCTION_ID")
            if not function_id:
                raise ValueError("APPWRITE_FUNCTION_ID environment variable is not set")

            payload = {"jobId": job_id}
            if data:
                payload.update(data)  # add any additional data

            self.functions.create_execution(
                function_id,
                body=json.dumps(payload),
                xasync=True,
            )
            return True
        except Exception as e:
            self.error("Failed to trigger function: " + str(e))
            return False
