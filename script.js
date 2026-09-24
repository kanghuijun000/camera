/* =========================================
   카메라 앱
========================================= */

const cameraPreview = document.getElementById("cameraPreview");
const captureButton = document.getElementById("captureButton");
const switchCamera = document.getElementById("switchCamera");

const galleryButton = document.getElementById("galleryButton");
const backToCamera = document.getElementById("backToCamera");

const cameraScreen = document.getElementById("cameraScreen");
const galleryScreen = document.getElementById("galleryScreen");

const cameraError = document.getElementById("cameraError");
const retryCamera = document.getElementById("retryCamera");

const photoCanvas = document.getElementById("photoCanvas");

const galleryGrid = document.getElementById("galleryGrid");
const emptyGallery = document.getElementById("emptyGallery");
const photoCount = document.getElementById("photoCount");

const photoViewer = document.getElementById("photoViewer");
const viewerImage = document.getElementById("viewerImage");
const closeViewer = document.getElementById("closeViewer");
const deletePhotoButton = document.getElementById("deletePhoto");


/* =========================================
   변수
========================================= */

let cameraStream = null;

let currentFacingMode = "environment";

let currentPhotoId = null;

let database = null;


/* =========================================
   IndexedDB
========================================= */

function openDatabase() {

    return new Promise((resolve, reject) => {

        const request = indexedDB.open("CameraAppDatabase", 1);

        request.onupgradeneeded = function(event) {

            const db = event.target.result;

            if (!db.objectStoreNames.contains("photos")) {

                const store = db.createObjectStore("photos", {
                    keyPath: "id",
                    autoIncrement: true
                });

                store.createIndex("createdAt", "createdAt", {
                    unique: false
                });
            }
        };

        request.onsuccess = function(event) {

            database = event.target.result;

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

        const transaction = database.transaction(
            ["photos"],
            "readwrite"
        );

        const store = transaction.objectStore("photos");

        const photo = {
            image: blob,
            createdAt: Date.now()
        };

        const request = store.add(photo);

        request.onsuccess = function() {

            resolve(request.result);
        };

        request.onerror = function() {

            reject(request.error);
        };
    });
}


/* =========================================
   사진 가져오기
========================================= */

function getAllPhotos() {

    return new Promise((resolve, reject) => {

        const transaction = database.transaction(
            ["photos"],
            "readonly"
        );

        const store = transaction.objectStore("photos");

        const request = store.getAll();

        request.onsuccess = function() {

            const photos = request.result;

            photos.sort((a, b) => {
                return b.createdAt - a.createdAt;
            });

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

        const transaction = database.transaction(
            ["photos"],
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


/* =========================================
   카메라 시작
========================================= */

async function startCamera() {

    stopCamera();

    cameraError.classList.add("hidden");

    try {

        cameraStream = await navigator.mediaDevices.getUserMedia({

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

        await cameraPreview.play();

    } catch (error) {

        console.error("카메라 오류:", error);

        cameraError.classList.remove("hidden");
    }
}


/* =========================================
   카메라 종료
========================================= */

function stopCamera() {

    if (!cameraStream) {
        return;
    }

    cameraStream.getTracks().forEach(track => {
        track.stop();
    });

    cameraStream = null;

    cameraPreview.srcObject = null;
}


/* =========================================
   카메라 전환
========================================= */

async function changeCamera() {

    currentFacingMode =
        currentFacingMode === "environment"
            ? "user"
            : "environment";

    await startCamera();
}


/* =========================================
   사진 촬영
========================================= */

async function capturePhoto() {

    if (!cameraStream) {
        return;
    }

    if (cameraPreview.readyState < 2) {
        return;
    }

    const width = cameraPreview.videoWidth;
    const height = cameraPreview.videoHeight;

    if (!width || !height) {
        return;
    }

    photoCanvas.width = width;
    photoCanvas.height = height;

    const context = photoCanvas.getContext("2d");

    /*
        전면 카메라일 경우
        미리보기와 같은 방향으로 저장
    */

    if (currentFacingMode === "user") {

        context.translate(width, 0);
        context.scale(-1, 1);
    }

    context.drawImage(
        cameraPreview,
        0,
        0,
        width,
        height
    );

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

                cameraPreview.style.opacity = "0.3";

                setTimeout(() => {
                    cameraPreview.style.opacity = "1";
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

    stopCamera();

    cameraScreen.classList.remove("active");
    galleryScreen.classList.add("active");

    await renderGallery();
}


/* =========================================
   카메라로 돌아가기
========================================= */

async function returnToCamera() {

    closePhotoViewer();

    galleryScreen.classList.remove("active");
    cameraScreen.classList.add("active");

    await startCamera();
}


/* =========================================
   갤러리 표시
========================================= */

async function renderGallery() {

    galleryGrid.innerHTML = "";

    const photos = await getAllPhotos();

    photoCount.textContent =
        `${photos.length}장`;

    if (photos.length === 0) {

        emptyGallery.classList.remove("hidden");

        return;
    }

    emptyGallery.classList.add("hidden");

    photos.forEach(photo => {

        const item = document.createElement("div");

        item.className = "gallery-item";

        const image = document.createElement("img");

        const url = URL.createObjectURL(
            photo.image
        );

        image.src = url;

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

    currentPhotoId = photo.id;

    const url = URL.createObjectURL(
        photo.image
    );

    viewerImage.src = url;

    photoViewer.classList.remove("hidden");
}


/* =========================================
   사진 뷰어 닫기
========================================= */

function closePhotoViewer() {

    photoViewer.classList.add("hidden");

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

    const id = currentPhotoId;

    await deletePhotoFromDatabase(id);

    closePhotoViewer();

    await renderGallery();
}


/* =========================================
   이벤트
========================================= */

captureButton.addEventListener(
    "click",
    capturePhoto
);

switchCamera.addEventListener(
    "click",
    changeCamera
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
   페이지를 벗어날 때 카메라 종료
========================================= */

window.addEventListener(
    "pagehide",
    stopCamera
);
