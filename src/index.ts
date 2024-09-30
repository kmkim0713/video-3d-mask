import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils,
    FaceLandmarkerResult
} from "@mediapipe/tasks-vision";

import './styles.css'; // CSS 파일 가져오기

document.addEventListener("DOMContentLoaded", async () => {
    const video = document.getElementById("video") as HTMLVideoElement;
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Canvas 2D context를 가져오는 데 실패했습니다.");
        return;
    }
    const drawingUtils = new DrawingUtils(ctx);

    // 카메라 스트림 설정
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.play();

                // 랜드마크 모델 초기화
                initializeFaceLandmarker();
            };

        } catch (error) {
            console.error("카메라 접근에 실패했습니다.", error);
        }
    } else {
        console.error("getUserMedia를 지원하지 않는 브라우저입니다.");
    }

    const initializeFaceLandmarker = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromModelPath(vision,
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        );

        // 랜드마크 인식 및 그리기
        detectLandmarks(faceLandmarker);
    };

    const detectLandmarks = async (faceLandmarker: FaceLandmarker) => {
        const results: FaceLandmarkerResult = faceLandmarker.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.faceLandmarks) {
            for (const landmarks of results.faceLandmarks) {
                drawingUtils.drawConnectors(
                    landmarks,
                    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                    { color: "#C0C0C070", lineWidth: 1.3 }
                );
            }
        }

        requestAnimationFrame(() => detectLandmarks(faceLandmarker));
    };
});
