from database import get_connection

def get_mastered(user_id: int, topic_id: int) -> list[int]:
    conn   = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT concept_id FROM user_progress
        WHERE user_id = %s AND status = 'mastered'
        AND concept_id IN (
            SELECT id FROM concepts WHERE topic_id = %s
        )
    """, (user_id, topic_id))
    rows = cursor.fetchall()
    cursor.close(); conn.close()
    return [r[0] for r in rows]

def set_mastered(user_id: int, concept_id: int, mastered: bool):
    conn   = get_connection()
    cursor = conn.cursor()
    if mastered:
        cursor.execute("""
            INSERT INTO user_progress (user_id, concept_id, status, last_updated)
            VALUES (%s, %s, 'mastered', NOW())
            ON DUPLICATE KEY UPDATE status = 'mastered', last_updated = NOW()
        """, (user_id, concept_id))
    else:
        cursor.execute("""
            UPDATE user_progress SET status = 'not_started', last_updated = NOW()
            WHERE user_id = %s AND concept_id = %s
        """, (user_id, concept_id))
    conn.commit()
    cursor.close(); conn.close()