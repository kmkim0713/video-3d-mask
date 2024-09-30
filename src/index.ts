import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils,
    FaceLandmarkerResult
} from "@mediapipe/tasks-vision";
import './styles.css'; // CSS 파일 가져오기
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import {decomposeMatrix} from "./utils/decomposeMatrix";

class AvatarManager {
    private scene: THREE.Scene;
    private model: THREE.Group | null = null; // 모델을 저장할 변수
    private isModelLoaded = false;
    private renderer: THREE.WebGLRenderer;
    private camera: THREE.PerspectiveCamera;

    constructor(videoElement: HTMLVideoElement) {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.renderer.domElement.id = 'canvas-avatar'; // ID 설정

        document.body.appendChild(this.renderer.domElement);
        this.camera.position.z = 1; // 카메라 위치 설정

        // 부드러운 환경광 추가
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 부드러운 환경광
        this.scene.add(ambientLight);

        // 방향광 추가
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 방향광
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);
    }

    loadModel = async (url: string) => {
        const loader = new GLTFLoader();
        return await new Promise((resolve, reject) => {
            loader.load(
                url,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.traverse((obj) => (obj.frustumCulled = false));
                    this.scene.add(this.model);
                    console.log("모델 로드됨:", this.model);
                    // 손을 보이지 않게 설정
                    const LeftHand = this.model.getObjectByName("LeftHand");
                    const RightHand = this.model.getObjectByName("RightHand");
                    LeftHand?.scale.set(0, 0, 0);
                    RightHand?.scale.set(0, 0, 0);
                    this.isModelLoaded = true;
                    resolve(this.model);
                },
                undefined,
                (error) => reject(error)
            );
        });
    };

    updateFacialTransforms = (results: FaceLandmarkerResult, flipped = true) => {
        if (!results || !this.isModelLoaded) return;
        this.updateTranslation(results, flipped);
    };

    updateTranslation = (results: FaceLandmarkerResult, flipped = true) => {
        try {
            if (!results.facialTransformationMatrixes) return;
            const matrixes = results.facialTransformationMatrixes[0]?.data;
            const matrix4x4 = new THREE.Matrix4().fromArray(matrixes);
            // const translation = new THREE.Vector3();
            // const rotation = new THREE.Quaternion();
            // const scale = new THREE.Vector3();

            // matrix4x4.decompose(translation, rotation, scale);

            // 회전 및 위치 조정
            const { translation, rotation, scale } = decomposeMatrix(matrixes);
            const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, "ZYX");
            const quaternion = new THREE.Quaternion().setFromEuler(euler);
            if (flipped) {
                quaternion.y *= -1;
                quaternion.z *= -1;
                translation.x *= -1;
            }

            const head = this.model?.getObjectByName("Head");
            if (head) {
                head.quaternion.slerp(quaternion, 1.0);
            }

            const root = this.model?.getObjectByName("AvatarRoot");
            if (root) {
                root.position.set(
                    translation.x * 0.01,
                    translation.y * 0.01,
                    (translation.z + 50) * 0.02
                );
            }
        } catch (e) {
            console.error(e);
        }
    };

    render = () => {
        if (this.isModelLoaded) {
            this.renderer.render(this.scene, this.camera);
        }
        requestAnimationFrame(this.render);
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    const video = document.getElementById("video") as HTMLVideoElement;
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Canvas 2D context를 가져오는 데 실패했습니다.");
        return;
    }
    const drawingUtils = new DrawingUtils(ctx);
    const avatarManager = new AvatarManager(video); // 비디오 요소를 AvatarManager에 전달

    // 카메라 스트림 설정
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            video.onloadedmetadata = async () => {
                console.log("비디오 메타데이터 로드됨:", video.videoWidth, video.videoHeight);
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                video.play();

                // 랜드마크 모델 초기화
                await avatarManager.loadModel("https://models.readyplayer.me/66f66a234da54a5409984e8f.glb"); // 모델 URL 추가
                avatarManager.render(); // 렌더링 시작
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
        const faceLandmarker = await FaceLandmarker.createFromOptions(
            vision,
            {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU", // GPU를 사용
                },
                outputFaceBlendshapes: true, // Blendshapes 출력
                outputFacialTransformationMatrixes: true, // Facial Transformation Matrixes 출력
                runningMode: "VIDEO", // 비디오 모드로 설정
                numFaces: 1, // 감지할 얼굴 수
            });

        // 랜드마크 인식 및 그리기
        detectLandmarks(faceLandmarker);
    };

    const detectLandmarks = async (faceLandmarker: FaceLandmarker) => {
        const results: FaceLandmarkerResult = faceLandmarker.detectForVideo(video, Date.now());
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (results.faceLandmarks) {
            for (const landmarks of results.faceLandmarks) {
                drawingUtils.drawConnectors(
                    landmarks,
                    FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                    { color: "#C0C0C070", lineWidth: 1.3 }
                );
            }
            // 아바타 매니저 인스턴스를 통해 랜드마크 업데이트
            avatarManager.updateFacialTransforms(results);
        }

        requestAnimationFrame(() => detectLandmarks(faceLandmarker));
    };
});
