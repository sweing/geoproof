import os
# Production configuration
DEBUG = False
SQLALCHEMY_DATABASE_URI = 'sqlite:////home/nebula/geoproof_backend/backend/instance/prod_auth.db'
SQLALCHEMY_TRACK_MODIFICATIONS = False
SECRET_KEY = 'your-production-secret-key-here'
SERVER_NAME = 'geoproof.org'
#FRONTEND_DIST_PATH = '/home/nebula/geoproof_backend/dist'  # Relative to app.py location

basedir = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIST_PATH = os.path.abspath(os.path.join(basedir, '../dist'))