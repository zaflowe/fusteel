import sqlite3

conn = sqlite3.connect('companyhub.db')
c = conn.cursor()

c.execute("UPDATE projects SET status='TMP_COMPLETED' WHERE status='已完成'")
c.execute("UPDATE projects SET status='已完成' WHERE status='待结项'")
c.execute("UPDATE projects SET status='已结项' WHERE status='TMP_COMPLETED'")

conn.commit()

c.execute("SELECT DISTINCT status FROM projects")
print("Project distinct statuses:", c.fetchall())

conn.close()
