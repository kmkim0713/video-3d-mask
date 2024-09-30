import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils,
    FaceLandmarkerResult
} from "@mediapipe/tasks-vision";
import * as THREE from "three";
import { loadGltf } from "./utils/loaders"; // GLTF 로드 유틸리티
import { decomposeMatrix } from "./utils/decomposeMatrix"; // 행렬 분해 유틸리티
import "./styles.css";

const scene = new THREE.Scene(); // 씬 생성

// 카메라 설정: Z축을 뒤로 이동시켜 아바타가 잘 보이도록 함
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5); // Z축으로 5만큼 이동하여 카메라가 앞을 바라보게 설정

const renderer = new THREE.WebGLRenderer(); // WebGL 렌더러 생성
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // 렌더러의 DOM 요소를 추가

// 조명 설정: 기본 조명 추가 (조명이 없으면 모델이 어두워지므로 필수)
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 환경광 (씬 전체에 고르게 조명)
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 방향성 조명
directionalLight.position.set(0, 1, 1).normalize(); // 위에서 비추는 방향 설정
scene.add(directionalLight);

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

    let avatar: THREE.Group | null = null;

    const initializeFaceLandmarker = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
        );
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                delegate: "GPU", // GPU 사용 설정 (가능한 경우)
            },
            outputFaceBlendshapes: true, // 얼굴 블렌드쉐입 출력
            outputFacialTransformationMatrixes: true, // 얼굴 변형 행렬 출력
            runningMode: "VIDEO", // 비디오 모드에서 실행
            numFaces: 1, // 감지할 얼굴의 수
        });

        // 아바타 모델 로드
        avatar = await loadAvatarModel('https://models.readyplayer.me/66f66a234da54a5409984e8f.glb');

        // 랜드마크 인식 및 그리기
        detectLandmarks(faceLandmarker);
    };

    const loadAvatarModel = async (url: string): Promise<THREE.Group> => {
        const gltf = await loadGltf(url);
        console.log('모델이 로드되었습니다:', gltf);  // 로드 확인용 로그
        gltf.scene.traverse((obj) => (obj.frustumCulled = false)); // 프러스텀 컬링 비활성화
        return gltf.scene as THREE.Group;
    };

    const detectLandmarks = async (faceLandmarker: FaceLandmarker) => {
        const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, Date.now());
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.faceLandmarks) {
            // 랜드마크를 기반으로 아바타 위치 및 회전 업데이트
            updateAvatarTransformation(results);

            for (const landmarks of results.faceLandmarks) {
                drawingUtils.drawConnectors(
                    landmarks,
                    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                    { color: "#C0C0C070", lineWidth: 1.3 }
                );
            }
        }

        // 씬 렌더링
        renderer.render(scene, camera);
        requestAnimationFrame(() => detectLandmarks(faceLandmarker));
    };

    const updateAvatarTransformation = (results: FaceLandmarkerResult, flipped = true) => {
        if (!results.facialTransformationMatrixes) {
            console.log("1")
            return;
        }

        const matrixes = results.facialTransformationMatrixes[0]?.data;
        console.log(results)
        console.log(results.facialTransformationMatrixes)

        if (!matrixes) {
            console.log("2")
            return;
        }

        // 행렬을 translation, rotation, scale로 분해
        const { translation, rotation, scale } = decomposeMatrix(matrixes);

        // 회전값을 Euler로 변환하고, 쿼터니언으로 회전 변환
        const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, "ZYX");
        const quaternion = new THREE.Quaternion().setFromEuler(euler);

        // 좌우 반전 (필요 시)
        if (flipped) {
            quaternion.y *= -1;
            quaternion.z *= -1;
            translation.x *= -1;
        }

        // 아바타의 머리 부분(Head)의 회전 업데이트
        const head = scene.getObjectByName("Head");
        if (head) {
            head.quaternion.slerp(quaternion, 1.0);  // 부드럽게 회전
        }

        // 아바타의 전체 위치 (AvatarRoot)의 위치 업데이트
        const root = scene.getObjectByName("AvatarRoot");
        if (root) {
            root.position.set(
                translation.x * 0.01,  // 위치 조정 (필요 시 스케일 조정)
                translation.y * 0.01,
                (translation.z + 50) * 0.02
            );
        }
    };
});
