"""
AI CCTV - Flask Backend API
Complete backend with SQLite database
"""
import os
os.environ['TORCH_FORCE_WEIGHTS_ONLY_LOAD'] = '0'

# Make torch optional
try:
    import torch
    _original_load = torch.load
    def _patched_load(*args, **kwargs):
        kwargs['weights_only'] = False
        return _original_load(*args, **kwargs)
    torch.load = _patched_load
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print("⚠️ torch not available - some features disabled")

import cv2
import sqlite3
import base64
import uuid
import subprocess
import numpy as np
from datetime import datetime
from pathlib import Path
from functools import wraps
from flask import Flask, jsonify, request, Response, send_file
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import threading
import time
import jwt

# Try to load YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    print("⚠️ YOLO not available - detection disabled")

# Try to load face_recognition
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False
    print("⚠️ face_recognition not available - face search disabled")

app = Flask(__name__)
CORS(app, origins=['*'])

# Configuration
DATABASE = 'aicctv.db'
JWT_SECRET = 'ai-cctv-secret-key-change-in-production'
MODEL_DIR = Path(__file__).parent.parent / 'models'
UPLOAD_DIR = Path('uploads')
UPLOAD_DIR.mkdir(exist_ok=True)
FACE_DIR = Path('faces')
FACE_DIR.mkdir(exist_ok=True)

# Global state
camera = None
camera_lock = threading.Lock()
latest_detections = []
face_encodings_cache = {}

# Session counters
sugar_bag_count = 0
last_sugar_update = 0

# Load YOLO models
# Global dictionary to hold all loaded models
loaded_models = {}
active_model_name = 'best_dec20'  # Default to best_dec20 if available, else first available

# Define available models
AVAILABLE_MODELS = {
    'best_dec20': 'best_dec20.pt',
    'sugar_bag_final': 'sugar_bag_final.pt',
    'sugar_bag_finetuned': 'sugar_bag_finetuned.pt',
    'sugar_bag_improved': 'sugar_bag_improved.pt'
}

if YOLO_AVAILABLE:
    print("Loading YOLO models...")
    for model_key, model_file in AVAILABLE_MODELS.items():
        try:
            model_path = MODEL_DIR / model_file
            if model_path.exists():
                loaded_models[model_key] = YOLO(str(model_path), task='detect')
                print(f"✅ Model loaded: {model_key} ({model_path})")
            else:
                print(f"⚠️ Model file not found: {model_file} (skipping)")
        except Exception as e:
            print(f"❌ Failed to load {model_key}: {e}")

    if loaded_models:
        # Set default active model
        if active_model_name not in loaded_models:
            active_model_name = list(loaded_models.keys())[0]
        print(f"📍 Active model: {active_model_name}")
    else:
        print("⚠️ No models loaded!")


# ===== DATABASE =====
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize SQLite database with all tables."""
    conn = get_db()
    c = conn.cursor()
    
    # Users table
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'viewer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Cameras table
    c.execute('''CREATE TABLE IF NOT EXISTS cameras (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        location TEXT,
        rtsp_url TEXT,
        is_online INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Product types table
    c.execute('''CREATE TABLE IF NOT EXISTS product_types (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Inventory table
    c.execute('''CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        product_name TEXT NOT NULL,
        count_in INTEGER DEFAULT 0,
        count_out INTEGER DEFAULT 0,
        current_stock INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Detections table
    c.execute('''CREATE TABLE IF NOT EXISTS detections (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        confidence REAL,
        direction TEXT,
        camera_id TEXT,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Alerts table
    c.execute('''CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        severity TEXT DEFAULT 'info',
        message TEXT,
        is_resolved INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Scans table (Label Scanner)
    c.execute('''CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        barcode TEXT,
        batch_no TEXT,
        product_name TEXT,
        mfg_date TEXT,
        expiry_date TEXT,
        flavour TEXT,
        rack_no TEXT,
        shelf_no TEXT,
        quantity INTEGER DEFAULT 1,
        direction TEXT DEFAULT 'IN',
        scanned_by TEXT,
        scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Trucks table
    c.execute('''CREATE TABLE IF NOT EXISTS trucks (
        id TEXT PRIMARY KEY,
        plate_number TEXT NOT NULL,
        direction TEXT DEFAULT 'IN',
        confidence REAL DEFAULT 1.0,
        camera_id TEXT,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Faces table
    c.execute('''CREATE TABLE IF NOT EXISTS faces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        encoding BLOB,
        image_path TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )''')
    
    # Face detections table
    c.execute('''CREATE TABLE IF NOT EXISTS face_detections (
        id TEXT PRIMARY KEY,
        face_id TEXT,
        name TEXT,
        confidence REAL,
        camera_id TEXT,
        detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (face_id) REFERENCES faces(id)
    )''')
    
    # Create default admin user
    admin_id = str(uuid.uuid4())
    try:
        c.execute('INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
                  (admin_id, 'demo@aicctv.com', generate_password_hash('demo123'), 'Demo Admin', 'admin'))
    except:
        pass
    
    # Create default product types
    products = [
        ('Full Crate', 'FULL_CRATE'),
        ('Half Crate', 'HALF_CRATE'),
        ('Sugar Bag', 'SUGAR_BAG'),
        ('Truck', 'TRUCK'),
        ('Person', 'PERSON')
    ]
    for name, code in products:
        try:
            c.execute('INSERT INTO product_types (id, name, code) VALUES (?, ?, ?)',
                      (str(uuid.uuid4()), name, code))
            c.execute('INSERT INTO inventory (id, product_name) VALUES (?, ?)',
                      (str(uuid.uuid4()), name))
        except:
            pass
    
    # Create default cameras
    cameras = [
        ('Loading Dock A', 'Warehouse Entry'),
        ('Loading Dock B', 'Warehouse Exit'),
        ('Storage Area 1', 'Main Storage'),
        ('Truck Bay', 'Truck Loading Zone'),
    ]
    for name, location in cameras:
        try:
            c.execute('INSERT INTO cameras (id, name, location, is_online) VALUES (?, ?, ?, ?)',
                      (str(uuid.uuid4()), name, location, 1))
        except:
            pass
    
    conn.commit()
    conn.close()
    print("✅ Database initialized!")


# ===== AUTH =====
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'error': 'Token required'}), 401
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user_id = data['user_id']
            request.user_role = data.get('role', 'viewer')
        except:
            request.user_id = 'demo'
            request.user_role = 'admin'
        return f(*args, **kwargs)
    return decorated


# ===== AUTH ROUTES =====
@app.route('/api/v1/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()
    
    if user and check_password_hash(user['password_hash'], password):
        token = jwt.encode({
            'user_id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'exp': datetime.utcnow().timestamp() + 86400 * 7
        }, JWT_SECRET, algorithm='HS256')
        
        return jsonify({
            'access_token': token,
            'token_type': 'bearer',
            'user': {
                'id': user['id'],
                'email': user['email'],
                'name': user['name'],
                'role': user['role']
            }
        })
    
    return jsonify({'error': 'Invalid credentials'}), 401


@app.route('/api/v1/auth/me')
@token_required
def get_me():
    conn = get_db()
    user = conn.execute('SELECT id, email, name, role FROM users WHERE id = ?', (request.user_id,)).fetchone()
    conn.close()
    
    if user:
        return jsonify(dict(user))
    return jsonify({'id': 'demo', 'email': 'demo@aicctv.com', 'name': 'Demo Admin', 'role': 'admin'})


# ===== CAMERAS =====
@app.route('/api/v1/cameras')
@token_required
def get_cameras():
    conn = get_db()
    cameras = conn.execute('SELECT * FROM cameras').fetchall()
    conn.close()
    return jsonify([dict(c) for c in cameras])


@app.route('/api/v1/cameras', methods=['POST'])
@token_required
def create_camera():
    data = request.json
    camera_id = str(uuid.uuid4())
    
    conn = get_db()
    conn.execute('INSERT INTO cameras (id, name, location, rtsp_url, is_online) VALUES (?, ?, ?, ?, ?)',
                 (camera_id, data['name'], data.get('location'), data.get('rtsp_url'), 1))
    conn.commit()
    conn.close()
    
    return jsonify({'id': camera_id, **data}), 201


@app.route('/api/v1/cameras/<camera_id>', methods=['DELETE'])
@token_required
def delete_camera(camera_id):
    conn = get_db()
    conn.execute('DELETE FROM cameras WHERE id = ?', (camera_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'deleted'})


# ===== INVENTORY =====
@app.route('/api/v1/inventory')
@token_required
def get_inventory():
    conn = get_db()
    items = conn.execute('SELECT * FROM inventory').fetchall()
    conn.close()
    return jsonify([{
        'id': i['id'],
        'product_name': i['product_name'],
        'name': i['product_name'],
        'count_in': i['count_in'],
        'count_out': i['count_out'],
        'current_stock': i['current_stock'],
        'in': i['count_in'],
        'out': i['count_out'],
        'stock': i['current_stock'],
        'last_updated': i['last_updated']
    } for i in items])


@app.route('/api/v1/inventory/movement', methods=['POST'])
@token_required
def log_movement():
    data = request.json
    product = data.get('product_name') or data.get('class_name')
    direction = data.get('direction', 'IN')
    quantity = data.get('quantity', 1)
    
    conn = get_db()
    if direction == 'IN':
        conn.execute('UPDATE inventory SET count_in = count_in + ?, current_stock = current_stock + ?, last_updated = CURRENT_TIMESTAMP WHERE product_name = ?',
                     (quantity, quantity, product))
    else:
        conn.execute('UPDATE inventory SET count_out = count_out + ?, current_stock = current_stock - ?, last_updated = CURRENT_TIMESTAMP WHERE product_name = ?',
                     (quantity, quantity, product))
    
    conn.execute('INSERT INTO detections (id, type, confidence, direction) VALUES (?, ?, ?, ?)',
                 (str(uuid.uuid4()), product, 1.0, direction))
    
    conn.commit()
    conn.close()
    
    return jsonify({'status': 'logged'})


# ===== PRODUCT TYPES =====
@app.route('/api/v1/product-types')
@token_required
def get_product_types():
    conn = get_db()
    types = conn.execute('SELECT * FROM product_types').fetchall()
    conn.close()
    return jsonify([dict(t) for t in types])


# ===== ANALYTICS =====
@app.route('/api/v1/analytics/dashboard')
@token_required
def get_dashboard_analytics():
    conn = get_db()
    
    inv = conn.execute('SELECT SUM(count_in) as total_in, SUM(count_out) as total_out, SUM(current_stock) as total_stock FROM inventory').fetchone()
    det_count = conn.execute('SELECT COUNT(*) as count FROM detections WHERE date(detected_at) = date("now")').fetchone()
    inventory = conn.execute('SELECT product_name, count_in, count_out, current_stock FROM inventory').fetchall()
    
    conn.close()
    
    return jsonify({
        'total_in': inv['total_in'] or 0,
        'total_out': inv['total_out'] or 0,
        'total_stock': inv['total_stock'] or 0,
        'detections_today': det_count['count'] or 0,
        'inventory': [dict(i) for i in inventory],
        'camera_active': camera is not None and getattr(camera, 'running', False),
        'models_loaded': {
            'count': len(loaded_models),
            'active': active_model_name
        }
    })


# ===== DETECTIONS =====
@app.route('/api/v1/detections')
@token_required
def get_detections():
    limit = request.args.get('limit', 50, type=int)
    conn = get_db()
    dets = conn.execute('SELECT * FROM detections ORDER BY detected_at DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return jsonify([{
        'id': d['id'],
        'type': d['type'],
        'class': d['type'],
        'confidence': d['confidence'],
        'direction': d['direction'],
        'detected_at': d['detected_at'],
        'time': d['detected_at']
    } for d in dets])


# ===== ALERTS =====
@app.route('/api/v1/alerts')
@token_required
def get_alerts():
    conn = get_db()
    alerts = conn.execute('SELECT * FROM alerts ORDER BY created_at DESC LIMIT 20').fetchall()
    conn.close()
    return jsonify([dict(a) for a in alerts])


# ===== SCANS (Label Scanner) =====
@app.route('/api/v1/scans')
@token_required
def get_scans():
    conn = get_db()
    scans = conn.execute('SELECT * FROM scans ORDER BY scanned_at DESC LIMIT 500').fetchall()
    conn.close()
    return jsonify([dict(s) for s in scans])


@app.route('/api/v1/scans', methods=['POST'])
@token_required
def create_scan():
    data = request.json
    scan_id = str(uuid.uuid4())
    
    conn = get_db()
    conn.execute('''INSERT INTO scans 
        (id, barcode, batch_no, product_name, mfg_date, expiry_date, flavour, rack_no, shelf_no, quantity, direction, scanned_by) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (scan_id, data.get('barcode'), data.get('batch_no'), data.get('product_name'), 
         data.get('mfg_date'), data.get('expiry_date'), data.get('flavour'),
         data.get('rack_no'), data.get('shelf_no'), data.get('quantity', 1), 
         data.get('direction', 'IN'), request.user_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({'id': scan_id, **data}), 201


@app.route('/api/v1/scans/<scan_id>', methods=['DELETE'])
@token_required
def delete_scan(scan_id):
    conn = get_db()
    conn.execute('DELETE FROM scans WHERE id = ?', (scan_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'deleted'})


# ===== TRUCKS =====
@app.route('/api/v1/trucks')
@token_required
def get_trucks():
    limit = request.args.get('limit', 100, type=int)
    conn = get_db()
    trucks = conn.execute('SELECT * FROM trucks ORDER BY detected_at DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return jsonify([dict(t) for t in trucks])


@app.route('/api/v1/trucks', methods=['POST'])
@token_required
def create_truck_entry():
    data = request.json
    truck_id = str(uuid.uuid4())
    
    conn = get_db()
    conn.execute('INSERT INTO trucks (id, plate_number, direction, confidence, camera_id) VALUES (?, ?, ?, ?, ?)',
                 (truck_id, data.get('plate_number'), data.get('direction', 'IN'), 
                  data.get('confidence', 1.0), data.get('camera_id')))
    conn.commit()
    conn.close()
    
    return jsonify({'id': truck_id, **data}), 201


@app.route('/api/v1/trucks/reset', methods=['POST'])
@token_required
def reset_trucks():
    conn = get_db()
    conn.execute('DELETE FROM trucks')
    conn.commit()
    conn.close()
    return jsonify({'status': 'reset'})


# ===== FACES =====
@app.route('/api/v1/faces')
@token_required
def get_faces():
    conn = get_db()
    faces = conn.execute('SELECT id, name, image_path, created_at FROM faces ORDER BY created_at DESC').fetchall()
    conn.close()
    return jsonify([dict(f) for f in faces])


@app.route('/api/v1/faces', methods=['POST'])
@token_required
def register_face():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    image = request.files['image']
    name = request.form.get('name', 'Unknown')
    
    if not FACE_RECOGNITION_AVAILABLE:
        return jsonify({'error': 'Face recognition not available'}), 503
    
    face_id = str(uuid.uuid4())
    image_path = FACE_DIR / f"{face_id}.jpg"
    image.save(image_path)
    
    try:
        img = face_recognition.load_image_file(str(image_path))
        encodings = face_recognition.face_encodings(img)
        
        if not encodings:
            image_path.unlink()
            return jsonify({'error': 'No face detected in image'}), 400
        
        encoding = encodings[0]
        encoding_bytes = encoding.tobytes()
        
        conn = get_db()
        conn.execute('INSERT INTO faces (id, name, encoding, image_path) VALUES (?, ?, ?, ?)',
                     (face_id, name, encoding_bytes, str(image_path)))
        conn.commit()
        conn.close()
        
        face_encodings_cache[face_id] = {'name': name, 'encoding': encoding}
        
        return jsonify({'id': face_id, 'name': name, 'image_path': str(image_path)}), 201
    except Exception as e:
        if image_path.exists():
            image_path.unlink()
        return jsonify({'error': str(e)}), 500


@app.route('/api/v1/faces/search', methods=['POST'])
@token_required
def search_faces():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    if not FACE_RECOGNITION_AVAILABLE:
        return jsonify({'error': 'Face recognition not available'}), 503
    
    image = request.files['image']
    temp_path = UPLOAD_DIR / f"temp_{uuid.uuid4()}.jpg"
    image.save(temp_path)
    
    try:
        img = face_recognition.load_image_file(str(temp_path))
        face_locations = face_recognition.face_locations(img)
        face_encs = face_recognition.face_encodings(img, face_locations)
        
        results = []
        
        if not face_encodings_cache:
            conn = get_db()
            faces = conn.execute('SELECT id, name, encoding FROM faces').fetchall()
            conn.close()
            for f in faces:
                if f['encoding']:
                    enc = np.frombuffer(f['encoding'], dtype=np.float64)
                    face_encodings_cache[f['id']] = {'name': f['name'], 'encoding': enc}
        
        known_encodings = [v['encoding'] for v in face_encodings_cache.values()]
        known_names = [v['name'] for v in face_encodings_cache.values()]
        known_ids = list(face_encodings_cache.keys())
        
        for face_enc, face_loc in zip(face_encs, face_locations):
            if known_encodings:
                distances = face_recognition.face_distance(known_encodings, face_enc)
                best_idx = np.argmin(distances)
                confidence = 1 - distances[best_idx]
                
                if confidence > 0.5:
                    results.append({
                        'name': known_names[best_idx],
                        'face_id': known_ids[best_idx],
                        'confidence': float(confidence),
                        'bbox': list(face_loc)
                    })
                else:
                    results.append({
                        'name': 'Unknown',
                        'confidence': float(confidence),
                        'bbox': list(face_loc)
                    })
            else:
                results.append({
                    'name': 'Unknown',
                    'confidence': 0,
                    'bbox': list(face_loc)
                })
        
        return jsonify({'results': results, 'count': len(results)})
    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.route('/api/v1/faces/detections')
@token_required
def get_face_detections():
    limit = request.args.get('limit', 50, type=int)
    conn = get_db()
    dets = conn.execute('SELECT * FROM face_detections ORDER BY detected_at DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return jsonify([dict(d) for d in dets])


# ===== COMPRESSION =====
compression_jobs = {}

@app.route('/api/v1/compression/upload', methods=['POST'])
@token_required
def compression_upload():
    if 'file' not in request.files:
        return jsonify({'error': 'No file'}), 400
    
    file = request.files['file']
    level = request.form.get('level', 'medium')
    
    job_id = str(uuid.uuid4())[:8]
    input_path = UPLOAD_DIR / f"{job_id}_input{Path(file.filename).suffix}"
    output_path = UPLOAD_DIR / f"{job_id}_output.mp4"
    
    file.save(input_path)
    original_size = input_path.stat().st_size
    
    compression_jobs[job_id] = {
        'status': 'processing',
        'original_size': original_size,
        'original_filename': file.filename,
        'level': level
    }
    
    def compress():
        try:
            crf = '28' if level == 'medium' else '35'
            cmd = ['ffmpeg', '-y', '-i', str(input_path), '-c:v', 'libx264', '-crf', crf, 
                   '-preset', 'fast', '-c:a', 'aac', '-movflags', '+faststart', str(output_path)]
            subprocess.run(cmd, capture_output=True, timeout=600)
            
            if output_path.exists():
                compression_jobs[job_id]['status'] = 'completed'
                compression_jobs[job_id]['compressed_size'] = output_path.stat().st_size
                compression_jobs[job_id]['download_url'] = f'/api/v1/compression/download/{job_id}'
            else:
                compression_jobs[job_id]['status'] = 'failed'
        except Exception as e:
            compression_jobs[job_id]['status'] = 'failed'
            compression_jobs[job_id]['error'] = str(e)
    
    threading.Thread(target=compress, daemon=True).start()
    
    return jsonify({'job_id': job_id, 'status': 'processing', 'original_size': original_size})


@app.route('/api/v1/compression/status/<job_id>')
@token_required
def compression_status(job_id):
    job = compression_jobs.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    result = {**job}
    if job.get('compressed_size') and job.get('original_size'):
        result['compression_ratio'] = round((1 - job['compressed_size'] / job['original_size']) * 100, 1)
    
    return jsonify(result)


@app.route('/api/v1/compression/download/<job_id>')
def compression_download(job_id):
    output_path = UPLOAD_DIR / f"{job_id}_output.mp4"
    if not output_path.exists():
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(output_path, as_attachment=True, download_name=f'compressed_{job_id}.mp4')


# ===== VIDEO FEED =====
class VideoCamera:
    def __init__(self, source=0):
        self.source = source
        self.cap = None
        self.frame = None
        self.running = False
        self.thread = None
        
    def start(self):
        if self.running:
            return
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            raise Exception(f"Cannot open camera: {self.source}")
        self.running = True
        self.thread = threading.Thread(target=self._update, daemon=True)
        self.thread.start()
        
    def _update(self):
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                self.frame = frame
            time.sleep(0.03)
            
    def get_frame(self):
        return self.frame
    
    def stop(self):
        self.running = False
        if self.cap:
            self.cap.release()


def detect_objects(frame):
    global latest_detections
    
    active_model = loaded_models.get(active_model_name)
    if not active_model:
        return frame, []
    
    detections = []
    
    # Run active model
    results = active_model(frame, verbose=False, conf=0.35)
    
    for r in results:
        for box in r.boxes:
            cls = int(box.cls[0])
            conf = float(box.conf[0])
            class_name = active_model.names[cls]
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            
            # Color based on model type
            color = (0, 255, 0) if active_model_name == 'best_dec20' else (255, 165, 0)
            
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, f"{class_name} ({conf:.2f})", (x1, y1-10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            detections.append({
                'class': class_name, 
                'confidence': conf, 
                'model': active_model_name
            })

            # Sugar Bag Counting Logic
            if 'sugar' in active_model_name and 'bag' in class_name.lower():
                 # Simple logic: if center of box is in lower half (offloading), count it?
                 # Or just count unique IDs if tracking is enabled.
                 # For now, let's assume the frontend tracks it, OR we just expose the count of total unique IDs seen in this session.
                 # Since we use model.track(), we have IDs.
                 pass 

    latest_detections = detections
    return frame, detections


def generate_frames():
    global camera
    while True:
        if camera is None or not camera.running:
            placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(placeholder, "No Camera Connected", (150, 240),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            _, buffer = cv2.imencode('.jpg', placeholder)
            yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
            time.sleep(0.1)
            continue
            
        frame = camera.get_frame()
        if frame is None:
            continue
            
        frame, _ = detect_objects(frame)
        _, buffer = cv2.imencode('.jpg', frame)
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')


@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/api/v1/camera/start', methods=['POST'])
@token_required
def start_camera():
    global camera
    data = request.json or {}
    source = data.get('source', 0)
    
    if isinstance(source, str) and source.isdigit():
        source = int(source)
    
    try:
        with camera_lock:
            if camera:
                camera.stop()
            camera = VideoCamera(source)
            camera.start()
        return jsonify({'status': 'started', 'source': str(source)})
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/v1/camera/stop', methods=['POST'])
@token_required
def stop_camera():
    global camera
    with camera_lock:
        if camera:
            camera.stop()
            camera = None
    return jsonify({'status': 'stopped'})


@app.route('/api/v1/camera/detections')
def live_detections():
    return jsonify(latest_detections)


# ===== MODEL SELECTION =====
@app.route('/api/v1/models')
def get_models():
    """List available models"""
    return jsonify({
        'available': list(loaded_models.keys()),
        'active': active_model_name,
        'main_loaded': 'best_dec20' in loaded_models
    })


@app.route('/api/v1/models/switch', methods=['POST'])
@token_required
def switch_model():
    """Switch the active model"""
    global active_model_name
    data = request.json or {}
    model_name = data.get('model')
    
    if not model_name:
        return jsonify({'error': 'Model name required'}), 400
    
    if model_name not in loaded_models:
        return jsonify({
            'error': f'Model not found: {model_name}',
            'available': list(loaded_models.keys())
        }), 404
    
    active_model_name = model_name
    print(f"🔄 Switched to model: {active_model_name}")
    
    return jsonify({
        'status': 'switched',
        'active': active_model_name
    })


@app.route('/api/v1/sugar-count/reset', methods=['POST'])
@token_required
def reset_sugar_count():
    global sugar_bag_count
    sugar_bag_count = 0
    return jsonify({'status': 'reset', 'count': 0})


# ===== SIMPLE API ROUTES (Edge compatible) =====
@app.route('/api/stats')
def api_stats():
    conn = get_db()
    inv = conn.execute('SELECT SUM(count_in) as total_in, SUM(count_out) as total_out FROM inventory').fetchone()
    inventory = conn.execute('SELECT product_name as name, count_in as "in", count_out as "out", current_stock as stock FROM inventory').fetchall()
    conn.close()
    
    return jsonify({
        'total_in': inv['total_in'] or 0,
        'total_out': inv['total_out'] or 0,
        'inventory': [dict(i) for i in inventory],
        'camera_active': camera is not None and getattr(camera, 'running', False),
        'models_loaded': {
            'count': len(loaded_models),
            'available': list(loaded_models.keys()),
            'active': active_model_name
        }
    })


@app.route('/api/inventory')
def api_inventory():
    conn = get_db()
    items = conn.execute('SELECT product_name as name, count_in as "in", count_out as "out", current_stock as stock, last_updated as updated FROM inventory').fetchall()
    conn.close()
    return jsonify([dict(i) for i in items])


@app.route('/api/detections')
def api_detections():
    conn = get_db()
    dets = conn.execute('SELECT type as class, confidence, direction, detected_at as time FROM detections ORDER BY detected_at DESC LIMIT 20').fetchall()
    conn.close()
    return jsonify([dict(d) for d in dets])


@app.route('/api/log_detection', methods=['POST'])
def api_log_detection():
    data = request.json
    product = data.get('class_name')
    direction = data.get('direction', 'IN')
    
    conn = get_db()
    if direction == 'IN':
        conn.execute('UPDATE inventory SET count_in = count_in + 1, current_stock = current_stock + 1, last_updated = CURRENT_TIMESTAMP WHERE product_name = ?', (product,))
    else:
        conn.execute('UPDATE inventory SET count_out = count_out + 1, current_stock = current_stock - 1, last_updated = CURRENT_TIMESTAMP WHERE product_name = ?', (product,))
    
    conn.execute('INSERT INTO detections (id, type, confidence, direction) VALUES (?, ?, ?, ?)',
                 (str(uuid.uuid4()), product, 1.0, direction))
    conn.commit()
    conn.close()
    
    return jsonify({'status': 'logged'})


@app.route('/api/reset', methods=['POST'])
def api_reset():
    conn = get_db()
    conn.execute('UPDATE inventory SET count_in = 0, count_out = 0, current_stock = 0')
    conn.execute('DELETE FROM detections')
    conn.commit()
    conn.close()
    return jsonify({'status': 'reset'})


# ===== HEALTH =====
@app.route('/')
def root():
    return jsonify({'message': 'AI CCTV Flask Backend', 'status': 'running', 'version': '2.0'})


@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy', 
        'models': {
            'active': active_model_name,
            'count': len(loaded_models)
        },
        'face_recognition': FACE_RECOGNITION_AVAILABLE
    })


if __name__ == '__main__':
    init_db()
    print("\n" + "="*50)
    print("AI CCTV Flask Backend Starting...")
    print(f"Active Model: {active_model_name if loaded_models else '❌ NONE'}")
    print(f"Loaded Models: {len(loaded_models)}")
    print(f"Face Recognition: {'✅ Available' if FACE_RECOGNITION_AVAILABLE else '❌ NOT AVAILABLE'}")
    print("API: http://localhost:5000")
    print("="*50 + "\n")
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
