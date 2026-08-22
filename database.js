// NANZERA STORE - REALTIME FIREBASE DATABASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction
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


/* =========================================================
   CUSTOMER AUTH
   ========================================================= */

async function ensureCustomerAuth() {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  const result = await signInAnonymously(auth);
  return result.user;
}


/* =========================================================
   ADMIN AUTH
   ========================================================= */

const loginAdmin = (email, password) =>
  signInWithEmailAndPassword(auth, email, password)
    .then(({ user }) => ({
      success: true,
      user
    }))
    .catch(error => ({
      success: false,
      error: getFirebaseErrorMessage(error)
    }));


const logoutAdmin = () =>
  signOut(auth)
    .then(() => ({
      success: true
    }))
    .catch(error => ({
      success: false,
      error: getFirebaseErrorMessage(error)
    }));


function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}


/* =========================================================
   PRODUCTS
   ========================================================= */

async function getProducts() {
  const snap = await getDocs(
    collection(db, "products")
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}


async function getProduct(id) {
  const snap = await getDoc(
    doc(db, "products", id)
  );

  return snap.exists()
    ? {
        id: snap.id,
        ...snap.data()
      }
    : null;
}


async function createProduct(id, data) {
  try {
    await setDoc(
      doc(db, "products", id),
      data,
      { merge: true }
    );

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error)
    };
  }
}


async function updateProduct(id, data) {
  try {
    await updateDoc(
      doc(db, "products", id),
      data
    );

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error)
    };
  }
}


async function deleteProduct(id) {
  try {
    await deleteDoc(
      doc(db, "products", id)
    );

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error)
    };
  }
}


/* =========================================================
   TRANSACTIONS
   ========================================================= */

async function getTransactions() {
  const snap = await getDocs(
    collection(db, "transactions")
  );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}


async function getTransaction(invoiceId) {
  const snap = await getDoc(
    doc(db, "transactions", invoiceId)
  );

  return snap.exists()
    ? {
        id: snap.id,
        ...snap.data()
      }
    : null;
}


async function createTransaction(invoiceId, data) {
  try {
    await setDoc(
      doc(db, "transactions", invoiceId),
      {
        ...data,
        invoice_id: invoiceId,
        created_at: serverTimestamp(),
        last_updated: serverTimestamp()
      }
    );

    return {
      success: true,
      invoiceId
    };

  } catch (error) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error)
    };
  }
}


async function updateTransaction(invoiceId, data) {
  try {
    await updateDoc(
      doc(db, "transactions", invoiceId),
      {
        ...data,
        last_updated: serverTimestamp()
      }
    );

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error)
    };
  }
}


async function deleteTransaction(invoiceId) {
  try {
    await deleteDoc(
      doc(db, "transactions", invoiceId)
    );

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: getFirebaseErrorMessage(error)
    };
  }
}


/* =========================================================
   REALTIME LISTENERS
   ========================================================= */

function watchProducts(callback, onError = console.error) {

  return onSnapshot(
    collection(db, "products"),

    snapshot => {

      const products = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      callback(products);

    },

    error => {

      console.error(
        "Firebase products error:",
        error
      );

      onError(error);

    }
  );
}


function watchTransactions(callback, onError = console.error) {

  return onSnapshot(
    collection(db, "transactions"),

    snapshot => {

      const transactions = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      callback(transactions);

    },

    error => {

      console.error(
        "Firebase transactions error:",
        error
      );

      onError(error);

    }
  );
}


function watchTransaction(
  invoiceId,
  callback,
  onError = console.error
) {

  return onSnapshot(

    doc(
      db,
      "transactions",
      invoiceId
    ),

    snapshot => {

      callback(
        snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data()
            }
          : null
      );

    },

    error => {

      console.error(
        "Firebase transaction error:",
        error
      );

      onError(error);

    }
  );
}


/* =========================================================
   CREATE ORDER + STOCK RESERVATION
   ========================================================= */

async function createOrderWithStock(
  invoiceId,
  productId,
  quantity,
  data
) {

  try {

    const customer =
      await ensureCustomerAuth();


    await runTransaction(
      db,

      async transaction => {

        const productRef =
          doc(
            db,
            "products",
            productId
          );


        const productSnap =
          await transaction.get(
            productRef
          );


        if (!productSnap.exists()) {

          throw new Error(
            "PRODUCT_NOT_FOUND"
          );

        }


        const product =
          productSnap.data();


        const stock =
          Number(
            product.stock ?? 0
          );


        if (stock < quantity) {

          throw new Error(
            "OUT_OF_STOCK"
          );

        }


        /* -----------------------------------------
           RESERVE STOCK
        ----------------------------------------- */

        transaction.update(
          productRef,
          {

            stock:
              stock - quantity,

            reserved_invoice:
              invoiceId,

            reserved_quantity:
              quantity,

            updated_at:
              serverTimestamp()

          }
        );


        /* -----------------------------------------
           CREATE TRANSACTION
        ----------------------------------------- */

        transaction.set(

          doc(
            db,
            "transactions",
            invoiceId
          ),

          {

            ...data,

            invoice_id:
              invoiceId,

            product_id:
              productId,

            quantity:
              quantity,

            customer_uid:
              customer.uid,

            status:
              "WAITING_PAYMENT",

            payment_status:
              "UNPAID",

            created_at:
              serverTimestamp(),

            last_updated:
              serverTimestamp()

          }

        );

      }

    );


    return {
      success: true,
      invoiceId
    };


  } catch (error) {

    console.error(
      "CREATE ORDER ERROR:",
      error
    );


    if (
      error.message ===
      "OUT_OF_STOCK"
    ) {

      return {
        success: false,
        error:
          "Stok produk tidak mencukupi."
      };

    }


    if (
      error.message ===
      "PRODUCT_NOT_FOUND"
    ) {

      return {
        success: false,
        error:
          "Produk tidak ditemukan."
      };

    }


    return {
      success: false,
      error:
        getFirebaseErrorMessage(error)
    };

  }

}


/* =========================================================
   INVOICE
   ========================================================= */

function generateInvoiceId() {

  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let result = "";


  for (
    let i = 0;
    i < 7;
    i++
  ) {

    result +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }


  return `NZR-${result}`;

}


/* =========================================================
   FIREBASE ERROR MESSAGE
   ========================================================= */

function getFirebaseErrorMessage(error) {

  const code =
    error?.code ||
    error?.message ||
    "";


  const map = {

    "auth/invalid-email":
      "Format email tidak valid.",

    "auth/invalid-credential":
      "Email atau password salah.",

    "auth/user-not-found":
      "Akun admin tidak ditemukan.",

    "auth/wrong-password":
      "Password salah.",

    "auth/too-many-requests":
      "Terlalu banyak percobaan. Coba lagi nanti.",

    "auth/operation-not-allowed":
      "Login Anonymous belum diaktifkan di Firebase Authentication.",

    "permission-denied":
      "Akses ditolak oleh Firebase Security Rules.",

    "permission-denied":
      "Akses ditolak oleh Firebase Security Rules.",

    "not-found":
      "Data tidak ditemukan.",

    "failed-precondition":
      "Firebase belum dikonfigurasi dengan benar.",

    "unavailable":
      "Firebase sedang tidak tersedia. Coba lagi."
  };


  return (
    map[code] ||
    error?.message ||
    "Terjadi kesalahan."
  );

}


/* =========================================================
   EXPORT
   ========================================================= */

export {

  app,
  auth,
  db,

  loginAdmin,
  logoutAdmin,
  watchAuth,

  ensureCustomerAuth,

  getProducts,
  getProduct,

  createProduct,
  updateProduct,
  deleteProduct,

  getTransactions,
  getTransaction,

  createTransaction,
  updateTransaction,
  deleteTransaction,

  watchProducts,
  watchTransactions,
  watchTransaction,

  createOrderWithStock,

  generateInvoiceId

};
