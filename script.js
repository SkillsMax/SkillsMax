let empleados = [];
let criteriosPorPuesto = {};
let empleadoActual = null;
const PIN_ACCESO = "1432";

export function iniciarApp(db, ref, set, onValue, push) {
    const dbRef = ref(db, 'matriz_habilidades');

    // --- SINCRONIZACIÓN ---
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        empleados = data?.empleados || [];
        criteriosPorPuesto = data?.criterios || {};
        mostrarEmpleados();
        mostrarMatrizFinal();
    });

    const sincronizar = () => {
        set(dbRef, { empleados, criterios: criteriosPorPuesto });
    };

    // --- NAVEGACIÓN ---
    window.cambiarSeccion = (id) => {
        document.querySelectorAll('.apartado').forEach(s => s.classList.add('oculto'));
        document.getElementById(id).classList.remove('oculto');
    };

    // --- LÓGICA DE EMPLEADOS ---
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
            evaluacion: null, respuestas: {}, detalleTexto: [], fecha: "Pendiente"
        };
        empleados.push(nuevo);
        sincronizar();
        this.reset();
        alert("✅ Empleado registrado");
    });

    window.evaluar = (index) => {
        let pass = prompt("🔒 PIN de Evaluador:");
        if (pass !== PIN_ACCESO) return alert("Incorrecto");

        empleadoActual = index;
        let emp = empleados[index];
        document.getElementById("tituloEmpleado").innerText = `Evaluando a: ${emp.nombre} (${emp.puesto})`;
        
        if (!criteriosPorPuesto[emp.puesto]) {
            criteriosPorPuesto[emp.puesto] = { habilidades: [], conocimientos: [], antropometria: [] };
        }

        renderizarMatriz(emp.puesto);
        document.getElementById("evaluacion").classList.remove("oculto");
        cambiarSeccion('seccion-evaluacion');
    };

    window.agregarItem = (tipo) => {
        if (empleadoActual === null) return alert("Selecciona un empleado primero");
        let puesto = empleados[empleadoActual].puesto;
        let texto = prompt(`Nuevo concepto de ${tipo}:`);
        if (texto) {
            if (!criteriosPorPuesto[puesto][tipo]) criteriosPorPuesto[puesto][tipo] = [];
            criteriosPorPuesto[puesto][tipo].push(texto);
            sincronizar();
            renderizarMatriz(puesto);
        }
    };

    window.guardarEvaluacion = () => {
        let emp = empleados[empleadoActual];
        let criterios = criteriosPorPuesto[emp.puesto];
        let total = 0, n = 0;

        ['habilidades', 'conocimientos', 'antropometria'].forEach(t => {
            criterios[t].forEach((text, i) => {
                let radio = document.querySelector(`input[name="radio_${t}_${i}"]:checked`);
                if (radio) {
                    let v = parseInt(radio.value);
                    total += v;
                    emp.respuestas[`radio_${t}_${i}`] = v;
                    n++;
                }
            });
        });

        if (n === 0) return alert("No hay criterios para evaluar");
        
        let porc = (total / (n * 4)) * 100;
        emp.evaluacion = { total, porcentaje: porc.toFixed(2), resultado: porc >= 70 ? "Apto" : "No apto" };
        emp.fecha = new Date().toLocaleString();
        
        sincronizar();
        alert("⭐⭐ Evaluación Guardada");
        document.getElementById("evaluacion").classList.add("oculto");
    };

    // --- RENDERIZADO ---
    function renderizarMatriz(puesto) {
        document.querySelectorAll(".item-criterio").forEach(el => el.remove());
        const emp = empleados[empleadoActual];
        const render = (tipo, id) => {
            let root = document.getElementById(id);
            (criteriosPorPuesto[puesto][tipo] || []).forEach((texto, i) => {
                let fila = document.createElement("tr");
                fila.className = "item-criterio";
                let key = `radio_${tipo}_${i}`;
                let valor = emp.respuestas[key];
                fila.innerHTML = `<td style="text-align:left">${texto}</td>` + 
                    [0,1,2,3,4].map(v => `<td><input type="radio" name="${key}" value="${v}" ${valor == v ? 'checked' : ''}></td>`).join('');
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

    window.eliminarEmpleado = (i) => { if(confirm("¿Eliminar?")) { empleados.splice(i, 1); sincronizar(); } };
    window.limpiarTodo = () => { if(prompt("PIN ADMIN:") === PIN_ACCESO) { set(dbRef, null); } };
    window.filtrarEmpleados = () => {
        let f = document.getElementById("buscarEmpleado").value.toLowerCase();
        document.querySelectorAll("#tablaEmpleados tbody tr").forEach(r => {
            r.style.display = r.cells[0].textContent.toLowerCase().includes(f) ? "" : "none";
        });
    };
    window.exportarCSV = () => {
        let csv = "\ufeffFecha,Nombre,Puesto,%,Resultado\n";
        empleados.forEach(e => {
            csv += `"${e.fecha}","${e.nombre}","${e.puesto}","${e.evaluacion?.porcentaje || 0}%","${e.evaluacion?.resultado || 'N/A'}"\n`;
        });
        let blob = new Blob([csv], { type: 'text/csv' });
        let a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Matriz.csv";
        a.click();
    };
}
