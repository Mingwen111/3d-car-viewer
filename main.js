import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, model;
let isRecording = false;
let gif;

function init() {
    // 创建场景
    scene = new THREE.Scene();
    
    // 创建渐变背景
    const gradient = new THREE.Texture(generateGradientTexture());
    gradient.needsUpdate = true;
    scene.background = gradient;

    // 创建相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#canvas'),
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; // 增加曝光度
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 添加轨道控制
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = false;
    controls.minDistance = 2;
    controls.maxDistance = 20;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.enablePan = false;

    // 增强光照效果
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.bias = -0.001;
    scene.add(directionalLight);

    // 补充光源
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // 添加环境光遮蔽和边缘光照
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // 加载模型
    const loadingElem = document.querySelector('#loading');
    const loader = new GLTFLoader();

    loader.load(
        './scene.glb',
        function (gltf) {
            console.log('模型加载成功:', gltf);
            model = gltf.scene;

            // 优化模型材质
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        child.material.needsUpdate = true;
                        child.material.roughness = 0.4;
                        child.material.metalness = 0.8;
                        child.material.envMapIntensity = 2.0;
                        
                        if (child.material.map) {
                            child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        }
                    }
                }
            });

            scene.add(model);
            
            // 自动调整相机位置以适应模型
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log('模型尺寸:', size);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
            
            // 设置默认视角
            setDefaultView(cameraZ, center, size);
            
            loadingElem.style.display = 'none';
        },
        function (xhr) {
            const progress = (xhr.loaded / xhr.total * 100);
            loadingElem.textContent = `加载中: ${Math.round(progress)}%`;
        },
        function (error) {
            console.error('加载模型时出错:', error);
            loadingElem.textContent = '加载失败: ' + error.message;
        }
    );

    // 添加环境贴图
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    animate();
}

// 生成渐变背景纹理
function generateGradientTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;

    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(1, 1, 0, 1, 1, 1);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#000000');

    context.fillStyle = gradient;
    context.fillRect(0, 0, 2, 2);

    return canvas;
}

// 视角控制函数
function setDefaultView(cameraZ, center, size) {
    camera.position.set(cameraZ * 0.5, cameraZ * 0.5, cameraZ * 0.5);
    controls.target.copy(center);
    controls.update();
}

function setTopView(size) {
    const y = Math.max(size.x, size.z) * 2;
    camera.position.set(0, y, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

function setSideView(size) {
    const z = Math.max(size.x, size.y) * 2;
    camera.position.set(0, size.y / 2, z);
    controls.target.set(0, size.y / 2, 0);
    controls.update();
}

function setDriverView(size) {
    // 假设驾驶位置在车辆前部偏左
    camera.position.set(-size.x * 0.3, size.y * 0.8, -size.z * 0.1);
    controls.target.set(size.x * 0.5, size.y * 0.7, -size.z * 2);
    controls.update();
}

// 添加视角切换事件监听器
document.getElementById('topView').addEventListener('click', function() {
    if (model) {
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        setTopView(size);
    }
});

document.getElementById('sideView').addEventListener('click', function() {
    if (model) {
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        setSideView(size);
    }
});

document.getElementById('driverView').addEventListener('click', function() {
    if (model) {
        const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        setDriverView(size);
    }
});

// ... 其余代码保持不变 ...
