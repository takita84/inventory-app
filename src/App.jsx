import { useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";

export default function App() {
  useEffect(() => {
    const scanner = new Html5Qrcode("reader");

    scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: 250
      },
      (decodedText) => {
        document.getElementById("result").innerText = decodedText;
        scanner.stop();
      },
      (error) => {
        console.log(error);
      }
    ).catch(() => {
      alert("カメラ起動失敗");
    });
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>棚卸アプリ（QR読取）</h1>

      <div id="reader" style={{ width: "300px" }}></div>

      <p>
        読取結果: <span id="result">未読取</span>
      </p>
    </div>
  );
}
``