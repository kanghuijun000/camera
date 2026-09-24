```javascript
/* =========================================
   카메라 앱
========================================= */


/* =========================================
   HTML 요소
========================================= */

const cameraPreview =
    document.getElementById("cameraPreview");

const cameraScreen =
    document.getElementById("cameraScreen");

const galleryScreen =
    document.getElementById("galleryScreen");

const cameraOffScreen =
    document.getElementById("cameraOffScreen");

const cameraError =
    document.getElementById("cameraError");

const cameraErrorText =
    document.getElementById("cameraErrorText");

const retryCamera =
    document.getElementById("retryCamera");

const cameraPowerButton =
    document.getElementById("cameraPowerButton");

const cameraPowerIcon =
    document.getElementById("cameraPowerIcon");

const cameraPowerText =
    document.getElementById("cameraPowerText");

const switchCamera =
    document.getElementById("switchCamera");

const captureButton =
    document.getElementById("captureButton");

const galleryButton =
    document.getElementById("galleryButton");

const backToCamera =
    document.getElementById("backToCamera");

const zoomSlider =
    document.getElementById("zoomSlider");

const zoomIndicator =
    document.getElementById("zoomIndicator");

const maxZoomText =
    document.getElementById("maxZoomText");

const photoCanvas =
    document.getElementById("photoCanvas");

const galleryGrid =
    document.getElementById("galleryGrid");

const emptyGallery =
    document.getElementById("emptyGallery");

const photoCount =
    document.getElementById("photoCount");

const photoViewer =
    document.getElementById("photoViewer");

const viewerImage =
    document.getElementById("viewerImage");

const closeViewer =
    document.getElementById("closeViewer");

const deletePhotoButton =
    document.getElementById("deletePhoto");


/* =========================================
   상태
========================================= */

let cameraStream = null;

let cameraEnabled = false;

let currentFacingMode = "environment";

let currentZoom = 1;

let minimumZoom = 1;

let maximumZoom = 5;

let cameraSupportsHardwareZoom = false;

let currentPhotoId = null;

let database = null;


/* =========================================
   IndexedDB 열기
========================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                "StandaloneCameraDatabase",
                1
            );


        request.onupgradeneeded = function(event) {

            const db =
                event.target.result;


            if (
                !db.objectStoreNames.contains("photos")
            ) {

                const store =
                    db.createObjectStore(
                        "photos",
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );


                store.createIndex(
                    "createdAt",
                    "createdAt",
                    {
                        unique: false
                    }
                );
            }
        };


        request.onsuccess = function(event) {

            database =
                event.target.result;

            resolve(database);
        };


        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================
   사진 저장
========================================= */

function savePhoto(blob) {

    return new Promise((resolve, reject) => {

        const transaction =
            database.transaction(
                ["photos"],
                "readwrite"
            );


        const store =
            transaction.objectStore("photos");


        const photo = {

            image: blob,

            createdAt: Date.now()
        };


        const request =
            store.add(photo);


        request.onsuccess = function() {

            resolve(request.result);
        };


        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================
   모든 사진 가져오기
========================================= */

function getAllPhotos() {

    return new Promise((resolve, reject) => {

        const transaction =
            database.transaction(
                ["photos"],
                "readonly"
            );


        const store =
            transaction.objectStore("photos");


        const request =
            store.getAll();


        request.onsuccess = function() {

            const photos =
                request.result;


            photos.sort(
                (a, b) =>
                    b.createdAt - a.createdAt
            );


            resolve(photos);
        };


        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================
   사진 삭제
========================================= */

function deletePhotoFromDatabase(id) {

    return new Promise((resolve, reject) => {

        const transaction =
            database.transaction(
                ["photos"],
                "readwrite"
            );


        const store =
            transaction.objectStore("photos");


        const request =
            store.delete(id);


        request.onsuccess = function() {

            resolve();
        };


        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================
   카메라 시작
========================================= */

async function startCamera() {

    cameraError.classList.add("hidden");

    cameraOffScreen.classList.add("hidden");

    try {

        stopCamera(false);


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            throw new Error(
                "이 브라우저에서는 카메라 기능을 지원하지 않습니다."
            );
        }


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


        cameraPreview.srcObject =
            cameraStream;


        await cameraPreview.play();


        cameraEnabled = true;


        /*
            실제 카메라가 지원하는 줌 범위 확인
        */

        const tracks =
            cameraStream.getVideoTracks();


        if (tracks.length > 0) {

            const track =
                tracks[0];


            const capabilities =
                typeof track.getCapabilities === "function"
                    ? track.getCapabilities()
                    : {};


            if (
                typeof capabilities.zoom === "object" &&
                typeof capabilities.zoom.min === "number" &&
                typeof capabilities.zoom.max === "number"
            ) {

                minimumZoom =
                    Math.max(
                        1,
                        capabilities.zoom.min
                    );

                maximumZoom =
                    Math.max(
                        minimumZoom,
                        capabilities.zoom.max
                    );

                cameraSupportsHardwareZoom = true;

            } else {

                minimumZoom = 1;

                maximumZoom = 5;

                cameraSupportsHardwareZoom = false;
            }
        }


        /*
            슬라이더 범위 설정
        */

        zoomSlider.min =
            String(minimumZoom);

        zoomSlider.max =
            String(maximumZoom);

        zoomSlider.step = "0.1";


        /*
            현재 줌값이 범위를 벗어나면 조정
        */

        currentZoom =
            clamp(
                currentZoom,
                minimumZoom,
                maximumZoom
            );


        zoomSlider.value =
            String(currentZoom);


        maxZoomText.textContent =
            formatZoom(maximumZoom);


        updateZoomDisplay();


        updateCameraControls();


    } catch (error) {

        console.error(
            "카메라 시작 오류:",
            error
        );


        cameraEnabled = false;

        cameraPreview.srcObject = null;


        cameraErrorText.textContent =
            getCameraErrorMessage(error);


        cameraError.classList.remove(
            "hidden"
        );


        updateCameraControls();
    }
}


/* =========================================
   카메라 종료
========================================= */

function stopCamera(showOffScreen = true) {

    if (cameraStream) {

        cameraStream
            .getTracks()
            .forEach(track => {
                track.stop();
            });
    }


    cameraStream = null;

    cameraPreview.srcObject = null;

    cameraEnabled = false;


    if (showOffScreen) {

        cameraOffScreen.classList.remove(
            "hidden"
        );
    }
}


/* =========================================
   카메라 켜기 / 끄기
========================================= */

async function toggleCamera() {

    if (cameraEnabled) {

        stopCamera(true);

    } else {

        await startCamera();
    }


    updateCameraControls();
}


/* =========================================
   카메라 전환
========================================= */

async function changeCamera() {

    if (!cameraEnabled) {
        return;
    }


    currentFacingMode =
        currentFacingMode === "environment"
            ? "user"
            : "environment";


    await startCamera();
}


/* =========================================
   컨트롤 상태 업데이트
========================================= */

function updateCameraControls() {

    if (cameraEnabled) {

        cameraPowerButton.classList.add(
            "camera-on"
        );

        cameraPowerButton.classList.remove(
            "camera-off"
        );


        cameraPowerIcon.textContent = "●";

        cameraPowerText.textContent = "끄기";


        captureButton.classList.remove(
            "disabled"
        );


        switchCamera.classList.remove(
            "disabled"
        );

    } else {

        cameraPowerButton.classList.remove(
            "camera-on"
        );

        cameraPowerButton.classList.add(
            "camera-off"
        );


        cameraPowerIcon.textContent = "○";

        cameraPowerText.textContent = "켜기";


        captureButton.classList.add(
            "disabled"
        );

        switchCamera.classList.add(
            "disabled"
        );
    }
}


/* =========================================
   줌 숫자 표시
========================================= */

function formatZoom(value) {

    const rounded =
        Math.round(
            Number(value) * 10
        ) / 10;


    if (
        Number.isInteger(rounded)
    ) {

        return `${rounded}×`;
    }


    return `${rounded.toFixed(1)}×`;
}


/* =========================================
   숫자 제한
========================================= */

function clamp(value, min, max) {

    return Math.min(
        Math.max(value, min),
        max
    );
}


/* =========================================
   줌 적용
========================================= */

async function applyZoom(value) {

    if (!cameraEnabled) {
        return;
    }


    const safeValue =
        clamp(
            Number(value),
            minimumZoom,
            maximumZoom
        );


    currentZoom = safeValue;


    zoomSlider.value =
        String(currentZoom);


    updateZoomDisplay();


    /*
        실제 카메라 줌 지원
    */

    if (
        cameraSupportsHardwareZoom &&
        cameraStream
    ) {

        const track =
            cameraStream.getVideoTracks()[0];


        if (track) {

            try {

                await track.applyConstraints({

                    advanced: [
                        {
                            zoom: currentZoom
                        }
                    ]

                });

                /*
                    실제 하드웨어 줌을 사용했으므로
                    CSS 확대는 하지 않는다.
                */

                cameraPreview.style.transform =
                    "scale(1)";

                return;

            } catch (error) {

                console.warn(
                    "하드웨어 줌을 사용할 수 없어 화면 줌으로 전환합니다.",
                    error
                );

                cameraSupportsHardwareZoom =
                    false;
            }
        }
    }


    /*
        하드웨어 줌을 지원하지 않는 경우
        화면 확대 방식
    */

    cameraPreview.style.transform =
        `scale(${currentZoom})`;
}


/* =========================================
   줌 UI 업데이트
========================================= */

function updateZoomDisplay() {

    zoomIndicator.textContent =
        formatZoom(currentZoom);
}


/* =========================================
   사진 촬영
========================================= */

async function capturePhoto() {

    if (!cameraEnabled) {
        return;
    }


    if (!cameraPreview.videoWidth) {
        return;
    }


    const sourceWidth =
        cameraPreview.videoWidth;

    const sourceHeight =
        cameraPreview.videoHeight;


    /*
        하드웨어 줌을 사용하지 않는 경우
        확대된 영역을 직접 잘라서 저장한다.
    */

    let cropWidth =
        sourceWidth;

    let cropHeight =
        sourceHeight;


    if (!cameraSupportsHardwareZoom) {

        cropWidth =
            sourceWidth / currentZoom;

        cropHeight =
            sourceHeight / currentZoom;
    }


    cropWidth =
        Math.max(
            1,
            Math.round(cropWidth)
        );


    cropHeight =
        Math.max(
            1,
            Math.round(cropHeight)
        );


    const cropX =
        Math.max(
            0,
            Math.round(
                (sourceWidth - cropWidth) / 2
            )
        );


    const cropY =
        Math.max(
            0,
            Math.round(
                (sourceHeight - cropHeight) / 2
            )
        );


    photoCanvas.width =
        cropWidth;

    photoCanvas.height =
        cropHeight;


    const context =
        photoCanvas.getContext("2d");


    context.clearRect(
        0,
        0,
        cropWidth,
        cropHeight
    );


    /*
        전면 카메라
        좌우 반전
    */

    if (currentFacingMode === "user") {

        context.save();

        context.translate(
            cropWidth,
            0
        );

        context.scale(
            -1,
            1
        );


        context.drawImage(

            cameraPreview,

            cropX,
            cropY,
            cropWidth,
            cropHeight,

            0,
            0,
            cropWidth,
            cropHeight

        );


        context.restore();

    } else {

        context.drawImage(

            cameraPreview,

            cropX,
            cropY,
            cropWidth,
            cropHeight,

            0,
            0,
            cropWidth,
            cropHeight

        );
    }


    /*
        JPEG로 변환
    */

    photoCanvas.toBlob(

        async function(blob) {

            if (!blob) {
                return;
            }


            try {

                await savePhoto(blob);


                /*
                    촬영 효과
                */

                cameraPreview.style.opacity =
                    "0.25";


                setTimeout(() => {

                    cameraPreview.style.opacity =
                        "1";

                }, 100);


            } catch (error) {

                console.error(
                    "사진 저장 오류:",
                    error
                );
            }

        },

        "image/jpeg",

        0.92
    );
}


/* =========================================
   갤러리 열기
========================================= */

async function openGallery() {

    stopCamera(false);

    cameraScreen.classList.remove(
        "active"
    );

    galleryScreen.classList.add(
        "active"
    );


    await renderGallery();
}


/* =========================================
   카메라로 돌아가기
========================================= */

async function returnToCamera() {

    closePhotoViewer();


    galleryScreen.classList.remove(
        "active"
    );

    cameraScreen.classList.add(
        "active"
    );


    await startCamera();
}


/* =========================================
   갤러리 표시
========================================= */

async function renderGallery() {

    galleryGrid.innerHTML = "";


    const photos =
        await getAllPhotos();


    photoCount.textContent =
        `${photos.length}장`;


    if (photos.length === 0) {

        emptyGallery.classList.remove(
            "hidden"
        );

        return;
    }


    emptyGallery.classList.add(
        "hidden"
    );


    photos.forEach(photo => {

        const item =
            document.createElement("div");


        item.className =
            "gallery-item";


        const image =
            document.createElement("img");


        const url =
            URL.createObjectURL(
                photo.image
            );


        image.src = url;

        image.alt = "촬영한 사진";


        image.onload = function() {

            URL.revokeObjectURL(url);
        };


        item.appendChild(image);


        item.addEventListener(
            "click",
            () => openPhotoViewer(photo)
        );


        galleryGrid.appendChild(item);
    });
}


/* =========================================
   사진 크게 보기
========================================= */

function openPhotoViewer(photo) {

    currentPhotoId =
        photo.id;


    const url =
        URL.createObjectURL(
            photo.image
        );


    viewerImage.src =
        url;


    photoViewer.classList.remove(
        "hidden"
    );
}


/* =========================================
   사진 뷰어 닫기
========================================= */

function closePhotoViewer() {

    photoViewer.classList.add(
        "hidden"
    );


    viewerImage.src = "";

    currentPhotoId = null;
}


/* =========================================
   사진 삭제
========================================= */

async function deleteCurrentPhoto() {

    if (currentPhotoId === null) {
        return;
    }


    const id =
        currentPhotoId;


    try {

        await deletePhotoFromDatabase(id);

        closePhotoViewer();

        await renderGallery();

    } catch (error) {

        console.error(
            "사진 삭제 오류:",
            error
        );
    }
}


/* =========================================
   핀치 줌
========================================= */

let pinchStartDistance = null;

let pinchStartZoom = 1;


function getTouchDistance(touch1, touch2) {

    const dx =
        touch1.clientX - touch2.clientX;

    const dy =
        touch1.clientY - touch2.clientY;


    return Math.sqrt(
        dx * dx +
        dy * dy
    );
}


cameraPreview.addEventListener(
    "touchstart",
    function(event) {

        if (
            event.touches.length !== 2 ||
            !cameraEnabled
        ) {
            return;
        }


        pinchStartDistance =
            getTouchDistance(
                event.touches[0],
                event.touches[1]
            );


        pinchStartZoom =
            currentZoom;

    },
    {
        passive: true
    }
);


cameraPreview.addEventListener(
    "touchmove",
    function(event) {

        if (
            event.touches.length !== 2 ||
            pinchStartDistance === null ||
            !cameraEnabled
        ) {
            return;
        }


        event.preventDefault();


        const distance =
            getTouchDistance(
                event.touches[0],
                event.touches[1]
            );


        if (pinchStartDistance <= 0) {
            return;
        }


        const ratio =
            distance /
            pinchStartDistance;


        const newZoom =
            pinchStartZoom * ratio;


        applyZoom(newZoom);

    },
    {
        passive: false
    }
);


cameraPreview.addEventListener(
    "touchend",
    function(event) {

        if (
            event.touches.length < 2
        ) {

            pinchStartDistance =
                null;
        }
    },
    {
        passive: true
    }
);


/* =========================================
   오류 메시지
========================================= */

function getCameraErrorMessage(error) {

    if (!error) {

        return "카메라를 사용할 수 없습니다.";
    }


    if (
        error.name ===
        "NotAllowedError"
    ) {

        return "카메라 권한이 필요합니다. 브라우저에서 카메라 사용을 허용해 주세요.";
    }


    if (
        error.name ===
        "NotFoundError"
    ) {

        return "사용할 수 있는 카메라를 찾을 수 없습니다.";
    }


    if (
        error.name ===
        "NotReadableError"
    ) {

        return "카메라가 다른 앱에서 사용 중일 수 있습니다.";
    }


    if (
        error.name ===
        "SecurityError"
    ) {

        return "보안상의 이유로 카메라를 사용할 수 없습니다.";
    }


    return "카메라를 시작하지 못했습니다.";
}


/* =========================================
   이벤트
========================================= */

cameraPowerButton.addEventListener(
    "click",
    toggleCamera
);


switchCamera.addEventListener(
    "click",
    changeCamera
);


captureButton.addEventListener(
    "click",
    capturePhoto
);


galleryButton.addEventListener(
    "click",
    openGallery
);


backToCamera.addEventListener(
    "click",
    returnToCamera
);


retryCamera.addEventListener(
    "click",
    startCamera
);


closeViewer.addEventListener(
    "click",
    closePhotoViewer
);


deletePhotoButton.addEventListener(
    "click",
    deleteCurrentPhoto
);


/*
    줌 슬라이더
*/

zoomSlider.addEventListener(
    "input",
    function() {

        applyZoom(
            Number(this.value)
        );
    }
);


/* =========================================
   초기화
========================================= */

async function initializeApp() {

    try {

        await openDatabase();

        await startCamera();

    } catch (error) {

        console.error(
            "앱 초기화 오류:",
            error
        );
    }
}


initializeApp();


/* =========================================
   페이지를 떠날 때 카메라 종료
========================================= */

window.addEventListener(
    "pagehide",
    function() {

        stopCamera(false);
    }
);
```
