from celery import Celery

from .config import settings

celery = Celery("afa", broker=settings.redis_url, backend=settings.redis_url)
celery.conf.update(task_acks_late=True, worker_prefetch_multiplier=1, task_time_limit=900)


@celery.task(name="afa.scan")
def scan_task(scan_id: str):
    from .services.pipeline import run_scan_job
    run_scan_job(scan_id)


@celery.task(name="afa.fix")
def fix_task(scan_id: str, mode: str = "thorough"):
    from .services.pipeline import run_fix_job
    run_fix_job(scan_id, mode)
