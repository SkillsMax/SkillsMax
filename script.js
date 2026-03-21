let empleados = [];
let criteriosPorPuesto = {};
let empleadoActual = null;
const PIN_ACCESO = "1432";

export function iniciarApp(db, ref, set, onValue) {
    const dbRef = ref(db, 'matriz_habilidades');

    // --- ESCUCHAR CAMBIOS DESDE LA NUBE ---
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        empleados = data?.empleados || [];
        criteriosPorPuesto = data?.criterios || {};
        mostrarEmpleados();
        mostrarMatrizFinal();
        // Si hay una evaluación abierta, refrescarla
        if (empleadoActual !== null) renderizarMatriz(empleados[empleadoActual].puesto);
    });

    const sincronizarNube = () => {
        document.getElementById("estadoGuardado").innerText = "⏳ Sincronizando...";
        set(dbRef, { empleados, criterios: criteriosPorPuesto })
            .then(() => {
                document.getElementById("estadoGuardado").innerText = "✅ Cambios guardados automáticamente";
            });
    };

    window.cambiarSeccion = (id) => {
        document.querySelectorAll('.apartado').forEach(s => s.classList.add('oculto'));
        document.getElementById(id).classList.remove('oculto');
    };

    // --- AGREGAR EMPLEADO ---
    document.getElementById("formEmpleado").addEventListener("submit", function(e) {
        e.preventDefault();
        let nuevo = {
            nombre: document.getElementById("nombre").value.trim(),
            puesto: document.getElementById("puesto").value.trim().toUpperCase(),
            cuadrilla: document.getElementById("cuadrilla").value,
            anios: document.getElementById("anios").value,
            peso: document.getElementById("peso").value,
            estatura: document.getElementById("estatura").value,
            escolaridad: document.getElementById("escolaridad").value,
            evaluacion: null, respuestas: {}, fecha: "Pendiente"
        };
        empleados.push(nuevo);
        sincronizarNube();
        this.reset();
    });

    window.evaluar = (index) => {
        let pass = prompt("🔒 PIN:");
        if (pass !== PIN_ACCESO) return alert("Error");
        empleadoActual = index;
        cambiarSeccion('seccion-evaluacion');
        document.getElementById("evaluacion").classList.remove("oculto");
        document.getElementById("tituloEmpleado").innerText = `Empleado: ${empleados[index].nombre}`;
        renderizarMatriz(empleados[index].puesto);
    };

    window.agregarItem = (tipo) => {
        let puesto = empleados[empleadoActual].puesto;
        let texto = prompt(`Nuevo concepto para ${tipo}:`);
        if (texto) {
            if (!criteriosPorPuesto[puesto]) criteriosPorPuesto[puesto] = {habilidades:[], conocimientos:[], antropometria:[]};
            criteriosPorPuesto[puesto][tipo].push(texto);
            sincronizarNube();
        }
    };

    // --- ESTA FUNCIÓN SE EJECUTA EN CADA CLICK ---
    window.autoGuardar = () => {
        let emp = empleados[empleadoActual];
        let criterios = criteriosPorPuesto[emp.puesto];
        let total = 0, n = 0;

        ['habilidades', 'conocimientos', 'antropometria'].forEach(t => {
            (criterios[t] || []).forEach((_, i) => {
                let radio = document.querySelector(`input[name="radio_${t}_${i}"]:checked`);
                if (radio) {
                    let v = parseInt(radio.value);
                    total += v;
                    emp.respuestas[`radio_${t}_${i}`] = v;
                    n++;
                }
            });
        });

        if (n > 0) {
            let porc = (total / (n * 4)) * 100;
            emp.evaluacion = { total, porcentaje: porc.toFixed(2), resultado: porc >= 70 ? "Apto" : "No apto" };
            emp.fecha = new Date().toLocaleString();
            sincronizarNube();
        }
    };

    function renderizarMatriz(puesto) {
        document.querySelectorAll(".item-criterio").forEach(el => el.remove());
        const emp = empleados[empleadoActual];
        if (!criteriosPorPuesto[puesto]) return;

        const render = (tipo, id) => {
            let root = document.getElementById(id);
            (criteriosPorPuesto[puesto][tipo] || []).forEach((texto, i) => {
                let fila = document.createElement("tr");
                fila.className = "item-criterio";
                let key = `radio_${tipo}_${i}`;
                let valorActual = emp.respuestas[key];

                fila.innerHTML = `<td>${texto}</td>` + 
                    [0,1,2,3,4].map(v => `<td><input type="radio" name="${key}" value="${v}" onchange="autoGuardar()" ${valorActual == v ? 'checked' : ''}></td>`).join('');
                root.insertAdjacentElement("afterend", fila);
                root = fila;
            });
        };
        render("habilidades", "sec-habilidades");
        render("conocimientos", "sec-conocimientos");
        render("antropometria", "sec-antropometria");
    }

    function mostrarEmpleados() {
        document.querySelector("#tablaEmpleados tbody").innerHTML = empleados.map((e, i) => `
            <tr><td>${e.nombre}</td><td>${e.puesto}</td>
            <td><button onclick="evaluar(${i})">Evaluar</button>
            <button class="btn-eliminar" onclick="eliminarEmpleado(${i})">X</button></td></tr>
        `).join('');
    }

    function mostrarMatrizFinal() {
        document.querySelector("#tablaFinal tbody").innerHTML = empleados.filter(e => e.evaluacion).map(e => `
            <tr class="${e.evaluacion.resultado === 'Apto' ? 'apto' : 'no-apto'}">
            <td>${e.nombre}</td><td>${e.puesto}</td><td>${e.evaluacion.total}</td>
            <td>${e.evaluacion.porcentaje}%</td><td>${e.evaluacion.resultado}</td></tr>
        `).join('');
    }

    window.eliminarEmpleado = (i) => { if(confirm("¿Eliminar?")) { empleados.splice(i, 1); sincronizarNube(); } };
    window.limpiarTodo = () => { if(prompt("PIN ADMIN:") === PIN_ACCESO) set(dbRef, null); };
    window.filtrarEmpleados = () => {
        let f = document.getElementById("buscarEmpleado").value.toLowerCase();
        document.querySelectorAll("#tablaEmpleados tbody tr").forEach(r => {
            r.style.display = r.cells[0].textContent.toLowerCase().includes(f) ? "" : "none";
        });
    };
    window.exportarCSV = () => {
        let csv = "\ufeffFecha,Nombre,Puesto,%,Resultado\n";
        empleados.forEach(e => csv += `"${e.fecha}","${e.nombre}","${e.puesto}","${e.evaluacion?.porcentaje || 0}%","${e.evaluacion?.resultado || 'N/A'}"\n`);
        let link = document.createElement("a");
        link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        link.download = "Matriz.csv";
        link.click();
    };
}
