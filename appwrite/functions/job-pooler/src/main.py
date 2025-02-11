from datetime import datetime, timezone
from typing import Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient
from croniter import croniter
import uuid
import aiohttp
from dataclasses import dataclass
import backoff
import asyncio
import os

@dataclass
class JobExecution:
    id: str
    startedAt: datetime
    completedAt: Optional[datetime] = None
    status: str = "running"
    error: Optional[str] = None
    duration: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None

class SourcePoller:
    def __init__(self, mongo_uri: str, context, db_name: str = "newsdb"):
        self.client = AsyncIOMotorClient(mongo_uri)
        self.db = self.client[db_name]
        self.sources = self.db.sources
        self.session = None
        self.context = context

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
        self.client.close()

    @backoff.on_exception(
        backoff.expo, (aiohttp.ClientError, asyncio.TimeoutError), max_tries=5
    )
    async def fetch_url(self, url: str, timeout: int) -> str:
        async with self.session.get(url, timeout=timeout / 1000) as response:
            response.raise_for_status()
            return await response.text()

    async def do_task(self, source: Dict[str, Any], job_execution: JobExecution) -> bool:
        """
        Initiates the task by calling the webhook and updates status to processing
        Returns True if webhook call was successful, False otherwise
        """
        try:
            # webhook_url = source.get("webhookUrl")
            # if not webhook_url:
            #     raise ValueError("No webhook URL configured for source")

            # Call webhook to start the task
            # async with self.session.post(
            #     webhook_url,
            #     json={
            #         "sourceId": str(source["_id"]),
            #         "jobId": job_execution.id,
            #         "url": source["url"]
            #     },
            #     timeout=30
            # ) as response:
            #     response.raise_for_status()
                
            return True

        except Exception as e:
            self.context.error(f"Failed to initiate task for source {source['_id']}: {str(e)}")
            return False

    async def process_source(self, source: Dict[str, Any]):
        source_id = source["_id"]
        job_execution = JobExecution(
            id=str(uuid.uuid4()), startedAt=datetime.now(timezone.utc)
        )

        try:
            # Check if source is still eligible for processing
            current_source = await self.sources.find_one(
                {"_id": source_id, "status": {"$ne": "running"}}
            )
            if not current_source:
                self.context.log(f"Source {source_id} is no longer eligible for processing")
                return

            # Update source status to running with optimistic locking
            result = await self.sources.update_one(
                {
                    "_id": source_id,
                    "status": {"$ne": "running"}
                },
                {"$set": {"status": "running", "currentRetry": 0}}
            )

            if result.modified_count == 0:
                self.context.log(f"Source {source_id} was already being processed")
                return

            # Call do_task to initiate the task
            task_initiated = await self.do_task(source, job_execution)
            
            if not task_initiated:
                # Handle task initiation failure
                job_execution.status = "failed"
                job_execution.completedAt = datetime.now(timezone.utc)
                job_execution.error = "Failed to initiate task"
                status = "failed"
                next_run = croniter(
                    source["cronSchedule"], datetime.now(timezone.utc)
                ).get_next(datetime)
            else:
                # Task successfully initiated
                job_execution.status = "processing"
                job_execution.completedAt = datetime.now(timezone.utc)
                status = "processing"
                # Next run will be determined by webhook callback
                next_run = None

            job_execution.duration = int(
                (job_execution.completedAt - job_execution.startedAt).total_seconds()
                * 1000
            )

            # Update source with current status
            await self.sources.update_one(
                {"_id": source_id},
                {
                    "$set": {
                        "status": status,
                        "lastRunAt": job_execution.completedAt,
                        "nextRunAt": next_run,
                        "lastError": None if task_initiated else job_execution.error,
                    },
                    "$push": {
                        "executionHistory": {
                            "$each": [job_execution.__dict__],
                            "$slice": -100,
                        }
                    },
                },
            )
            self.context.log(f"Source {source_id} status updated to {status}")

        except Exception as e:
            job_execution.status = "failed"
            job_execution.completedAt = datetime.now(timezone.utc)
            job_execution.error = str(e)
            job_execution.duration = int(
                (job_execution.completedAt - job_execution.startedAt).total_seconds()
                * 1000
            )

            current_retry = source.get("currentRetry", 0)
            max_retries = source.get("retryCount", 3)

            if current_retry < max_retries:
                next_run = datetime.now(timezone.utc)
                status = "idle"
                current_retry += 1
            else:
                next_run = croniter(
                    source["cronSchedule"], datetime.now(timezone.utc)
                ).get_next(datetime)
                status = "failed"
                current_retry = 0

            await self.sources.update_one(
                {"_id": source_id},
                {
                    "$set": {
                        "status": status,
                        "lastRunAt": job_execution.completedAt,
                        "nextRunAt": next_run,
                        "lastError": job_execution.error,
                        "currentRetry": current_retry,
                    },
                    "$push": {
                        "executionHistory": {
                            "$each": [job_execution.__dict__],
                            "$slice": -100,
                        }
                    },
                },
            )
            self.context.error(f"Error processing source {source_id}: {str(e)}")

    async def poll_once(self):
        try:
            now = datetime.now(timezone.utc)
            
            cursor = self.sources.find(
                {
                    "isActive": True,
                    "status": {"$ne": "running"},
                    "$or": [
                        {"nextRunAt": {"$lte": now}},
                        {"nextRunAt": {"$exists": False}},
                    ],
                },
                {
                    "url": 1,
                    "cronSchedule": 1,
                    "timeout": 1,
                    "retryCount": 1,
                    "currentRetry": 1,
                    "lastRunAt": 1,
                    "webhookUrl": 1  # Added webhookUrl to projection
                }
            )

            sources = []
            async for source in cursor:
                sources.append(source)

            if not sources:
                self.context.log("No sources due for processing")
                return

            self.context.log(f"Processing {len(sources)} sources")
            await asyncio.gather(*[self.process_source(source) for source in sources])

        except Exception as e:
            self.context.error(f"Error in polling cycle: {str(e)}")
            raise

async def main(context):
    try:
        mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        
        async with SourcePoller(mongo_uri, context) as poller:
            await poller.poll_once()

        return context.res.json(
            {"success": True, "message": "Polling cycle completed successfully"}
        )

    except Exception as e:
        context.error(f"Function error: {str(e)}")
        return context.res.json({"success": False, "error": str(e)}, 500)