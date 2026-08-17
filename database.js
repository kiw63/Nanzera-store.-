// NANZERA STORE - REALTIME FIREBASE DATABASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc,
  deleteDoc, addDoc, query, orderBy, serverTimestamp, onSnapshot,
  runTransaction, limit
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAe9qjDfMuwjz_kr87Hrd72MdwFgnnrg_s",
  authDomain: "nanzera-store.firebaseapp.com",
  projectId: "nanzera-store",
  storageBucket: "nanzera-store.firebasestorage.app",
  messagingSenderId: "900477059401",
  appId: "1:900477059401:web:d6c67f9dadd9dde9529a98",
  measurementId: "G-E7M4ZCGYDD"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const loginAdmin = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)
    .then(({user}) => ({success:true,user}))
    .catch(error => ({success:false,error:getFirebaseErrorMessage(error)}));

const logoutAdmin = () => signOut(auth)
  .then(() => ({success:true}))
  .catch(error => ({success:false,error:getFirebaseErrorMessage(error)}));

function watchAuth(callback) { return onAuthStateChanged(auth, callback); }

async function getProducts() {
  const snap = await getDocs(collection(db, "products"));
  return snap.docs.map(d => ({id:d.id, ...d.data()}));
}
async function getProduct(id) {
  const d = await getDoc(doc(db, "products", id));
  return d.exists() ? {id:d.id, ...d.data()} : null;
}
async function createProduct(id, data) {
  try { await setDoc(doc(db,"products",id), data, {merge:true}); return {success:true}; }
  catch(e) { return {success:false,error:getFirebaseErrorMessage(e)}; }
}
async function updateProduct(id, data) {
  try { await updateDoc(doc(db,"products",id), data); return {success:true}; }
  catch(e) { return {success:false,error:getFirebaseErrorMessage(e)}; }
}
async function deleteProduct(id) {
  try { await deleteDoc(doc(db,"products",id)); return {success:true}; }
  catch(e) { return {success:false,error:getFirebaseErrorMessage(e)}; }
}

async function getTransactions() {
  const snap = await getDocs(collection(db,"transactions"));
  return snap.docs.map(d => ({id:d.id, ...d.data()}));
}
async function getTransaction(invoiceId) {
  const d = await getDoc(doc(db,"transactions",invoiceId));
  return d.exists() ? {id:d.id, ...d.data()} : null;
}
async function createTransaction(invoiceId, data) {
  try {
    await setDoc(doc(db,"transactions",invoiceId), {
      ...data, invoice_id:invoiceId, created_at:serverTimestamp(),
      last_updated:serverTimestamp()
    });
    return {success:true,invoiceId};
  } catch(e) { return {success:false,error:getFirebaseErrorMessage(e)}; }
}
async function updateTransaction(invoiceId, data) {
  try {
    await updateDoc(doc(db,"transactions",invoiceId), {...data,last_updated:serverTimestamp()});
    return {success:true};
  } catch(e) { return {success:false,error:getFirebaseErrorMessage(e)}; }
}
async function deleteTransaction(invoiceId) {
  try { await deleteDoc(doc(db,"transactions",invoiceId)); return {success:true}; }
  catch(e) { return {success:false,error:getFirebaseErrorMessage(e)}; }
}

/* REALTIME LISTENERS */
function watchProducts(callback, onError=console.error) {
  return onSnapshot(collection(db,"products"), snap =>
    callback(snap.docs.map(d => ({id:d.id, ...d.data()}))), onError);
}
function watchTransactions(callback, onError=console.error) {
  return onSnapshot(collection(db,"transactions"), snap =>
    callback(snap.docs.map(d => ({id:d.id, ...d.data()}))), onError);
}
function watchTransaction(invoiceId, callback, onError=console.error) {
  return onSnapshot(doc(db,"transactions",invoiceId), snap =>
    callback(snap.exists() ? {id:snap.id,...snap.data()} : null), onError);
}

/* Atomically reserve stock and create the order. */
async function createOrderWithStock(invoiceId, productId, quantity, data) {
  try {
    await runTransaction(db, async tx => {
      const productRef = doc(db,"products",productId);
      const productSnap = await tx.get(productRef);
      if (!productSnap.exists()) throw new Error("PRODUCT_NOT_FOUND");
      const product = productSnap.data();
      const stock = Number(product.stock ?? 0);
      if (stock < quantity) throw new Error("OUT_OF_STOCK");
      tx.update(productRef, {
        stock: stock - quantity,
        updated_at: serverTimestamp()
      });
      tx.set(doc(db,"transactions",invoiceId), {
        ...data, invoice_id:invoiceId, product_id:productId,
        quantity, status:"WAITING_PAYMENT",
        created_at:serverTimestamp(), last_updated:serverTimestamp()
      });
    });
    return {success:true,invoiceId};
  } catch(e) {
    if (e.message === "OUT_OF_STOCK") return {success:false,error:"Stok produk tidak mencukupi."};
    if (e.message === "PRODUCT_NOT_FOUND") return {success:false,error:"Produk tidak ditemukan."};
    return {success:false,error:getFirebaseErrorMessage(e)};
  }
}

function generateInvoiceId() {
  const chars="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let r="";
  for(let i=0;i<7;i++) r+=chars[Math.floor(Math.random()*chars.length)];
  return `NZR-${r}`;
}

function getFirebaseErrorMessage(error) {
  const code=error?.code || error?.message || "";
  const map={
    "auth/invalid-email":"Format email tidak valid.",
    "auth/invalid-credential":"Email atau password salah.",
    "auth/user-not-found":"Akun admin tidak ditemukan.",
    "auth/wrong-password":"Password salah.",
    "auth/too-many-requests":"Terlalu banyak percobaan. Coba lagi nanti.",
    "permission-denied":"Akses ditolak oleh Firebase Security Rules.",
    "not-found":"Data tidak ditemukan."
  };
  return map[code] || error?.message || "Terjadi kesalahan.";
}

export {
  app, auth, db, loginAdmin, logoutAdmin, watchAuth,
  getProducts, getProduct, createProduct, updateProduct, deleteProduct,
  getTransactions, getTransaction, createTransaction, updateTransaction, deleteTransaction,
  watchProducts, watchTransactions, watchTransaction, createOrderWithStock,
  generateInvoiceId
};
