import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, model;
let isRecording = false;
let gif;

function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    // 创建相机
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // 创建渲染器 - 提高清晰度
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#canvas'),
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // 提高清晰度
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 更柔和的阴影

    // 添加轨道控制 - 优化交互
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 平滑移动
    controls.dampingFactor = 0.05; // 阻尼系数
    controls.rotateSpeed = 0.5; // 旋转速度
    controls.zoomSpeed = 1.2; // 缩放速度
    controls.panSpeed = 0.8; // 平移速度
    controls.screenSpacePanning = false; // 保持垂直平移
    controls.minDistance = 2; // 最小缩放距离
    controls.maxDistance = 20; // 最大缩放距离
    controls.maxPolarAngle = Math.PI / 1.5; // 限制垂直旋转角度
    controls.enablePan = false; // 禁用平移，始终以模型为中心

    // 添加灯光 - 提高清晰度
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // 添加补充光源
    const backLight = new THREE.DirectionalLight(0xffffff, 0.5);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

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
                        // 提高材质质量
                        child.material.roughness = 0.7;
                        child.material.metalness = 0.3;
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
            
            camera.position.set(cameraZ * 0.5, cameraZ * 0.5, cameraZ * 0.5); // 设置一个更好的初始视角
            camera.updateProjectionMatrix();
            
            // 设置控制器目标点为模型中心
            controls.target.copy(center);
            controls.update();
            
            loadingElem.style.display = 'none';
        },
        function (xhr) {
            const progress = (xhr.loaded / xhr.total * 100);
            loadingElem.textContent = `加载中: ${Math.round(progress)}%`;
            console.log(`加载进度: ${progress}%`);
        },
        function (error) {
            console.error('加载模型时出错:', error);
            loadingElem.textContent = '加载失败: ' + error.message;
        }
    );

    animate();
}

// 优化动画循环
let previousTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    // 限制帧率
    const deltaTime = currentTime - previousTime;
    if (deltaTime < frameInterval) return;

    previousTime = currentTime - (deltaTime % frameInterval);

    controls.update();
    renderer.render(scene, camera);
    
    if (isRecording) {
        gif.addFrame(renderer.domElement, {delay: 100, copy: true});
    }
}

// 优化窗口调整响应
let resizeTimeout;
window.addEventListener('resize', function() {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(onWindowResize, 100);
}, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

// 其余代码保持不变...

init();
