"""
Model loader for AI service.
Handles loading and caching of TensorFlow models and preprocessors.
"""
import os
import json
import pickle
import numpy as np
import tensorflow as tf
from pathlib import Path
from typing import Optional, Dict, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Model paths: use MODELS_DIR env var if set, otherwise relative to monorepo
# Default (local dev): dompet-cerdas-ai/ai-service/app/models/loader.py → dompet-cerdas-ai/ml-models/
# Deploy: set MODELS_DIR env var to the path where models are stored
_env_models_dir = os.getenv("MODELS_DIR")
if _env_models_dir:
    MODELS_DIR = Path(_env_models_dir)
else:
    MODELS_DIR = Path(__file__).parent.parent.parent.parent / "ml-models"

class ModelManager:
    """
    Singleton manager for loading and caching ML models.
    """
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if ModelManager._initialized:
            return
        
        self.models: Dict[str, Any] = {}
        self.tokenizers: Dict[str, Any] = {}
        self.label_encoders: Dict[str, Any] = {}
        self.scalers: Dict[str, Any] = {}
        
        # LSTM budget forecasting metadata
        self.lstm_config: Optional[Dict[str, Any]] = None
        
        # Health score model metadata
        self.health_score_config: Optional[Dict[str, Any]] = None
        
        # Autoencoder anomaly detection metadata
        self.autoencoder_config: Optional[Dict[str, Any]] = None
        
        ModelManager._initialized = True
    
    def load_cnn_model(self) -> bool:
        """
        Load CNN category classification model.
        
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            model_path = MODELS_DIR / "model_category_cnn.keras"
            tokenizer_path = MODELS_DIR / "category_tokenizer.pkl"
            label_encoder_path = MODELS_DIR / "label_encoder.pkl"
            
            if not model_path.exists():
                logger.error(f"CNN model not found at {model_path}")
                return False
            
            logger.info(f"Loading CNN model from {model_path}")
            self.models["cnn_category"] = tf.keras.models.load_model(str(model_path))
            
            if tokenizer_path.exists():
                with open(tokenizer_path, 'rb') as f:
                    self.tokenizers["category"] = pickle.load(f)
                logger.info("Category tokenizer loaded")
            
            if label_encoder_path.exists():
                with open(label_encoder_path, 'rb') as f:
                    self.label_encoders["category"] = pickle.load(f)
                logger.info("Category label encoder loaded")
            
            logger.info("CNN model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load CNN model: {str(e)}")
            return False
    
    def load_lstm_model(self) -> bool:
        """
        Load LSTM spending forecast model and its metadata.
        Model: multi-category LSTM (input: batch×3×18, output: batch×18).
        Categories: 9 expense categories × 2 features (amount, income_ratio).
        
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            model_path = MODELS_DIR / "model_spending_lstm.keras"
            metadata_path = MODELS_DIR / "model_lstm_metadata.json"
            
            if not model_path.exists():
                logger.error(f"LSTM model not found at {model_path}")
                return False
            
            logger.info(f"Loading LSTM model from {model_path}")
            # compile=False: skip custom loss (AsymmetricMSE) — only needed for inference
            self.models["lstm_spending"] = tf.keras.models.load_model(str(model_path), compile=False)
            
            # Load metadata if available
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    self.lstm_config = json.load(f)
                logger.info(
                    f"LSTM metadata loaded: "
                    f"categories={self.lstm_config.get('n_categories')}, "
                    f"timesteps={self.lstm_config.get('timesteps')}, "
                    f"input_shape={self.lstm_config.get('input_shape')}"
                )
            else:
                logger.warning(f"LSTM metadata not found at {metadata_path}")
                self.lstm_config = None
            
            # Load MinMaxScaler for inverse transform (normalized targets)
            scaler_path = MODELS_DIR / "spending_minmax_scaler.pkl"
            if scaler_path.exists():
                with open(scaler_path, 'rb') as f:
                    self.scalers["lstm_spending"] = pickle.load(f)
                logger.info("LSTM spending MinMaxScaler loaded")
            else:
                logger.warning(f"LSTM scaler not found at {scaler_path}")
            
            logger.info("LSTM spending forecast model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load LSTM model: {str(e)}")
            return False
    
    def get_lstm_model(self) -> Optional[tf.keras.Model]:
        """Get loaded LSTM spending forecast model."""
        return self.models.get("lstm_spending")
    
    def get_lstm_config(self) -> Optional[Dict[str, Any]]:
        """Get LSTM model configuration metadata."""
        return self.lstm_config
    
    def get_lstm_scaler(self) -> Optional[Any]:
        """Get LSTM spending MinMaxScaler for inverse transform."""
        return self.scalers.get("lstm_spending")
    
    def is_lstm_ready(self) -> bool:
        """Check if LSTM spending forecast model is loaded and ready."""
        return "lstm_spending" in self.models
    
    def load_health_score_model(self) -> bool:
        """
        Load Health Score Dense NN model and its metadata.
        Model: Dense NN with CategoryEmbeddingMixer (input: segment + 10 numeric features).
        Output: single scalar health score (0-100).
        
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            model_path = MODELS_DIR / "model_health_dense.keras"
            metadata_path = MODELS_DIR / "model_health_metadata.json"
            scaler_path = MODELS_DIR / "health_scaler.pkl"
            
            if not model_path.exists():
                logger.error(f"Health score model not found at {model_path}")
                return False
            
            logger.info(f"Loading health score model from {model_path}")
            # Pass custom_objects explicitly for Keras 2/3 compatibility
            from app.models.custom_objects import HealthScoreDenseModel, CategoryEmbeddingMixer
            self.models["health_score"] = tf.keras.models.load_model(
                str(model_path),
                compile=False,
                custom_objects={
                    "HealthScoreDenseModel": HealthScoreDenseModel,
                    "CategoryEmbeddingMixer": CategoryEmbeddingMixer,
                }
            )
            
            # Load metadata if available
            if metadata_path.exists():
                with open(metadata_path, 'r') as f:
                    self.health_score_config = json.load(f)
                logger.info(
                    f"Health score metadata loaded: "
                    f"features={self.health_score_config.get('n_numeric')}, "
                    f"segments={self.health_score_config.get('n_segments')}"
                )
            else:
                logger.warning(f"Health score metadata not found at {metadata_path}")
                self.health_score_config = None
            
            # Load scaler if available
            if scaler_path.exists():
                with open(scaler_path, 'rb') as f:
                    self.scalers["health_score"] = pickle.load(f)
                logger.info("Health score scaler loaded")
            
            logger.info("Health score model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load health score model: {str(e)}")
            return False
    
    def get_health_score_model(self) -> Optional[tf.keras.Model]:
        """Get loaded Health Score model."""
        return self.models.get("health_score")
    
    def get_health_score_config(self) -> Optional[Dict[str, Any]]:
        """Get Health Score model configuration metadata."""
        return self.health_score_config
    
    def get_health_score_scaler(self) -> Optional[Any]:
        """Get Health Score feature scaler."""
        return self.scalers.get("health_score")
    
    def is_health_score_ready(self) -> bool:
        """Check if Health Score model is loaded and ready."""
        return "health_score" in self.models
    
    def load_autoencoder_model(self) -> bool:
        """
        Load Autoencoder anomaly detection model and its metadata.
        Model: symmetric encoder-decoder Dense NN.
        Anomaly = reconstruction error > threshold.
        
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            model_path = MODELS_DIR / "model_autoencoder.keras"
            config_path = MODELS_DIR / "autoencoder_config.json"
            scaler_path = MODELS_DIR / "autoencoder_scaler.pkl"
            
            if not model_path.exists():
                logger.error(f"Autoencoder model not found at {model_path}")
                return False
            
            logger.info(f"Loading autoencoder model from {model_path}")
            self.models["autoencoder"] = tf.keras.models.load_model(
                str(model_path), compile=False
            )
            
            # Load config if available
            if config_path.exists():
                with open(config_path, 'r') as f:
                    self.autoencoder_config = json.load(f)
                logger.info(
                    f"Autoencoder config loaded: "
                    f"input_dim={self.autoencoder_config.get('input_dim')}, "
                    f"threshold={self.autoencoder_config.get('threshold')}"
                )
            else:
                logger.warning(f"Autoencoder config not found at {config_path}")
                self.autoencoder_config = None
            
            # Load scaler if available
            if scaler_path.exists():
                with open(scaler_path, 'rb') as f:
                    self.scalers["autoencoder"] = pickle.load(f)
                logger.info("Autoencoder scaler loaded")
            
            logger.info("Autoencoder model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load autoencoder model: {str(e)}")
            return False
    
    def get_autoencoder_model(self) -> Optional[tf.keras.Model]:
        """Get loaded Autoencoder model."""
        return self.models.get("autoencoder")
    
    def get_autoencoder_config(self) -> Optional[Dict[str, Any]]:
        """Get Autoencoder model configuration metadata."""
        return self.autoencoder_config
    
    def get_autoencoder_scaler(self) -> Optional[Any]:
        """Get Autoencoder feature scaler."""
        return self.scalers.get("autoencoder")
    
    def is_autoencoder_ready(self) -> bool:
        """Check if Autoencoder model is loaded and ready."""
        return (
            "autoencoder" in self.models and
            self.autoencoder_config is not None
        )
    
    def load_all_models(self) -> Dict[str, bool]:
        """
        Load all available models.
        
        Returns:
            Dictionary of model names and their load status
        """
        results = {
            "cnn_category": self.load_cnn_model(),
            "lstm_budget": self.load_lstm_model(),
            "health_score": self.load_health_score_model(),
            "autoencoder_anomaly": self.load_autoencoder_model(),
        }
        
        loaded_count = sum(results.values())
        logger.info(f"Loaded {loaded_count}/{len(results)} models")
        
        return results
    
    def get_cnn_model(self) -> Optional[tf.keras.Model]:
        """Get loaded CNN model."""
        return self.models.get("cnn_category")
    
    def get_category_tokenizer(self) -> Optional[Any]:
        """Get category tokenizer."""
        return self.tokenizers.get("category")
    
    def get_category_label_encoder(self) -> Optional[Any]:
        """Get category label encoder."""
        return self.label_encoders.get("category")
    
    def is_cnn_ready(self) -> bool:
        """Check if CNN model is loaded and ready."""
        return (
            "cnn_category" in self.models and
            "category" in self.tokenizers and
            "category" in self.label_encoders
        )
    
    def get_category_classes(self) -> Optional[list]:
        """Get list of category classes from label encoder."""
        le = self.get_category_label_encoder()
        if le is not None:
            return list(le.classes_)
        return None


# Global model manager instance
model_manager = ModelManager()
