// ... 前面的代码保持不变 ...

    // 创建渲染器 - 进一步提高清晰度
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#canvas'),
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        logarithmicDepthBuffer: true // 提高深度缓冲精度
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制最大像素比以平衡性能
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; // 添加电影级色调映射
    renderer.toneMappingExposure = 1.2; // 提高整体亮度
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 柔和阴影

    // ... OrbitControls 配置保持不变 ...

    // 增强光照效果
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0); // 提高环境光强度
    scene.add(ambientLight);

    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 4096; // 提高阴影质量
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.bias = -0.001; // 减少阴影瑕疵
    scene.add(directionalLight);

    // 补充光源
    const backLight = new THREE.DirectionalLight(0xffffff, 0.7);
    backLight.position.set(-5, 5, -5);
    scene.add(backLight);

    // 添加环境光遮蔽和边缘光照
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // ... 加载模型部分 ...

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
                        child.material.roughness = 0.5; // 降低粗糙度
                        child.material.metalness = 0.6; // 提高金属感
                        child.material.envMapIntensity = 1.5; // 增强环境反射
                        
                        // 启用抗锯齿
                        if (child.material.map) {
                            child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
                        }
                    }
                }
            });

            // ... 其余代码保持不变 ...
        },
        // ... 其余代码保持不变 ...
    );

    // 添加环境贴图以增强反射效果
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // 创建简单的环境贴图
    const ambientLight2 = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight2);

    // ... 其余代码保持不变 ...
