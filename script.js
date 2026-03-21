let empleados = [];
let criteriosPorPuesto = {};
let empleadoActual = null;
const PIN_ACCESO = "1432";

export function iniciarApp(db, ref, set, onValue) {
    const dbRef = ref(db, 'matriz_habilidades');

    // --- ESCUCHAR CAMBIOS (Sincronización Total) ---
    onValue(dbRef, (snapshot) => {
        const data = snapshot.val();
        empleados = data?.empleados || [];
        criteriosPorPuesto = data?.criterios || {};
        
        mostrarEmpleados();
        mostrarMatrizFinal();
        
        // Si el usuario está viendo una evaluación, refrescar los criterios
        if (empleadoActual !== null) {
            renderizarMatriz(empleados[empleadoActual].puesto);
        }
    });

    const sincronizarNube = () => {
        document.getElementById("estadoGuardado").innerText = "⏳ Guardando...";
        set(dbRef, { empleados, criterios: criteriosPorPuesto })
            .then(() => {
                document.getElementById("estadoGuardado").innerText = "✅ Sincronizado con Firebase";
            });
    };

    window.cambiarSeccion = (id) => {
        document.querySelectorAll('.apartado').forEach(s => s.classList.add('oculto'));
        document.getElementById(id).classList.remove('oculto');
    };

    // --- GESTIÓN DE EMPLEADOS ---
    document.getElementById("formEmpleado").addEventListener("submit", function(e) {
        e.preventDefault();
        let puestoTexto = document.getElementById("puesto").value.trim().toUpperCase();
        let nuevo = {
            nombre: document.getElementById("nombre").value.trim(),
            puesto: puestoTexto,
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
        alert("Empleado registrado.");
    });

    window.evaluar = (index) => {
        let pass = prompt("🔒 PIN de Seguridad:");
        if (pass !== PIN_ACCESO) return alert("PIN Incorrecto");
        
        empleadoActual = index;
        let emp = empleados[index];
        
        document.getElementById("tituloEmpleado").innerText = `Evaluando: ${emp.nombre} (${emp.puesto})`;
        document.getElementById("evaluacion").classList.remove("oculto");
        
        // Si el puesto no tiene criterios aún, creamos la estructura
        if (!criteriosPorPuesto[emp.puesto]) {
            criteriosPorPuesto[emp.puesto] = { habilidades: [], conocimientos: [], antropometria: [] };
        }
        
        renderizarMatriz(emp.puesto);
        cambiarSeccion('seccion-evaluacion');
    };

    window.agregarItem = (tipo) => {
        if (empleadoActual === null) return alert("Seleccione un empleado primero");
        let puesto = empleados[empleadoActual].puesto;
        let texto = prompt(`Escriba la nueva ${tipo}:`);
        
        if (texto) {
            if (!criteriosPorPuesto[puesto][tipo]) {
                criteriosPorPuesto[puesto][tipo] = [];
            }
            criteriosPorPuesto[puesto][tipo].push(texto);
            sincronizarNube(); // Esto disparará onValue y refrescará la tabla automáticamente
        }
    };

    window.autoGuardar = () => {
        let emp = empleados[empleadoActual];
        let criterios = criteriosPorPuesto[emp.puesto];
        let total = 0, n = 0;

        ['habilidades', 'conocimientos', 'antropometria'].forEach(tipo => {
            (criterios[tipo] || []).forEach((_, i) => {
                let radio = document.querySelector(`input[name="radio_${tipo}_${i}"]:checked`);
                if (radio) {
                    let v = parseInt(radio.value);
                    total += v;
                    emp.respuestas[`radio_${tipo}_${i}`] = v;
                    n++;
                }
            });
        });

        if (n > 0) {
            let porc = (total / (n * 4)) * 100;
            emp.evaluacion = { 
                total, 
                porcentaje: porc.toFixed(2), 
                resultado: porc >= 70 ? "Apto" : "No apto" 
            };
            emp.fecha = new Date().toLocaleString();
            sincronizarNube();
        }
    };

    // --- FUNCIÓN DE DIBUJADO CORREGIDA ---
    function renderizarMatriz(puesto) {
        const cuerpo = document.getElementById("cuerpoMatriz");
        cuerpo.innerHTML = ""; // Limpiar todo antes de dibujar
        
        const emp = empleados[empleadoActual];
        const categorias = [
            { id: 'habilidades', titulo: 'HABILIDADES' },
            { id: 'conocimientos', titulo: 'CONOCIMIENTOS' },
            { id: 'antropometria', titulo: 'MEDIDAS ANTROPOMÉTRICAS' }
        ];

        categorias.forEach(cat => {
            // Añadir fila de título de categoría
            let filaTitulo = `<tr class="seccion"><td colspan="6">${cat.titulo}</td></tr>`;
            cuerpo.innerHTML += filaTitulo;

            // Añadir los items de esa categoría
            const items = criteriosPorPuesto[puesto][cat.id] || [];
            if (items.length === 0) {
                cuerpo.innerHTML += `<tr><td colspan="6" style="color:gray; font-style:italic">No hay items agregados</td></tr>`;
            } else {
                items.forEach((texto, i) => {
                    let key = `radio_${cat.id}_${i}`;
                    let valor = emp.respuestas[key] !== undefined ? emp.respuestas[key] : -1;
                    
                    let fila = `
                        <tr>
                            <td style="text-align:left">${texto}</td>
                            ${[0,1,2,3,4].map(v => `
                                <td><input type="radio" name="${key}" value="${v}" onchange="autoGuardar()" ${valor == v ? 'checked' : ''}></td>
                            `).join('')}
                        </tr>`;
                    cuerpo.innerHTML += fila;
                });
            }
        });
    }

    function mostrarEmpleados() {
        document.querySelector("#tablaEmpleados tbody").innerHTML = empleados.map((e, i) => `
            <tr>
                <td>${e.nombre}</td>
                <td>${e.puesto}</td>
                <td>
                    <button onclick="evaluar(${i})">Evaluar</button>
                    <button class="btn-eliminar" onclick="eliminarEmpleado(${i})">X</button>
                </td>
            </tr>
        `).join('');
    }

    function mostrarMatrizFinal() {
        document.querySelector("#tablaFinal tbody").innerHTML = empleados.filter(e => e.evaluacion).map(e => `
            <tr class="${e.evaluacion.resultado === 'Apto' ? 'apto' : 'no-apto'}">
                <td>${e.nombre}</td>
                <td>${e.puesto}</td>
                <td>${e.evaluacion.total}</td>
                <td>${e.evaluacion.porcentaje}%</td>
                <td>${e.evaluacion.resultado}</td>
            </tr>
        `).join('');
    }

    window.eliminarEmpleado = (i) => { if(confirm("¿Eliminar empleado?")) { empleados.splice(i, 1); sincronizarNube(); } };
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
        link.download = "Matriz_Habilidades.csv";
        link.click();
    };
}
