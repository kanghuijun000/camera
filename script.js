/* =========================================================
   DOM Elements
========================================================= */

const cameraScreen = document.getElementById("cameraScreen");
const galleryScreen = document.getElementById("galleryScreen");
const cameraPreview = document.getElementById("cameraPreview");
const cameraUI = document.getElementById("cameraUI");
const cameraOffScreen = document.getElementById("cameraOffScreen");
const cameraPowerButton = document.getElementById("cameraPowerButton");
const cameraPowerButtonOff = document.getElementById("cameraPowerButtonOff");
const switchCameraButton = document.getElementById("switchCameraButton");
const captureButton = document.getElementById("captureButton");
const burstCounter = document.getElementById("burstCounter");
const galleryButton = document.getElementById("galleryButton");
const galleryBackButton = document.getElementById("galleryBackButton");
const deleteAllButton = document.getElementById("deleteAllButton");
const galleryGrid = document.getElementById("galleryGrid");
const emptyGallery = document.getElementById("emptyGallery");
const emptyIcon = document.getElementById("emptyIcon");
const emptyText = document.getElementById("emptyText");
const cameraError = document.getElementById("cameraError");
const cameraErrorText = document.getElementById("cameraErrorText");
const retryCameraButton = document.getElementById("retryCameraButton");
const photoViewer = document.getElementById("photoViewer");
const photoZoomArea = document.getElementById("photoZoomArea");
const viewerImage = document.getElementById("viewerImage");
const viewerCloseButton = document.getElementById("viewerCloseButton");
const deletePhotoButton = document.getElementById("deletePhotoButton");
const downloadPhotoButton = document.getElementById("downloadPhotoButton");
const cameraZoomIndicator = document.getElementById("cameraZoomIndicator");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const resetZoomButton = document.getElementById("resetZoomButton");
const viewerZoomText = document.getElementById("viewerZoomText");


/* =========================================================
   카메라 변수
========================================================= */

let cameraStream = null;
let cameraTrack = null;
let cameraEnabled = false;
let currentFacingMode = "environment";
let cameraHardwareZoom = false;
let cameraZoom = 1;
const CAMERA_MIN_ZOOM = 1;
const CAMERA_MAX_ZOOM = 5;

let cameraPinchStartDistance = 0;
let cameraPinchStartZoom = 1;

// 저장 상태 트래킹 변수
let isSavingPhotos = false;
let savingPromise = null;

// 재사용 캔버스 & 연사 최적화 비트맵 큐
const reusableCanvas = document.createElement("canvas");
const reusableContext = reusableCanvas.getContext("2d", { alpha: false });
let burstBitmapQueue = [];

// 연사(Long Press) 관련 변수
let burstTimer = null;         // 누름 감지 타이머
let burstInterval = null;      // 연사 실행 간격 타이머
let isBurstMode = false;       // 연사 모드 활성화 여부
let burstCount = 0;            // 현재 연사 장수 카운터
const MAX_BURST_COUNT = 30;    // 최대 연사 장수 제한
const BURST_THRESHOLD = 200;   // 0.2초 이상 누르면 연사 시작
const BURST_INTERVAL = 150;    // 0.15초 간격 촬영


/* =========================================================
   DB & Memory
========================================================= */

let db = null;
let currentPhotoId = null;
let currentPhotoURL = null;
let galleryObjectURLs = [];
let allPhotosList = [];


/* =========================================================
   갤러리 사진 줌/이동/스와이프 변수
========================================================= */

let viewerZoom = 1;
const VIEWER_MIN_ZOOM = 1;
const VIEWER_MAX_ZOOM = 5;
let viewerPositionX = 0;
let viewerPositionY = 0;
let viewerDragging = false;
let viewerDragStartX = 0;
let viewerDragStartY = 0;
let viewerOriginX = 0;
let viewerOriginY = 0;
let viewerPinchStartDistance = 0;
let viewerPinchStartZoom = 1;

let adjacentImage = document.createElement("img");
adjacentImage.style.position = "absolute";
adjacentImage.style.top = "0";
adjacentImage.style.left = "0";
adjacentImage.style.width = "100%";
adjacentImage.style.height = "100%";
adjacentImage.style.objectFit = "contain";
adjacentImage.style.display = "none";
adjacentImage.style.pointerEvents = "none";

if (photoZoomArea) {
    photoZoomArea.appendChild(adjacentImage);
}

let swipeStartX = 0;
let swipeStartY = 0;
let swipeCurrentX = 0;
let isSwiping = false;
let adjacentPhotoURL = null;


/* =========================================================
   IndexedDB
========================================================= */

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("StandaloneCameraDatabase", 1);

        request.onupgradeneeded = function(event) {
            const database = event.target.result;
            if (!database.objectStoreNames.contains("photos")) {
                database.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = () => reject(request.error);
    });
}

function savePhoto(blob) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("photos", "readwrite");
        const store = transaction.objectStore("photos");
        const request = store.add({ blob: blob, date: Date.now() });

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getAllPhotos() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("photos", "readonly");
        const store = transaction.objectStore("photos");
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function getPhoto(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("photos", "readonly");
        const store = transaction.objectStore("photos");
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function deletePhotoFromDatabase(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("photos", "readwrite");
        const store = transaction.objectStore("photos");
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function deleteAllPhotosFromDatabase() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("photos", "readwrite");
        const store = transaction.objectStore("photos");
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}


/* =========================================================
   카메라 제어
========================================================= */

async function startCamera() {
    hideCameraError();
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError("이 브라우저에서는 카메라를 사용할 수 없습니다.");
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { min: 1280, ideal: 3840, max: 3840 },
                height: { min: 720, ideal: 2160, max: 2160 },
                frameRate: { ideal: 30, max: 60 }
            },
            audio: false
        });

        cameraPreview.srcObject = cameraStream;
        cameraTrack = cameraStream.getVideoTracks()[0];
        cameraEnabled = true;

        cameraOffScreen.classList.add("hidden");
        cameraUI.classList.remove("hidden");

        try {
            await cameraPreview.play();
        } catch (e) {
            console.log("자동 재생 제한:", e);
        }

        setupCameraZoom();

    } catch (error) {
        console.error(error);
        cameraEnabled = false;
        cameraUI.classList.add("hidden");
        cameraOffScreen.classList.remove("hidden");
        showCameraError("카메라를 사용할 수 없습니다. 카메라 권한을 확인해주세요.");
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    cameraTrack = null;
    cameraPreview.srcObject = null;
    cameraEnabled = false;
    cameraHardwareZoom = false;
    cameraZoom = 1;
    updateCameraZoomUI();
}

function turnCameraOff() {
    stopCamera();
    cameraUI.classList.add("hidden");
    cameraOffScreen.classList.remove("hidden");
}

async function turnCameraOn() {
    cameraOffScreen.classList.add("hidden");
    cameraUI.classList.remove("hidden");
    await startCamera();
}

async function toggleCamera() {
    if (cameraEnabled) {
        turnCameraOff();
    } else {
        await turnCameraOn();
    }
}

async function switchCamera() {
    if (!cameraEnabled) return;
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    await startCamera();
}

function showCameraError(message) {
    cameraErrorText.textContent = message;
    cameraError.classList.remove("hidden");
}

function hideCameraError() {
    cameraError.classList.add("hidden");
}


/* =========================================================
   카메라 줌 및 제어
========================================================= */

function setupCameraZoom() {
    cameraHardwareZoom = false;
    cameraZoom = 1;
    updateCameraZoomUI();

    if (!cameraTrack || typeof cameraTrack.getCapabilities !== "function") return;

    try {
        const capabilities = cameraTrack.getCapabilities();
        if (capabilities.zoom && capabilities.zoom.min !== undefined && capabilities.zoom.max !== undefined) {
            cameraHardwareZoom = true;
        }
    } catch (error) {
        console.log("하드웨어 줌 미지원", error);
    }
}

function updateCameraZoomUI() {
    const scaleFactor = !cameraHardwareZoom ? cameraZoom : 1;
    const mirrorFactor = (currentFacingMode === "user") ? -1 : 1;

    cameraPreview.style.transform = `scale(${scaleFactor * mirrorFactor}, ${scaleFactor})`;

    if (cameraZoomIndicator) {
        cameraZoomIndicator.textContent = `${cameraZoom.toFixed(1)}×`;
    }
}

async function applyCameraZoom(value) {
    cameraZoom = Math.max(CAMERA_MIN_ZOOM, Math.min(CAMERA_MAX_ZOOM, value));

    if (cameraHardwareZoom && cameraTrack) {
        try {
            const capabilities = cameraTrack.getCapabilities();
            const min = capabilities.zoom.min;
            const max = Math.min(capabilities.zoom.max, CAMERA_MAX_ZOOM);
            const actualZoom = Math.max(min, Math.min(max, cameraZoom));

            await cameraTrack.applyConstraints({
                advanced: [{ zoom: actualZoom }]
            });
        } catch (error) {
            console.log("하드웨어 줌 제어 실패", error);
        }
    }

    updateCameraZoomUI();
}

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

cameraPreview.addEventListener("touchstart", function(event) {
    if (!cameraEnabled || event.touches.length !== 2) return;
    event.preventDefault();
    cameraPinchStartDistance = getDistance(event.touches[0], event.touches[1]);
    cameraPinchStartZoom = cameraZoom;
}, { passive: false });

cameraPreview.addEventListener("touchmove", function(event) {
    if (!cameraEnabled || event.touches.length !== 2 || cameraPinchStartDistance <= 0) return;
    event.preventDefault();

    const currentDistance = getDistance(event.touches[0], event.touches[1]);
    const ratio = currentDistance / cameraPinchStartDistance;
    applyCameraZoom(cameraPinchStartZoom * ratio);
}, { passive: false });

cameraPreview.addEventListener("touchend", function(event) {
    if (event.touches.length < 2) cameraPinchStartDistance = 0;
});


/* =========================================================
   촬영 및 연사 (속도 고속화 & 저장 동기화)
========================================================= */

// 단발 캡처
async function capturePhoto() {
    if (!cameraEnabled || !cameraStream || !cameraPreview.videoWidth) return;

    const videoWidth = cameraPreview.videoWidth;
    const videoHeight = cameraPreview.videoHeight;

    let sourceWidth = videoWidth;
    let sourceHeight = videoHeight;
    let sourceX = 0;
    let sourceY = 0;

    if (!cameraHardwareZoom && cameraZoom > 1) {
        const cropRatio = 1 / cameraZoom;
        sourceWidth = videoWidth * cropRatio;
        sourceHeight = videoHeight * cropRatio;
        sourceX = (videoWidth - sourceWidth) / 2;
        sourceY = (videoHeight - sourceHeight) / 2;
    }

    reusableCanvas.width = sourceWidth;
    reusableCanvas.height = sourceHeight;

    reusableContext.imageSmoothingEnabled = true;
    reusableContext.imageSmoothingQuality = "high";

    if (currentFacingMode === "user") {
        reusableContext.save();
        reusableContext.translate(reusableCanvas.width, 0);
        reusableContext.scale(-1, 1);
    }

    reusableContext.drawImage(
        cameraPreview,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, reusableCanvas.width, reusableCanvas.height
    );

    if (currentFacingMode === "user") {
        reusableContext.restore();
    }

    isSavingPhotos = true;
    savingPromise = new Promise((resolve) => {
        reusableCanvas.toBlob(async function(blob) {
            if (blob) {
                try {
                    await savePhoto(blob);
                    cameraPreview.style.opacity = "0.4";
                    setTimeout(() => { cameraPreview.style.opacity = "1"; }, 80);
                } catch (error) {
                    console.error("사진 저장 실패", error);
                }
            }
            isSavingPhotos = false;
            resolve();
        }, "image/jpeg", 1.0);
    });

    await savingPromise;
}

// 연사 프레임 비트맵 저장
async function captureBurstFrame() {
    if (!cameraEnabled || !cameraStream || !cameraPreview.videoWidth) return;
    try {
        const bitmap = await createImageBitmap(cameraPreview);
        burstBitmapQueue.push({
            bitmap: bitmap,
            zoom: cameraZoom,
            facingMode: currentFacingMode
        });
    } catch (e) {
        console.error("비트맵 캡처 실패", e);
    }
}

function handleCaptureStart(event) {
    if (event.cancelable) event.preventDefault();
    if (!cameraEnabled) return;

    isBurstMode = false;

    burstTimer = setTimeout(() => {
        isBurstMode = true;
        startBurstCapture();
    }, BURST_THRESHOLD);
}

function handleCaptureEnd(event) {
    if (event && event.cancelable) event.preventDefault();

    clearTimeout(burstTimer);
    burstTimer = null;

    if (isBurstMode) {
        stopBurstCapture();
    } else if (cameraEnabled) {
        capturePhoto();
    }

    isBurstMode = false;
}

function startBurstCapture() {
    burstCount = 0;
    burstBitmapQueue = [];

    if (burstCounter) {
        burstCounter.textContent = `0/${MAX_BURST_COUNT}`;
        burstCounter.style.display = 'block';
    }

    const executeCapture = () => {
        if (burstCount >= MAX_BURST_COUNT) {
            stopBurstCapture();
            return;
        }
        burstCount++;
        if (burstCounter) {
            burstCounter.textContent = `${burstCount}/${MAX_BURST_COUNT}`;
        }
        captureBurstFrame();
    };

    executeCapture();
    burstInterval = setInterval(executeCapture, BURST_INTERVAL);
}

async function stopBurstCapture() {
    if (burstInterval) {
        clearInterval(burstInterval);
        burstInterval = null;
    }

    if (burstCounter) {
        burstCounter.style.display = 'none';
    }

    if (burstBitmapQueue.length > 0) {
        const queueToProcess = [...burstBitmapQueue];
        burstBitmapQueue = [];
        
        isSavingPhotos = true;
        savingPromise = processAndSaveBurstQueue(queueToProcess).then(() => {
            isSavingPhotos = false;
        });
    }
}

// 연사 고속 병렬 변환 & DB 저장
async function processAndSaveBurstQueue(queue) {
    const saveTasks = queue.map((item) => {
        return new Promise(async (resolve) => {
            const { bitmap, zoom, facingMode } = item;

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { alpha: false });

            const videoWidth = bitmap.width;
            const videoHeight = bitmap.height;

            let sourceWidth = videoWidth;
            let sourceHeight = videoHeight;
            let sourceX = 0;
            let sourceY = 0;

            if (!cameraHardwareZoom && zoom > 1) {
                const cropRatio = 1 / zoom;
                sourceWidth = videoWidth * cropRatio;
                sourceHeight = videoHeight * cropRatio;
                sourceX = (videoWidth - sourceWidth) / 2;
                sourceY = (videoHeight - sourceHeight) / 2;
            }

            canvas.width = sourceWidth;
            canvas.height = sourceHeight;

            if (facingMode === "user") {
                ctx.save();
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }

            ctx.drawImage(
                bitmap,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, canvas.width, canvas.height
            );

            if (facingMode === "user") {
                ctx.restore();
            }

            bitmap.close();

            canvas.toBlob(async (blob) => {
                if (blob) {
                    await savePhoto(blob);
                }
                resolve();
            }, "image/jpeg", 1.0);
        });
    });

    await Promise.all(saveTasks);
}


/* =========================================================
   갤러리 화면 (저장 동기화 및 즉시 반영 보완)
========================================================= */

function clearGalleryObjectURLs() {
    galleryObjectURLs.forEach(url => URL.revokeObjectURL(url));
    galleryObjectURLs = [];
}

async function openGallery() {
    cameraScreen.classList.remove("active");
    galleryScreen.classList.add("active");
    await loadGallery();
}

function returnToCamera() {
    galleryScreen.classList.remove("active");
    cameraScreen.classList.add("active");
    clearGalleryObjectURLs();
}

async function loadGallery() {
    clearGalleryObjectURLs();
    galleryGrid.innerHTML = "";

    // 여전히 저장이 진행 중이라면 동기화 대기
    if (isSavingPhotos && savingPromise) {
        emptyIcon.textContent = "⏳";
        emptyText.textContent = "촬영한 사진을 저장하는 중입니다...";
        emptyGallery.classList.remove("hidden");
        
        await savingPromise;
    }

    const photos = await getAllPhotos();

    if (photos.length === 0) {
        emptyIcon.textContent = "📷";
        emptyText.textContent = "저장된 사진이 없습니다.";
        emptyGallery.classList.remove("hidden");
        allPhotosList = [];
        return;
    }

    emptyGallery.classList.add("hidden");
    photos.sort((a, b) => b.date - a.date);
    allPhotosList = photos;

    photos.forEach(photo => {
        const item = document.createElement("div");
        item.className = "gallery-item";

        const image = document.createElement("img");
        const url = URL.createObjectURL(photo.blob);
        galleryObjectURLs.push(url);

        image.src = url;
        item.appendChild(image);

        item.addEventListener("click", () => openPhotoViewer(photo.id));
        galleryGrid.appendChild(item);
    });
}


/* =========================================================
   사진 뷰어 & 검은 공백 없는 연속 넘기기
========================================================= */

async function openPhotoViewer(id) {
    const photo = await getPhoto(id);
    if (!photo) return;

    currentPhotoId = id;
    if (currentPhotoURL) URL.revokeObjectURL(currentPhotoURL);

    currentPhotoURL = URL.createObjectURL(photo.blob);
    
    viewerImage.style.transition = "none";
    viewerImage.src = currentPhotoURL;

    resetViewerZoom();
    photoViewer.classList.remove("hidden");
}

function closePhotoViewer() {
    photoViewer.classList.add("hidden");

    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
        currentPhotoURL = null;
    }

    if (adjacentPhotoURL) {
        URL.revokeObjectURL(adjacentPhotoURL);
        adjacentPhotoURL = null;
    }

    viewerImage.style.transition = "none";
    viewerImage.src = "";
    adjacentImage.style.display = "none";
    adjacentImage.src = "";
    currentPhotoId = null;
    resetViewerZoom();
}

function navigatePhoto(direction) {
    if (!currentPhotoId || allPhotosList.length <= 1) return;

    const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= allPhotosList.length) {
        resetViewerTransformSmooth();
        return;
    }

    const nextPhotoId = allPhotosList[targetIndex].id;
    const windowWidth = window.innerWidth;

    const duration = 250;
    viewerImage.style.transition = `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    adjacentImage.style.transition = `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;

    const mainExitX = direction > 0 ? -windowWidth : windowWidth;
    viewerImage.style.transform = `translate(${mainExitX}px, 0px) scale(1)`;
    adjacentImage.style.transform = `translate(0px, 0px) scale(1)`;

    setTimeout(async () => {
        currentPhotoId = nextPhotoId;
        if (currentPhotoURL) URL.revokeObjectURL(currentPhotoURL);

        currentPhotoURL = adjacentPhotoURL;
        adjacentPhotoURL = null;

        viewerImage.style.transition = "none";
        viewerImage.src = currentPhotoURL;
        viewerImage.style.transform = `translate(0px, 0px) scale(1)`;

        adjacentImage.style.display = "none";
        adjacentImage.src = "";

        resetViewerZoom();
    }, duration);
}

async function downloadCurrentPhoto() {
    if (!currentPhotoId) return;

    const photo = await getPhoto(currentPhotoId);
    if (!photo || !photo.blob) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataUrl = e.target.result;
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `photo_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    reader.readAsDataURL(photo.blob);
}


/* =========================================================
   뷰어 줌 & 스와이프 제어
========================================================= */

function clampViewerPosition() {
    if (viewerZoom <= 1) {
        viewerPositionX = 0;
        viewerPositionY = 0;
        return;
    }

    const containerWidth = photoZoomArea.clientWidth;
    const containerHeight = photoZoomArea.clientHeight;

    const imgWidth = viewerImage.offsetWidth;
    const imgHeight = viewerImage.offsetHeight;

    if (!imgWidth || !imgHeight) return;

    const scaledWidth = imgWidth * viewerZoom;
    const scaledHeight = imgHeight * viewerZoom;

    const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);

    viewerPositionX = Math.max(-maxX, Math.min(maxX, viewerPositionX));
    viewerPositionY = Math.max(-maxY, Math.min(maxY, viewerPositionY));
}

function updateViewerTransform() {
    clampViewerPosition();
    viewerImage.style.transform = `translate(${viewerPositionX}px, ${viewerPositionY}px) scale(${viewerZoom})`;
    viewerZoomText.textContent = `${viewerZoom.toFixed(1)}×`;
}

function resetViewerTransformSmooth() {
    viewerImage.style.transition = "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)";
    adjacentImage.style.transition = "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)";
    
    viewerImage.style.transform = `translate(0px, 0px) scale(1)`;
    
    const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
    const deltaX = swipeCurrentX - swipeStartX;
    const windowWidth = window.innerWidth;

    if (deltaX < 0) {
        adjacentImage.style.transform = `translate(${windowWidth}px, 0px) scale(1)`;
    } else {
        adjacentImage.style.transform = `translate(${-windowWidth}px, 0px) scale(1)`;
    }

    setTimeout(() => {
        adjacentImage.style.display = "none";
        resetViewerZoom();
    }, 200);
}

function setViewerZoom(value) {
    viewerZoom = Math.max(VIEWER_MIN_ZOOM, Math.min(VIEWER_MAX_ZOOM, value));
    updateViewerTransform();
}

function zoomViewerIn() {
    viewerImage.style.transition = "transform 0.2s ease-out";
    setViewerZoom(viewerZoom + 0.5);
}

function zoomViewerOut() {
    viewerImage.style.transition = "transform 0.2s ease-out";
    setViewerZoom(viewerZoom - 0.5);
}

function resetViewerZoom() {
    viewerZoom = 1;
    viewerPositionX = 0;
    viewerPositionY = 0;
    updateViewerTransform();
}

async function prepareAdjacentImage(direction) {
    const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= allPhotosList.length) {
        adjacentImage.style.display = "none";
        return false;
    }

    const photo = await getPhoto(allPhotosList[targetIndex].id);
    if (!photo) return false;

    if (adjacentPhotoURL) URL.revokeObjectURL(adjacentPhotoURL);
    adjacentPhotoURL = URL.createObjectURL(photo.blob);

    adjacentImage.src = adjacentPhotoURL;
    adjacentImage.style.display = "block";
    return true;
}

photoZoomArea.addEventListener("pointerdown", function(event) {
    if (event.pointerType === "touch" && event.isPrimary === false) return;

    viewerImage.style.transition = "none";
    adjacentImage.style.transition = "none";

    if (viewerZoom > 1) {
        viewerDragging = true;
        viewerDragStartX = event.clientX;
        viewerDragStartY = event.clientY;
        viewerOriginX = viewerPositionX;
        viewerOriginY = viewerPositionY;
    } else {
        isSwiping = true;
        swipeStartX = event.clientX;
        swipeStartY = event.clientY;
        swipeCurrentX = event.clientX;
    }

    photoZoomArea.setPointerCapture(event.pointerId);
});

photoZoomArea.addEventListener("pointermove", async function(event) {
    if (viewerZoom > 1 && viewerDragging) {
        const dx = event.clientX - viewerDragStartX;
        const dy = event.clientY - viewerDragStartY;
        viewerPositionX = viewerOriginX + dx;
        viewerPositionY = viewerOriginY + dy;
        updateViewerTransform();
    } else if (viewerZoom === 1 && isSwiping) {
        swipeCurrentX = event.clientX;
        const deltaX = swipeCurrentX - swipeStartX;
        const windowWidth = window.innerWidth;

        const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
        const isFirst = currentIndex === 0;
        const isLast = currentIndex === allPhotosList.length - 1;

        if ((isFirst && deltaX > 0) || (isLast && deltaX < 0)) {
            viewerImage.style.transform = `translate(0px, 0px) scale(1)`;
            adjacentImage.style.display = "none";
            return;
        }

        const direction = deltaX < 0 ? 1 : -1;
        
        if (adjacentImage.style.display === "none" || adjacentImage.dataset.dir != direction) {
            const loaded = await prepareAdjacentImage(direction);
            if (!loaded) return;
            adjacentImage.dataset.dir = direction;
        }

        const adjacentOffsetX = direction > 0 ? windowWidth : -windowWidth;

        viewerImage.style.transform = `translate(${deltaX}px, 0px) scale(1)`;
        adjacentImage.style.transform = `translate(${adjacentOffsetX + deltaX}px, 0px) scale(1)`;
    }
});

function handleSwipeEnd() {
    if (viewerZoom > 1) {
        viewerDragging = false;
    } else if (isSwiping) {
        isSwiping = false;
        const deltaX = swipeCurrentX - swipeStartX;
        const threshold = 60;

        const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
        const isFirst = currentIndex === 0;
        const isLast = currentIndex === allPhotosList.length - 1;

        if (deltaX < -threshold && !isLast) {
            navigatePhoto(1);
        } else if (deltaX > threshold && !isFirst) {
            navigatePhoto(-1);
        } else {
            resetViewerTransformSmooth();
        }
    }
}

photoZoomArea.addEventListener("pointerup", handleSwipeEnd);
photoZoomArea.addEventListener("pointercancel", handleSwipeEnd);

photoZoomArea.addEventListener("touchstart", function(event) {
    if (event.touches.length !== 2) return;
    event.preventDefault();
    isSwiping = false;
    adjacentImage.style.display = "none";
    viewerImage.style.transition = "none";
    viewerPinchStartDistance = getDistance(event.touches[0], event.touches[1]);
    viewerPinchStartZoom = viewerZoom;
}, { passive: false });

photoZoomArea.addEventListener("touchmove", function(event) {
    if (event.touches.length !== 2 || viewerPinchStartDistance <= 0) return;
    event.preventDefault();
    const currentDistance = getDistance(event.touches[0], event.touches[1]);
    const ratio = currentDistance / viewerPinchStartDistance;
    setViewerZoom(viewerPinchStartZoom * ratio);
}, { passive: false });

photoZoomArea.addEventListener("touchend", function(event) {
    if (event.touches.length < 2) viewerPinchStartDistance = 0;
});

window.addEventListener("keydown", function(event) {
    if (photoViewer.classList.contains("hidden")) return;

    if (event.key === "ArrowLeft") {
        prepareAdjacentImage(-1).then(success => { if (success) navigatePhoto(-1); });
    } else if (event.key === "ArrowRight") {
        prepareAdjacentImage(1).then(success => { if (success) navigatePhoto(1); });
    } else if (event.key === "Escape") {
        closePhotoViewer();
    }
});


/* =========================================================
   사진 삭제
========================================================= */

async function deleteCurrentPhoto() {
    if (currentPhotoId === null) return;
    if (!confirm("이 사진을 삭제할까요?")) return;

    try {
        await deletePhotoFromDatabase(currentPhotoId);
        closePhotoViewer();
        await loadGallery();
    } catch (error) {
        console.error("사진 삭제 실패", error);
    }
}

async function deleteAllPhotos() {
    const photos = await getAllPhotos();
    if (photos.length === 0) {
        alert("삭제할 사진이 없습니다.");
        return;
    }

    if (!confirm(`사진 ${photos.length}장을 모두 삭제할까요?`)) return;

    try {
        await deleteAllPhotosFromDatabase();
        await loadGallery();
        alert("모든 사진이 삭제되었습니다.");
    } catch (error) {
        console.error("전체 삭제 실패", error);
        alert("사진을 삭제하지 못했습니다.");
    }
}


/* =========================================================
   이벤트 연결
========================================================= */

cameraPowerButton.addEventListener("click", toggleCamera);
cameraPowerButtonOff.addEventListener("click", toggleCamera);
switchCameraButton.addEventListener("click", switchCamera);
galleryButton.addEventListener("click", openGallery);
galleryBackButton.addEventListener("click", returnToCamera);
retryCameraButton.addEventListener("click", startCamera);

// 촬영 & 연사
captureButton.addEventListener("mousedown", handleCaptureStart);
captureButton.addEventListener("mouseup", handleCaptureEnd);
captureButton.addEventListener("mouseleave", handleCaptureEnd);

captureButton.addEventListener("touchstart", handleCaptureStart, { passive: false });
captureButton.addEventListener("touchend", handleCaptureEnd, { passive: false });
captureButton.addEventListener("touchcancel", handleCaptureEnd, { passive: false });

viewerCloseButton.addEventListener("click", closePhotoViewer);
deletePhotoButton.addEventListener("click", deleteCurrentPhoto);
downloadPhotoButton.addEventListener("click", downloadCurrentPhoto);
deleteAllButton.addEventListener("click", deleteAllPhotos);

zoomInButton.addEventListener("click", zoomViewerIn);
zoomOutButton.addEventListener("click", zoomViewerOut);
resetZoomButton.addEventListener("click", resetViewerZoom);


/* =========================================================
   초기화
========================================================= */

async function initializeApp() {
    try {
        await openDatabase();
        await startCamera();
    } catch (error) {
        console.error("앱 초기화 실패", error);
        showCameraError("앱을 초기화할 수 없습니다.");
    }
}

initializeApp();