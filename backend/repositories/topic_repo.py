from database import get_connection

def save_generated_topic(topic_name: str, description: str, concepts: list, dependencies: list) -> int:
    conn = get_connection()
    cursor = conn.cursor()

    # Insert topic
    cursor.execute(
        "INSERT INTO topics (name, description) VALUES (%s, %s)",
        (topic_name, description)
    )
    topic_id = cursor.lastrowid

    # Insert concepts and track id mapping (AI ids → real DB ids)
    id_map = {}
    for c in concepts:
        cursor.execute(
            "INSERT INTO concepts (topic_id, name, description, difficulty_level) VALUES (%s, %s, %s, %s)",
            (topic_id, c["name"], c["description"], c["difficulty"])
        )
        id_map[c["id"]] = cursor.lastrowid

    # Insert dependencies using real DB ids
    for d in dependencies:
        from_id = id_map.get(d["from"])
        to_id   = id_map.get(d["to"])
        if from_id and to_id:
            cursor.execute(
                "INSERT INTO dependencies (from_concept_id, to_concept_id) VALUES (%s, %s)",
                (from_id, to_id)
            )

    conn.commit()
    cursor.close()
    conn.close()
    return topic_id

def get_all_topics() -> list:
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name, description, created_at FROM topics ORDER BY created_at DESC")
    topics = cursor.fetchall()
    cursor.close()
    conn.close()
    return topics