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

// 카메라 설정
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5); // Z축으로 5만큼 이동하여 카메라가 앞을 바라보게 설정

const renderer = new THREE.WebGLRenderer(); // WebGL 렌더러 생성
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement); // 렌더러의 DOM 요소를 추가

// 조명 설정
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 환경광
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 방향성 조명
directionalLight.position.set(0, 1, 1).normalize();
scene.add(directionalLight);

document.addEventListener("DOMContentLoaded", async () => {
    const video = document.getElementById("video") as HTMLVideoElement;
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Canvas 2D context를 가져오는 데 실패했습니다.");
        return;
    }

    // 카메라 스트림 설정
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.play();
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
        const faceLandmarker = await FaceLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU",
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: "VIDEO",
                numFaces: 1,
            }
        );

        // 아바타 모델 로드
        avatar = await loadAvatarModel('https://models.readyplayer.me/6460691aa35b2e5b7106734d.glb?morphTargets=ARKit');
        scene.add(avatar); // 아바타를 씬에 추가

        // 랜드마크 인식 및 그리기
        detectLandmarks(faceLandmarker);
    };

    const loadAvatarModel = async (url: string): Promise<THREE.Group> => {
        const gltf = await loadGltf(url);
        console.log('모델이 로드되었습니다:', gltf); // 모델 로드 확인
        gltf.scene.traverse((obj) => {
            obj.frustumCulled = false; // 프러스텀 컬링 비활성화
        });

        // 손 모델 비활성화
        const LeftHand = gltf.scene.getObjectByName("LeftHand");
        const RightHand = gltf.scene.getObjectByName("RightHand");
        LeftHand?.scale.set(0, 0, 0);
        RightHand?.scale.set(0, 0, 0);

        return gltf.scene as THREE.Group;
    };

    const detectLandmarks = async (faceLandmarker: FaceLandmarker) => {
        const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, Date.now());
        if (results.faceLandmarks) {
            updateAvatarPosition(results); // 얼굴 랜드마크에 따라 아바타 위치 업데이트
        }

        // 렌더링
        renderer.render(scene, camera);
        requestAnimationFrame(() => detectLandmarks(faceLandmarker));
    };

    const updateAvatarPosition = (results: FaceLandmarkerResult, flipped = true) => {
        if (!avatar) {
            console.error('아바타가 로드되지 않았습니다.');
            return;
        }

        // facialTransformationMatrixes 확인
        if (!results.facialTransformationMatrixes || results.facialTransformationMatrixes.length === 0) {
            console.warn("facialTransformationMatrixes 데이터가 없습니다."); // 디버깅용 로그
            return;
        }

        const matrixes = results.facialTransformationMatrixes[0]?.data;
        if (!matrixes) {
            console.warn("facialTransformationMatrixes의 첫 번째 요소에 데이터가 없습니다."); // 디버깅용 로그
            return;
        }

        const { translation, rotation, scale } = decomposeMatrix(matrixes);
        const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, "ZYX");
        const quaternion = new THREE.Quaternion().setFromEuler(euler);

        if (flipped) {
            // x축 플립
            quaternion.y *= -1;
            quaternion.z *= -1;
            translation.x *= -1;
        }

        // 아바타의 위치 조정
        avatar.position.set(
            translation.x * 0.01,
            translation.y * 0.01,
            (translation.z + 50) * 0.02
        );

        // Head 회전 업데이트
        const head = avatar.getObjectByName("Head");
        if (head) {
            head.quaternion.slerp(quaternion, 0.1); // 부드럽게 회전
        }
    };
});
