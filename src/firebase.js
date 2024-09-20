import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
