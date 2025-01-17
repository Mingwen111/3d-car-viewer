import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, model;
let isRecording = false;
let recordStartTime;
let recordTimer;
let gif;

function init() {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // 设置黑色背景
    
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0); // 设置透明背景

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
    setupViewControls();
}

// 视角控制函数
function setDefaultView(cameraZ, center, size) {
    camera.position.set(cameraZ * 0.5, cameraZ * 0.5, cameraZ * 0.5);
    controls.target.copy(center);
    controls.update();
}

// 视角动画控制
function animateCamera(targetPosition, targetLookAt, duration = 1000) {
    const startPosition = camera.position.clone();
    const startRotation = camera.quaternion.clone();
    
    // 创建临时相机来获取目标旋转
    const tempCamera = camera.clone();
    tempCamera.position.copy(targetPosition);
    tempCamera.lookAt(targetLookAt.x, targetLookAt.y, targetLookAt.z);
    const targetRotation = tempCamera.quaternion;

    const startTime = performance.now();

    function update() {
        const currentTime = performance.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用缓动函数使动画更平滑
        const easeProgress = easeInOutCubic(progress);

        // 插值位置
        camera.position.lerpVectors(startPosition, targetPosition, easeProgress);
        
        // 插值旋转
        camera.quaternion.slerpQuaternions(startRotation, targetRotation, easeProgress);

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            // 动画结束后更新控制器
            controls.target.copy(targetLookAt);
            controls.update();
        }
    }

    update();
}

// 缓动函数
function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
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
    const targetPosition = new THREE.Vector3(-size.x * 0.3, size.y * 0.8, size.z * 0.1);
    const targetLookAt = new THREE.Vector3(size.x * 0.5, size.y * 0.7, -size.z);
    camera.up.set(0, 1, 0);
    animateCamera(targetPosition, targetLookAt);
}

// 修改视角切换事件监听器
function setupViewControls() {
    document.getElementById('topView').addEventListener('click', function() {
        if (model) {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            setTopView(size);
        }
    });

    document.getElementById('sideView').addEventListener('click', function() {
        if (model) {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            setSideView(size);
        }
    });

    document.getElementById('driverView').addEventListener('click', function() {
        if (model) {
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            setDriverView(size);
        }
    });
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
    
    // 如果正在录制，临时移除背景
    if (isRecording) {
        const currentBackground = scene.background;
        scene.background = null;
        renderer.render(scene, camera);
        scene.background = currentBackground;
    } else {
        renderer.render(scene, camera);
    }
    
    if (isRecording) {
        gif.addFrame(renderer.domElement, {
            delay: 100,
            copy: true,
            transparent: true
        });
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

// 截图功能
document.getElementById('screenshot').addEventListener('click', function() {
    // 临时存储当前背景
    const currentBackground = scene.background;
    scene.background = null;

    // 使用临时画布来处理透明背景
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = renderer.domElement.width;
    tempCanvas.height = renderer.domElement.height;
    const tempContext = tempCanvas.getContext('2d');

    // 渲染当前帧
    renderer.render(scene, camera);

    // 将渲染结果复制到临时画布
    tempContext.drawImage(renderer.domElement, 0, 0);

    // 创建下载链接
    const link = document.createElement('a');
    link.download = 'car-screenshot.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();

    // 恢复背景
    scene.background = currentBackground;
    renderer.render(scene, camera);
});

// GIF录制功能
document.getElementById('recordGif').addEventListener('click', function() {
    const button = this;
    const timerDisplay = document.getElementById('recordTimer');

    if (!isRecording) {
        // 开始录制
        gif = new GIF({
            workers: 2,
            quality: 10,
            width: window.innerWidth,
            height: window.innerHeight,
            transparent: 'rgba(0,0,0,0)' // 设置透明背景
        });
        
        // 存储当前背景
        const currentBackground = scene.background;
        scene.background = null;
        
        isRecording = true;
        recordStartTime = Date.now();
        button.textContent = '停止录制';
        button.style.backgroundColor = 'rgba(255, 0, 0, 0.2)';
        timerDisplay.style.display = 'inline';
        
        // 更新计时器显示
        recordTimer = setInterval(() => {
            const elapsed = Date.now() - recordStartTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            timerDisplay.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
    } else {
        // 停止录制
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
            
            // 恢复背景
            scene.background = new THREE.Color(0x000000);
            renderer.render(scene, camera);
        });
        
        gif.render();
    }
});

init();
