import pyotp
import qrcode
import sqlite3
import os
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad

#base_url = "https://map.localproof.org"
base_url = "http://localhost:8080/validate?code="

device_id = "dev2243"
secret = "N6OYKIG65RETZ4NI" # Comment line to query database 
device_lng = 48.188920
device_lat = 16.376279

# device_id = "0002"
# device_lng = 48.200301
# device_lat = 16.335815

# Database connection helper function
def get_db_connection():
    conn = sqlite3.connect('../website/database.db')
    conn.row_factory = sqlite3.Row  # Access columns by name
    return conn

def encrypt_totp(key, totp_number, lat, lng):
    """
    Encrypts the TOTP number, latitude, and longitude using AES-256-CBC.
    
    :param key: Secret key for encryption.
    :param totp_number: Current TOTP number.
    :param lat: Latitude.
    :param lng: Longitude.
    :return: URL-safe base64-encoded encrypted data.
    """
    # Ensure the key is 32 bytes long
    key = key.encode('utf-8')
    key = key.ljust(32, b'\0')[:32]  # Pad or truncate the key to 32 bytes (256 bits)
    
    # Generate a random 16-byte IV for CBC mode
    iv = os.urandom(16)
    
    # Create AES cipher in CBC mode
    cipher = AES.new(key, AES.MODE_CBC, iv)
    
    # Prepare the plaintext: "totpnumber|lat|lng"
    plain_text = f"{totp_number}|{lat}|{lng}"
    
    # Pad the plaintext to be a multiple of 16 bytes
    plain_text = pad(plain_text.encode('utf-8'), AES.block_size)
    
    # Encrypt the plaintext
    cipher_text = cipher.encrypt(plain_text)
    
    # Combine the IV and ciphertext (IV is needed for decryption)
    iv_and_ciphertext = iv + cipher_text
    
    # Return the IV and ciphertext as a URL-safe base64-encoded string
    return base64.urlsafe_b64encode(iv_and_ciphertext).decode('utf-8')

def generate_totp_qr(device_id: str, lat: float, lng: float, secret: str = None):
    """
    Generates a QR code with an encrypted TOTP code for a specific device.
    
    :param device_id: Unique ID of the device.
    :param lat: Latitude of the device's location.
    :param lng: Longitude of the device's location.
    :param secret: Optional secret key. If provided, the database will not be queried.
    """
    if secret is None:
        # Fetch the device's secret from the database
        conn = get_db_connection()
        device = conn.execute('SELECT * FROM devices WHERE device_id = ?', (device_id,)).fetchone()
        conn.close()

        if not device:
            raise ValueError(f"Device not found: {device_id}")

        secret = device['secret']
    else:
        print(f"Using provided secret for device {device_id}")

    # Generate the TOTP code
    totp = pyotp.TOTP(secret)
    current_totp = totp.now()
    print(f"Generated TOTP for device {device_id}: {current_totp}")
    
    # Encrypt the TOTP, lat, and lng using the secret key
    encrypted_data = encrypt_totp(secret, current_totp, lat, lng)

    # Create a validation URL with encrypted data and device ID
    validation_url = f"{base_url}{device_id}/{encrypted_data}"

    # Print URL for testing
    print(f"Validation URL: {validation_url}")
    
    # Generate the QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(validation_url)
    qr.make(fit=True)

    # Save the QR code image
    img = qr.make_image(fill_color="black", back_color="white")
    img_path = f"static/{device_id}_totp_qr.png"
    img.save(img_path)
    print(f"QR code saved as '{img_path}'")

if __name__ == "__main__":
    # Example: Generate QR codes for devices with specific lat and lng
    # Option 1: Use the database to fetch the secret
    # generate_totp_qr(device_id, device_lng, device_lat)  # Device 0001

    # Option 2: Provide the secret directly
    generate_totp_qr(device_id, device_lng, device_lat, secret)  # Device 0001 with provided secret