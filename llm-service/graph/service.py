from datetime import datetime
from typing import List
import time
from langchain_community.graphs import Neo4jGraph
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Neo4jVector
from chains.extraction import KnowledgeTriple
import os

class GraphService:
    def __init__(self):
        # 埋め込みモデル名を環境変数から取得（backend/.env の GOOGLE_EMBEDDING_MODEL と統一）
        embedding_model = os.getenv("GOOGLE_EMBEDDING_MODEL", "gemini-embedding-001")
        self.embeddings = GoogleGenerativeAIEmbeddings(
            model=f"models/{embedding_model}",
            google_api_key=os.getenv("GOOGLE_API_KEY")
        )
        self.graph = self._connect_to_neo4j()
        self._ensure_indices()

    def _connect_to_neo4j(self, max_retries=10, delay=5):
        url = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
        username = os.getenv("NEO4J_USER", "neo4j")
        password = os.getenv("NEO4J_PASSWORD", "password")

        for attempt in range(max_retries):
            try:
                print(f"Connecting to Neo4j ({url})... Attempt {attempt + 1}/{max_retries}")
                graph = Neo4jGraph(
                    url=url,
                    username=username,
                    password=password
                )
                # Verify connection
                graph.query("RETURN 1")
                print("Successfully connected to Neo4j")
                return graph
            except Exception as e:
                print(f"Failed to connect to Neo4j: {e}")
                if attempt < max_retries - 1:
                    time.sleep(delay)
                else:
                    print("Could not connect to Neo4j. Graph capabilities will be disabled.")
                    return None

    def _ensure_indices(self):
        if not self.graph:
            return
        self.graph.query("CREATE CONSTRAINT IF NOT EXISTS FOR (c:Concept) REQUIRE c.name IS UNIQUE")
        # Define vector index for Concept names/descriptions if supported by current setup
        # For now, we rely on Neo4jVector to manage the index "concept_index"

    def add_triples(self, triples: List[KnowledgeTriple]):
        if not self.graph:
            print("[Graph] Skipping save (Neo4j not connected)")
            return

        timestamp = datetime.now().isoformat()
        
        for t in triples:
            # Determine relationship type dynamically or fallback
            rel_type = t.predicate.upper().replace(" ", "_")
            
            # Simple sanitization
            rel_type = "".join(c for c in rel_type if c.isalnum() or c == "_")
            
            cypher = f"""
            MERGE (s:Concept {{name: $subject}})
            MERGE (o:Concept {{name: $object}})
            MERGE (s)-[r:{rel_type}]->(o)
            SET r.weight = $weight,
                r.is_personal = $is_personal,
                r.updated_at = $timestamp
            """
            
            self.graph.query(cypher, params={
                "subject": t.subject,
                "object": t.object,
                "weight": t.weight,
                "is_personal": t.is_personal,
                "timestamp": timestamp
            })

    def get_relevant_context(self, query: str) -> str:
        if not self.graph:
            return ""

        # 1. Vector Search to find relevant Concepts
        # We try to use Neo4jVector to find top concepts
        try:
            vector_store = Neo4jVector.from_existing_graph(
                embedding=self.embeddings,
                url=os.getenv("NEO4J_URI", "bolt://neo4j:7687"),
                username=os.getenv("NEO4J_USER", "neo4j"),
                password=os.getenv("NEO4J_PASSWORD", "password"),
                index_name="concept_index",
                node_label="Concept",
                text_node_properties=["name"],
                embedding_node_property="embedding",
            )
            
            results = vector_store.similarity_search(query, k=3)
            concept_names = [doc.page_content for doc in results]
            
            if not concept_names:
                return ""

            # 2. Graph Traversal (1-hop)
            context_lines = []
            for name in concept_names:
                cypher = """
                MATCH (c:Concept {name: $name})-[r]-(n:Concept)
                RETURN c.name, type(r) as rel, n.name, r.weight, r.is_personal
                LIMIT 5
                """
                
                rels = self.graph.query(cypher, params={"name": name})
                for row in rels:
                    fact_type = "個人的な事実" if row['r.is_personal'] else "一般的な事実"
                    context_lines.append(f"- {fact_type}: {row['c.name']} は {row['n.name']} と {row['rel']} という関係です (確信度: {row['r.weight']})")
            
            return "\n".join(context_lines)

        except Exception as e:
            print(f"Error in GraphRAG: {e}")
            return ""

    def get_whole_graph(self):
        """
        ナレッジグラフ全体を取得してフロントエンド用のノード・リンク形式に変換する。

        neo4j ドライバの新バージョンでは RETURN n, r, m としたとき
        row['r'] がタプルとして返るため、.type アクセスが AttributeError になる。
        そのため Cypher 側で type(r) を文字列として取得し、
        プロパティも r.weight / r.is_personal で直接取得する。
        """
        if not self.graph:
            return {"nodes": [], "links": []}

        cypher = """
        MATCH (n)-[r]->(m)
        RETURN n.name AS source,
               m.name AS target,
               type(r) AS rel_type,
               r.weight AS weight,
               r.is_personal AS is_personal
        LIMIT 100
        """
        results = self.graph.query(cypher)

        nodes = {}
        links = []

        for row in results:
            source = row['source']
            target = row['target']

            nodes[source] = {"id": source, "group": "Concept"}
            nodes[target] = {"id": target, "group": "Concept"}

            links.append({
                "source": source,
                "target": target,
                "label": row['rel_type'] or "",
                "weight": row['weight'] if row['weight'] is not None else 1.0,
                "is_personal": row['is_personal'] if row['is_personal'] is not None else False,
            })

        return {
            "nodes": list(nodes.values()),
            "links": links
        }

