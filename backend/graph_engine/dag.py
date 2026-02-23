from collections import defaultdict, deque

class ConceptGraph:
    def __init__(self, concepts: dict, edges: list):
        """
        concepts: {id: name}
        edges: [(from_id, to_id)]
        """
        self.concepts = concepts
        self.edges = edges
        self.graph = defaultdict(list)    # from -> [to]
        self.reverse = defaultdict(list)  # to -> [from]
        self.in_degree = defaultdict(int)

        for f, t in edges:
            self.graph[f].append(t)
            self.reverse[t].append(f)
            self.in_degree[t] += 1

    def is_valid_dag(self) -> bool:
        """Cycle detection via DFS with recursion stack. O(V+E)"""
        visited, rec_stack = set(), set()

        def dfs(node):
            visited.add(node)
            rec_stack.add(node)
            for neighbor in self.graph[node]:
                if neighbor not in visited:
                    if dfs(neighbor): return True
                elif neighbor in rec_stack:
                    return True
            rec_stack.discard(node)
            return False

        return not any(
            dfs(n) for n in self.concepts
            if n not in visited
        )

    def topological_sort(self) -> list:
        """Kahn's Algorithm. Returns concept IDs in valid learning order. O(V+E)"""
        indeg = {n: 0 for n in self.concepts}
        for f, t in self.edges:
            indeg[t] += 1

        queue = deque([n for n in self.concepts if indeg[n] == 0])
        order = []

        while queue:
            node = queue.popleft()
            order.append(node)
            for neighbor in self.graph[node]:
                indeg[neighbor] -= 1
                if indeg[neighbor] == 0:
                    queue.append(neighbor)

        return order

    def get_frontier(self, mastered_ids: set) -> list:
        """
        Concepts where exactly ONE prerequisite is still unmastered.
        These are closest to being unlocked. O(V+E)
        """
        frontier = []
        for node in self.concepts:
            if node in mastered_ids:
                continue
            prerequisites = self.reverse[node]
            if not prerequisites:
                continue
            unmastered = [p for p in prerequisites if p not in mastered_ids]
            if len(unmastered) == 1:
                frontier.append(node)
        return frontier

    def get_unlocked(self, mastered_ids: set) -> list:
        """Concepts where ALL prerequisites are mastered but not the concept itself."""
        unlocked = []
        for node in self.concepts:
            if node in mastered_ids:
                continue
            prerequisites = self.reverse[node]
            if prerequisites and all(p in mastered_ids for p in prerequisites):
                unlocked.append(node)
        return unlocked