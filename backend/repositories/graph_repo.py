from database import get_connection

def load_graph_data(topic_id: int):
    """
    Fetches concepts and dependencies for a topic from MySQL.
    Returns raw data — no graph logic here.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    cursor.execute(
        "SELECT id, name FROM concepts WHERE topic_id = %s",
        (topic_id,)
    )
    concepts = {row["id"]: row["name"] for row in cursor.fetchall()}

    cursor.execute("""
        SELECT d.from_concept_id, d.to_concept_id
        FROM dependencies d
        JOIN concepts c ON c.id = d.from_concept_id
        WHERE c.topic_id = %s
    """, (topic_id,))
    edges = [(row["from_concept_id"], row["to_concept_id"]) for row in cursor.fetchall()]

    cursor.close()
    conn.close()

    return concepts, edges

def get_concept_by_id(concept_id: int):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT id, name, description, difficulty_level, resources FROM concepts WHERE id = %s",
        (concept_id,)
    )
    concept = cursor.fetchone()
    cursor.close()
    conn.close()
    if not concept:
        return None
    if concept["resources"]:
        concept["resources"] = [r.strip() for r in concept["resources"].split(",")]
    else:
        concept["resources"] = []
    return concept