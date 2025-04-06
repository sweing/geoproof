#!/usr/bin/env python3
import sqlite3
from pathlib import Path

def empty_auth_db():
    db_path = Path(__file__).parent / 'instance' / 'auth.db'
    if not db_path.exists():
        print(f"Error: Database file not found at {db_path}")
        return False

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get list of all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        # Disable foreign key constraints temporarily
        cursor.execute("PRAGMA foreign_keys=OFF;")
        
        # Delete all data from each table
        for table in tables:
            table_name = table[0]
            if table_name not in ('sqlite_sequence', 'sqlite_stat1'):  # Skip system tables
                try:
                    cursor.execute(f"DELETE FROM \"{table_name}\";")
                except sqlite3.Error as e:
                    print(f"Warning: Could not delete from {table_name}: {e}")
        
        # Reset auto-increment counters (if tables exist)
        try:
            cursor.execute("DELETE FROM sqlite_sequence WHERE 1;")
        except sqlite3.Error:
            pass  # Table doesn't exist
        try:
            cursor.execute("DELETE FROM sqlite_stat1 WHERE 1;")
        except sqlite3.Error:
            pass  # Table doesn't exist
        
        # Re-enable foreign keys
        cursor.execute("PRAGMA foreign_keys=ON;")
        
        conn.commit()
        print(f"Successfully emptied all tables in {db_path}")
        return True
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return False
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    empty_auth_db()
