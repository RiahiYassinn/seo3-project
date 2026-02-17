from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "NLP Service"
    DEBUG: bool = True
    PORT: int = 8000
    
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


settings = Settings()
