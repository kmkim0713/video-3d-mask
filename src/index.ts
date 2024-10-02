import {
    FaceLandmarker,
    FilesetResolver,
    DrawingUtils,
    FaceLandmarkerResult
} from "@mediapipe/tasks-vision";
import './styles.css'; // CSS 파일 가져오기
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { decomposeMatrix } from "./utils/decomposeMatrix";

class AvatarManager {
    private scene: THREE.Scene;
    private model: THREE.Group | null = null; // 모델을 저장할 변수
    private isModelLoaded = false;
    private renderer: THREE.WebGLRenderer;
    private camera: THREE.PerspectiveCamera;
    private videoElement: HTMLVideoElement; // 비디오 요소 추가
    private backgroundCanvasElement: HTMLCanvasElement; // 비디오 요소 추가
    private backgroundImage: HTMLImageElement;
    private stream: MediaStream; // 미디어 스트림 추가

    constructor() {
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        // this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.3, 1); // Y 위치를 조정하여 아바타와 카메라를 더 가까이

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        // 비디오 요소 생성
        this.videoElement = document.createElement('video');
        this.videoElement.autoplay = true;
        this.videoElement.muted = true; // 비디오 음소거
        this.videoElement.width = 640; // 비디오 너비 설정
        this.videoElement.height = 480; // 비디오 높이 설정
        this.videoElement.style.position = 'absolute';
        this.videoElement.style.zIndex = '10';


        // 비디오 요소에 renderer의 stream을 연결
        this.stream = this.renderer.domElement.captureStream(30); // 30 FPS
        this.videoElement.srcObject = this.stream;


        this.backgroundCanvasElement = document.createElement('canvas');
        this.backgroundCanvasElement.width = 640;
        this.backgroundCanvasElement.height = 480;
        this.backgroundCanvasElement.style.position = 'absolute';
        this.backgroundCanvasElement.style.zIndex = '1';


        this.backgroundImage = new Image();
        this.setbackGroundImage('./cozy_room_1.jpg');

        document.body.appendChild(this.videoElement); // 비디오 요소를 DOM에 추가
        document.body.appendChild(this.backgroundCanvasElement); // 비디오 요소를 DOM에 추가

        // 부드러운 환경광 추가
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // 부드러운 환경광
        this.scene.add(ambientLight);

        // 방향광 추가
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1); // 방향광
        directionalLight.position.set(1, 1, 1).normalize();
        this.scene.add(directionalLight);

    }


    setbackGroundImage(imageUrl: string) {
        const ctx = this.backgroundCanvasElement.getContext('2d');
        this.backgroundImage.src = imageUrl;

        this.backgroundImage.onload = () => {
            ctx?.drawImage(this.backgroundImage, 0, 0, this.backgroundCanvasElement.width, this.backgroundCanvasElement.height);
        };

    }


    loadModel = async (url: string) => {
        const loader = new GLTFLoader();
        return await new Promise((resolve, reject) => {
            loader.load(
                url,
                (gltf) => {
                    this.model = gltf.scene;
                    this.model.traverse((obj) => (obj.frustumCulled = false));

                    // 모델 크기 조정
                    this.model.scale.set(0.7, 0.7, 0.7);
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

    updateBlendShapes = (results: FaceLandmarkerResult, flipped = true) => {
        if (!results.faceBlendshapes) return;

        const blendShapes = results.faceBlendshapes[0]?.categories;
        if (!blendShapes) return;

        this.scene.traverse((obj) => {
            if ("morphTargetDictionary" in obj && "morphTargetInfluences" in obj) {
                const morphTargetDictionary = obj['morphTargetDictionary'] as {
                    [key: string]: number;
                };
                const morphTargetInfluences = obj['morphTargetDictionary'] as Array<number>;

                for (const { score, categoryName } of blendShapes) {
                    let updatedCategoryName = categoryName;
                    if (flipped && categoryName.includes("Left")) {
                        updatedCategoryName = categoryName.replace("Left", "Right");
                    } else if (flipped && categoryName.includes("Right")) {
                        updatedCategoryName = categoryName.replace("Right", "Left");
                    }
                    const index = morphTargetDictionary[updatedCategoryName];
                    morphTargetInfluences[index] = score;
                }
            }
        });
    };

    updateFacialTransforms = (results: FaceLandmarkerResult, flipped = true) => {
        if (!results || !this.isModelLoaded) return;
        this.updateTranslation(results, flipped);
        this.updateBlendShapes(results, flipped); // blend shapes 업데이트 호출
    };

    updateTranslation = (results: FaceLandmarkerResult, flipped = true) => {
        try {
            if (!results.facialTransformationMatrixes) return;
            const matrixes = results.facialTransformationMatrixes[0]?.data;
            const matrix4x4 = new THREE.Matrix4().fromArray(matrixes);

            // Matrix 분해
            const { translation, rotation, scale } = decomposeMatrix(matrixes);
            const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z, "ZYX");
            const quaternion = new THREE.Quaternion().setFromEuler(euler);

            if (!flipped) {
                quaternion.y *= -1;
                quaternion.z *= -1;
                translation.x *= -1;
            }

            // Y 위치 조정
            translation.y -= 0.2; // 필요에 따라 조정

            const head = this.model?.getObjectByName("Head");
            if (head) {
                head.quaternion.slerp(quaternion, 1.0);
            }

            const root = this.model?.getObjectByName("AvatarRoot");
            if (root) {
                // Adjust scale to a value that keeps the character within view
                const scaleFactor = Math.min(3.0, 2.0 / Math.max(translation.z, 0.1)); // Scale based on depth
                root.scale.set(scaleFactor, scaleFactor, scaleFactor);

                root.position.set(
                    translation.x * 0.01,
                    translation.y * 0.01,
                    (translation.z + 50) * 0.02
                );
            }
        } catch (e) {
            // console.error(e);
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
    const video = document.createElement("video");
    video.width = 640; // 원하는 비디오 너비
    video.height = 480; // 원하는 비디오 높이
    video.autoplay = true; // 자동 재생 설정
    video.style.display = "none"; // 화면에 보이지 않도록 설정

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) {
        console.error("Canvas 2D context를 가져오는 데 실패했습니다.");
        return;
    }

    const drawingUtils = new DrawingUtils(ctx);
    const avatarManager = new AvatarManager(); // 비디오 요소를 AvatarManager에 전달

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;

            video.onloadedmetadata = async () => {
                console.log("비디오 메타데이터 로드됨:", video.videoWidth, video.videoHeight);
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;

                // 랜드마크 모델 초기화
                await avatarManager.loadModel("https://models.readyplayer.me/66f66a234da54a5409984e8f.glb");
                // await avatarManager.loadModel("./sample_model.glb"); // 나중에 직접 다운로드해서 넣는 방법 강구 필요
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
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", // 추후 다운로드 변경 가능
                    delegate: "GPU", // GPU를 사용
                },
                outputFaceBlendshapes: true, // Blendshapes 출력
                outputFacialTransformationMatrixes: true, // Facial Transformation Matrixes 출력
                runningMode: "VIDEO", // 비디오 모드로 설정
                numFaces: 1, // 감지할 얼굴 수
            }
        );

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
