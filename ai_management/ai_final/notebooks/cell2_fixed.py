#@title 2. Imports & Model Loading (Fixed for PaddleOCR 2026)
import cv2
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from ultralytics import YOLO
from huggingface_hub import HfApi, hf_hub_download
from google.colab.patches import cv2_imshow
from google.colab import files, drive
from IPython.display import clear_output
from tqdm.notebook import tqdm
import os
import shutil
import logging
import torch
import sys
import warnings
warnings.filterwarnings('ignore')

# Mount Drive for custom model
drive.mount('/content/drive', force_remount=False)

# Check GPU
print(f"PyTorch GPU Available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"CUDA Version: {torch.version.cuda}")
else:
    print("WARNING: No GPU detected. Go to Runtime > Change runtime type > GPU")

# --- PADDLEOCR INIT (Fixed for 2026 version) ---
ocr = None

def init_ocr():
    global ocr
    if ocr is not None:
        return ocr
    
    # Suppress logs
    os.environ['FLAGS_log_level'] = '3'
    logging.getLogger('ppocr').setLevel(logging.ERROR)
    logging.getLogger('paddle').setLevel(logging.ERROR)
    
    try:
        from paddleocr import PaddleOCR
        # New PaddleOCR 2026 API - no show_log argument
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang='en',
            use_gpu=torch.cuda.is_available()
        )
        print("PaddleOCR initialized successfully!")
    except Exception as e:
        print(f"OCR Error: {e}")
        print("Trying minimal config...")
        try:
            from paddleocr import PaddleOCR
            ocr = PaddleOCR(lang='en', use_gpu=False)
            print("PaddleOCR initialized (CPU fallback)")
        except Exception as e2:
            print(f"OCR completely failed: {e2}")
            ocr = None
    
    return ocr

# Initialize OCR
ocr = init_ocr()

# Load Models
print("\nLoading detection models...")
models = {}

# Custom model from Drive
custom_path = "/content/drive/MyDrive/ai_cctv/best_dec20.pt"
if os.path.exists(custom_path):
    models["Custom"] = YOLO(custom_path)
    print(f"  Custom: Loaded from Drive")
else:
    print(f"  Custom model not found, using YOLOv8n")
    models["Custom"] = YOLO("yolov8n.pt")

# Standard models
models["YOLOv8x"] = YOLO("yolov8x.pt")
models["YOLOv8l"] = YOLO("yolov8l.pt")
models["YOLOv8m"] = YOLO("yolov8m.pt")

print(f"\nAll {len(models)} models loaded!")
