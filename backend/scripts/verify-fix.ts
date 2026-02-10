


async function verifyStatusPriority() {
  const API_URL = 'http://localhost:3001/api/chat';
  
  // ペルソナID指定なし（デフォルト）、チャットID指定なし（新規）
  // 過去の記憶との矛盾をシミュレートするのは難しいが、
  // システムプロンプトに「重要」セクションが含まれているかを確認することは可能。
  
  const payload = {
    message: "今の身長は何cmですか？",
    model: "gemini-1.5-flash"
  };

  console.log("Sending request to:", API_URL);
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    console.log("Response Status:", response.status);
    console.log("AI Response:", data.response);
    
    // Check System Prompt
    const systemPrompt = data.debug?.systemPrompt || "";
    const hasPriorityInstruction = systemPrompt.includes("「現在のステータス」の情報は最新の確定事項であり");
    const hasMemoryWarning = systemPrompt.includes("現在のステータスと矛盾する場合は無視し");

    console.log("---------------------------------------------------");
    console.log("Verification Results:");
    console.log("1. Priority Instruction Present:", hasPriorityInstruction ? "PASS" : "FAIL");
    console.log("2. Memory Warning Present:      ", hasMemoryWarning ? "PASS" : "FAIL");
    console.log("3. Response contains correct height (likely):", data.response);
    
    if (hasPriorityInstruction && hasMemoryWarning) {
        console.log("\n[SUCCESS] System prompt successfully updated.");
    } else {
        console.log("\n[FAILURE] System prompt update not detected.");
    }
    
  } catch (error) {
    console.error("Verification failed:", error);
  }
}

verifyStatusPriority();
