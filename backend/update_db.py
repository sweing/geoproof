from backend.app import app, db
from datetime import datetime, timezone

def update_database():
    with app.app_context():
        # Create all tables that don't exist yet
        db.create_all()
        print("Database tables updated successfully")

if __name__ == '__main__':
    update_database()
