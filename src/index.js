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

    const video = document.getElementById('video'); // HTML에서 비디오 요소 가져오기
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.play();

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 환경광
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 방향광
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    let avatar;

    const initializeFaceLandmarker = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromModelPath(vision,
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
        );

        // 랜드마크 인식 및 아바타 업데이트
        detectLandmarks(faceLandmarker);
    };

    const detectLandmarks = async (faceLandmarker) => {
        const results = faceLandmarker.detect(video);

        if (results.faceLandmarks) {
            for (const landmarks of results.faceLandmarks) {
                updateAvatarPosition(landmarks); // 아바타 위치 업데이트
            }
        }

        requestAnimationFrame(() => detectLandmarks(faceLandmarker));
    };

    const updateAvatarPosition = (faceLandmarks) => {
        if (faceLandmarks.length > 0) {
            const headLandmark = faceLandmarks[0];
            if (avatar) {
                avatar.position.set(headLandmark.x * 2 - 1, -headLandmark.y * 2 + 0.5, headLandmark.z * 2 - 0.5); // Y 위치를 조정하여 아바타가 더 높게 나오도록 설정
            }
        } else {
            console.warn("유효한 얼굴 랜드마크가 없습니다.");
        }
    };

    const loadAvatarModel = (url) => {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            avatar = gltf.scene;
            avatar.scale.set(3, 3, 0.5); // 아바타 크기를 더 작게 조정
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

    // 비디오와 캔버스를 같은 위치에 배치하기 위해 카메라 위치 조정
    camera.position.z = 2; // 카메라 Z 위치 조정
    initializeFaceLandmarker();
    animate();
});
