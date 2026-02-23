// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    orderBy, 
    query, 
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA18XvAb4NQUip4rW6DRyfs_4ea2LWCgf4",
    authDomain: "mg-products-2d62b.firebaseapp.com",
    projectId: "mg-products-2d62b",
    storageBucket: "mg-products-2d62b.firebasestorage.app",
    messagingSenderId: "431145654712",
    appId: "1:431145654712:web:a3d66d97624e4c77b2974d",
    measurementId: "G-ZTC31RMEVG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

// Export Firebase services for use in other files
export { 
    db, 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    orderBy, 
    query, 
    serverTimestamp,
    getDocs
};