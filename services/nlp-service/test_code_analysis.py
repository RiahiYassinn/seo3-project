import asyncio
import json
import logging

from app.services.code_analyzer import CodeAnalyzer


logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def build_diff(file_name: str, content: str) -> str:
    lines = content.strip("\n").splitlines()
    diff_lines = [
        f"diff --git a/{file_name} b/{file_name}",
        f"--- a/{file_name}",
        f"+++ b/{file_name}",
        "@@",
    ]
    diff_lines.extend(f"+{line}" for line in lines)
    return "\n".join(diff_lines)


async def run_case(
    analyzer: CodeAnalyzer,
    name: str,
    file_name: str,
    content: str,
    commit_message: str,
) -> dict:
    result = await analyzer.analyze(
        files_with_content={file_name: content},
        diff_content=build_diff(file_name, content),
        commit_message=commit_message,
        developer_id=name.lower().replace(" ", "-"),
        existing_profile=None,
    )
    print(f"\n=== {name} ===")
    print(json.dumps(result, indent=2))
    return result


async def main() -> None:
    analyzer = CodeAnalyzer()

    case_1 = await run_case(
        analyzer,
        "Case 1 - Python With Multiple Weaknesses",
        "auth_service.py",
        """
import os

def authenticate(username, password):
    import pymongo
    client = pymongo.MongoClient("mongodb://admin:password123@localhost")
    db = client.users
    user = db.find_one({"username": username, "password": password})
    try:
        token = os.environ['SECRET'] + username
        return token
    except:
        return None

def process_users(users):
    result = []
    for u in users:
        for p in u['permissions']:
            for r in p['roles']:
                result.append(r)
    return result
""",
        "Add authentication helper with user processing",
    )

    case_2 = await run_case(
        analyzer,
        "Case 2 - TypeScript With Issues",
        "api.service.ts",
        """
export class ApiService {
  data: any;

  async fetchUsers() {
    const response = await fetch('http://api.example.com/users')
    const data = await response.json()
    this.data = data
    console.log('got users', data)
    return data
  }

  processData(d) {
    if (d == null) return
    if (d == undefined) return
    return d.map(x => x.name)
  }
}
""",
        "Add API service for users",
    )

    case_3 = await run_case(
        analyzer,
        "Case 3 - Good Quality Python",
        "user_repository.py",
        """
from typing import Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class User:
    id: str
    email: str
    name: str

class UserRepository:
    def __init__(self, db_client) -> None:
        self._client = db_client

    async def find_by_id(self, user_id: str) -> Optional[User]:
        try:
            record = await self._client.find_one({"_id": user_id})
            if not record:
                return None
            return User(id=record["_id"], email=record["email"], name=record["name"])
        except Exception as e:
            logger.error("Failed to fetch user %s: %s", user_id, e)
            raise
""",
        "Add typed repository access for users",
    )

    print("\n=== Summary ===")
    print(
        json.dumps(
            {
                "case_1_quality_score": case_1.get("quality_score"),
                "case_2_quality_score": case_2.get("quality_score"),
                "case_3_quality_score": case_3.get("quality_score"),
                "case_3_beats_case_1": (case_3.get("quality_score") or 0) > (case_1.get("quality_score") or 0),
                "case_3_beats_case_2": (case_3.get("quality_score") or 0) > (case_2.get("quality_score") or 0),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(main())
