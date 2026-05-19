"""
backend/ml_models/load_model.py
═══════════════════════════════════════════════════════════════════════════════
PROMPTWALL — Model Loader for Compressed DeBERTa-v3-large

Your model:
  Base:        microsoft/deberta-v3-large
  Dataset:     imoxto/prompt_injection_cleaned_dataset
  Compressed:  float16 (738MB → ~369MB via compress_model_v4.py)
  Saved at:    Google Drive → promptwall_final  (root folder, model.safetensors)
  Compressed:  Google Drive → promptwall_compressed  (fp16.txt flag present)

How to use:
  1. Download your model folder from Google Drive
  2. Paste into: backend/ml_models/saved_model/  OR  backend/ml_models/promptwall_compressed/
  3. Set in backend/.env:
       ML_MODEL_PATH=ml_models/saved_model            # original 738MB
       ML_MODEL_PATH=ml_models/promptwall_compressed  # compressed 369MB (recommended)
  4. This file is called once at FastAPI startup — model stays in memory

Integration:
  from ml_models.load_model import detector
  score, attack_type = detector.predict("User message here")
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import re
import logging
import unicodedata

logger = logging.getLogger("promptwall.detector")

MAX_LENGTH = 256

# ─── REGEX PATTERNS ───────────────────────────────────────────────────────────
# 14 patterns — checked in order of severity (highest score first).
# Returns the HIGHEST-scoring match, not just the first one.
# Each entry: (regex_pattern, attack_type_label, score_0_to_100)

_PATTERNS = [
    (r"ignore.*(previous|above|prior|all).*(instruction|prompt|rule)",    "System Prompt Leak", 95),
    (r"(reveal|show|output|print|repeat).*(system|prompt|instruction|confidential)", "System Prompt Leak", 91),
    (r"(you are now|act as|pretend).*(dan|evil|unrestricted|jailbreak)",  "Jailbreak",          92),
    (r"(no restriction|unrestricted mode|without filter|no filter)",       "Jailbreak",          89),
    (r"new persona|new role|different ai|pretend you are|simulate being",  "Jailbreak",          80),
    (r"(admin mode|developer mode|god mode|debug mode)",                   "Prompt Injection",   82),
    (r"(forget|bypass|override|ignore).*(restrict|filter|rule|limit)",     "Goal Hijacking",     87),
    (r"(disregard|dismiss|cancel).*(previous|all).*(instruction|rule)",    "Goal Hijacking",     85),
    (r"new.*goal.*is|ignore.*previous.*task|your.*new.*directive",         "Goal Hijacking",     84),
    (r"\[(system|admin|root|override)",                                    "Prompt Injection",   83),
    (r"(translate|convert|encode).*(instruction|system|prompt)",           "System Prompt Leak", 76),
    (r"(for educational|hypothetically).*(hack|bypass|inject)",            "Adversarial Input",  78),
    (r"(write|generate|create).*(malware|virus|exploit|payload)",          "Adversarial Input",  90),
    (r"(what is|tell me|list|show).*(balance|account number|pin|password|api.?key|secret)", "Data Extraction", 72),
    (r"(dump|extract|export|exfiltrate).*(database|user|data|record)",     "Data Extraction",    88),
]


def _regex_detect(text: str) -> tuple[int, str]:
    """
    Regex detection — checks ALL patterns and returns the HIGHEST scoring match.
    Returns (score, attack_type). Score 5 = clean input.
    """
    t = text.lower()
    best_score = 0
    best_attack = "None"

    for pattern, attack, score in _PATTERNS:
        if re.search(pattern, t):
            if score > best_score:
                best_score = score
                best_attack = attack

    if best_score == 0:
        return 5, "Clean"

    return best_score, best_attack


def _clean(text: str) -> str:
    """Same preprocessing used during training."""
    if not text or not str(text).strip():
        return ""
    text = str(text)
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[\u200B-\u200D\uFEFF]", "", text)
    text = re.sub(r"\s+", " ", text.lower()).strip()
    return text[:1000]


def _refine_attack_type(ml_score: int, text: str) -> str:
    """
    When the ML model detects injection but doesn't give a specific type,
    run the regex patterns to get the most specific attack type label.
    Falls back to "Prompt Injection" if no regex matches.
    """
    _, regex_attack = _regex_detect(text)
    if regex_attack not in ("None", "Clean"):
        return regex_attack
    # Generic fallback when ML fires but regex doesn't have a specific match
    if ml_score >= 85:
        return "Jailbreak"
    if ml_score >= 70:
        return "Prompt Injection"
    return "Adversarial Input"


# ─── ML DETECTOR CLASS ────────────────────────────────────────────────────────

class PromptInjectionDetector:
    """
    Loads your trained DeBERTa-v3-large model.
    Supports both:
      - Original float32 model (model.safetensors, ~738MB)
      - Compressed float16 model (model.safetensors + fp16.txt flag, ~369MB)

    Prediction uses TWO layers:
      Layer 1 — Regex patterns (fast, always runs, gives specific attack type)
      Layer 2 — DeBERTa ML model (accurate confidence score)
    
    Final result: uses ML score for accuracy, regex for specific attack type label.
    """

    def __init__(self):
        self._model      = None
        self._tokenizer  = None
        self._device     = None
        self._loaded     = False
        self._model_type = "regex-only"
        self._load()

    def _load(self) -> None:
        path = os.getenv("ML_MODEL_PATH", "ml_models/promptwall_compressed")

        if not os.path.isdir(path):
            logger.warning(
                f"[DETECTOR] Model folder not found at '{path}'. "
                f"Using regex-only detection. "
                f"To enable ML: set ML_MODEL_PATH in .env and paste model files there."
            )
            return

        has_safetensors = os.path.exists(os.path.join(path, "model.safetensors"))
        has_config      = os.path.exists(os.path.join(path, "config.json"))
        has_tokenizer   = os.path.exists(os.path.join(path, "tokenizer.json"))

        if not (has_safetensors and has_config and has_tokenizer):
            missing = []
            if not has_safetensors: missing.append("model.safetensors")
            if not has_config:      missing.append("config.json")
            if not has_tokenizer:   missing.append("tokenizer.json")
            logger.warning(f"[DETECTOR] Missing model files: {missing}. Using regex fallback.")
            return

        try:
            import torch
            from transformers import AutoTokenizer, AutoModelForSequenceClassification

            self._device = torch.device("cpu")
            if torch.cuda.is_available():
                self._device = torch.device("cuda")
                logger.info("[DETECTOR] CUDA GPU detected — loading model on GPU")

            is_fp16      = os.path.exists(os.path.join(path, "fp16.txt"))
            model_size   = os.path.getsize(os.path.join(path, "model.safetensors")) / 1e6

            logger.info(
                f"[DETECTOR] Loading {'compressed fp16' if is_fp16 else 'float32'} "
                f"model from '{path}' ({model_size:.0f} MB)..."
            )

            self._tokenizer = AutoTokenizer.from_pretrained(path)
            self._model     = AutoModelForSequenceClassification.from_pretrained(path)

            if is_fp16:
                self._model      = self._model.half()
                self._model_type = "deberta-v3-large-fp16"
            else:
                self._model_type = "deberta-v3-large-fp32"

            self._model.to(self._device)
            self._model.eval()
            self._loaded = True

            logger.info(
                f"[DETECTOR] ✅ {self._model_type} loaded on {self._device} | "
                f"Size: {model_size:.0f} MB | Max length: {MAX_LENGTH} tokens"
            )

        except ImportError:
            logger.error(
                "[DETECTOR] torch/transformers not installed. "
                "Run: pip install torch transformers"
            )
        except Exception as e:
            logger.error(f"[DETECTOR] Model load failed: {e} — falling back to regex")

    # ─── PREDICT ──────────────────────────────────────────────────────────────

    def predict(self, prompt: str, user_input: str = "") -> tuple[int, str]:
        """
        Main detection entry point.

        Args:
            prompt:     The user's message (required)
            user_input: Optional extra context

        Returns:
            (risk_score: int 0-100, attack_type: str)
            
            attack_type is always a specific label:
              "Jailbreak", "System Prompt Leak", "Goal Hijacking",
              "Prompt Injection", "Adversarial Input", "Data Extraction", "Clean"
        """
        if not prompt or not str(prompt).strip():
            return 0, "Clean"

        text = _clean(f"{prompt} {user_input}".strip())

        # Layer 1 — Regex (always runs, gives specific attack type)
        regex_score, regex_attack = _regex_detect(text)

        # Layer 2 — ML model (runs if loaded, gives better confidence score)
        if self._loaded:
            try:
                import torch
                inputs = self._tokenizer(
                    text,
                    truncation=True,
                    max_length=MAX_LENGTH,
                    return_tensors="pt",
                ).to(self._device)

                with torch.no_grad():
                    logits = self._model(**inputs).logits
                    probs  = torch.softmax(logits.float(), dim=-1)[0]

                ml_score = int(probs[1].item() * 100)

                # Use the higher of ML score or regex score
                final_score = max(ml_score, regex_score)

                # Attack type: always use regex label (specific) if it fired,
                # otherwise derive from ML score
                if regex_attack not in ("None", "Clean"):
                    # Regex caught something specific — trust that label
                    final_attack = regex_attack
                elif ml_score >= 50:
                    # ML detected injection but regex didn't have a specific match
                    # — derive the most likely type from the text
                    final_attack = _refine_attack_type(ml_score, text)
                else:
                    final_attack = "Clean"

                return final_score, final_attack

            except Exception as e:
                logger.warning(f"[DETECTOR] ML inference error: {e} — using regex result")
                return regex_score, regex_attack

        # Regex-only mode
        return regex_score, regex_attack

    @property
    def is_ml_active(self) -> bool:
        return self._loaded

    @property
    def model_type(self) -> str:
        return self._model_type

    def health(self) -> dict:
        return {
            "ml_active":      self._loaded,
            "model_type":     self._model_type,
            "device":         str(self._device) if self._device else "cpu",
            "max_length":     MAX_LENGTH,
            "regex_patterns": len(_PATTERNS),
        }


# ─── SINGLETON ────────────────────────────────────────────────────────────────
detector = PromptInjectionDetector()