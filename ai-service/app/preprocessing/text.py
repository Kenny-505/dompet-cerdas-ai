"""
Text preprocessing pipeline for CNN auto-categorization.
"""
import re
import pickle
import numpy as np
from pathlib import Path
from typing import List, Tuple, Optional


class TextPreprocessor:
    """
    Text preprocessor for transaction description.
    Handles text cleaning, tokenization, and padding for CNN model.
    """
    
    def __init__(self, tokenizer_path: Optional[str] = None, max_length: int = 50):
        """
        Initialize preprocessor with tokenizer.
        
        Args:
            tokenizer_path: Path to saved tokenizer pickle file
            max_length: Maximum sequence length for padding
        """
        self.max_length = max_length
        self.tokenizer = None
        
        if tokenizer_path and Path(tokenizer_path).exists():
            self.load_tokenizer(tokenizer_path)
    
    def load_tokenizer(self, path: str) -> None:
        """Load tokenizer from pickle file."""
        with open(path, 'rb') as f:
            self.tokenizer = pickle.load(f)
    
    def clean_text(self, text: str) -> str:
        """
        Clean and normalize transaction description.
        
        Args:
            text: Raw description text
            
        Returns:
            Cleaned text
        """
        if not isinstance(text, str):
            text = str(text)
        
        # Convert to lowercase
        text = text.lower()
        
        # Remove special characters but keep alphanumeric and spaces
        text = re.sub(r'[^a-z0-9\s]', ' ', text)
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Remove common Indonesian stop words that don't add meaning
        stop_words = {'yang', 'di', 'ke', 'dari', 'untuk', 'dengan', 'dan', 'atau', 'ini', 'itu'}
        words = text.split()
        words = [w for w in words if w not in stop_words]
        
        return ' '.join(words)
    
    def tokenize(self, text: str) -> List[int]:
        """
        Tokenize text to sequence of integers.
        
        Args:
            text: Cleaned text
            
        Returns:
            List of token indices
        """
        if self.tokenizer is None:
            raise ValueError("Tokenizer not loaded. Call load_tokenizer first.")
        
        # Use tokenizer's text_to_sequences
        sequences = self.tokenizer.texts_to_sequences([text])
        return sequences[0] if sequences else []
    
    def pad_sequence(self, sequence: List[int]) -> np.ndarray:
        """
        Pad or truncate sequence to fixed length.
        
        Args:
            sequence: List of token indices
            
        Returns:
            Padded numpy array of shape (max_length,)
        """
        if len(sequence) >= self.max_length:
            return np.array(sequence[:self.max_length])
        else:
            # Pad with zeros (assuming 0 is the padding index)
            return np.array(sequence + [0] * (self.max_length - len(sequence)))
    
    def preprocess(self, text: str) -> np.ndarray:
        """
        Full preprocessing pipeline: clean -> tokenize -> pad.
        
        Args:
            text: Raw description text
            
        Returns:
            Preprocessed array ready for model input
        """
        cleaned = self.clean_text(text)
        sequence = self.tokenize(cleaned)
        padded = self.pad_sequence(sequence)
        return padded
    
    def preprocess_batch(self, texts: List[str]) -> np.ndarray:
        """
        Preprocess batch of texts.
        
        Args:
            texts: List of raw description texts
            
        Returns:
            Batch of preprocessed arrays
        """
        return np.array([self.preprocess(t) for t in texts])


def preprocess_for_cnn(
    description: str,
    amount: float,
    transaction_type: str,
    tokenizer_path: str,
    max_length: int = 50
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Preprocess transaction data for CNN model.
    
    The CNN model expects three inputs:
    1. Text sequence (tokenized and padded description)
    2. Amount (normalized)
    3. Transaction type (encoded)
    
    Args:
        description: Transaction description
        amount: Transaction amount
        transaction_type: "pengeluaran" or "pemasukan"
        tokenizer_path: Path to tokenizer pickle
        max_length: Max sequence length
        
    Returns:
        Tuple of (text_sequence, amount_feature, type_feature)
    """
    preprocessor = TextPreprocessor(tokenizer_path, max_length)
    
    # Preprocess text
    text_seq = preprocessor.preprocess(description)
    
    # Normalize amount (log scale + clipping for stability)
    amount_norm = np.log1p(amount) / 20.0  # Normalize to roughly 0-1 range
    amount_norm = np.clip(amount_norm, 0, 1)
    amount_feature = np.array([amount_norm])
    
    # Encode transaction type
    # 0 for pengeluaran, 1 for pemasukan
    type_encoded = 0 if transaction_type == "pengeluaran" else 1
    type_feature = np.array([type_encoded])
    
    return text_seq, amount_feature, type_feature
