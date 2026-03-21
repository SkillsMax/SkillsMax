// Variables globales
let empleados = [];
let criteriosPorPuesto = {};
let empleadoActual = null;
const PIN_ACCESO = "1234";

// Esta función se activa desde el HTML al cargar Firebase
export function iniciarApp(db, ref, set, onValue, push) {
    const dbRef = ref(db, 'matriz_habilidades');

    // --- 1. ESCUCHAR CAMBIOS EN TIEMPO REAL ---
    // Cada vez que la nube cambie, esto actualiza todos los dispositivos
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
            empleados = data.empleados || [];
            criteriosPorPuesto = data.criterios || {};
        } else {
            empleados = [];
            criteriosPorPuesto = {};
        }
        mostrarEmpleados();
        mostrarMatrizFinal();
    });

    // Función para guardar todo en la nube
    const sincronizarNube = () => {
        set(dbRef, {
            empleados: empleados,
            criterios: criteriosPorPuesto
        });
    };

    // --- 2. GESTIÓN DE EMPLEADOS ---
    document.getElementById("formEmpleado").onsubmit = function(e) {
        e.preventDefault();
        let nombreIngresado = document.getElementById("nombre").value.trim();

        // Verificar duplicados en la lista de la nube
        if (empleados.some(emp => emp.nombre.toLowerCase() === nombreIngresado.toLowerCase())) {
            return alert("⚠️ Error: Esta persona ya está registrada.");
        }

        let nuevoEmpleado = {
            nombre: nombreIngresado,
            puesto: document.getElementById("puesto").value.trim().toUpperCase(),
            cuadrilla: document.getElementById("cuadrilla").value,
            anios: document.getElementById("anios").value,
            peso: document.getElementById("peso").value,
            estatura: document.getElementById("estatura").value,
            escolaridad: document.getElementById("escolaridad").value,
            evaluacion: null,
            respuestas: {},
            detalleTexto: [],
            fecha: "Pendiente"
        };

        empleados.push(nuevoEmpleado);
        sincronizarNube();
        this.reset();
    };

    // --- 3. FUNCIONES GLOBALES (CONEXIÓN CON HTML) ---
    // Como es un módulo, debemos "anclar" las funciones al objeto window
    
    window.evaluar = (index) => {
        let password = prompt("🔒 Código de acceso para evaluar:");
        if (password !== PIN_ACCESO) return alert("Acceso denegado.");

        empleadoActual = index;
        let puesto = empleados[index].puesto;
        document.getElementById("tituloEmpleado").innerText = `${empleados[index].nombre} - [${puesto}]`;

        if (!criteriosPorPuesto[puesto]) {
            criteriosPorPuesto[puesto] = { habilidades: [], conocimientos: [], antropometria: [] };
        }

        renderizarMatriz(puesto);
        document.getElementById("evaluacion").classList.remove("oculto");
        document.getElementById("evaluacion").scrollIntoView({ behavior: 'smooth' });
    };

    window.agregarItem = (tipo) => {
        let puesto = empleados[empleadoActual].puesto;
        let texto = prompt(`Nuevo concepto de ${tipo} para ${puesto}:`);
        if (texto) {
            criteriosPorPuesto[puesto][tipo].push(texto);
            sincronizarNube();
            renderizarMatriz(puesto);
        }
    };

    window.guardarEvaluacion = () => {
        let total = 0;
        let emp = empleados[empleadoActual];
        let criterios = criteriosPorPuesto[emp.puesto];
        let nCriterios = criterios.habilidades.length + criterios.conocimientos.length + criterios.antropometria.length;

        let seleccionados = document.querySelectorAll("#evaluacion input[type=radio]:checked");
        if (seleccionados.length < nCriterios) return alert("Faltan campos por calificar.");

        emp.respuestas = {};
        emp.detalleTexto = [];
        
        ['habilidades', 'conocimientos', 'antropometria'].forEach(tipo => {
            criterios[tipo].forEach((texto, i) => {
                let input = document.querySelector(`input[name="radio_${tipo}_${i}"]:checked`);
                let val = parseInt(input.value);
                total += val;
                emp.respuestas[input.name] = val;
                emp.detalleTexto.push(`${texto}: ${val}`);
            });
        });

        let porcentaje = (total / (nCriterios * 4)) * 100;
        emp.fecha = new Date().toLocaleString();
        emp.evaluacion = { total, porcentaje: porcentaje.toFixed(2), resultado: porcentaje >= 70 ? "Apto" : "No apto" };

        sincronizarNube();
        document.getElementById("evaluacion").classList.add("oculto");
        alert("✅ Evaluación sincronizada en todos los dispositivos.");
    };

    window.eliminarEmpleado = (index) => {
        if(confirm(`¿Eliminar a ${empleados[index].nombre}?`)) {
            empleados.splice(index, 1);
            sincronizarNube();
        }
    };

    window.limpiarTodo = () => {
        if(prompt("Código ADMIN:") === PIN_ACCESO && confirm("¿Borrar TODA la nube?")) {
            set(dbRef, null);
        }
    };

    window.exportarCSV = exportarCSV;
    window.filtrarEmpleados = filtrarEmpleados;
}

// --- FUNCIONES DE APOYO (FUERA DEL MÓDULO) ---

function renderizarMatriz(puesto) {
    document.querySelectorAll(".item-criterio").forEach(el => el.remove());
    let criterios = criteriosPorPuesto[puesto];
    let emp = empleados[empleadoActual];

    const renderSeccion = (tipo, idSeccion) => {
        let last = document.getElementById(idSeccion);
        criterios[tipo].forEach((texto, i) => {
            let fila = document.createElement("tr");
            fila.className = "item-criterio";
            let key = `radio_${tipo}_${i}`;
            let v = emp.respuestas ? emp.respuestas[key] : undefined;

            fila.innerHTML = `
                <td style="text-align: left;">${texto}</td>
                ${[0,1,2,3,4].map(n => `<td><input type="radio" name="${key}" value="${n}" ${v==n?'checked':''}></td>`).join('')}
            `;
            last.after(fila);
            last = fila;
        });
    };
    renderSeccion('habilidades', 'sec-habilidades');
    renderSeccion('conocimientos', 'sec-conocimientos');
    renderSeccion('antropometria', 'sec-antropometria');
}

function filtrarEmpleados() {
    let filtro = document.getElementById("buscarEmpleado").value.toLowerCase();
    document.querySelectorAll("#tablaEmpleados tbody tr").forEach(fila => {
        fila.style.display = fila.cells[0].textContent.toLowerCase().includes(filtro) ? "" : "none";
    });
}

function mostrarEmpleados(){
    let tbody = document.querySelector("#tablaEmpleados tbody");
    tbody.innerHTML = empleados.map((emp, i) => `
        <tr>
            <td>${emp.nombre}</td>
            <td>${emp.puesto}</td>
            <td>
                <button onclick="evaluar(${i})">Evaluar</button>
                <button class="btn-eliminar" onclick="eliminarEmpleado(${i})">X</button>
            </td>
        </tr>`).join('');
}

function mostrarMatrizFinal(){
    let tbody = document.querySelector("#tablaFinal tbody");
    tbody.innerHTML = empleados.filter(e => e.evaluacion).map(emp => `
        <tr class="${emp.evaluacion.resultado === 'Apto' ? 'apto' : 'no-apto'}">
            <td>${emp.nombre}</td>
            <td>${emp.puesto}</td>
            <td>${emp.evaluacion.total}</td>
            <td>${emp.evaluacion.porcentaje}%</td>
            <td>${emp.evaluacion.resultado}</td>
        </tr>`).join('');
}

function exportarCSV() {
    let csv = "\ufeffFecha,Cuadrilla,Nombre,Puesto,Resultado,Detalle\n";
    empleados.forEach(e => {
        let res = e.evaluacion ? `${e.evaluacion.porcentaje}%,${e.evaluacion.resultado}` : "Pendiente,Pendiente";
        let det = e.detalleTexto ? e.detalleTexto.join(" | ") : "";
        csv += `"${e.fecha}","${e.cuadrilla}","${e.nombre}","${e.puesto}",${res},"${det}"\n`;
    });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], {type:'text/csv'}));
    link.download = "Matriz_Habilidades.csv";
    link.click();
}
