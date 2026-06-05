"""
Custom Keras layers and models for health score Dense NN.
Must be importable by the model loader for deserialization.
"""
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


@tf.keras.utils.register_keras_serializable()
class CategoryEmbeddingMixer(layers.Layer):
    """
    Custom layer that embeds a categorical input (user_segment) and
    mixes it with numeric features via concatenation and a small dense block.

    Input: [segment_indices (batch, 1), numeric_features (batch, n_numeric)]
    Output: mixed representation (batch, mixed_dim)
    """
    def __init__(self, n_segments=3, embed_dim=8, mixed_dim=32, **kwargs):
        super().__init__(**kwargs)
        self.n_segments = n_segments
        self.embed_dim = embed_dim
        self.mixed_dim = mixed_dim

    def build(self, input_shape):
        self.embedding = layers.Embedding(
            input_dim=self.n_segments,
            output_dim=self.embed_dim,
            name="segment_embedding"
        )
        self.mix_dense = layers.Dense(self.mixed_dim, activation="relu", name="mix_dense")
        self.mix_norm = layers.BatchNormalization(name="mix_norm")
        super().build(input_shape)

    def call(self, inputs, training=False):
        segment_input, numeric_input = inputs
        embedded = self.embedding(segment_input)
        embedded = tf.squeeze(embedded, axis=1)
        combined = tf.concat([embedded, numeric_input], axis=-1)
        mixed = self.mix_dense(combined)
        mixed = self.mix_norm(mixed, training=training)
        return mixed

    def get_config(self):
        config = super().get_config()
        config.update({
            "n_segments": self.n_segments,
            "embed_dim": self.embed_dim,
            "mixed_dim": self.mixed_dim,
        })
        return config


@tf.keras.utils.register_keras_serializable()
class HealthScoreDenseModel(keras.Model):
    """
    Dense NN for health score prediction.
    Uses CategoryEmbeddingMixer to combine segment embeddings with numeric features.
    """
    def __init__(self, n_segments=3, n_numeric=10, **kwargs):
        super().__init__(**kwargs)
        self._n_segments = n_segments
        self._n_numeric = n_numeric
        self.mixer = CategoryEmbeddingMixer(
            n_segments=n_segments,
            embed_dim=8,
            mixed_dim=32,
            name="embedding_mixer"
        )
        self.dense1 = layers.Dense(64, activation="relu", name="dense_1")
        self.norm1 = layers.BatchNormalization(name="norm_1")
        self.dropout1 = layers.Dropout(0.3, name="drop_1")
        self.dense2 = layers.Dense(32, activation="relu", name="dense_2")
        self.norm2 = layers.BatchNormalization(name="norm_2")
        self.dropout2 = layers.Dropout(0.2, name="drop_2")
        self.dense3 = layers.Dense(16, activation="relu", name="dense_3")
        self.output_layer = layers.Dense(1, activation="linear", name="output")

    def call(self, inputs, training=False):
        segment_input, numeric_input = inputs
        x = self.mixer([segment_input, numeric_input], training=training)
        x = self.dense1(x)
        x = self.norm1(x, training=training)
        x = self.dropout1(x, training=training)
        x = self.dense2(x)
        x = self.norm2(x, training=training)
        x = self.dropout2(x, training=training)
        x = self.dense3(x)
        return self.output_layer(x)

    def get_config(self):
        config = super().get_config()
        config.update({
            "n_segments": self._n_segments,
            "n_numeric": self._n_numeric,
        })
        return config
