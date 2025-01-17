import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 全局变量
let scene, camera, renderer, controls, model;
let isRecording = false;
let recordStartTime;
let recordTimer;
let gif;
let resizeTimeout;

// 主要的初始化和设置函数
function initScene(canvas) {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.8;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controls.screenSpacePanning = false;
    controls.minDistance = 3;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.minPolarAngle = Math.PI / 6;
    controls.enablePan = false;
    controls.mouseButtons = {
        RIGHT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        LEFT: null
    };
    controls.touches = {
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN
    };

    setupLights();
}

function setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.bias = -0.001;
    scene.add(directionalLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);
}

function loadModel(loadingElem) {
    const loader = new GLTFLoader();
    loader.load(
        './scene.glb',
        function (gltf) {
            console.log('模型加载成功:', gltf);
            model = gltf.scene;

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
            
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
            
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
}

// 视角控制函数
function setDefaultView(cameraZ, center, size) {
    camera.position.set(cameraZ * 0.5, cameraZ * 0.5, cameraZ * 0.5);
    controls.target.copy(center);
    controls.update();
}

// 自定义缓动函数，实现平滑的加速和减速
function customEasing(x) {
    // 前50ms加速（0-0.1）
    if (x < 0.1) {
        // 使用三次方曲线实现更平滑的加速
        return Math.pow(x / 0.1, 3);
    }
    // 后50ms减速（0.9-1.0）
    if (x > 0.9) {
        // 使用三次方曲线实现更平滑的减速
        const t = (1 - x) / 0.1;
        return 1 - Math.pow(t, 3);
    }
    // 中间400ms线性插值（0.1-0.9）
    // 使用余弦插值使过渡更平滑
    const t = (x - 0.1) / 0.8;
    return 0.1 + t * 0.8;
}

function animateCamera(targetPosition, targetLookAt, duration = 500) { // 改为500ms
    const startPosition = camera.position.clone();
    const startRotation = camera.quaternion.clone();
    
    const tempCamera = camera.clone();
    tempCamera.position.copy(targetPosition);
    tempCamera.lookAt(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    const targetRotation = tempCamera.quaternion;

    const startTime = performance.now();

    function update() {
        const currentTime = performance.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = customEasing(progress);

        // 使用球面插值使旋转更平滑
        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        camera.quaternion.slerpQuaternions(startRotation, targetRotation, easeProgress);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            controls.target.copy(targetLookAt);
            controls.update();
        }
    }

    update();
}

function setTopView(size) {
    const targetPosition = new THREE.Vector3(0, Math.max(size.x, size.z) * 1.5, 0);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    camera.up.set(0, 0, -1);
    animateCamera(targetPosition, targetLookAt);
}

function setSideView(size) {
    const targetPosition = new THREE.Vector3(0, size.y * 0.5, Math.max(size.x, size.y) * 1.5);
    const targetLookAt = new THREE.Vector3(0, size.y * 0.5, 0);
    camera.up.set(0, 1, 0);
    animateCamera(targetPosition, targetLookAt);
}

function setDriverView(size) {
    const targetPosition = new THREE.Vector3(0, size.y * 2.5, -size.z * 0.5);
    const targetLookAt = new THREE.Vector3(0, 0, size.z * 0.5);
    camera.up.set(0, 1, 0);
    animateCamera(targetPosition, targetLookAt);
}

// 动画和渲染
let previousTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

function animate(currentTime = 0) {
    requestAnimationFrame(animate);

    const deltaTime = currentTime - previousTime;
    if (deltaTime < frameInterval) return;

    previousTime = currentTime - (deltaTime % frameInterval);

    controls.update();
    
    if (isRecording) {
        const currentBackground = scene.background;
        scene.background = null;
        renderer.render(scene, camera);
        scene.background = currentBackground;
        
        gif.addFrame(renderer.domElement, {
            delay: 100,
            copy: true,
            transparent: true
        });
    } else {
        renderer.render(scene, camera);
    }
}

// 事件处理函数
function handleResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
}

function handleScreenshot() {
    const currentBackground = scene.background;
    scene.background = null;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = renderer.domElement.width;
    tempCanvas.height = renderer.domElement.height;
    const tempContext = tempCanvas.getContext('2d');

    renderer.render(scene, camera);
    tempContext.drawImage(renderer.domElement, 0, 0);

    const link = document.createElement('a');
    link.download = 'car-screenshot.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();

    scene.background = currentBackground;
    renderer.render(scene, camera);
}

function handleGifRecording(button, timerDisplay) {
    if (!isRecording) {
        gif = new GIF({
            workers: 2,
            quality: 10,
            width: window.innerWidth,
            height: window.innerHeight,
            transparent: 'rgba(0,0,0,0)'
        });
        
        const currentBackground = scene.background;
        scene.background = null;
        
        isRecording = true;
        recordStartTime = Date.now();
        button.textContent = '停止录制';
        button.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        timerDisplay.style.display = 'inline';
        
        recordTimer = setInterval(() => {
            const elapsed = Date.now() - recordStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            timerDisplay.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
    } else {
        isRecording = false;
        clearInterval(recordTimer);
        button.textContent = '开始录制';
        button.style.backgroundColor = '';
        timerDisplay.style.display = 'none';
        timerDisplay.textContent = '00:00';
        
        gif.on('finished', function(blob) {
            const link = document.createElement('a');
            link.download = 'car-animation.gif';
            link.href = URL.createObjectURL(blob);
            link.click();
            
            scene.background = new THREE.Color(0x000000);
            renderer.render(scene, camera);
        });
        
        gif.render();
    }
}

// 初始化和事件绑定
document.addEventListener('DOMContentLoaded', function() {
    const canvas = document.querySelector('#canvas');
    const loadingElem = document.querySelector('#loading');
    const topViewBtn = document.getElementById('topView');
    const sideViewBtn = document.getElementById('sideView');
    const driverViewBtn = document.getElementById('driverView');
    const screenshotBtn = document.getElementById('screenshot');
    const recordGifBtn = document.getElementById('recordGif');
    const recordTimerElem = document.getElementById('recordTimer');

    if (!canvas || !loadingElem || !topViewBtn || !sideViewBtn || 
        !driverViewBtn || !screenshotBtn || !recordGifBtn || !recordTimerElem) {
        console.error('必需的 DOM 元素未找到');
        return;
    }

    // 初始化场景
    initScene(canvas);
    loadModel(loadingElem);

    // 绑定事件监听器
    window.addEventListener('resize', () => {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(handleResize, 100);
    });

    topViewBtn.addEventListener('click', () => {
        if (model) {
            const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
            setTopView(size);
        }
    });

    sideViewBtn.addEventListener('click', () => {
        if (model) {
            const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
            setSideView(size);
        }
    });

    driverViewBtn.addEventListener('click', () => {
        if (model) {
            const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
            setDriverView(size);
        }
    });

    screenshotBtn.addEventListener('click', handleScreenshot);
    recordGifBtn.addEventListener('click', () => handleGifRecording(recordGifBtn, recordTimerElem));

    // 开始动画循环
    animate();
}); 
