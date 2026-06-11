import { useEffect, useRef, useState } from "react";

export default function App() {
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!running) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });

        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

        const interval = setInterval(async () => {
          if (!videoRef.current) return;

          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0) {
            setCode(codes[0].rawValue);
            setRunning(false); // 読んだら止める
          }
        }, 500);

        return () => clearInterval(interval);
      } catch (e) {
        alert("カメラ起動失敗");
        setRunning(false);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [running]);

  return (
    <div style={{ padding: "20px" }}>
      <h1>棚卸アプリ（QR読取）</h1>

      <button onClick={() => setRunning(true)}>
        QR読取開始
      </button>

      <div style={{ marginTop: "20px" }}>
        <video
          ref={videoRef}
          style={{ width: "100%", maxWidth: "300px" }}
        />
      </div>

      <p>読取結果: {code}</p>
    </div>
  );
}