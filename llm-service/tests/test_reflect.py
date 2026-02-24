from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock, AsyncMock
import sys
import os
import json

# パスを通す (llm-serviceディレクトリをPYTHONPATHに追加)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
# ReflectionResult と StatusUpdate をインポート
from chains.reflection import ReflectionResult, StatusUpdate


client = TestClient(app)

def test_reflect_endpoint():
    """
    /reflect エンドポイントの正常系テスト
    GraphServiceとLLM Chainをモック化して、エンドポイントのロジックのみを検証する。
    特に、PersonaStatusの属性アクセスエラー(ageなど)が発生しないことを確認する。
    """
    # モックの設定
    with patch("main.graph_service") as mock_graph:
        with patch("main.create_chat_model") as mock_create_llm:
            with patch("main.create_reflection_chain") as mock_create_chain:
                
                # 1. Graph Serviceの戻り値をモック
                mock_graph.get_relevant_context.return_value = "Mock Graph Context: User likes apples."
                
                # 2. Chainの実行結果をモック
                # ainvokeの戻り値はPydanticモデル(ReflectionResult)であることを期待されているため、
                # 辞書ではなく、実際のモデルのインスタンスを生成する。
                mock_result = ReflectionResult(
                    thought="Testing reflection logic.",
                    statusUpdate=StatusUpdate(
                        health=5,
                        mood=10,
                        trust=5,
                        friendliness=5,
                        heightIncrease=0.1
                    ),
                    permanentMemory="Always test your code.",
                    newMemories=["User ran a test."],
                    growthFeedback=True
                )
                
                # Chainインスタンスのモック
                mock_chain_instance = MagicMock()
                mock_prompt_instance = MagicMock() # promptもアンパックされるため、ダミーのモックを用意
                # ainvoke を AsyncMock でモック化する
                mock_chain_instance.ainvoke = AsyncMock(return_value=mock_result)
                # prompt と chain の両方をタプルで返すように修正
                mock_create_chain.return_value = (mock_prompt_instance, mock_chain_instance)

                # 3. リクエストデータ (JS側から送られるJSONを模倣)
                payload = {
                    "log_summary": "User: こんにちは\nAI: こんにちは、テストですね。",
                    "status": {
                        "name": "Reflecta",
                        "birthDate": "2024-01-01T00:00:00.000Z",
                        "gender": "Female",
                        "height": 160.0,
                        "weight": 50.0,
                        "health": 80,
                        "mood": 60,
                        "trust": 40,
                        "friendliness": 50,
                        # 不足しているフィールドがあってもPydanticのデフォルト値が使われるはず
                    }
                }

                # 4. API呼び出し
                print(f"Sending request to /reflect with payload: {json.dumps(payload, ensure_ascii=False)}")
                response = client.post("/reflect", json=payload)

                # 5. 検証
                print(f"Response Status: {response.status_code}")
                print(f"Response Body: {response.text}")

                assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
                
                data = response.json()
                assert data["thought"] == "Testing reflection logic."
                assert data["statusUpdate"]["mood"] == 10
                assert data["growthFeedback"] is True
                
                # 内部ロジックで graph_service.get_relevant_context が呼ばれたことを確認
                mock_graph.get_relevant_context.assert_called_once()
                
                # create_reflection_chain が呼ばれたことを確認
                mock_create_chain.assert_called_once()

if __name__ == "__main__":
    # スクリプトとして直接実行された場合は、pytestを使わずに簡易実行
    try:
        test_reflect_endpoint()
        print("✅ test_reflect_endpoint passed!")
    except AssertionError as e:
        print(f"❌ test_reflect_endpoint failed: {e}")
    except Exception as e:
        print(f"❌ An error occurred: {e}")
