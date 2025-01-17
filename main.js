// ... 前面的代码保持不变 ...

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector('#canvas'),
        preserveDrawingBuffer: true,
        antialias: true,
        alpha: true,  // 启用透明
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

// ... 中间的代码保持不变 ...

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

// 修改动画循环函数
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
