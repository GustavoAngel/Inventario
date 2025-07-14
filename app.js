// app.js

let db;

window.onload = () => {
    let request = indexedDB.open("inventarioDB", 1);

    request.onerror = () => {
        console.error("Error al abrir IndexedDB");
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        mostrarProductos();
        mostrarHistorial();
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        db.createObjectStore("productos", { keyPath: "id", autoIncrement: true });
        db.createObjectStore("movimientos", { keyPath: "id", autoIncrement: true });
    };
};

function agregarProducto() {
    let nombre = document.getElementById("producto-nombre").value;
    let stock = parseInt(document.getElementById("producto-stock").value);

    let txn = db.transaction("productos", "readwrite");
    let store = txn.objectStore("productos");
    store.add({ nombre: nombre, stock: stock });

    txn.oncomplete = () => {
        document.getElementById("producto-nombre").value = "";
        document.getElementById("producto-stock").value = "";
        mostrarProductos();
    };
}

function registrarMovimiento() {
    let productoId = parseInt(document.getElementById("movimiento-producto").value);
    let tipo = document.getElementById("movimiento-tipo").value;
    let cantidad = parseInt(document.getElementById("movimiento-cantidad").value);

    let txn = db.transaction(["productos", "movimientos"], "readwrite");
    let productosStore = txn.objectStore("productos");
    let movimientosStore = txn.objectStore("movimientos");

    let request = productosStore.get(productoId);

    request.onsuccess = () => {
        let producto = request.result;
        if (tipo === "entrada") producto.stock += cantidad;
        else producto.stock -= cantidad;
        productosStore.put(producto);

        movimientosStore.add({ productoId, tipo, cantidad, fecha: new Date().toISOString() });
    };

    txn.oncomplete = () => {
        document.getElementById("movimiento-cantidad").value = "";
        mostrarProductos();
        mostrarHistorial();
    };
}

function mostrarProductos() {
    let lista = document.getElementById("lista-productos");
    let selector = document.getElementById("movimiento-producto");
    lista.innerHTML = "";
    selector.innerHTML = "";

    let txn = db.transaction("productos", "readonly");
    let store = txn.objectStore("productos");
    store.openCursor().onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
            let producto = cursor.value;
            lista.innerHTML += `<p><b>${producto.nombre}</b>: ${producto.stock} unidades</p>`;
            selector.innerHTML += `<option value="${producto.id}">${producto.nombre}</option>`;
            cursor.continue();
        }
    };
}

function mostrarHistorial() {
    let historial = document.getElementById("historial-movimientos");
    historial.innerHTML = "";

    let txn = db.transaction("movimientos", "readonly");
    let store = txn.objectStore("movimientos");
    store.openCursor(null, 'prev').onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
            let m = cursor.value;
            historial.innerHTML += `<p>${m.tipo.toUpperCase()} - ${m.cantidad} unidades - ${new Date(m.fecha).toLocaleString()}</p>`;
            cursor.continue();
        }
    };
}
