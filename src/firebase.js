import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyDK4bZaMjjctDjdG-8rdDkczPHA8tbMl_0",
  authDomain: "my-gamble.firebaseapp.com",
  projectId: "my-gamble",
  storageBucket: "my-gamble.appspot.com",
  messagingSenderId: "362532353546",
  appId: "1:362532353546:web:0cf16960c9a8b61e0311f3",
  measurementId: "G-0C4YZXG76G"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app)