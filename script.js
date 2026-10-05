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
const viewerRotateButton = document.getElementById("viewerRotateButton");
const cameraZoomIndicator = document.getElementById("cameraZoomIndicator");
const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const resetZoomButton = document.getElementById("resetZoomButton");
const viewerZoomText = document.getElementById("viewerZoomText");
const videoModeButton = document.getElementById("videoModeButton");
const videoTimer = document.getElementById("videoTimer");
const viewerVideo = document.getElementById("viewerVideo");
const videoPlayButton = document.getElementById("videoPlayButton");
const videoTimelineWrap = document.getElementById("videoTimelineWrap");
const videoTimeline = document.getElementById("videoTimeline");
const galleryAllButton = document.getElementById("galleryAllButton");
const galleryPhotoButton = document.getElementById("galleryPhotoButton");
const galleryVideoButton = document.getElementById("galleryVideoButton");


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

// 연사 메인 스레드 캔버스/비트맵 버퍼 큐 (메모리 누수 완전 방지)
let burstCanvasQueue = [];

// 연사(Long Press) 관련 변수
let burstTimer = null;
let burstInterval = null;
let isBurstMode = false;
let burstCount = 0;
const MAX_BURST_COUNT = 30;
const BURST_THRESHOLD = 200;
const BURST_INTERVAL = 150;


/* =========================================================
   DB & Memory
========================================================= */

let db = null;
let currentPhotoId = null;
let currentPhotoURL = null;
let galleryObjectURLs = [];
let allPhotosList = [];
let allMediaList = [];
let galleryFilter = "all";

let videoMode = false;
let mediaRecorder = null;
let recordedVideoChunks = [];
let videoTimerInterval = null;
let videoStartTime = 0;
let currentViewerType = "photo";
let currentViewerVideoURL = null;

let adjacentVideo = document.createElement("video");
adjacentVideo.style.position = "absolute";
adjacentVideo.style.top = "0";
adjacentVideo.style.left = "0";
adjacentVideo.style.width = "100%";
adjacentVideo.style.height = "100%";
adjacentVideo.style.objectFit = "contain";
adjacentVideo.style.display = "none";
adjacentVideo.style.pointerEvents = "none";
adjacentVideo.muted = true;
adjacentVideo.playsInline = true;

if (photoZoomArea) {
    photoZoomArea.appendChild(adjacentVideo);
}


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
let viewerRotation = 0;

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
   IndexedDB (단일 트랜잭션 일괄 저장 지원)
========================================================= */

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("StandaloneCameraDatabase", 1);

        request.onupgradeneeded = function(event) {
            const database = event.target.result;
            if (!database.objectStoreNames.contains("photos")) {
                database.createObjectStore("photos", {
                    keyPath: "id",
                    autoIncrement: true
                });
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
        const request = store.add({
            blob: blob,
            date: Date.now(),
            type: "photo"
        });

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveMultiplePhotos(blobs) {
    return new Promise((resolve, reject) => {
        if (!blobs || blobs.length === 0) return resolve();

        const transaction = db.transaction("photos", "readwrite");
        const store = transaction.objectStore("photos");

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);

        blobs.forEach(blob => {
            store.add({
                blob: blob,
                date: Date.now(),
                type: "photo"
            });
        });
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
                facingMode: {
                    ideal: currentFacingMode
                },
                width: {
                    min: 1280,
                    ideal: 3840,
                    max: 3840
                },
                height: {
                    min: 720,
                    ideal: 2160,
                    max: 2160
                },
                frameRate: {
                    ideal: 30,
                    max: 60
                }
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
        updateVideoModeUI();
        showCameraError(
            "카메라를 사용할 수 없습니다. 카메라 권한을 확인해주세요."
        );
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
    if (mediaRecorder) {
        stopVideoRecording();
        return;
    }

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
    if (!cameraEnabled || mediaRecorder) return;

    currentFacingMode =
        currentFacingMode === "environment"
            ? "user"
            : "environment";

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

    if (
        !cameraTrack ||
        typeof cameraTrack.getCapabilities !== "function"
    ) {
        updateCameraZoomUI();
        return;
    }

    try {
        const capabilities = cameraTrack.getCapabilities();

        if (
            capabilities.zoom &&
            capabilities.zoom.min !== undefined &&
            capabilities.zoom.max !== undefined
        ) {
            cameraHardwareZoom = true;

            if (typeof cameraTrack.getSettings === "function") {
                const settings = cameraTrack.getSettings();

                if (typeof settings.zoom === "number") {
                    cameraZoom = Math.max(
                        CAMERA_MIN_ZOOM,
                        Math.min(CAMERA_MAX_ZOOM, settings.zoom)
                    );
                }
            }
        }
    } catch (error) {
        console.log("하드웨어 줌 미지원", error);
    }

    updateCameraZoomUI();
}

function updateCameraZoomUI() {
    const scaleFactor = !cameraHardwareZoom ? cameraZoom : 1;
    const mirrorFactor = currentFacingMode === "user" ? -1 : 1;

    cameraPreview.style.transform =
        `scale(${scaleFactor * mirrorFactor}, ${scaleFactor})`;

    if (cameraZoomIndicator) {
        cameraZoomIndicator.textContent =
            `${cameraZoom.toFixed(1)}×`;
    }
}

async function applyCameraZoom(value) {
    cameraZoom = Math.max(
        CAMERA_MIN_ZOOM,
        Math.min(CAMERA_MAX_ZOOM, value)
    );

    if (cameraHardwareZoom && cameraTrack) {
        try {
            const capabilities = cameraTrack.getCapabilities();
            const min = capabilities.zoom.min;
            const max = Math.min(
                capabilities.zoom.max,
                CAMERA_MAX_ZOOM
            );

            const actualZoom = Math.max(
                min,
                Math.min(max, cameraZoom)
            );

            await cameraTrack.applyConstraints({
                advanced: [
                    {
                        zoom: actualZoom
                    }
                ]
            });

            if (typeof cameraTrack.getSettings === "function") {
                const settings = cameraTrack.getSettings();

                if (typeof settings.zoom === "number") {
                    cameraZoom = Math.max(
                        CAMERA_MIN_ZOOM,
                        Math.min(
                            CAMERA_MAX_ZOOM,
                            settings.zoom
                        )
                    );
                }
            }
        } catch (error) {
            console.log("하드웨어 줌 제어 실패", error);
            cameraHardwareZoom = false;
        }
    }

    updateCameraZoomUI();
}

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;

    return Math.sqrt(dx * dx + dy * dy);
}

cameraPreview.addEventListener(
    "touchstart",
    function(event) {
        if (
            !cameraEnabled ||
            event.touches.length !== 2
        ) {
            return;
        }

        event.preventDefault();

        cameraPinchStartDistance =
            getDistance(
                event.touches[0],
                event.touches[1]
            );

        cameraPinchStartZoom = cameraZoom;
    },
    {
        passive: false
    }
);

cameraPreview.addEventListener(
    "touchmove",
    function(event) {
        if (
            !cameraEnabled ||
            event.touches.length !== 2 ||
            cameraPinchStartDistance <= 0
        ) {
            return;
        }

        event.preventDefault();

        const currentDistance =
            getDistance(
                event.touches[0],
                event.touches[1]
            );

        const ratio =
            currentDistance /
            cameraPinchStartDistance;

        applyCameraZoom(
            cameraPinchStartZoom * ratio
        );
    },
    {
        passive: false
    }
);

cameraPreview.addEventListener(
    "touchend",
    function(event) {
        if (event.touches.length < 2) {
            cameraPinchStartDistance = 0;
        }
    }
);


/* =========================================================
   촬영 및 연사 (해상도 보존 및 메모리 누수 제로 구현)
========================================================= */

// 단발 캡처 (소프트웨어 줌 시 고해상도 수확)
async function capturePhoto() {
    if (
        !cameraEnabled ||
        !cameraStream ||
        !cameraPreview.videoWidth
    ) {
        return;
    }

    const videoWidth = cameraPreview.videoWidth;
    const videoHeight = cameraPreview.videoHeight;

    const canvas = document.createElement("canvas");
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const ctx = canvas.getContext("2d", { alpha: false });

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

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    if (currentFacingMode === "user") {
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(
        cameraPreview,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        canvas.width,
        canvas.height
    );

    if (currentFacingMode === "user") {
        ctx.restore();
    }

    isSavingPhotos = true;

    savingPromise = new Promise((resolve) => {
        canvas.toBlob(
            async function(blob) {
                if (blob) {
                    try {
                        await savePhoto(blob);

                        cameraPreview.style.opacity = "0.4";
                        setTimeout(() => {
                            cameraPreview.style.opacity = "1";
                        }, 80);

                    } catch (error) {
                        console.error("사진 저장 실패", error);
                    }
                }

                isSavingPhotos = false;
                resolve();
            },
            "image/jpeg",
            0.95
        );
    });

    await savingPromise;
}


// 연사 프레임 수집 (ImageBitmap 생성 즉시 Canvas 전사 후 Bitmap 닫기로 메모리 완벽 해제)
async function captureBurstFrame() {
    if (
        !cameraEnabled ||
        !cameraStream ||
        !cameraPreview.videoWidth
    ) {
        return;
    }

    try {
        const bitmap = await createImageBitmap(cameraPreview);
        const videoWidth = bitmap.width;
        const videoHeight = bitmap.height;

        const canvas = document.createElement("canvas");
        canvas.width = videoWidth;
        canvas.height = videoHeight;
        const ctx = canvas.getContext("2d", { alpha: false });

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

        if (currentFacingMode === "user") {
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(
            bitmap,
            sourceX,
            sourceY,
            sourceWidth,
            sourceHeight,
            0,
            0,
            canvas.width,
            canvas.height
        );

        if (currentFacingMode === "user") {
            ctx.restore();
        }

        // 비트맵 즉시 종료 (GPU 메모리 소모 방지 핵심)
        bitmap.close();

        burstCanvasQueue.push(canvas);

    } catch (e) {
        console.error("비트맵 연사 프레임 수집 실패", e);
    }
}

function handleCaptureStart(event) {
    if (event.cancelable) {
        event.preventDefault();
    }

    if (!cameraEnabled) return;

    if (videoMode) {
        handleVideoCapture();
        return;
    }

    isBurstMode = false;

    burstTimer = setTimeout(() => {
        isBurstMode = true;
        startBurstCapture();
    }, BURST_THRESHOLD);
}

function handleCaptureEnd(event) {
    if (event && event.cancelable) {
        event.preventDefault();
    }

    if (videoMode) {
        return;
    }

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
    burstCanvasQueue = [];

    if (burstCounter) {
        burstCounter.textContent = `0/${MAX_BURST_COUNT}`;
        burstCounter.style.display = "block";
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
        burstCounter.style.display = "none";
    }

    if (burstCanvasQueue.length > 0) {
        const queueToProcess = [...burstCanvasQueue];
        burstCanvasQueue = [];

        isSavingPhotos = true;

        savingPromise = processAndSaveBurstCanvases(queueToProcess).then(() => {
            isSavingPhotos = false;
        });
    }
}


// 연사 고속 Blob 변환 및 DB 일괄 저장
async function processAndSaveBurstCanvases(canvases) {
    const blobPromises = canvases.map(canvas => {
        return new Promise(resolve => {
            canvas.toBlob(blob => resolve(blob), "image/jpeg", 0.9);
        });
    });

    const blobs = await Promise.all(blobPromises);
    const validBlobs = blobs.filter(b => b !== null);

    try {
        await saveMultiplePhotos(validBlobs);
    } catch (e) {
        console.error("연사 DB 저장 중 오류 발생:", e);
    }
}


/* =========================================================
   동영상 촬영
========================================================= */

function formatVideoTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateVideoTimer() {
    if (!videoTimer) return;

    const elapsed = (Date.now() - videoStartTime) / 1000;
    videoTimer.textContent = formatVideoTime(elapsed);
}

function startVideoTimer() {
    stopVideoTimer();
    videoStartTime = Date.now();
    updateVideoTimer();
    videoTimerInterval = setInterval(updateVideoTimer, 250);
}

function stopVideoTimer() {
    if (videoTimerInterval) {
        clearInterval(videoTimerInterval);
        videoTimerInterval = null;
    }
}

function getVideoMimeType() {
    const types = [
        "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm"
    ];

    return types.find(type => MediaRecorder.isTypeSupported(type)) || "";
}

function updateVideoModeUI() {
    if (!videoModeButton || !captureButton || !videoTimer) return;

    videoModeButton.classList.toggle("active", videoMode);

    if (videoMode) {
        captureButton.classList.add("video-mode");
        captureButton.setAttribute("aria-label", "동영상 촬영");
    } else {
        captureButton.classList.remove("video-mode");
        captureButton.setAttribute("aria-label", "촬영");
        videoTimer.style.display = "none";
        videoTimer.textContent = "00:00";
    }
}

function toggleVideoMode() {
    if (!cameraEnabled || mediaRecorder) return;

    videoMode = !videoMode;
    updateVideoModeUI();
}

function handleVideoCapture() {
    if (!cameraStream) return;

    if (mediaRecorder && mediaRecorder.state === "recording") {
        stopVideoRecording();
    } else {
        startVideoRecording();
    }
}

function startVideoRecording() {
    if (!cameraStream || !window.MediaRecorder) {
        alert("이 브라우저에서는 동영상 촬영을 지원하지 않습니다.");
        return;
    }

    const mimeType = getVideoMimeType();

    try {
        mediaRecorder = mimeType
            ? new MediaRecorder(cameraStream, { mimeType })
            : new MediaRecorder(cameraStream);
    } catch (error) {
        console.error("동영상 녹화 시작 실패", error);
        alert("동영상 촬영을 시작할 수 없습니다.");
        mediaRecorder = null;
        return;
    }

    recordedVideoChunks = [];

    mediaRecorder.ondataavailable = event => {
        if (event.data && event.data.size > 0) {
            recordedVideoChunks.push(event.data);
        }
    };

    mediaRecorder.onerror = event => {
        console.error("동영상 녹화 오류", event.error);
        stopVideoTimer();
        videoTimer.style.display = "none";
        mediaRecorder = null;
        recordedVideoChunks = [];
    };

    mediaRecorder.onstop = async () => {
        stopVideoTimer();

        const actualType =
            mediaRecorder && mediaRecorder.mimeType
                ? mediaRecorder.mimeType
                : mimeType || "video/webm";

        const blob = new Blob(recordedVideoChunks, { type: actualType });

        mediaRecorder = null;
        recordedVideoChunks = [];

        if (blob.size > 0) {
            try {
                await saveVideo(blob);
                await loadGallery();
            } catch (error) {
                console.error("동영상 저장 실패", error);
            }
        }

        videoTimer.style.display = "none";
        videoTimer.textContent = "00:00";
    };

    mediaRecorder.start();
    videoTimer.style.display = "block";
    startVideoTimer();
}

function stopVideoRecording() {
    if (!mediaRecorder) return;

    if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
}

function saveVideo(blob) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction("photos", "readwrite");
        const store = transaction.objectStore("photos");

        const request = store.add({
            blob,
            date: Date.now(),
            type: "video"
        });

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}


/* =========================================================
   갤러리 화면
========================================================= */

function clearGalleryObjectURLs() {
    galleryObjectURLs.forEach(url => URL.revokeObjectURL(url));
    galleryObjectURLs = [];
}

async function openGallery() {
    cameraScreen.classList.remove("active");
    galleryScreen.classList.add("active");

    galleryFilter = "all";
    updateGalleryFilterUI();
    await loadGallery();
}

function updateGalleryFilterUI() {
    if (!galleryAllButton || !galleryPhotoButton || !galleryVideoButton) return;

    galleryAllButton.classList.toggle("active", galleryFilter === "all");
    galleryPhotoButton.classList.toggle("active", galleryFilter === "photo");
    galleryVideoButton.classList.toggle("active", galleryFilter === "video");
}

async function setGalleryFilter(filter) {
    if (galleryFilter === filter) return;

    galleryFilter = filter;
    updateGalleryFilterUI();
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
        updateGalleryFilterUI();
        return;
    }

    emptyGallery.classList.add("hidden");

    photos.sort((a, b) => b.date - a.date);
    allMediaList = photos;

    const filteredPhotos = photos.filter(photo => {
        if (galleryFilter === "photo") {
            return photo.type !== "video";
        }

        if (galleryFilter === "video") {
            return photo.type === "video";
        }

        return true;
    });

    allPhotosList = galleryFilter === "all" ? allMediaList : filteredPhotos;

    if (filteredPhotos.length === 0) {
        emptyIcon.textContent = galleryFilter === "video" ? "🎥" : "📷";
        emptyText.textContent =
            galleryFilter === "video"
                ? "저장된 동영상이 없습니다."
                : "저장된 사진이 없습니다.";
        emptyGallery.classList.remove("hidden");
        return;
    }

    filteredPhotos.forEach(itemData => {
        const item = document.createElement("div");
        item.className = "gallery-item";

        if (itemData.type === "video") {
            const video = document.createElement("video");
            const url = URL.createObjectURL(itemData.blob);
            galleryObjectURLs.push(url);

            video.className = "gallery-video";
            video.src = url;
            video.muted = true;
            video.playsInline = true;
            video.preload = "metadata";
            item.appendChild(video);

            const playOverlay = document.createElement("div");
            playOverlay.className = "gallery-video-play";
            playOverlay.textContent = "▶";
            item.appendChild(playOverlay);
        } else {
            const image = document.createElement("img");
            const url = URL.createObjectURL(itemData.blob);
            galleryObjectURLs.push(url);

            image.src = url;
            item.appendChild(image);
        }

        item.addEventListener("click", () => openPhotoViewer(itemData.id));
        galleryGrid.appendChild(item);
    });

    updateGalleryFilterUI();
}


/* =========================================================
   사진 뷰어
========================================================= */

async function openPhotoViewer(id) {
    const item = await getPhoto(id);
    if (!item) return;

    currentPhotoId = id;
    currentViewerType = item.type === "video" ? "video" : "photo";

    if (galleryFilter === "all") {
        allPhotosList = [...allMediaList];
    } else if (galleryFilter === "photo") {
        allPhotosList = allMediaList.filter(media => media.type !== "video");
    } else {
        allPhotosList = allMediaList.filter(media => media.type === "video");
    }

    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
        currentPhotoURL = null;
    }

    if (currentViewerVideoURL) {
        URL.revokeObjectURL(currentViewerVideoURL);
        currentViewerVideoURL = null;
    }

    viewerImage.style.transition = "none";
    viewerImage.src = "";
    viewerImage.style.transform = "translate(0px, 0px)";
    adjacentImage.style.display = "none";
    adjacentVideo.style.display = "none";
    viewerVideo.pause();
    viewerVideo.removeAttribute("src");
    viewerVideo.load();

    if (currentViewerType === "video") {
        currentViewerVideoURL = URL.createObjectURL(item.blob);
        viewerVideo.src = currentViewerVideoURL;
        viewerVideo.currentTime = 0;
        viewerImage.classList.add("hidden");
        viewerVideo.classList.remove("hidden");
        videoPlayButton.classList.remove("hidden");
        videoTimelineWrap.classList.remove("hidden");
        viewerRotateButton.classList.add("hidden");
        viewerZoom = 1;
        viewerPositionX = 0;
        viewerPositionY = 0;
    } else {
        currentPhotoURL = URL.createObjectURL(item.blob);
        viewerImage.src = currentPhotoURL;
        viewerImage.classList.remove("hidden");
        viewerVideo.classList.add("hidden");
        videoPlayButton.classList.add("hidden");
        videoTimelineWrap.classList.add("hidden");
        viewerRotateButton.classList.remove("hidden");
        viewerRotation = 0;
        resetViewerZoom();
    }

    updateViewerControls();
    photoViewer.classList.remove("hidden");
}

function updateViewerControls() {
    const isVideo = currentViewerType === "video";

    videoPlayButton.classList.toggle("hidden", !isVideo);
    videoTimelineWrap.classList.toggle("hidden", !isVideo);
    viewerRotateButton.classList.toggle("hidden", isVideo);

    if (!isVideo) {
        viewerZoomText.textContent = `${viewerZoom.toFixed(1)}×`;
    }
}

function closePhotoViewer() {
    photoViewer.classList.add("hidden");

    viewerVideo.pause();

    if (currentPhotoURL) {
        URL.revokeObjectURL(currentPhotoURL);
        currentPhotoURL = null;
    }

    if (currentViewerVideoURL) {
        URL.revokeObjectURL(currentViewerVideoURL);
        currentViewerVideoURL = null;
    }

    if (adjacentPhotoURL) {
        URL.revokeObjectURL(adjacentPhotoURL);
        adjacentPhotoURL = null;
    }

    viewerImage.style.transition = "none";
    viewerImage.src = "";

    viewerVideo.removeAttribute("src");
    viewerVideo.load();

    adjacentImage.style.display = "none";
    adjacentImage.src = "";
    adjacentVideo.pause();
    adjacentVideo.removeAttribute("src");
    adjacentVideo.load();
    adjacentVideo.style.display = "none";

    currentPhotoId = null;
    currentViewerType = "photo";
    viewerRotation = 0;

    resetViewerZoom();
}

async function navigatePhoto(direction) {
    if (!currentPhotoId || allPhotosList.length <= 1) {
        return;
    }

    const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
    if (currentIndex === -1) return;

    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= allPhotosList.length) {
        resetViewerTransformSmooth();
        return;
    }

    const nextItem = allPhotosList[targetIndex];
    const windowWidth = window.innerWidth;
    const duration = 250;

    viewerImage.style.transition =
        `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    viewerVideo.style.transition =
        `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    adjacentImage.style.transition =
        `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    adjacentVideo.style.transition =
        `transform ${duration}ms cubic-bezier(0.25, 1, 0.5, 1)`;

    const mainExitX = direction > 0 ? -windowWidth : windowWidth;

    const currentElement =
        currentViewerType === "video" ? viewerVideo : viewerImage;

    currentElement.style.transform =
        `translate(${mainExitX}px, 0px) rotate(${viewerRotation}deg) scale(${getViewerFitScale() * viewerZoom})`;

    const adjacentElement =
        nextItem.type === "video" ? adjacentVideo : adjacentImage;

    adjacentElement.style.transform = "translate(0px, 0px) scale(1)";
    adjacentElement.style.display = "block";

    setTimeout(async () => {
        await openPhotoViewer(nextItem.id);
    }, duration);
}

async function downloadCurrentPhoto() {
    if (!currentPhotoId) return;

    const item = await getPhoto(currentPhotoId);
    if (!item || !item.blob) return;

    const extension =
        currentViewerType === "video"
            ? (item.blob.type.includes("mp4") ? "mp4" : "webm")
            : "jpg";

    const url = URL.createObjectURL(item.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentViewerType === "video" ? "video" : "photo"}_${Date.now()}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/* =========================================================
   뷰어 줌 & 스와이프 제어
========================================================= */

function getViewerFitScale() {
    const containerWidth = photoZoomArea.clientWidth;
    const containerHeight = photoZoomArea.clientHeight;
    const imgWidth = viewerImage.offsetWidth;
    const imgHeight = viewerImage.offsetHeight;

    if (!containerWidth || !containerHeight || !imgWidth || !imgHeight) {
        return 1;
    }

    const isQuarterTurn = Math.abs(viewerRotation) % 180 === 90;
    const rotatedWidth = isQuarterTurn ? imgHeight : imgWidth;
    const rotatedHeight = isQuarterTurn ? imgWidth : imgHeight;

    return Math.min(
        1,
        containerWidth / rotatedWidth,
        containerHeight / rotatedHeight
    );
}

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

    const fitScale = getViewerFitScale();
    const isQuarterTurn = Math.abs(viewerRotation) % 180 === 90;
    const rotatedWidth = isQuarterTurn ? imgHeight : imgWidth;
    const rotatedHeight = isQuarterTurn ? imgWidth : imgHeight;

    const scaledWidth = rotatedWidth * fitScale * viewerZoom;
    const scaledHeight = rotatedHeight * fitScale * viewerZoom;

    const maxX = Math.max(0, (scaledWidth - containerWidth) / 2);
    const maxY = Math.max(0, (scaledHeight - containerHeight) / 2);

    viewerPositionX = Math.max(-maxX, Math.min(maxX, viewerPositionX));
    viewerPositionY = Math.max(-maxY, Math.min(maxY, viewerPositionY));
}

function updateViewerTransform() {
    if (currentViewerType === "video") {
        viewerVideo.style.transform =
            `translate(${viewerPositionX}px, ${viewerPositionY}px) scale(${viewerZoom})`;
        viewerZoomText.textContent = `${viewerZoom.toFixed(1)}×`;
        return;
    }

    clampViewerPosition();
    const fitScale = getViewerFitScale();

    viewerImage.style.transform =
        `translate(${viewerPositionX}px, ${viewerPositionY}px) rotate(${viewerRotation}deg) scale(${fitScale * viewerZoom})`;

    viewerZoomText.textContent = `${viewerZoom.toFixed(1)}×`;
}

function resetViewerTransformSmooth() {
    const currentElement =
        currentViewerType === "video" ? viewerVideo : viewerImage;

    currentElement.style.transition =
        "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)";
    adjacentImage.style.transition =
        "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)";
    adjacentVideo.style.transition =
        "transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)";

    if (currentViewerType === "video") {
        viewerVideo.style.transform =
            `translate(0px, 0px) scale(${viewerZoom})`;
    } else {
        viewerImage.style.transform =
            `translate(0px, 0px) rotate(${viewerRotation}deg) scale(${getViewerFitScale() * viewerZoom})`;
    }

    const deltaX = swipeCurrentX - swipeStartX;
    const windowWidth = window.innerWidth;
    const shownAdjacent =
        adjacentImage.style.display !== "none"
            ? adjacentImage
            : adjacentVideo;

    if (shownAdjacent.style.display !== "none") {
        shownAdjacent.style.transform =
            `translate(${deltaX < 0 ? windowWidth : -windowWidth}px, 0px) scale(1)`;
    }

    setTimeout(() => {
        adjacentImage.style.display = "none";
        adjacentVideo.style.display = "none";
        resetViewerZoom();
    }, 200);
}

function setViewerZoom(value) {
    viewerZoom = Math.max(VIEWER_MIN_ZOOM, Math.min(VIEWER_MAX_ZOOM, value));
    updateViewerTransform();
}

function zoomViewerIn() {
    const target = currentViewerType === "video" ? viewerVideo : viewerImage;
    target.style.transition = "transform 0.2s ease-out";
    setViewerZoom(viewerZoom + 0.5);
}

function zoomViewerOut() {
    const target = currentViewerType === "video" ? viewerVideo : viewerImage;
    target.style.transition = "transform 0.2s ease-out";
    setViewerZoom(viewerZoom - 0.5);
}

function resetViewerZoom() {
    viewerZoom = 1;
    viewerPositionX = 0;
    viewerPositionY = 0;
    viewerRotation = 0;
    viewerVideo.style.transform = "translate(0px, 0px) scale(1)";
    updateViewerTransform();
}

function rotateViewerPhoto() {
    viewerRotation += 90;
    viewerPositionX = 0;
    viewerPositionY = 0;
    viewerImage.style.transition = "transform 0.2s ease-out";
    updateViewerTransform();
}

async function prepareAdjacentImage(direction) {
    const currentIndex = allPhotosList.findIndex(p => p.id === currentPhotoId);
    const targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= allPhotosList.length) {
        adjacentImage.style.display = "none";
        adjacentVideo.style.display = "none";
        return false;
    }

    const item = await getPhoto(allPhotosList[targetIndex].id);
    if (!item) return false;

    adjacentImage.style.display = "none";
    adjacentVideo.style.display = "none";

    if (adjacentPhotoURL) {
        URL.revokeObjectURL(adjacentPhotoURL);
        adjacentPhotoURL = null;
    }

    if (item.type === "video") {
        if (adjacentVideo.src) {
            adjacentVideo.removeAttribute("src");
            adjacentVideo.load();
        }

        const url = URL.createObjectURL(item.blob);
        adjacentVideo.src = url;
        adjacentVideo.muted = true;
        adjacentVideo.playsInline = true;
        adjacentVideo.dataset.dir = direction;
        adjacentVideo.dataset.id = item.id;
        adjacentVideo.style.display = "block";
    } else {
        adjacentPhotoURL = URL.createObjectURL(item.blob);
        adjacentImage.src = adjacentPhotoURL;
        adjacentImage.dataset.dir = direction;
        adjacentImage.dataset.id = item.id;
        adjacentImage.style.display = "block";
    }

    return true;
}

photoZoomArea.addEventListener("pointerdown", function(event) {
    if (event.pointerType === "touch" && event.isPrimary === false) {
        return;
    }

    viewerImage.style.transition = "none";
    viewerVideo.style.transition = "none";
    adjacentImage.style.transition = "none";
    adjacentVideo.style.transition = "none";

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
    if (viewerZoom > 1 && viewerDragging && currentViewerType === "photo") {
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

        const currentElement =
            currentViewerType === "video" ? viewerVideo : viewerImage;

        if ((isFirst && deltaX > 0) || (isLast && deltaX < 0)) {
            currentElement.style.transform =
                `translate(0px, 0px) rotate(${viewerRotation}deg) scale(${getViewerFitScale() * viewerZoom})`;

            adjacentImage.style.display = "none";
            adjacentVideo.style.display = "none";
            return;
        }

        const direction = deltaX < 0 ? 1 : -1;

        const activeAdjacent =
            adjacentImage.style.display !== "none"
                ? adjacentImage
                : adjacentVideo;

        if (
            adjacentImage.style.display === "none" &&
            adjacentVideo.style.display === "none"
        ) {
            const loaded = await prepareAdjacentImage(direction);
            if (!loaded) return;
        } else if (
            activeAdjacent.dataset.dir != direction
        ) {
            const loaded = await prepareAdjacentImage(direction);
            if (!loaded) return;
        }

        const adjacentOffsetX = direction > 0 ? windowWidth : -windowWidth;

        currentElement.style.transform =
            `translate(${deltaX}px, 0px) rotate(${viewerRotation}deg) scale(${getViewerFitScale()})`;

        const shownAdjacent =
            adjacentImage.style.display !== "none"
                ? adjacentImage
                : adjacentVideo;

        shownAdjacent.style.transform =
            `translate(${adjacentOffsetX + deltaX}px, 0px) scale(1)`;
    }
});

function handleSwipeEnd() {
    if (viewerZoom > 1 && currentViewerType === "photo") {
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
    adjacentVideo.style.display = "none";
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
    if (event.touches.length < 2) {
        viewerPinchStartDistance = 0;
    }
});

viewerImage.addEventListener("load", function() {
    updateViewerTransform();
});

window.addEventListener("resize", function() {
    if (!photoViewer.classList.contains("hidden")) {
        updateViewerTransform();
    }
});

window.addEventListener("keydown", function(event) {
    if (photoViewer.classList.contains("hidden")) return;

    if (event.key === "ArrowLeft") {
        prepareAdjacentImage(-1).then(success => {
            if (success) navigatePhoto(-1);
        });
    } else if (event.key === "ArrowRight") {
        prepareAdjacentImage(1).then(success => {
            if (success) navigatePhoto(1);
        });
    } else if (event.key === "Escape") {
        closePhotoViewer();
    }
});


/* =========================================================
   사진 삭제
========================================================= */

async function deleteCurrentPhoto() {
    if (currentPhotoId === null) return;

    if (!confirm(currentViewerType === "video" ? "이 동영상을 삭제할까요?" : "이 사진을 삭제할까요?")) return;

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


function toggleViewerVideoPlayback() {
    if (currentViewerType !== "video") return;

    if (viewerVideo.paused) {
        viewerVideo.play().catch(() => {});
    } else {
        viewerVideo.pause();
    }
}

function updateViewerVideoPlayButton() {
    if (currentViewerType !== "video") return;
    videoPlayButton.textContent = viewerVideo.paused ? "▶" : "❚❚";
}

function updateViewerVideoTimeline() {
    if (currentViewerType !== "video") return;

    if (Number.isFinite(viewerVideo.duration) && viewerVideo.duration > 0) {
        videoTimeline.max = viewerVideo.duration;
        videoTimeline.value = viewerVideo.currentTime;
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
viewerRotateButton.addEventListener("click", rotateViewerPhoto);
deletePhotoButton.addEventListener("click", deleteCurrentPhoto);
downloadPhotoButton.addEventListener("click", downloadCurrentPhoto);
deleteAllButton.addEventListener("click", deleteAllPhotos);

zoomInButton.addEventListener("click", zoomViewerIn);
zoomOutButton.addEventListener("click", zoomViewerOut);
resetZoomButton.addEventListener("click", resetViewerZoom);

videoModeButton.addEventListener("click", toggleVideoMode);
galleryAllButton.addEventListener("click", () => setGalleryFilter("all"));
galleryPhotoButton.addEventListener("click", () => setGalleryFilter("photo"));
galleryVideoButton.addEventListener("click", () => setGalleryFilter("video"));

videoPlayButton.addEventListener("click", toggleViewerVideoPlayback);
viewerVideo.addEventListener("play", updateViewerVideoPlayButton);
viewerVideo.addEventListener("pause", updateViewerVideoPlayButton);
viewerVideo.addEventListener("timeupdate", updateViewerVideoTimeline);
viewerVideo.addEventListener("loadedmetadata", updateViewerVideoTimeline);

videoTimeline.addEventListener("input", () => {
    if (currentViewerType === "video") {
        viewerVideo.currentTime = Number(videoTimeline.value);
    }
});


/* =========================================================
   초기화
========================================================= */

async function initializeApp() {
    try {
        await openDatabase();
        stopCamera();

        cameraUI.classList.add("hidden");
        cameraOffScreen.classList.remove("hidden");

    } catch (error) {
        console.error("앱 초기화 실패", error);
        showCameraError("앱을 초기화할 수 없습니다.");
    }
}

initializeApp();