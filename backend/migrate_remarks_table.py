import sqlite3
import uuid

def migrate():
    conn = sqlite3.connect('companyhub.db')
    c = conn.cursor()
    try:
        c.execute("""
        CREATE TABLE IF NOT EXISTS project_log_remarks (
            id VARCHAR(36) PRIMARY KEY,
            update_id VARCHAR(36) NOT NULL,
            content TEXT NOT NULL,
            created_by VARCHAR(255) DEFAULT '用户',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(update_id) REFERENCES project_updates(id) ON DELETE CASCADE
        );
        """)
        # We can also migrate existing "remark" column if any exist into this new table?
        # Check if the 'remark' column exists and has data.
        c.execute("PRAGMA table_info(project_updates)")
        columns = [row[1] for row in c.fetchall()]
        if 'remark' in columns:
            c.execute("SELECT id, remark, reporter_name, created_at FROM project_updates WHERE remark IS NOT NULL AND remark != ''")
            old_remarks = c.fetchall()
            for r in old_remarks:
                uid = r[0]
                content = r[1]
                reporter = r[2]
                created_at = r[3]
                new_id = str(uuid.uuid4())
                c.execute("INSERT INTO project_log_remarks (id, update_id, content, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
                          (new_id, uid, content, reporter, created_at))
            print(f"Migrated {len(old_remarks)} old remarks.")
            # Drop column not supported readily in sqlite < 3.35, so we can just ignore it or leave it.

        conn.commit()
        print("Migration successful: created project_log_remarks table.")
    except Exception as e:
        print(f"Error: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    migrate()
