// app.js

let db;

window.onload = () => {
    let request = indexedDB.open("inventarioDB", 2);

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
        if (!db.objectStoreNames.contains("productos")) {
            db.createObjectStore("productos", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("movimientos")) {
            db.createObjectStore("movimientos", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("inventarioTemporal")) {
            db.createObjectStore("inventarioTemporal", { keyPath: "productoId" });
        }
    };
};


function agregarProducto() {
    let nombre = document.getElementById("producto-nombre").value;
    let stock = parseInt(document.getElementById("producto-stock").value);
    let categoria = document.getElementById("movimiento-categoria-producto").value;

    let txn = db.transaction("productos", "readwrite");
    let store = txn.objectStore("productos");
    store.add({ nombre: nombre, stock: stock, categoria: categoria });

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
            lista.innerHTML += `<p><b>${producto.nombre}</b> (${producto.categoria}): ${producto.stock} unidades</p>`;
            selector.innerHTML += `<option value="${producto.id}">${producto.nombre}</option>`;
            cursor.continue();
        }
    };
}

function mostrarHistorial() {
    let historial = document.getElementById("historial-movimientos");
    historial.innerHTML = "";

    let txnMov = db.transaction("movimientos", "readonly");
    let storeMov = txnMov.objectStore("movimientos");
    let movimientos = [];

    storeMov.openCursor(null, 'prev').onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
            movimientos.push(cursor.value);
            cursor.continue();
        } else {
            let txnProd = db.transaction("productos", "readonly");
            let storeProd = txnProd.objectStore("productos");

            let productosMap = {};
            storeProd.openCursor().onsuccess = (event) => {
                let cursor = event.target.result;
                if (cursor) {
                    productosMap[cursor.value.id] = cursor.value.nombre;
                    cursor.continue();
                } else {
                    movimientos.forEach(m => {
                        let productoNombre = productosMap[m.productoId] || "Desconocido";
                        historial.innerHTML += `<p>${productoNombre} - ${m.tipo.toUpperCase()} - ${m.cantidad} unidades - ${new Date(m.fecha).toLocaleString()}</p>`;
                    });
                }
            };
        }
    };
}



function mostrarPantallaInventario() {
    let container = document.getElementById("pantalla-inventario");
    container.innerHTML = "";

    let categoriasMap = {};

    let txn = db.transaction("productos", "readonly");
    let store = txn.objectStore("productos");

    store.openCursor().onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
            let producto = cursor.value;
            if (!categoriasMap[producto.categoria]) {
                categoriasMap[producto.categoria] = [];
            }
            categoriasMap[producto.categoria].push(producto);
            cursor.continue();
        } else {
            for (let categoria in categoriasMap) {
                let categoriaDiv = document.createElement("div");
                categoriaDiv.innerHTML = `<h3>${categoria}</h3>`;
                categoriaDiv.className = "categoria-group";

                let productos = categoriasMap[categoria];
                productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

                productos.forEach(producto => {
                    let tile = document.createElement("div");
                    tile.className = "tile";
                    tile.id = `tile-${producto.id}`;
                    tile.innerHTML = `<h4>${producto.nombre}</h4><input type='number' id='input-${producto.id}' placeholder='Cantidad'><button onclick='registrarConteo(${producto.id})'>Registrar</button>`;
                    categoriaDiv.appendChild(tile);
                });

                container.appendChild(categoriaDiv);
            }
        }
    };
}

function registrarConteo(productoId) {
    let cantidad = parseInt(document.getElementById(`input-${productoId}`).value);

    let txn = db.transaction("inventarioTemporal", "readwrite");
    let store = txn.objectStore("inventarioTemporal");
    store.put({ productoId: productoId, cantidad: cantidad });

    let tile = document.getElementById(`tile-${productoId}`);
    tile.classList.add("registrado");
    tile.style.opacity = 0.5;

    let parent = tile.parentNode;
    parent.removeChild(tile);
    parent.appendChild(tile);
}

function finalizarInventario() {
    let txnTemp = db.transaction("inventarioTemporal", "readonly");
    let storeTemp = txnTemp.objectStore("inventarioTemporal");

    let registros = [];

    storeTemp.openCursor().onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
            registros.push(cursor.value);
            cursor.continue();
        } else {
            let txnProd = db.transaction("productos", "readwrite");
            let storeProd = txnProd.objectStore("productos");
            registros.forEach(r => {
                let request = storeProd.get(r.productoId);
                request.onsuccess = () => {
                    let producto = request.result;
                    producto.stock = r.cantidad;
                    storeProd.put(producto);
                };
            });

            txnProd.oncomplete = () => {
                let clearTxn = db.transaction("inventarioTemporal", "readwrite");
                clearTxn.objectStore("inventarioTemporal").clear();
                mostrarProductos();
                alert("Inventario finalizado y actualizado");
            };
        }
    };
}

// Botón para borrar la base de datos
function borrarBaseDeDatos() {
    db.close();
    let deleteRequest = indexedDB.deleteDatabase("inventarioDB");

    deleteRequest.onsuccess = () => {
        alert("Base de datos eliminada correctamente.");
        location.reload();
    };

    deleteRequest.onerror = () => {
        alert("Error al eliminar la base de datos.");
    };

    deleteRequest.onblocked = () => {
        alert("Cierre todas las pestañas abiertas para borrar la base de datos.");
    };
}