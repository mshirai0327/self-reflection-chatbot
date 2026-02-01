
#!/bin/bash

# Load API Key from .env manually since source might process differently
# Extract key looking for GOOGLE_GENERATIVE_AI_API_KEY
API_KEY=$(grep GOOGLE_GENERATIVE_AI_API_KEY .env | cut -d '=' -f2 | tr -d '"')

if [ -z "$API_KEY" ]; then
  echo "API Key not found in .env"
  exit 1
fi

echo "Testing with API Key: ${API_KEY:0:5}..."

echo ""
echo "--- Request 1: りんご ---"
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$API_KEY" \
-H 'Content-Type: application/json' \
-d '{"content": {"parts":[{"text": "りんご"}]}}' > response1.json

echo "Response 1 saved."

echo ""
echo "--- Request 2: 宇宙 ---"
curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$API_KEY" \
-H 'Content-Type: application/json' \
-d '{"content": {"parts":[{"text": "宇宙"}]}}' > response2.json

echo "Response 2 saved."

# Compare generated files
echo ""
echo "Comparing responses..."
# 最初の5行程度の数値を抽出して比較（単純grep）
VAL1=$(cat response1.json | grep "embedding" -A 5)
VAL2=$(cat response2.json | grep "embedding" -A 5)

echo "Head of Response 1:"
echo "$VAL1"
echo "Head of Response 2:"
echo "$VAL2"

if [ "$VAL1" == "$VAL2" ]; then
    echo "FAIL: Responses seem IDENTICAL"
else
    echo "OK: Responses are DIFFERENT"
fi
