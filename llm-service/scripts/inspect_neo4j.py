"""
Neo4j グラフ検査スクリプト
make neo4j-inspect で実行します。
ナレッジグラフに保存されているノード・リレーション・トリプルを確認します。
"""
import os
import sys
from dotenv import load_dotenv

# llm-service/.env を読み込む
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

SAMPLE_LIMIT = 20


def main():
    try:
        from neo4j import GraphDatabase
    except ImportError:
        print("ERROR: neo4j パッケージが見つかりません。pip install neo4j を実行してください。")
        sys.exit(1)

    print(f"Connecting to Neo4j at: {NEO4J_URI}")
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        driver.verify_connectivity()
        print("Connected!\n")
    except Exception as e:
        print(f"ERROR: Neo4j への接続に失敗しました: {e}")
        sys.exit(1)

    with driver.session() as session:
        # --- ノード数 ---
        node_count = session.run("MATCH (n) RETURN count(n) AS cnt").single()["cnt"]
        print(f"=== ノード数: {node_count} ===")

        # --- ラベル別ノード数 ---
        labels = session.run("CALL db.labels() YIELD label RETURN label ORDER BY label")
        for record in labels:
            label = record["label"]
            cnt = session.run(f"MATCH (n:`{label}`) RETURN count(n) AS cnt").single()["cnt"]
            print(f"  [{label}]: {cnt} 件")

        print()

        # --- リレーション数 ---
        rel_count = session.run("MATCH ()-[r]->() RETURN count(r) AS cnt").single()["cnt"]
        print(f"=== リレーション数: {rel_count} ===")

        # --- リレーション種別 ---
        rel_types = session.run("CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType ORDER BY relationshipType")
        for record in rel_types:
            rel_type = record["relationshipType"]
            cnt = session.run(f"MATCH ()-[r:`{rel_type}`]->() RETURN count(r) AS cnt").single()["cnt"]
            print(f"  [{rel_type}]: {cnt} 件")

        print()

        # --- サンプルトリプル ---
        print(f"=== サンプルトリプル（最大 {SAMPLE_LIMIT} 件）===")
        results = session.run(
            "MATCH (s)-[r]->(o) RETURN properties(s) AS subject, type(r) AS predicate, properties(o) AS object LIMIT $limit",
            limit=SAMPLE_LIMIT
        )
        records = list(results)
        if not records:
            print("  （データなし）")
        else:
            for i, record in enumerate(records):
                subject = record["subject"]
                predicate = record["predicate"]
                obj = record["object"]
                # id, name, value の優先順でラベルを取得
                def get_label(props: dict) -> str:
                    return props.get("id") or props.get("name") or props.get("value") or str(props)
                print(f"  [{i:02d}] {get_label(subject)}  --[{predicate}]-->  {get_label(obj)}")

        print()

        # --- ノードのプロパティサンプル ---
        print(f"=== ノードサンプル（最大 5 件）===")
        nodes = session.run("MATCH (n) RETURN n LIMIT 5")
        for record in nodes:
            node = record["n"]
            print(f"  Labels: {list(node.labels)}, Properties: {dict(node)}")

    driver.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
