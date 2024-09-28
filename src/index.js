import {
    FaceLandmarker,
    FilesetResolver,
} from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import './styles.css';

document.addEventListener("DOMContentLoaded", async () => {
    // 비디오 요소 생성
    const video = document.createElement('video');
    video.width = 640; // 비디오 너비 설정
    video.height = 480; // 비디오 높이 설정
    video.autoplay = true; // 자동 재생 설정
    video.style.position = "absolute"; // 절대 위치로 설정
    video.style.top = "0"; // 화면 상단에 위치
    video.style.left = "0"; // 화면 왼쪽에 위치
    video.style.transform = "scaleX(-1)"; // 거울처럼 보이도록 가로 반전
    video.style.zIndex = "1"; // 비디오가 아바타 뒤에 가도록 설정

    // 카메라 스트림 설정
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;

    // 비디오 요소 추가
    document.body.appendChild(video);

    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");

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
                // 좌표계를 반전
                avatar.position.set(-headLandmark.x * 2 + 1, headLandmark.y * 2 - 1, headLandmark.z * 2);
            }
        } else {
            console.warn("유효한 얼굴 랜드마크가 없습니다.");
        }
    };



    const loadAvatarModel = (url) => {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            avatar = gltf.scene;
            avatar.scale.set(1.5, 1.5, 1.5); // 아바타 크기를 1.5배로 조정
            scene.add(avatar);

            // 손 숨기기
            const LeftHand = avatar.getObjectByName("LeftHand");
            const RightHand = avatar.getObjectByName("RightHand");
            if (LeftHand) LeftHand.scale.set(0, 0, 0);
            if (RightHand) RightHand.scale.set(0, 0, 0);
        }, undefined, (error) => {
            console.error("모델 로딩 실패:", error);
        });
    };

    loadAvatarModel("https://models.readyplayer.me/6460691aa35b2e5b7106734d.glb?morphTargets=ARKit");

    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };

    // 비디오 재생
    video.onloadedmetadata = () => {
        video.play().catch(error => {
            console.error("비디오 재생 오류:", error);
        });
    };

    // 비디오와 캔버스를 같은 위치에 배치하기 위해 카메라 위치 조정
    camera.position.z = 1.5; // 카메라 Z 위치 조정
    initializeFaceLandmarker();
    animate();
});
