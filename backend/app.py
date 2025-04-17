import os
from flask import Flask, request, jsonify, abort, send_from_directory
from dotenv import load_dotenv
load_dotenv()
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta, timezone
from flask_cors import CORS
import jwt
import pyotp
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import base64

app = Flask(__name__, static_folder='../dist', static_url_path='/')
# Enable CORS for all origins in both development and production
CORS(app, resources={
    r"/api/*": {
        # "origins": ["http://localhost:3000", "http://127.0.0.1:3000"]
        "origins": ["http://localhost:8080", "http://127.0.0.1:8080", "http://192.168.99.167:8080"]
    }
})
migrate = Migrate()
# Load config from environment or config file
app.config.from_pyfile('config.py', silent=True)
app.config['SQLALCHEMY_DATABASE_URI'] = app.config.get(
    'SQLALCHEMY_DATABASE_URI', 'sqlite:///auth.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = app.config.get(
    'SECRET_KEY', 'your-secret-key-here')  # Will be overridden in production
db = SQLAlchemy(app)
migrate.init_app(app, db)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True) # Added in a previous migration
    devices = db.relationship('Device', backref='owner', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Device Model
class Device(db.Model):
    id = db.Column(db.String(80), primary_key=True) # Using string ID like in frontend mock
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(80), nullable=False)
    hashed_device_key = db.Column(db.String(256), nullable=False) # Store hashed device key
    secret = db.Column(db.String(256), nullable=True) # TOTP secret
    description = db.Column(db.String(200))
    status = db.Column(db.String(10), default='active') # 'active' or 'inactive'
    qr_refresh_time = db.Column(db.Integer, default=60)
    max_validations = db.Column(db.Integer, default=5)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    address = db.Column(db.String(200))
    last_validation = db.Column(db.DateTime, nullable=True)
    image = db.Column(db.Text, nullable=True) # Store image as base64 data URL or path

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'qrRefreshTime': self.qr_refresh_time,
            'maxValidations': self.max_validations,
            'location': [self.latitude, self.longitude] if self.latitude is not None and self.longitude is not None else None,
            'address': self.address,
            'lastValidation': self.last_validation.isoformat() if self.last_validation else None,
            'image': self.image,
            'secret': self.secret,
            'hashed_device_key': self.hashed_device_key
        }

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    
    user = User(username=data['username'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'User created successfully'}), 201

def create_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=24)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        abort(401, description='Token expired')
    except jwt.InvalidTokenError:
        abort(401, description='Invalid token')

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    
    if not user or not user.check_password(data['password']):
        return jsonify({'message': 'Invalid username or password'}), 401
    
    token = create_token(user.id)
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user_id': user.id
    }), 200

@app.route('/api/logout', methods=['POST'])
def logout():
    # In a real app, invalidate the token
    return jsonify({'message': 'Logout successful'}), 200

# --- Device API Endpoints ---

@app.route('/api/devices', methods=['GET'])
def get_devices():
    devices = Device.query.join(User).all()
    return jsonify([{
        **device.to_dict(),
        'owner': device.owner.username
    } for device in devices]), 200

@app.route('/api/my-devices', methods=['GET'])
def get_my_devices():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)
    
    devices = Device.query.filter_by(user_id=user_id).all()
    return jsonify([device.to_dict() for device in devices]), 200

# Get a single device
@app.route('/api/devices/<string:device_id>', methods=['GET'])
def get_device(device_id):
    device = Device.query.get(device_id)
    if device is None:
        abort(404, description="Device not found")
    return jsonify(device.to_dict()), 200

@app.route('/api/devices', methods=['POST'])
def add_device():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    data = request.get_json()
    if not data:
        abort(400, description="Invalid JSON data")

    # Basic validation
    required_fields = ['id', 'name', 'location', 'hashed_device_key']
    if not all(field in data for field in required_fields):
        abort(400, description=f"Missing required fields: {required_fields}")

    if Device.query.get(data['id']):
         abort(400, description=f"Device with ID {data['id']} already exists")

    user = User.query.get(user_id)
    if not user:
        abort(404, description="User not found")


    new_device = Device(
        id=data['id'],
        user_id=user_id,
        name=data['name'],
        hashed_device_key=data['hashed_device_key'], # Use the pre-hashed key from frontend
        secret=data.get('secret'), # Store the raw key in secret column
        description=data.get('description'),
        status=data.get('status', 'active'),
        qr_refresh_time=data.get('qrRefreshTime', 60),
        max_validations=data.get('maxValidations', 5),
        latitude=data['location'][0] if data.get('location') and len(data['location']) == 2 else None,
        longitude=data['location'][1] if data.get('location') and len(data['location']) == 2 else None,
        address=data.get('address'),
        image=data.get('image')
        # last_validation is initially null
    )
    db.session.add(new_device)
    db.session.commit()
    return jsonify(new_device.to_dict()), 201

@app.route('/api/devices/<string:device_id>', methods=['PUT'])
def update_device(device_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    device = Device.query.get(device_id)
    if device is None:
        abort(404, description="Device not found")
    
    if device.user_id != user_id:
        abort(403, description="Not authorized to update this device")

    data = request.get_json()
    if not data:
        abort(400, description="Invalid JSON data")

    device.name = data.get('name', device.name)
    device.description = data.get('description', device.description)
    device.status = data.get('status', device.status)
    device.qr_refresh_time = data.get('qrRefreshTime', device.qr_refresh_time)
    device.max_validations = data.get('maxValidations', device.max_validations)
    if 'location' in data and data['location'] and len(data['location']) == 2:
        device.latitude = data['location'][0]
        device.longitude = data['location'][1]
    device.address = data.get('address', device.address)
    device.image = data.get('image', device.image)
    if 'secret' in data:
        device.secret = data['secret']
    # last_validation is usually updated by a different process/endpoint

    db.session.commit()
    return jsonify(device.to_dict()), 200

import hashlib

def decrypt_totp(secret_key, cipher_text):
    # Use the raw secret key directly (no hashing needed)
    # Pad/truncate to 32 bytes for AES
    key_bytes = secret_key.encode('utf-8').ljust(32, b'\0')[:32]
    iv_and_ciphertext = base64.urlsafe_b64decode(cipher_text)
    iv = iv_and_ciphertext[:16]
    ciphertext = iv_and_ciphertext[16:]
    cipher = AES.new(key_bytes, AES.MODE_CBC, iv)
    plain_text = unpad(cipher.decrypt(ciphertext), AES.block_size)
    return plain_text.decode('utf-8')

@app.route('/api/validate/<string:device_id>/<string:data_enc>', methods=['GET'])
def validate_totp(device_id, data_enc):
    device = Device.query.get(device_id)
    if not device:
        abort(404, description="Device not found")
    if not device.secret:
        abort(400, description="Device missing secret key")

    try:
        decrypted_data = decrypt_totp(device.secret, data_enc)
    except:
        abort(400, description="Decryption error")

    try:
        totp_number, esp_lat, esp_lng = decrypted_data.split('|')
        esp_lat = float(esp_lat)
        esp_lng = float(esp_lng)
    except (ValueError, IndexError):
        abort(400, description="Invalid data format")

    # Verify TOTP using the raw secret key from the secret column
    if not device.secret:
        abort(400, description="Device missing secret key")
    totp = pyotp.TOTP(device.secret)
    if not totp.verify(totp_number):
        abort(400, description="Invalid TOTP")

    # Update device last validation time
    device.last_validation = datetime.now(timezone.utc)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'device_id': device_id,
        'location': [esp_lat, esp_lng]
    }), 200

@app.route('/api/devices/<string:device_id>', methods=['DELETE'])
def delete_device(device_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    device = Device.query.get(device_id)
    if device is None:
        abort(404, description="Device not found")
    
    if device.user_id != user_id:
        abort(403, description="Not authorized to delete this device")

    db.session.delete(device)
    db.session.commit()
    return jsonify({'message': 'Device deleted successfully'}), 200


@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    with app.app_context():
        # Only drop tables in debug mode
        if app.debug:
            db.drop_all()
        db.create_all()
    
    if os.environ.get('FLASK_ENV') == 'production':
        app.run(host='0.0.0.0', port=5000)
    else:
        app.run(host='0.0.0.0', port=5000, debug=True)
