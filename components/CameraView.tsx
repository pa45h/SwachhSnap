import React, { useEffect, useRef } from "react";

interface CameraViewProps {
  onCapture: (image: string) => void;
  onCancel: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onCapture,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ==========================
  // START CAMERA
  // ==========================
  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
          audio: false,
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        alert("Camera access denied or not available.");
        onCancel();
      }
    };

    startCamera();

    return () => {
      stopCamera();
    };
  }, []);

  // ==========================
  // STOP CAMERA
  // ==========================
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // ==========================
  // CAPTURE IMAGE
  // ==========================
  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // ✅ VERY IMPORTANT: FULL DATA URL (DO NOT STRIP HEADER)
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);

    stopCamera();
    onCapture(imageDataUrl);
  };

  // ==========================
  // UI
  // ==========================
  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-cover"
      />

      <canvas ref={canvasRef} className="hidden" />

      {/* CONTROLS */}
      <div className="absolute bottom-6 flex gap-6">
        <button
          onClick={() => {
            stopCamera();
            onCancel();
          }}
          className="bg-white/90 px-6 py-3 rounded-full font-bold text-black"
        >
          Cancel
        </button>

        <button
          onClick={captureImage}
          className="bg-[#34A853] px-8 py-3 rounded-full font-bold text-white shadow-lg"
        >
          Capture
        </button>
      </div>
    </div>
  );
};
