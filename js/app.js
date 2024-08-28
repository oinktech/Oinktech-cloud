import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import { getAuth, signInWithPopup, signInWithEmailAndPassword, signOut, GoogleAuthProvider, EmailAuthProvider, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, getMetadata, deleteObject } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js';
import { getFirestore, collection, addDoc, query, where, getDocs, deleteDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyARgLcN3sO1OmSh7aM9-jXPKI0qcE396vQ",
    authDomain: "oinktechcloud.firebaseapp.com",
    projectId: "oinktechcloud",
    storageBucket: "oinktechcloud.appspot.com",
    messagingSenderId: "498810970278",
    appId: "1:498810970278:web:88c76634bf54202482d467"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);
const firestore = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const emailProvider = new EmailAuthProvider();

// 使用 Google 登入
document.getElementById('login-google-btn').addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        document.getElementById('status').innerText = `登入成功，歡迎 ${user.displayName}`;
        updateUI(user);
    } catch (error) {
        document.getElementById('status').innerHTML = `<span class="error">登入錯誤: ${error.message}</span>`;
    }
});

// 使用 Email 登入
document.getElementById('login-email-btn').addEventListener('click', async () => {
    const email = prompt("請輸入 Email:");
    const password = prompt("請輸入密碼:");
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        document.getElementById('status').innerText = `登入成功，歡迎 ${user.email}`;
        updateUI(user);
    } catch (error) {
        document.getElementById('status').innerHTML = `<span class="error">登入錯誤: ${error.message}</span>`;
    }
});

// 上傳檔案
document.getElementById('upload-btn').addEventListener('click', () => {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];
    if (file) {
        const storageRef = ref(storage, `files/${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                document.getElementById('progress-bar').style.width = progress + '%';
                document.getElementById('progress-bar').innerText = Math.round(progress) + '%';
                document.getElementById('progress-container').style.display = 'block';
            },
            (error) => {
                document.getElementById('status').innerHTML = `<span class="error">上傳錯誤: ${error.message}</span>`;
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await addDoc(collection(firestore, 'files'), {
                    name: file.name,
                    url: downloadURL,
                    userId: auth.currentUser.uid
                });
                document.getElementById('status').innerText = '上傳成功';
                document.getElementById('progress-bar').style.width = '0%';
                document.getElementById('progress-bar').innerText = '0%';
                document.getElementById('progress-container').style.display = 'none';
                loadLinks(auth.currentUser.uid);
                updateSpaceUsed();
            }
        );
    }
});

// 刪除檔案
document.addEventListener('click', async (event) => {
    if (event.target.classList.contains('delete-btn')) {
        const fileId = event.target.dataset.fileId;
        try {
            // 獲取檔案文檔
            const fileDocRef = doc(firestore, 'files', fileId);
            const fileDoc = await getDoc(fileDocRef); // 使用 getDoc

            if (!fileDoc.exists()) { // 檢查文檔是否存在
                throw new Error('File not found');
            }

            const fileData = fileDoc.data(); // 確保能獲取到文檔數據
            const fileRef = ref(storage, `files/${fileData.name}`); // 確保這裡是 Reference 對象

            // 刪除 Storage 中的檔案
            await deleteObject(fileRef);

            // 刪除 Firestore 中文檔
            await deleteDoc(fileDocRef);

            document.getElementById('status').innerText = '檔案已刪除';
            loadLinks(auth.currentUser.uid);
            updateSpaceUsed();
        } catch (error) {
            document.getElementById('status').innerHTML = `<span class="error">刪除錯誤: ${error.message}</span>`;
        }
    }
});

// 更新 UI
function updateUI(user) {
    document.getElementById('auth-section').style.display = 'none';
    document.getElementById('logout-section').style.display = 'block';
    document.getElementById('file-input').style.display = 'block';
    document.getElementById('upload-btn').style.display = 'block';
    document.getElementById('status').innerText = `登入成功，歡迎 ${user.displayName || user.email}`;
    loadLinks(user.uid);
    updateSpaceUsed();
}

// 載入檔案連結
async function loadLinks(userId) {
    const q = query(collection(firestore, 'files'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    const linksContainer = document.getElementById('links');
    linksContainer.innerHTML = '';
    querySnapshot.forEach((doc) => {
        const fileData = doc.data();
        const linkElement = document.createElement('div');
        linkElement.classList.add('file-item');

        const fileLink = document.createElement('a');
        fileLink.href = fileData.url;
        fileLink.innerText = fileData.name;
        fileLink.target = '_blank';
        fileLink.classList.add('file-link');

        const deleteButton = document.createElement('button');
        deleteButton.innerText = '刪除';
        deleteButton.classList.add('delete-btn');
        deleteButton.dataset.fileId = doc.id;

        linkElement.appendChild(fileLink);
        linkElement.appendChild(deleteButton);
        linksContainer.appendChild(linkElement);
    });
}

// 更新使用空間
async function updateSpaceUsed() {
    try {
        const listRef = ref(storage, 'files/');
        const listResult = await listAll(listRef);
        let totalSize = 0;

        for (const itemRef of listResult.items) {
            const metadata = await getMetadata(itemRef);
            totalSize += metadata.size;
        }

        const sizeInMB = (totalSize / (1024 * 1024)).toFixed(2);
        document.getElementById('space-used').innerText = `已使用空間: ${sizeInMB} MB`;
    } catch (error) {
        document.getElementById('status').innerHTML = `<span class="error">空間計算錯誤: ${error.message}</span>`;
    }
}

// 登出
document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
        await signOut(auth);
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('logout-section').style.display = 'none';
        document.getElementById('file-input').style.display = 'none';
        document.getElementById('upload-btn').style.display = 'none';
        document.getElementById('status').innerText = '已登出';
    } catch (error) {
        document.getElementById('status').innerHTML = `<span class="error">登出錯誤: ${error.message}</span>`;
    }
});

// 監聽用戶狀態
onAuthStateChanged(auth, (user) => {
    if (user) {
        updateUI(user);
    } else {
        document.getElementById('auth-section').style.display = 'block';
        document.getElementById('logout-section').style.display = 'none';
        document.getElementById('file-input').style.display = 'none';
        document.getElementById('upload-btn').style.display = 'none';
    }
});
