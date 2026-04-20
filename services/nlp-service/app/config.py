from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Code Analysis Service"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    KAFKA_BROKERS: str = "localhost:29092"
    KAFKA_CONSUMER_GROUP: str = "nlp-service-group"

    model_config = SettingsConfigDict(
        env_file="../../.env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
