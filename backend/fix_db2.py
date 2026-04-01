import sqlite3
import json

conn = sqlite3.connect('companyhub.db')
c = conn.cursor()

# 1. 修复状态
c.execute("UPDATE projects SET status='completed' WHERE status='已结项' OR status='completed'")
c.execute("UPDATE projects SET status='pending_completion' WHERE status='已完成' OR status='待结项' OR status='pending_completion'")
c.execute("UPDATE projects SET status='in_progress' WHERE status='实施中' OR status='in_progress'")
c.execute("UPDATE projects SET status='paused' WHERE status='暂停中' OR status='paused'")

# 2. 修复标签 (tags)
c.execute("SELECT id, tags FROM projects")
rows = c.fetchall()
for row in rows:
    pid = row[0]
    tags_str = row[1]
    if tags_str:
        try:
            tags = json.loads(tags_str)
            new_tags = []
            changed = False
            for t in tags:
                if t == '#待结项':
                    new_tags.append('#已完成')
                    changed = True
                elif t == '#已完成':
                    new_tags.append('#已结项')
                    changed = True
                else:
                    new_tags.append(t)
            if changed:
                c.execute("UPDATE projects SET tags=? WHERE id=?", (json.dumps(new_tags), pid))
        except Exception as e:
            print("Error parsing JSON tags:", tags_str, e)

conn.commit()

c.execute("SELECT DISTINCT status FROM projects")
print("Project distinct statuses:", c.fetchall())

conn.close()
print("DB fixed successfully!")
