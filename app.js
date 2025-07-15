// app.js

let db;
let inventarioInicioSeleccionado = null;
let inventarioFinSeleccionado = null;

window.onload = () => {
    let request = indexedDB.open("inventarioDB", 2);

    request.onerror = () => {
        console.error("Error al abrir IndexedDB");
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        mostrarProductos();
        mostrarHistorial();
        listarInventariosRealizados();
        listarGastosPorRango();
        //mostrarPantallaInventario();
        establecerFechasPorDefecto();
        listarGastosPorRango();
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
        if (!db.objectStoreNames.contains("inventariosHistorial")) {
            db.createObjectStore("inventariosHistorial", { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains("gastos")) {
            db.createObjectStore("gastos", { keyPath: "id", autoIncrement: true });
        }
        
    };
};


function agregarProducto() {
    let nombre = document.getElementById("producto-nombre").value;
    let stock = parseInt(document.getElementById("producto-stock").value);
    let categoria = document.getElementById("movimiento-categoria-producto").value;
    let precioVenta = parseFloat(document.getElementById("producto-precio-venta").value);
    
    if (!nombre || isNaN(stock) || !categoria || isNaN(precioVenta)) {
        alert("Por favor, complete todos los campos correctamente.");
        return;
    }

    let txn = db.transaction("productos", "readwrite");
    let store = txn.objectStore("productos");
    store.add({ nombre: nombre, stock: stock, categoria: categoria, precioVenta: precioVenta });
    mostrarToast("Producto agregado correctamente.");
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
                lista.innerHTML += `<h3>${categoria}</h3>`;
                let productos = categoriasMap[categoria];
                productos.sort((a, b) => a.nombre.localeCompare(b.nombre));
                productos.forEach(producto => {
                    lista.innerHTML += `<p><b>${producto.nombre}</b> : ${producto.stock} pza</p>`;
                    selector.innerHTML += `<option value="${producto.id}">${producto.nombre}</option>`;
                });
            }
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
        debugger;
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
function navegar() {
    url='/demo.html';
  window.location.href = url;
}
// Llamar a la función para navegar a una página interna del sitio
function compararInventarios(fecha1, fecha2) {
    let txnHist = db.transaction("inventariosHistorial", "readonly");
    let storeHist = txnHist.objectStore("inventariosHistorial");

    let request1 = storeHist.get(fecha1);
    let request2 = storeHist.get(fecha2);

    request1.onsuccess = () => {
        request2.onsuccess = () => {
            let inventario1 = request1.result ? request1.result.inventario : [];
            let inventario2 = request2.result ? request2.result.inventario : [];
            
            let comparacion = {};
            inventario1.forEach(i => comparacion[i.productoId] = { cantidad1: i.cantidad, cantidad2: 0 });
            inventario2.forEach(i => {
                if (comparacion[i.productoId]) {
                    comparacion[i.productoId].cantidad2 = i.cantidad;
                } else {
                    comparacion[i.productoId] = { cantidad1: 0, cantidad2: i.cantidad };
                }
            });

            let txnProd = db.transaction("productos", "readonly");
            let storeProd = txnProd.objectStore("productos");

            let productosMap = {};
            storeProd.openCursor().onsuccess = (event) => {
                let cursor = event.target.result;
                if (cursor) {
                    productosMap[cursor.value.id] = cursor.value;
                    cursor.continue();
                } else {
                    let tabla = `<table border='1'><tr><th>Producto</th><th>${fecha1}</th><th>${fecha2}</th><th>Diferencia</th><th>Total $${fecha2}</th></tr>`;
                    let totalGeneral = 0;
                    for (let id in comparacion) {
                        let producto = productosMap[id] || { nombre: "Desconocido", precioVenta: 0 };
                        let c1 = comparacion[id].cantidad1;
                        let c2 = comparacion[id].cantidad2;
                        let diff = c2 - c1;
                        let totalProducto = (producto.precioVenta || 0) * c2;
                        totalGeneral += totalProducto;
                        tabla += `<tr><td>${producto.nombre}</td><td>${c1}</td><td>${c2}</td><td>${diff}</td><td>$${totalProducto.toFixed(2)}</td></tr>`;
                    }
                    tabla += `<tr><td colspan='4'><b>Total General</b></td><td><b>$${totalGeneral.toFixed(2)}</b></td></tr></table>`;
                    document.getElementById("resultado-comparacion").innerHTML = tabla;
                }
            };
        };
    };
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
                let fecha = new Date().toISOString().split('T')[0];
                let hora = new Date().toISOString();
                let datosDelDia = { fecha: fecha, hora: hora, inventario: registros };
                let txnHist = db.transaction("inventariosHistorial", "readwrite");
                txnHist.objectStore("inventariosHistorial").add(datosDelDia);

                let clearTxn = db.transaction("inventarioTemporal", "readwrite");
                clearTxn.objectStore("inventarioTemporal").clear();
                mostrarProductos();
                alert("Inventario finalizado, actualizado y guardado en historial.");
                listarInventariosRealizados();
            };
        }
    };
}

function listarInventariosRealizados() {
    let container = document.getElementById("lista-inventarios-realizados");
    if (!container) return;
    container.innerHTML = "";

    let txn = db.transaction("inventariosHistorial", "readonly");
    let store = txn.objectStore("inventariosHistorial");

    store.getAll().onsuccess = (event) => {
        let registros = event.target.result;
        registros.sort((a, b) => new Date(b.hora) - new Date(a.hora));

        registros.forEach(reg => {
            let item = document.createElement("div");
            item.className = "tile-inventario";
            item.textContent = `${reg.fecha} ${new Date(reg.hora).toLocaleTimeString()} (ID ${reg.id})`;
            item.onclick = () => seleccionarInventario(reg.id, item);
            container.appendChild(item);
        });

        if (registros.length >= 2) {
            let select1 = document.getElementById("inventario-inicio");
            let select2 = document.getElementById("inventario-fin");
            select1.innerHTML = "";
            select2.innerHTML = "";
            registros.forEach(reg => {
                let option1 = document.createElement("option");
                option1.value = reg.id;
                option1.textContent = `${reg.fecha} ${new Date(reg.hora).toLocaleTimeString()} (ID ${reg.id})`;
                select1.appendChild(option1);

                let option2 = document.createElement("option");
                option2.value = reg.id;
                option2.textContent = `${reg.fecha} ${new Date(reg.hora).toLocaleTimeString()} (ID ${reg.id})`;
                select2.appendChild(option2);
            });
        }
    };
}

function seleccionarInventario(id, elemento) {
    const inicioSelect = document.getElementById("inventario-inicio");
    const finSelect = document.getElementById("inventario-fin");
    const tiles = document.querySelectorAll(".tile-inventario");

    tiles.forEach(tile => tile.classList.remove("inicio-seleccionado", "fin-seleccionado"));

    if (inventarioInicioSeleccionado === null) {
        inventarioInicioSeleccionado = id;
        inicioSelect.value = id;
        elemento.classList.add("inicio-seleccionado");
    } else {
        inventarioFinSeleccionado = id;
        finSelect.value = id;
        elemento.classList.add("fin-seleccionado");
    }
}

function compararInventariosPorID(id1, id2) {
    let txnHist = db.transaction("inventariosHistorial", "readonly");
    let storeHist = txnHist.objectStore("inventariosHistorial");

    let request1 = storeHist.get(Number(id1));
    let request2 = storeHist.get(Number(id2));

    request1.onsuccess = () => {
        request2.onsuccess = () => {
            let inventario1 = request1.result ? request1.result.inventario : [];
            let inventario2 = request2.result ? request2.result.inventario : [];
            let fechaHora1 = request1.result ? new Date(request1.result.hora) : null;
            let fechaHora2 = request2.result ? new Date(request2.result.hora) : null;

            let comparacion = {};
            inventario1.forEach(i => comparacion[i.productoId] = { stockA: i.cantidad, stockB: 0, entradas: 0, salidas: 0, mermas: 0 });
            inventario2.forEach(i => {
                if (comparacion[i.productoId]) {
                    comparacion[i.productoId].stockB = i.cantidad;
                } else {
                    comparacion[i.productoId] = { stockA: 0, stockB: i.cantidad, entradas: 0, salidas: 0, mermas: 0 };
                }
            });

            let txnMov = db.transaction("movimientos", "readonly");
            let storeMov = txnMov.objectStore("movimientos");
            let movimientosRelevantes = [];

            storeMov.openCursor().onsuccess = (event) => {
                let cursor = event.target.result;
                if (cursor) {
                    let mov = cursor.value;
                    let fechaMov = new Date(mov.fecha);
                    if (fechaHora1 && fechaHora2 && fechaMov >= fechaHora1 && fechaMov <= fechaHora2) {
                        movimientosRelevantes.push(mov);
                    }
                    cursor.continue();
                } else {
                    movimientosRelevantes.forEach(mov => {
                        if (!comparacion[mov.productoId]) {
                            comparacion[mov.productoId] = { stockA: 0, stockB: 0, entradas: 0, salidas: 0, mermas: 0 };
                        }
                        if (mov.tipo === "entrada") comparacion[mov.productoId].entradas += mov.cantidad;
                        if (mov.tipo === "salida") comparacion[mov.productoId].salidas += mov.cantidad;
                        if (mov.tipo === "merma") comparacion[mov.productoId].mermas += mov.cantidad;
                    });

                    let txnProd = db.transaction("productos", "readonly");
                    let storeProd = txnProd.objectStore("productos");
                    let productosMap = {};

                    storeProd.openCursor().onsuccess = (event) => {
                        let cursor = event.target.result;
                        if (cursor) {
                            productosMap[cursor.value.id] = cursor.value;
                            cursor.continue();
                        } else {
                            let categoriasMap = {};
                            for (let id in comparacion) {
                                let datos = comparacion[id];
                                let producto = productosMap[id] || { nombre: "Desconocido", categoria: "Sin categoría", precioVenta: 0 };
                                let ventasReales = (datos.stockA + datos.entradas) - (datos.stockB + datos.mermas);
                                let subtotal = ventasReales * producto.precioVenta;

                                if (!categoriasMap[producto.categoria]) {
                                    categoriasMap[producto.categoria] = { subtotal: 0, productos: [] };
                                }
                                categoriasMap[producto.categoria].subtotal += subtotal;
                                categoriasMap[producto.categoria].productos.push({
                                    nombre: producto.nombre,
                                    datos,
                                    ventasReales,
                                    subtotal
                                });
                            }

                            let totalGeneral = 0;
                            let tabla = "";
                            for (let categoria in categoriasMap) {
                                tabla += `<h3>${categoria}</h3>`;
                                tabla += `<table border='1'><tr><th>Producto</th><th>Stock A</th><th>Entradas</th><th>Salidas</th><th>Mermas</th><th>Stock B</th><th>Ventas Reales</th><th>Sub total</th></tr>`;
                                categoriasMap[categoria].productos.forEach(p => {
                                    tabla += `<tr>
                                        <td>${p.nombre}</td>
                                        <td>${p.datos.stockA}</td>
                                        <td>${p.datos.entradas}</td>
                                        <td>${p.datos.salidas}</td>
                                        <td>${p.datos.mermas}</td>
                                        <td>${p.datos.stockB}</td>
                                        <td>${p.ventasReales}</td>
                                        <td>$${p.subtotal.toFixed(2)}</td>
                                    </tr>`;
                                });
                                tabla += `<tr><td colspan='7' style='text-align:right;'><strong>Subtotal ${categoria}:</strong></td><td><strong>$${categoriasMap[categoria].subtotal.toFixed(2)}</strong></td></tr>`;
                                tabla += `</table>`;
                                totalGeneral += categoriasMap[categoria].subtotal;
                            }
                            tabla += `<h2>Total General: $${totalGeneral.toFixed(2)}</h2>`;
                            document.getElementById("resultado-comparacion").innerHTML = tabla;
                        }
                    };
                }
            };
        };
    };
}

function mostrarPantalla(id) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('visible'));
    document.getElementById(id).classList.add('visible');
}

mostrarPantalla('pantalla-inventariomain'); // Mostrar pantalla de inventario al cargar

 document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.getAttribute('data-target');
            mostrarPantalla(target);
        });
});

function registrarGasto() {
    const descripcion = document.getElementById("gasto-descripcion").value;
    const monto = parseFloat(document.getElementById("gasto-monto").value);
    const categoria = document.getElementById("gasto-categoria").value;
    const fechaHora = new Date().toISOString();

    if (!descripcion || isNaN(monto) || monto <= 0) {
        alert("Completa correctamente los datos del gasto.");
        return;
    }

    let gasto = { descripcion, monto, categoria, fechaHora };

    let txn = db.transaction("gastos", "readwrite");
    txn.objectStore("gastos").add(gasto);
    mostrarToast("Gasto registrado correctamente.");
    txn.oncomplete = () => {
        listarGastosPorRango();
        document.getElementById("gasto-descripcion").value = "";
        document.getElementById("gasto-monto").value = "";
    };
}

function listarGastosPorRango() {
    let container = document.getElementById("lista-gastos");
    container.innerHTML = "";

    const fechaInicio = new Date(document.getElementById("gasto-fecha-inicio").value);
    const fechaFin = new Date(document.getElementById("gasto-fecha-fin").value);
    fechaFin.setHours(23,59,59,999);

    if (isNaN(fechaInicio.getTime()) || isNaN(fechaFin.getTime())) {
        return;
    }

    let txn = db.transaction("gastos", "readonly");
    let store = txn.objectStore("gastos");

    store.openCursor().onsuccess = (event) => {
        let cursor = event.target.result;
        if (cursor) {
            let gasto = cursor.value;
            let fechaGasto = new Date(gasto.fechaHora);
            if (fechaGasto >= fechaInicio && fechaGasto <= fechaFin) {
                container.innerHTML += `<p>${gasto.fechaHora.split('T')[0]} - ${gasto.descripcion} (${gasto.categoria}): $${gasto.monto.toFixed(2)}</p>`;
            }
            cursor.continue();
        }
    };
}

function establecerFechasPorDefecto() {
    const ahora = new Date();
    const diaSemana = ahora.getDay();
    const lunes = new Date(ahora);
    lunes.setDate(ahora.getDate() - ((diaSemana + 6) % 7));
    lunes.setHours(0,0,0,0);
    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);
    domingo.setHours(23,59,59,999);

    document.getElementById("gasto-fecha-inicio").value = lunes.toISOString().split("T")[0];
    document.getElementById("gasto-fecha-fin").value = domingo.toISOString().split("T")[0];
}

function mostrarToast(mensaje) {
    let toast = document.createElement("div");
    toast.className = "toast";
    toast.innerText = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add("show"); }, 100);
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
