import json
import time

# from .scrape import is_url_processed, mark_url_processed, extract_using_newspaper3k
from .mongo import MongoSession
from typing import Dict, Any
from .article_processor import ArticleProcessor
from datetime import datetime


def process_job_execution(context, job_id: str) -> Dict[str, Any]:
    """Main function to process a job execution"""
    try:
        # Initialize database session and article processor
        db_session = MongoSession(context)
        processor = ArticleProcessor(db_session, context)

        # Get job execution details
        job_execution = db_session.get_job_execution(job_id)
        if not job_execution:
            raise ValueError(f"Job execution not found: {job_id}")

        # # Update job status to running
        start_time = datetime.utcnow()
        processor.update_job_execution(
            job_id,
            {"status": "running", "startedAt": start_time.isoformat(), "error": None},
        )
        context.log(f"Processing job: {job_id}")
        # # Process articles with crawling
        processed_articles = processor.crawl_and_process(
            job_execution,
            max_pages=20,  # Configurable
            max_depth=2,  # Configurable
            max_workers=1,  # Configurable
        )

        # # Calculate duration
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()

        # # Update job execution with results
        # result_update = {
        #     "status": "completed",
        #     "completedAt": end_time.isoformat(),
        #     "duration": duration,
        #     "metadata": {
        #         "articlesProcessed": len(processed_articles),
        #         "articleIds": [article["_id"] for article in processed_articles],
        #         "processingTime": duration,
        #     },
        # }

        # processor.update_job_execution(job_id, result_update)

        # return {
        #     "success": True,
        #     "message": f"Processed {len(processed_articles)} articles successfully",
        #     "articleCount": len(processed_articles),
        #     "articleIds": [article["_id"] for article in processed_articles],
        # }
        return {"success": True, "message": "Processed 0 articles successfully"}

    except Exception as e:
        # Update job execution with error
        if processor:
            processor.update_job_execution(
                job_id,
                {
                    "status": "error",
                    "completedAt": datetime.utcnow().isoformat(),
                    "error": str(e),
                    "duration": (datetime.utcnow() - start_time).total_seconds(),
                },
            )

        raise


def main(context):
    try:
        start_time = time.time()
        req_json = json.loads(context.req.body)
        job_id = req_json.get("jobId")

        if not job_id:
            raise ValueError("Job ID not provided")

        result = process_job_execution(context, job_id)

        end_time = time.time()
        context.log(f"Execution time: {end_time - start_time} seconds")

        return context.res.json(result)

    except Exception as e:
        context.error(f"Error processing job: {str(e)}")
        return context.res.json({"success": False, "message": str(e)}, 500)
