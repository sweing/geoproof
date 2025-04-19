import os

# Production configuration
SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-production-secret-key'
SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or 'sqlite:///auth.db'
FLASK_ENV = 'production'
