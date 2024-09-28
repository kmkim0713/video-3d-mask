import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils
} from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import './styles.css';

document.addEventListener("DOMContentLoaded", async () => {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(ctx);

    const scene = new THREE.Scene();

    // 카메라 설정
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 3); // 카메라 위치 조정

    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 환경 조명
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 방향 조명
    directionalLight.position.set(0, 1, 1).normalize();
    scene.add(directionalLight);

    let avatar;

    // 카메라 스트림 설정
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video'); // 비디오 요소를 생성하되 HTML에 추가하지 않음
    video.srcObject = stream;
    video.play();

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

    const detectLandmarks = async (faceLandmarker) => {
        const results = faceLandmarker.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.faceLandmarks) {
            for (const landmarks of results.faceLandmarks) {
                drawingUtils.drawConnectors(
                    landmarks,
                    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                    { color: "#C0C0C070", lineWidth: 1.3 }
                );
                updateAvatarPosition(landmarks); // 아바타 위치 업데이트
            }
        }

        requestAnimationFrame(() => detectLandmarks(faceLandmarker));
    };

    const updateAvatarPosition = (faceLandmarks) => {
        if (faceLandmarks.length > 0) {
            const headLandmark = faceLandmarks[0];
            if (avatar) {
                // 얼굴 랜드마크에 따라 아바타 위치 업데이트
                avatar.position.set(headLandmark.x * 2 - 1, -headLandmark.y * 2 + 1, headLandmark.z * 2);
            }
        } else {
            console.warn("유효한 얼굴 랜드마크가 없습니다.");
        }
    };

    const loadAvatarModel = (url) => {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            avatar = gltf.scene;
            avatar.scale.set(3, 3, 3); // 아바타 크기를 1로 설정
            avatar.position.set(0, 0, 0); // 아바타의 위치를 중앙으로 설정
            scene.add(avatar);
        }, undefined, (error) => {
            console.error("모델 로딩 실패:", error);
        });
    };



    loadAvatarModel("https://models.readyplayer.me/6460691aa35b2e5b7106734d.glb?morphTargets=ARKit");

    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };

    initializeFaceLandmarker();
    animate();
});
