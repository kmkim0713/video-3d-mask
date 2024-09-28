import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils
} from "@mediapipe/tasks-vision";
import * as THREE from "three"; // Three.js 임포트
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader"; // GLTF 로더 임포트
import './styles.css'; // CSS 파일 가져오기

document.addEventListener("DOMContentLoaded", async () => {
    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    const drawingUtils = new DrawingUtils(ctx);

    // Three.js 장면 설정
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 조명 추가
    const light = new THREE.DirectionalLight(0xffffff, 1); // 흰색 방향광
    light.position.set(0, 1, 1); // 조명 위치
    scene.add(light);

    let avatar; // 아바타를 저장할 변수

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
        // 얼굴 랜드마크가 있는 경우 첫 번째 랜드마크를 사용
        if (faceLandmarks.length > 0) {
            const headLandmark = faceLandmarks[0]; // [0][0]을 통해 첫 번째 얼굴 랜드마크 가져오기
            // 아바타의 위치를 랜드마크에 맞춰 업데이트
            if (avatar) {
                // 아바타의 위치 조정
                avatar.position.set(headLandmark.x * 2 - 1, -headLandmark.y * 2 + 1, headLandmark.z * 2); // 3D 공간에 맞게 조정
                avatar.position.z += 1; // 아바타가 카메라 쪽으로 더 가깝게 조정
                console.log("Avatar Position Updated:", avatar.position); // 아바타 위치 로그
            }
        } else {
            console.warn("유효한 얼굴 랜드마크가 없습니다.");
        }
    };

    const loadAvatarModel = (url) => {
        const loader = new GLTFLoader();
        loader.load(url, (gltf) => {
            avatar = gltf.scene;
            avatar.scale.set(0.1, 0.1, 0.1); // 아바타의 크기를 조정
            avatar.position.set(0, 0, 0); // 아바타의 초기 위치 설정
            scene.add(avatar); // 장면에 아바타 추가
            console.log("Avatar Loaded Successfully:", avatar); // 로드된 아바타 로그
        }, undefined, (error) => {
            console.error("모델 로딩 실패:", error);
        });
    };

    loadAvatarModel("https://models.readyplayer.me/6460691aa35b2e5b7106734d.glb?morphTargets=ARKit"); // 여기에 아바타 모델 URL을 입력

    // 카메라 위치 설정
    camera.position.set(0, 1, 3); // 카메라를 위로 올려서 아바타를 볼 수 있도록
    camera.lookAt(0, 0, 0); // 카메라가 아바타를 바라보도록

    // 애니메이션 루프 설정
    const animate = () => {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    };

    animate(); // 렌더링 루프 시작
});
