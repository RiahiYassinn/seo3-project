from pydantic_settings import BaseSettings
from typing import Optional
from urllib.parse import urlparse


class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "NLP Service"
    DEBUG: bool = True
    
    # Service URL (contains host and port)
    NLP_SERVICE: str = "http://localhost:8000"
    
    @property
    def PORT(self) -> int:
        """Extract port from NLP_SERVICE URL"""
        parsed = urlparse(self.NLP_SERVICE)
        return parsed.port or 8000
    
    @property
    def HOST(self) -> str:
        """Extract host from NLP_SERVICE URL"""
        parsed = urlparse(self.NLP_SERVICE)
        return parsed.hostname or "localhost"
    
    # MongoDB settings
    MONGODB_URL: str = "mongodb://seo3_user:seo3_password@localhost:27017/seo3_analytics?authSource=admin"
    
    # Kafka settings
    KAFKA_BROKERS: str = "localhost:29092"
    KAFKA_CONSUMER_GROUP: str = "nlp-service-group"
    
    # NLP settings
    SPACY_MODEL: str = "en_core_web_sm"
    MODEL_PATH: Optional[str] = "./models"
    
    class Config:
        env_file = "../../.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()