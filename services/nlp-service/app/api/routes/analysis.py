from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    CommitAnalysisRequest,
    CommitAnalysisResponse,
    CodeParseRequest,
    CodeParseResponse,
    TechnologyDetection,
    SentimentAnalysis
)
from app.services.nlp_service import NLPService
from app.services.code_parser import CodeParser

router = APIRouter()
nlp_service = NLPService()
code_parser = CodeParser()


@router.post("/commit", response_model=CommitAnalysisResponse)
async def analyze_commit(request: CommitAnalysisRequest):
    """
    Analyze a commit message and detect technologies, sentiment, and key phrases
    """
    try:
        # Detect technologies from commit message and files
        technologies = nlp_service.detect_technologies(
            request.message,
            request.files_changed
        )
        
        # Analyze sentiment
        sentiment = nlp_service.analyze_sentiment(request.message)
        
        # Calculate complexity score
        complexity_score = nlp_service.calculate_complexity(
            request.additions,
            request.deletions,
            len(request.files_changed)
        )
        
        # Extract key phrases
        key_phrases = nlp_service.extract_key_phrases(request.message)
        
        # Categorize commit
        categories = nlp_service.categorize_commit(
            request.message,
            request.files_changed
        )
        
        return CommitAnalysisResponse(
            commit_sha=request.commit_sha,
            technologies=technologies,
            sentiment=sentiment,
            complexity_score=complexity_score,
            key_phrases=key_phrases,
            categories=categories
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/code/parse", response_model=CodeParseResponse)
async def parse_code(request: CodeParseRequest):
    """
    Parse code and extract structural information
    """
    try:
        result = code_parser.parse(
            request.code,
            request.language,
            request.file_path
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch/commits")
async def analyze_commits_batch(commits: list[CommitAnalysisRequest]):
    """
    Analyze multiple commits in batch
    """
    try:
        results = []
        for commit in commits:
            result = await analyze_commit(commit)
            results.append(result)
        return {"analyzed": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
