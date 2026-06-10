import { useState } from "react";

export default function App() {
  const [value, setValue] = useState("");

  return (
    <div style={{ padding: "20px" }}>
      <h1>棚卸アプリ（動作確認）</h1>

      <input
        type="text"
        placeholder="QRコードの値を入力"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />

      <p>読取値: {value}</p>
    </div>
  );
}