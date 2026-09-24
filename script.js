/* =========================================================
   기본 요소
========================================================= */

const cameraScreen = document.getElementById("cameraScreen");
const galleryScreen = document.getElementById("galleryScreen");

const cameraPreview = document.getElementById("cameraPreview");

const cameraOffScreen = document.getElementById("cameraOffScreen");
const cameraError = document.getElementById("cameraError");
const cameraErrorText = document.getElementById("cameraErrorText");

const retryCameraButton = document.getElementById("retryCameraButton");

const cameraPowerButton = document.getElementById("cameraPowerButton");
const switchCameraButton = document.getElementById("switchCameraButton");

const captureButton = document.getElementById("captureButton");

const galleryButton = document.getElementById("galleryButton");
const galleryBackButton = document.getElementById("galleryBackButton");

const zoomSlider = document.getElementById("zoomSlider");
const zoomIndicator = document.getElementById("zoomIndicator");

const galleryGrid = document.getElementById("galleryGrid");
const emptyGallery = document.getElementById("emptyGallery");

const photoViewer = document.getElementById("photoViewer");
const viewerImage = document.getElementById("viewerImage");
const photoZoomArea = document.getElementById("photoZoomArea");

const viewerCloseButton = document.getElementById("viewerCloseButton");
const deletePhotoButton = document.getElementById("deletePhotoButton");

const zoomInButton = document.getElementById("zoomInButton");
const zoomOutButton = document.getElementById("zoomOutButton");
const resetZoomButton = document.getElementById("resetZoomButton");

const viewerZoomText = document.getElementById("viewerZoomText");


/* =========================================================
   카메라 변수
========================================================= */

let cameraStream = null;

let cameraEnabled = false;

let currentFacingMode = "environment";

let cameraTrack = null;

let hardwareZoomSupported = false;

let currentCameraZoom = 1;


/* =========================================================
   갤러리 변수
========================================================= */

let db = null;

let currentPhotoId = null;

let currentPhotoURL = null;


/* =========================================================
   갤러리 사진 확대 변수
========================================================= */

let viewerZoom = 1;

const MIN_VIEWER_ZOOM = 1;
const MAX_VIEWER_ZOOM = 5;

let viewerPositionX = 0;
let viewerPositionY = 0;

let isDragging = false;

let dragStartX = 0;
let dragStartY = 0;

let dragOriginX = 0;
let dragOriginY = 0;


/* 핀치 줌 */

let pinchStartDistance = 0;
let pinchStartZoom = 1;


/* =========================================================
   IndexedDB
========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open(
            "StandaloneCameraDatabase",
            1
        );

        request.onupgradeneeded = function(event) {

            const database = event.target.result;

            if (!database.objectStoreNames.contains("photos")) {

                database.createObjectStore(
                    "photos",
                    {
                        keyPath: "id",
                        autoIncrement: true
                    }
                );
            }
        };

        request.onsuccess = function(event) {

            db = event.target.result;

            resolve(db);
        };

        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================================
   사진 저장
========================================================= */

function savePhoto(blob) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            "photos",
            "readwrite"
        );

        const store = transaction.objectStore("photos");

        const request = store.add({
            blob: blob,
            date: Date.now()
        });

        request.onsuccess = function() {

            resolve(request.result);
        };

        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================================
   사진 가져오기
========================================================= */

function getAllPhotos() {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            "photos",
            "readonly"
        );

        const store = transaction.objectStore("photos");

        const request = store.getAll();

        request.onsuccess = function() {

            resolve(request.result);
        };

        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================================
   사진 하나 가져오기
========================================================= */

function getPhoto(id) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            "photos",
            "readonly"
        );

        const store = transaction.objectStore("photos");

        const request = store.get(id);

        request.onsuccess = function() {

            resolve(request.result);
        };

        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================================
   사진 삭제
========================================================= */

function deletePhotoFromDatabase(id) {

    return new Promise((resolve, reject) => {

        const transaction = db.transaction(
            "photos",
            "readwrite"
        );

        const store = transaction.objectStore("photos");

        const request = store.delete(id);

        request.onsuccess = function() {

            resolve();
        };

        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================================
   카메라 시작
========================================================= */

async function startCamera() {

    hideCameraError();

    stopCamera();

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        showCameraError(
            "이 브라우저에서는 카메라를 사용할 수 없습니다."
        );

        return;
    }


    try {

        cameraStream =
            await navigator.mediaDevices.getUserMedia({

                video: {
                    facingMode: {
                        ideal: currentFacingMode
                    },

                    width: {
                        ideal: 1920
                    },

                    height: {
                        ideal: 1080
                    }
                },

                audio: false
            });


        cameraPreview.srcObject = cameraStream;

        cameraTrack =
            cameraStream.getVideoTracks()[0];


        cameraEnabled = true;

        cameraOffScreen.classList.add("hidden");

        await cameraPreview.play();

        setupHardwareZoom();

    } catch (error) {

        console.error(error);

        cameraEnabled = false;

        cameraOffScreen.classList.remove("hidden");

        showCameraError(
            "카메라를 사용할 수 없습니다.\n카메라 권한을 확인해주세요."
        );
    }
}


/* =========================================================
   카메라 종료
========================================================= */

function stopCamera() {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(track => track.stop());

        cameraStream = null;
    }

    cameraTrack = null;

    cameraPreview.srcObject = null;

    cameraEnabled = false;

    hardwareZoomSupported = false;

    currentCameraZoom = 1;

    zoomSlider.value = 1;

    zoomIndicator.textContent = "1.0×";

    cameraPreview.style.transform = "scale(1)";
}


/* =========================================================
   카메라 ON/OFF
========================================================= */

async function toggleCamera() {

    if (cameraEnabled) {

        stopCamera();

        cameraOffScreen.classList.remove("hidden");

        cameraPowerButton.textContent = "⏻";

    } else {

        cameraOffScreen.classList.add("hidden");

        await startCamera();

        if (cameraEnabled) {

            cameraPowerButton.textContent = "⏻";
        }
    }
}


/* =========================================================
   카메라 전환
========================================================= */

async function switchCamera() {

    if (!cameraEnabled) {
        return;
    }

    currentFacingMode =
        currentFacingMode === "environment"
            ? "user"
            : "environment";

    await startCamera();
}


/* =========================================================
   카메라 오류
========================================================= */

function showCameraError(message) {

    cameraErrorText.textContent = message;

    cameraError.classList.remove("hidden");
}

function hideCameraError() {

    cameraError.classList.add("hidden");
}


/* =========================================================
   하드웨어 줌 확인
========================================================= */

function setupHardwareZoom() {

    hardwareZoomSupported = false;

    currentCameraZoom = 1;

    zoomSlider.min = 1;
    zoomSlider.max = 5;
    zoomSlider.step = 0.1;
    zoomSlider.value = 1;

    if (!cameraTrack) {
        return;
    }


    if (
        typeof cameraTrack.getCapabilities === "function"
    ) {

        const capabilities =
            cameraTrack.getCapabilities();

        if (
            capabilities.zoom &&
            capabilities.zoom.min !== undefined &&
            capabilities.zoom.max !== undefined
        ) {

            hardwareZoomSupported = true;

            zoomSlider.min =
                capabilities.zoom.min;

            zoomSlider.max =
                Math.min(
                    capabilities.zoom.max,
                    10
                );

            zoomSlider.step =
                capabilities.zoom.step || 0.1;

            zoomSlider.value =
                capabilities.zoom.min;

            currentCameraZoom =
                Number(zoomSlider.value);

            updateZoomText();
        }
    }
}


/* =========================================================
   카메라 줌 변경
========================================================= */

async function changeCameraZoom(value) {

    currentCameraZoom = Number(value);

    updateZoomText();


    if (
        hardwareZoomSupported &&
        cameraTrack
    ) {

        try {

            await cameraTrack.applyConstraints({

                advanced: [
                    {
                        zoom: currentCameraZoom
                    }
                ]
            });

            cameraPreview.style.transform =
                "scale(1)";

            return;

        } catch (error) {

            console.log(
                "하드웨어 줌 실패:",
                error
            );
        }
    }


    /*
       하드웨어 줌을 지원하지 않는 경우
       화면 확대 방식으로 대체
    */

    cameraPreview.style.transform =
        `scale(${currentCameraZoom})`;
}


/* =========================================================
   줌 표시
========================================================= */

function updateZoomText() {

    zoomIndicator.textContent =
        `${currentCameraZoom.toFixed(1)}×`;
}


/* =========================================================
   사진 촬영
========================================================= */

async function capturePhoto() {

    if (
        !cameraEnabled ||
        !cameraStream ||
        !cameraPreview.videoWidth
    ) {

        return;
    }


    const canvas =
        document.createElement("canvas");

    const videoWidth =
        cameraPreview.videoWidth;

    const videoHeight =
        cameraPreview.videoHeight;


    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = videoWidth;
    let sourceHeight = videoHeight;


    /*
       실제 하드웨어 줌이 아니라
       화면 확대 방식으로 사용 중이라면
       사진도 확대된 영역을 저장
    */

    if (!hardwareZoomSupported) {

        const cropRatio =
            1 / currentCameraZoom;

        sourceWidth =
            videoWidth * cropRatio;

        sourceHeight =
            videoHeight * cropRatio;

        sourceX =
            (videoWidth - sourceWidth) / 2;

        sourceY =
            (videoHeight - sourceHeight) / 2;
    }


    canvas.width = sourceWidth;
    canvas.height = sourceHeight;


    const context =
        canvas.getContext("2d");


    /*
       전면 카메라 사진은
       일반적인 셀카처럼 좌우 반전
    */

    if (currentFacingMode === "user") {

        context.translate(
            canvas.width,
            0
        );

        context.scale(-1, 1);
    }


    context.drawImage(
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


    canvas.toBlob(
        async function(blob) {

            if (!blob) {
                return;
            }

            try {

                await savePhoto(blob);

                /*
                   촬영 후 작은 시각적 효과
                */

                cameraPreview.style.opacity = "0.5";

                setTimeout(() => {

                    cameraPreview.style.opacity = "1";

                }, 100);

            } catch (error) {

                console.error(
                    "사진 저장 실패:",
                    error
                );
            }

        },
        "image/jpeg",
        0.95
    );
}


/* =========================================================
   갤러리 열기
========================================================= */

async function openGallery() {

    cameraScreen.classList.remove("active");

    galleryScreen.classList.add("active");

    await loadGallery();
}


/* =========================================================
   카메라로 돌아가기
========================================================= */

function returnToCamera() {

    galleryScreen.classList.remove("active");

    cameraScreen.classList.add("active");
}


/* =========================================================
   갤러리 불러오기
========================================================= */

async function loadGallery() {

    galleryGrid.innerHTML = "";

    const photos =
        await getAllPhotos();


    if (photos.length === 0) {

        emptyGallery.classList.remove(
            "hidden"
        );

        return;
    }


    emptyGallery.classList.add("hidden");


    /*
       최신 사진이 먼저 나오도록
    */

    photos.sort(
        (a, b) => b.date - a.date
    );


    photos.forEach(photo => {

        const item =
            document.createElement("div");

        item.className = "gallery-item";


        const image =
            document.createElement("img");

        const url =
            URL.createObjectURL(photo.blob);

        image.src = url;

        image.onload = function() {

            URL.revokeObjectURL(url);
        };


        item.appendChild(image);


        item.addEventListener(
            "click",
            () => openPhotoViewer(photo.id)
        );


        galleryGrid.appendChild(item);
    });
}


/* =========================================================
   사진 뷰어 열기
========================================================= */

async function openPhotoViewer(id) {

    const photo =
        await getPhoto(id);

    if (!photo) {
        return;
    }


    currentPhotoId = id;


    if (currentPhotoURL) {

        URL.revokeObjectURL(
            currentPhotoURL
        );
    }


    currentPhotoURL =
        URL.createObjectURL(
            photo.blob
        );


    viewerImage.src =
        currentPhotoURL;


    resetViewerZoom();


    photoViewer.classList.remove(
        "hidden"
    );
}


/* =========================================================
   사진 뷰어 닫기
========================================================= */

function closePhotoViewer() {

    photoViewer.classList.add(
        "hidden"
    );


    if (currentPhotoURL) {

        URL.revokeObjectURL(
            currentPhotoURL
        );

        currentPhotoURL = null;
    }


    viewerImage.src = "";

    currentPhotoId = null;

    resetViewerZoom();
}


/* =========================================================
   사진 확대 적용
========================================================= */

function updateViewerTransform() {

    viewerImage.style.transform =
        `translate(${viewerPositionX}px, ${viewerPositionY}px) scale(${viewerZoom})`;

    viewerZoomText.textContent =
        `${viewerZoom.toFixed(1)}×`;
}


/* =========================================================
   사진 확대
========================================================= */

function setViewerZoom(value) {

    viewerZoom =
        Math.max(
            MIN_VIEWER_ZOOM,
            Math.min(
                MAX_VIEWER_ZOOM,
                value
            )
        );


    /*
       원본 크기에서는 위치 초기화
    */

    if (viewerZoom === 1) {

        viewerPositionX = 0;
        viewerPositionY = 0;
    }


    updateViewerTransform();
}


/* =========================================================
   줌 + 버튼
========================================================= */

function zoomViewerIn() {

    setViewerZoom(
        viewerZoom + 0.5
    );
}


/* =========================================================
   줌 - 버튼
========================================================= */

function zoomViewerOut() {

    setViewerZoom(
        viewerZoom - 0.5
    );
}


/* =========================================================
   원본 크기
========================================================= */

function resetViewerZoom() {

    viewerZoom = 1;

    viewerPositionX = 0;

    viewerPositionY = 0;

    updateViewerTransform();
}


/* =========================================================
   사진 드래그
========================================================= */

photoZoomArea.addEventListener(
    "pointerdown",
    function(event) {

        /*
           줌이 1배일 때는 이동하지 않음
        */

        if (viewerZoom <= 1) {
            return;
        }


        isDragging = true;

        dragStartX = event.clientX;
        dragStartY = event.clientY;

        dragOriginX = viewerPositionX;
        dragOriginY = viewerPositionY;


        photoZoomArea.setPointerCapture(
            event.pointerId
        );
    }
);


photoZoomArea.addEventListener(
    "pointermove",
    function(event) {

        if (!isDragging) {
            return;
        }


        const dx =
            event.clientX - dragStartX;

        const dy =
            event.clientY - dragStartY;


        viewerPositionX =
            dragOriginX + dx;

        viewerPositionY =
            dragOriginY + dy;


        updateViewerTransform();
    }
);


photoZoomArea.addEventListener(
    "pointerup",
    function() {

        isDragging = false;
    }
);


photoZoomArea.addEventListener(
    "pointercancel",
    function() {

        isDragging = false;
    }
);


/* =========================================================
   핀치 줌
========================================================= */

function getTouchDistance(touch1, touch2) {

    const dx =
        touch1.clientX - touch2.clientX;

    const dy =
        touch1.clientY - touch2.clientY;

    return Math.sqrt(
        dx * dx + dy * dy
    );
}


photoZoomArea.addEventListener(
    "touchstart",
    function(event) {

        if (event.touches.length === 2) {

            pinchStartDistance =
                getTouchDistance(
                    event.touches[0],
                    event.touches[1]
                );

            pinchStartZoom =
                viewerZoom;
        }
    },
    {
        passive: false
    }
);


photoZoomArea.addEventListener(
    "touchmove",
    function(event) {

        if (event.touches.length !== 2) {
            return;
        }


        event.preventDefault();


        const currentDistance =
            getTouchDistance(
                event.touches[0],
                event.touches[1]
            );


        if (pinchStartDistance <= 0) {
            return;
        }


        const ratio =
            currentDistance /
            pinchStartDistance;


        setViewerZoom(
            pinchStartZoom * ratio
        );
    },
    {
        passive: false
    }
);


photoZoomArea.addEventListener(
    "touchend",
    function(event) {

        if (event.touches.length < 2) {

            pinchStartDistance = 0;
        }
    }
);


/* =========================================================
   사진 삭제
========================================================= */

async function deleteCurrentPhoto() {

    if (currentPhotoId === null) {
        return;
    }


    const confirmed =
        confirm(
            "이 사진을 삭제할까요?"
        );


    if (!confirmed) {
        return;
    }


    try {

        await deletePhotoFromDatabase(
            currentPhotoId
        );


        closePhotoViewer();

        await loadGallery();

    } catch (error) {

        console.error(
            "사진 삭제 실패:",
            error
        );
    }
}


/* =========================================================
   이벤트 연결
========================================================= */

cameraPowerButton.addEventListener(
    "click",
    toggleCamera
);


switchCameraButton.addEventListener(
    "click",
    switchCamera
);


captureButton.addEventListener(
    "click",
    capturePhoto
);


galleryButton.addEventListener(
    "click",
    openGallery
);


galleryBackButton.addEventListener(
    "click",
    returnToCamera
);


retryCameraButton.addEventListener(
    "click",
    startCamera
);


zoomSlider.addEventListener(
    "input",
    function() {

        changeCameraZoom(
            this.value
        );
    }
);


viewerCloseButton.addEventListener(
    "click",
    closePhotoViewer
);


deletePhotoButton.addEventListener(
    "click",
    deleteCurrentPhoto
);


zoomInButton.addEventListener(
    "click",
    zoomViewerIn
);


zoomOutButton.addEventListener(
    "click",
    zoomViewerOut
);


resetZoomButton.addEventListener(
    "click",
    resetViewerZoom
);


/* =========================================================
   화면 초기화
========================================================= */

async function initializeApp() {

    try {

        await openDatabase();

        await startCamera();

    } catch (error) {

        console.error(
            "앱 초기화 실패:",
            error
        );

        showCameraError(
            "앱을 초기화할 수 없습니다."
        );
    }
}


initializeApp();