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

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#canvas'),
        preserveDrawingBuffer: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // 添加轨道控制
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // 加载模型
    const loadingElem = document.querySelector('#loading');
    
    // 创建加载管理器
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (url, loaded, total) => {
        console.log(`正在加载: ${url}`);
        console.log(`加载进度: ${(loaded / total * 100)}%`);
    };
    
    loadingManager.onError = (url) => {
        console.error('加载出错:', url);
        loadingElem.textContent = '加载失败，请检查模型文件路径';
    };

    // 使用加载管理器创建加载器
    const loader = new GLTFLoader(loadingManager);

    loader.load(
        './scene.glb',
        function (gltf) {
            console.log('模型加载成功:', gltf);
            // 确保模型的材质能找到贴图
            gltf.scene.traverse((child) => {
                if (child.isMesh) {
                    if (child.material) {
                        // 更新贴图路径并设置编码
                        if (child.material.map) {
                            child.material.map.encoding = THREE.sRGBEncoding;
                            // 确保贴图路径正确
                            const mapPath = child.material.map.image.src;
                            console.log('贴图路径:', mapPath);
                        }
                        if (child.material.normalMap) {
                            child.material.normalMap.encoding = THREE.LinearEncoding;
                        }
                        // 启用阴影
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                }
            });
            model = gltf.scene;
            scene.add(model);
            
            // 自动调整相机位置以适应模型
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            console.log('模型尺寸:', size);
            
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = camera.fov * (Math.PI / 180);
            let cameraZ = Math.abs(maxDim / Math.sin(fov / 2));
            
            camera.position.z = cameraZ * 1.5;
            camera.updateProjectionMatrix();
            
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

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    
    if (isRecording) {
        gif.addFrame(renderer.domElement, {delay: 100, copy: true});
    }
}

// 窗口大小调整
window.addEventListener('resize', onWindowResize, false);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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
