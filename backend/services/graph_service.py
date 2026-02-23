import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph_engine.dag import ConceptGraph
from repositories.graph_repo import load_graph_data

def get_learning_path(topic_id: int):
    concepts, edges = load_graph_data(topic_id)
    g = ConceptGraph(concepts, edges)
    ordered_ids = g.topological_sort()
    return [{"id": i, "name": concepts[i]} for i in ordered_ids]

def get_frontier(topic_id: int, mastered_ids: list):
    concepts, edges = load_graph_data(topic_id)
    g = ConceptGraph(concepts, edges)
    frontier_ids = g.get_frontier(set(mastered_ids))
    return [{"id": i, "name": concepts[i]} for i in frontier_ids]

def get_unlocked(topic_id: int, mastered_ids: list):
    concepts, edges = load_graph_data(topic_id)
    g = ConceptGraph(concepts, edges)
    unlocked_ids = g.get_unlocked(set(mastered_ids))
    return [{"id": i, "name": concepts[i]} for i in unlocked_ids]

def validate_topic_graph(topic_id: int):
    concepts, edges = load_graph_data(topic_id)
    g = ConceptGraph(concepts, edges)
    return g.is_valid_dag()