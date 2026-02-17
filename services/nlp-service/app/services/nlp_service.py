import re
from typing import List
from app.models.schemas import TechnologyDetection, SentimentAnalysis


class NLPService:
    """Service for Natural Language Processing of commit messages"""
    
    def __init__(self):
        # TODO: Load spaCy model
        # self.nlp = spacy.load("en_core_web_sm")
        self.tech_patterns = self._load_technology_patterns()
    
    def _load_technology_patterns(self) -> dict:
        """Load technology detection patterns"""
        return {
            'javascript': ['js', 'javascript', 'react', 'vue', 'angular', 'node'],
            'python': ['py', 'python', 'django', 'flask', 'fastapi'],
            'java': ['java', 'spring', 'maven', 'gradle'],
            'typescript': ['ts', 'typescript'],
            'rust': ['rs', 'rust', 'cargo'],
            'go': ['go', 'golang'],
            'docker': ['docker', 'dockerfile', 'container'],
            'kubernetes': ['k8s', 'kubernetes', 'kubectl'],
            'database': ['sql', 'mongodb', 'postgres', 'mysql', 'redis'],
            'testing': ['test', 'jest', 'pytest', 'junit', 'spec'],
        }
    
    def detect_technologies(
        self,
        message: str,
        files: List[str]
    ) -> List[TechnologyDetection]:
        """Detect technologies from commit message and file changes"""
        technologies = []
        message_lower = message.lower()
        
        # Check message for technology keywords
        for category, keywords in self.tech_patterns.items():
            for keyword in keywords:
                if keyword in message_lower:
                    technologies.append(TechnologyDetection(
                        name=category,
                        confidence=0.8,
                        category=category
                    ))
                    break
        
        # Check file extensions
        for file in files:
            ext = file.split('.')[-1].lower()
            if ext in ['js', 'jsx']:
                technologies.append(TechnologyDetection(
                    name='javascript',
                    confidence=0.9,
                    category='javascript'
                ))
            elif ext in ['py']:
                technologies.append(TechnologyDetection(
                    name='python',
                    confidence=0.9,
                    category='python'
                ))
            elif ext in ['ts', 'tsx']:
                technologies.append(TechnologyDetection(
                    name='typescript',
                    confidence=0.9,
                    category='typescript'
                ))
            elif ext in ['rs']:
                technologies.append(TechnologyDetection(
                    name='rust',
                    confidence=0.9,
                    category='rust'
                ))
        
        # Remove duplicates
        seen = set()
        unique_technologies = []
        for tech in technologies:
            if tech.name not in seen:
                seen.add(tech.name)
                unique_technologies.append(tech)
        
        return unique_technologies
    
    def analyze_sentiment(self, message: str) -> SentimentAnalysis:
        """Analyze sentiment of commit message"""
        # TODO: Implement proper sentiment analysis using spaCy or transformers
        # This is a simple placeholder
        positive_words = ['fix', 'improve', 'add', 'enhance', 'optimize', 'feature']
        negative_words = ['bug', 'error', 'issue', 'problem', 'broken']
        
        message_lower = message.lower()
        positive_count = sum(1 for word in positive_words if word in message_lower)
        negative_count = sum(1 for word in negative_words if word in message_lower)
        
        if positive_count > negative_count:
            return SentimentAnalysis(score=0.7, label='positive')
        elif negative_count > positive_count:
            return SentimentAnalysis(score=0.3, label='negative')
        else:
            return SentimentAnalysis(score=0.5, label='neutral')
    
    def calculate_complexity(
        self,
        additions: int,
        deletions: int,
        files_changed: int
    ) -> float:
        """Calculate commit complexity score"""
        # Simple complexity calculation
        total_changes = additions + deletions
        complexity = (total_changes / 100) * (files_changed / 5)
        return min(complexity, 10.0)  # Cap at 10
    
    def extract_key_phrases(self, message: str) -> List[str]:
        """Extract key phrases from commit message"""
        # TODO: Implement proper key phrase extraction using spaCy
        # This is a placeholder
        words = re.findall(r'\b\w+\b', message.lower())
        return list(set(words))[:10]
    
    def categorize_commit(
        self,
        message: str,
        files: List[str]
    ) -> List[str]:
        """Categorize commit type"""
        categories = []
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['fix', 'bug', 'issue']):
            categories.append('bugfix')
        if any(word in message_lower for word in ['feature', 'add', 'new']):
            categories.append('feature')
        if any(word in message_lower for word in ['refactor', 'cleanup', 'improve']):
            categories.append('refactor')
        if any(word in message_lower for word in ['test', 'spec']):
            categories.append('testing')
        if any(word in message_lower for word in ['doc', 'readme']):
            categories.append('documentation')
        if any(file.endswith('.md') for file in files):
            categories.append('documentation')
        
        return categories if categories else ['other']
