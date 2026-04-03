import sqlite3
import sys

def migrate():
    conn = sqlite3.connect('companyhub.db')
    c = conn.cursor()
    try:
        c.execute("ALTER TABLE project_updates ADD COLUMN remark VARCHAR;")
        conn.commit()
        print("Migration successful: added 'remark' to project_updates")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e):
            print("Column 'remark' already exists, skipping.")
        else:
            print(f"Error: {e}")
            sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
