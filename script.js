// Variables globales
let empleados = [];
let criteriosPorPuesto = {};
let empleadoActual = null;
const PIN_ACCESO = "1234";

export function iniciarApp(db, ref, set, onValue, push) {
    const dbRef = ref(db, 'matriz_habilidades');

    // --- ESCUCHAR CAMBIOS ---
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        empleados = data?.empleados || [];
        criteriosPorPuesto = data?.criterios || {};

        mostrarEmpleados();
        mostrarMatrizFinal();
    });

    const sincronizarNube = () => {
        set(dbRef, {
            empleados,
            criterios: criteriosPorPuesto
        });
    };

    // --- FORMULARIO ---
    document.getElementById("formEmpleado").addEventListener("submit", function(e) {
        e.preventDefault();

        let nombreIngresado = document.getElementById("nombre").value.trim();

        if (empleados.some(emp => emp.nombre.toLowerCase() === nombreIngresado.toLowerCase())) {
            alert("⚠️ Esta persona ya está registrada.");
            return;
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
    });

    // --- FUNCIONES GLOBALES ---
    window.evaluar = (index) => {
        let password = prompt("🔒 Código de acceso:");
        if (password !== PIN_ACCESO) return alert("Acceso denegado");

        empleadoActual = index;
        let emp = empleados[index];
        let puesto = emp.puesto;

        document.getElementById("tituloEmpleado").innerText =
            `${emp.nombre} - [${puesto}]`;

        if (!criteriosPorPuesto[puesto]) {
            criteriosPorPuesto[puesto] = {
                habilidades: [],
                conocimientos: [],
                antropometria: []
            };
        }

        renderizarMatriz(puesto);
        document.getElementById("evaluacion").classList.remove("oculto");
    };

    window.agregarItem = (tipo) => {
        let puesto = empleados[empleadoActual].puesto;
        let texto = prompt(`Nuevo ${tipo}:`);

        if (texto) {
            criteriosPorPuesto[puesto][tipo].push(texto);
            sincronizarNube();
            renderizarMatriz(puesto);
        }
    };

    window.guardarEvaluacion = () => {
        let emp = empleados[empleadoActual];
        let criterios = criteriosPorPuesto[emp.puesto];

        let total = 0;
        let nCriterios =
            criterios.habilidades.length +
            criterios.conocimientos.length +
            criterios.antropometria.length;

        if (nCriterios === 0) {
            alert("No hay criterios definidos.");
            return;
        }

        let seleccionados = document.querySelectorAll("#evaluacion input[type=radio]:checked");

        if (seleccionados.length < nCriterios) {
            alert("Faltan calificaciones");
            return;
        }

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

        emp.evaluacion = {
            total,
            porcentaje: porcentaje.toFixed(2),
            resultado: porcentaje >= 70 ? "Apto" : "No apto"
        };

        emp.fecha = new Date().toLocaleString();

        sincronizarNube();
        document.getElementById("evaluacion").classList.add("oculto");

        alert("✅ Evaluación guardada");
    };

    window.eliminarEmpleado = (index) => {
        if (confirm(`¿Eliminar a ${empleados[index].nombre}?`)) {
            empleados.splice(index, 1);
            sincronizarNube();
        }
    };

    window.limpiarTodo = () => {
        if (prompt("Código ADMIN:") === PIN_ACCESO &&
            confirm("¿Borrar todo?")) {
            set(dbRef, null);
        }
    };

    window.exportarCSV = exportarCSV;
    window.filtrarEmpleados = filtrarEmpleados;

    // --- FUNCIONES INTERNAS ---
    function renderizarMatriz(puesto) {
        document.querySelectorAll(".item-criterio").forEach(el => el.remove());

        let criterios = criteriosPorPuesto[puesto];
        let emp = empleados[empleadoActual];

        const render = (tipo, id) => {
            let seccion = document.getElementById(id);

            criterios[tipo].forEach((texto, i) => {
                let fila = document.createElement("tr");
                fila.className = "item-criterio";

                let key = `radio_${tipo}_${i}`;
                let valor = emp.respuestas[key];

                fila.innerHTML = `
                    <td style="text-align:left">${texto}</td>
                    ${[0,1,2,3,4].map(n =>
                        `<td><input type="radio" name="${key}" value="${n}" ${valor == n ? 'checked' : ''}></td>`
                    ).join('')}
                `;

                seccion.insertAdjacentElement("afterend", fila);
                seccion = fila;
            });
        };

        render("habilidades", "sec-habilidades");
        render("conocimientos", "sec-conocimientos");
        render("antropometria", "sec-antropometria");
    }

    function mostrarEmpleados() {
        let tbody = document.querySelector("#tablaEmpleados tbody");

        tbody.innerHTML = empleados.map((emp, i) => `
            <tr>
                <td>${emp.nombre}</td>
                <td>${emp.puesto}</td>
                <td>
                    <button onclick="evaluar(${i})">Evaluar</button>
                    <button class="btn-eliminar" onclick="eliminarEmpleado(${i})">X</button>
                </td>
            </tr>
        `).join('');
    }

    function mostrarMatrizFinal() {
        let tbody = document.querySelector("#tablaFinal tbody");

        tbody.innerHTML = empleados
            .filter(e => e.evaluacion)
            .map(emp => `
                <tr class="${emp.evaluacion.resultado === 'Apto' ? 'apto' : 'no-apto'}">
                    <td>${emp.nombre}</td>
                    <td>${emp.puesto}</td>
                    <td>${emp.evaluacion.total}</td>
                    <td>${emp.evaluacion.porcentaje}%</td>
                    <td>${emp.evaluacion.resultado}</td>
                </tr>
            `).join('');
    }

    function filtrarEmpleados() {
        let filtro = document.getElementById("buscarEmpleado").value.toLowerCase();

        document.querySelectorAll("#tablaEmpleados tbody tr").forEach(fila => {
            fila.style.display =
                fila.cells[0].textContent.toLowerCase().includes(filtro)
                    ? ""
                    : "none";
        });
    }

    function exportarCSV() {
        let csv = "\ufeffFecha,Cuadrilla,Nombre,Puesto,Resultado,Detalle\n";

        empleados.forEach(e => {
            let res = e.evaluacion
                ? `${e.evaluacion.porcentaje}%,${e.evaluacion.resultado}`
                : "Pendiente,Pendiente";

            let det = e.detalleTexto?.join(" | ") || "";

            csv += `"${e.fecha}","${e.cuadrilla}","${e.nombre}","${e.puesto}",${res},"${det}"\n`;
        });

        let link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = "Matriz_Habilidades.csv";
        link.click();
    }
}
