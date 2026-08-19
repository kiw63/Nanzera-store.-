// NANZERA STORE - REALTIME FIREBASE DATABASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
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


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {
  apiKey: "AIzaSyAe9qjDfMuwjz_kr87Hrd72MdwFgnnrg_s",
  authDomain: "nanzera-store.firebaseapp.com",
  projectId: "nanzera-store",
  storageBucket: "nanzera-store.firebasestorage.app",
  messagingSenderId: "900477059401",
  appId: "1:900477059401:web:d6c67f9dadd9dde9529a98",
  measurementId: "G-E7M4ZCGYDD"
};


/* =========================================================
   INITIALIZE
========================================================= */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getFirestore(app);


/* =========================================================
   AUTH
========================================================= */

const loginAdmin = (email, password) => {

  return signInWithEmailAndPassword(
    auth,
    email,
    password
  )

  .then(({ user }) => ({
    success: true,
    user
  }))

  .catch(error => ({
    success: false,
    error: getFirebaseErrorMessage(error)
  }));

};


const logoutAdmin = () => {

  return signOut(auth)

    .then(() => ({
      success: true
    }))

    .catch(error => ({
      success: false,
      error: getFirebaseErrorMessage(error)
    }));

};


function watchAuth(callback) {

  return onAuthStateChanged(
    auth,
    callback
  );

}


/* =========================================================
   PRODUCTS
========================================================= */

async function getProducts() {

  const snap =
    await getDocs(
      collection(db, "products")
    );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

}


async function getProduct(id) {

  const snap =
    await getDoc(
      doc(db, "products", id)
    );

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };

}


async function createProduct(id, data) {

  try {

    await setDoc(
      doc(db, "products", id),
      data,
      {
        merge: true
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
   TRANSACTIONS - READ
========================================================= */

async function getTransactions() {

  const snap =
    await getDocs(
      collection(db, "transactions")
    );

  return snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

}


async function getTransaction(invoiceId) {

  const snap =
    await getDoc(
      doc(db, "transactions", invoiceId)
    );

  if (!snap.exists()) {
    return null;
  }

  return {
    id: snap.id,
    ...snap.data()
  };

}


/* =========================================================
   TRANSACTIONS - CREATE
========================================================= */

async function createTransaction(invoiceId, data) {

  try {

    await setDoc(
      doc(db, "transactions", invoiceId),
      {
        ...data,

        invoice_id: invoiceId,

        created_at:
          serverTimestamp(),

        last_updated:
          serverTimestamp()
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


/* =========================================================
   TRANSACTIONS - UPDATE
========================================================= */

async function updateTransaction(
  invoiceId,
  data
) {

  try {

    await updateDoc(
      doc(db, "transactions", invoiceId),
      {
        ...data,

        last_updated:
          serverTimestamp()
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


/* =========================================================
   TRANSACTIONS - DELETE
========================================================= */

async function deleteTransaction(
  invoiceId
) {

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
   REALTIME PRODUCTS
========================================================= */

function watchProducts(
  callback,
  onError = console.error
) {

  return onSnapshot(

    collection(db, "products"),

    snap => {

      callback(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );

    },

    onError

  );

}


/* =========================================================
   REALTIME TRANSACTIONS
========================================================= */

function watchTransactions(
  callback,
  onError = console.error
) {

  return onSnapshot(

    collection(db, "transactions"),

    snap => {

      callback(
        snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }))
      );

    },

    onError

  );

}


/* =========================================================
   REALTIME SINGLE TRANSACTION
========================================================= */

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

    snap => {

      if (!snap.exists()) {

        callback(null);

        return;

      }

      callback({
        id: snap.id,
        ...snap.data()
      });

    },

    onError

  );

}


/* =========================================================
   CREATE ORDER + RESERVE STOCK
========================================================= */

async function createOrderWithStock(
  invoiceId,
  productId,
  quantity,
  data
) {

  try {

    const qty =
      Math.max(
        1,
        Math.floor(
          Number(quantity || 1)
        )
      );


    await runTransaction(
      db,
      async transaction => {

        const productRef =
          doc(
            db,
            "products",
            productId
          );


        const orderRef =
          doc(
            db,
            "transactions",
            invoiceId
          );


        /* -----------------------------------------
           GET PRODUCT
        ----------------------------------------- */

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


        /* -----------------------------------------
           CURRENT STOCK
        ----------------------------------------- */

        const stock =
          Math.max(
            0,
            Math.floor(
              Number(
                product.stock ?? 0
              )
            )
          );


        if (stock < qty) {

          throw new Error(
            "OUT_OF_STOCK"
          );

        }


        /* -----------------------------------------
           CURRENT PRICE
        ----------------------------------------- */

        const unitPrice =
          Number(
            product.price ?? 0
          );


        if (
          !Number.isFinite(unitPrice) ||
          unitPrice < 0
        ) {

          throw new Error(
            "INVALID_PRICE"
          );

        }


        /* -----------------------------------------
           SUBTOTAL
        ----------------------------------------- */

        const subtotal =
          unitPrice * qty;


        /* -----------------------------------------
           DISCOUNT
        ----------------------------------------- */

        let discount =
          Number(
            data?.discount_amount ?? 0
          );


        if (
          !Number.isFinite(discount) ||
          discount < 0
        ) {

          discount = 0;

        }


        if (discount > subtotal) {

          discount = subtotal;

        }


        /* -----------------------------------------
           TOTAL
        ----------------------------------------- */

        const total =
          Math.max(
            0,
            subtotal - discount
          );


        /* -----------------------------------------
           UPDATE STOCK
        ----------------------------------------- */

        transaction.update(

          productRef,

          {

            stock:
              stock - qty,

            last_stock_reservation_invoice:
              invoiceId,

            updated_at:
              serverTimestamp()

          }

        );


        /* -----------------------------------------
           CREATE ORDER
        ----------------------------------------- */

        transaction.set(

          orderRef,

          {

            ...data,

            invoice_id:
              invoiceId,

            product_id:
              productId,

            quantity:
              qty,

            unit_price:
              unitPrice,

            subtotal_price:
              subtotal,

            discount_amount:
              discount,

            total_price:
              total,

            voucher_code:
              data?.voucher_code || "",

            voucher_id:
              data?.voucher_id || "",

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
      "NANZERA createOrderWithStock error:",
      error
    );


    if (
      error?.message ===
      "OUT_OF_STOCK"
    ) {

      return {

        success: false,

        error:
          "Stok produk tidak mencukupi. Silakan refresh dan coba lagi."

      };

    }


    if (
      error?.message ===
      "PRODUCT_NOT_FOUND"
    ) {

      return {

        success: false,

        error:
          "Produk tidak ditemukan."

      };

    }


    if (
      error?.message ===
      "INVALID_PRICE"
    ) {

      return {

        success: false,

        error:
          "Harga produk tidak valid."

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


  let random =
    "";


  for (
    let i = 0;
    i < 7;
    i++
  ) {

    random +=
      chars[
        Math.floor(
          Math.random() *
          chars.length
        )
      ];

  }


  return `NZR-${random}`;

}


/* =========================================================
   FIREBASE ERROR MESSAGE
========================================================= */

function getFirebaseErrorMessage(
  error
) {

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

    "permission-denied":
      "Akses ditolak oleh Firebase Security Rules. Pastikan Firestore Rules sudah di-Publish dan akun admin memiliki dokumen admins/{UID}.",

    "auth/network-request-failed":
      "Koneksi ke Firebase bermasalah.",

    "failed-precondition":
      "Firebase belum memenuhi kondisi yang diperlukan.",

    "not-found":
      "Data tidak ditemukan.",

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
