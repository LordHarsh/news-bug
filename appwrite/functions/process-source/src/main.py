from appwrite.client import Client
from appwrite.exception import AppwriteException
import os
import json
import time
from .scrape import is_url_processed, mark_url_processed, extract_using_newspaper3k
from .mongo import MongoSession


# This Appwrite function will be executed every time your function is triggered
def main(context):
    # You can use the Appwrite SDK to interact with other services
    # For this example, we're using the Users service
    client = (
        Client()
        .set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        .set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        .set_key(context.req.headers["x-appwrite-key"])
    )
    try:
        start_time = time.time()
        context.log(type(context.req.body))
        context.log(context.req.body)
        req_json = json.loads(context.req.body)
        job_id = req_json.get("jobId")
        if not job_id:
            context.error("Job ID not provided")

        db = MongoSession(context)
        job = db.get_job_execution(job_id)
        context.log(str(job))
        
        
        # response = users.list()
        # Log messages and errors to the Appwrite Console
        # These logs won't be seen by your end users
        # context.log("Total users: " + str(response["total"]))
        end_time = time.time()
        context.log(f"Execution time: {end_time - start_time} seconds")
    except AppwriteException as err:
        context.error("Could not list users: " + repr(err))

    return context.res.json(
        {"success": True, "message": "Polling completed successfully"}
    )
