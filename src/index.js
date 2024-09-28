import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

async function setupCamera() {
    const video = document.getElementById('video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    return new Promise((resolve) => {
        video.onloadedmetadata = () => {
            resolve(video);
        };
    });
}

async function captureImage() {
    const video = document.getElementById('video');
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = document.getElementById('image');
    image.src = canvas.toDataURL('image/png');
    image.style.display = 'block';
}

async function setupFaceLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    const faceLandmarker = await FaceLandmarker.createFromModelPath(vision,
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
    );

    return faceLandmarker;
}

async function main() {
    await setupCamera();

    const captureButton = document.getElementById('capture');
    captureButton.addEventListener('click', async () => {
        await captureImage();
        const faceLandmarker = await setupFaceLandmarker();
        const image = document.getElementById('image');
        const landmarks = faceLandmarker.detect(image);

        const canvas = document.getElementById('output');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = image.width;
        canvas.height = image.height;

        if (landmarks.faceLandmarks) {
            const drawingUtils = new DrawingUtils(ctx);
            const lineWidth = 1.3;
            for (const landmark of landmarks.faceLandmarks) {
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                    { color: "#C0C0C070", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
                    { color: "#FF3030", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
                    { color: "#FF3030", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
                    { color: "#30FF30", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
                    { color: "#30FF30", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                    { color: "#E0E0E0", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_LIPS,
                    { color: "#E0E0E0", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
                    { color: "#FF3030", lineWidth: lineWidth }
                );
                drawingUtils.drawConnectors(
                    landmark,
                    FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
                    { color: "#30FF30", lineWidth: lineWidth }
                );
            }
        }
    });
}

main();
