import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, controls, model;
let isRecording = false;
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

function setTopView(size) {
    const y = Math.max(size.x, size.z) * 1.5;
    camera.position.set(0, y, 0);
    camera.up.set(0, 0, -1); // 确保相机方向正确
    controls.target.set(0, 0, 0);
    camera.lookAt(0, 0, 0);
    controls.update();
}

function setSideView(size) {
    const z = Math.max(size.x, size.y) * 1.5;
    camera.position.set(0, size.y * 0.5, z);
    camera.up.set(0, 1, 0);
    controls.target.set(0, size.y * 0.5, 0);
    camera.lookAt(0, size.y * 0.5, 0);
    controls.update();
}

function setDriverView(size) {
    camera.position.set(-size.x * 0.3, size.y * 0.8, size.z * 0.1);
    camera.up.set(0, 1, 0);
    controls.target.set(size.x * 0.5, size.y * 0.7, -size.z);
    camera.lookAt(size.x * 0.5, size.y * 0.7, -size.z);
    controls.update();
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

// 截图功能
document.getElementById('screenshot').addEventListener('click', function() {
    const link = document.createElement('a');
    link.download = 'car-screenshot.png';
    link.href = renderer.domElement.toDataURL('image/png');
    link.click();
});

// GIF录制功能
document.getElementById('recordGif').addEventListener('click', function() {
    gif = new GIF({
        workers: 2,
        quality: 10,
        width: window.innerWidth,
        height: window.innerHeight
    });
    
    isRecording = true;
});

document.getElementById('stopGif').addEventListener('click', function() {
    isRecording = false;
    
    gif.on('finished', function(blob) {
        const link = document.createElement('a');
        link.download = 'car-animation.gif';
        link.href = URL.createObjectURL(blob);
        link.click();
    });
    
    gif.render();
});

init();
