from dag import ConceptGraph

print("Running tests...\n")

# Basic graph: A->B->C, A->C
concepts = {1: "A", 2: "B", 3: "C"}
edges = [(1, 2), (2, 3), (1, 3)]
g = ConceptGraph(concepts, edges)

assert g.is_valid_dag() == True, "Should be valid DAG"
assert g.topological_sort()[0] == 1, "A must come first"
assert g.get_unlocked({1}) == [2], "B unlocks when A mastered"
assert g.get_frontier({1}) == [3], "C is one hop away"
print("Basic graph tests passed")

# Cycle detection
cycle_edges = [(1, 2), (2, 3), (3, 1)]
g2 = ConceptGraph(concepts, cycle_edges)
assert g2.is_valid_dag() == False, "Should detect cycle"
print(" Cycle detection works")

# Empty progress
g3 = ConceptGraph(concepts, edges)
assert g3.get_unlocked(set()) == [], "Nothing unlocked with no progress"
print("Empty progress works")

print("\nAll tests passed ")