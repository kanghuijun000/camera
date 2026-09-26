/* =========================================================
   DOM
========================================================= */

const cameraScreen =
    document.getElementById("cameraScreen");

const galleryScreen =
    document.getElementById("galleryScreen");

const cameraPreview =
    document.getElementById("cameraPreview");

const cameraUI =
    document.getElementById("cameraUI");

const cameraOffScreen =
    document.getElementById("cameraOffScreen");

const cameraPowerButton =
    document.getElementById("cameraPowerButton");

const cameraPowerButtonOff =
    document.getElementById("cameraPowerButtonOff");

const switchCameraButton =
    document.getElementById("switchCameraButton");

const captureButton =
    document.getElementById("captureButton");

const galleryButton =
    document.getElementById("galleryButton");

const galleryBackButton =
    document.getElementById("galleryBackButton");

const deleteAllButton =
    document.getElementById("deleteAllButton");

const galleryGrid =
    document.getElementById("galleryGrid");

const emptyGallery =
    document.getElementById("emptyGallery");

const cameraError =
    document.getElementById("cameraError");

const cameraErrorText =
    document.getElementById("cameraErrorText");

const retryCameraButton =
    document.getElementById("retryCameraButton");

const photoViewer =
    document.getElementById("photoViewer");

const photoZoomArea =
    document.getElementById("photoZoomArea");

const viewerImage =
    document.getElementById("viewerImage");

const viewerCloseButton =
    document.getElementById("viewerCloseButton");

const deletePhotoButton =
    document.getElementById("deletePhotoButton");

const zoomInButton =
    document.getElementById("zoomInButton");

const zoomOutButton =
    document.getElementById("zoomOutButton");

const resetZoomButton =
    document.getElementById("resetZoomButton");

const viewerZoomText =
    document.getElementById("viewerZoomText");


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


/* =========================================================
   카메라 핀치 줌 변수
========================================================= */

let cameraPinchStartDistance = 0;

let cameraPinchStartZoom = 1;


/* =========================================================
   DB
========================================================= */

let db = null;

let currentPhotoId = null;

let currentPhotoURL = null;


/* =========================================================
   갤러리 사진 줌 변수
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


/* =========================================================
   IndexedDB 열기
========================================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                "StandaloneCameraDatabase",
                1
            );


        request.onupgradeneeded =
            function(event) {

                const database =
                    event.target.result;

                if (
                    !database.objectStoreNames.contains(
                        "photos"
                    )
                ) {

                    database.createObjectStore(
                        "photos",
                        {
                            keyPath: "id",
                            autoIncrement: true
                        }
                    );
                }
            };


        request.onsuccess =
            function(event) {

                db = event.target.result;

                resolve(db);
            };


        request.onerror =
            function() {

                reject(request.error);
            };
    });
}


/* =========================================================
   사진 저장
========================================================= */

function savePhoto(blob) {

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                "photos",
                "readwrite"
            );

        const store =
            transaction.objectStore(
                "photos"
            );

        const request =
            store.add({
                blob: blob,
                date: Date.now()
            });


        request.onsuccess =
            function() {

                resolve(request.result);
            };


        request.onerror =
            function() {

                reject(request.error);
            };
    });
}


/* =========================================================
   모든 사진 가져오기
========================================================= */

function getAllPhotos() {

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                "photos",
                "readonly"
            );

        const store =
            transaction.objectStore(
                "photos"
            );

        const request =
            store.getAll();


        request.onsuccess =
            function() {

                resolve(request.result);
            };


        request.onerror =
            function() {

                reject(request.error);
            };
    });
}


/* =========================================================
   사진 하나 가져오기
========================================================= */

function getPhoto(id) {

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                "photos",
                "readonly"
            );

        const store =
            transaction.objectStore(
                "photos"
            );

        const request =
            store.get(id);


        request.onsuccess =
            function() {

                resolve(request.result);
            };


        request.onerror =
            function() {

                reject(request.error);
            };
    });
}


/* =========================================================
   사진 하나 삭제
========================================================= */

function deletePhotoFromDatabase(id) {

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                "photos",
                "readwrite"
            );

        const store =
            transaction.objectStore(
                "photos"
            );

        const request =
            store.delete(id);


        request.onsuccess =
            function() {

                resolve();
            };


        request.onerror =
            function() {

                reject(request.error);
            };
    });
}


/* =========================================================
   전체 사진 삭제
========================================================= */

function deleteAllPhotosFromDatabase() {

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                "photos",
                "readwrite"
            );

        const store =
            transaction.objectStore(
                "photos"
            );

        const request =
            store.clear();


        request.onsuccess =
            function() {

                resolve();
            };


        request.onerror =
            function() {

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


        cameraPreview.srcObject =
            cameraStream;


        cameraTrack =
            cameraStream.getVideoTracks()[0];


        cameraEnabled = true;


        cameraOffScreen.classList.add(
            "hidden"
        );

        cameraUI.classList.remove(
            "hidden"
        );


        await cameraPreview.play();


        setupCameraZoom();

    } catch (error) {

        console.error(error);

        cameraEnabled = false;

        cameraUI.classList.add(
            "hidden"
        );

        cameraOffScreen.classList.remove(
            "hidden"
        );

        showCameraError(
            "카메라를 사용할 수 없습니다. 카메라 권한을 확인해주세요."
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

    cameraHardwareZoom = false;

    cameraZoom = 1;

    cameraPreview.style.transform =
        "scale(1)";
}


/* =========================================================
   카메라 OFF
========================================================= */

function turnCameraOff() {

    stopCamera();


    /*
       카메라 UI 전체 숨김
    */

    cameraUI.classList.add(
        "hidden"
    );


    /*
       검은 화면 + 전원 버튼만 표시
    */

    cameraOffScreen.classList.remove(
        "hidden"
    );
}


/* =========================================================
   카메라 ON
========================================================= */

async function turnCameraOn() {

    cameraOffScreen.classList.add(
        "hidden"
    );


    cameraUI.classList.remove(
        "hidden"
    );


    await startCamera();
}


/* =========================================================
   카메라 ON/OFF
========================================================= */

async function toggleCamera() {

    if (cameraEnabled) {

        turnCameraOff();

    } else {

        await turnCameraOn();
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

    cameraErrorText.textContent =
        message;

    cameraError.classList.remove(
        "hidden"
    );
}


function hideCameraError() {

    cameraError.classList.add(
        "hidden"
    );
}


/* =========================================================
   카메라 줌 설정
========================================================= */

function setupCameraZoom() {

    cameraHardwareZoom = false;

    cameraZoom = 1;

    cameraPreview.style.transform =
        "scale(1)";


    if (
        !cameraTrack ||
        typeof cameraTrack.getCapabilities !==
        "function"
    ) {

        return;
    }


    try {

        const capabilities =
            cameraTrack.getCapabilities();


        if (
            capabilities.zoom &&
            capabilities.zoom.min !== undefined &&
            capabilities.zoom.max !== undefined
        ) {

            cameraHardwareZoom = true;

        }

    } catch (error) {

        console.log(
            "카메라 줌 정보를 가져올 수 없습니다.",
            error
        );
    }
}


/* =========================================================
   카메라 줌 적용
========================================================= */

async function applyCameraZoom(value) {

    cameraZoom =
        Math.max(
            CAMERA_MIN_ZOOM,
            Math.min(
                CAMERA_MAX_ZOOM,
                value
            )
        );


    /*
       실제 카메라 하드웨어 줌
    */

    if (
        cameraHardwareZoom &&
        cameraTrack
    ) {

        try {

            const capabilities =
                cameraTrack.getCapabilities();


            const min =
                capabilities.zoom.min;

            const max =
                Math.min(
                    capabilities.zoom.max,
                    CAMERA_MAX_ZOOM
                );


            const actualZoom =
                Math.max(
                    min,
                    Math.min(
                        max,
                        cameraZoom
                    )
                );


            await cameraTrack.applyConstraints({

                advanced: [
                    {
                        zoom: actualZoom
                    }
                ]
            });


            /*
               하드웨어 줌을 사용하는 경우
               CSS 확대는 사용하지 않음
            */

            cameraPreview.style.transform =
                "scale(1)";

            return;

        } catch (error) {

            console.log(
                "하드웨어 줌 적용 실패",
                error
            );
        }
    }


    /*
       하드웨어 줌을 지원하지 않는 경우
       화면 자체를 확대
    */

    cameraPreview.style.transform =
        `scale(${cameraZoom})`;
}


/* =========================================================
   카메라 핀치 거리
========================================================= */

function getDistance(touch1, touch2) {

    const dx =
        touch1.clientX -
        touch2.clientX;

    const dy =
        touch1.clientY -
        touch2.clientY;

    return Math.sqrt(
        dx * dx + dy * dy
    );
}


/* =========================================================
   카메라 핀치 시작
========================================================= */

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


        cameraPinchStartZoom =
            cameraZoom;

    },
    {
        passive: false
    }
);


/* =========================================================
   카메라 핀치 진행
========================================================= */

cameraPreview.addEventListener(
    "touchmove",
    function(event) {

        if (
            !cameraEnabled ||
            event.touches.length !== 2
        ) {

            return;
        }


        event.preventDefault();


        if (
            cameraPinchStartDistance <= 0
        ) {

            return;
        }


        const currentDistance =
            getDistance(
                event.touches[0],
                event.touches[1]
            );


        const ratio =
            currentDistance /
            cameraPinchStartDistance;


        const newZoom =
            cameraPinchStartZoom *
            ratio;


        applyCameraZoom(newZoom);

    },
    {
        passive: false
    }
);


/* =========================================================
   카메라 핀치 종료
========================================================= */

cameraPreview.addEventListener(
    "touchend",
    function(event) {

        if (event.touches.length < 2) {

            cameraPinchStartDistance = 0;
        }
    }
);


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

    let sourceWidth =
        videoWidth;

    let sourceHeight =
        videoHeight;


    /*
       실제 하드웨어 줌을 사용할 수 없을 때
       확대된 영역을 잘라서 저장
    */

    if (!cameraHardwareZoom) {

        const cropRatio =
            1 / cameraZoom;


        sourceWidth =
            videoWidth * cropRatio;

        sourceHeight =
            videoHeight * cropRatio;


        sourceX =
            (videoWidth - sourceWidth) / 2;

        sourceY =
            (videoHeight - sourceHeight) / 2;
    }


    canvas.width =
        sourceWidth;

    canvas.height =
        sourceHeight;


    const context =
        canvas.getContext("2d");


    /*
       전면 카메라 좌우 반전
    */

    if (
        currentFacingMode === "user"
    ) {

        context.translate(
            canvas.width,
            0
        );

        context.scale(
            -1,
            1
        );
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
                   촬영 효과
                */

                cameraPreview.style.opacity =
                    "0.4";


                setTimeout(
                    function() {

                        cameraPreview.style.opacity =
                            "1";

                    },
                    100
                );


            } catch (error) {

                console.error(
                    "사진 저장 실패",
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

    cameraScreen.classList.remove(
        "active"
    );

    galleryScreen.classList.add(
        "active"
    );


    await loadGallery();
}


/* =========================================================
   카메라로 돌아가기
========================================================= */

function returnToCamera() {

    galleryScreen.classList.remove(
        "active"
    );

    cameraScreen.classList.add(
        "active"
    );
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


    emptyGallery.classList.add(
        "hidden"
    );


    photos.sort(
        (a, b) =>
            b.date - a.date
    );


    photos.forEach(
        function(photo) {

            const item =
                document.createElement(
                    "div"
                );


            item.className =
                "gallery-item";


            const image =
                document.createElement(
                    "img"
                );


            const url =
                URL.createObjectURL(
                    photo.blob
                );


            image.src = url;


            image.onload =
                function() {

                    URL.revokeObjectURL(
                        url
                    );
                };


            item.appendChild(image);


            item.addEventListener(
                "click",
                function() {

                    openPhotoViewer(
                        photo.id
                    );
                }
            );


            galleryGrid.appendChild(
                item
            );
        }
    );
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
   갤러리 사진 줌 적용
========================================================= */

function updateViewerTransform() {

    viewerImage.style.transform =
        `translate(${viewerPositionX}px, ${viewerPositionY}px) scale(${viewerZoom})`;


    viewerZoomText.textContent =
        `${viewerZoom.toFixed(1)}×`;
}


/* =========================================================
   갤러리 사진 줌 설정
========================================================= */

function setViewerZoom(value) {

    viewerZoom =
        Math.max(
            VIEWER_MIN_ZOOM,
            Math.min(
                VIEWER_MAX_ZOOM,
                value
            )
        );


    if (viewerZoom === 1) {

        viewerPositionX = 0;

        viewerPositionY = 0;
    }


    updateViewerTransform();
}


/* =========================================================
   갤러리 줌 확대
========================================================= */

function zoomViewerIn() {

    setViewerZoom(
        viewerZoom + 0.5
    );
}


/* =========================================================
   갤러리 줌 축소
========================================================= */

function zoomViewerOut() {

    setViewerZoom(
        viewerZoom - 0.5
    );
}


/* =========================================================
   갤러리 원본
========================================================= */

function resetViewerZoom() {

    viewerZoom = 1;

    viewerPositionX = 0;

    viewerPositionY = 0;

    updateViewerTransform();
}


/* =========================================================
   갤러리 사진 드래그
========================================================= */

photoZoomArea.addEventListener(
    "pointerdown",
    function(event) {

        if (viewerZoom <= 1) {
            return;
        }


        viewerDragging = true;


        viewerDragStartX =
            event.clientX;

        viewerDragStartY =
            event.clientY;


        viewerOriginX =
            viewerPositionX;

        viewerOriginY =
            viewerPositionY;


        photoZoomArea.setPointerCapture(
            event.pointerId
        );
    }
);


photoZoomArea.addEventListener(
    "pointermove",
    function(event) {

        if (!viewerDragging) {
            return;
        }


        const dx =
            event.clientX -
            viewerDragStartX;

        const dy =
            event.clientY -
            viewerDragStartY;


        viewerPositionX =
            viewerOriginX + dx;

        viewerPositionY =
            viewerOriginY + dy;


        updateViewerTransform();
    }
);


photoZoomArea.addEventListener(
    "pointerup",
    function() {

        viewerDragging = false;
    }
);


photoZoomArea.addEventListener(
    "pointercancel",
    function() {

        viewerDragging = false;
    }
);


/* =========================================================
   갤러리 사진 핀치 시작
========================================================= */

photoZoomArea.addEventListener(
    "touchstart",
    function(event) {

        if (event.touches.length !== 2) {
            return;
        }


        event.preventDefault();


        viewerPinchStartDistance =
            getDistance(
                event.touches[0],
                event.touches[1]
            );


        viewerPinchStartZoom =
            viewerZoom;

    },
    {
        passive: false
    }
);


/* =========================================================
   갤러리 사진 핀치 진행
========================================================= */

photoZoomArea.addEventListener(
    "touchmove",
    function(event) {

        if (event.touches.length !== 2) {
            return;
        }


        event.preventDefault();


        if (
            viewerPinchStartDistance <= 0
        ) {

            return;
        }


        const currentDistance =
            getDistance(
                event.touches[0],
                event.touches[1]
            );


        const ratio =
            currentDistance /
            viewerPinchStartDistance;


        setViewerZoom(
            viewerPinchStartZoom *
            ratio
        );

    },
    {
        passive: false
    }
);


/* =========================================================
   갤러리 사진 핀치 종료
========================================================= */

photoZoomArea.addEventListener(
    "touchend",
    function(event) {

        if (event.touches.length < 2) {

            viewerPinchStartDistance = 0;
        }
    }
);


/* =========================================================
   개별 사진 삭제
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
            "사진 삭제 실패",
            error
        );
    }
}


/* =========================================================
   전체 사진 삭제
========================================================= */

async function deleteAllPhotos() {

    const photos =
        await getAllPhotos();


    if (photos.length === 0) {

        alert(
            "삭제할 사진이 없습니다."
        );

        return;
    }


    const confirmed =
        confirm(
            `사진 ${photos.length}장을 모두 삭제할까요?`
        );


    if (!confirmed) {
        return;
    }


    try {

        await deleteAllPhotosFromDatabase();


        await loadGallery();


        alert(
            "모든 사진이 삭제되었습니다."
        );

    } catch (error) {

        console.error(
            "전체 삭제 실패",
            error
        );

        alert(
            "사진을 삭제하지 못했습니다."
        );
    }
}


/* =========================================================
   이벤트
========================================================= */

cameraPowerButton.addEventListener(
    "click",
    toggleCamera
);


cameraPowerButtonOff.addEventListener(
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


viewerCloseButton.addEventListener(
    "click",
    closePhotoViewer
);


deletePhotoButton.addEventListener(
    "click",
    deleteCurrentPhoto
);


deleteAllButton.addEventListener(
    "click",
    deleteAllPhotos
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
   초기화
========================================================= */

async function initializeApp() {

    try {

        await openDatabase();

        await startCamera();

    } catch (error) {

        console.error(
            "앱 초기화 실패",
            error
        );

        showCameraError(
            "앱을 초기화할 수 없습니다."
        );
    }
}


initializeApp();