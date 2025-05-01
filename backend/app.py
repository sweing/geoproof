import os
from flask import Flask, request, jsonify, abort, send_from_directory, redirect
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
import uuid

app = Flask(__name__)
# Configure CORS based on environment
if os.environ.get('FLASK_ENV') == 'production':
    CORS(app, resources={
        r"/api/*": {
            "origins": [
                "http://localhost:5173", 
                "http://127.0.0.1:5173",
                "http://localhost:5050",
                "http://127.0.0.1:5050",
                "http://localhost:8080",
                "http://127.0.0.1:8080",
                "https://geoproof.org",
                "https://www.geoproof.org"
            ]
        }
    })
else:
    # Allow all origins in development
    CORS(app)
migrate = Migrate()
# Load environment-specific config
if os.environ.get('FLASK_ENV') == 'production':
    app.config.from_pyfile('config.production.py', silent=True)
else:
    app.config.from_pyfile('config.development.py', silent=True)

# Set default config values if not specified
app.config.setdefault('SQLALCHEMY_DATABASE_URI', 'sqlite:///auth.db')
app.config.setdefault('SQLALCHEMY_TRACK_MODIFICATIONS', False)
app.config.setdefault('SECRET_KEY', 'fallback-secret-key')
db = SQLAlchemy(app)
migrate.init_app(app, db)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True) # Added in a previous migration
    full_name = db.Column(db.Text, nullable=True)
    bio = db.Column(db.Text, nullable=True)
    location = db.Column(db.Text, nullable=True)
    collection_address = db.Column(db.Text, nullable=True) # Add collection_address column
    devices = db.relationship('Device', backref='owner', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'full_name': self.full_name,
            'bio': self.bio,
            'location': self.location,
            'collection_address': self.collection_address
        }

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Transaction Model
class Transaction(db.Model):
    __tablename__ = 'transactions' # Explicitly set table name
    id = db.Column(db.Integer, primary_key=True)
    validation_id = db.Column(db.Integer, db.ForeignKey('validation.id'), nullable=False)
    token_address = db.Column(db.Text, nullable=False) # Removed unique=True
    timestamp = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    sender = db.Column(db.Text, nullable=True) # Add sender column
    receiver = db.Column(db.Text, nullable=True) # Add receiver column
    status = db.Column(db.String(20), nullable=True) # Add status column

    def to_dict(self):
        return {
            'id': self.id,
            'validation_id': self.validation_id,
            'token_address': self.token_address,
            'timestamp': self.timestamp.isoformat(),
            'sender': self.sender,
            'receiver': self.receiver,
            'status': self.status
        }

# Device Model
class Validation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(80), db.ForeignKey('device.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)
    status = db.Column(db.String(20), nullable=False) # 'success' or 'failure'
    device_latitude = db.Column(db.Float)
    device_longitude = db.Column(db.Float)
    error_message = db.Column(db.String(200))
    ip_address = db.Column(db.String(45)) # IPv6 max length is 45 chars

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'user_id': self.user_id,
            'timestamp': self.timestamp.isoformat(),
            'status': self.status,
            'location': [self.device_latitude, self.device_longitude] if self.device_latitude and self.device_longitude else None,
            'error_message': self.error_message,
            'ip_address': self.ip_address
        }

class Rating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(80), db.ForeignKey('device.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    rating = db.Column(db.Integer, nullable=False) # 1-5 stars
    timestamp = db.Column(db.DateTime, default=datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        db.UniqueConstraint('device_id', 'user_id', name='unique_user_device_rating'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'user_id': self.user_id,
            'rating': self.rating,
            'timestamp': self.timestamp.isoformat()
        }

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
    device_address = db.Column(db.Text, nullable=True) # Add device_address column

    def to_dict(self):
        return {
            'id': self.id,
            'device_address': self.device_address, # Include device_address in to_dict
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'qrRefreshTime': self.qr_refresh_time,
            'maxValidations': self.max_validations,
            'location': [self.latitude, self.longitude] if self.latitude is not None and self.longitude is not None else None,
            'address': self.address,
            'lastValidation': self.last_validation.isoformat() if self.last_validation else None,
            'image': self.image,
            #'secret': "secret!", # self.secret,
            'hashed_device_key': self.hashed_device_key
        }

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    
    user = User(username=data['username'])
    user.set_password(data['password'])
    user.collection_address = str(uuid.uuid4()) # Generate a unique collection address
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
    devices_data = []
    for device in devices:
        # Query for the last 3 successful validations for this device
        recent_validations = Validation.query.filter_by(
            device_id=device.id,
            status='success' # Only successful ones
        ).order_by(
            Validation.timestamp.desc() # Most recent first
        ).limit(3).all()

        # Extract timestamps as ISO strings
        recent_validation_timestamps = [v.timestamp.isoformat() for v in recent_validations]

        # Calculate average rating
        ratings = Rating.query.filter_by(device_id=device.id).all()
        avg_rating = None
        if ratings:
            avg_rating = sum(r.rating for r in ratings) / len(ratings)

        device_dict = device.to_dict()
        device_dict.update({
            'owner': device.owner.username,
            'recentValidations': recent_validation_timestamps,
            'averageRating': avg_rating,
            'secret': device.secret,
            'ratingCount': len(ratings)
        })
        devices_data.append(device_dict)

    return jsonify(devices_data), 200

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
        image=data.get('image'),
        device_address=str(uuid.uuid4()) # Generate a unique device address
        # last_validation is initially null
    )
    db.session.add(new_device)
    
    # Create initial 5-star rating from owner
    initial_rating = Rating(
        device_id=new_device.id,
        user_id=user_id,
        rating=5
    )
    db.session.add(initial_rating)
    
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

@app.route('/api/validate/<path:code>', methods=['GET'])
def validate_totp(code):
    # Split code into device_id and data_enc parts
    parts = code.split('/')
    if len(parts) != 2:
        abort(400, description="Invalid validation code format")
    device_id, data_enc = parts
    print(f"Validation attempt for device {device_id}")  # Debug logging
    
    # Require authentication
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Authentication required')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)
    
    device = Device.query.get(device_id)
    if not device:
        print("Device not found")  # Debug logging
        validation = Validation(
            device_id=device_id,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
            status='failure',
            error_message='Device not found',
            ip_address=request.remote_addr
        )
        db.session.add(validation)
        try:
            db.session.commit()
            print("Saved validation record for missing device")  # Debug logging
        except Exception as e:
            print(f"Failed to save validation record: {str(e)}")  # Debug logging
            db.session.rollback()
        abort(404, description="Device not found")
    
    if not device.secret:
        print("Device missing secret key")  # Debug logging
        validation = Validation(
            device_id=device_id,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
            status='failure',
            error_message='Device missing secret key',
            ip_address=request.remote_addr
        )
        db.session.add(validation)
        try:
            db.session.commit()
            print("Saved validation record for missing secret")  # Debug logging
        except Exception as e:
            print(f"Failed to save validation record: {str(e)}")  # Debug logging
            db.session.rollback()
        abort(400, description="Device missing secret key")

    try:
        print(f"Attempting decryption with secret: {device.secret}")  # Debug logging
        decrypted_data = decrypt_totp(device.secret, data_enc)
        print(f"Decrypted data: {decrypted_data}")  # Debug logging
    except Exception as e:
        print(f"Decryption failed: {str(e)}")  # Debug logging
        validation = Validation(
            device_id=device_id,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
            status='failure',
            error_message=f'Decryption error: {str(e)}',
            ip_address=request.remote_addr
        )
        db.session.add(validation)
        try:
            db.session.commit()
            print("Saved validation record for decryption error")  # Debug logging
        except Exception as e:
            print(f"Failed to save validation record: {str(e)}")  # Debug logging
            db.session.rollback()
        abort(400, description="Decryption error")

    try:
        print(f"Parsing decrypted data: {decrypted_data}")  # Debug logging
        totp_number, esp_lat, esp_lng = decrypted_data.split('|')
        esp_lat = float(esp_lat)
        esp_lng = float(esp_lng)
        print(f"Parsed TOTP: {totp_number}, Lat: {esp_lat}, Lng: {esp_lng}")  # Debug logging
    except (ValueError, IndexError) as e:
        print(f"Data parsing failed: {str(e)}")  # Debug logging
        validation = Validation(
            device_id=device_id,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
            status='failure',
            error_message=f'Invalid data format: {str(e)}',
            ip_address=request.remote_addr
        )
        db.session.add(validation)
        try:
            db.session.commit()
            print("Saved validation record for data format error")  # Debug logging
        except Exception as e:
            print(f"Failed to save validation record: {str(e)}")  # Debug logging
            db.session.rollback()
        abort(400, description="Invalid data format")

    # Verify TOTP using the raw secret key from the secret column
    totp = pyotp.TOTP(device.secret)
    print(f"Verifying TOTP. Received: {totp_number}, Expected: {totp.now()}, Time window: {totp.interval}") # More detailed logging
    if not totp.verify(totp_number):
        print("TOTP verification failed")  # Debug logging
        validation = Validation(
            device_id=device_id,
            user_id=user_id,
            timestamp=datetime.now(timezone.utc),
            status='failure',
            error_message='Invalid TOTP',
            ip_address=request.remote_addr
        )
        db.session.add(validation)
        try:
            db.session.commit()
            print("Saved validation record for invalid TOTP")  # Debug logging
        except Exception as e:
            print(f"Failed to save validation record: {str(e)}")  # Debug logging
            db.session.rollback()
        # Return a failure status and message
        return jsonify({
            'status': 'failure',
            'device_id': device_id,
            'error_message': 'Invalid TOTP'
        }), 400

    # Create successful validation record
    print("Creating successful validation record")  # Debug logging
    validation = Validation(
        device_id=device_id,
        user_id=user_id,
        timestamp=datetime.now(timezone.utc),
        status='success',
        device_latitude=esp_lat,
        device_longitude=esp_lng,
        ip_address=request.remote_addr
    )
    db.session.add(validation)
    db.session.commit() # Commit validation to get its ID

    # Update device last validation time
    device.last_validation = datetime.now(timezone.utc)

    # Create a new transaction record
    # Get the user's collection address
    user = User.query.get(user_id)
    if not user or not user.collection_address:
        print(f"User with ID {user_id} not found or has no collection address")
        # Decide how to handle this case - maybe log an error and continue without creating a transaction
        # For now, we'll just print and continue
        pass # Or return an error if transactions are mandatory

    new_transaction = Transaction(
        validation_id=validation.id,
        token_address=str(uuid.uuid4()), # Generate a unique token address
        timestamp=datetime.now(timezone.utc),
        sender=device.device_address if device else None, # Sender is the device address
        receiver=user.collection_address if user else None, # Receiver is the user's collection address
        status='mint' # Set status to "mint" for validation transactions
    )
    db.session.add(new_transaction)

    try:
        db.session.commit()
        print("Successfully saved validation, updated device, and created transaction")  # Debug logging
    except Exception as e:
        print(f"Failed to save validation or transaction: {str(e)}")  # Debug logging
        db.session.rollback()

    return jsonify({
        'status': 'success',
        'device_id': device_id,
        'location': [esp_lat, esp_lng],
        'validation_id': validation.id,
        'token_address': new_transaction.token_address # Include token address in response
    }), 200

@app.route('/api/validations/<string:device_id>', methods=['GET'])
def get_validations(device_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    device = Device.query.get(device_id)
    if not device:
        abort(404, description="Device not found")
    
    if device.user_id != user_id:
        abort(403, description="Not authorized to view this device's validations")

    validations = Validation.query.filter_by(device_id=device_id).order_by(Validation.timestamp.desc()).all()
    return jsonify([v.to_dict() for v in validations]), 200

@app.route('/api/my-validations', methods=['GET'])
def get_my_validations():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    # Get all validations for this user
    validations = Validation.query.filter_by(
        user_id=user_id
    ).order_by(Validation.timestamp.desc()).all()
    
    return jsonify([v.to_dict() for v in validations]), 200

@app.route('/api/my-transactions', methods=['GET'])
def get_my_transactions():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    # Get the authenticated user's collection address
    user = User.query.get(user_id)
    if not user or not user.collection_address:
        print(f"User with ID {user_id} not found or has no collection address for fetching transactions")
        return jsonify([]), 200 # Return empty list if user or collection not found

    # Get the latest transaction for each token
    latest_transactions_subquery = db.session.query(
        Transaction.token_address,
        db.func.max(Transaction.timestamp).label('latest_timestamp')
    ).group_by(Transaction.token_address).subquery()

    # Join with the transactions table to get the full latest transaction records
    latest_transactions = db.session.query(Transaction).join(
        latest_transactions_subquery,
        (Transaction.token_address == latest_transactions_subquery.c.token_address) &
        (Transaction.timestamp == latest_transactions_subquery.c.latest_timestamp)
    )

    # Filter the latest transactions to include only those where the user is the receiver and status is 'mint' or 'transferred'
    user_owned_tokens = latest_transactions.filter(
        (Transaction.receiver == user.collection_address) &
        ((Transaction.status == 'mint') | (Transaction.status == 'transferred'))
    ).order_by(Transaction.timestamp.desc()).all()


    return jsonify([t.to_dict() for t in user_owned_tokens]), 200

@app.route('/api/send-token', methods=['POST'])
def send_token():
    print(f"Received send-token request: {request.get_json()}") # Add logging for received data
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    data = request.get_json()
    if not data or 'recipient_address' not in data or 'token_addresses' not in data or not isinstance(data['token_addresses'], list):
        abort(400, description="Missing recipient_address or token_addresses (as a list)")

    recipient_address = data['recipient_address']
    token_addresses = data['token_addresses']

    # Get the authenticated user's collection address
    sender_user = User.query.get(user_id)
    if not sender_user or not sender_user.collection_address:
        abort(400, description="Sender user not found or has no collection address")

    # Check if recipient address is valid (e.g., exists as a user collection address)
    recipient_user = User.query.filter_by(collection_address=recipient_address).first()
    if not recipient_user:
        abort(400, description="Recipient address not found")

    # Use a database transaction for atomicity
    try:
        sent_count = 0
        for token_address in token_addresses:
            # Verify that the sender currently owns the token
            # Find the latest transaction for this token
            latest_transaction = Transaction.query.filter_by(
                token_address=token_address
            ).order_by(Transaction.timestamp.desc()).first()

            # Check if the latest transaction's receiver is the sender and the status is 'mint' or 'transferred'
            if not latest_transaction or latest_transaction.receiver != sender_user.collection_address or (latest_transaction.status != 'mint' and latest_transaction.status != 'transferred'):
                 # If any token is not found, not owned, or already transferred, rollback the entire transaction
                 db.session.rollback()
                 abort(400, description=f"Token {token_address} not found or not owned by sender or already transferred")

            # The original transaction to update is the latest one where the sender is the receiver
            original_transaction_to_update = latest_transaction

            # Create a new transaction for the transfer
            transfer_transaction = Transaction(
                validation_id=latest_transaction.validation_id, # Link to the original validation
                token_address=token_address,
                timestamp=datetime.now(timezone.utc),
                sender=sender_user.collection_address,
                receiver=recipient_address,
                status='transferred' # Set status to "transferred"
            )
            db.session.add(transfer_transaction)

            # Update the status of the original transaction to indicate it's been transferred
            latest_transaction.status = 'spent' # Or another status indicating it's no longer in the sender's collection
            sent_count += 1

        db.session.commit()
        return jsonify({'message': f'{sent_count} token(s) sent successfully'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Failed to create transfer transaction: {str(e)}")
        abort(500, description="Failed to send token")


@app.route('/api/all-validations', methods=['GET'])
def get_all_validations():
    # Get all validations, ordered by timestamp descending, and join with User to get username
    validations = db.session.query(Validation, User.username)\
        .join(User, Validation.user_id == User.id)\
        .order_by(Validation.timestamp.desc())\
        .all()
    
    # Format the results to include username
    validations_data = []
    for validation, username in validations:
        validation_dict = validation.to_dict()
        validation_dict['username'] = username
        validations_data.append(validation_dict)

    return jsonify(validations_data), 200


@app.route('/api/ratings/<string:device_id>', methods=['POST'])
def submit_rating(device_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    data = request.get_json()
    if not data or 'rating' not in data:
        abort(400, description="Missing rating value")

    rating_value = data['rating']
    if not isinstance(rating_value, int) or rating_value < 1 or rating_value > 5:
        abort(400, description="Rating must be an integer between 1 and 5")

    device = Device.query.get(device_id)
    if not device:
        abort(404, description="Device not found")

    # Check if user already rated this device
    existing_rating = Rating.query.filter_by(
        device_id=device_id,
        user_id=user_id
    ).first()

    if existing_rating:
        # Update existing rating
        existing_rating.rating = rating_value
        existing_rating.timestamp = datetime.now(timezone.utc)
    else:
        # Create new rating
        new_rating = Rating(
            device_id=device_id,
            user_id=user_id,
            rating=rating_value
        )
        db.session.add(new_rating)
    
    db.session.commit()
    return jsonify({'message': 'Rating submitted successfully'}), 200

@app.route('/api/ratings/<string:device_id>', methods=['GET'])
def get_device_ratings(device_id):
    device = Device.query.get(device_id)
    if not device:
        abort(404, description="Device not found")

    ratings = Rating.query.filter_by(device_id=device_id).all()
    return jsonify([r.to_dict() for r in ratings]), 200

@app.route('/api/my-rating/<string:device_id>', methods=['GET'])
def get_my_rating(device_id):
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    rating = Rating.query.filter_by(
        device_id=device_id,
        user_id=user_id
    ).first()

    if not rating:
        return jsonify({'rating': None}), 200

    return jsonify(rating.to_dict()), 200

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

# --- Profile API Endpoints ---

@app.route('/api/profile', methods=['GET'])
def get_profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    user = User.query.get(user_id)
    if not user:
        abort(404, description="User not found")

    return jsonify(user.to_dict()), 200

@app.route('/api/profile', methods=['PUT'])
def update_profile():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        abort(401, description='Missing or invalid authorization token')
    
    token = auth_header.split(' ')[1]
    user_id = verify_token(token)

    user = User.query.get(user_id)
    if not user:
        abort(404, description="User not found")

    data = request.get_json()
    if not data:
        abort(400, description="Invalid JSON data")

    user.full_name = data.get('full_name', user.full_name)
    user.bio = data.get('bio', user.bio)
    user.location = data.get('location', user.location)
    # Email and username are not editable here for simplicity

    db.session.commit()
    return jsonify(user.to_dict()), 200

# New endpoint for public user profiles
@app.route('/api/users/<string:username>', methods=['GET'])
def get_user_profile(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        abort(404, description="User not found")
    
    # Return public profile data (using the existing to_dict method)
    return jsonify(user.to_dict()), 200

# New endpoint for getting a user's validations by username (publicly accessible)
@app.route('/api/users/<string:username>/validations', methods=['GET'])
def get_user_validations(username):
    user = User.query.filter_by(username=username).first()
    if not user:
        abort(404, description="User not found")
    
    # Get all validations for this user
    validations = Validation.query.filter_by(
        user_id=user.id
    ).order_by(Validation.timestamp.desc()).all()
    
    # Return the validations
    return jsonify([v.to_dict() for v in validations]), 200


@app.route('/')
def serve_frontend():
    if os.environ.get('FLASK_ENV') == 'production':
        try:
            return send_from_directory(app.config['FRONTEND_DIST_PATH'], 'index.html')
        except Exception as e:
            app.logger.error(f"Failed to serve frontend from {app.config['FRONTEND_DIST_PATH']}: {str(e)}")
            abort(500, description="Frontend files not found")
    else:
        # Redirect to Vite dev server in development
        return redirect('http://localhost:8080')

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    # For SPA routing, fall back to index.html
    if os.environ.get('FLASK_ENV') == 'production':
        return send_from_directory('../dist', 'index.html')
    return send_from_directory(app.static_folder, 'index.html')

# Configure static file serving in production
if os.environ.get('FLASK_ENV') == 'production':
    @app.route('/<path:path>')
    def serve_static(path):
        try:
            return send_from_directory(app.config['FRONTEND_DIST_PATH'], path)
        except Exception as e:
            app.logger.error(f"Failed to serve static file {path} from {app.config['FRONTEND_DIST_PATH']}: {str(e)}")
            try:
                return send_from_directory(app.config['FRONTEND_DIST_PATH'], 'index.html')
            except Exception as e:
                app.logger.error(f"Failed to serve fallback index.html: {str(e)}")
                abort(500, description="Frontend files not found")

if __name__ == '__main__':
    with app.app_context():
        # Only drop tables in debug mode
        if app.debug:
            db.drop_all()
        db.create_all()
    
    if os.environ.get('FLASK_ENV') == 'production':
        app.run(host='0.0.0.0', port=5050)
    else:
        app.run(host='0.0.0.0', port=5050, debug=True)
