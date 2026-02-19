import os
from langchain_community.graphs import Neo4jGraph

def get_graph_client() -> Neo4jGraph:
    uri = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
    username = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD")

    if not password:
        raise ValueError("NEO4J_PASSWORD environment variable is not set")

    return Neo4jGraph(
        url=uri,
        username=username,
        password=password
    )

def init_indices(graph: Neo4jGraph):
    # Ensure constraints and indices
    graph.query("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE")
    graph.query("CREATE CONSTRAINT IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE")
    graph.query("CREATE INDEX IF NOT EXISTS FOR (c:Concept) ON (c.category)")
