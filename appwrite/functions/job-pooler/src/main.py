from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pymongo import MongoClient
from croniter import croniter
from dataclasses import dataclass
from bson import ObjectId
from appwrite.client import Client
from appwrite.services.functions import Functions
import os


@dataclass
class JobExecution:
    _id: str
    sourceId: str
    categoryId: str
    sourceUrl: str
    categoryKeywords: list[str]
    startedAt: str
    completedAt: Optional[str] = None
    createdAt: str
    updatedAt: str
    duration: Optional[int] = None
    status: str = "running"
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class SourcePoller:
    def __init__(self, mongo_uri: str, context):
        self.client = MongoClient(mongo_uri)
        self.db = self.client["disease-data"]
        self.sources = self.db.get_collection("Sources")
        self.categories = self.db.get_collection("Categories")
        self.job_executions = self.db.get_collection("JobExecutions")
        self.context = context

        # Initialize Appwrite client
        self.appwrite_client = Client()
        self.appwrite_client.set_endpoint(os.environ["APPWRITE_FUNCTION_API_ENDPOINT"])
        self.appwrite_client.set_project(os.environ["APPWRITE_FUNCTION_PROJECT_ID"])
        self.appwrite_client.set_key(context.req.headers["x-appwrite-key"])
        self.functions = Functions(self.appwrite_client)

    def trigger_function(self, source_id: str, job_id: str, url: str) -> bool:
        """Triggers the Appwrite function for processing"""
        try:
            self.functions.create_execution(
                os.environ["APPWRITE_FUNCTION_ID"],
                data={"sourceId": source_id, "jobId": job_id, "url": url},
            )
            return True
        except Exception as e:
            self.context.error(f"Failed to trigger function: {str(e)}")
            return False

    def process_source(self, source: Dict[str, Any]):
        source_id = str(source["_id"])
        now = datetime.now(timezone.utc)

        # Get associated category data
        category = self.categories.find_one({"_id": source["categoryId"]})
        if not category:
            self.context.error(f"Category not found for source {source_id}")
            return

        # Create job execution record
        job_execution = JobExecution(
            _id=str(ObjectId()),
            sourceId=source_id,
            categoryId=str(category["_id"]),
            sourceUrl=source["url"],
            categoryKeywords=category.get("keywords", []),
            startedAt=now.isoformat(),
            createdAt=now.isoformat(),
            updatedAt=now.isoformat(),
            status="running",
        )

        try:
            # Insert job execution record
            self.job_executions.insert_one(job_execution.__dict__)

            # Update source status to running
            result = self.sources.update_one(
                {"_id": source["_id"], "status": {"$ne": "running"}},
                {"$set": {"status": "running", "lastRunAt": now, "currentRetry": 0}},
            )

            if result.modified_count == 0:
                return

            # Trigger the function asynchronously
            self.trigger_function(source_id, job_execution._id, source["url"])

        except Exception as e:
            error_msg = f"Error processing source {source_id}: {str(e)}"
            self.context.error(error_msg)

            # Update job execution status to error
            self.job_executions.update_one(
                {"_id": ObjectId(job_execution._id)},
                {
                    "$set": {
                        "status": "error",
                        "error": error_msg,
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    }
                },
            )

            # Update source status
            self.sources.update_one(
                {"_id": source["_id"]},
                {"$set": {"status": "error", "lastError": error_msg}},
            )

    def poll(self):
        try:
            now = datetime.now(timezone.utc)

            # Find sources that need processing
            sources = self.sources.find(
                {
                    "isActive": True,
                    "status": {"$in": ["idle", "error"]},
                    "cronSchedule": {"$exists": True},
                    "nextRunAt": {"$lte": now},
                }
            )

            for source in sources:
                self.process_source(source)

            return {"success": True, "message": "Polling completed successfully"}

        except Exception as e:
            self.context.error(f"Polling error: {str(e)}")
            return {"success": False, "error": str(e)}


def main(context):
    try:
        mongo_uri = os.environ.get("MONGODB_URI")
        if not mongo_uri:
            raise ValueError("MONGODB_URI environment variable is required")

        poller = SourcePoller(mongo_uri, context)
        result = poller.poll()

        return context.res.json(result)

    except Exception as e:
        context.error(f"Function error: {str(e)}")
        return context.res.json({"success": False, "error": str(e)}, 500)
