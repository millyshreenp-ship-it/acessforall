import hashlib
import json

import redis

from ..config import settings

_r = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def key(*parts: str) -> str:
    return "fix:" + hashlib.sha256("|".join(parts).encode()).hexdigest()


def get(k: str):
    v = _r.get(k)
    return json.loads(v) if v else None


def put(k: str, v: dict, ttl: int = 60 * 60 * 24 * 30):
    _r.set(k, json.dumps(v), ex=ttl)


def file_hash(path: str) -> str:
    return hashlib.sha256(open(path, "rb").read()).hexdigest()
